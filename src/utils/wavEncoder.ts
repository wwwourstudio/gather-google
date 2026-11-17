import type { AiGraphicSpec } from '../types/studio';

/**
 * Encodes an AudioBuffer into an uncompressed 16-bit PCM RIFF/WAVE Blob
 * ready for Spotify, Apple Podcasts, Amazon Music, and DAW mastering.
 */
export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const frameCount = audioBuffer.length;
  const dataByteLength = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Decodes any recorded audio/video Blob via WebAudio and transcodes to 16-bit PCM WAV.
 */
export async function convertBlobToWav(blob: Blob): Promise<{ wavBlob: Blob; durationSec: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const wavBlob = encodeAudioBufferToWav(decoded);
    return { wavBlob, durationSec: Math.max(1, Math.round(decoded.duration)) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Synthesizes a clean broadcast intro/test tone + chord progression WAV when a host wants
 * to test their hosted RSS feed before recording a full live episode.
 */
export function synthesizeSamplePodcastEpisodeWav(durationSec = 8): Blob {
  const sampleRate = 44100;
  const length = sampleRate * durationSec;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const audioBuffer = ctx.createBuffer(2, length, sampleRate);
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);

  const freqs = [261.63, 329.63, 392.0, 523.25];
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t / 0.25) * Math.exp(-t * 0.38);
    let sample = 0;
    for (let f = 0; f < freqs.length; f++) {
      sample += Math.sin(2 * Math.PI * freqs[f] * t + f * 0.3) * 0.14;
    }
    left[i] = sample * env;
    right[i] = sample * env * 0.96;
  }
  void ctx.close().catch(() => {});
  return encodeAudioBufferToWav(audioBuffer);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to encode blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Renders an AI-designed broadcast graphic specification onto an HD HTML5 Canvas
 * for Stage Backdrops (1920x1080), Transparent Frame Overlays (1920x1080),
 * Stream Thumbnails (1920x1080), or Square Podcast Cover Art (1400x1400).
 */
export function renderAiGraphicToDataUrl(
  spec: AiGraphicSpec,
  mode: 'backdrop' | 'overlay' | 'thumbnail' | 'podcast-cover'
): string {
  const width = mode === 'podcast-cover' ? 1400 : 1920;
  const height = mode === 'podcast-cover' ? 1400 : 1080;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (mode !== 'overlay') {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, spec.surfaceHex || '#080c18');
    base.addColorStop(0.55, '#0c1326');
    base.addColorStop(1, spec.surfaceHex || '#060913');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const orb1 = ctx.createRadialGradient(
      width * 0.22,
      height * 0.28,
      20,
      width * 0.22,
      height * 0.28,
      width * 0.55
    );
    orb1.addColorStop(0, `${spec.primaryHex}66`);
    orb1.addColorStop(1, 'transparent');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, width, height);

    const orb2 = ctx.createRadialGradient(
      width * 0.82,
      height * 0.74,
      20,
      width * 0.82,
      height * 0.74,
      width * 0.52
    );
    orb2.addColorStop(0, `${spec.secondaryHex}55`);
    orb2.addColorStop(1, 'transparent');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.5;
    if (spec.pattern === 'grid') {
      const step = Math.round(width / 16);
      for (let x = 0; x <= width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (spec.pattern === 'rings') {
      for (let r = 160; r < width * 0.72; r += 130) {
        ctx.beginPath();
        ctx.arc(width * 0.74, height * 0.42, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (spec.pattern === 'prism') {
      ctx.strokeStyle = `${spec.tertiaryHex}38`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(width * (0.1 + i * 0.08), 0);
        ctx.lineTo(width * (0.35 + i * 0.06), height);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  if (mode === 'overlay') {
    // Transparent broadcast frame + corner optics + top-right bug
    ctx.strokeStyle = `${spec.primaryHex}cc`;
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    const accentGrad = ctx.createLinearGradient(28, height - 88, 560, height - 28);
    accentGrad.addColorStop(0, `${spec.surfaceHex}ee`);
    accentGrad.addColorStop(1, `${spec.primaryHex}dd`);
    ctx.fillStyle = accentGrad;
    ctx.beginPath();
    ctx.roundRect(52, height - 118, 520, 62, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(spec.headline.slice(0, 34), 76, height - 79);
  }

  if (mode === 'thumbnail' || mode === 'podcast-cover') {
    const pad = mode === 'podcast-cover' ? 110 : 120;
    ctx.fillStyle = `${spec.primaryHex}28`;
    ctx.strokeStyle = `${spec.primaryHex}88`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pad, pad, 290, 52, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText((spec.badgeText || 'GATHER LIVE').toUpperCase().slice(0, 18), pad + 26, pad + 34);

    ctx.fillStyle = '#ffffff';
    const titleSize = mode === 'podcast-cover' ? 88 : 92;
    ctx.font = `800 ${titleSize}px "Plus Jakarta Sans", sans-serif`;
    const words = (spec.headline || 'Gather Broadcast').split(' ');
    let line = '';
    let y = mode === 'podcast-cover' ? height * 0.56 : height * 0.52;
    const maxW = width - pad * 2;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, pad, y);
        line = word;
        y += titleSize * 1.12;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, pad, y);

    ctx.fillStyle = 'rgba(226,232,240,0.82)';
    ctx.font = '500 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText((spec.subtitle || 'Hosted on Gather Studio').slice(0, 56), pad, y + 72);
  }

  return canvas.toDataURL('image/png');
}
