// Realize Mail → Postos: textos de estado de um posto e das suas caixas.
import type { MailPosto, PostoBox } from '../services/mailPostosService';

export type PostoStateKind = 'disabled' | 'active' | 'invited' | 'no-link';

/** Em que ponto está o posto: desligado, já em uso, à espera de instalar, ou sem link enviado. */
export const postoState = (posto: MailPosto): PostoStateKind => {
  if (posto.disabledAt) return 'disabled';
  if (posto.lastLoginAt) return 'active';
  if (posto.inviteExpiresAt) return 'invited';
  return 'no-link';
};

export type BoxTone = 'ok' | 'wait' | 'error';

/** Estado de uma caixa do posto, em português claro. */
export const boxState = (box: PostoBox): { label: string; tone: BoxTone } => {
  if (box.status === 'active') return { label: 'Ligada', tone: 'ok' };
  if (box.status === 'pending') return { label: 'Por ligar', tone: 'wait' };
  if (box.status === 'reauth') return { label: 'Palavra-passe a rever', tone: 'error' };
  return { label: 'Com erro', tone: 'error' };
};
