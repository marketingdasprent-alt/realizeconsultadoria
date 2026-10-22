// Imprimir um email: cabeçalho (assunto, de, para, data, anexos) e o corpo, numa folha limpa.
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { MailAddress, MailMessage } from '../types';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const people = (list: MailAddress[]) =>
  list.map(a => (a.name ? `${a.name} <${a.email}>` : a.email)).join(', ');

/** A página a imprimir (sem scripts do email). */
export const printDocument = (message: MailMessage): string => {
  const rows = [
    ['De', message.from ? people([message.from]) : ''],
    ['Para', people(message.to)],
    ['Cc', people(message.cc)],
    ['Data', format(new Date(message.date), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt })],
    ['Anexos', message.attachments.map(a => a.filename).join(', ')],
  ].filter(([, value]) => value);
  const body = message.html
    ? message.html.replace(/<script[\s\S]*?<\/script>/gi, '')
    : `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message.text ?? '')}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(message.subject || 'Email')}</title>
<style>body{margin:24px;font-family:Arial,sans-serif;font-size:13px;color:#111}h1{font-size:18px;margin:0 0 12px}
table.rz-head{border-collapse:collapse;margin-bottom:16px}table.rz-head td{padding:2px 12px 2px 0;vertical-align:top}
table.rz-head td:first-child{font-weight:bold;color:#555}hr{border:0;border-top:1px solid #ccc;margin:0 0 16px}
img{max-width:100%;height:auto}</style></head><body>
<h1>${escapeHtml(message.subject || '(sem assunto)')}</h1>
<table class="rz-head">${rows.map(([label, value]) => `<tr><td>${label}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table>
<hr>${body}</body></html>`;
};

/** Abre a janela de impressão do navegador (num quadro escondido; nada sai da página). */
export const printMail = (message: MailMessage) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  // Sem allow-scripts: o HTML do email não corre código; allow-modals deixa abrir a impressão.
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.srcdoc = printDocument(message);
  frame.onload = () => {
    // Espera pelas imagens (logótipos, assinaturas) antes de imprimir.
    const images = Array.from(frame.contentDocument?.images ?? []);
    void Promise.all(
      images.map(img =>
        img.complete
          ? null
          : new Promise(resolve => {
              img.onload = img.onerror = resolve;
            })
      )
    ).then(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60_000);
    });
  };
  document.body.appendChild(frame);
};
