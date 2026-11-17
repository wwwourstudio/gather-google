import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  EyeOff,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Tv,
} from 'lucide-react';
import { MediaAsset, SlideAiCue } from '../types/studio';

interface TeleprompterOverlayProps {
  visible: boolean;
  script: string;
  onScriptChange: (next: string) => void;
  onClose: () => void;
  activeMedia: MediaAsset | null;
  onSelectSlide?: (pageIndex: number) => void;
  onPushBanner?: (title: string, subtitle: string) => void;
  onOpenAiDrawer?: () => void;
}

export const TeleprompterOverlay: React.FC<TeleprompterOverlayProps> = ({
  visible,
  script,
  onScriptChange,
  onClose,
  activeMedia,
  onSelectSlide,
  onPushBanner,
  onOpenAiDrawer,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceFollow, setVoiceFollow] = useState(false);
  const [wpm, setWpm] = useState(145);
  const [fontSize, setFontSize] = useState<18 | 22 | 26>(22);
  const [editing, setEditing] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [heardSnippet, setHeardSnippet] = useState('');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([]);

  const lines = useMemo(() => {
    const raw = script
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    return raw.length > 0
      ? raw
      : [
          'Welcome back to the live broadcast — thank you all for tuning in today.',
          'Drop where you are watching from in the live chat so we can shout you out on stage.',
          'Use Edit or open AI Media to turn any PDF slide deck into live talking points.',
        ];
  }, [script]);

  const currentSlideCue: SlideAiCue | undefined = useMemo(() => {
    if (!activeMedia?.slideCues || activeMedia.kind !== 'pdf') return undefined;
    return activeMedia.slideCues.find((c) => c.pageNumber === activeMedia.currentPage);
  }, [activeMedia]);

  // Smooth WPM auto-scroll when playing (and not in edit mode)
  useEffect(() => {
    if (!visible || !isPlaying || editing) return;
    let rafId = 0;
    let lastTs = performance.now();

    const step = (now: number) => {
      const dtSec = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      const el = scrollRef.current;
      if (el) {
        const pxPerSec = (wpm / 140) * (fontSize * 1.15);
        el.scrollTop += pxPerSec * dtSec;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          setIsPlaying(false);
          return;
        }
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [visible, isPlaying, editing, wpm, fontSize]);

  // Voice-Follow auto-scroll via Web Speech API
  useEffect(() => {
    if (!visible || !voiceFollow || editing) return;
    interface SpeechRecLike {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    }
    type SpeechRecCtor = new () => SpeechRecLike;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecCtor;
      webkitSpeechRecognition?: SpeechRecCtor;
    };
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceFollow(false);
      return;
    }

    let active = true;
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (ev) => {
      let transcript = '';
      for (let i = Math.max(0, ev.results.length - 2); i < ev.results.length; i++) {
        transcript += ' ' + ev.results[i][0].transcript;
      }
      const cleanWords = transcript
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length >= 3)
        .slice(-6);

      if (cleanWords.length === 0) return;
      setHeardSnippet(cleanWords.slice(-4).join(' '));

      let bestIdx = -1;
      let bestScore = 0;
      lines.forEach((line, idx) => {
        const lower = line.toLowerCase();
        let hits = 0;
        for (const word of cleanWords) {
          if (lower.includes(word)) hits += 1;
        }
        const proximityBonus = idx >= activeLineIdx && idx <= activeLineIdx + 4 ? 0.5 : 0;
        const score = hits + proximityBonus;
        if (hits >= 2 && score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      });

      if (bestIdx >= 0) {
        setActiveLineIdx(bestIdx);
        const targetEl = lineRefs.current[bestIdx];
        const container = scrollRef.current;
        if (targetEl && container) {
          const targetTop = Math.max(0, targetEl.offsetTop - container.clientHeight * 0.28);
          container.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      }
    };

    rec.onend = () => {
      if (active) {
        try {
          rec.start();
        } catch {
          // ignore
        }
      }
    };

    try {
      rec.start();
    } catch {
      // ignore
    }

    return () => {
      active = false;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    };
  }, [visible, voiceFollow, editing, lines, activeLineIdx]);

  if (!visible) return null;

  const resetScroll = () => {
    setIsPlaying(false);
    setActiveLineIdx(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-[680px] rounded-[14px] gather-glass-elevated animate-gather-panel overflow-hidden select-none"
      aria-label="Host Eye-Line Teleprompter"
    >
      {/* Top Control Bar — positioned cleanly at camera lens eye-line */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-[var(--line)] bg-[var(--fill)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display text-[12px] font-bold tracking-tight text-[var(--ink)] whitespace-nowrap shrink-0">
            Eye-Line Prompter
          </span>
          <span className="text-[var(--ink-3)]" aria-hidden="true">
            ·
          </span>
          <span className="text-[11px] text-[var(--ink-3)] whitespace-nowrap shrink-0">
            Host only
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setIsPlaying((p) => !p);
            }}
            className={`h-7 px-2.5 rounded-[7px] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              isPlaying
                ? 'bg-[var(--warn)] text-slate-950'
                : 'gather-btn-primary text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isPlaying ? 'Pause' : 'Scroll'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setVoiceFollow((v) => !v);
            }}
            title="Auto-scroll script as you speak"
            className={`h-7 px-2.5 rounded-[7px] text-[11px] font-semibold border inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              voiceFollow
                ? 'bg-[var(--ok)]/18 border-[var(--ok)]/45 text-[var(--ok)]'
                : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--line-2)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            <Mic className="w-3 h-3" />
            <span>Voice Sync</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 h-7 px-2.5 rounded-[7px] bg-[var(--fill)] border border-[var(--line)]">
            <input
              type="range"
              min={90}
              max={240}
              step={5}
              value={wpm}
              onChange={(e) => setWpm(Number(e.target.value))}
              className="w-14 gather-range"
              aria-label="Words per minute speed"
            />
            <span className="text-[10.5px] font-mono-num text-[var(--ink-2)] whitespace-nowrap shrink-0">
              {wpm} WPM
            </span>
          </div>

          <button
            type="button"
            onClick={() => setFontSize((f) => (f === 18 ? 22 : f === 22 ? 26 : 18))}
            className="h-7 px-2 rounded-[7px] text-[11px] font-mono-num bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
            title="Cycle font size"
          >
            {fontSize}px
          </button>

          <button
            type="button"
            onClick={resetScroll}
            className="h-7 w-7 grid place-items-center rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            title="Rewind to top"
            aria-label="Rewind teleprompter"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setEditing((e) => !e);
            }}
            className={`h-7 w-7 grid place-items-center rounded-[7px] border transition-colors cursor-pointer ${
              editing
                ? 'bg-[var(--accent)] border-[var(--accent-line)] text-white'
                : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
            title="Edit script"
            aria-label="Edit teleprompter script"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          {onOpenAiDrawer && (
            <button
              type="button"
              onClick={onOpenAiDrawer}
              className="h-7 w-7 grid place-items-center rounded-[7px] bg-[var(--accent-soft)] hover:bg-[var(--accent)]/25 border border-[var(--accent-line)] text-[var(--accent-text)] transition-colors cursor-pointer"
              title="Open AI PDF & Script Studio"
              aria-label="Open AI PDF and Script Studio"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 grid place-items-center rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            title="Hide Teleprompter"
            aria-label="Hide Teleprompter"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Script Body */}
      {editing ? (
        <div className="p-3 bg-[var(--surface)]">
          <textarea
            value={script}
            onChange={(e) => onScriptChange(e.target.value)}
            rows={4}
            placeholder="Type or paste your broadcast script, or generate talking points from a PDF deck..."
            className="w-full rounded-[10px] bg-[var(--bg)]/70 border border-[var(--line-2)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)] resize-y"
          />
        </div>
      ) : (
        <div className="relative bg-[var(--bg)]/55">
          {/* Subtle Eye-Line Reading Band */}
          <div className="pointer-events-none absolute inset-x-3 top-3.5 h-10 rounded-[8px] bg-[var(--accent-soft)]/55 border border-[var(--accent-line)]/40" />
          <div
            ref={scrollRef}
            className="relative max-h-36 overflow-y-auto px-5 py-3.5 space-y-2.5 scroll-smooth gather-scroll"
          >
            {lines.map((line, idx) => {
              const isCurrent = voiceFollow && idx === activeLineIdx;
              return (
                <p
                  key={idx}
                  ref={(el) => {
                    lineRefs.current[idx] = el;
                  }}
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.44 }}
                  className={`font-display font-semibold tracking-tight transition-opacity ${
                    isCurrent
                      ? 'text-[var(--ink)] opacity-100'
                      : voiceFollow && idx < activeLineIdx
                        ? 'text-[var(--ink-3)] opacity-45'
                        : 'text-[var(--ink)] opacity-95'
                  }`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional Slide Cue Footer when AI PDF Slide Deck or Voice Tracking is active */}
      {(currentSlideCue || (voiceFollow && heardSnippet)) && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-[var(--line)] bg-[var(--surface)] text-[11px]">
          {currentSlideCue ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono-num font-semibold text-[var(--cyan)] whitespace-nowrap shrink-0">
                  Slide {currentSlideCue.pageNumber}/{activeMedia?.totalPages || 1}
                </span>
                <span className="text-[var(--ink-3)]" aria-hidden="true">
                  ·
                </span>
                <span className="text-[var(--ink-2)] truncate">{currentSlideCue.slideTitle}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {activeMedia && onSelectSlide && (
                  <>
                    <button
                      type="button"
                      disabled={activeMedia.currentPage <= 1}
                      onClick={() => onSelectSlide(Math.max(0, activeMedia.currentPage - 2))}
                      className="h-6 w-6 grid place-items-center rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[var(--ink-2)] disabled:opacity-35 cursor-pointer"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={activeMedia.currentPage >= activeMedia.totalPages}
                      onClick={() =>
                        onSelectSlide(
                          Math.min(activeMedia.totalPages - 1, activeMedia.currentPage)
                        )
                      }
                      className="h-6 w-6 grid place-items-center rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[var(--ink-2)] disabled:opacity-35 cursor-pointer"
                      aria-label="Next slide"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {onPushBanner && currentSlideCue.suggestedBannerTitle && (
                  <button
                    type="button"
                    onClick={() =>
                      onPushBanner(
                        currentSlideCue.suggestedBannerTitle,
                        currentSlideCue.suggestedBannerSub || ''
                      )
                    }
                    className="h-6 px-2.5 rounded-[6px] gather-btn-primary text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Tv className="w-3 h-3" />
                    <span>Push Banner</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-[var(--ok)] truncate">
              <Mic className="w-3 h-3 shrink-0" />
              <span className="truncate">Tracking voice: “{heardSnippet}”</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
