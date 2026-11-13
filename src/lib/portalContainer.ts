import { createContext, useContext } from 'react';

/**
 * Onde os menus e avisos (dropdowns, selects, diálogos) se desenham. Por omissão, o corpo da
 * página; numa janela do navegador aberta à parte (ex.: a nova mensagem noutro monitor) é o
 * corpo dessa janela, senão os menus apareciam na janela principal.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export const usePortalContainer = () => useContext(PortalContainerContext) ?? undefined;
