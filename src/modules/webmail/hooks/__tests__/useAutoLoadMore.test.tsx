import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useAutoLoadMore } from '../useAutoLoadMore';

class FakeObserver {
  static all: FakeObserver[] = [];
  closed = false;
  constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {
    FakeObserver.all.push(this);
  }
  observe() {}
  disconnect() {
    this.closed = true;
  }
  see(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
  static open() {
    return FakeObserver.all.filter(o => !o.closed);
  }
}

type Props = Parameters<typeof useAutoLoadMore>[0];
const Harness: React.FC<Props> = props => {
  const { sentinel, stalled, supported } = useAutoLoadMore(props);
  return (
    <ul>
      <li ref={sentinel}>{stalled ? 'parado' : supported ? 'a vigiar' : 'sem suporte'}</li>
    </ul>
  );
};

const base = (over: Partial<Props> = {}): Props => ({
  hasMore: true,
  isLoadingMore: false,
  failed: false,
  loadMore: vi.fn(),
  pageCount: 1,
  maxRun: 3,
  resetKey: 'a',
  ...over,
});

describe('useAutoLoadMore', () => {
  beforeEach(() => {
    FakeObserver.all = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('carrega a página seguinte quando o fim da lista aparece', () => {
    const props = base();
    render(<Harness {...props} />);
    act(() => FakeObserver.open()[0].see(true));
    expect(props.loadMore).toHaveBeenCalledTimes(1);
  });

  it('não vigia sem mais páginas, a meio de um pedido nem depois de uma falha', () => {
    const { rerender } = render(<Harness {...base({ hasMore: false })} />);
    expect(FakeObserver.open()).toHaveLength(0);
    rerender(<Harness {...base({ isLoadingMore: true })} />);
    expect(FakeObserver.open()).toHaveLength(0);
    rerender(<Harness {...base({ failed: true })} />);
    expect(FakeObserver.open()).toHaveLength(0);
  });

  it('uma página de cada vez: só volta a vigiar quando a anterior chega', () => {
    const props = base();
    const { rerender } = render(<Harness {...props} />);
    act(() => FakeObserver.open()[0].see(true));
    rerender(<Harness {...base({ loadMore: props.loadMore, isLoadingMore: true })} />);
    expect(FakeObserver.open()).toHaveLength(0);
    rerender(<Harness {...base({ loadMore: props.loadMore, pageCount: 2 })} />);
    expect(FakeObserver.open()).toHaveLength(1);
    act(() => FakeObserver.open()[0].see(true)); // a lista continua curta: pede a seguinte
    expect(props.loadMore).toHaveBeenCalledTimes(2);
  });

  it('para ao fim de maxRun páginas seguidas e mostra o botão; rolar retoma', () => {
    const loadMore = vi.fn();
    const { rerender } = render(<Harness {...base({ loadMore, maxRun: 1 })} />);
    act(() => FakeObserver.open()[0].see(true));
    expect(loadMore).toHaveBeenCalledTimes(1);
    rerender(<Harness {...base({ loadMore, maxRun: 1, pageCount: 2 })} />);
    act(() => FakeObserver.open()[0].see(true));
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(screen.getByText('parado')).toBeInTheDocument();
    act(() => FakeObserver.open()[0].see(false)); // a pessoa rolou: o fim saiu de vista
    expect(screen.getByText('a vigiar')).toBeInTheDocument();
    act(() => FakeObserver.open()[0].see(true));
    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it('sem IntersectionObserver fica o botão (suported = false)', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Harness {...base()} />);
    expect(screen.getByText('sem suporte')).toBeInTheDocument();
  });
});
