import React, { useEffect, useState } from 'react';
import {
  ArrowUp,
  Award,
  Ban,
  BarChart3,
  Captions,
  CheckCircle2,
  Clock,
  CornerUpLeft,
  DollarSign,
  FileText,
  Gamepad2,
  Heart,
  HelpCircle,
  Layers,
  ListChecks,
  Mic,
  Pin,
  Plus,
  QrCode,
  Sparkles,
  Store,
  ThumbsUp,
  Trash2,
  Upload,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import {
  ACCENT_SWATCHES,
  BACKDROP_PRESETS,
  CAPTION_LANGUAGES,
  DEFAULT_BANNER_PRESETS,
  DEFAULT_SPONSORS,
  STAGE_FONTS,
} from '../constants/studioDefaults';
import {
  AILogEntry,
  BackdropId,
  BannerStyle,
  CaptionStyle,
  ChatReplyRef,
  FrameStyle,
  GearSpec,
  NameTagStyle,
  ProductItem,
  ProductSource,
  RoomState,
  RundownStep,
  SponsorBanner,
  StageFont,
  WatchMode,
} from '../types/studio';
import { HoverReactionMenu, ReactionBadgeRow } from './ChatReactions';
import { ComposerShareControl } from './ComposerShareControl';

export type ConsoleTab = 'show' | 'chat' | 'shop' | 'ai' | 'look';

interface RightConsoleProps {
  room: RoomState;
  isHost: boolean;
  actorId?: string;
  open: boolean;
  activeTab: ConsoleTab;
  aiLogs: AILogEntry[];
  aiBusy: boolean;
  aiVoiceReadout: boolean;
  onToggleAiVoiceReadout: () => void;
  onAskAi: (prompt: string) => void;
  onPushAiToStage: (entry: AILogEntry) => void;
  onGenerateShowNotes: () => void;
  onPatchRoom: (patch: Record<string, unknown>) => void;
  onSendChat: (text: string, replyTo?: ChatReplyRef) => void;
  onToggleChatLike?: (messageId: string) => void;
  onToggleChatReaction?: (messageId: string, emoji: string) => void;
  onPinChatMessage?: (messageId: string | null) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  onBlockChatUser?: (author: string, uid?: string) => void;
  onUnblockChatUser?: (blockId: string) => void;
  onFeatureChat: (id: string | null) => void;
  onFeatureQuestion?: (id: string | null) => void;
  onPinProduct: (id: string | null) => void;
  onStartFlashSale?: (payload: {
    productId: string;
    discountPct: number;
    totalUnits: number;
    durationMin: number;
    tagline?: string;
  }) => void;
  onStopFlashSale?: () => void;
  onLaunchPoll: (question: string, options: string[], showOnStage: boolean) => void;
  onClosePoll: (clear?: boolean) => void;
  onRunRundownStep: (step: RundownStep) => void;
  onToggleCaptions: () => void;
  onSelectBrandFile: (kind: 'backdrop' | 'logo' | 'overlay', file: File) => void;
}

const AVATAR_TONES = [
  'bg-sky-500/20 text-sky-300 border-sky-400/30',
  'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
  'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  'bg-amber-500/20 text-amber-300 border-amber-400/30',
  'bg-rose-500/20 text-rose-300 border-rose-400/30',
  'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
];

function getAvatarStyle(name: string): { initials: string; cls: string } {
  const clean = name.trim() || 'G';
  const initials =
    clean
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'G';
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return { initials, cls: AVATAR_TONES[hash % AVATAR_TONES.length] };
}

const PANEL_HEADERS: Record<ConsoleTab, { title: string; subtitle: string }> = {
  chat: { title: 'Chat & Q&A', subtitle: 'Moderation, replies, pinning & audience Q&A' },
  ai: { title: 'Cue AI', subtitle: 'Live showrunner & stage direction' },
  show: { title: 'Show', subtitle: 'Banners, captions, stage HUD & rundown' },
  shop: { title: 'Payouts & Drops', subtitle: '0%-fee direct tips & optional live catalog' },
  look: { title: 'Look & Brand', subtitle: 'Stream format, overlays, sponsors & look' },
};

export const RightConsole: React.FC<RightConsoleProps> = ({
  room,
  isHost,
  actorId = 'studio-host',
  open,
  activeTab,
  aiLogs,
  aiBusy,
  aiVoiceReadout,
  onToggleAiVoiceReadout,
  onAskAi,
  onPushAiToStage,
  onGenerateShowNotes,
  onPatchRoom,
  onSendChat,
  onToggleChatLike,
  onToggleChatReaction,
  onPinChatMessage,
  onDeleteChatMessage,
  onBlockChatUser,
  onUnblockChatUser,
  onFeatureChat,
  onFeatureQuestion,
  onPinProduct,
  onStartFlashSale,
  onStopFlashSale,
  onLaunchPoll,
  onClosePoll,
  onRunRundownStep,
  onToggleCaptions,
  onSelectBrandFile,
}) => {
  const [bannerTitle, setBannerTitle] = useState(room.overlays.banner.title);
  const [bannerSub, setBannerSub] = useState(room.overlays.banner.subtitle);
  const [tickerText, setTickerText] = useState(room.overlays.ticker.text);
  const [countdownLabel, setCountdownLabel] = useState(
    room.overlays.countdownLabel || 'Starting Soon'
  );
  const [savedPresets, setSavedPresets] = useState<Array<{ title: string; subtitle: string }>>(
    () => {
      try {
        const raw = localStorage.getItem('gather:banner-presets');
        return raw ? (JSON.parse(raw) as Array<{ title: string; subtitle: string }>) : [];
      } catch {
        return [];
      }
    }
  );
  const [chatViewMode, setChatViewMode] = useState<'messages' | 'qa'>('messages');
  const [chatDraft, setChatDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatReplyRef | null>(null);
  const [aiDraft, setAiDraft] = useState('');
  const [aiNoteOnly, setAiNoteOnly] = useState(false);

  // Poll form
  const [pollQ, setPollQ] = useState('Which topic should we cover next?');
  const [pollOpts, setPollOpts] = useState('Option A, Option B, Option C');

  // Sponsor form
  const [sponsorDraft, setSponsorDraft] = useState('');

  // Shopify / Etsy commerce forms
  const [shopifyUrl, setShopifyUrl] = useState('');
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyErr, setShopifyErr] = useState('');
  const [newProdSource, setNewProdSource] = useState<ProductSource>('etsy');
  const [newProdTitle, setNewProdTitle] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('34.00');
  const [newProdUrl, setNewProdUrl] = useState('');
  const [newProdStock, setNewProdStock] = useState('10');

  // TV Flash Sale form
  const [flashProdId, setFlashProdId] = useState(
    room.commerce.pinnedProductId || room.commerce.products[0]?.id || ''
  );
  const [flashDiscount, setFlashDiscount] = useState('20');
  const [flashUnits, setFlashUnits] = useState('15');
  const [flashMinutes, setFlashMinutes] = useState('10');
  const [flashTagline, setFlashTagline] = useState('TV Flash Drop · Volume Bundles Live!');

  // Gamer loadout draft
  const [gearLabel, setGearLabel] = useState('');
  const [gearValue, setGearValue] = useState('');

  useEffect(() => {
    setBannerTitle(room.overlays.banner.title);
    setBannerSub(room.overlays.banner.subtitle);
  }, [room.overlays.banner.title, room.overlays.banner.subtitle]);

  useEffect(() => {
    setTickerText(room.overlays.ticker.text);
  }, [room.overlays.ticker.text]);

  useEffect(() => {
    if (room.overlays.countdownLabel) {
      setCountdownLabel(room.overlays.countdownLabel);
    }
  }, [room.overlays.countdownLabel]);

  if (!open) return null;

  const handleShopifyImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopifyUrl.trim()) return;
    setShopifyLoading(true);
    setShopifyErr('');
    try {
      const res = await fetch('/api/commerce/shopify-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeUrl: shopifyUrl.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        storeOrigin?: string;
        products?: ProductItem[];
      };
      if (!res.ok || data.error) {
        setShopifyErr(data.error || 'Unable to import from Shopify store.');
      } else if (data.products && data.products.length > 0) {
        const merged = [...data.products, ...room.commerce.products].slice(0, 20);
        onPatchRoom({
          watchMode: 'shop',
          commerce: {
            ...room.commerce,
            shopifyDomain: data.storeOrigin,
            products: merged,
            pinnedProductId: data.products[0].id,
          },
        });
        setShopifyUrl('');
      } else {
        setShopifyErr('No public products found on that Shopify storefront.');
      }
    } catch {
      setShopifyErr('Network error contacting Shopify import proxy.');
    } finally {
      setShopifyLoading(false);
    }
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdTitle.trim()) return;
    const item: ProductItem = {
      id: `prod-${Date.now().toString(36)}`,
      source: newProdSource,
      title: newProdTitle.trim(),
      price: Math.max(1, Number(newProdPrice) || 25),
      currency: 'USD',
      imageUrl: '/src/assets/images/product_ceramic_mug_1794839256911.jpg',
      url:
        newProdUrl.trim() ||
        (newProdSource === 'etsy' ? 'https://www.etsy.com' : 'https://www.shopify.com'),
      stock: Math.max(1, Number(newProdStock) || 10),
      variants: ['Standard'],
    };
    onPatchRoom({
      commerce: {
        ...room.commerce,
        products: [item, ...room.commerce.products],
        pinnedProductId: item.id,
      },
    });
    setNewProdTitle('');
    setNewProdUrl('');
  };

  const handleVoicePrompt = () => {
    interface SpeechRecLike {
      lang: string;
      interimResults: boolean;
      onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      start: () => void;
    }
    type SpeechRecCtor = new () => SpeechRecLike;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecCtor;
      webkitSpeechRecognition?: SpeechRecCtor;
    };
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = room.overlays.captionLang || 'en-US';
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setAiDraft(transcript);
        onAskAi(transcript);
      }
    };
    rec.start();
  };

  const header = PANEL_HEADERS[activeTab];
  const inputCls =
    'h-8 px-2.5 rounded-[7px] bg-[var(--bg)]/80 border border-[var(--glass-border)] text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]';
  const sortedQuestions = [...(room.questions || [])].sort((a, b) => b.upvotes - a.upvotes);
  const sponsorsList = room.brand.sponsors || DEFAULT_SPONSORS;

  return (
    <aside className="w-full lg:w-[368px] shrink-0 flex flex-col rounded-[12px] gather-glass overflow-hidden min-h-0">
      {/* Panel Header */}
      <header className="px-4 py-3 border-b border-[var(--line)] shrink-0 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-[var(--ink)] leading-tight">
            {header.title}
          </h2>
          <p className="text-[11px] text-[var(--ink-3)] mt-0.5 truncate">{header.subtitle}</p>
        </div>
        {activeTab === 'ai' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleAiVoiceReadout}
              title="Speak AI replies aloud"
              className={`h-7 px-2 rounded-[6px] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                aiVoiceReadout
                  ? 'gather-btn-primary text-white'
                  : 'bg-[var(--fill)] text-[var(--ink-3)] hover:text-[var(--ink)]'
              }`}
            >
              <Volume2 className="w-3 h-3" />
              <span>Voice</span>
            </button>
            <button
              type="button"
              onClick={onGenerateShowNotes}
              title="Export Markdown Show Notes"
              className="h-7 px-2 rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[11px] font-medium text-[var(--ink-2)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3 h-3" />
              <span>Notes</span>
            </button>
          </div>
        )}
      </header>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto gather-scroll p-4 space-y-5">
        {/* === SHOW TAB (Gather v5 Parity + Stage Overlays) === */}
        {activeTab === 'show' && (
          <div className="divide-y divide-[var(--line)] space-y-5">
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--ink)]">Lower-Third Banner</h3>
                {room.overlays.banner.visible && (
                  <button
                    type="button"
                    onClick={() =>
                      onPatchRoom({
                        overlays: {
                          ...room.overlays,
                          banner: { ...room.overlays.banner, visible: false },
                        },
                      })
                    }
                    className="text-[11px] text-[var(--live)] hover:underline cursor-pointer"
                  >
                    Hide
                  </button>
                )}
              </div>
              <input
                type="text"
                value={bannerTitle}
                onChange={(e) => setBannerTitle(e.target.value)}
                placeholder="Headline"
                className={`w-full ${inputCls}`}
              />
              <input
                type="text"
                value={bannerSub}
                onChange={(e) => setBannerSub(e.target.value)}
                placeholder="Supporting line"
                className={`w-full ${inputCls}`}
              />
              <div className="flex items-center gap-2">
                <select
                  value={room.overlays.banner.style}
                  onChange={(e) =>
                    onPatchRoom({
                      overlays: {
                        ...room.overlays,
                        banner: { ...room.overlays.banner, style: e.target.value as BannerStyle },
                      },
                    })
                  }
                  aria-label="Banner style"
                  className={inputCls}
                >
                  <option value="glass">Glass</option>
                  <option value="editorial">Editorial</option>
                  <option value="broadcast">Broadcast</option>
                  <option value="minimal">Minimal</option>
                  <option value="block">Solid Accent</option>
                </select>
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() =>
                    onPatchRoom({
                      overlays: {
                        ...room.overlays,
                        banner: {
                          ...room.overlays.banner,
                          visible: true,
                          title: bannerTitle,
                          subtitle: bannerSub,
                        },
                      },
                    })
                  }
                  className="flex-1 h-8 rounded-[7px] gather-btn-primary text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Show on stage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!bannerTitle.trim()) return;
                    const next = [
                      { title: bannerTitle.trim(), subtitle: bannerSub.trim() },
                      ...savedPresets,
                    ].slice(0, 6);
                    setSavedPresets(next);
                    try {
                      localStorage.setItem('gather:banner-presets', JSON.stringify(next));
                    } catch {
                      // ignore
                    }
                  }}
                  title="Save as reusable preset"
                  className="h-8 px-2.5 rounded-[7px] bg-[var(--fill)] hover:border-[var(--accent)] border border-[var(--glass-border)] text-xs font-medium text-[var(--ink-2)] cursor-pointer whitespace-nowrap"
                >
                  + Save
                </button>
              </div>
              <div className="pt-1 divide-y divide-[var(--line)]">
                {[...savedPresets, ...DEFAULT_BANNER_PRESETS].map((p, idx) => (
                  <div
                    key={`${p.title}-${idx}`}
                    className="flex items-center justify-between gap-2 py-2 hover:bg-[var(--fill-hover)] px-1.5 -mx-1.5 rounded-[6px] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setBannerTitle(p.title);
                        setBannerSub(p.subtitle);
                        onPatchRoom({
                          overlays: {
                            ...room.overlays,
                            banner: {
                              ...room.overlays.banner,
                              visible: true,
                              title: p.title,
                              subtitle: p.subtitle,
                            },
                          },
                        });
                      }}
                      className="min-w-0 flex-1 text-left text-xs cursor-pointer"
                    >
                      <div className="font-medium text-[var(--ink)] truncate">{p.title}</div>
                      <div className="text-[11px] text-[var(--ink-3)] truncate">{p.subtitle}</div>
                    </button>
                    {idx < savedPresets.length && (
                      <button
                        type="button"
                        aria-label="Delete saved preset"
                        onClick={() => {
                          const next = savedPresets.filter((_, i) => i !== idx);
                          setSavedPresets(next);
                          try {
                            localStorage.setItem('gather:banner-presets', JSON.stringify(next));
                          } catch {
                            // ignore
                          }
                        }}
                        className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Gather v5 Stage Interactive Overlays (Chat on Stage + Support QR on Stage) */}
            <section className="pt-5 space-y-2.5">
              <h3 className="text-xs font-semibold text-[var(--ink)]">Live Stage HUD Overlays</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onPatchRoom({
                      overlays: {
                        ...room.overlays,
                        chatOverlayOnStage: !room.overlays.chatOverlayOnStage,
                      },
                    })
                  }
                  className={`h-8 px-2.5 rounded-[7px] border text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    room.overlays.chatOverlayOnStage
                      ? 'gather-btn-primary text-white'
                      : 'bg-[var(--fill)] border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Chat on Stage</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPatchRoom({
                      overlays: {
                        ...room.overlays,
                        showSupportQrOnStage: !room.overlays.showSupportQrOnStage,
                      },
                    })
                  }
                  className={`h-8 px-2.5 rounded-[7px] border text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    room.overlays.showSupportQrOnStage
                      ? 'gather-btn-tip text-white'
                      : 'bg-[var(--fill)] border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Tip QR on Stage</span>
                </button>
              </div>
            </section>

            <section className="pt-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>Stage Countdown</span>
                </h3>
                {room.overlays.countdownEndAt && (
                  <button
                    type="button"
                    onClick={() =>
                      onPatchRoom({
                        overlays: { ...room.overlays, countdownEndAt: null },
                      })
                    }
                    className="text-[11px] text-[var(--live)] hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="text"
                value={countdownLabel}
                onChange={(e) => setCountdownLabel(e.target.value)}
                placeholder="Timer label (e.g. Starting Soon)"
                className={`w-full ${inputCls}`}
              />
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 3, 5].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={!isHost}
                    onClick={() =>
                      onPatchRoom({
                        overlays: {
                          ...room.overlays,
                          countdownEndAt: Date.now() + mins * 60 * 1000,
                          countdownLabel: countdownLabel.trim() || 'Starting Soon',
                        },
                      })
                    }
                    className="h-8 rounded-[7px] bg-[var(--fill)] hover:border-[var(--accent)] border border-[var(--glass-border)] text-xs font-mono-num font-medium text-[var(--ink)] cursor-pointer"
                  >
                    {mins}m timer
                  </button>
                ))}
              </div>
            </section>

            {/* Multi-Language Live Captions + Caption Style + Scrolling Ticker */}
            <section className="pt-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--ink)]">Live Captions &amp; Ticker</h3>
                <button
                  type="button"
                  onClick={onToggleCaptions}
                  className={`h-7 px-2.5 rounded-[6px] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    room.overlays.captionsEnabled
                      ? 'gather-btn-primary text-white'
                      : 'bg-[var(--fill)] text-[var(--ink-2)]'
                  }`}
                >
                  <Captions className="w-3.5 h-3.5" />
                  <span>{room.overlays.captionsEnabled ? 'Captions on' : 'Captions off'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Caption language"
                  value={room.overlays.captionLang || 'en-US'}
                  onChange={(e) =>
                    onPatchRoom({
                      overlays: { ...room.overlays, captionLang: e.target.value },
                    })
                  }
                  className={inputCls}
                >
                  {CAPTION_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Caption visual style"
                  value={room.overlays.captionStyle || 'glass'}
                  onChange={(e) =>
                    onPatchRoom({
                      overlays: {
                        ...room.overlays,
                        captionStyle: e.target.value as CaptionStyle,
                      },
                    })
                  }
                  className={inputCls}
                >
                  <option value="glass">Glass Pill</option>
                  <option value="bar">Cinema Bar</option>
                  <option value="minimal">Clean Text</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tickerText}
                  onChange={(e) => setTickerText(e.target.value)}
                  placeholder="Scrolling ticker…"
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    onPatchRoom({
                      overlays: {
                        ...room.overlays,
                        ticker: {
                          visible:
                            !room.overlays.ticker.visible ||
                            tickerText !== room.overlays.ticker.text,
                          text: tickerText,
                        },
                      },
                    })
                  }
                  className="h-8 px-3 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--glass-border)] text-xs font-medium text-[var(--ink)] cursor-pointer whitespace-nowrap"
                >
                  {room.overlays.ticker.visible ? 'Toggle' : 'Show'}
                </button>
              </div>
            </section>

            <section className="pt-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>Audience Poll</span>
                </h3>
                {room.gamer.activePoll && (
                  <button
                    type="button"
                    onClick={() => onClosePoll(true)}
                    className="text-[11px] text-[var(--live)] hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {room.gamer.activePoll ? (
                <div className="space-y-2 py-1">
                  <div className="text-xs font-medium text-[var(--ink)]">
                    {room.gamer.activePoll.question}
                  </div>
                  <div className="divide-y divide-[var(--line)]">
                    {room.gamer.activePoll.options.map((opt) => (
                      <div key={opt.id} className="flex items-center justify-between py-1.5 text-xs">
                        <span className="text-[var(--ink-2)]">{opt.label}</span>
                        <span className="font-mono-num text-[var(--ink)]">{opt.votes} votes</span>
                      </div>
                    ))}
                  </div>
                  {room.gamer.activePoll.isOpen && (
                    <button
                      type="button"
                      onClick={() => onClosePoll(false)}
                      className="w-full h-8 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-xs font-medium text-[var(--ink)] cursor-pointer"
                    >
                      Close voting
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={pollQ}
                    onChange={(e) => setPollQ(e.target.value)}
                    placeholder="Poll question…"
                    className={`w-full ${inputCls}`}
                  />
                  <input
                    type="text"
                    value={pollOpts}
                    onChange={(e) => setPollOpts(e.target.value)}
                    placeholder="Comma-separated options"
                    className={`w-full ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onLaunchPoll(
                        pollQ,
                        pollOpts
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                        true
                      )
                    }
                    className="w-full h-8 rounded-[7px] gather-btn-primary text-xs font-semibold cursor-pointer"
                  >
                    Launch live poll
                  </button>
                </div>
              )}
            </section>

            <section className="pt-5 space-y-2">
              <div className="flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <h3 className="text-xs font-semibold text-[var(--ink)]">Show Rundown Cues</h3>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {room.rundown.steps.map((step, idx) => {
                  const isActive = room.rundown.activeStepId === step.id;
                  return (
                    <div
                      key={step.id}
                      className={`py-2.5 flex items-center justify-between gap-2 ${
                        isActive ? 'bg-[var(--accent-soft)] -mx-2 px-2 rounded-[6px]' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[var(--ink)] truncate">
                          0{idx + 1}. {step.title}
                        </div>
                        <div className="text-[11px] text-[var(--ink-3)] font-mono-num">
                          {step.durationMin}m · {step.sceneId}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRunRundownStep(step)}
                        className="shrink-0 h-7 px-2.5 rounded-[6px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--ink)] hover:border-[var(--accent)] cursor-pointer"
                      >
                        {step.completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ok)]" />
                        ) : (
                          'Cue'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* === CHAT & Q&A TAB (Avatars, Replies, Likes, Pin, Delete & Block Moderation) === */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full min-h-[380px] justify-between gap-3">
            {/* Top Bar: Messages | Q&A Filter */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="gather-seg">
                <button
                  type="button"
                  onClick={() => setChatViewMode('messages')}
                  className={`gather-seg-btn ${chatViewMode === 'messages' ? 'active' : ''}`}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setChatViewMode('qa')}
                  className={`gather-seg-btn ${chatViewMode === 'qa' ? 'active' : ''}`}
                >
                  <HelpCircle className="w-3 h-3 text-[var(--cyan)]" />
                  <span>Q&amp;A ({sortedQuestions.length})</span>
                </button>
              </div>
              <span className="text-[11px] font-mono-num text-[var(--ink-3)]">
                {room.chatMessages.filter((m) => m.role !== 'payment-card').length} msgs
              </span>
            </div>

            {chatViewMode === 'qa' ? (
              <div className="divide-y divide-[var(--line)] flex-1 overflow-y-auto gather-scroll pr-1">
                {sortedQuestions.length === 0 ? (
                  <p className="text-xs text-[var(--ink-3)] py-8 text-center">
                    Audience questions from the Watch Page will appear here sorted by upvotes.
                  </p>
                ) : (
                  sortedQuestions.map((q) => {
                    const isFeatured = room.overlays.featuredQuestionId === q.id;
                    return (
                      <div key={q.id} className="py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                            <ThumbsUp className="w-3 h-3 text-[var(--cyan)]" />
                            <span className="font-mono-num">{q.upvotes}</span>
                            <span>· {q.author}</span>
                          </span>
                          {onFeatureQuestion && (
                            <button
                              type="button"
                              onClick={() => onFeatureQuestion(isFeatured ? null : q.id)}
                              className={`h-6 px-2 rounded-[6px] text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                                isFeatured
                                  ? 'gather-btn-primary text-white'
                                  : 'bg-[var(--fill)] border border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                              }`}
                            >
                              {isFeatured ? 'On Stage' : 'Show on Stage'}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[var(--ink-2)] leading-relaxed">{q.text}</p>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <>
                <div className="divide-y divide-[var(--line)] flex-1 overflow-y-auto gather-scroll pt-3 pr-1">
                  {room.overlays.featuredChatId && (
                    <div className="mb-2 p-2 rounded-[7px] bg-[var(--accent-soft)] flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--ink)]">Featured on stage</span>
                      <button
                        type="button"
                        onClick={() => onFeatureChat(null)}
                        className="text-[var(--accent-text)] hover:underline cursor-pointer"
                      >
                        Hide
                      </button>
                    </div>
                  )}

                  {(() => {
                    const pinnedMsg = room.pinnedChatId
                      ? room.chatMessages.find((m) => m.id === room.pinnedChatId)
                      : null;
                    if (!pinnedMsg) return null;
                    return (
                      <div className="mb-2 p-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--accent-line)] flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-[var(--cyan)] flex items-center gap-1">
                            <Pin className="w-3 h-3" />
                            <span>Pinned · {pinnedMsg.author}</span>
                          </div>
                          <p className="text-[11px] text-[var(--ink)] truncate mt-0.5">{pinnedMsg.text}</p>
                        </div>
                        {onPinChatMessage && (
                          <button
                            type="button"
                            onClick={() => onPinChatMessage(null)}
                            className="text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer shrink-0"
                          >
                            Unpin
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {room.chatMessages
                    .filter((msg) => msg.role !== 'payment-card')
                    .map((msg) => {
                      const isFeatured = room.overlays.featuredChatId === msg.id;
                      const isPinned = room.pinnedChatId === msg.id;
                      const likedByMe = Boolean(msg.likedBy?.includes(actorId));
                      const likeCount = msg.likes ?? msg.likedBy?.length ?? 0;
                      const av = getAvatarStyle(msg.author);
                      const sc = msg.superChat;
                      const scClasses = sc
                        ? sc.tier === 'rose'
                          ? 'bg-rose-500/15 border border-rose-400/40'
                          : sc.tier === 'amber'
                          ? 'bg-amber-500/15 border border-amber-400/40'
                          : sc.tier === 'emerald'
                          ? 'bg-emerald-500/15 border border-emerald-400/40'
                          : 'bg-sky-500/15 border border-sky-400/40'
                        : '';
                      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={msg.id}
                          className={`group relative ${
                            sc
                              ? `my-1.5 p-2.5 rounded-[9px] space-y-1.5 ${scClasses}`
                              : `py-2.5 space-y-1.5 ${
                                  msg.role === 'order' ? 'bg-[var(--ok)]/10 px-2 -mx-2 rounded-[6px]' : ''
                                }`
                          }`}
                        >
                          {msg.role !== 'system' && onToggleChatReaction && (
                            <HoverReactionMenu
                              reactions={msg.reactions}
                              actorId={actorId}
                              onSelect={(emoji) => onToggleChatReaction(msg.id, emoji)}
                              className="right-12"
                            />
                          )}
                          <div className="flex items-start gap-2.5">
                            {msg.avatarUrl ? (
                              <img
                                src={msg.avatarUrl}
                                alt={msg.author}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full object-cover border border-white/15 shrink-0 mt-0.5"
                              />
                            ) : (
                              <span
                                className={`w-7 h-7 rounded-full border text-[10px] font-display font-bold grid place-items-center shrink-0 mt-0.5 ${av.cls}`}
                              >
                                {av.initials}
                              </span>
                            )}

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold text-[var(--ink)] flex items-center gap-1.5 min-w-0 truncate">
                                  {sc && (
                                    <span className="font-mono-num font-bold uppercase text-[var(--ok)]">
                                      ${sc.amount.toFixed(0)} · {sc.method}
                                    </span>
                                  )}
                                  <span className="truncate">{msg.author}</span>
                                  <span className="font-normal text-[var(--ink-3)] font-mono-num">
                                    · {timeStr}
                                  </span>
                                </span>

                                {msg.role !== 'system' && (
                                  <button
                                    type="button"
                                    onClick={() => onFeatureChat(isFeatured ? null : msg.id)}
                                    className={`text-[11px] font-medium cursor-pointer shrink-0 ${
                                      isFeatured
                                        ? 'text-[var(--accent-text)]'
                                        : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                                    }`}
                                  >
                                    {isFeatured ? 'On stage' : 'Feature'}
                                  </button>
                                )}
                              </div>

                              {msg.replyTo && (
                                <div className="pl-2 border-l-2 border-[var(--accent)]/60 text-[11px] text-[var(--ink-3)] truncate">
                                  <span className="font-semibold text-[var(--ink-2)]">
                                    @{msg.replyTo.author}:
                                  </span>{' '}
                                  {msg.replyTo.text}
                                </div>
                              )}

                              <p className="text-xs text-[var(--ink-2)] leading-relaxed break-words">
                                {msg.text}
                              </p>

                              {msg.role !== 'system' && (
                                <ReactionBadgeRow
                                  reactions={msg.reactions}
                                  actorId={actorId}
                                  onToggle={
                                    onToggleChatReaction
                                      ? (emoji) => onToggleChatReaction(msg.id, emoji)
                                      : undefined
                                  }
                                />
                              )}

                              {msg.role !== 'system' && (
                                <div className="flex items-center gap-3 pt-0.5 text-[11px] text-[var(--ink-3)]">
                                  {onToggleChatLike && (
                                    <button
                                      type="button"
                                      onClick={() => onToggleChatLike(msg.id)}
                                      className={`inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                        likedByMe
                                          ? 'text-rose-400 font-semibold'
                                          : 'hover:text-[var(--ink)]'
                                      }`}
                                    >
                                      <Heart
                                        className={`w-3 h-3 ${likedByMe ? 'fill-current' : ''}`}
                                      />
                                      <span className="font-mono-num">{likeCount}</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReplyingTo({
                                        id: msg.id,
                                        author: msg.author,
                                        text: msg.text.slice(0, 120),
                                      })
                                    }
                                    className="inline-flex items-center gap-1 hover:text-[var(--ink)] cursor-pointer"
                                  >
                                    <CornerUpLeft className="w-3 h-3" />
                                    <span>Reply</span>
                                  </button>

                                  {isHost && onPinChatMessage && (
                                    <button
                                      type="button"
                                      onClick={() => onPinChatMessage(isPinned ? null : msg.id)}
                                      className={`inline-flex items-center gap-1 cursor-pointer ${
                                        isPinned ? 'text-[var(--cyan)] font-semibold' : 'hover:text-[var(--ink)]'
                                      }`}
                                    >
                                      <Pin className="w-3 h-3" />
                                      <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                                    </button>
                                  )}

                                  {isHost && onDeleteChatMessage && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteChatMessage(msg.id)}
                                      aria-label="Delete message"
                                      className="inline-flex items-center gap-1 hover:text-[var(--danger)] cursor-pointer opacity-80 group-hover:opacity-100"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}

                                  {isHost && onBlockChatUser && msg.role !== 'host' && (
                                    <button
                                      type="button"
                                      onClick={() => onBlockChatUser(msg.author, msg.authorUid)}
                                      aria-label={`Block ${msg.author}`}
                                      className="inline-flex items-center gap-1 hover:text-[var(--danger)] cursor-pointer opacity-80 group-hover:opacity-100"
                                    >
                                      <Ban className="w-3 h-3" />
                                      <span>Block</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {(room.blockedUsers?.length || 0) > 0 && isHost && onUnblockChatUser && (
                  <div className="px-2.5 py-2 rounded-[8px] bg-[var(--fill)] border border-[var(--glass-border)] flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-[var(--ink-3)] font-medium">Blocked:</span>
                    {(room.blockedUsers || []).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onUnblockChatUser(b.id)}
                        className="px-2 py-0.5 rounded-[5px] bg-[var(--bg)]/80 border border-[var(--line-2)] text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{b.author}</span>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatDraft.trim()) return;
                    onSendChat(chatDraft.trim(), replyingTo || undefined);
                    setChatDraft('');
                    setReplyingTo(null);
                  }}
                  className="pt-3 border-t border-[var(--line)] space-y-2"
                >
                  {replyingTo && (
                    <div className="px-2.5 py-1.5 rounded-[7px] bg-[var(--accent-soft)] border border-[var(--accent-line)] flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-[var(--ink-2)]">
                        Replying to <strong className="text-[var(--ink)]">@{replyingTo.author}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        aria-label="Cancel reply"
                        className="text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="gather-composer">
                    <input
                      type="text"
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder={
                        replyingTo ? `Reply to ${replyingTo.author}…` : 'Message studio & viewers…'
                      }
                    />
                    {chatDraft.length > 0 && (
                      <button
                        type="button"
                        aria-label="Clear chat input"
                        title="Clear"
                        onClick={(e) => {
                          setChatDraft('');
                          (
                            e.currentTarget.parentElement?.querySelector(
                              'input'
                            ) as HTMLInputElement | null
                          )?.focus();
                        }}
                        className="h-6 w-6 shrink-0 grid place-items-center rounded-full bg-[var(--fill)] hover:bg-[var(--fill-active)] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                      >
                        <X className="w-3 h-3" strokeWidth={2} />
                      </button>
                    )}
                    <button
                      type="submit"
                      aria-label="Send chat message"
                      disabled={!chatDraft.trim()}
                      className={`gather-send-btn ${chatDraft.trim() ? 'ready' : ''}`}
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.25]" />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {/* === PAYOUTS & SHOP TAB === */}
        {activeTab === 'shop' && (
          <div className="divide-y divide-[var(--line)] space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[var(--ok)]" />
                  <span>Direct In-Chat Creator Payouts</span>
                </span>
                <span className="text-[11px] text-[var(--ok)] font-mono-num">0% platform fee</span>
              </div>
              <p className="text-[11px] text-[var(--ink-3)] leading-snug">
                Viewers tip directly inside Live Chat via Instant Pay, inline payment sheet, or phone QR without ever leaving your Watch Page.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={room.commerce.payouts?.venmoHandle || ''}
                  onChange={(e) =>
                    onPatchRoom({
                      commerce: {
                        ...room.commerce,
                        payouts: {
                          ...room.commerce.payouts,
                          enabled: true,
                          venmoHandle: e.target.value.replace(/^@/, ''),
                        },
                      },
                    })
                  }
                  placeholder="Venmo @handle"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={room.commerce.payouts?.paypalHandle || ''}
                  onChange={(e) =>
                    onPatchRoom({
                      commerce: {
                        ...room.commerce,
                        payouts: {
                          ...room.commerce.payouts,
                          enabled: true,
                          paypalHandle: e.target.value.replace(/^@/, ''),
                        },
                      },
                    })
                  }
                  placeholder="PayPal.me handle"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={room.commerce.payouts?.cashappTag || ''}
                  onChange={(e) =>
                    onPatchRoom({
                      commerce: {
                        ...room.commerce,
                        payouts: {
                          ...room.commerce.payouts,
                          enabled: true,
                          cashappTag: e.target.value.replace(/^\$/, ''),
                        },
                      },
                    })
                  }
                  placeholder="Cash App $tag"
                  className={inputCls}
                />
                <input
                  type="url"
                  value={room.commerce.payouts?.stripeUrl || ''}
                  onChange={(e) =>
                    onPatchRoom({
                      commerce: {
                        ...room.commerce,
                        payouts: {
                          ...room.commerce.payouts,
                          enabled: true,
                          stripeUrl: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="Inline Stripe URL"
                  className={inputCls}
                />
              </div>
              <p className="text-[11px] text-[var(--ink-2)] font-medium">
                Viewers access these direct payment rails via the single <strong className="text-[var(--ok)]">$ Support</strong> sheet in the Watch chat composer.
              </p>
            </div>

            <div className="pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--ink)]">Live Shop Mode</span>
                <button
                  type="button"
                  onClick={() =>
                    onPatchRoom({
                      watchMode: room.watchMode === 'shop' ? 'standard' : 'shop',
                    })
                  }
                  className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold cursor-pointer ${
                    room.watchMode === 'shop'
                      ? 'gather-btn-primary text-white'
                      : 'bg-[var(--fill)] border border-[var(--glass-border)] text-[var(--ink-2)]'
                  }`}
                >
                  {room.watchMode === 'shop' ? 'Shop Shelf On Watch Page' : 'Hidden on Watch Page'}
                </button>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">
                Live Shop UI &amp; Express Bag only appear on the Watch Page when Live Shop mode is enabled.
              </p>
            </div>

            {/* TV-Infomercial Volume Flash Sale Launcher */}
            <div className="pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>TV Volume Flash Sale</span>
                </span>
                {room.commerce.activeFlashSale?.active &&
                  room.commerce.activeFlashSale.endsAt > Date.now() &&
                  onStopFlashSale && (
                    <button
                      type="button"
                      onClick={onStopFlashSale}
                      className="text-[11px] font-semibold text-[var(--live)] hover:underline cursor-pointer"
                    >
                      End Flash Sale
                    </button>
                  )}
              </div>

              {room.commerce.activeFlashSale?.active &&
              room.commerce.activeFlashSale.endsAt > Date.now() ? (
                <div className="p-3 rounded-[9px] bg-amber-500/10 border border-amber-400/35 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-mono-num">
                    <span className="font-semibold text-amber-300">
                      LIVE · -{room.commerce.activeFlashSale.discountPct}% Base / -38% 3× VIP
                    </span>
                    <span className="text-[var(--ink)] font-bold">
                      {room.commerce.activeFlashSale.soldUnits}/
                      {room.commerce.activeFlashSale.totalUnits} sold
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--ink-2)]">
                    {room.commerce.activeFlashSale.tagline}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={flashProdId || room.commerce.products[0]?.id || ''}
                    onChange={(e) => setFlashProdId(e.target.value)}
                    aria-label="Flash sale product"
                    className={`w-full ${inputCls}`}
                  >
                    {room.commerce.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (${p.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-1.5">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-[var(--ink-3)] block">% Off</span>
                      <input
                        type="number"
                        min={5}
                        max={75}
                        value={flashDiscount}
                        onChange={(e) => setFlashDiscount(e.target.value)}
                        className={`w-full ${inputCls} font-mono-num`}
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-[var(--ink-3)] block">Unit Cap</span>
                      <input
                        type="number"
                        min={2}
                        max={200}
                        value={flashUnits}
                        onChange={(e) => setFlashUnits(e.target.value)}
                        className={`w-full ${inputCls} font-mono-num`}
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-[var(--ink-3)] block">Minutes</span>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={flashMinutes}
                        onChange={(e) => setFlashMinutes(e.target.value)}
                        className={`w-full ${inputCls} font-mono-num`}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={flashTagline}
                    onChange={(e) => setFlashTagline(e.target.value)}
                    placeholder="TV urgency headline..."
                    className={`w-full ${inputCls}`}
                  />
                  {onStartFlashSale && room.commerce.products.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = flashProdId || room.commerce.products[0].id;
                        onPatchRoom({ watchMode: 'shop' });
                        onStartFlashSale({
                          productId: targetId,
                          discountPct: Math.max(5, Math.min(75, Number(flashDiscount) || 20)),
                          totalUnits: Math.max(2, Number(flashUnits) || 15),
                          durationMin: Math.max(1, Number(flashMinutes) || 10),
                          tagline: flashTagline.trim() || 'TV Flash Deal · Limited Units!',
                        });
                      }}
                      className="w-full h-8 rounded-[7px] bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      Launch Live TV Flash Sale (1× / 2× / 3× Bundles)
                    </button>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleShopifyImport} className="pt-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                <Store className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <span>Import Shopify Storefront</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shopifyUrl}
                  onChange={(e) => setShopifyUrl(e.target.value)}
                  placeholder="yourstore.myshopify.com"
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  type="submit"
                  disabled={shopifyLoading}
                  className="h-8 px-3 rounded-[7px] gather-btn-primary text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {shopifyLoading ? 'Pulling…' : 'Import'}
                </button>
              </div>
              {shopifyErr && <p className="text-[11px] text-[var(--danger)]">{shopifyErr}</p>}
            </form>

            <form onSubmit={handleAddProduct} className="pt-4 space-y-2">
              <div className="text-xs font-semibold text-[var(--ink)]">Add Drop Item</div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={newProdSource}
                  onChange={(e) => setNewProdSource(e.target.value as ProductSource)}
                  className={inputCls}
                >
                  <option value="etsy">Etsy</option>
                  <option value="shopify">Shopify</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  placeholder="Price"
                  className={`${inputCls} font-mono-num`}
                />
                <input
                  type="number"
                  value={newProdStock}
                  onChange={(e) => setNewProdStock(e.target.value)}
                  placeholder="Stock"
                  className={`${inputCls} font-mono-num`}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProdTitle}
                  onChange={(e) => setNewProdTitle(e.target.value)}
                  placeholder="Product title"
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  type="submit"
                  className="h-8 px-3 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--glass-border)] text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </form>

            <div className="pt-4 divide-y divide-[var(--line)]">
              {room.commerce.products.map((prod) => {
                const isPinned = room.commerce.pinnedProductId === prod.id;
                return (
                  <div
                    key={prod.id}
                    className={`py-2.5 flex items-center gap-3 ${
                      isPinned ? 'bg-[var(--accent-soft)] -mx-2 px-2 rounded-[6px]' : ''
                    }`}
                  >
                    <img
                      src={prod.imageUrl}
                      alt={prod.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-[6px] object-cover bg-[var(--bg)] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[var(--ink)] truncate">
                        {prod.title}
                      </div>
                      <div className="text-[11px] font-mono-num text-[var(--ink-3)]">
                        ${prod.price.toFixed(2)} · {prod.stock} left
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPinProduct(isPinned ? null : prod.id)}
                        className={`h-7 px-2.5 rounded-[6px] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                          isPinned
                            ? 'gather-btn-primary text-white'
                            : 'bg-[var(--fill)] border border-[var(--glass-border)] text-[var(--ink)]'
                        }`}
                      >
                        <Pin className="w-3 h-3" />
                        <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onPatchRoom({
                            commerce: {
                              ...room.commerce,
                              products: room.commerce.products.filter((p) => p.id !== prod.id),
                            },
                          })
                        }
                        aria-label="Remove product"
                        className="h-7 w-7 grid place-items-center rounded text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {room.commerce.recentOrders.length > 0 && (
              <div className="pt-4 space-y-2">
                <div className="text-xs font-semibold text-[var(--ink)]">
                  Live In-Stream Orders ({room.commerce.recentOrders.length})
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {room.commerce.recentOrders.slice(0, 6).map((ord) => (
                    <div key={ord.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--ink)] truncate">
                          {ord.buyerName}
                          {ord.buyerCity ? ` · ${ord.buyerCity}` : ''}
                        </div>
                        <div className="text-[11px] text-[var(--ink-3)] truncate">
                          {ord.orderNumber ? `${ord.orderNumber} · ` : ''}
                          {ord.quantity}× {ord.productTitle}
                        </div>
                      </div>
                      <span className="font-mono-num font-bold text-[var(--ok)] shrink-0">
                        ${ord.total.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === AI PRODUCER TAB === */}
        {activeTab === 'ai' && (
          <div className="flex flex-col h-full min-h-[380px] justify-between gap-3">
            <div className="space-y-3 flex-1 overflow-y-auto gather-scroll pr-1">
              <div className="space-y-2 pb-3 border-b border-[var(--line)]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--ink-3)] font-medium">Quick cues</span>
                  <button
                    type="button"
                    onClick={() => setAiNoteOnly((v) => !v)}
                    className={`h-6 px-2 rounded-[5px] font-medium cursor-pointer transition-colors ${
                      aiNoteOnly
                        ? 'bg-[var(--fill)] text-[var(--ink)] border border-[var(--glass-border)]'
                        : 'text-[var(--accent-text)] hover:bg-[var(--fill)]'
                    }`}
                  >
                    {aiNoteOnly ? 'Private note only' : 'Auto stage actions'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: '5m countdown', prompt: 'Start a 5 minute countdown labeled Starting Soon' },
                    { label: 'Switch Duo', prompt: 'Switch stage scene to duo layout' },
                    { label: 'Launch Q&A banner', prompt: 'Show a lower-third banner inviting audience Q&A' },
                    { label: 'Launch poll', prompt: 'Launch a viewer poll about what topic to cover next' },
                  ].map((cue) => (
                    <button
                      key={cue.label}
                      type="button"
                      disabled={aiBusy}
                      onClick={() =>
                        onAskAi(
                          aiNoteOnly
                            ? `${cue.prompt} (Answer as private host research note only, do not call stage tools.)`
                            : cue.prompt
                        )
                      }
                      className="h-7 px-2.5 rounded-[6px] bg-[var(--fill)] hover:border-[var(--accent)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] text-left truncate cursor-pointer"
                    >
                      {cue.label}
                    </button>
                  ))}
                </div>
              </div>

              {aiLogs.length === 0 ? (
                <div className="divide-y divide-[var(--line)]">
                  <p className="text-xs text-[var(--ink-3)] pb-2.5">
                    Try a cue or live research question:
                  </p>
                  {[
                    'Switch to Duo Split and show an Episode 12 welcome banner',
                    'Launch an audience poll with 3 architecture topics',
                    'Play the intro stinger and start a 3 minute countdown',
                    'Advance to the next show rundown step',
                  ].map((sugg) => (
                    <button
                      key={sugg}
                      type="button"
                      onClick={() => onAskAi(sugg)}
                      className="w-full text-left py-2.5 hover:text-[var(--ink)] text-xs text-[var(--ink-2)] cursor-pointer"
                    >
                      {sugg}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {aiLogs.map((entry) => (
                    <div key={entry.id} className="py-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`font-semibold ${
                            entry.role === 'user' ? 'text-[var(--ink)]' : 'text-[var(--accent-text)]'
                          }`}
                        >
                          {entry.role === 'user' ? 'Host' : 'Cue AI'}
                        </span>
                        {entry.role === 'ai' && (
                          <button
                            type="button"
                            onClick={() => onPushAiToStage(entry)}
                            className="text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                          >
                            {entry.pushedToStage ? 'On stage' : 'Push to banner'}
                          </button>
                        )}
                      </div>
                      <p className="leading-relaxed text-[var(--ink-2)] whitespace-pre-wrap">
                        {entry.text}
                      </p>
                      {entry.actions && entry.actions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-0.5 text-[11px] font-mono-num text-[var(--ok)]">
                          {entry.actions.map((act, i) => (
                            <span key={i}>✓ {act.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!aiDraft.trim() || aiBusy) return;
                const promptText = aiNoteOnly
                  ? `${aiDraft.trim()} (Private note only — do not modify stage overlays or call tools.)`
                  : aiDraft.trim();
                onAskAi(promptText);
                setAiDraft('');
              }}
              className="pt-3 border-t border-[var(--line)]"
            >
              <div className="gather-composer">
                <ComposerShareControl roomCode={room.roomCode} roomTitle={room.title} />
                <span className={`gather-orb ${aiBusy ? 'busy' : ''}`} />
                <input
                  type="text"
                  value={aiDraft}
                  onChange={(e) => setAiDraft(e.target.value)}
                  placeholder={
                    aiBusy
                      ? 'Directing…'
                      : aiNoteOnly
                      ? 'Private research note…'
                      : 'Ask or direct Cue AI…'
                  }
                />
                {aiDraft.length > 0 && (
                  <button
                    type="button"
                    aria-label="Clear AI prompt"
                    title="Clear"
                    onClick={(e) => {
                      setAiDraft('');
                      (
                        e.currentTarget.parentElement?.querySelector(
                          'input'
                        ) as HTMLInputElement | null
                      )?.focus();
                    }}
                    className="h-6 w-6 shrink-0 grid place-items-center rounded-full bg-[var(--fill)] hover:bg-[var(--fill-active)] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleVoicePrompt}
                  aria-label="Speak to AI Producer"
                  className="h-7 w-7 shrink-0 grid place-items-center rounded-[7px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="submit"
                  aria-label="Run AI command"
                  disabled={aiBusy || !aiDraft.trim()}
                  className={`gather-send-btn ${aiDraft.trim() && !aiBusy ? 'ready' : ''}`}
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.25]" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* === LOOK & BRAND TAB (Gather v5 Full Feature Parity!) === */}
        {activeTab === 'look' && (
          <div className="divide-y divide-[var(--line)] space-y-5">
            {/* 1. Stream Format / Watch Page Optimization */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--ink)]">Stream Format &amp; Watch UI</h3>
                <span className="text-[10.5px] text-[var(--ink-3)]">Tailors Watch Page</span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-[8px] bg-[var(--fill)] border border-[var(--glass-border)]">
                {(
                  [
                    { id: 'standard', label: 'Broadcast' },
                    { id: 'shop', label: 'Live Shop' },
                    { id: 'gamer', label: 'Gaming' },
                  ] as Array<{ id: WatchMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onPatchRoom({ watchMode: m.id })}
                    className={`h-7 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      room.watchMode === m.id
                        ? 'gather-btn-primary text-white'
                        : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Gamer Loadout Editor ONLY shown when stream format is 'gamer' */}
            {room.watchMode === 'gamer' && (
              <section className="pt-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                  <Gamepad2 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>Gaming Arena Loadout &amp; Lobby</span>
                </div>
                <input
                  type="text"
                  value={room.gamer.gameTitle}
                  onChange={(e) =>
                    onPatchRoom({ gamer: { ...room.gamer, gameTitle: e.target.value } })
                  }
                  placeholder="Game title"
                  className={`w-full ${inputCls}`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={room.gamer.modeOrRank}
                    onChange={(e) =>
                      onPatchRoom({ gamer: { ...room.gamer, modeOrRank: e.target.value } })
                    }
                    placeholder="Rank / Mode"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={room.gamer.lobbyCode}
                    onChange={(e) =>
                      onPatchRoom({ gamer: { ...room.gamer, lobbyCode: e.target.value } })
                    }
                    placeholder="Lobby code"
                    className={`${inputCls} font-mono-num`}
                  />
                  <input
                    type="text"
                    value={room.gamer.seriesScore || ''}
                    onChange={(e) =>
                      onPatchRoom({ gamer: { ...room.gamer, seriesScore: e.target.value } })
                    }
                    placeholder="Score (e.g. BO3 · 1–0)"
                    className={`${inputCls} font-mono-num`}
                  />
                  <input
                    type="text"
                    value={room.gamer.currentMap || ''}
                    onChange={(e) =>
                      onPatchRoom({ gamer: { ...room.gamer, currentMap: e.target.value } })
                    }
                    placeholder="Map (e.g. Ascent)"
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={gearLabel}
                    onChange={(e) => setGearLabel(e.target.value)}
                    placeholder="Gear"
                    className={`w-20 h-7 px-2 ${inputCls}`}
                  />
                  <input
                    type="text"
                    value={gearValue}
                    onChange={(e) => setGearValue(e.target.value)}
                    placeholder="Model spec"
                    className={`flex-1 h-7 px-2 ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!gearLabel.trim() || !gearValue.trim()) return;
                      const spec: GearSpec = {
                        id: `gear-${Date.now()}`,
                        category: gearLabel.trim(),
                        label: gearLabel.trim(),
                        value: gearValue.trim(),
                      };
                      onPatchRoom({
                        gamer: { ...room.gamer, gearSpecs: [...room.gamer.gearSpecs, spec] },
                      });
                      setGearLabel('');
                      setGearValue('');
                    }}
                    className="h-7 px-2.5 rounded-[6px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--ink)] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </section>
            )}

            {/* 2. Stage Accent Color */}
            <section className="pt-4 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--ink)]">Stage Accent Colour</h3>
              <div className="flex items-center gap-2">
                {ACCENT_SWATCHES.map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    aria-label={sw.label}
                    onClick={() => onPatchRoom({ brand: { ...room.brand, accent: sw.value } })}
                    style={{ backgroundColor: sw.value }}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                      room.brand.accent === sw.value
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg)] scale-110'
                        : ''
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={room.brand.accent}
                  onChange={(e) => onPatchRoom({ brand: { ...room.brand, accent: e.target.value } })}
                  aria-label="Custom accent colour"
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                />
              </div>
            </section>

            {/* 3. Studio Backdrop + Full-Screen Custom PNG Overlay (Free StreamYard Killer!) */}
            <section className="pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--ink)]">Backdrop &amp; PNG Overlay</h3>
                {(room.brand.customBackdropUrl || room.brand.customOverlayUrl) && (
                  <button
                    type="button"
                    onClick={() =>
                      onPatchRoom({
                        brand: {
                          ...room.brand,
                          customBackdropUrl: undefined,
                          customOverlayUrl: undefined,
                        },
                      })
                    }
                    className="text-[11px] text-[var(--danger)] cursor-pointer"
                  >
                    Reset custom
                  </button>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(BACKDROP_PRESETS) as BackdropId[]).map((id) => {
                  const p = BACKDROP_PRESETS[id];
                  const active = room.brand.backdrop === id && !room.brand.customBackdropUrl;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        onPatchRoom({
                          brand: { ...room.brand, backdrop: id, customBackdropUrl: undefined },
                        })
                      }
                      style={{
                        background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})`,
                      }}
                      className={`h-10 rounded-[7px] border text-[10px] font-semibold flex items-end p-1.5 cursor-pointer ${
                        id === 'paper' ? 'text-slate-900' : 'text-white'
                      } ${active ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-white/10'}`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <label className="h-8 px-2.5 rounded-[7px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--ink-2)] inline-flex items-center justify-center gap-1.5 cursor-pointer hover:text-[var(--ink)] whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Custom Backdrop</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onSelectBrandFile('backdrop', f);
                    }}
                  />
                </label>
                <label className="h-8 px-2.5 rounded-[7px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--accent-text)] inline-flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-110 whitespace-nowrap">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{room.brand.customOverlayUrl ? 'Change PNG Frame' : '+ PNG Overlay'}</span>
                  <input
                    type="file"
                    accept="image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onSelectBrandFile('overlay', f);
                    }}
                  />
                </label>
              </div>
            </section>

            {/* 4. Typography, Frame & Speaker Name Tag Style (Gather v5) */}
            <section className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--ink-3)] block">Stage Font</span>
                  <select
                    value={room.brand.font}
                    onChange={(e) =>
                      onPatchRoom({ brand: { ...room.brand, font: e.target.value as StageFont } })
                    }
                    className={`w-full ${inputCls}`}
                  >
                    {STAGE_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--ink-3)] block">Stage Frame</span>
                  <select
                    value={room.brand.frame}
                    onChange={(e) =>
                      onPatchRoom({ brand: { ...room.brand, frame: e.target.value as FrameStyle } })
                    }
                    className={`w-full ${inputCls}`}
                  >
                    <option value="none">None</option>
                    <option value="border">Accent Border</option>
                    <option value="corners">Viewfinder Corners</option>
                    <option value="vignette">Studio Vignette</option>
                  </select>
                </label>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[var(--ink-3)]">Speaker Name Tag Style</span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-[var(--ink-2)]">
                    <input
                      type="checkbox"
                      checked={room.brand.showNames}
                      onChange={(e) =>
                        onPatchRoom({ brand: { ...room.brand, showNames: e.target.checked } })
                      }
                      className="accent-[var(--accent)]"
                    />
                    <span>Show names</span>
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-1 p-1 rounded-[7px] bg-[var(--fill)] border border-[var(--glass-border)]">
                  {(['glass', 'solid', 'outline', 'minimal'] as NameTagStyle[]).map((ns) => (
                    <button
                      key={ns}
                      type="button"
                      onClick={() => onPatchRoom({ brand: { ...room.brand, nameTagStyle: ns } })}
                      className={`h-6 rounded-[5px] text-[11px] font-semibold capitalize cursor-pointer ${
                        (room.brand.nameTagStyle || 'glass') === ns
                          ? 'gather-btn-primary text-white'
                          : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {ns}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[var(--ink-2)]">Corner Watermark Logo</span>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-[var(--accent-text)] hover:underline cursor-pointer">
                    <span>{room.brand.logoUrl ? 'Change logo' : '+ Upload logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onSelectBrandFile('logo', f);
                      }}
                    />
                  </label>
                  {room.brand.logoUrl && (
                    <button
                      type="button"
                      onClick={() => onPatchRoom({ brand: { ...room.brand, logoUrl: undefined } })}
                      aria-label="Clear logo"
                      className="text-[var(--danger)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* 5. Sponsor & Partner Banner Rotator (Gather v5) */}
            <section className="pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[var(--cyan)]" />
                  <span>Sponsor Banner Rotator</span>
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    onPatchRoom({
                      brand: {
                        ...room.brand,
                        sponsorsEnabled: !room.brand.sponsorsEnabled,
                        sponsors: sponsorsList,
                      },
                    })
                  }
                  className={`h-6 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer ${
                    room.brand.sponsorsEnabled
                      ? 'gather-btn-primary text-white'
                      : 'bg-[var(--fill)] border border-[var(--glass-border)] text-[var(--ink-2)]'
                  }`}
                >
                  {room.brand.sponsorsEnabled ? 'Rotating On Stage' : 'Off'}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {[8, 15, 30].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() =>
                      onPatchRoom({ brand: { ...room.brand, sponsorIntervalSec: sec } })
                    }
                    className={`h-6 px-2 rounded-[5px] text-[11px] font-mono-num cursor-pointer ${
                      (room.brand.sponsorIntervalSec || 15) === sec
                        ? 'bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[var(--accent-text)]'
                        : 'bg-[var(--fill)] text-[var(--ink-3)]'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
                <input
                  type="text"
                  value={sponsorDraft}
                  onChange={(e) => setSponsorDraft(e.target.value)}
                  placeholder="Add sponsor name..."
                  className={`flex-1 h-7 ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!sponsorDraft.trim()) return;
                    const next: SponsorBanner[] = [
                      ...sponsorsList,
                      { id: `sp-${Date.now()}`, label: sponsorDraft.trim() },
                    ];
                    onPatchRoom({
                      brand: { ...room.brand, sponsors: next, sponsorsEnabled: true },
                    });
                    setSponsorDraft('');
                  }}
                  className="h-7 px-2.5 rounded-[6px] gather-btn-primary text-[11px] font-semibold cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {sponsorsList.map((sp) => (
                  <div key={sp.id} className="py-1.5 flex items-center justify-between text-xs">
                    <span className="text-[var(--ink-2)] truncate">{sp.label}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${sp.label}`}
                      onClick={() =>
                        onPatchRoom({
                          brand: {
                            ...room.brand,
                            sponsors: sponsorsList.filter((item) => item.id !== sp.id),
                          },
                        })
                      }
                      className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
};
