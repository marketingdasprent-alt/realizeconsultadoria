import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  publicUrl: vi.fn(),
  prepareLogo: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('../../../services/companyLogoService', () => ({
  companyLogoService: {
    upload: mocks.upload,
    remove: mocks.remove,
    publicUrl: mocks.publicUrl,
  },
}));
// prepareLogo desenha numa tela (o jsdom não tem); a validação de tipo e tamanho é a verdadeira.
vi.mock('@/lib/logoImage', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/logoImage')>();
  return {
    ...original,
    prepareLogo: (file: File) => {
      const invalid = original.validateLogoFile(file);
      if (invalid) return Promise.reject(invalid);
      return mocks.prepareLogo(file);
    },
  };
});

import { LOGO_MAX_INPUT_BYTES } from '@/lib/logoImage';
import { LogoField } from '../LogoField';

const PREPARED = { blob: new Blob(['x'], { type: 'image/webp' }), ext: 'webp' as const };

const png = (name = 'logo.png') => new File([new Uint8Array(8)], name, { type: 'image/png' });

const renderField = (logoPath: string | null = null) => {
  const onChanged = vi.fn();
  const view = render(
    <LogoField
      company={{ id: 'c1', name: 'Acme Lda', logo_path: logoPath }}
      onChanged={onChanged}
    />
  );
  return { onChanged, ...view };
};

/** Um pai que guarda o caminho, como a ficha faz, para ver a logo mudar de verdade. */
const Host = ({ initial }: { initial: string | null }) => {
  const [path, setPath] = useState(initial);
  return (
    <LogoField company={{ id: 'c1', name: 'Acme Lda', logo_path: path }} onChanged={setPath} />
  );
};

const fileInput = () => screen.getByLabelText('Ficheiro da logo') as HTMLInputElement;

describe('LogoField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publicUrl.mockImplementation((path: string) => `https://cdn.test/${path}`);
    mocks.prepareLogo.mockResolvedValue(PREPARED);
    mocks.upload.mockResolvedValue({ data: 'c1/2.webp', error: null });
    mocks.remove.mockResolvedValue({ data: null, error: null });
  });

  describe('sem logo', () => {
    it('mostra as iniciais e o botão Carregar logo, sem Retirar', () => {
      renderField(null);
      expect(screen.getByText('AL')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Carregar logo/ })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /Retirar/ })).not.toBeInTheDocument();
    });

    it('diz os formatos e o limite aceites', () => {
      renderField(null);
      expect(screen.getByText('PNG, JPG, WebP ou SVG, até 5 MB.')).toBeInTheDocument();
    });

    it('o campo de ficheiro só aceita imagens PNG, JPG, WebP e SVG', () => {
      renderField(null);
      expect(fileInput()).toHaveAttribute('type', 'file');
      expect(fileInput().getAttribute('accept')).toBe(
        'image/png,image/jpeg,image/webp,image/svg+xml'
      );
    });

    it('Carregar logo abre o seletor de ficheiros', async () => {
      renderField(null);
      const click = vi.spyOn(fileInput(), 'click');
      await userEvent.click(screen.getByRole('button', { name: /Carregar logo/ }));
      expect(click).toHaveBeenCalledTimes(1);
    });
  });

  describe('com logo', () => {
    it('mostra a imagem e os botões Trocar logo e Retirar', () => {
      renderField('c1/1.webp');
      expect(document.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/c1/1.webp');
      expect(screen.getByRole('button', { name: /Trocar logo/ })).toBeEnabled();
      expect(screen.getByRole('button', { name: /Retirar/ })).toBeEnabled();
    });
  });

  describe('escolher um ficheiro válido', () => {
    it('prepara a imagem, envia-a com a logo anterior, avisa o pai e dá toast de sucesso', async () => {
      const { onChanged } = renderField('c1/1.webp');
      const file = png();
      await userEvent.upload(fileInput(), file);

      await waitFor(() => expect(onChanged).toHaveBeenCalledWith('c1/2.webp'));
      expect(mocks.prepareLogo).toHaveBeenCalledWith(file);
      expect(mocks.upload).toHaveBeenCalledWith('c1', PREPARED, 'c1/1.webp');
      expect(mocks.toast).toHaveBeenCalledWith({ title: 'Logo atualizada' });
    });

    it('sem logo anterior envia previousPath null', async () => {
      renderField(null);
      await userEvent.upload(fileInput(), png());
      await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith('c1', PREPARED, null));
    });

    it('a pré-visualização passa a mostrar a logo nova, no lugar das iniciais', async () => {
      render(<Host initial={null} />);
      expect(screen.getByText('AL')).toBeInTheDocument();
      await userEvent.upload(fileInput(), png());
      await waitFor(() =>
        expect(document.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/c1/2.webp')
      );
      expect(screen.queryByText('AL')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Trocar logo/ })).toBeInTheDocument();
    });

    it('limpa o campo de ficheiro para se poder escolher o mesmo ficheiro outra vez', async () => {
      renderField(null);
      await userEvent.upload(fileInput(), png());
      await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
      expect(fileInput().value).toBe('');
    });

    it('enquanto envia desativa Trocar e Retirar e volta a ativá-los no fim', async () => {
      let finish: (value: unknown) => void = () => {};
      mocks.upload.mockReturnValue(
        new Promise(resolve => {
          finish = resolve;
        })
      );
      renderField('c1/1.webp');
      await userEvent.upload(fileInput(), png());
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Trocar logo/ })).toBeDisabled()
      );
      expect(screen.getByRole('button', { name: /Retirar/ })).toBeDisabled();

      finish({ data: 'c1/2.webp', error: null });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Trocar logo/ })).toBeEnabled()
      );
    });
  });

  describe('ficheiros inválidos', () => {
    it('um tipo que não é imagem aceite dá erro e não envia nada', async () => {
      const { onChanged } = renderField(null);
      const gif = new File([new Uint8Array(8)], 'logo.gif', { type: 'image/gif' });
      fireEvent.change(fileInput(), { target: { files: [gif] } });

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: 'Não foi possível guardar a logo',
          description: 'Use uma imagem PNG, JPG, WebP ou SVG.',
          variant: 'destructive',
        })
      );
      expect(mocks.prepareLogo).not.toHaveBeenCalled();
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('um ficheiro acima de 5 MB dá erro e não envia nada', async () => {
      const { onChanged } = renderField(null);
      const big = png('grande.png');
      Object.defineProperty(big, 'size', { value: LOGO_MAX_INPUT_BYTES + 1 });
      fireEvent.change(fileInput(), { target: { files: [big] } });

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: 'Não foi possível guardar a logo',
          description: 'A imagem é grande demais. O máximo são 5 MB.',
          variant: 'destructive',
        })
      );
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('depois do erro o botão volta a estar ativo', async () => {
      renderField(null);
      const gif = new File([new Uint8Array(8)], 'logo.gif', { type: 'image/gif' });
      fireEvent.change(fileInput(), { target: { files: [gif] } });
      await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
      expect(screen.getByRole('button', { name: /Carregar logo/ })).toBeEnabled();
    });

    it('uma imagem que não se consegue ler mostra o erro da leitura', async () => {
      mocks.prepareLogo.mockRejectedValue(new Error('decode'));
      renderField(null);
      await userEvent.upload(fileInput(), png());
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: 'Não foi possível guardar a logo',
          description: 'Não foi possível ler esta imagem. Experimente outro ficheiro.',
          variant: 'destructive',
        })
      );
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it('cancelar o seletor (sem ficheiro) não faz nada', () => {
      renderField(null);
      fireEvent.change(fileInput(), { target: { files: [] } });
      expect(mocks.prepareLogo).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();
    });
  });

  describe('erro do servidor', () => {
    it('um erro devolvido no envio é mostrado e não avisa o pai', async () => {
      mocks.upload.mockResolvedValue({ data: null, error: { message: 'RLS' } });
      const { onChanged } = renderField('c1/1.webp');
      await userEvent.upload(fileInput(), png());

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: 'Não foi possível guardar a logo',
          description: 'RLS',
          variant: 'destructive',
        })
      );
      expect(onChanged).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalledWith({ title: 'Logo atualizada' });
      expect(screen.getByRole('button', { name: /Trocar logo/ })).toBeEnabled();
    });

    it('o envio sem erro mas sem caminho também conta como falha', async () => {
      mocks.upload.mockResolvedValue({ data: null, error: null });
      const { onChanged } = renderField(null);
      await userEvent.upload(fileInput(), png());
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'destructive' })
        )
      );
      expect(onChanged).not.toHaveBeenCalled();
    });
  });

  describe('retirar', () => {
    const askToRemove = async () => {
      await userEvent.click(screen.getByRole('button', { name: /Retirar/ }));
      return screen.findByRole('alertdialog');
    };

    it('pede confirmação antes de retirar e não chama o serviço ainda', async () => {
      renderField('c1/1.webp');
      const dialog = await askToRemove();
      expect(dialog).toHaveTextContent('Retirar a logo?');
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('Cancelar fecha o diálogo sem retirar', async () => {
      const { onChanged } = renderField('c1/1.webp');
      await askToRemove();
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('confirmar retira a logo, avisa o pai com null e dá toast', async () => {
      const { onChanged } = renderField('c1/1.webp');
      await askToRemove();
      await userEvent.click(screen.getByRole('button', { name: 'Retirar logo' }));

      await waitFor(() => expect(onChanged).toHaveBeenCalledWith(null));
      expect(mocks.remove).toHaveBeenCalledWith('c1', 'c1/1.webp');
      expect(mocks.toast).toHaveBeenCalledWith({ title: 'Logo retirada' });
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });

    it('depois de retirar voltam as iniciais e desaparece o botão Retirar', async () => {
      render(<Host initial="c1/1.webp" />);
      await askToRemove();
      await userEvent.click(screen.getByRole('button', { name: 'Retirar logo' }));
      await waitFor(() => expect(screen.getByText('AL')).toBeInTheDocument());
      expect(document.querySelector('img')).toBeNull();
      expect(screen.queryByRole('button', { name: /^Retirar$/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Carregar logo/ })).toBeInTheDocument();
    });

    it('se o servidor falha mostra o erro, fecha o diálogo e mantém a logo', async () => {
      mocks.remove.mockResolvedValue({ data: null, error: { message: 'RLS' } });
      const { onChanged } = renderField('c1/1.webp');
      await askToRemove();
      await userEvent.click(screen.getByRole('button', { name: 'Retirar logo' }));

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: 'Não foi possível guardar a logo',
          description: 'RLS',
          variant: 'destructive',
        })
      );
      expect(onChanged).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalledWith({ title: 'Logo retirada' });
      expect(document.querySelector('img')).not.toBeNull();
    });

    it('se a chamada rejeita, o botão e o diálogo não ficam presos', async () => {
      mocks.remove.mockRejectedValue(new Error('rede em baixo'));
      const { onChanged } = renderField('c1/1.webp');
      await askToRemove();
      await userEvent.click(screen.getByRole('button', { name: 'Retirar logo' }));

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: 'Não foi possível guardar a logo',
          description: 'rede em baixo',
          variant: 'destructive',
        })
      );
      expect(onChanged).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText('Retirar a logo?')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: /Trocar logo/ })).toBeEnabled();
    });
  });
});
