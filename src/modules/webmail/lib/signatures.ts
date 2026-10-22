// Várias assinaturas por caixa: criar, limpar para gravar e escolher ao escrever.
import type { MailSignature } from '../types';
import { signatureToHtml } from './signature';

/** Escolha no compositor: 'default' = a predefinida, 'none' = sem assinatura, ou o id. */
export type SignatureChoice = 'default' | 'none' | string;

export const newSignature = (existing: MailSignature[]): MailSignature => ({
  id: crypto.randomUUID(),
  name: `Assinatura ${existing.length + 1}`,
  html: '',
  isDefault: existing.length === 0,
});

/**
 * Pronta a gravar: HTML limpo, sem as vazias, nome por defeito e exatamente uma predefinida
 * (a primeira se nenhuma estiver marcada).
 */
export const cleanSignatures = (list: MailSignature[]): MailSignature[] => {
  const kept = list
    .map((signature, index) => ({
      ...signature,
      name: signature.name.trim() || `Assinatura ${index + 1}`,
      // Assinaturas antigas eram texto simples: passam a HTML.
      html: signatureToHtml(signature.html),
    }))
    .filter(signature => signature.html);
  const defaultId = (kept.find(signature => signature.isDefault) ?? kept[0])?.id;
  return kept.map(signature => ({ ...signature, isDefault: signature.id === defaultId }));
};

/** A assinatura que vai no email (null = nenhuma). */
export const pickSignature = (
  signatures: MailSignature[],
  choice: SignatureChoice
): MailSignature | null => {
  if (choice === 'none') return null;
  if (choice === 'default') return signatures.find(signature => signature.isDefault) ?? null;
  return signatures.find(signature => signature.id === choice) ?? null;
};
