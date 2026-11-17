import React from 'react';
import {
  Command,
  Eye,
  HelpCircle,
  LogIn,
  Moon,
  Radio,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Sun,
  UserPlus,
} from 'lucide-react';
import { ConnectionState } from '../hooks/useStudioSocket';
import { WatchMode } from '../types/studio';
import { GatherLogo } from './GatherLogo';

export interface AuthUserSummary {
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
}

interface TopBarProps {
  mode: 'landing' | 'studio' | 'watch';
  studioTitle?: string;
  connState?: ConnectionState;
  isLive?: boolean;
  isRecording?: boolean;
  recordingSec?: number;
  watchMode?: WatchMode;
  viewerCount?: number;
  bagCount?: number;
  theme: 'dark' | 'light';
  user?: AuthUserSummary | null;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onCreateStudio?: () => void;
  onOpenSchedule?: () => void;
  onOpenWatchDemo?: (mode: WatchMode) => void;
  onOpenWatchPreview?: () => void;
  onExitWatchPreview?: () => void;
  onOpenInvite?: () => void;
  onOpenGoLive?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenBag?: () => void;
  onOpenAuth?: () => void;
  onLeaveWatch?: () => void;
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  studioTitle,
  connState = 'offline',
  isLive = false,
  isRecording = false,
  recordingSec = 0,
  watchMode = 'standard',
  viewerCount = 0,
  bagCount = 0,
  theme,
  user = null,
  onToggleTheme,
  onGoHome,
  onCreateStudio,
  onOpenSchedule,
  onOpenWatchDemo,
  onOpenWatchPreview,
  onExitWatchPreview,
  onOpenInvite,
  onOpenGoLive,
  onOpenSettings,
  onOpenHelp,
  onOpenCommandPalette,
  onOpenBag,
  onOpenAuth,
  onLeaveWatch,
}) => {
  const shortName = user?.displayName?.trim().split(/\s+/)[0] || 'Account';

  const hdrBtn =
    'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[9px] border border-[var(--glass-border)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[13px] font-semibold text-[var(--ink)] whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const hdrIconBtn =
    'h-9 w-9 grid place-items-center rounded-[9px] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  const accountButton = onOpenAuth ? (
    <button
      type="button"
      onClick={onOpenAuth}
      aria-label={user ? 'Creator account and payouts' : 'Sign in with Google'}
      className={`${hdrBtn} ${user ? 'pl-1.5 pr-3' : ''}`}
    >
      {user ? (
        <>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={shortName}
              referrerPolicy="no-referrer"
              className="w-6 h-6 rounded-full object-cover shrink-0"
            />
          ) : (
            <span className="w-6 h-6 rounded-full gather-btn-primary text-white text-[11px] font-display font-bold grid place-items-center shrink-0">
              {shortName[0]?.toUpperCase() || 'G'}
            </span>
          )}
          <span className="hidden sm:inline max-w-[92px] truncate">{shortName}</span>
        </>
      ) : (
        <>
          <LogIn className="w-3.5 h-3.5 text-[var(--ink-2)]" />
          <span>Sign in</span>
        </>
      )}
    </button>
  ) : null;

  return (
    <header className="h-[56px] shrink-0 flex items-center justify-between gap-8 px-4 sm:px-5 gather-glass rounded-[12px]">
      {/* Zone 1: Original Gather Trefoil Mark + Wordmark */}
      <button
        type="button"
        onClick={onGoHome}
        className="inline-flex items-center gap-2.5 font-display text-[25px] font-extrabold leading-none tracking-[-0.055em] text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[6px] py-1"
        aria-label="gather home"
      >
        <GatherLogo size={26} />
        <span>
          gather<span className="text-[var(--accent)] ml-[1px]">.</span>
        </span>
      </button>

      {/* Zone 2: Single-Line Navigation or Unboxed Studio/Watch Breadcrumb */}
      {mode === 'landing' && (
        <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[var(--ink-2)]">
          <button
            type="button"
            onClick={() => onOpenWatchDemo?.('standard')}
            className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Broadcast
          </button>
          <button
            type="button"
            onClick={() => onOpenWatchDemo?.('shop')}
            className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Live Shop
          </button>
          <button
            type="button"
            onClick={() => onOpenWatchDemo?.('gamer')}
            className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Gamer Arena
          </button>
          <button
            type="button"
            onClick={onOpenSchedule}
            className="hover:text-[var(--ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Schedule
          </button>
        </nav>
      )}

      {mode === 'studio' && (
        <div className="hidden md:flex items-center gap-2.5 min-w-0 pl-4 border-l border-[var(--line)] h-7 text-[13px]">
          <strong className="font-semibold text-[var(--ink)] truncate max-w-[240px]">
            {studioTitle || 'Gather Studio'}
          </strong>
          <span className="text-[var(--ink-3)]" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-[var(--ink-2)] whitespace-nowrap">
            {watchMode === 'shop'
              ? 'Live Shop'
              : watchMode === 'gamer'
              ? 'Gaming Arena'
              : 'Broadcast'}
          </span>
          <span className="text-[var(--ink-3)]" aria-hidden="true">
            ·
          </span>
          <span className="text-xs font-mono-num text-[var(--ink-3)] whitespace-nowrap">
            {connState === 'online' ? `${viewerCount} watching` : 'Syncing'}
          </span>
          {isRecording && (
            <>
              <span className="text-[var(--ink-3)]" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-mono-num font-semibold text-[var(--live)] whitespace-nowrap">
                REC {formatTimer(recordingSec)}
              </span>
            </>
          )}
        </div>
      )}

      {mode === 'watch' && (
        <div className="hidden md:flex items-center gap-2.5 min-w-0 pl-4 border-l border-[var(--line)] h-7 text-[13px]">
          <strong className="font-semibold text-[var(--ink)] truncate max-w-[260px]">
            {studioTitle || 'Live Broadcast'}
          </strong>
          <span className="text-[var(--ink-3)]" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-[var(--ink-2)] whitespace-nowrap">
            {watchMode === 'shop'
              ? 'Live Shop'
              : watchMode === 'gamer'
              ? 'Gaming Arena'
              : 'Broadcast'}
          </span>
          <span className="text-[var(--ink-3)]" aria-hidden="true">
            ·
          </span>
          <span className="text-xs font-mono-num text-[var(--ink-3)] whitespace-nowrap">
            {isLive ? 'On Air' : 'Preview'} · {viewerCount} watching
          </span>
        </div>
      )}

      {/* Zone 3: Unified Header Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {mode === 'landing' && (
          <>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle color theme"
              className={hdrIconBtn}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenHelp}
              aria-label="Help and shortcuts"
              className={hdrIconBtn}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            {accountButton}
            <button
              type="button"
              onClick={onCreateStudio}
              className="inline-flex items-center justify-center h-9 px-4 rounded-[9px] gather-btn-primary text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Launch Free Studio
            </button>
          </>
        )}

        {mode === 'studio' && (
          <>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              title="Command palette (Cmd/Ctrl + K)"
              aria-label="Command palette"
              className={`hidden sm:inline-flex ${hdrBtn} px-2.5`}
            >
              <Command className="w-3.5 h-3.5 text-[var(--ink-2)]" />
              <span className="font-mono-num text-xs">K</span>
            </button>
            <button
              type="button"
              onClick={onOpenWatchPreview}
              aria-label="Watch Page"
              className={hdrBtn}
            >
              <Eye className="w-3.5 h-3.5 text-[var(--ink-2)]" />
              <span className="hidden sm:inline">Watch Page</span>
            </button>
            <button
              type="button"
              onClick={onOpenInvite}
              aria-label="Invite guests or viewers"
              className={hdrBtn}
            >
              <UserPlus className="w-3.5 h-3.5 text-[var(--ink-2)]" />
              <span className="hidden sm:inline">Invite</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Studio settings"
              className={hdrIconBtn}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenHelp}
              aria-label="Studio help"
              className={`hidden sm:grid ${hdrIconBtn}`}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            {accountButton}
            <button
              type="button"
              onClick={onOpenGoLive}
              className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[9px] text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                isLive ? 'gather-btn-live' : 'gather-btn-primary'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isLive ? 'On Air' : 'Go Live'}</span>
            </button>
          </>
        )}

        {mode === 'watch' && (
          <>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle color theme"
              className={hdrIconBtn}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {onOpenHelp && (
              <button
                type="button"
                onClick={onOpenHelp}
                aria-label="Studio guide"
                className={`hidden sm:grid ${hdrIconBtn}`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
            {accountButton}
            {onExitWatchPreview ? (
              <button type="button" onClick={onExitWatchPreview} className={hdrBtn}>
                <Settings className="w-3.5 h-3.5 text-[var(--ink-2)]" />
                <span>Back to Studio</span>
              </button>
            ) : (
              onLeaveWatch && (
                <button type="button" onClick={onLeaveWatch} className={hdrBtn}>
                  <span>Exit Watch</span>
                </button>
              )
            )}
            {/* Strictly render Express Bag button ONLY on Live Shop streams */}
            {watchMode === 'shop' && onOpenBag && (
              <button
                type="button"
                onClick={onOpenBag}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[9px] gather-btn-primary text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="font-mono-num">Bag ({bagCount})</span>
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
};
