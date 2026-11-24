import { describe, expect, it, vi } from 'vitest';
import { createAccountWatcher } from '../account-change';

describe('createAccountWatcher', () => {
  it('a primeira conta e a mesma conta a renovar a sessão não limpam nada', () => {
    const onChange = vi.fn();
    const seen = createAccountWatcher(onChange);
    seen('u1');
    seen('u1');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('diz qual é a conta nova (para poupar o que já é dela) ou null ao terminar a sessão', () => {
    const onChange = vi.fn();
    const seen = createAccountWatcher(onChange);
    seen('u1');
    seen('u2');
    expect(onChange).toHaveBeenLastCalledWith('u2');
    seen(null);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('outra conta a entrar limpa uma vez', () => {
    const onChange = vi.fn();
    const seen = createAccountWatcher(onChange);
    seen('u1');
    seen('u2');
    expect(onChange).toHaveBeenCalledTimes(1);
    seen('u2');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('terminar a sessão limpa, e entrar depois com outra conta não limpa outra vez', () => {
    const onChange = vi.fn();
    const seen = createAccountWatcher(onChange);
    seen('u1');
    seen(null);
    expect(onChange).toHaveBeenCalledTimes(1);
    seen('u2');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('sem sessão desde o início não limpa', () => {
    const onChange = vi.fn();
    const seen = createAccountWatcher(onChange);
    seen(null);
    seen(null);
    expect(onChange).not.toHaveBeenCalled();
  });
});
