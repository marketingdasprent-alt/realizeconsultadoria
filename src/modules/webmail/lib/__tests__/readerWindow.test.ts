import { afterEach, describe, expect, it, vi } from 'vitest';
import { isReaderWindow, openReaderWindow } from '../readerWindow';

afterEach(() => {
  window.name = '';
  vi.restoreAllMocks();
});

describe('janela só de leitura', () => {
  it('reconhece-se pelo nome da janela', () => {
    expect(isReaderWindow()).toBe(false);
    window.name = 'rz-leitor:a1:m1';
    expect(isReaderWindow()).toBe(true);
  });

  it('abre o email numa janela com nome próprio (o mesmo email volta à mesma janela)', () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);
    expect(openReaderWindow({ accountId: 'a1', id: 'm1' })).toBe(true);
    const [url, name, features] = open.mock.calls[0];
    expect(String(url)).toContain('conta=a1');
    expect(String(url)).toContain('email=m1');
    expect(name).toBe('rz-leitor:a1:m1');
    expect(features).toContain('popup=yes');
    expect(focus).toHaveBeenCalled();
  });

  it('diz quando o navegador bloqueou a janela', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openReaderWindow({ accountId: 'a1', id: 'm1' })).toBe(false);
  });
});
