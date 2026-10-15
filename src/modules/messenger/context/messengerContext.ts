// Contexto do Messenger: objeto partilhado pelos providers e pelos hooks.
import { createContext } from 'react';
import type { MessengerApi } from '../types';

export const MessengerContext = createContext<MessengerApi | null>(null);
