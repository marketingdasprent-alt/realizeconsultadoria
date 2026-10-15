// Estado da pré-visualização do Webmail (contas e emails), partilhado entre os hooks.
import { useSyncExternalStore } from 'react';
import type { MailAccount, MailFolder, MailMessage } from '../types';
import { DEMO_MAIL_ACCOUNTS, DEMO_MAILS } from './demoData';

export type DemoMail = MailMessage & { folder: MailFolder };

interface DemoState {
  accounts: MailAccount[];
  mails: DemoMail[];
}

let state: DemoState = { accounts: DEMO_MAIL_ACCOUNTS, mails: DEMO_MAILS };
const listeners = new Set<() => void>();

export const setDemoMail = (update: (current: DemoState) => DemoState) => {
  state = update(state);
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useDemoMail = () => useSyncExternalStore(subscribe, () => state);

export const patchDemoMail = (id: string, patch: Partial<DemoMail>) =>
  setDemoMail(s => ({ ...s, mails: s.mails.map(m => (m.id === id ? { ...m, ...patch } : m)) }));
