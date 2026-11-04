import type { MailLabel } from '../types';

/** O marcador "Tratado" (ou "Tratada"/"Tratados") de uma caixa, para o ✓ de um clique na lista. */
export const findDoneLabel = (labels: MailLabel[] | undefined): MailLabel | undefined =>
  labels?.find(label => /^tratad[oa]s?$/i.test(label.name.trim()));
