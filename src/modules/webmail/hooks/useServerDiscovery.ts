import { useEffect, useState } from 'react';
import { discoverServers, domainOf, type Discovery } from '../lib/autodiscover';

/** Procura os servidores do domínio quando o endereço fica completo (com 600 ms de folga). */
export const useServerDiscovery = (email: string, enabled: boolean) => {
  const domain = domainOf(email);
  const [state, setState] = useState<{ domain: string; result: Discovery | null }>({
    domain: '',
    result: null,
  });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!enabled || !/\.[a-z]{2,}$/.test(domain) || domain === state.domain) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      const result = await discoverServers(`x@${domain}`);
      if (cancelled) return;
      setState({ domain, result });
      setIsSearching(false);
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setIsSearching(false);
    };
  }, [domain, enabled, state.domain]);

  return { discovery: state.domain === domain ? state.result : null, isSearching };
};
