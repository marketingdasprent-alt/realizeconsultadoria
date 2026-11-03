# Servidor de voz (SRVDC): transcrição das mensagens de voz do Realize

O Realize passou a ter, nas mensagens de voz do Mensagens, o botão **Transcrever**. O Claude não
aceita áudio, por isso a transcrição faz-se num servidor nosso com o **Whisper**. A edge function
`chat-transcribe` (Supabase) envia o áudio para este servidor e guarda o texto.

## O que é preciso montar

Um serviço HTTP com a API **compatível com a da OpenAI** para transcrição:

```
POST https://stt.dasprent.pt/v1/audio/transcriptions
Authorization: Bearer <STT_API_KEY>            (se o servidor exigir chave)
Content-Type: multipart/form-data
  file=<áudio webm/ogg/mp4/mp3/wav>
  model=large-v3                                (nome do modelo; ver abaixo)
  language=pt
  response_format=json

→ 200 { "text": "texto transcrito" }
```

### Opções (a mais simples primeiro)

1. **faster-whisper-server** (Docker, API OpenAI-compatível pronta; recomendado)
   - `docker run --rm -p 8000:8000 -v hf-cache:/root/.cache/huggingface fedirz/faster-whisper-server:latest-cpu`
     (com GPU NVIDIA: imagem `latest-cuda`).
   - Escolher o modelo: `Systran/faster-whisper-large-v3` (melhor), `...-medium` ou `...-small` se o
     servidor for fraco. Pôr o nome escolhido no segredo `STT_MODEL`.
2. **whisper.cpp server** (`whisper-server`) com um modelo `ggml-large-v3` ou `ggml-medium`.
   Confirmar que responde em `/v1/audio/transcriptions` (senão pôr um proxy que o faça).

### Requisitos do servidor

- **Português (PT-PT)**: modelo `large-v3` ou `medium`; `small` só se o servidor for muito fraco.
- Aceitar áudio **webm/opus** (é o que o browser grava) além de ogg, mp4/m4a, mp3 e wav (o
  faster-whisper trata disto com o ffmpeg).
- Limite de pedido de pelo menos **25 MB** (o Realize recusa áudios com mais de 3 minutos: a medição foi ~32 s por minuto de áudio).
- **Desempenho esperado:** com CPU, 1 minuto de áudio demora ~10–40 s conforme o processador e o
  modelo; com GPU, 2–5 s. O Realize espera até 2 minutos por resposta.
- **Sem guardar o áudio:** o servidor só devolve o texto e não deve guardar os pedidos.

### Acesso e segurança

- Publicar como `https://stt.dasprent.pt` pelo túnel (como `files.dasprent.pt`), só em HTTPS.
- Proteger com uma **chave** (cabeçalho `Authorization: Bearer <chave>`): o faster-whisper-server
  aceita `API_KEY` em variável de ambiente; senão pôr o túnel/proxy a exigir o cabeçalho. A chave
  fica só no Supabase (segredo `STT_API_KEY`) — nunca no browser.
- Os áudios das conversas são privados: o servidor não deve ficar aberto à internet sem chave.

## Segredos a pôr no Supabase (função `chat-transcribe`)

| Segredo | Valor |
|---|---|
| `STT_BASE_URL` | `https://stt.dasprent.pt` (sem barra no fim) |
| `STT_API_KEY` | a chave do passo anterior (opcional, se o servidor não a exigir) |
| `STT_MODEL` | nome do modelo no servidor (por omissão `large-v3`) |

## Testar

```bash
# áudio de teste (qualquer ficheiro de voz)
curl -s https://stt.dasprent.pt/v1/audio/transcriptions \
  -H "Authorization: Bearer $STT_API_KEY" \
  -F file=@teste.webm -F model=large-v3 -F language=pt -F response_format=json
# → {"text":"..."}
```

Depois, no Realize: Mensagens → uma mensagem de voz → **Transcrever**. Quando estiver a funcionar,
avisar: o texto fica guardado e todos os membros da conversa passam a vê-lo.
