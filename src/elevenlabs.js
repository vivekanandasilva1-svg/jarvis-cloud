const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Sintetiza voz com o ElevenLabs. Retorna um Buffer com o audio MP3.
export async function synthesizeSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    throw new Error('ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID nao configurados');
  }

  const res = await fetch(`${API_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.65,
        similarity_boost: 0.8,
        style: 0.25,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const VOICE_SETTINGS = {
  stability: 0.65,
  similarity_boost: 0.8,
  style: 0.25,
  use_speaker_boost: true,
};

// Sintetiza voz e devolve tambem o alinhamento (tempo exato de cada caractere), pra
// sincronizar a legenda na tela com o audio de verdade.
export async function synthesizeSpeechWithTimestamps(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    throw new Error('ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID nao configurados');
  }

  const res = await fetch(`${API_URL}/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: VOICE_SETTINGS,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return { audioBase64: data.audio_base64, alignment: data.alignment };
}
