'use client';

import { useAppStore } from '@/store/useAppStore';

export type SoundEffectName =
  | 'stamp'
  | 'typewriter'
  | 'rustle'
  | 'chime'
  | 'shutter'
  | 'confetti'
  | 'error';

type HowlModule = typeof import('howler');

let howlerModulePromise: Promise<HowlModule> | null = null;
const howlCache = new Map<SoundEffectName, InstanceType<HowlModule['Howl']>>();

function encodeWavDataUri(samples: Float32Array, sampleRate = 22050): string {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // linear PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function synthesizeSound(name: SoundEffectName): string {
  const sr = 22050;
  if (name === 'stamp') {
    const len = Math.floor(sr * 0.16);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 28);
      const thud = Math.sin(2 * Math.PI * (120 - t * 420) * t) * 0.7;
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 65) * 0.35;
      out[i] = (thud + noise) * env * 0.75;
    }
    return encodeWavDataUri(out, sr);
  }
  if (name === 'typewriter') {
    const len = Math.floor(sr * 0.045);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 140);
      const click = (Math.random() * 2 - 1) * 0.55 + Math.sin(2 * Math.PI * 1900 * t) * 0.3;
      out[i] = click * env * 0.45;
    }
    return encodeWavDataUri(out, sr);
  }
  if (name === 'rustle') {
    const len = Math.floor(sr * 0.18);
    const out = new Float32Array(len);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.sin((Math.PI * i) / len) * 0.4;
      const white = Math.random() * 2 - 1;
      const hp = white - last * 0.85;
      last = white;
      out[i] = hp * env * 0.35;
    }
    return encodeWavDataUri(out, sr);
  }
  if (name === 'shutter') {
    const len = Math.floor(sr * 0.12);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const pulse1 = Math.exp(-t * 160);
      const pulse2 = t > 0.045 ? Math.exp(-(t - 0.045) * 160) : 0;
      const noise = Math.random() * 2 - 1;
      out[i] = noise * (pulse1 + pulse2 * 0.8) * 0.55;
    }
    return encodeWavDataUri(out, sr);
  }
  if (name === 'chime' || name === 'confetti') {
    const len = Math.floor(sr * 0.38);
    const out = new Float32Array(len);
    const freqs = name === 'confetti' ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let val = 0;
      freqs.forEach((f, idx) => {
        const start = idx * 0.055;
        if (t >= start) {
          const dt = t - start;
          val += Math.sin(2 * Math.PI * f * dt) * Math.exp(-dt * 9) * 0.3;
        }
      });
      out[i] = val;
    }
    return encodeWavDataUri(out, sr);
  }
  // error buzz
  const len = Math.floor(sr * 0.16);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 14);
    out[i] = Math.sin(2 * Math.PI * 165 * t) * Math.sin(2 * Math.PI * 180 * t) * env * 0.5;
  }
  return encodeWavDataUri(out, sr);
}

async function getHowler(): Promise<HowlModule | null> {
  if (typeof window === 'undefined') return null;
  if (!howlerModulePromise) {
    howlerModulePromise = import('howler');
  }
  return howlerModulePromise;
}

export async function syncHowlerMute(muted: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const mod = await getHowler();
    mod?.Howler.mute(muted);
  } catch {
    // Ignore audio context errors on locked environments
  }
}

export async function playSound(name: SoundEffectName): Promise<void> {
  if (typeof window === 'undefined') return;
  const muted = useAppStore.getState().soundMuted;
  if (muted) return;

  try {
    const mod = await getHowler();
    if (!mod) return;
    mod.Howler.mute(false);

    let howl = howlCache.get(name);
    if (!howl) {
      const dataUri = synthesizeSound(name);
      howl = new mod.Howl({
        src: [dataUri],
        format: ['wav'],
        volume: name === 'typewriter' ? 0.35 : 0.6,
      });
      howlCache.set(name, howl);
    }
    howl.play();
  } catch {
    // Gracefully fail if browser blocks audio
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export async function triggerConfetti(intensity: 'small' | 'big' = 'small'): Promise<void> {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;
  try {
    const confetti = (await import('canvas-confetti')).default;
    confetti({
      particleCount: intensity === 'big' ? 110 : 42,
      spread: intensity === 'big' ? 85 : 55,
      origin: { y: 0.72 },
      colors: ['#C8102E', '#FFE066', '#1F3A93', '#D9C28A', '#1B1B1B'],
    });
    void playSound('confetti');
  } catch {
    // Non-critical visual flourish
  }
}
