import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
  storageFrom: vi.fn(),
  tableFrom: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: { from: mocks.storageFrom },
    from: mocks.tableFrom,
  },
}));

import type { PreparedLogo } from '@/lib/logoImage';
import { companyLogoService } from '../companyLogoService';

const NOW = 1_700_000_000_000;
const logo = (ext: PreparedLogo['ext'] = 'webp'): PreparedLogo => ({
  blob: new Blob(['x'], { type: `image/${ext}` }),
  ext,
});

describe('companyLogoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    mocks.storageFrom.mockReturnValue({
      upload: mocks.upload,
      remove: mocks.remove,
      getPublicUrl: mocks.getPublicUrl,
    });
    mocks.tableFrom.mockReturnValue({ update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'c1' }, error: null });
    mocks.getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.test/company-logos/${path}` },
    }));
  });

  afterEach(() => vi.restoreAllMocks());

  describe('publicUrl', () => {
    it('devolve o endereço público do bucket company-logos', () => {
      expect(companyLogoService.publicUrl('c1/1.webp')).toBe(
        'https://cdn.test/company-logos/c1/1.webp'
      );
      expect(mocks.storageFrom).toHaveBeenCalledWith('company-logos');
      expect(mocks.getPublicUrl).toHaveBeenCalledWith('c1/1.webp');
    });

    it.each([null, undefined, ''])('devolve null para %j, sem chamar o armazenamento', path => {
      expect(companyLogoService.publicUrl(path)).toBeNull();
      expect(mocks.storageFrom).not.toHaveBeenCalled();
    });
  });

  describe('upload', () => {
    it('envia para <empresa>/<milissegundos>.<ext> com o tipo e a cache longa', async () => {
      const prepared = logo('webp');
      await companyLogoService.upload('c1', prepared, null);
      expect(mocks.storageFrom).toHaveBeenCalledWith('company-logos');
      expect(mocks.upload).toHaveBeenCalledWith(`c1/${NOW}.webp`, prepared.blob, {
        contentType: 'image/webp',
        cacheControl: '31536000',
      });
    });

    it('usa a extensão png quando a imagem preparada é PNG', async () => {
      const prepared = logo('png');
      const result = await companyLogoService.upload('c1', prepared, null);
      expect(mocks.upload.mock.calls[0][0]).toBe(`c1/${NOW}.png`);
      expect(mocks.upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/png' });
      expect(result).toEqual({ data: `c1/${NOW}.png`, error: null });
    });

    it('grava o caminho novo na empresa e devolve-o', async () => {
      const result = await companyLogoService.upload('c1', logo(), null);
      expect(mocks.tableFrom).toHaveBeenCalledWith('companies');
      expect(mocks.update).toHaveBeenCalledWith({ logo_path: `c1/${NOW}.webp` });
      expect(mocks.eq).toHaveBeenCalledWith('id', 'c1');
      expect(result).toEqual({ data: `c1/${NOW}.webp`, error: null });
    });

    it('sem logo anterior não apaga nada', async () => {
      await companyLogoService.upload('c1', logo(), null);
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('apaga a logo anterior depois de gravar o caminho novo', async () => {
      await companyLogoService.upload('c1', logo(), 'c1/antiga.webp');
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      expect(mocks.remove).toHaveBeenCalledWith(['c1/antiga.webp']);
      expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.remove.mock.invocationCallOrder[0]
      );
    });

    it('se o envio falha devolve o erro e não toca na empresa', async () => {
      const error = { message: 'Payload too large' };
      mocks.upload.mockResolvedValue({ error });
      const result = await companyLogoService.upload('c1', logo(), 'c1/antiga.webp');
      expect(result).toEqual({ data: null, error });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('se gravar na empresa falha, apaga o ficheiro acabado de enviar e mantém o antigo', async () => {
      const error = { message: 'RLS' };
      mocks.maybeSingle.mockResolvedValue({ data: null, error });
      const result = await companyLogoService.upload('c1', logo(), 'c1/antiga.webp');
      expect(result).toEqual({ data: null, error });
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      expect(mocks.remove).toHaveBeenCalledWith([`c1/${NOW}.webp`]);
    });

    it('se a base não altera nenhuma linha, falha, apaga o ficheiro novo e mantém o antigo', async () => {
      mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await companyLogoService.upload('c1', logo(), 'c1/antiga.webp');
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(mocks.select).toHaveBeenCalledWith('id');
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      expect(mocks.remove).toHaveBeenCalledWith([`c1/${NOW}.webp`]);
    });

    it('se apagar a logo anterior falha (ou rejeita), o envio continua a ter sucesso', async () => {
      mocks.remove.mockRejectedValue(new Error('rede'));
      const result = await companyLogoService.upload('c1', logo(), 'c1/antiga.webp');
      expect(result).toEqual({ data: `c1/${NOW}.webp`, error: null });
    });

    it('cada envio tem um nome novo (a cache do navegador nunca fica presa)', async () => {
      const now = vi.mocked(Date.now);
      now.mockReturnValueOnce(1).mockReturnValueOnce(2);
      await companyLogoService.upload('c1', logo(), null);
      await companyLogoService.upload('c1', logo(), null);
      expect(mocks.upload.mock.calls[0][0]).toBe('c1/1.webp');
      expect(mocks.upload.mock.calls[1][0]).toBe('c1/2.webp');
    });
  });

  describe('remove', () => {
    it('limpa o caminho na empresa e apaga o ficheiro', async () => {
      const result = await companyLogoService.remove('c1', 'c1/1.webp');
      expect(mocks.tableFrom).toHaveBeenCalledWith('companies');
      expect(mocks.update).toHaveBeenCalledWith({ logo_path: null });
      expect(mocks.eq).toHaveBeenCalledWith('id', 'c1');
      expect(mocks.remove).toHaveBeenCalledWith(['c1/1.webp']);
      expect(result).toEqual({ data: null, error: null });
    });

    it('se limpar na empresa falha, devolve o erro e não apaga o ficheiro', async () => {
      const error = { message: 'RLS' };
      mocks.maybeSingle.mockResolvedValue({ data: null, error });
      const result = await companyLogoService.remove('c1', 'c1/1.webp');
      expect(result).toEqual({ data: null, error });
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('se a base não altera nenhuma linha, falha e não apaga o ficheiro', async () => {
      mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await companyLogoService.remove('c1', 'c1/1.webp');
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('não falha se o ficheiro já não existir no armazenamento', async () => {
      mocks.remove.mockResolvedValue({ error: { message: 'not found' } });
      const result = await companyLogoService.remove('c1', 'c1/1.webp');
      expect(result).toEqual({ data: null, error: null });
    });
  });
});
