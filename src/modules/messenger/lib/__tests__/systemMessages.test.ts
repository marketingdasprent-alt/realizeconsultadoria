import { describe, expect, it } from 'vitest';
import { toConversation } from '../mappers';
import type { ConversationRow } from '../../services/messengerService';

const row = (patch: Partial<ConversationRow>): ConversationRow =>
  ({
    id: 'c1',
    kind: 'group',
    title: 'TVDE',
    is_default: false,
    created_at: '2026-11-03T10:00:00Z',
    last_message_at: '2026-11-03T11:00:00Z',
    my_role: 'member',
    is_pinned: false,
    is_muted: false,
    is_archived: false,
    member_count: 5,
    unread: 0,
    peer_user_id: null,
    peer_name: null,
    peer_position: null,
    peer_department: null,
    last_sender_id: 'u1',
    last_sender_name: 'Luiz Rezende',
    last_kind: 'text',
    last_body: 'Bom dia',
    last_attachment_name: null,
    last_deleted: false,
    ...patch,
  }) as ConversationRow;

describe('última mensagem de um grupo', () => {
  it('mostra o autor numa mensagem normal', () => {
    const conversation = toConversation(row({}), 'me', new Set());
    expect(conversation.lastAuthor).toBe('Luiz');
    expect(conversation.lastMessage).toBe('Bom dia');
  });

  it('numa entrada ou saída mostra só a frase, sem autor', () => {
    const conversation = toConversation(
      row({ last_kind: 'system', last_body: 'Ana Silva entrou no grupo' }),
      'me',
      new Set()
    );
    expect(conversation.lastMessage).toBe('Ana Silva entrou no grupo');
    expect(conversation.lastAuthor).toBeFalsy();
  });
});
