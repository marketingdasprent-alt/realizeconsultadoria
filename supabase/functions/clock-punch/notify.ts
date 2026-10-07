// Email aos admins quando um registo de ponto precisa de decisão:
// remoto (aguarda aprovação) ou no escritório com sinais suspeitos (em revisão).
// Destinatários: tabela notification_emails_timeclock. Envio via Brevo.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REVIEW_URL = 'https://realize.dasprent.pt/admin/ponto?tab=revisao';

const FLAG_LABELS: Record<string, string> = {
  remote: 'Fora do local de trabalho',
  vpn_or_proxy: 'VPN / proxy',
  ip_far_from_location: 'IP de outro país',
  suspicious_accuracy: 'Precisão GPS suspeita',
  repeated_coordinates: 'Coordenadas repetidas',
  impossible_travel: 'Deslocação impossível',
  shared_device: 'Telemóvel usado por outro colaborador',
  new_device: 'Telemóvel novo',
  gps_only: 'Sem tag (só GPS)',
};

export interface PunchNotification {
  employeeName: string;
  companyName: string | null;
  entryType: 'in' | 'out';
  punchedAt: string;
  status: string;
  workMode: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  /** Distância ao local mais próximo, em metros (null se a empresa não tem locais). */
  distanceM: number | null;
  locationName: string | null;
  flags: string[];
  note: string | null;
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

const formatDistance = (m: number | null, locationName: string | null): string => {
  if (m === null || !Number.isFinite(m)) return 'Empresa sem locais de ponto configurados';
  const where = locationName ? ` de ${escapeHtml(locationName)}` : '';
  return m < 1000 ? `a ${Math.round(m)} m${where}` : `a ${(m / 1000).toFixed(1)} km${where}`;
};

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;color:#111">${value}</td></tr>`;

export const buildEmail = (n: PunchNotification) => {
  const remote = n.workMode === 'remote';
  const type = n.entryType === 'in' ? 'Entrada' : 'Saída';
  const when = new Date(n.punchedAt).toLocaleString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const maps = `https://www.google.com/maps?q=${n.latitude},${n.longitude}`;
  const flags = n.flags
    .filter(f => FLAG_LABELS[f])
    .map(f => FLAG_LABELS[f])
    .join(' · ');

  const subject = remote
    ? `Ponto remoto a aprovar — ${n.employeeName} (${type} ${when})`
    : `Ponto com alertas — ${n.employeeName} (${type} ${when})`;

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:#000;padding:20px 24px;color:#B7933D;font-size:18px;font-weight:bold">Realize · Controlo de Ponto</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 16px;font-size:16px;color:#111">${
    remote
      ? `<strong>${escapeHtml(n.employeeName)}</strong> registou ponto <strong>fora do local de trabalho</strong>. O registo aguarda a sua aprovação.`
      : `O registo de <strong>${escapeHtml(n.employeeName)}</strong> tem sinais a rever.`
  }</p>
<table cellpadding="0" cellspacing="0" style="font-size:14px">
${row('Registo', `${type} · ${when}`)}
${n.companyName ? row('Empresa', escapeHtml(n.companyName)) : ''}
${row('Onde', `<a href="${maps}" style="color:#B7933D">Ver no mapa</a> · ${formatDistance(n.distanceM, n.locationName)} · precisão GPS ±${Math.round(n.accuracyM)} m`)}
${flags ? row('Alertas', escapeHtml(flags)) : ''}
${n.note ? row('Nota do colaborador', escapeHtml(n.note)) : ''}
</table>
<p style="margin:24px 0 0"><a href="${REVIEW_URL}" style="background:#B7933D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;display:inline-block">${
    remote ? 'Aprovar ou rejeitar' : 'Rever registo'
  }</a></p>
</td></tr>
<tr><td style="background:#f4f4f4;padding:12px 24px;color:#888;font-size:12px">Recebe este email porque está na lista de aprovações do ponto (Ponto → Revisão).</td></tr>
</table></body></html>`;

  return { subject, html };
};

/** Envia o email a todos os destinatários ativos. Nunca lança erro (não bloqueia a picagem). */
export const notifyApprovers = async (db: SupabaseClient, n: PunchNotification): Promise<void> => {
  try {
    const apiKey = Deno.env.get('BREVO_API_KEY');
    if (!apiKey) return;
    const { data } = await db
      .from('notification_emails_timeclock')
      .select('email')
      .eq('is_active', true);
    if (!data?.length) return;
    const { subject, html } = buildEmail(n);
    await Promise.allSettled(
      data.map(({ email }: { email: string }) =>
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify({
            sender: { name: 'Realize Consultadoria', email: 'noreply@dasprent.pt' },
            to: [{ email }],
            subject,
            htmlContent: html,
          }),
        })
      )
    );
  } catch (error) {
    console.error('clock-punch notify error:', error);
  }
};
