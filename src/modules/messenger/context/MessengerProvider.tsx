// Providers do Messenger, partilhado por toda a área do colaborador (a página de mensagens
// e os contadores de não lidas no menu). Ficam acima da estrutura, por isso as mensagens
// continuam a chegar em tempo real noutras páginas.
import React from 'react';
import { useDemoMessenger } from '../hooks/useDemoMessenger';
import { useLiveMessenger, type LiveMessengerUser } from '../hooks/useLiveMessenger';
import { MessengerContext } from './messengerContext';

export const LiveMessengerProvider: React.FC<{
  user: LiveMessengerUser;
  children: React.ReactNode;
}> = ({ user, children }) => (
  <MessengerContext.Provider value={useLiveMessenger(user)}>{children}</MessengerContext.Provider>
);

export const DemoMessengerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MessengerContext.Provider value={useDemoMessenger()}>{children}</MessengerContext.Provider>
);
