import { describe, expect, it } from 'vitest';
import { preparePrintHtml } from '../print-preview';

describe('preparePrintHtml', () => {
  it('tira a impressão automática e esconde a barra de botões', () => {
    const html = `<html><head><title>x</title></head><body>
      <div class="toolbar"><button onclick="window.print()">Imprimir</button></div>
      <p>Mapa</p>
      <script>
        setTimeout(function() { window.print(); window.onafterprint = function() { window.close(); }; }, 300);
      </script>
    </body></html>`;
    const result = preparePrintHtml(html);
    expect(result).not.toContain('<script>');
    expect(result).toContain('<p>Mapa</p>');
    expect(result).toContain('.toolbar{display:none!important}</style></head>');
  });

  it('mantém os outros scripts', () => {
    const html = '<html><head></head><body><script>var a = 1;</script></body></html>';
    expect(preparePrintHtml(html)).toContain('<script>var a = 1;</script>');
  });
});
