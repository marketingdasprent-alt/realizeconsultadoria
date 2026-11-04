import { describe, expect, it } from 'vitest';
import { findDoneLabel } from '../doneLabel';
import type { MailLabel } from '../../types';

const label = (id: string, name: string): MailLabel => ({
  id,
  accountId: 'a',
  name,
  color: 'green',
  onApply: { folderId: null, folderName: null, markRead: false, removeLabelIds: [] },
});

describe('findDoneLabel', () => {
  it('encontra "Tratado" em qualquer forma e ignora o resto', () => {
    expect(findDoneLabel([label('1', 'Por tratar'), label('2', ' tratado ')])?.id).toBe('2');
    expect(findDoneLabel([label('3', 'Tratada')])?.id).toBe('3');
    expect(findDoneLabel([label('4', 'Por tratar'), label('5', 'Urgente')])).toBeUndefined();
    expect(findDoneLabel(undefined)).toBeUndefined();
  });
});
