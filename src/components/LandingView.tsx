import React, { useState } from 'react';
import { ArrowUpRight, Calendar, Check, CreditCard, Sparkles, Trash2 } from 'lucide-react';
import { ScheduledShow, WatchMode } from '../types/studio';
import { GatherLogo } from './GatherLogo';

interface LandingViewProps {
  scheduledShows: ScheduledShow[];
  isSignedIn?: boolean;
  userName?: string | null;
  onCreateStudio: (initialFormat?: WatchMode) => void;
  onJoinCode: (codeOrUrl: string) => void;
  onOpenWatchDemo: (mode: WatchMode) => void;
  onOpenSchedule: () => void;
  onOpenAuth?: () => void;
  onLaunchScheduled: (show: ScheduledShow) => void;
  onDeleteScheduled: (id: string) => void;
}

type StageSceneDemo = 'duo' | 'solo' | 'pip';

export const LandingView: React.FC<LandingViewProps> = ({
  scheduledShows,
  isSignedIn = false,
  userName,
  onCreateStudio,
  onJoinCode,
  onOpenWatchDemo,
  onOpenSchedule,
  onOpenAuth,
  onLaunchScheduled,
  onDeleteScheduled,
}) => {
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [previewMode, setPreviewMode] = useState<WatchMode>('standard');
  const [stageLayout, setStageLayout] = useState<StageSceneDemo>('duo');
  const [previewTipAmount, setPreviewTipAmount] = useState<number>(10);
  const [previewTipSent, setPreviewTipSent] = useState(false);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinInput.trim();
    if (!trimmed) {
      setJoinError('Paste an invite link or enter a room code.');
      return;
    }
    setJoinError('');
    onJoinCode(trimmed);
  };

  return (
    <main className="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto gather-scroll animate-gather-panel">
      <div className="flex-1 min-h-0 flex items-center justify-center py-6">
        <div className="w-[92%] max-w-[1320px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] gap-10 lg:gap-16 items-center">
          {/* Left Column: Gather v5 Minimal Architectural Hero */}
          <div className="flex flex-col items-start gap-6">
            <div className="flex items-center gap-3.5">
              <GatherLogo
                size={44}
                className="drop-shadow-[0_14px_28px_rgba(47,107,240,0.38)] shrink-0"
              />
              <div className="text-[12px] font-medium text-[var(--ink-2)] tracking-[-0.01em]">
                <span>100% Free</span>
                <span className="mx-2 text-[var(--line-2)]" aria-hidden="true">
                  ·
                </span>
                <span>0% Platform Cut</span>
                <span className="mx-2 text-[var(--line-2)]" aria-hidden="true">
                  ·
                </span>
                <span className="text-[var(--ink-3)]">Made in Texas</span>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-[clamp(38px,4.4vw,60px)] font-extrabold leading-[1.01] tracking-[-0.045em] text-[var(--ink)] max-w-[13ch] text-balance">
                Your show, live from{' '}
                <span className="gather-gradient-text">the browser.</span>
              </h1>

              <p className="text-[16px] leading-[1.6] text-[var(--ink-2)] max-w-[44ch]">
                Six-speaker 1080p studio, 8-platform simulcast, AI showrunner, and 0%-fee in-chat
                support — engineered without paywalls or redirects.
              </p>
            </div>

            {/* Primary Action + Invite Join */}
            <div className="w-full max-w-[520px] space-y-2.5">
              <div className="flex flex-wrap gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => onCreateStudio(previewMode)}
                  className="h-[46px] px-6 rounded-[12px] gather-btn-primary text-[14px] font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  Create a free studio
                </button>

                <form onSubmit={handleJoinSubmit} className="flex flex-1 min-w-[230px] gap-2">
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="Paste invite link or room code"
                    aria-label="Invite link or studio code"
                    spellCheck={false}
                    className="flex-1 min-w-0 h-[46px] px-4 rounded-[12px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <button
                    type="submit"
                    className="h-[46px] px-5 rounded-[12px] gather-glass hover:bg-[var(--fill-hover)] text-[13px] font-semibold text-[var(--ink)] whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    Join
                  </button>
                </form>
              </div>
              {joinError && <p className="text-xs text-[var(--danger)]">{joinError}</p>}
            </div>

            {/* Quiet Navigation Links */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]">
              <button
                type="button"
                onClick={onOpenSchedule}
                className="inline-flex items-center gap-1.5 text-[var(--cyan)] hover:underline underline-offset-4 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule</span>
              </button>
              <span className="text-[var(--line-2)]" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => onOpenWatchDemo('standard')}
                className="text-[var(--ink-2)] hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Broadcast Watch
              </button>
              <span className="text-[var(--line-2)]" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => onOpenWatchDemo('shop')}
                className="text-[var(--ink-2)] hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Live Shop
              </button>
              <span className="text-[var(--line-2)]" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => onOpenWatchDemo('gamer')}
                className="text-[var(--ink-2)] hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Gaming Arena
              </button>
              {onOpenAuth && (
                <>
                  <span className="text-[var(--line-2)]" aria-hidden="true">
                    /
                  </span>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="text-[var(--ink-2)] hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isSignedIn && userName ? userName.split(' ')[0] : 'Sign in'}
                  </button>
                </>
              )}
            </div>

            {scheduledShows.length > 0 && (
              <div className="w-full max-w-[520px] flex flex-wrap gap-2">
                {scheduledShows.slice(0, 2).map((show) => (
                  <div
                    key={show.id}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-[9px] gather-glass text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => onLaunchScheduled(show)}
                      className="font-semibold text-[var(--accent-text)] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      {show.title} ({show.date})
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteScheduled(show.id)}
                      aria-label="Remove scheduled show"
                      className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Quiet Unboxed Spec Strip */}
            <div className="w-full max-w-[520px] pt-4 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-4 text-[12px] text-[var(--ink-3)]">
              <div className="flex items-baseline gap-2">
                <span className="font-mono-num font-bold text-[var(--ink)]">8×</span>
                <span>Simulcast Free</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono-num font-bold text-[var(--ok)]">0%</span>
                <span>In-Chat Fee</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono-num font-bold text-[var(--cyan)]">1080p</span>
                <span>WebRTC + WAV Bus</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Gather v5 Architectural Stage Showcase */}
          <div className="relative flex flex-col gap-3 w-full">
            <div
              className="pointer-events-none absolute -inset-6 rounded-[32px] opacity-70 blur-3xl"
              aria-hidden="true"
              style={{
                background:
                  'radial-gradient(60% 60% at 36% 42%, rgba(47,107,240,0.34), transparent 72%), radial-gradient(50% 50% at 78% 64%, rgba(56,189,248,0.22), transparent 72%)',
              }}
            />

            <div className="relative aspect-video rounded-[18px] overflow-hidden gather-glass-elevated bg-[#070f23] flex flex-col justify-between p-3.5">
              {/* Top Stage Chrome: Live Tally + Scene Switcher */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 rounded-[9px] bg-black/55 backdrop-blur-xl border border-white/12">
                  {(
                    [
                      { id: 'duo', label: 'Split Duo' },
                      { id: 'solo', label: 'Solo' },
                      { id: 'pip', label: 'Keynote PIP' },
                    ] as Array<{ id: StageSceneDemo; label: string }>
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setStageLayout(sc.id)}
                      className={`h-6 px-2.5 rounded-[6px] text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        stageLayout === sc.id
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 px-2.5 py-1 rounded-[8px] bg-black/60 backdrop-blur-xl border border-white/14 text-[11px] font-mono-num text-white shrink-0">
                  <span className="text-[#fb7185] font-bold">LIVE</span>
                  <span className="text-white/40">·</span>
                  <span>248 watching</span>
                </div>
              </div>

              {/* Center Stage Geometry (Responsive % Grid, Zero Overlap) */}
              <div className="relative flex-1 min-h-0 my-2.5 grid grid-cols-1 sm:grid-cols-[1.28fr_0.98fr] gap-3">
                {/* Main Stage Canvas Area */}
                <div
                  className={`relative rounded-[12px] overflow-hidden bg-[#101b3a] border border-white/12 ${
                    stageLayout === 'duo' ? 'grid grid-cols-2 gap-1.5 p-1.5' : ''
                  }`}
                >
                  {stageLayout === 'duo' && (
                    <>
                      <div className="relative rounded-[9px] overflow-hidden">
                        <img
                          src="/src/assets/images/host_maya_studio_1794840297410.jpg"
                          alt="Maya Chen hosting live"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                        <span className="absolute left-2 bottom-2 px-2 py-0.5 rounded-[5px] bg-black/65 backdrop-blur-md text-[10.5px] font-semibold text-white">
                          Maya Chen
                        </span>
                      </div>
                      <div className="relative rounded-[9px] overflow-hidden">
                        <img
                          src="/src/assets/images/host_jordan_studio_1794840296850.jpg"
                          alt="Jordan Lee co-hosting"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                        <span className="absolute left-2 bottom-2 px-2 py-0.5 rounded-[5px] bg-black/65 backdrop-blur-md text-[10.5px] font-semibold text-white">
                          Jordan Lee
                        </span>
                      </div>
                    </>
                  )}

                  {stageLayout === 'solo' && (
                    <>
                      <img
                        src="/src/assets/images/host_maya_studio_1794840297410.jpg"
                        alt="Maya Chen solo spotlight"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-transparent to-transparent" />
                      <span className="absolute left-2.5 bottom-2.5 px-2.5 py-0.5 rounded-[6px] bg-black/65 backdrop-blur-md border border-white/12 text-[11px] font-semibold text-white">
                        Maya Chen · Host
                      </span>
                    </>
                  )}

                  {stageLayout === 'pip' && (
                    <div className="relative w-full h-full bg-gradient-to-br from-[#0f1f44] to-[#0a132c] p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[10px] font-mono-num text-[#7dd3fc]">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>KEYNOTE DECK · SLIDE 04</span>
                        </span>
                        <span className="text-white/60">1080p60</span>
                      </div>
                      <div className="space-y-1.5 pr-[36%]">
                        <div className="text-xs font-display font-bold text-white leading-snug">
                          Direct Creator Economy
                        </div>
                        <div className="text-[11px] text-white/70 leading-snug">
                          0% platform cut across Express Pay, Shop Drops &amp; Audio RSS.
                        </div>
                      </div>
                      <div className="h-1.5 w-[55%] rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full w-[72%] bg-[var(--accent)]" />
                      </div>
                      <div className="absolute right-2.5 bottom-2.5 w-[33%] aspect-video rounded-[8px] overflow-hidden border border-white/20 shadow-lg">
                        <img
                          src="/src/assets/images/host_maya_studio_1794840297410.jpg"
                          alt="Host picture-in-picture"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Pane: Format-Optimized Interactive Card */}
                {previewMode === 'standard' && (
                  <div className="rounded-[12px] gather-pay-card p-3 flex flex-col justify-between text-white">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono-num text-[#7dd3fc]">
                        <span>Live Chat · Direct Pay</span>
                        <span className="text-[#34d399]">0% fee</span>
                      </div>
                      <div className="text-xs font-semibold leading-snug">
                        Support Maya without leaving
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        {[5, 10, 25].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setPreviewTipAmount(amt);
                              setPreviewTipSent(false);
                            }}
                            className={`h-7 rounded-[7px] text-xs font-mono-num font-bold transition-colors cursor-pointer ${
                              previewTipAmount === amt
                                ? 'gather-btn-primary'
                                : 'bg-white/8 hover:bg-white/14 text-white/85 border border-white/12'
                            }`}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPreviewTipSent(true)}
                        className="w-full h-8 rounded-[8px] gather-btn-tip text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        {previewTipSent ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Sent ${previewTipAmount} in Chat</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay ${previewTipAmount} Direct</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-[10px] font-mono-num text-white/60 flex items-center justify-between">
                      <span>Apple Pay · Venmo · PayPal</span>
                      <span>No redirects</span>
                    </div>
                  </div>
                )}

                {previewMode === 'shop' && (
                  <div className="relative rounded-[12px] overflow-hidden bg-[#0c152c]/95 backdrop-blur-md border border-white/14 flex flex-col">
                    <div className="flex-1 min-h-0 relative">
                      <img
                        src="/src/assets/images/product_ceramic_mug_1794839256911.jpg"
                        alt="Cobalt Glaze Pour-Over Mug"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0c152c] via-transparent to-transparent" />
                    </div>
                    <div className="p-3 bg-[#0c152c] space-y-1">
                      <div className="text-[10px] font-mono-num text-[#7dd3fc]">
                        Lookbook 01 · 14 left
                      </div>
                      <div className="text-xs font-semibold text-white truncate">
                        Cobalt Glaze Pour-Over Mug
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-xs font-bold font-mono-num text-white">$38.00</span>
                        <span className="text-[11px] font-semibold text-[#34d399]">
                          1-Click Claim
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {previewMode === 'gamer' && (
                  <div className="relative rounded-[12px] overflow-hidden bg-[#0c152c]/95 backdrop-blur-md border border-white/14 p-3.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono-num text-[#7dd3fc]">
                        Ascent · BO3 1–0
                      </div>
                      <div className="text-xs font-semibold text-white">
                        Next map challenge?
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-white/90">
                          <span>Ascent · Sheriff</span>
                          <span className="font-mono-num">64%</span>
                        </div>
                        <div className="h-1.5 rounded-sm bg-white/10 overflow-hidden">
                          <div className="h-full w-[64%] bg-[var(--accent)]" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-white/75">
                          <span>Bind · Rush A</span>
                          <span className="font-mono-num">36%</span>
                        </div>
                        <div className="h-1.5 rounded-sm bg-white/10 overflow-hidden">
                          <div className="h-full w-[36%] bg-white/30" />
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono-num text-white/60">
                      Squad queue · 2 ready
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Stage Lower-Third Banner (In-Flow, Zero Overlap) */}
              <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="px-3 py-1.5 rounded-[9px] bg-white/95 backdrop-blur-xl text-[#0b1020] shadow-lg flex items-center gap-2.5 max-w-full">
                  <GatherLogo size={18} />
                  <div className="min-w-0">
                    <div className="font-display font-bold text-[12px] leading-tight truncate">
                      {previewMode === 'shop'
                        ? 'Studio Ceramic & Audio Live Drop'
                        : previewMode === 'gamer'
                        ? 'Valorant · Ranked Squad Co-Stream'
                        : 'Gather Keynote · Zero-Fee Studio'}
                    </div>
                    <div className="text-[10.5px] text-[#475569] truncate">
                      {previewMode === 'shop'
                        ? 'Editorial Lookbook + Flash Drop Volume Bundles'
                        : previewMode === 'gamer'
                        ? 'Live Predictions, Squad Roles & 30s Replay Clips'
                        : 'Live Captions, Upvoted Q&A & Direct Chat Support'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Format Switcher Bar */}
            <div className="relative flex flex-wrap items-center justify-between gap-3 px-0.5">
              <div className="gather-seg" role="tablist" aria-label="Watch Page format previews">
                {(
                  [
                    { id: 'standard', label: 'Broadcast' },
                    { id: 'shop', label: 'Live Shop' },
                    { id: 'gamer', label: 'Gaming Arena' },
                  ] as Array<{ id: WatchMode; label: string }>
                ).map((item) => {
                  const active = previewMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPreviewMode(item.id)}
                      className={`gather-seg-btn ${active ? 'active' : ''}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onOpenWatchDemo(previewMode)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>
                  {previewMode === 'standard'
                    ? 'Open Broadcast Watch'
                    : previewMode === 'shop'
                    ? 'Open Live Shop Watch'
                    : 'Open Gaming Arena'}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quiet Unboxed Index Footer */}
      <footer className="w-[92%] max-w-[1320px] mx-auto pb-3 pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ink-3)]">
        <div>
          <span className="font-display font-bold text-[var(--ink-2)]">gather.</span>
          <span className="mx-2 text-[var(--line-2)]" aria-hidden="true">
            ·
          </span>
          <span>100% Free</span>
          <span className="mx-2 text-[var(--line-2)]" aria-hidden="true">
            ·
          </span>
          <span>No redirects · Direct creator payouts</span>
        </div>
        <div className="font-semibold text-[var(--ink-2)]">Made in Texas</div>
      </footer>
    </main>
  );
};
