# Serviço de vídeo da Lumia

Processa as edições da aba **Editor de Vídeo**. Roda num container próprio, separado do app,
com teto de **1 CPU e 2 GB de memória**, pra Lumia nunca ficar lenta enquanto um vídeo é editado.
Só a Lumia fala com ele, pela rede interna do Docker (`http://lumia-video:4100`). Ele não tem
domínio público.

## Como uma edição acontece

1. **Preparo** (`src/midia.js`): recorta no formato escolhido, 30fps, trata o áudio (redução de
   ruído, compressor, -14 LUFS).
2. **Transcrição** (`src/transcricao.js`): tempo de cada palavra. Usa a Groq e, se falhar, o
   Whisper da VPS.
3. **Direção** (`src/diretor.js`): o Claude devolve um plano em JSON (cortes, destaques, zooms,
   textos, números, listas), ancorado nos números das palavras.
4. **Revisão** (`diretor.revisarQuadros`): renderiza quadros de prévia e o Claude corrige o plano
   se achar problema visual.
5. **Render** (`src/render.js` + `remotion/`): Remotion monta o vídeo final. O visual (fontes,
   cores, animações) fica em `remotion/estilos.js` e `remotion/Edicao.jsx`.

Os arquivos ficam no volume `lumia_video_data` (`/data/jobs/<id>`) e são apagados depois de 30 dias.

## Deploy (VPS)

O serviço **não** é gerenciado pelo Easypanel. É um `docker service` criado à mão, igual ao
`kokoro-tts` e ao `whisper-cloud`.

Atualizar depois de um push:

```bash
cd /root/lumia-video-src/repo && git pull && cd video-worker && nice -n 15 docker build -t lumia-video:latest . && docker service update --force --image lumia-video:latest lumia-video
```

As variáveis (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `WHISPER_URL`, `VIDEO_WORKER_SECRET`) foram
copiadas do serviço da Lumia na criação. `VIDEO_WORKER_SECRET` é o HMAC-SHA256 de
`"lumia-video-worker"` com o `SESSION_SECRET` da Lumia (ver `src/videoEditor.js` na raiz). Se o
`SESSION_SECRET` mudar, recalcule e atualize com `docker service update --env-add`.

Pra levar o processamento pra nuvem no futuro (GPU, Remotion Lambda), basta rodar este mesmo
serviço em outra máquina e apontar `VIDEO_WORKER_URL` na Lumia pra ele.
