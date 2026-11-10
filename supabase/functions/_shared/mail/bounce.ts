// Emails devolvidos ("Undelivered Mail Returned to Sender", 550…): reconhece-os e explica em
// português porque o email não chegou, para avisar quem o enviou (sem ter de ler o inglês técnico).

const BOUNCE_SENDER = /^(mailer-daemon|postmaster|mail-daemon|mailerdaemon)@/i;
const BOUNCE_SUBJECT =
  /(undeliver|returned mail|mail delivery (failed|failure|system)|delivery (status notification \((failure|delay)\)|has failed|failure)|failure notice|não entregue|nao entregue|não foi possível entregar|entrega falhou|non remis|unzustellbar)/i;
// Respostas/reencaminhamentos de um aviso ("Re: Undeliverable…") e avisos de sucesso não contam;
// "devolvid" saiu: "Encomenda devolvida" / "Viatura devolvida" são emails normais.
const NOT_BOUNCE_SUBJECT =
  /^\s*(re|res|fwd?|enc|tr|aw|sv)\s*:|\((relay|delivered|expanded)\)|success/i;

/** É um aviso de email devolvido? (remetente do sistema de correio ou assunto típico) */
export const isBounce = (from: string | null | undefined, subject: string | null | undefined) =>
  (!!from && BOUNCE_SENDER.test(from.trim())) ||
  (!!subject && BOUNCE_SUBJECT.test(subject) && !NOT_BOUNCE_SUBJECT.test(subject));

const REASONS: [RegExp, string][] = [
  [/too many mime parts|too many attachments/i, 'tinha demasiados anexos'],
  [
    /message (size|too (big|large))|exceeds.{0,40}size|size limit|552[ -]5\.3\.4|too large/i,
    'era grande demais para o servidor de quem recebe',
  ],
  [
    /mailbox (is )?full|quota|over ?quota|insufficient (storage|space)|552[ -]5\.2\.2/i,
    'a caixa de quem recebe está cheia',
  ],
  [
    /user unknown|unknown user|no such user|does not exist|doesn't exist|recipient.{0,30}(rejected|unknown|not found|invalid)|address (rejected|not found)|invalid (recipient|mailbox)|mailbox (unavailable|not found)|5\.1\.1|5\.1\.10/i,
    'o endereço de destino não existe (confirme se está bem escrito)',
  ],
  [
    /host (or domain name )?not found|domain.{0,20}(not found|does not exist)|no mx|nxdomain|5\.1\.2|5\.4\.4/i,
    'o domínio de destino não existe (confirme o que está depois do @)',
  ],
  [
    /spam|blocked|blacklist|block ?list|reputation|policy|5\.7\.1|rejected for policy|spf|dmarc|dkim/i,
    'foi recusado pelo servidor de quem recebe (filtro de spam ou regras de segurança)',
  ],
  [
    /timed? ?out|could not be delivered.{0,40}(hours|days)|retry time|delay|4\.4\.7/i,
    'o servidor de quem recebe não respondeu durante muito tempo',
  ],
];

const RECIPIENT_PATTERNS = [
  /final-recipient:\s*rfc822;\s*<?([^\s<>;]+@[^\s<>;]+)>?/i,
  /original-recipient:\s*rfc822;\s*<?([^\s<>;]+@[^\s<>;]+)>?/i,
  /<([^\s<>@]+@[^\s<>]+\.[a-z]{2,})>:?\s*\n?.{0,200}?\b[45]\d\d\b/is,
  /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/,
];

export interface BounceInfo {
  recipient: string | null;
  reason: string;
  /** A linha técnica do servidor (para quem quiser ver), curta. */
  detail: string | null;
}

/** Tira do texto do aviso o destinatário e o motivo (em português). */
export const explainBounce = (text: string | null | undefined, ownEmail?: string): BounceInfo => {
  const body = (text ?? '').slice(0, 20_000);
  const own = ownEmail?.toLowerCase();
  let recipient: string | null = null;
  search: for (const pattern of RECIPIENT_PATTERNS) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
    for (const match of body.matchAll(global)) {
      const found = match[1]?.toLowerCase();
      if (found && found !== own && !BOUNCE_SENDER.test(found)) {
        recipient = found;
        break search;
      }
    }
  }
  const reason =
    REASONS.find(([pattern]) => pattern.test(body))?.[1] ?? 'o servidor de quem recebe recusou-o';
  const detail =
    body
      .match(/\b[45]\d\d[ -][45]\.\d{1,3}\.\d{1,3}\b[^\n]{0,160}/)?.[0]
      ?.replace(/\s+/g, ' ')
      .trim() ?? null;
  return { recipient, reason, detail };
};

/** Texto curto do aviso na app. */
export const bounceNotice = (info: BounceInfo, subject: string | null | undefined) => {
  const what = info.recipient ? `O email para ${info.recipient}` : 'Um email que enviou';
  // "Undeliverable: Assunto original" → mostra o assunto original
  const original = (subject ?? '').match(/^[^:]{3,60}:\s*(.+)$/)?.[1]?.trim() ?? '';
  return `${what} não foi entregue: ${info.reason}.${original ? ` (${original.slice(0, 80)})` : ''}`;
};
