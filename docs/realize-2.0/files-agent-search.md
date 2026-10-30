# Agente de ficheiros (SRVDC): rota de pesquisa

Pedido do Realize para o agente que serve `D:\Shares` em `https://files.dasprent.pt`.

## Para quê

A Realize IA passa a procurar ficheiros e pastas pelo nome ("encontra o contrato da Urbango"),
**só nas pastas atribuídas ao colaborador** (`folder_assignments`). A função `company-files` do
Supabase já faz isto sozinha, percorrendo as pastas com `GET /api/list` (até 150 pastas, 6 níveis,
9 segundos). Em pastas grandes isso é lento e pode ficar incompleto. Uma rota de pesquisa no agente
resolve, e a função passa a usá-la sozinha assim que existir (sem mudar nada no Realize).

## A rota

```
GET /api/search?path=<pasta relativa a D:\Shares>&q=<texto>
Authorization: Bearer <JWT HS256 com FILES_AGENT_SECRET>
```

- O JWT é igual ao das outras rotas: `{ "op": "search", "path": "<o mesmo path da query>", "exp": <unix> }`.
  O agente tem de verificar a assinatura, `exp`, `op === "search"` e que `path` do token é o da query.
- Procura **só dentro de `path`** (recursivo), nunca fora. Recusar `..`, caminhos absolutos e
  ligações simbólicas que saiam de `D:\Shares`.
- Correspondência pelo **nome** (ficheiros e pastas): todas as palavras de `q` aparecem no nome,
  sem distinguir maiúsculas nem acentos ("precos 2026" encontra "Tabela de Preços 2026.xlsx").
- Ignorar ficheiros escondidos e de sistema (`~$*`, `Thumbs.db`, `desktop.ini`, `.tmp`).
- No máximo **50 resultados**; os mais recentes primeiro, se der.
- Responder em menos de **5 segundos** (índice em memória ou Windows Search; não percorrer o disco
  inteiro a cada pedido).

## Resposta

```json
{
  "results": [
    {
      "path": "DASPRENT/Frota/Contratos/Contrato Urbango.pdf",
      "name": "Contrato Urbango.pdf",
      "type": "file",
      "size": 182733,
      "modified": "2026-10-12T09:41:00Z"
    }
  ],
  "truncated": false
}
```

- `path` relativo a `D:\Shares`, com `/`, e **começa por `path` do pedido**.
- `type` é `"file"` ou `"dir"`. `size` só nos ficheiros.

## Erros

| Situação | Resposta |
|---|---|
| Token inválido ou de outra operação | 401 |
| `path` fora de `D:\Shares` ou inválido | 400 |
| Pasta não existe | 404 |
| Rota ainda não implementada | 404/405/501: o Realize volta a percorrer com `/api/list` |

## Regras que se mantêm

- **Nada se apaga nem se altera** por esta rota (só leitura), como em todo o Realize.
- As permissões por pessoa continuam do lado do Realize: a função só pede `path` que estejam nas
  pastas atribuídas a quem pergunta, e filtra de novo os resultados.
