

# Adicionar Logo Realize a Todas as Impressões

## Locais Afetados

Existem 3 pontos de impressão no sistema:

1. **`src/pages/admin/SupportTicketsPage.tsx`** — impressão de tickets de suporte. Atualmente mostra apenas texto "Realize Consultadoria" no cabeçalho, sem logo.

2. **`src/pages/admin/AbsenceRequestsPage.tsx`** — impressão de comprovativo de ausência. Mostra apenas texto "COMPROVATIVO DE AUSÊNCIA", sem logo.

3. **`src/pages/admin/CalendarPage.tsx`** — impressão do relatório de ausências aprovadas. Já usa a logo via `<img src={logoRealize}>` (funciona porque usa CSS print, não popup).

## Problema Técnico

Os tickets e ausências usam `window.open()` + `document.write()` para gerar o HTML de impressão. Imagens locais (import) não funcionam diretamente neste contexto. A solução é converter a logo para base64 data URL em runtime e injetá-la no HTML.

## Alterações

### `src/pages/admin/SupportTicketsPage.tsx`

- Adicionar função utilitária `getLogoBase64()` que carrega `logo-realize.png` via `fetch` + `FileReader` e retorna uma data URL
- No `handlePrint`, substituir o cabeçalho de texto por um cabeçalho com `<img>` da logo em base64 centrada, seguida do subtítulo
- A função será `async`, e `handlePrint` passará a ser `async` também

### `src/pages/admin/AbsenceRequestsPage.tsx`

- Reutilizar a mesma abordagem: carregar a logo como base64
- No `handlePrintAbsence`, adicionar `<img>` da logo no cabeçalho `.header` antes do título "COMPROVATIVO DE AUSÊNCIA"
- A função passará a ser `async`

### Detalhe do Cabeçalho

Ambos os prints terão:
```
[Logo Realize ~60px altura, centrada]
Título do documento
Data/hora de geração
```

### Resumo

- 2 ficheiros modificados
- 0 migrações
- 0 novas dependências

