import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';
import { NfcBrowserHint } from '../NfcBrowserHint';

vi.mock('@/hooks/useDeviceDetect', () => ({ useDeviceDetect: vi.fn() }));

const device = (overrides: Partial<ReturnType<typeof useDeviceDetect>>) =>
  vi.mocked(useDeviceDetect).mockReturnValue({
    type: 'android',
    isIOS: false,
    isAndroid: false,
    isDesktop: false,
    isMobile: true,
    isPWA: false,
    browser: 'chrome',
    ...overrides,
  });

describe('NfcBrowserHint', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('explains how to make the tag open the app on Android browsers', () => {
    device({ isAndroid: true });
    render(<NfcBrowserHint isRegistered />);
    expect(screen.getByText(/abra a app Realize em vez do browser/)).toBeInTheDocument();
  });

  it('explains the Safari behaviour on iPhone', () => {
    device({ isIOS: true, type: 'ios', browser: 'safari' });
    const { unmount } = render(<NfcBrowserHint isRegistered />);
    expect(screen.getByText(/abre sempre no Safari/)).toHaveTextContent('O registo fica feito');
    unmount();

    // Se o ponto falhou, não diz que ficou registado.
    render(<NfcBrowserHint isRegistered={false} />);
    expect(screen.getByText(/abre sempre no Safari/)).not.toHaveTextContent('O registo fica feito');
  });

  it('stays hidden inside the installed app and after being dismissed', () => {
    device({ isAndroid: true, isPWA: true });
    const { container, unmount } = render(<NfcBrowserHint isRegistered />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    device({ isAndroid: true });
    localStorage.setItem('realize_nfc_browser_hint_dismissed', '1');
    const second = render(<NfcBrowserHint isRegistered />);
    expect(second.container).toBeEmptyDOMElement();
  });
});
