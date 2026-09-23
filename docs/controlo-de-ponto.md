# Controlo de Ponto (NFC + GPS)

## Como funciona

| Forma de registo | Onde funciona | Prova de presença |
|---|---|---|
| **Encostar o telemóvel à tag** (app fechada) | Android e iPhone (XS ou mais recente) | Tag + GPS no raio |
| **"Registar manualmente"** dentro da app | Todos | Só GPS no raio (se o local permitir) |

A app não lê NFC por dentro: com tag, o colaborador encosta sempre o telemóvel com a app fechada.

A tag contém apenas um URL, por exemplo `https://realize.dasprent.pt/ponto/nfc?t=…`.
Ao encostar, o sistema operativo abre esse URL (no Android abre diretamente a app, por causa do
`assetlinks.json`). A página obtém o GPS e chama a edge function `clock-punch`, que decide **no
servidor**:

1. Valida a tag (token estático ou mensagem cifrada NTAG 424).
2. Confirma que o local é da empresa do colaborador.
3. Calcula a distância ao local (Haversine) e exige precisão GPS mínima.
4. Verifica o IP (VPN/proxy/datacenter, país/distância) via proxycheck.io.
5. Verifica o dispositivo (novo / partilhado entre colegas), coordenadas repetidas e viagens impossíveis.
6. Rejeita (fica em *Tentativas rejeitadas*) ou grava; sinais fracos → registo **em revisão**.

A hora gravada é sempre a do servidor. O histórico (`time_clock_entry_history`) é preenchido por
trigger e é imutável; os admins só alteram registos através de RPCs que exigem motivo.

### Tipos de tag

- **NTAG213/215/216 (simples, ~0,30 €)** — link fixo. Qualquer pessoa pode ler e copiar o link com
  uma app NFC; a proteção é o GPS + alertas. Serve para começar.
- **NTAG 424 DNA (segura, ~2–3 €) — recomendada** — gera um código AES novo a cada toque
  (`?e=…&c=…`). Não pode ser clonada e cada leitura só é aceite uma vez (contador).

### Limites honestos da deteção de fraude

- Um browser/PWA **não consegue** saber se o Android tem uma app de "fake GPS" ativa (só apps
  nativas têm `isMock`). Por isso a tag NTAG 424 é a defesa principal: sem estar junto à tag não
  há código válido.
- O **iCloud Private Relay** do iPhone aparece como VPN — por isso, por defeito, VPN só **sinaliza**.
  Ativar "Bloquear VPN" num local recusa esses registos.
- IPs de rede móvel geolocalizam mal; o alerta de IP só dispara acima de 400 km.

## Ativação (uma vez)

1. **Base de dados** — correr `supabase/migrations/20260923120000_create_time_clock.sql` no SQL
   Editor do projeto `jvvnsoasylusbmxfotci`.
2. **Edge functions**
   ```bash
   supabase functions deploy clock-punch --project-ref jvvnsoasylusbmxfotci
   supabase functions deploy clock-tag-manage --project-ref jvvnsoasylusbmxfotci
   ```
3. **Segredos** (Dashboard → Edge Functions → Secrets):
   - `PROXYCHECK_API_KEY` — chave gratuita em proxycheck.io (1000 consultas/dia). Sem chave
     funciona com limite de 100/dia.
   - `NTAG424_SDM_KEY` — só para tags NTAG 424: 32 caracteres hex gerados aleatoriamente
     (`openssl rand -hex 16`). **Guardar num cofre**: é a chave gravada nas tags.
   - `NTAG424_SDM_FILE_KEY` — opcional, se usar chaves diferentes para meta/ficheiro.
4. **Permissões** — em Configurações → Grupos, dar o módulo **Ponto** aos grupos (super admins
   já têm acesso): *Ver folha*, *Editar registos*, *Gerir locais e tags*.

## Configurar um local e as tags

1. Admin → **Ponto → Locais & Tags → Novo local**. Em **Localização**, colar o link do Google
   Maps (*Partilhar → Copiar link*) ou as coordenadas (botão direito no ponto exato → clicar nas
   coordenadas). Alternativa: *"usar a minha localização atual"* estando no local. Confirmar o pino
   no mapa de pré-visualização. Raio por defeito: 50 m; precisão GPS máxima: 100 m.
   Os links curtos `maps.app.goo.gl` são resolvidos pela edge function `clock-tag-manage`.
2. Opcional: adicionar o IP público do Wi-Fi do escritório (registos dessa rede não são sinalizados).
3. **Nova tag**:
   - *Simples*: gera o link (mostrado uma única vez). Num Android com Chrome, carregar em
     **"Gravar na tag agora"** e encostar a tag. Noutro dispositivo: app **NFC Tools** → Escrever →
     URL. Depois **bloquear a tag** (só leitura) para ninguém a reescrever.
   - *NTAG 424 DNA*: programar a tag com a chave `NTAG424_SDM_KEY` (NXP TagXplorer com leitor USB,
     ou NXP TagWriter), com SDM ativo: espelho de UID + contador cifrados no parâmetro `e`, CMAC no
     parâmetro `c`, URL base `https://realize.dasprent.pt/ponto/nfc?e=…&c=…`. Depois, no painel,
     *Nova tag → NTAG 424 → Ler a tag agora* (Android) ou colar o URL lido.
4. Testar: encostar um telemóvel de colaborador à tag.

## RGPD / legal

- A localização só é recolhida no momento do registo (sem rastreamento contínuo). Informar os
  colaboradores por escrito sobre os dados recolhidos (GPS, IP, identificador do dispositivo) e a
  finalidade.
- Código do Trabalho, art. 202.º: registo de tempos de trabalho conservado **5 anos** — não
  eliminar colaboradores com registos; desativá-los.
