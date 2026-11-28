FROM node:22-alpine
# Python so pra voz padrao da Lumia (pacote edge-tts num venv proprio em /opt/edge; o app o mantem
# atualizado sozinho - ver src/vozLumia.js)
RUN apk add --no-cache python3 py3-pip && python3 -m venv /opt/edge && /opt/edge/bin/pip install --no-cache-dir edge-tts
ENV EDGE_AUTO_UPDATE=1
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 4000
CMD ["node", "src/server.js"]
