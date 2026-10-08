# Serviço de vídeo da Lumia

Processa as edições da aba **Editor de Vídeo**. Roda num container próprio, separado do app,
com teto de **1 CPU e 2 GB de memória**, pra Lumia nunca ficar lenta enquanto um vídeo é editado.
Só a Lumia fala com ele, pela rede interna do Docker (`http://lumia-video:4100`). Ele não tem
domínio público.

## Como uma edição acontece

Um projeto nasce como **rascunho**. O cliente envia o vídeo principal, opcionalmente um vídeo
referência e mídias de apoio (imagens, vídeos, áudios), e só depois pede "Editar com IA".

1. **Preparo** (`src/midia.js`): recorta no formato escolhido, 30fps, trata o áudio (redução de
   ruído, compressor, -14 LUFS).
2. **Transcrição** (`src/transcricao.js`): tempo de cada palavra. Usa a Groq e, se falhar, o
   Whisper da VPS. Áudio em silêncio não é transcrito, porque o Whisper inventa frases.
   - **Referência** (se houver): conta os cortes por minuto (detecção de cena) e o Claude estuda
     8 quadros, gerando um perfil de estilo (fonte, cores, legenda, composição, transição,
     ritmo) que o render aplica.
   - **Mídias de apoio**: viram arquivos prontos pro render (vídeo H.264 sem áudio, JPG, AAC).
3. **Direção** (`src/diretor.js`): o Claude vê quadros do vídeo e as miniaturas das mídias e
   devolve um plano em JSON (cortes, destaques, zooms, textos, números, listas, inserções de
   mídia, trilha), ancorado nos números das palavras.
4. **Revisão** (`diretor.revisarQuadros`): renderiza quadros de prévia e o Claude corrige o plano
   se achar problema visual.
5. **Render** (`src/render.js` + `remotion/`): Remotion monta o vídeo final. O visual (fontes,
   cores, animações, inserções, transições, trilha que abaixa na fala) fica em
   `remotion/estilos.js` e `remotion/Edicao.jsx`.
6. **Linha do tempo**: depois do render gera `tira.jpg` (miniaturas) e `ondas.json` (forma de
   onda), que a tela do editor usa junto com o `roteiro.json`.

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
