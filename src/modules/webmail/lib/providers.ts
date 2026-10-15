// Fornecedores de email do Webmail (briefing §9), com o símbolo de cada um (desenhos
// simplificados em components/MailLogos) e a forma de ligação.
import type React from 'react';
import {
  AolLogo,
  CustomLogo,
  ExchangeLogo,
  GmailLogo,
  ICloudLogo,
  Office365Logo,
  OutlookLogo,
  YahooLogo,
} from '../components/MailLogos';

export type MailProviderKey =
  | 'gmail'
  | 'outlook'
  | 'icloud'
  | 'office365'
  | 'exchange'
  | 'yahoo'
  | 'aol'
  | 'imap';

export interface MailProvider {
  key: MailProviderKey;
  name: string;
  hint?: string;
  /** OAuth (sem palavra-passe guardada) ou servidor IMAP/SMTP. */
  method: 'oauth-google' | 'oauth-microsoft' | 'imap';
  Logo: React.FC;
}

export const MAIL_PROVIDERS: MailProvider[] = [
  {
    key: 'gmail',
    name: 'Gmail',
    hint: 'e Google Workspace',
    method: 'oauth-google',
    Logo: GmailLogo,
  },
  {
    key: 'outlook',
    name: 'Outlook',
    hint: 'Outlook.com e Hotmail',
    method: 'oauth-microsoft',
    Logo: OutlookLogo,
  },
  { key: 'icloud', name: 'iCloud', method: 'imap', Logo: ICloudLogo },
  { key: 'office365', name: 'Microsoft 365', method: 'oauth-microsoft', Logo: Office365Logo },
  { key: 'exchange', name: 'Exchange', method: 'oauth-microsoft', Logo: ExchangeLogo },
  { key: 'yahoo', name: 'Yahoo!', method: 'imap', Logo: YahooLogo },
  { key: 'aol', name: 'AOL', method: 'imap', Logo: AolLogo },
  { key: 'imap', name: 'Outra caixa', hint: 'IMAP + SMTP', method: 'imap', Logo: CustomLogo },
];

/** Como se liga cada tipo de conta (texto do diálogo). */
export const METHOD_TEXT: Record<MailProvider['method'], string> = {
  'oauth-google':
    'Vai entrar na sua conta Google numa janela própria e autorizar o Realize. A sua palavra-passe nunca passa pelo Realize.',
  'oauth-microsoft':
    'Vai entrar na sua conta Microsoft numa janela própria e autorizar o Realize. A sua palavra-passe nunca passa pelo Realize.',
  imap: 'Indica o endereço, os servidores IMAP/SMTP e uma palavra-passe de aplicação. As credenciais ficam guardadas encriptadas.',
};

export interface ImapPreset {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

/** Servidores conhecidos (o resto é preenchido à mão em "Outra caixa"). */
export const IMAP_PRESETS: Partial<Record<MailProviderKey, ImapPreset>> = {
  icloud: {
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
  },
  yahoo: {
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 465,
  },
  aol: { imapHost: 'imap.aol.com', imapPort: 993, smtpHost: 'smtp.aol.com', smtpPort: 465 },
  imap: { imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465 },
};

/** As edge functions só conseguem enviar por SMTP com SSL na porta 465. */
export const SUPPORTED_SMTP_PORT = 465;

export const providerOf = (key: MailProviderKey) =>
  MAIL_PROVIDERS.find(provider => provider.key === key) ??
  MAIL_PROVIDERS[MAIL_PROVIDERS.length - 1];
