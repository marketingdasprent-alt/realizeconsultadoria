import { describe, expect, it } from 'vitest';
import type { MailSummary } from '../../types';
import { dropKept, keepOpened, mergeKept } from '../keptUnread';

const mail = (id: string, date: string, unread = true): MailSummary => ({
  id,
  accountId: 'a',
  threadId: null,
  from: null,
  to: [],
  subject: id,
  snippet: '',
  date,
  unread,
  starred: false,
  hasAttachments: false,
});

describe('keptUnread', () => {
  it('keeps an opened email in the unread list as read, once', () => {
    const opened = mail('1', '2026-10-22T10:00:00Z');
    const kept = keepOpened(keepOpened([], opened), opened);
    expect(kept).toHaveLength(1);
    expect(kept[0].unread).toBe(false);
  });

  it('merges kept emails that the server no longer returns, newest first', () => {
    const live = [mail('3', '2026-10-22T12:00:00Z'), mail('1', '2026-10-22T08:00:00Z')];
    const kept = [mail('2', '2026-10-22T10:00:00Z', false)];
    expect(mergeKept(live, kept).map(m => m.id)).toEqual(['3', '2', '1']);
  });

  it('does not duplicate one the server still returns', () => {
    const live = [mail('1', '2026-10-22T08:00:00Z')];
    expect(mergeKept(live, [mail('1', '2026-10-22T08:00:00Z', false)])).toBe(live);
  });

  it('drops the ones that went to the trash', () => {
    const kept = [mail('1', '2026-10-22T08:00:00Z'), mail('2', '2026-10-22T09:00:00Z')];
    expect(dropKept(kept, [mail('1', '2026-10-22T08:00:00Z')]).map(m => m.id)).toEqual(['2']);
  });
});
