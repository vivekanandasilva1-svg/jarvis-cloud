# Voz padrao da Lumia (pt-BR-ThalitaMultilingualNeural), mesma configuracao dos videos oficiais:
# prosodia padrao (sem alterar velocidade/tom/volume). Le o texto do stdin (UTF-8) e escreve no stdout
# um JSON: {"audio": <mp3 em base64>, "marks": [{"text", "offset", "duration"}]} (tempos em 100ns).
# Chamado por src/vozLumia.js. Usa o pacote edge-tts, que o container atualiza sozinho.
import asyncio
import base64
import json
import sys

import edge_tts

VOZ = "pt-BR-ThalitaMultilingualNeural"


async def main() -> None:
    texto = sys.stdin.buffer.read().decode("utf-8").strip()
    if not texto:
        raise SystemExit("texto vazio")
    comm = edge_tts.Communicate(texto, VOZ, boundary="WordBoundary")
    audio = bytearray()
    marks = []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            marks.append({"text": chunk["text"], "offset": chunk["offset"], "duration": chunk["duration"]})
    if len(audio) < 1500:
        raise SystemExit("audio vazio")
    sys.stdout.write(json.dumps({"audio": base64.b64encode(bytes(audio)).decode("ascii"), "marks": marks}))


asyncio.run(main())
