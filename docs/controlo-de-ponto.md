# Controlo de Ponto (jornada como no Bitrix24)

## Como funciona

O colaborador regista a **jornada** com quatro botões, como no Bitrix24:

| Estado | Botões | Relógio |
|---|---|---|
| Dia não iniciado | **Iniciar dia** | cinzento |
| A trabalhar | **Pausa** · **Terminar dia** | verde, cronómetro do tempo trabalhado |
| Em pausa | **Retomar** · **Terminar dia** | âmbar, cronómetro da pausa |
| Dia terminado hoje | **Retomar dia** (o fim passa a pausa) | cinzento, total do dia |
| Dia terminado ontem (ou há 12 h) | **Iniciar dia** | cinzento |

- O **relógio no canto superior** (Início, Tickets, Documentos) mostra a hora e o estado; ao
  carregar abre o painel. A página **O Meu Ponto** tem o mesmo painel e o mês.
- Encostar o telemóvel à **tag** abre a página da tag com o mesmo painel: o primeiro registo leva a
  leitura da tag (prova de presença).
- Só aparecem os botões que fazem sentido, e a base valida a sequência
  (`time_clock_register_punch`): não se pausa um dia por iniciar nem se inicia dois. Um dia aberto ou
  em pausa há mais de 12 h conta como terminado (esquecimento) e fica "incompleto" para os RH.
- **Retomar dia** (como o "Continuar dia de trabalho" do Bitrix24): carregou em Terminar dia por
  engano, ou a saída para o almoço ficou como fim do dia, e voltou no mesmo dia → o Fim passa a
  Pausa (fica no histórico) e regista-se a Retoma. As horas não mudam.
- **Lápis ✎ — registo esquecido**: ao lado do cronómetro. O colaborador indica a hora (hoje, depois
  do último registo, nas últimas 12 h) e o motivo, e escolhe o botão (ex.: "Retomar dia" às 14:00).
  O registo fica com a hora indicada, a aguardar aprovação (`manual_time`), e os RH veem a hora a
  que foi gravado.
- **Adicionar observação** (até 300 caracteres) é opcional e vai para o registo, o email e a folha.
- O colaborador não vê mensagens de aprovação nem alertas: a lista do dia mostra cada registo com
  o sítio — o local de trabalho, a morada aproximada (rua e localidade, do OpenStreetMap) ou "Sem
  localização". Só aparecem erros quando o registo não foi feito (sem internet, tag inválida, VPN).
- As horas contam de Início/Retoma até Pausa/Fim: as pausas ficam fora e aparecem à parte.

Cada ação é um registo em `time_clock_entries` com `entry_type` + `kind`:
Início = in/work, Pausa = out/break, Retoma = in/break, Fim = out/work. Os registos antigos são
todos `work` (Entrada = Início, Saída = Fim) e continuam a contar igual.

### Regista sempre; revê-se depois

Como no Bitrix24, o ponto **nunca falha por GPS ou distância**. A edge function `clock-punch`
decide no servidor (`decidePunch`):

| Situação | Resultado |
|---|---|
| GPS dentro do raio de um local | válido |
| Tag NFC (com GPS a confirmar, ou GPS fraco) | válido / em revisão |
| Tag sem GPS | em revisão (`no_gps`) |
| IP na rede de confiança de um local (Wi-Fi do escritório) | válido, mesmo sem GPS |
| Fora dos locais, sem GPS, GPS fraco ou localização aproximada | **registado, a aguardar aprovação**, com o motivo |
| **Pausa** em qualquer sítio | válida (parar o relógio não acrescenta horas) |
| Hora indicada no ✎ (registo esquecido) | **a aguardar aprovação** (`manual_time`) |
| VPN/Tor num local com "Bloquear VPN" | recusado |
| Tag inválida, repetida ou de outra empresa | recusado |

O motivo fica nas flags (`outside_location`, `no_gps`, `stale_gps`, `weak_gps`,
`approximate_location`, `no_location_configured`, `tag_required`) e o colaborador vê-o logo
("Está a 10,3 km de Premium Ride…", "Não foi possível obter a sua localização…") com a dica para
a próxima vez. Os pendentes vão para **Ponto → Revisão**. A lista de *Emails de aprovação* só
recebe email quando há sinais suspeitos (VPN, telemóvel partilhado, GPS suspeito…) ou uma
correção de hora (✎); fora do local / sem GPS / GPS fraco, sem mais nada, não gera email.

Verificações feitas em cada registo: tag (token estático ou NTAG 424), local da empresa, distância
(Haversine) e precisão GPS, IP (VPN/Tor/país) via proxycheck.io, dispositivo novo/partilhado,
coordenadas repetidas e viagens impossíveis. Sinais fracos → **em revisão**.

A hora gravada é sempre a do servidor. O histórico (`time_clock_entry_history`) é preenchido por
trigger e é imutável; os admins só alteram registos através de RPCs que exigem motivo (o formulário
do admin tem os quatro tipos: Início do dia, Pausa, Retoma, Fim do dia).

### Locais em falta e GPS

- **Locais em falta** (Ponto → Locais & Tags): sítios com várias tentativas fora dos locais
  (2+ a menos de 150 m, GPS ≤ 100 m, últimos 30 dias), com **Criar local aqui** ou **Aumentar raio**.
  Enquanto um local de trabalho não existir, os registos lá feitos ficam a aguardar aprovação.
- **Wi-Fi do escritório**: pôr o IP público do escritório em "IPs de confiança" do local valida os
  registos feitos nessa rede mesmo sem GPS (exceto em locais que exigem a tag).

### Onde abre a tag (browser ou app)

O registo funciona igual no browser e na app instalada; só muda onde aparece.

- **iPhone:** abre sempre no **Safari**. O iOS não deixa as tags abrirem apps adicionadas ao ecrã
  principal. O Safari e a app não partilham a sessão: na primeira vez pede login no Safari.
- **Android:** abre no **Chrome**, porque a app instalada pelo browser (PWA) não é reconhecida como
  dona do domínio. Cada pessoa resolve uma vez: *Definições → Aplicações → Realize → Abrir por
  predefinição → Abrir links suportados* (Samsung: *Definir como predefinição*). O Chrome e a app
  partilham a sessão, por isso não pede login outra vez.
- A página da tag mostra estas instruções quando o registo é feito no browser.
- Para abrir **sempre** a app no Android é preciso publicar a app na Play Store (Trusted Web
  Activity). O `assetlinks.json` já declara o pacote `com.realizeconsultadoria.myapp`, mas essa app
  nunca foi publicada.

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

1. **Base de dados** — correr no SQL Editor do projeto `jvvnsoasylusbmxfotci`, por ordem, as
   migrações `supabase/migrations/2026*_time_clock*.sql` (a jornada com pausas é
   `20261014120000_time_clock_workday.sql`; Retomar dia, ✎ e morada são
   `20261014190000_time_clock_continue_and_correct.sql`). Cada uma tem de estar aplicada antes
   de publicar a `clock-punch` que a usa, e a função antes do site.
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
- Morada aproximada: nos registos fora dos locais de trabalho, as coordenadas (arredondadas a
  ~1 m) são enviadas pelo servidor ao Nominatim do OpenStreetMap para obter a rua e a localidade.
  Não vai nenhum dado do colaborador além das coordenadas. A atribuição "© OpenStreetMap" aparece
  junto das moradas, como pede a política do Nominatim.
- Código do Trabalho, art. 202.º: registo de tempos de trabalho conservado **5 anos** — não
  eliminar colaboradores com registos; desativá-los.
