import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Command,
  Copy,
  DollarSign,
  Download,
  Eye,
  Gamepad2,
  Keyboard,
  Layers,
  Mail,
  Radio,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { DEFAULT_VIDEO_FX } from '../constants/studioDefaults';
import { GatherLogo } from './GatherLogo';
import {
  AspectRatio,
  DestinationConfig,
  RoomState,
  ScheduledShow,
  VideoFxSettings,
  WatchMode,
} from '../types/studio';

export const InviteModal: React.FC<{
  open: boolean;
  roomCode: string;
  watchMode?: WatchMode;
  onClose: () => void;
  onOpenWatchPreview: () => void;
}> = ({ open, roomCode, watchMode = 'standard', onClose, onOpenWatchPreview }) => {
  const [copied, setCopied] = useState<string | null>(null);
  if (!open) return null;

  const guestUrl = `${window.location.origin}/?join=${roomCode}`;
  const watchUrl = `${window.location.origin}/?watch=${roomCode}`;

  const copyText = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const watchLabel =
    watchMode === 'shop'
      ? 'Live Shop Watch Page Link'
      : watchMode === 'gamer'
      ? 'Gaming Arena Watch Page Link'
      : 'Broadcast Watch Page Link';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <GatherLogo size={22} />
            <h2 className="font-display text-[15px] font-bold text-[var(--ink)]">
              Invite Co-Hosts &amp; Share Watch Page
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close invite modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-[var(--line)] space-y-4 text-xs">
          <div className="space-y-1.5">
            <div className="font-semibold text-[var(--ink)]">
              On-Stage Guest Invite (up to 6 speakers)
            </div>
            <p className="text-[11px] text-[var(--ink-3)]">
              Guests join from their browser with zero installs or account fees.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={guestUrl}
                className="flex-1 h-9 px-3 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] font-mono-num text-[11px] text-[var(--ink-2)]"
              />
              <button
                type="button"
                onClick={() => copyText('guest', guestUrl)}
                className="h-9 px-3.5 rounded-[8px] gather-btn-primary font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied === 'guest' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'guest' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 space-y-1.5">
            <div className="font-semibold text-[var(--ink)]">{watchLabel}</div>
            <p className="text-[11px] text-[var(--ink-3)]">
              Viewers watch in HD and send 0%-fee tips directly inside live chat without leaving.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={watchUrl}
                className="flex-1 h-9 px-3 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] font-mono-num text-[11px] text-[var(--ink-2)]"
              />
              <button
                type="button"
                onClick={() => copyText('watch', watchUrl)}
                className="h-9 px-3.5 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[var(--ink)] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied === 'watch' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'watch' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWatchPreview();
              }}
              className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline inline-flex items-center gap-1.5 pt-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview live Watch Page inside Studio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GoLiveModal: React.FC<{
  open: boolean;
  room: RoomState;
  destinations: DestinationConfig[];
  onUpdateDestinations: (dests: DestinationConfig[]) => void;
  onToggleLive: () => void;
  onChangeAspect: (aspect: AspectRatio) => void;
  onChangeWatchMode?: (mode: WatchMode) => void;
  onNotifySubscribers?: () => void;
  onClose: () => void;
}> = ({
  open,
  room,
  destinations,
  onUpdateDestinations,
  onToggleLive,
  onChangeAspect,
  onChangeWatchMode,
  onNotifySubscribers,
  onClose,
}) => {
  if (!open) return null;

  const enabledCount = destinations.filter((d) => d.enabled).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[580px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <GatherLogo size={24} />
            <div>
              <h2 className="font-display text-[15px] font-bold text-[var(--ink)]">
                Go Live &amp; Free 8-Platform Simulcast
              </h2>
              <p className="text-[11px] text-[var(--ink-3)] font-mono-num mt-0.5">
                $0/mo unlimited multi-streaming · Gather Watch Page always active
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Go Live modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Watch Format + Aspect Ratio Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {onChangeWatchMode && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--ink-2)] block">
                Watch Page Format
              </span>
              <div className="gather-seg w-full grid grid-cols-3">
                {(
                  [
                    { id: 'standard', label: 'Broadcast' },
                    { id: 'shop', label: 'Shop' },
                    { id: 'gamer', label: 'Gaming' },
                  ] as Array<{ id: WatchMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-selected={room.watchMode === m.id}
                    onClick={() => onChangeWatchMode(m.id)}
                    className={`gather-seg-btn h-7 text-[11px] ${
                      room.watchMode === m.id ? 'active' : ''
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--ink-2)] block">Stage Aspect</span>
            <div className="gather-seg w-full grid grid-cols-2">
              {(['16:9', '9:16'] as AspectRatio[]).map((ar) => (
                <button
                  key={ar}
                  type="button"
                  aria-selected={room.aspectRatio === ar}
                  onClick={() => onChangeAspect(ar)}
                  className={`gather-seg-btn h-7 text-[11px] ${
                    room.aspectRatio === ar ? 'active' : ''
                  }`}
                >
                  {ar === '16:9' ? '16:9 Landscape' : '9:16 Vertical'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 8 Simulcast Destinations */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--ink-2)]">
              Simulcast Destinations (all 8 unlocked free)
            </span>
            <span className="font-mono-num text-[11px] text-[var(--ok)]">
              {enabledCount} external + Gather Watch Page
            </span>
          </div>
          <div className="max-h-[260px] overflow-y-auto gather-scroll pr-1 divide-y divide-[var(--line)] border border-[var(--line)] rounded-[12px] px-3 bg-[var(--fill)]">
            {destinations.map((d) => (
              <div key={d.id} className="py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--ink)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) =>
                        onUpdateDestinations(
                          destinations.map((item) =>
                            item.id === d.id ? { ...item, enabled: e.target.checked } : item
                          )
                        )
                      }
                      className="accent-[var(--accent)]"
                    />
                    <span>{d.label}</span>
                  </label>
                  <span className="text-[10px] font-mono-num text-[var(--ink-3)] uppercase">
                    {d.platform}
                  </span>
                </div>

                {d.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {d.platform === 'custom' && (
                      <input
                        type="url"
                        value={d.rtmpUrl || ''}
                        onChange={(e) =>
                          onUpdateDestinations(
                            destinations.map((item) =>
                              item.id === d.id ? { ...item, rtmpUrl: e.target.value } : item
                            )
                          )
                        }
                        placeholder="rtmp://live.example.com/app"
                        className="w-full h-8 px-2.5 rounded-[7px] bg-[var(--bg)]/70 border border-[var(--line-2)] text-xs text-[var(--ink)]"
                      />
                    )}
                    <input
                      type="password"
                      value={d.streamKey}
                      onChange={(e) =>
                        onUpdateDestinations(
                          destinations.map((item) =>
                            item.id === d.id ? { ...item, streamKey: e.target.value } : item
                          )
                        )
                      }
                      placeholder={`Paste ${d.label} stream key`}
                      className={`w-full h-8 px-2.5 rounded-[7px] bg-[var(--bg)]/70 border border-[var(--line-2)] text-xs text-[var(--ink)] ${
                        d.platform === 'custom' ? '' : 'sm:col-span-2'
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {onNotifySubscribers && (
            <button
              type="button"
              onClick={onNotifySubscribers}
              className="h-10 px-4 rounded-[10px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-xs font-semibold text-[var(--ink)] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>Email Subscribers</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onToggleLive();
              onClose();
            }}
            className={`flex-1 h-10 rounded-[10px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              room.isLive ? 'gather-btn-live' : 'gather-btn-primary'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>{room.isLive ? 'End Live Broadcast' : 'Start Live Broadcast Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const ScheduleModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSaveShow: (show: ScheduledShow, notifySubscribers?: boolean) => void;
}> = ({ open, onClose, onSaveShow }) => {
  const [title, setTitle] = useState('Product Keynote & Live Q&A');
  const [description, setDescription] = useState('Join live on our Gather Watch Page.');
  const [date, setDate] = useState('2026-11-20');
  const [time, setTime] = useState('18:00');
  const [durationMin, setDurationMin] = useState(45);
  const [watchMode, setWatchMode] = useState<WatchMode>('standard');
  const [notifySubscribers, setNotifySubscribers] = useState(true);

  if (!open) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const show: ScheduledShow = {
      id: `show-${Date.now()}`,
      title: title.trim() || 'Scheduled Show',
      description,
      date,
      time,
      durationMin,
      watchMode,
      roomCode,
      invitees: '',
    };
    onSaveShow(show, notifySubscribers);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[490px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <h2 className="font-display text-[15px] font-bold text-[var(--ink)] inline-flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--accent-text)]" />
            <span>Schedule a Broadcast</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close schedule modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <span className="text-[var(--ink-2)] font-medium block">Watch Page Format</span>
            <div className="gather-seg w-full grid grid-cols-3">
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
              ).map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-selected={watchMode === m.id}
                    onClick={() => setWatchMode(m.id)}
                    className={`gather-seg-btn h-8 text-[11px] ${
                      watchMode === m.id ? 'active' : ''
                    }`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[var(--ink-2)] font-medium">Show title</span>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-9 px-3 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[var(--ink-2)] font-medium">Description</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-[var(--ink-2)] font-medium">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 px-2 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[var(--ink)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[var(--ink-2)] font-medium">Time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-9 px-2 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[var(--ink)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[var(--ink-2)] font-medium">Minutes</span>
              <input
                type="number"
                min={15}
                max={240}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full h-9 px-2 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] font-mono-num text-[var(--ink)]"
              />
            </label>
          </div>
          <label className="flex items-center gap-2.5 p-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] cursor-pointer">
            <input
              type="checkbox"
              checked={notifySubscribers}
              onChange={(e) => setNotifySubscribers(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <Mail className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
            <span className="text-[11px] text-[var(--ink-2)]">
              Email subscribed viewers automatically &amp; pin upcoming reminder on Watch Page
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full h-10 rounded-[10px] gather-btn-primary text-xs font-semibold cursor-pointer"
        >
          {notifySubscribers
            ? 'Schedule Broadcast & Email Subscribers'
            : 'Save Scheduled Broadcast'}
        </button>
      </form>
    </div>
  );
};

export const SettingsModal: React.FC<{
  open: boolean;
  theme: 'dark' | 'light';
  videoFx: VideoFxSettings;
  onToggleTheme: () => void;
  onUpdateVideoFx: (fx: VideoFxSettings) => void;
  onClose: () => void;
}> = ({ open, theme, videoFx, onToggleTheme, onUpdateVideoFx, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const bgMode = videoFx.bgMode || (videoFx.blurBg ? 'blur' : 'natural');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <h2 className="font-display text-[15px] font-bold text-[var(--ink)]">Studio Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-[var(--line)] space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-[var(--ink)]">Appearance Theme</div>
              <div className="text-[11px] text-[var(--ink-3)]">
                Switch luminous dark or daylight glass shell
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="h-8 px-3 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] font-semibold text-[var(--ink)] cursor-pointer capitalize"
            >
              {theme} mode
            </button>
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--ink)]">Camera Look &amp; Grading</span>
              <button
                type="button"
                onClick={() => onUpdateVideoFx(DEFAULT_VIDEO_FX)}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
            <div className="gather-seg w-full grid grid-cols-3">
              {(
                [
                  { id: 'natural', label: 'Natural' },
                  { id: 'blur', label: 'Soft Blur' },
                  { id: 'dim', label: 'Studio Dim' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-selected={bgMode === m.id}
                  onClick={() =>
                    onUpdateVideoFx({ ...videoFx, bgMode: m.id, blurBg: m.id === 'blur' })
                  }
                  className={`gather-seg-btn h-7 text-[11px] ${bgMode === m.id ? 'active' : ''}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label className="flex items-center justify-between gap-3">
              <span className="text-[var(--ink-2)]">Brightness</span>
              <input
                type="range"
                min={60}
                max={140}
                value={videoFx.brightness}
                onChange={(e) => onUpdateVideoFx({ ...videoFx, brightness: Number(e.target.value) })}
                className="gather-range w-44"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-[var(--ink-2)]">Contrast</span>
              <input
                type="range"
                min={60}
                max={140}
                value={videoFx.contrast}
                onChange={(e) => onUpdateVideoFx({ ...videoFx, contrast: Number(e.target.value) })}
                className="gather-range w-44"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-[var(--ink-2)]">Saturation</span>
              <input
                type="range"
                min={40}
                max={170}
                value={videoFx.saturation}
                onChange={(e) => onUpdateVideoFx({ ...videoFx, saturation: Number(e.target.value) })}
                className="gather-range w-44"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RecordingModal: React.FC<{
  open: boolean;
  blobUrl: string | null;
  filename: string;
  onClose: () => void;
}> = ({ open, blobUrl, filename, onClose }) => {
  if (!open || !blobUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/72 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[680px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <h2 className="font-display text-[15px] font-bold text-[var(--ink)]">
            Captured Studio Recording / 30s Clip
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recording modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <video
          src={blobUrl}
          controls
          autoPlay
          className="w-full aspect-video rounded-[10px] bg-black border border-[var(--line)]"
        />

        <div className="flex items-center justify-end gap-2">
          <a
            href={blobUrl}
            download={filename}
            className="h-9 px-4 rounded-[9px] gather-btn-primary text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {filename}</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export const ShowNotesModal: React.FC<{
  open: boolean;
  markdown: string;
  loading: boolean;
  onClose: () => void;
}> = ({ open, markdown, loading, onClose }) => {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[600px] rounded-[18px] gather-glass-elevated animate-gather-modal p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <h2 className="font-display text-[15px] font-bold text-[var(--ink)]">
            AI Show Notes &amp; Chapter Timestamps
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close show notes modal"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <p className="text-xs text-[var(--ink-2)] py-8 text-center">
            Synthesizing show notes, chat highlights, and clips…
          </p>
        ) : (
          <>
            <pre className="p-3.5 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] text-xs text-[var(--ink-2)] whitespace-pre-wrap max-h-[340px] overflow-y-auto gather-scroll">
              {markdown}
            </pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(markdown);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="h-9 px-4 rounded-[9px] gather-btn-primary text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Markdown' : 'Copy Markdown'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const CommandPaletteModal: React.FC<{
  open: boolean;
  onClose: () => void;
  actions: Array<{ id: string; label: string; shortcut?: string; run: () => void }>;
}> = ({ open, onClose, actions }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 backdrop-blur-md flex items-start justify-center pt-24 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-[18px] gather-glass-elevated animate-gather-modal overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--line)]">
          <Command className="w-4 h-4 text-[var(--accent-text)]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Run a studio action…"
            className="flex-1 bg-transparent text-sm text-[var(--ink)] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
          >
            Esc
          </button>
        </div>
        <div className="max-h-[300px] overflow-y-auto gather-scroll p-2 space-y-1">
          {filtered.map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => {
                act.run();
                onClose();
              }}
              className="w-full px-3 py-2 rounded-[8px] hover:bg-[var(--fill-hover)] text-left flex items-center justify-between text-xs cursor-pointer"
            >
              <span className="text-[var(--ink)] font-medium">{act.label}</span>
              {act.shortcut && (
                <span className="font-mono-num text-[11px] text-[var(--ink-3)]">
                  {act.shortcut}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const HelpModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const shortcuts = [
    ['Cmd / Ctrl + K', 'Command Palette'],
    ['/', 'Toggle AI Cue Bar'],
    ['S', 'Stingers & Audio FX Deck'],
    ['M', 'Mute / Unmute Mic'],
    ['V', 'Camera On / Off'],
    ['1 – 4', 'Switch Stage Scenes'],
  ];

  const workflows = [
    {
      icon: <DollarSign className="w-3.5 h-3.5 text-[var(--ok)] shrink-0 mt-0.5" />,
      title: 'In-Chat Direct Creator Payments',
      desc: 'Click "Drop Pay Card" in Chat — viewers tip inside live chat via Apple/Google Pay, Card, Venmo, PayPal, or Cash App without leaving.',
    },
    {
      icon: <Layers className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />,
      title: 'Stream-Specific Watch Pages',
      desc: 'Broadcast, Live Shop, and Gaming Arena each render dedicated Watch Pages with zero irrelevant widgets.',
    },
    {
      icon: <Volume2 className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />,
      title: 'Custom Stingers & Master Bus FX',
      desc: 'Upload custom audio drops or record 3s mic stingers — synced live to the Master Audio Bus.',
    },
    {
      icon: <Upload className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />,
      title: 'Custom PNG Overlays, Sponsors & PDFs',
      desc: 'Upload transparent 16:9 PNG frames, sponsor rotators, or drop PDF slides directly onto the stage.',
    },
    {
      icon: <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />,
      title: 'Cue AI & Multi-Language Captions',
      desc: 'Direct scenes, spotlight Q&A, or enable live captions across 10 languages in real time.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[660px] rounded-[18px] gather-glass-elevated animate-gather-modal overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <GatherLogo size={24} />
            <div>
              <h2 className="font-display text-[15px] font-bold text-[var(--ink)] leading-tight">
                Studio Guide &amp; Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                100% Free · Made in Texas · Zero-fee broadcast studio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close studio guide"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)]">
          {/* Left: Shortcuts Matrix */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
              <Keyboard className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>Keyboard Controls</span>
            </div>
            <div className="divide-y divide-[var(--line)] text-xs">
              {shortcuts.map(([k, desc]) => (
                <div key={k} className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[var(--ink-2)]">{desc}</span>
                  <kbd className="font-mono-num text-[11px] px-2 py-0.5 rounded-[5px] bg-[var(--fill)] border border-[var(--line-2)] text-[var(--ink)]">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Key Workflows */}
          <div className="p-5 space-y-3">
            <div className="text-xs font-semibold text-[var(--ink)]">Broadcast Workflows</div>
            <div className="divide-y divide-[var(--line)]">
              {workflows.map((wf) => (
                <div key={wf.title} className="py-2 first:pt-0 last:pb-0 flex items-start gap-2.5">
                  {wf.icon}
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-[var(--ink)]">{wf.title}</div>
                    <p className="text-[11px] leading-relaxed text-[var(--ink-3)]">{wf.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
