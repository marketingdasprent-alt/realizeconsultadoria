import { useContext } from 'react';
import type { MessengerApi } from '../types';
import { MessengerContext } from './messengerContext';

export const useMessengerApi = (): MessengerApi => {
  const context = useContext(MessengerContext);
  if (!context) throw new Error('useMessengerApi tem de ser usado dentro de um MessengerProvider');
  return context;
};

/** Igual, mas devolve null fora do provider (contadores opcionais no menu). */
export const useOptionalMessenger = (): MessengerApi | null => useContext(MessengerContext);
