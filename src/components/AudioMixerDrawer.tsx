import React, { useEffect, useState } from 'react';
import {
  Headphones,
  Mic,
  MicOff,
  Music2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import { AudioChannelState } from '../types/studio';
import { audioEngine } from '../utils/audioEngine';
import { PRESET_STINGER_PADS } from './StingerDeckDrawer';

interface AudioMixerDrawerProps {
  open: boolean;
  channels: AudioChannelState[];
  masterGain: number;
  onUpdateChannel: (id: string, patch: Partial<AudioChannelState>) => void;
  onUpdateMasterGain: (gain: number) => void;
  onOpenStingerDeck?: () => void;
  onClose: () => void;
}

export const AudioMixerDrawer: React.FC<AudioMixerDrawerProps> = ({
  open,
  channels,
  masterGain,
  onUpdateChannel,
  onUpdateMasterGain,
  onOpenStingerDeck,
  onClose,
}) => {
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [activeIds, setActiveIds] = useState<string[]>(() => audioEngine.getActiveIds());

  useEffect(() => {
    return audioEngine.subscribe(() => {
      setActiveIds(audioEngine.getActiveIds());
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    let rafId = 0;
    const poll = () => {
      const next: Record<string, number> = {
        master: audioEngine.getLevel('master'),
      };
      for (const ch of channels) {
        next[ch.id] = ch.muted ? 0 : audioEngine.getLevel(ch.id);
      }
      setLevels(next);
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [open, channels]);

  if (!open) return null;

  const toDb = (lvl: number) => {
    if (lvl <= 0.01) return '-∞ dB';
    const db = Math.max(-48, Math.round(20 * Math.log10(lvl)));
    return `${db > 0 ? '+' : ''}${db} dB`;
  };

  return (
    <div className="rounded-[12px] gather-glass overflow-hidden animate-gather-drawer">
      <div className="px-4 py-2.5 border-b border-[var(--line)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Waves className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
          <h3 className="font-display text-xs font-bold text-[var(--ink)] whitespace-nowrap">
            Pro Audio Mix Bus
          </h3>
          <span className="text-[11px] text-[var(--ink-3)] hidden sm:inline truncate">
            · Routed to live Watch stream &amp; recordings
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {onOpenStingerDeck && (
            <button
              type="button"
              onClick={onOpenStingerDeck}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-text)] hover:underline whitespace-nowrap cursor-pointer"
            >
              <Music2 className="w-3 h-3" />
              <span>Custom Stingers</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close audio mixer"
            className="h-6 w-6 grid place-items-center rounded-[6px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hairline-divided console strip — zero nested cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)]">
        {/* Channel Strips */}
        <div className="lg:col-span-9 flex flex-wrap sm:flex-nowrap overflow-x-auto gather-scroll divide-x divide-[var(--line)]">
          {channels.map((ch) => {
            const lvl = levels[ch.id] ?? 0;
            const isSfx = ch.id === 'stinger-fx';
            return (
              <div key={ch.id} className="min-w-[168px] flex-1 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-[var(--ink)] truncate">
                    {ch.label}
                  </span>
                  <span className="text-[11px] font-mono-num text-[var(--ink-3)]">
                    {toDb(lvl)}
                  </span>
                </div>

                {/* VU Meter */}
                <div className="h-1.5 rounded-sm bg-[var(--fill)] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      lvl > 0.85
                        ? 'bg-[var(--live)]'
                        : lvl > 0.65
                        ? 'bg-[var(--warn)]'
                        : 'bg-[var(--ok)]'
                    }`}
                    style={{ width: `${Math.min(100, Math.round(lvl * 100))}%` }}
                  />
                </div>

                {/* Gain Fader */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={ch.gain}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      audioEngine.setChannelParams(ch.id, { gain: val, muted: ch.muted });
                      onUpdateChannel(ch.id, { gain: val });
                    }}
                    aria-label={`${ch.label} gain`}
                    className="gather-range flex-1"
                  />
                  <span className="text-[11px] font-mono-num text-[var(--ink-2)] w-9 text-right">
                    {Math.round(ch.gain * 100)}%
                  </span>
                </div>

                {/* Channel Switches */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !ch.muted;
                      audioEngine.setChannelParams(ch.id, { muted: next, gain: ch.gain });
                      onUpdateChannel(ch.id, { muted: next });
                    }}
                    className={`flex-1 h-7 rounded-[6px] text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer ${
                      ch.muted
                        ? 'bg-[var(--live)] text-white'
                        : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {ch.muted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    <span>{ch.muted ? 'Muted' : 'Live'}</span>
                  </button>
                  {!isSfx && (
                    <button
                      type="button"
                      title="Voice Clarity EQ + Compressor"
                      onClick={() => {
                        const next = !ch.clarityEq;
                        audioEngine.setChannelParams(ch.id, { clarityEq: next });
                        onUpdateChannel(ch.id, { clarityEq: next });
                      }}
                      className={`h-7 px-2 rounded-[6px] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                        ch.clarityEq
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--fill)] text-[var(--ink-3)]'
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>EQ</span>
                    </button>
                  )}
                  <button
                    type="button"
                    title="Monitor in headphones"
                    onClick={() => {
                      const next = !ch.monitor;
                      audioEngine.setChannelParams(ch.id, { monitor: next });
                      onUpdateChannel(ch.id, { monitor: next });
                    }}
                    className={`h-7 w-7 grid place-items-center rounded-[6px] cursor-pointer ${
                      ch.monitor
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--fill)] text-[var(--ink-3)]'
                    }`}
                  >
                    <Headphones className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Master Bus Strip */}
          <div className="min-w-[172px] p-3.5 space-y-2.5 bg-[var(--bg)]/45">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--accent-text)]">Master Bus</span>
              <span className="text-[11px] font-mono-num text-[var(--ink-3)]">
                {toDb(levels.master ?? 0)}
              </span>
            </div>
            <div className="h-1.5 rounded-sm bg-[var(--fill)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-75"
                style={{ width: `${Math.min(100, Math.round((levels.master ?? 0) * 100))}%` }}
              />
            </div>
            <div className="flex items-center gap-2">
              {masterGain === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-[var(--live)]" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[var(--ink-2)]" />
              )}
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
            <p className="text-[11px] text-[var(--ink-3)]">Program &amp; Watch feed</p>
          </div>
        </div>

        {/* Quick Stinger Trigger Pads */}
        <div className="lg:col-span-3 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink)]">Quick Stingers</span>
            {onOpenStingerDeck && (
              <button
                type="button"
                onClick={onOpenStingerDeck}
                className="text-[11px] text-[var(--accent-text)] hover:underline cursor-pointer"
              >
                + Upload
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_STINGER_PADS.slice(0, 4).map((pad) => {
              const active = activeIds.includes(`pad:${pad.id}`);
              return (
                <button
                  key={pad.id}
                  type="button"
                  onClick={() => audioEngine.playStinger(pad.id)}
                  className={`px-2.5 py-1.5 rounded-[6px] border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)]'
                      : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--line)] text-[var(--ink)]'
                  }`}
                >
                  <div className="text-xs font-medium truncate leading-tight">{pad.label}</div>
                  <div className="text-[10px] text-[var(--ink-3)] truncate">{pad.hint}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
