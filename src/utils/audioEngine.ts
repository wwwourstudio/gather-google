export type SoundboardPadId =
  | 'intro'
  | 'whoosh'
  | 'applause'
  | 'order'
  | 'hype'
  | 'drumroll'
  | 'alert';

export interface CustomStingerItem {
  id: string;
  name: string;
  durationSec: number;
  loop: boolean;
  sourceKind: 'upload' | 'mic';
}

interface StoredCustomStinger extends CustomStingerItem {
  buffer: AudioBuffer;
}

interface ChannelNodes {
  source: AudioNode | null;
  highpass: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
  analyser: AnalyserNode;
  monitorGain: GainNode;
  streamId: string;
}

interface ActivePlaybackHandle {
  id: string;
  envelopeGain: GainNode;
  stop: () => void;
  timerId?: number;
}

class GatherAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterMonitorBus: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private channels = new Map<string, ChannelNodes>();
  private mediaElementSources = new Map<HTMLMediaElement, MediaElementAudioSourceNode>();

  // Custom Stingers & Active Playback Tracking
  private customStingers = new Map<string, StoredCustomStinger>();
  private activeHandles = new Map<string, ActivePlaybackHandle>();
  private listeners = new Set<() => void>();
  private sfxTargetGain = 1.0;
  private sfxMuted = false;

  private emit(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore listener error
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;

      // Local monitor output scales synchronously with Master Bus gain
      this.masterMonitorBus = this.ctx.createGain();
      this.masterMonitorBus.gain.value = 1.0;
      this.masterMonitorBus.connect(this.ctx.destination);

      this.masterAnalyser = this.ctx.createAnalyser();
      this.masterAnalyser.fftSize = 256;

      this.destination = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.destination);

      // Initialize dedicated Stingers & Audio FX bus ('stinger-fx') routed to Master Bus + Monitor Bus
      const sfxHighpass = this.ctx.createBiquadFilter();
      sfxHighpass.type = 'highpass';
      sfxHighpass.frequency.value = 35;

      const sfxCompressor = this.ctx.createDynamicsCompressor();
      sfxCompressor.threshold.value = -16;
      sfxCompressor.knee.value = 14;
      sfxCompressor.ratio.value = 3;
      sfxCompressor.attack.value = 0.004;
      sfxCompressor.release.value = 0.18;

      const sfxGain = this.ctx.createGain();
      sfxGain.gain.value = this.sfxMuted ? 0 : this.sfxTargetGain;

      const sfxAnalyser = this.ctx.createAnalyser();
      sfxAnalyser.fftSize = 128;

      const sfxMonitorGain = this.ctx.createGain();
      sfxMonitorGain.gain.value = 1.0;

      sfxHighpass.connect(sfxCompressor);
      sfxCompressor.connect(sfxGain);
      sfxGain.connect(sfxAnalyser);
      sfxAnalyser.connect(this.masterGain);
      sfxAnalyser.connect(sfxMonitorGain);
      sfxMonitorGain.connect(this.masterMonitorBus);

      this.channels.set('stinger-fx', {
        source: null,
        highpass: sfxHighpass,
        compressor: sfxCompressor,
        gain: sfxGain,
        analyser: sfxAnalyser,
        monitorGain: sfxMonitorGain,
        streamId: 'stinger-fx-bus',
      });
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private getSfxInputNode(): AudioNode {
    const ctx = this.ensureContext();
    const sfxCh = this.channels.get('stinger-fx');
    return sfxCh ? sfxCh.highpass : this.masterGain ?? ctx.destination;
  }

  getMasterStream(): MediaStream | null {
    this.ensureContext();
    return this.destination?.stream ?? null;
  }

  attachStream(channelId: string, stream: MediaStream, monitor = false): void {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const ctx = this.ensureContext();
    const existing = this.channels.get(channelId);
    const trackId = audioTracks[0].id;
    if (existing && existing.streamId === trackId) {
      return;
    }
    if (existing) {
      this.detachChannel(channelId);
    }

    const audioOnlyStream = new MediaStream([audioTracks[0]]);
    const source = ctx.createMediaStreamSource(audioOnlyStream);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 85;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;

    const gain = ctx.createGain();
    gain.gain.value = 1.0;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    const monitorGain = ctx.createGain();
    monitorGain.gain.value = monitor ? 1.0 : 0.0;

    source.connect(highpass);
    highpass.connect(compressor);
    compressor.connect(gain);
    gain.connect(analyser);

    if (this.masterGain) {
      analyser.connect(this.masterGain);
    }
    analyser.connect(monitorGain);
    monitorGain.connect(this.masterMonitorBus ?? ctx.destination);

    this.channels.set(channelId, {
      source,
      highpass,
      compressor,
      gain,
      analyser,
      monitorGain,
      streamId: trackId,
    });
  }

  attachMediaElement(channelId: string, el: HTMLVideoElement): void {
    const ctx = this.ensureContext();
    let src = this.mediaElementSources.get(el);
    if (!src) {
      try {
        src = ctx.createMediaElementSource(el);
        this.mediaElementSources.set(el, src);
      } catch {
        return;
      }
    }
    const existing = this.channels.get(channelId);
    if (existing) return;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'allpass';
    const compressor = ctx.createDynamicsCompressor();
    const gain = ctx.createGain();
    gain.gain.value = 0.85;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    const monitorGain = ctx.createGain();
    monitorGain.gain.value = 1.0;

    src.connect(gain);
    gain.connect(analyser);
    if (this.masterGain) analyser.connect(this.masterGain);
    analyser.connect(monitorGain);
    monitorGain.connect(this.masterMonitorBus ?? ctx.destination);

    this.channels.set(channelId, {
      source: src,
      highpass,
      compressor,
      gain,
      analyser,
      monitorGain,
      streamId: 'media-el',
    });
  }

  detachChannel(channelId: string): void {
    if (channelId === 'stinger-fx') return;
    const ch = this.channels.get(channelId);
    if (!ch) return;
    try {
      ch.source?.disconnect();
      ch.highpass.disconnect();
      ch.compressor.disconnect();
      ch.gain.disconnect();
      ch.analyser.disconnect();
      ch.monitorGain.disconnect();
    } catch {
      // ignore disconnect errors
    }
    this.channels.delete(channelId);
  }

  setChannelParams(
    channelId: string,
    opts: { gain?: number; muted?: boolean; monitor?: boolean; clarityEq?: boolean }
  ): void {
    this.ensureContext();
    const ch = this.channels.get(channelId);
    if (!ch || !this.ctx) return;
    if (channelId === 'stinger-fx') {
      if (typeof opts.gain === 'number') this.sfxTargetGain = opts.gain;
      if (typeof opts.muted === 'boolean') this.sfxMuted = opts.muted;
    }
    if (typeof opts.gain === 'number' || typeof opts.muted === 'boolean') {
      const target = opts.muted ? 0 : (opts.gain ?? 1);
      ch.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
    if (typeof opts.monitor === 'boolean') {
      ch.monitorGain.gain.setTargetAtTime(opts.monitor ? 1 : 0, this.ctx.currentTime, 0.02);
    }
    if (typeof opts.clarityEq === 'boolean' && channelId !== 'stinger-fx') {
      ch.highpass.frequency.setTargetAtTime(opts.clarityEq ? 95 : 20, this.ctx.currentTime, 0.02);
      ch.compressor.ratio.setTargetAtTime(opts.clarityEq ? 4.5 : 1, this.ctx.currentTime, 0.02);
    }
    this.emit();
  }

  setMasterGain(value: number): void {
    this.ensureContext();
    if (!this.ctx) return;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    }
    if (this.masterMonitorBus) {
      this.masterMonitorBus.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    }
    this.emit();
  }

  getLevel(channelId: string): number {
    if (channelId === 'stinger-fx' && !this.ctx) {
      return 0;
    }
    const analyser =
      channelId === 'master' ? this.masterAnalyser : this.channels.get(channelId)?.analyser;
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return Math.min(1, peak * 1.85);
  }

  getCustomStingers(): CustomStingerItem[] {
    return Array.from(this.customStingers.values()).map(({ buffer: _b, ...item }) => item);
  }

  getActiveIds(): string[] {
    return Array.from(this.activeHandles.keys());
  }

  private registerHandle(id: string, envelopeGain: GainNode, rawStop: () => void, autoClearMs?: number): void {
    const prev = this.activeHandles.get(id);
    if (prev) {
      if (prev.timerId) window.clearTimeout(prev.timerId);
      prev.stop();
    }
    const handle: ActivePlaybackHandle = {
      id,
      envelopeGain,
      stop: () => {
        if (handle.timerId) window.clearTimeout(handle.timerId);
        try {
          rawStop();
        } catch {
          // ignore already stopped
        }
        try {
          envelopeGain.disconnect();
        } catch {
          // ignore
        }
        this.activeHandles.delete(id);
        this.emit();
      },
    };
    if (autoClearMs && autoClearMs > 0) {
      handle.timerId = window.setTimeout(() => {
        if (this.activeHandles.get(id) === handle) {
          this.activeHandles.delete(id);
          try {
            envelopeGain.disconnect();
          } catch {
            // ignore
          }
          this.emit();
        }
      }, autoClearMs);
    }
    this.activeHandles.set(id, handle);
    this.emit();
  }

  async loadCustomAudioFile(file: File): Promise<CustomStingerItem> {
    const ctx = this.ensureContext();
    const arrayBuf = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
    const cleanName = file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Custom Stinger';
    const id = `cst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const stored: StoredCustomStinger = {
      id,
      name: cleanName,
      durationSec: Number(audioBuffer.duration.toFixed(1)),
      loop: false,
      sourceKind: 'upload',
      buffer: audioBuffer,
    };
    this.customStingers.set(id, stored);
    this.emit();
    return {
      id: stored.id,
      name: stored.name,
      durationSec: stored.durationSec,
      loop: stored.loop,
      sourceKind: stored.sourceKind,
    };
  }

  async recordMicStinger(
    durationMs = 3000,
    existingStream?: MediaStream | null
  ): Promise<CustomStingerItem> {
    const ctx = this.ensureContext();
    let ownedStream: MediaStream | null = null;
    const activeAudioTrack = existingStream?.getAudioTracks().find((t) => t.readyState === 'live');
    const recStream = activeAudioTrack
      ? new MediaStream([activeAudioTrack])
      : ((ownedStream = await navigator.mediaDevices.getUserMedia({ audio: true })), ownedStream);

    return new Promise<CustomStingerItem>((resolve, reject) => {
      try {
        const chunks: Blob[] = [];
        const rec = new MediaRecorder(recStream);
        rec.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        rec.onerror = () => {
          ownedStream?.getTracks().forEach((t) => t.stop());
          reject(new Error('Microphone recording failed.'));
        };
        rec.onstop = async () => {
          ownedStream?.getTracks().forEach((t) => t.stop());
          try {
            const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
            const arrayBuf = await blob.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
            const count =
              Array.from(this.customStingers.values()).filter((s) => s.sourceKind === 'mic')
                .length + 1;
            const id = `mic-${Date.now().toString(36)}`;
            const stored: StoredCustomStinger = {
              id,
              name: `Mic Drop #${count}`,
              durationSec: Math.max(0.4, Number(audioBuffer.duration.toFixed(1))),
              loop: false,
              sourceKind: 'mic',
              buffer: audioBuffer,
            };
            this.customStingers.set(id, stored);
            this.emit();
            resolve({
              id: stored.id,
              name: stored.name,
              durationSec: stored.durationSec,
              loop: stored.loop,
              sourceKind: stored.sourceKind,
            });
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Unable to decode recorded audio.'));
          }
        };
        rec.start(150);
        window.setTimeout(() => {
          if (rec.state !== 'inactive') rec.stop();
        }, durationMs);
      } catch (err) {
        ownedStream?.getTracks().forEach((t) => t.stop());
        reject(err instanceof Error ? err : new Error('MediaRecorder unavailable.'));
      }
    });
  }

  playCustomStinger(id: string): void {
    const existing = this.activeHandles.get(id);
    if (existing) {
      existing.stop();
      return;
    }
    const item = this.customStingers.get(id);
    if (!item) return;

    const ctx = this.ensureContext();
    const sfxIn = this.getSfxInputNode();
    const env = ctx.createGain();
    env.gain.setValueAtTime(1.0, ctx.currentTime);
    env.connect(sfxIn);

    const src = ctx.createBufferSource();
    src.buffer = item.buffer;
    src.loop = item.loop;
    src.connect(env);

    src.onended = () => {
      const curr = this.activeHandles.get(id);
      if (curr) {
        if (curr.timerId) window.clearTimeout(curr.timerId);
        this.activeHandles.delete(id);
        try {
          env.disconnect();
        } catch {
          // ignore
        }
        this.emit();
      }
    };

    src.start(0);
    this.registerHandle(
      id,
      env,
      () => {
        src.onended = null;
        src.stop();
      },
      item.loop ? undefined : Math.ceil(item.buffer.duration * 1000) + 120
    );
  }

  toggleCustomStingerLoop(id: string): void {
    const item = this.customStingers.get(id);
    if (!item) return;
    item.loop = !item.loop;
    this.emit();
  }

  removeCustomStinger(id: string): void {
    const active = this.activeHandles.get(id);
    if (active) active.stop();
    this.customStingers.delete(id);
    this.emit();
  }

  stopAllStingers(): void {
    for (const handle of Array.from(this.activeHandles.values())) {
      handle.stop();
    }
    this.activeHandles.clear();
    this.emit();
  }

  fadeOutAllStingers(durationMs = 900): void {
    if (!this.ctx || this.activeHandles.size === 0) return;
    const now = this.ctx.currentTime;
    const durSec = Math.max(0.15, durationMs / 1000);
    const snapshot = Array.from(this.activeHandles.values());
    for (const handle of snapshot) {
      try {
        handle.envelopeGain.gain.cancelScheduledValues(now);
        handle.envelopeGain.gain.setValueAtTime(
          Math.max(0.001, handle.envelopeGain.gain.value),
          now
        );
        handle.envelopeGain.gain.exponentialRampToValueAtTime(0.0008, now + durSec);
      } catch {
        // ignore
      }
    }
    window.setTimeout(() => {
      for (const handle of snapshot) {
        if (this.activeHandles.get(handle.id) === handle) {
          handle.stop();
        }
      }
    }, durationMs + 40);
  }

  playStinger(pad: SoundboardPadId): void {
    const handleKey = `pad:${pad}`;
    const already = this.activeHandles.get(handleKey);
    if (already) {
      already.stop();
      return;
    }

    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const sfxIn = this.getSfxInputNode();
    const env = ctx.createGain();
    env.gain.setValueAtTime(1.0, now);
    env.connect(sfxIn);

    const stopCallbacks: Array<() => void> = [];
    const stopAllNodes = () => {
      stopCallbacks.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
    };

    if (pad === 'order') {
      [880, 1318.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        g.gain.setValueAtTime(0.001, now + idx * 0.09);
        g.gain.exponentialRampToValueAtTime(0.24, now + idx * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.55);
        osc.connect(g);
        g.connect(env);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.6);
        stopCallbacks.push(() => osc.stop());
      });
      this.registerHandle(handleKey, env, stopAllNodes, 720);
      return;
    }

    if (pad === 'intro') {
      [220, 277.18, 329.63, 440, 554.37].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        g.gain.setValueAtTime(0.001, now + idx * 0.04);
        g.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.04 + 0.16);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
        osc.connect(g);
        g.connect(env);
        osc.start(now + idx * 0.04);
        osc.stop(now + 1.4);
        stopCallbacks.push(() => osc.stop());
      });
      this.registerHandle(handleKey, env, stopAllNodes, 1450);
      return;
    }

    if (pad === 'whoosh') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.8;
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(2100, now + 0.22);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.48);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.01, now);
      g.gain.exponentialRampToValueAtTime(0.28, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      noise.connect(filter);
      filter.connect(g);
      g.connect(env);
      noise.start(now);
      stopCallbacks.push(() => noise.stop());
      this.registerHandle(handleKey, env, stopAllNodes, 540);
      return;
    }

    if (pad === 'applause') {
      const bufferSize = Math.floor(ctx.sampleRate * 1.6);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const envShape = Math.sin((i / bufferSize) * Math.PI);
        const burst = 0.55 + 0.45 * Math.sin(i * 0.017);
        data[i] = (Math.random() * 2 - 1) * envShape * burst * 0.55;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1250;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      noise.connect(filter);
      filter.connect(g);
      g.connect(env);
      noise.start(now);
      stopCallbacks.push(() => noise.stop());
      this.registerHandle(handleKey, env, stopAllNodes, 1650);
      return;
    }

    if (pad === 'hype') {
      // Punchy brassy broadcast hype sting
      [0, 0.13, 0.26].forEach((offset, idx) => {
        const baseFreq = idx === 2 ? 466.16 : 392.0;
        [baseFreq, baseFreq * 1.006, baseFreq * 1.5].forEach((freq) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq * 0.96, now + offset);
          osc.frequency.exponentialRampToValueAtTime(freq, now + offset + 0.03);
          const dur = idx === 2 ? 0.52 : 0.11;
          g.gain.setValueAtTime(0.001, now + offset);
          g.gain.exponentialRampToValueAtTime(0.085, now + offset + 0.015);
          g.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
          osc.connect(g);
          g.connect(env);
          osc.start(now + offset);
          osc.stop(now + offset + dur + 0.03);
          stopCallbacks.push(() => osc.stop());
        });
      });
      this.registerHandle(handleKey, env, stopAllNodes, 840);
      return;
    }

    if (pad === 'drumroll') {
      // Rising tension snare roll + cymbal hit
      const bufferSize = Math.floor(ctx.sampleRate * 1.35);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const rate = 16 + t * 14;
        const pulse = Math.pow(Math.abs(Math.sin(Math.PI * rate * t)), 6);
        const crescendo = Math.min(1, 0.25 + t * 0.65);
        data[i] = (Math.random() * 2 - 1) * pulse * crescendo * 0.55;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 380;
      noise.connect(filter);
      filter.connect(env);
      noise.start(now);
      stopCallbacks.push(() => noise.stop());
      this.registerHandle(handleKey, env, stopAllNodes, 1400);
      return;
    }

    // Alert cue
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(783.99, now + 0.1);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(g);
    g.connect(env);
    osc.start(now);
    osc.stop(now + 0.4);
    stopCallbacks.push(() => osc.stop());
    this.registerHandle(handleKey, env, stopAllNodes, 430);
  }
}

export const audioEngine = new GatherAudioEngine();
