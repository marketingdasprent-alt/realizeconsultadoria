// Marcadores do Webmail: a chave que liga um marcador a um email. É o Message-ID do cabeçalho
// (igual em todas as pastas e para todos os que têm acesso à caixa), não o id do fornecedor,
// que muda quando o email é movido (UID do IMAP).

export const LABEL_COLORS = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'gray',
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

/** Message-ID sem <> e em minúsculas; null se não houver. */
export const messageKey = (raw: string | null | undefined): string | null => {
  const key = (raw ?? '').trim().replace(/^<|>$/g, '').trim().toLowerCase();
  return key ? key.slice(0, 500) : null;
};

/** A chave guardada para um email: o Message-ID ou, sem ele, "id:<id no fornecedor>". */
export const labelKeyOf = (mail: { id: string; message_key?: string | null }): string =>
  mail.message_key ? mail.message_key : `id:${mail.id}`;

/** O que uma etiqueta faz ao ser posta (automação). */
export interface LabelAutomation {
  folder_id?: string | null;
  folder_name?: string | null;
  mark_read?: boolean;
  remove_label_ids?: string[];
}
