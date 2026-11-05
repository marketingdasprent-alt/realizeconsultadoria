import { describe, expect, it } from 'vitest';
import { parseRecipients } from '../../../supabase/functions/_shared/mail/request';

describe('parseRecipients (servidor): aspas', () => {
  it("aceita 'a@b.pt' sem as aspas (o SMTP dava 501)", () => {
    expect(parseRecipients(["'gestao@urbango.pt'", 'Ana <ana@x.pt>'])).toEqual([
      { name: null, email: 'gestao@urbango.pt' },
      { name: 'Ana', email: 'ana@x.pt' },
    ]);
  });

  it('continua a recusar o que não é email', () => {
    expect(parseRecipients(['sem arroba'])).toBeNull();
  });
});
