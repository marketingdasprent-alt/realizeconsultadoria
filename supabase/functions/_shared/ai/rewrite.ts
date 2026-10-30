// "Usar IA" no Webmail: o Realize AI reescreve o texto de um email que a pessoa escreveu.
// Partilhado pela edge function ai-chat (action 'rewrite') e pelos testes.

export const REWRITE_MODES = ['complete', 'formal', 'short', 'fix'] as const;
export type RewriteMode = (typeof REWRITE_MODES)[number];

export const MAX_REWRITE_TEXT = 6000;
export const MAX_REWRITE_CONTEXT = 3000;

const GOALS: Record<RewriteMode, string> = {
  complete:
    'Torna-o mais completo e bem estruturado: frases claras, saudação inicial e despedida, e desenvolve um pouco as ideias que lá estão (sem acrescentar factos novos).',
  formal: 'Torna-o mais formal e profissional, com cortesia, mantendo o tamanho parecido.',
  short: 'Torna-o mais curto e direto, só com o essencial, mantendo a cortesia.',
  fix: 'Corrige só a ortografia, a gramática e a pontuação; não mudes o estilo nem o tamanho.',
};

/** Instruções para o modelo, conforme o que a pessoa escolheu. */
export const rewritePrompt = (mode: RewriteMode, writerName: string) =>
  `Ajudas ${writerName}, da Realize Consultadoria, a escrever emails. ` +
  `Reescreve o texto do email que te derem, em português de Portugal (nunca do Brasil: "está a fazer", "telemóvel", "equipa", "facto"). ` +
  `${GOALS[mode]} ` +
  `Mantém exatamente os nomes, datas, horas, números, valores, endereços de email e ligações. ` +
  `Não inventes informação, compromissos nem anexos. Não escrevas a assinatura com o nome (a assinatura é posta à parte) nem marcadores como [Seu Nome] ou [Cargo]. ` +
  `Usa o tom de Portugal: "Caros colegas" ou "Bom dia," (nunca "Prezados"), e termina com "Com os melhores cumprimentos," (nunca "Atenciosamente"). ` +
  `Usa texto simples, sem markdown (nada de **, # ou listas com *). ` +
  `Escreve também um assunto curto e claro (até 8 palavras) para o email. ` +
  `Responde exatamente neste formato, sem mais nada antes ou depois:\nASSUNTO: <o assunto>\n\n<o texto do email>`;

/** O pedido à IA: o texto e, se for uma resposta, o email a que se responde (só contexto). */
export const rewriteUserMessage = (text: string, subject: string, context: string) =>
  [
    subject ? `Assunto: ${subject}` : '',
    context
      ? `Email a que se está a responder (só para contexto, não o reescrevas):\n${context}`
      : '',
    `Texto a reescrever:\n${text}`,
  ]
    .filter(Boolean)
    .join('\n\n');

/** Separa o assunto ("ASSUNTO: ...") do texto do email que o modelo devolve. */
export const parseRewrite = (raw: string): { subject: string; text: string } => {
  const lines = raw.trim().replace(/\*\*/g, '').split('\n');
  const index = lines.findIndex(line => /^\s*assunto\s*:/i.test(line));
  // O assunto vem na primeira linha (às vezes depois de "Aqui está…").
  if (index < 0 || index > 2) return { subject: '', text: cleanRewrite(raw) };
  const subject = lines[index]
    .replace(/^\s*assunto\s*:\s*/i, '')
    .replace(/^["“<](.*)["”>]$/, '$1')
    .trim()
    .slice(0, 200);
  return { subject, text: cleanRewrite(lines.slice(index + 1).join('\n')) };
};

/** Limpa o que o modelo devolve: aspas à volta, "Assunto:", markdown e espaços a mais. */
export const cleanRewrite = (raw: string) =>
  raw
    .trim()
    .replace(/^(aqui está[^\n]*:|texto reescrito:)\s*/i, '')
    .replace(/^assunto:[^\n]*\n+/i, '')
    .replace(/^["“](.*)["”]$/s, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    // Marcadores por preencher ("[Seu Nome]", "[Cargo]"): a assinatura já trata disso.
    .replace(/^[ \t]*\[[^\]\n]{1,40}\][ \t]*$/gm, '')
    .replace(/^Atenciosamente,?$/gim, 'Com os melhores cumprimentos,')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
