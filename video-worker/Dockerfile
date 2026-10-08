# servico de video da Lumia - roda separado do app, com limite de CPU/memoria definido no
# "docker service create" (ver README.md desta pasta)
FROM node:22-bookworm-slim

# ffmpeg (preparo do video) + bibliotecas que o Chrome headless do Remotion precisa
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg librsvg2-bin ca-certificates fonts-noto-color-emoji \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
    libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
RUN node -e "import('@remotion/renderer').then(r => r.ensureBrowser())"
# modelo de recorte da pessoa (Robust Video Matting, MobileNetV3) - conferido por hash
RUN mkdir -p modelos && node -e "fetch('https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx').then(r => r.arrayBuffer()).then(b => { const buf = Buffer.from(b); const h = require('crypto').createHash('sha256').update(buf).digest('hex'); if (h !== '88d4531297118f595bf2fd60f6f566aec2e559393802d1f436c380f0cbbd2828') throw new Error('hash do modelo nao confere: ' + h); require('fs').writeFileSync('modelos/rvm_mobilenetv3_fp32.onnx', buf); })"
COPY . .
RUN node src/bundle.js

ENV NODE_ENV=production PORT=4100 DATA_DIR=/data
EXPOSE 4100
CMD ["node", "src/server.js"]
