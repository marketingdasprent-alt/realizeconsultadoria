import { useContext } from 'react';
import { WorkdayContext, type WorkdayContextValue } from './workdayContext';

export const useWorkday = (): WorkdayContextValue => {
  const context = useContext(WorkdayContext);
  if (!context) throw new Error('useWorkday tem de ser usado dentro de <WorkdayProvider>');
  return context;
};

/** Igual a useWorkday, mas devolve null fora do provider (componentes opcionais). */
export const useOptionalWorkday = (): WorkdayContextValue | null => useContext(WorkdayContext);
