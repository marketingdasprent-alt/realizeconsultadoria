// Tipos do Messenger (briefing §5). Usados pela interface tanto com o servidor real
// (Supabase: tabelas chat_*) como com os dados de exemplo da pré-visualização.

export type ConversationKind = 'direct' | 'group' | 'channel' | 'announcement' | 'ai';

export type ConversationFilter = 'all' | ConversationKind;

export interface DirectoryPerson {
  userId: string;
  employeeId: string;
  name: string;
  position: string | null;
  department: string | null;
  /** Email da empresa (acesso "Email Pessoal" da pessoa), nunca o pessoal da ficha. */
  email: string | null;
  /** Telemóvel da empresa atribuído (lista de telefones). */
  phone?: string | null;
}

export interface ConversationSummary {
  id: string;
  kind: ConversationKind;
  title: string;
  /** Cargo/departamento (privadas) ou nº de membros (grupos e canais). */
  subtitle?: string;
  lastMessage: string;
  /** Autor da última mensagem quando não é uma conversa privada. */
  lastAuthor?: string;
  lastAt: string;
  unread: number;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  online?: boolean;
  /** Conversa privada: o colega. */
  peerUserId?: string;
  memberCount?: number;
  /** Foto do grupo (URL público). */
  avatarUrl?: string;
  /** Pode escrever (nos anúncios só quem gere o canal). */
  canPost: boolean;
}

export type MessageKind = 'text' | 'image' | 'file' | 'audio';

export interface MessageReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface ChatAttachment {
  /** Caminho no bucket privado chat-files ("<conversa>/<ficheiro>"). */
  path: string;
  name: string;
  size: number;
  mime: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  authorName: string;
  isMine: boolean;
  kind: MessageKind;
  text?: string;
  attachment?: ChatAttachment;
  durationSec?: number;
  createdAt: string;
  editedAt?: string;
  deleted?: boolean;
  replyTo?: { id: string; authorName: string; text: string };
  reactions?: MessageReaction[];
  /** Lida pelo colega (conversas privadas). */
  read?: boolean;
  /** A enviar (ainda sem confirmação do servidor). */
  pending?: boolean;
  /** Não foi enviada (sem ligação…): fica na conversa para tentar outra vez ou descartar. */
  failed?: boolean;
  /** Pré-visualização local de um ficheiro a enviar. */
  localUrl?: string;
}

export interface SendInput {
  text?: string;
  file?: File;
  audio?: { blob: Blob; durationSec: number };
  replyToId?: string;
}

export type MemberFlag = 'pinned' | 'muted' | 'archived';

/** O que a interface do Messenger precisa, venha de onde vier. */
export interface MessengerApi {
  isLoading: boolean;
  error: string | null;
  me: { userId: string; name: string };
  conversations: ConversationSummary[];
  directory: DirectoryPerson[];
  /** Colega com a app aberta agora (presença em tempo real). */
  isOnline: (userId: string) => boolean;
  /** Total de não lidas (sem as silenciadas), para os contadores do menu. */
  unreadTotal: number;
  activeId: string | null;
  setActive: (conversationId: string | null) => void;
  messages: ChatMessage[];
  messagesLoading: boolean;
  hasOlder: boolean;
  loadOlder: () => void;
  /** Nomes de quem está a escrever na conversa aberta. */
  typing: string[];
  notifyTyping: () => void;
  send: (input: SendInput) => Promise<void>;
  editMessage: (messageId: string, text: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  setFlag: (conversationId: string, flag: MemberFlag, value: boolean) => Promise<void>;
  startDirect: (userId: string) => Promise<string | null>;
  createGroup: (title: string, userIds: string[]) => Promise<string | null>;
  /** Mudar o nome de um grupo (qualquer membro). */
  renameGroup: (conversationId: string, title: string) => Promise<void>;
  /** Pôr (ou tirar, com null) a foto de um grupo (qualquer membro). */
  setGroupAvatar: (conversationId: string, file: File | null) => Promise<void>;
  /** URL temporário de um anexo privado. */
  getFileUrl: (path: string) => Promise<string | null>;
  /** Reenvia uma mensagem (texto, imagem, ficheiro ou voz) para outras conversas. */
  forwardMessage: (message: ChatMessage, conversationIds: string[]) => Promise<void>;
  /** Mensagem que falhou: tentar enviar outra vez. */
  retryMessage: (messageId: string) => Promise<void>;
  /** Mensagem que falhou: tirá-la da conversa. */
  discardMessage: (messageId: string) => void;
}
