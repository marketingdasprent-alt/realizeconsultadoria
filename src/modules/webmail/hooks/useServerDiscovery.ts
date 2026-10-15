import { useEffect, useState } from 'react';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { discoverServers, domainOf, type Discovery } from '../lib/autodiscover';
import { mailService } from '../services/mailService';

/** Procura os servidores do domínio quando o endereço fica completo (com 600 ms de folga). */
export const useServerDiscovery = (email: string, enabled: boolean) => {
  const { isPreview } = useWorkspace();
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
      // No servidor primeiro (DNS real); no browser só como recurso.
      const server = isPreview ? null : (await mailService.discover(`x@${domain}`)).data;
      const result = server ?? (await discoverServers(`x@${domain}`));
      if (cancelled) return;
      setState({ domain, result });
      setIsSearching(false);
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setIsSearching(false);
    };
  }, [domain, enabled, state.domain, isPreview]);

  return { discovery: state.domain === domain ? state.result : null, isSearching };
};
