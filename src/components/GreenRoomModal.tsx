import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  CameraOff,
  Gamepad2,
  ImagePlus,
  Mic,
  MicOff,
  Radio,
  RotateCcw,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { DEFAULT_VIDEO_FX } from '../constants/studioDefaults';
import { VideoFxSettings, WatchMode } from '../types/studio';
import { GatherLogo } from './GatherLogo';

interface GreenRoomModalProps {
  open: boolean;
  roomCode: string;
  initialName: string;
  initialAvatarUrl?: string;
  initialFx: VideoFxSettings;
  initialWatchMode?: WatchMode;
  isSignedIn?: boolean;
  onOpenAuth?: () => void;
  onCancel: () => void;
  onEnter: (payload: {
    name: string;
    avatarUrl?: string;
    micOn: boolean;
    camOn: boolean;
    stream: MediaStream | null;
    fx: VideoFxSettings;
    studioTitle?: string;
    watchMode: WatchMode;
    isHost: boolean;
  }) => void;
  isNewStudio: boolean;
}

const GoogleMark: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const GreenRoomModal: React.FC<GreenRoomModalProps> = ({
  open,
  roomCode,
  initialName,
  initialAvatarUrl,
  initialFx,
  initialWatchMode = 'standard',
  isSignedIn = false,
  onOpenAuth,
  onCancel,
  onEnter,
  isNewStudio,
}) => {
  const [name, setName] = useState(initialName || 'Maya Chen');
  const [studioTitle, setStudioTitle] = useState('Gather Live Broadcast');
  const [watchMode, setWatchMode] = useState<WatchMode>(initialWatchMode);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(initialAvatarUrl);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [fx, setFx] = useState<VideoFxSettings>(initialFx);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCam, setSelectedCam] = useState('');
  const [meterLevel, setMeterLevel] = useState(0);
  const [mediaUnavailable, setMediaUnavailable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (initialAvatarUrl) setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  useEffect(() => {
    if (open) {
      setWatchMode(initialWatchMode);
    }
  }, [open, initialWatchMode]);

  const closeModal = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeModal]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let rafId = 0;
    let analyserCtx: AudioContext | null = null;

    const initDevices = async () => {
      setMediaUnavailable(false);
      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
          video: selectedCam
            ? { deviceId: { exact: selectedCam }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const list = await navigator.mediaDevices.enumerateDevices();
        if (active) setDevices(list);

        if (stream.getAudioTracks().length > 0) {
          analyserCtx = new AudioContext();
          const src = analyserCtx.createMediaStreamSource(stream);
          const analyser = analyserCtx.createAnalyser();
          analyser.fftSize = 128;
          src.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!active) return;
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (let i = 0; i < data.length; i++) {
              const v = Math.abs(data[i] - 128) / 128;
              if (v > peak) peak = v;
            }
            setMeterLevel(Math.min(100, Math.round(peak * 220)));
            rafId = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {
        if (active) setMediaUnavailable(true);
      }
    };

    void initDevices();

    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (analyserCtx) void analyserCtx.close();
    };
  }, [open, selectedMic, selectedCam, retryCount]);

  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = micOn;
    });
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = camOn;
    });
  }, [micOn, camOn]);

  if (!open) return null;

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'G';

  const bgMode = fx.bgMode || (fx.blurBg ? 'blur' : 'natural');
  const activeSegments = Math.round(((micOn ? meterLevel : 0) / 100) * 10);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    onEnter({
      name: name.trim() || 'Host',
      avatarUrl,
      micOn,
      camOn,
      stream: streamRef.current,
      fx,
      studioTitle: isNewStudio ? studioTitle.trim() || 'Gather Live Broadcast' : undefined,
      watchMode,
      isHost: isNewStudio,
    });
  };

  const inputCls =
    'w-full h-9 px-3 rounded-[9px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)] transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 backdrop-blur-md flex items-center justify-center p-4"
      onClick={closeModal}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[900px] rounded-[18px] gather-glass-elevated animate-gather-modal overflow-hidden"
      >
        {/* Frosted Specular Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-3 min-w-0">
            <GatherLogo size={28} />
            <div className="min-w-0">
              <h2 className="font-display text-[15px] font-bold text-[var(--ink)] tracking-tight">
                Green Room Pre-Check
              </h2>
              <p className="text-[11px] text-[var(--ink-3)] font-mono-num mt-0.5 truncate">
                Room {roomCode} · {isNewStudio ? 'Host broadcast setup' : 'Guest check-in'} · $0 fees
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isSignedIn && onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="h-8 px-3 rounded-[8px] bg-white hover:bg-[#f8faff] text-[#1f1f1f] border border-[#dadce0] shadow-xs text-[11px] font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <GoogleMark />
                <span>Sign in with Google</span>
              </button>
            )}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close green room"
              className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleJoin} className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
          {/* Left 7 cols: Live Monitor & Grading */}
          <div className="md:col-span-7 space-y-4">
            <div className="relative aspect-video rounded-[13px] overflow-hidden bg-[#070d1c] border border-white/12 shadow-xl">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-150 ${
                  camOn && !mediaUnavailable ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  transform: fx.mirror ? 'scaleX(-1)' : 'none',
                  filter: `brightness(${fx.brightness}%) contrast(${fx.contrast}%) saturate(${fx.saturation}%)`,
                }}
              />

              {/* Studio Backdrop Vignette Preview */}
              {camOn && !mediaUnavailable && bgMode !== 'natural' && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      bgMode === 'dim'
                        ? 'radial-gradient(circle at 50% 45%, transparent 32%, rgba(6,10,22,0.74) 95%)'
                        : 'radial-gradient(circle at 50% 45%, transparent 40%, rgba(12,18,36,0.52) 95%)',
                  }}
                />
              )}

              {/* Avatar / Monogram Stage */}
              {(!camOn || mediaUnavailable) && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 35%, rgba(47,107,240,0.22), rgba(8,12,24,0.94) 72%)',
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[var(--accent)] shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full gather-btn-primary font-display font-bold text-xl grid place-items-center">
                      {initials}
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-white/90">
                      {!camOn
                        ? 'Camera off — entering stage with studio avatar'
                        : 'Audio-only & avatar stage preview ready'}
                    </div>
                    {mediaUnavailable && (
                      <button
                        type="button"
                        onClick={() => setRetryCount((c) => c + 1)}
                        className="text-[11px] font-semibold text-[#8ab4ff] hover:underline cursor-pointer"
                      >
                        Retry camera &amp; microphone permission
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Glass Floating Transport Strip */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMicOn((v) => !v)}
                    className={`h-8 px-3 rounded-[8px] text-xs font-semibold inline-flex items-center gap-1.5 backdrop-blur-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      micOn
                        ? 'bg-black/55 text-white border-white/15 hover:bg-black/75'
                        : 'gather-btn-live border-transparent'
                    }`}
                  >
                    {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    <span>{micOn ? 'Mic on' : 'Muted'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCamOn((v) => !v)}
                    className={`h-8 px-3 rounded-[8px] text-xs font-semibold inline-flex items-center gap-1.5 backdrop-blur-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      camOn
                        ? 'bg-black/55 text-white border-white/15 hover:bg-black/75'
                        : 'gather-btn-live border-transparent'
                    }`}
                  >
                    {camOn ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
                    <span>{camOn ? 'Cam on' : 'Cam off'}</span>
                  </button>
                </div>

                {/* Multi-Segment LED Audio Input Meter */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] bg-black/55 backdrop-blur-xl border border-white/15">
                  <span className="text-[10px] font-mono-num text-white/70">IN</span>
                  <div className="flex items-center gap-0.5" aria-label="Microphone input level">
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const lit = idx < activeSegments;
                      const segColor =
                        idx >= 8
                          ? 'bg-[var(--live)]'
                          : idx >= 6
                          ? 'bg-[var(--warn)]'
                          : 'bg-[var(--ok)]';
                      return (
                        <span
                          key={idx}
                          className={`w-1.5 h-2.5 rounded-[1px] transition-colors ${
                            lit ? segColor : 'bg-white/15'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Look & Grading Controls */}
            <div className="pt-3 border-t border-[var(--line)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="gather-seg">
                  {(
                    [
                      { id: 'natural', label: 'Natural' },
                      { id: 'blur', label: 'Soft Blur' },
                      { id: 'dim', label: 'Studio Dim' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-selected={bgMode === mode.id}
                      onClick={() =>
                        setFx((p) => ({
                          ...p,
                          bgMode: mode.id,
                          blurBg: mode.id === 'blur',
                        }))
                      }
                      className={`gather-seg-btn h-6 px-2.5 text-[11px] ${
                        bgMode === mode.id ? 'active' : ''
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[var(--ink-2)]">
                    <input
                      type="checkbox"
                      checked={fx.mirror}
                      onChange={(e) => setFx((p) => ({ ...p, mirror: e.target.checked }))}
                      className="accent-[var(--accent)]"
                    />
                    <span>Mirror</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFx(DEFAULT_VIDEO_FX)}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <label className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--ink-3)]">Brightness</span>
                    <span className="font-mono-num text-[var(--ink-2)]">{fx.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={140}
                    value={fx.brightness}
                    onChange={(e) => setFx((p) => ({ ...p, brightness: Number(e.target.value) }))}
                    className="gather-range w-full"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--ink-3)]">Contrast</span>
                    <span className="font-mono-num text-[var(--ink-2)]">{fx.contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={140}
                    value={fx.contrast}
                    onChange={(e) => setFx((p) => ({ ...p, contrast: Number(e.target.value) }))}
                    className="gather-range w-full"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--ink-3)]">Color</span>
                    <span className="font-mono-num text-[var(--ink-2)]">{fx.saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={160}
                    value={fx.saturation}
                    onChange={(e) => setFx((p) => ({ ...p, saturation: Number(e.target.value) }))}
                    className="gather-range w-full"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right 5 cols: Stream Format, Identity, Devices, Enter */}
          <div className="md:col-span-5 flex flex-col justify-between gap-4 md:border-l md:border-[var(--line)] md:pl-6">
            <div className="space-y-3">
              {isNewStudio && (
                <>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-[var(--ink-2)] block">
                      Watch Page Format
                    </span>
                    <div
                      className="gather-seg w-full grid grid-cols-3"
                      role="tablist"
                      aria-label="Watch Page Format"
                    >
                      {(
                        [
                          { id: 'standard', label: 'Broadcast', icon: Radio },
                          { id: 'shop', label: 'Live Shop', icon: ShoppingBag },
                          { id: 'gamer', label: 'Gaming', icon: Gamepad2 },
                        ] as Array<{
                          id: WatchMode;
                          label: string;
                          icon: React.ComponentType<{ className?: string }>;
                        }>
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const active = watchMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => {
                              setWatchMode(opt.id);
                              if (opt.id === 'shop' && studioTitle === 'Gather Live Broadcast') {
                                setStudioTitle('Studio Objects Live Drop');
                              } else if (
                                opt.id === 'gamer' &&
                                (studioTitle === 'Gather Live Broadcast' ||
                                  studioTitle === 'Studio Objects Live Drop')
                              ) {
                                setStudioTitle('Ranked Squad Co-Stream');
                              } else if (opt.id === 'standard') {
                                setStudioTitle('Gather Live Broadcast');
                              }
                            }}
                            className={`gather-seg-btn h-8 text-[11px] ${active ? 'active' : ''}`}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-[var(--ink-3)] leading-snug">
                      {watchMode === 'standard'
                        ? 'Cinema Watch Page with Q&A, Polls & in-chat tips — zero shopping or gaming clutter.'
                        : watchMode === 'shop'
                        ? 'Live Drops runway & in-watch Express Bag checkout without leaving the stream.'
                        : 'Squad Queue, Predictions, Pro Rig specs & 30s instant clips.'}
                    </p>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[var(--ink-2)]">Show title</span>
                    <input
                      type="text"
                      value={studioTitle}
                      onChange={(e) => setStudioTitle(e.target.value)}
                      placeholder="My Live Broadcast"
                      className={inputCls}
                    />
                  </label>
                </>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--ink-2)]">Your display name</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className={inputCls}
                />
              </label>

              {/* Off-cam Avatar Photo */}
              <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
                <span className="text-[var(--ink-2)] font-medium">Off-cam avatar</span>
                <div className="flex items-center gap-2">
                  <label className="h-7 px-2.5 rounded-[7px] bg-[var(--fill)] hover:border-[var(--accent)] border border-[var(--line-2)] text-[11px] font-medium text-[var(--ink)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors">
                    <ImagePlus className="w-3 h-3 text-[var(--accent-text)]" />
                    <span>{avatarUrl ? 'Replace photo' : 'Upload photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') setAvatarUrl(reader.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(undefined)}
                      aria-label="Remove avatar photo"
                      className="h-7 w-7 grid place-items-center rounded-[7px] text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--ink-2)]">Microphone</span>
                <select
                  value={selectedMic}
                  onChange={(e) => setSelectedMic(e.target.value)}
                  className={inputCls}
                >
                  <option value="">System default microphone</option>
                  {devices
                    .filter((d) => d.kind === 'audioinput')
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Mic ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--ink-2)]">Camera</span>
                <select
                  value={selectedCam}
                  onChange={(e) => setSelectedCam(e.target.value)}
                  className={inputCls}
                >
                  <option value="">System default camera</option>
                  {devices
                    .filter((d) => d.kind === 'videoinput')
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                className="w-full h-10 rounded-[10px] gather-btn-primary text-[13px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span>{isNewStudio ? 'Launch Studio' : 'Enter Green Room'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[11px] text-[var(--ink-3)] text-center">
                Locked rooms hold guests cleanly in the Waiting Lobby until admitted.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
