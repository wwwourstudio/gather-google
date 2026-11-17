import React, { useEffect, useRef, useState } from 'react';
import {
  Headphones,
  Mic,
  Music2,
  Play,
  Repeat,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import { AudioChannelState } from '../types/studio';
import { audioEngine, CustomStingerItem, SoundboardPadId } from '../utils/audioEngine';

interface StingerDeckDrawerProps {
  open: boolean;
  sfxChannel: AudioChannelState;
  masterGain: number;
  localStream: MediaStream | null;
  onUpdateSfxChannel: (patch: Partial<AudioChannelState>) => void;
  onUpdateMasterGain: (gain: number) => void;
  onOpenMixer: () => void;
  onNotify?: (msg: string) => void;
  onClose: () => void;
}

export const PRESET_STINGER_PADS: Array<{
  id: SoundboardPadId;
  label: string;
  hint: string;
  durationLabel: string;
}> = [
  { id: 'intro', label: 'Intro Swell', hint: 'Warm opener', durationLabel: '1.4s' },
  { id: 'whoosh', label: 'Scene Whoosh', hint: 'Transition', durationLabel: '0.5s' },
  { id: 'applause', label: 'Applause', hint: 'Crowd reaction', durationLabel: '1.6s' },
  { id: 'order', label: 'Drop Chime', hint: 'Sale / tip bell', durationLabel: '0.7s' },
  { id: 'hype', label: 'Hype Horn', hint: 'Big play sting', durationLabel: '0.8s' },
  { id: 'drumroll', label: 'Drumroll', hint: 'Reveal build', durationLabel: '1.4s' },
];

export const StingerDeckDrawer: React.FC<StingerDeckDrawerProps> = ({
  open,
  sfxChannel,
  masterGain,
  localStream,
  onUpdateSfxChannel,
  onUpdateMasterGain,
  onOpenMixer,
  onNotify,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [customItems, setCustomItems] = useState<CustomStingerItem[]>(() =>
    audioEngine.getCustomStingers()
  );
  const [activeIds, setActiveIds] = useState<string[]>(() => audioEngine.getActiveIds());
  const [sfxLevel, setSfxLevel] = useState(0);
  const [masterLevel, setMasterLevel] = useState(0);
  const [recordingMic, setRecordingMic] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    return audioEngine.subscribe(() => {
      setCustomItems(audioEngine.getCustomStingers());
      setActiveIds(audioEngine.getActiveIds());
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    let rafId = 0;
    const poll = () => {
      setSfxLevel(sfxChannel.muted ? 0 : audioEngine.getLevel('stinger-fx'));
      setMasterLevel(audioEngine.getLevel('master'));
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [open, sfxChannel.muted]);

  if (!open) return null;

  const toDb = (lvl: number) => {
    if (lvl <= 0.01) return '-∞ dB';
    const db = Math.max(-48, Math.round(20 * Math.log10(lvl)));
    return `${db > 0 ? '+' : ''}${db} dB`;
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setErrMsg('');
    try {
      for (const file of Array.from(files)) {
        const added = await audioEngine.loadCustomAudioFile(file);
        onNotify?.(`Loaded stinger "${added.name}" (${added.durationSec}s)`);
      }
    } catch {
      setErrMsg('Could not decode audio file. Try MP3, WAV, OGG, or M4A.');
    } finally {
      setUploading(false);
    }
  };

  const handleRecordMicDrop = async () => {
    if (recordingMic) return;
    setRecordingMic(true);
    setErrMsg('');
    try {
      const item = await audioEngine.recordMicStinger(3000, localStream);
      onNotify?.(`Saved 3s "${item.name}" to Stinger Deck`);
    } catch {
      setErrMsg('Microphone unavailable to record custom stinger.');
    } finally {
      setRecordingMic(false);
    }
  };

  return (
    <div className="rounded-[12px] gather-glass overflow-hidden animate-gather-drawer">
      {/* Header Bar */}
      <div className="px-4 py-2.5 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Music2 className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
          <h3 className="font-display text-xs font-bold text-[var(--ink)] whitespace-nowrap">
            Stingers &amp; Broadcast FX
          </h3>
          <span className="text-[11px] text-[var(--ink-3)] hidden sm:inline truncate">
            · Synced to Master Audio Bus, Watch stream &amp; 30s clips
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeIds.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => audioEngine.fadeOutAllStingers(900)}
                className="h-6 px-2.5 rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[11px] font-semibold text-[var(--ink)] whitespace-nowrap cursor-pointer"
              >
                Fade out
              </button>
              <button
                type="button"
                onClick={() => audioEngine.stopAllStingers()}
                className="h-6 px-2.5 rounded-[6px] bg-[var(--live)] text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop ({activeIds.length})</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onOpenMixer}
            className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline whitespace-nowrap cursor-pointer"
          >
            Full Mixer
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stingers deck"
            className="h-6 w-6 grid place-items-center rounded-[6px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 3-Zone Console Strip */}
      <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-[var(--line)]">
        {/* Zone 1: FX Bus + Master Bus Live Gain & Metering (3 cols) */}
        <div className="xl:col-span-3 p-3.5 space-y-3 bg-[var(--bg)]/35">
          {/* Stinger FX Sub-Bus */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[var(--ink)]">Stinger FX Bus</span>
              <span className="font-mono-num text-[var(--ink-3)]">{toDb(sfxLevel)}</span>
            </div>
            <div className="h-1.5 rounded-sm bg-[var(--fill)] overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  sfxLevel > 0.85
                    ? 'bg-[var(--live)]'
                    : sfxLevel > 0.65
                    ? 'bg-[var(--warn)]'
                    : 'bg-[var(--ok)]'
                }`}
                style={{ width: `${Math.min(100, Math.round(sfxLevel * 100))}%` }}
              />
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={sfxChannel.gain}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  audioEngine.setChannelParams('stinger-fx', {
                    gain: val,
                    muted: sfxChannel.muted,
                  });
                  onUpdateSfxChannel({ gain: val });
                }}
                aria-label="Stinger FX bus gain"
                className="gather-range flex-1"
              />
              <span className="text-[11px] font-mono-num text-[var(--ink-2)] w-9 text-right">
                {Math.round(sfxChannel.gain * 100)}%
              </span>
            </div>
          </div>

          {/* Master Audio Bus Mirror */}
          <div className="space-y-1.5 pt-2.5 border-t border-[var(--line)]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[var(--accent-text)] inline-flex items-center gap-1">
                <Waves className="w-3 h-3" />
                <span>Master Bus</span>
              </span>
              <span className="font-mono-num text-[var(--ink-3)]">{toDb(masterLevel)}</span>
            </div>
            <div className="h-1.5 rounded-sm bg-[var(--fill)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-75"
                style={{ width: `${Math.min(100, Math.round(masterLevel * 100))}%` }}
              />
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={masterGain}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  audioEngine.setMasterGain(val);
                  onUpdateMasterGain(val);
                }}
                aria-label="Master bus gain"
                className="gather-range flex-1"
              />
              <span className="text-[11px] font-mono-num text-[var(--ink-2)] w-9 text-right">
                {Math.round(masterGain * 100)}%
              </span>
            </div>
          </div>

          {/* Mute + Headphone Monitor Switches */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                const next = !sfxChannel.muted;
                audioEngine.setChannelParams('stinger-fx', {
                  muted: next,
                  gain: sfxChannel.gain,
                });
                onUpdateSfxChannel({ muted: next });
              }}
              className={`flex-1 h-7 px-2 rounded-[6px] text-[11px] font-semibold inline-flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                sfxChannel.muted
                  ? 'bg-[var(--live)] text-white'
                  : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[var(--ink-2)]'
              }`}
            >
              {sfxChannel.muted ? (
                <VolumeX className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
              <span>{sfxChannel.muted ? 'FX Muted' : 'FX Live'}</span>
            </button>
            <button
              type="button"
              title="Monitor stingers locally in speakers/headphones"
              onClick={() => {
                const next = !sfxChannel.monitor;
                audioEngine.setChannelParams('stinger-fx', { monitor: next });
                onUpdateSfxChannel({ monitor: next });
              }}
              className={`h-7 px-2.5 rounded-[6px] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                sfxChannel.monitor
                  ? 'bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[var(--ink)]'
                  : 'bg-[var(--fill)] border border-[var(--line)] text-[var(--ink-3)]'
              }`}
            >
              <Headphones className="w-3 h-3" />
              <span>Monitor</span>
            </button>
          </div>
        </div>

        {/* Zone 2: Built-In Broadcast Stingers (4 cols) */}
        <div className="xl:col-span-4 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--ink)]">Broadcast Stingers</span>
            <span className="text-[11px] text-[var(--ink-3)]">Click to play / stop</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-1.5">
            {PRESET_STINGER_PADS.map((pad) => {
              const isPlaying = activeIds.includes(`pad:${pad.id}`);
              return (
                <button
                  key={pad.id}
                  type="button"
                  onClick={() => audioEngine.playStinger(pad.id)}
                  className={`px-2.5 py-2 rounded-[8px] border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isPlaying
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)]'
                      : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--line)] hover:border-[var(--line-2)] text-[var(--ink)]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate leading-tight">{pad.label}</div>
                    <div className="text-[10px] text-[var(--ink-3)] truncate mt-0.5">
                      {pad.hint} · <span className="font-mono-num">{pad.durationLabel}</span>
                    </div>
                  </div>
                  <span
                    className={`w-6 h-6 rounded-[6px] grid place-items-center shrink-0 ${
                      isPlaying
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg)]/60 text-[var(--ink-2)]'
                    }`}
                  >
                    {isPlaying ? (
                      <Square className="w-2.5 h-2.5 fill-current" />
                    ) : (
                      <Play className="w-3 h-3 fill-current" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Zone 3: Custom Uploaded & Recorded Stingers (5 cols) */}
        <div className="xl:col-span-5 p-3.5 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--ink)]">
                Custom Stingers ({customItems.length})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 px-2.5 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>{uploading ? 'Decoding…' : 'Upload Audio'}</span>
                </button>
                <button
                  type="button"
                  disabled={recordingMic}
                  onClick={() => void handleRecordMicDrop()}
                  className={`h-7 px-2.5 rounded-[6px] border text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                    recordingMic
                      ? 'bg-[var(--live)] border-transparent text-white'
                      : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--line-2)] text-[var(--ink)]'
                  }`}
                >
                  <Mic className="w-3 h-3" />
                  <span>{recordingMic ? 'Recording 3s…' : 'Record 3s Drop'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleUploadFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {errMsg && <p className="text-[11px] text-[var(--danger)]">{errMsg}</p>}

            {customItems.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-[8px] border border-dashed border-[var(--line-2)] hover:border-[var(--accent)] px-3.5 py-4 text-center cursor-pointer transition-colors"
              >
                <p className="text-xs font-medium text-[var(--ink-2)]">
                  Upload custom MP3 / WAV / OGG stingers or record a 3-second mic drop
                </p>
                <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                  Plays directly through the Master Audio Bus to live viewers and recordings
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[124px] overflow-y-auto gather-scroll pr-0.5">
                {customItems.map((item) => {
                  const isPlaying = activeIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`px-2.5 py-2 rounded-[8px] border flex items-center justify-between gap-2 transition-colors ${
                        isPlaying
                          ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
                          : 'bg-[var(--fill)] border-[var(--line)] hover:border-[var(--line-2)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => audioEngine.playCustomStinger(item.id)}
                        className="min-w-0 flex-1 flex items-center gap-2 text-left cursor-pointer"
                      >
                        <span
                          className={`w-6 h-6 rounded-[6px] grid place-items-center shrink-0 ${
                            isPlaying
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg)]/70 text-[var(--ink)]'
                          }`}
                        >
                          {isPlaying ? (
                            <Square className="w-2.5 h-2.5 fill-current" />
                          ) : (
                            <Play className="w-3 h-3 fill-current" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--ink)] truncate leading-tight">
                            {item.name}
                          </div>
                          <div className="text-[10px] font-mono-num text-[var(--ink-3)] mt-0.5">
                            {item.durationSec}s · {item.sourceKind === 'mic' ? 'Mic' : 'Audio'}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title={item.loop ? 'Loop enabled' : 'Enable loop'}
                          aria-label={`Toggle loop for ${item.name}`}
                          onClick={() => audioEngine.toggleCustomStingerLoop(item.id)}
                          className={`h-6 w-6 grid place-items-center rounded-[5px] cursor-pointer transition-colors ${
                            item.loop
                              ? 'bg-[var(--accent)] text-white'
                              : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
                          }`}
                        >
                          <Repeat className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => audioEngine.removeCustomStinger(item.id)}
                          className="h-6 w-6 grid place-items-center rounded-[5px] text-[var(--ink-3)] hover:text-[var(--danger)] hover:bg-[var(--fill-hover)] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
