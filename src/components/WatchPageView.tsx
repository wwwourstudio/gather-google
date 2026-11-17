import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowUp,
  Ban,
  BarChart3,
  Bell,
  BellRing,
  Calendar,
  Captions,
  Check,
  Clapperboard,
  Clock,
  Copy,
  CornerUpLeft,
  Cpu,
  CreditCard,
  DollarSign,
  EyeOff,
  Flame,
  Gamepad2,
  Hand,
  Heart,
  HelpCircle,
  ListChecks,
  Lock,
  MessageSquare,
  Minus,
  PackageCheck,
  Pin,
  Plus,
  QrCode,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  ThumbsUp,
  Trash2,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { DEFAULT_VIDEO_FX } from '../constants/studioDefaults';
import {
  AudienceQuestion,
  ChatReplyRef,
  FlashSaleState,
  PayoutSettings,
  ProductItem,
  RoomState,
  SuperChatMethod,
  WatchMode,
} from '../types/studio';
import { HoverReactionMenu, ReactionBadgeRow } from './ChatReactions';
import { StageCanvas } from './StageCanvas';

interface BagItem {
  product: ProductItem;
  variant: string;
  quantity: number;
  bundleLabel?: string;
}

interface CompletedReceipt {
  orderNumber: string;
  buyerName: string;
  buyerCity: string;
  shippingAddress: string;
  paymentMethod: string;
  items: Array<{
    title: string;
    source: string;
    variant: string;
    quantity: number;
    lineTotal: number;
    bundleLabel?: string;
  }>;
  subtotal: number;
  savings: number;
  total: number;
  createdAt: number;
}

interface FloatingHypeParticle {
  id: string;
  leftPct: number;
  kind: 'flame' | 'zap' | 'heart' | 'spark';
}

export interface WatchViewerUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface WatchPageViewProps {
  room: RoomState;
  clientId?: string;
  isHost?: boolean;
  user?: WatchViewerUser | null;
  onSignInWithGoogle?: () => Promise<void>;
  isSubscribed?: boolean;
  subscribing?: boolean;
  onToggleSubscribe?: () => Promise<void>;
  onRaiseHand?: (topic: string) => void;
  onLowerHand?: () => void;
  broadcastStream: MediaStream | null;
  localPreviewCanvas?: HTMLCanvasElement | null;
  elapsedSec: number;
  isPreviewMode: boolean;
  bagOpen: boolean;
  onSetBagOpen: (open: boolean) => void;
  onBagCountChange: (count: number) => void;
  onSwitchWatchMode?: (mode: WatchMode) => void;
  onSendChat: (text: string, author: string, replyTo?: ChatReplyRef) => void;
  onToggleChatLike?: (messageId: string) => void;
  onToggleChatReaction?: (messageId: string, emoji: string) => void;
  onPinChatMessage?: (messageId: string | null) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  onBlockChatUser?: (author: string, uid?: string) => void;
  onUnblockChatUser?: (blockId: string) => void;
  onAskQuestion?: (text: string, author: string) => void;
  onUpvoteQuestion?: (questionId: string) => void;
  onPlaceOrder: (payload: {
    productId?: string;
    quantity?: number;
    buyerName: string;
    buyerCity?: string;
    paymentMethod?: string;
    variant?: string;
    bundleLabel?: string;
    items?: Array<{
      productId: string;
      quantity: number;
      variant?: string;
      bundleLabel?: string;
    }>;
  }) => void;
  onVotePoll: (optionId: string) => void;
  onCreateClip: (label: string, timestampSec: number, createdBy: string) => void;
  onJoinSquadQueue: (
    handle: string,
    platform: string,
    note?: string,
    role?: string,
    rank?: string
  ) => void;
  onSendSuperChat: (payload: {
    amount: number;
    method: SuperChatMethod;
    author: string;
    text: string;
  }) => void;
  onSendHype: () => void;
  onExitPreview?: () => void;
  onLeaveWatch?: () => void;
}

type ShopSubTab = 'lookbook' | 'claims' | 'qa';
type GamerSubTab = 'squad' | 'rig' | 'clips' | 'poll';
type ProgramSubTab = 'agenda' | 'poll' | 'clips';
type RailTab = 'chat' | 'companion' | 'qa' | 'bag';

const WATCH_AVATAR_TONES = [
  'bg-sky-400/15 text-sky-200 border-sky-300/25',
  'bg-indigo-400/15 text-indigo-200 border-indigo-300/25',
  'bg-emerald-400/15 text-emerald-200 border-emerald-300/25',
  'bg-amber-400/15 text-amber-200 border-amber-300/25',
  'bg-rose-400/15 text-rose-200 border-rose-300/25',
  'bg-cyan-400/15 text-cyan-200 border-cyan-300/25',
];

function getWatchAvatar(name: string): { initials: string; cls: string } {
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
  return { initials, cls: WATCH_AVATAR_TONES[hash % WATCH_AVATAR_TONES.length] };
}

function formatClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const rem = Math.floor(safe % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function computeBagLinePricing(
  item: BagItem,
  flashSale: FlashSaleState | null | undefined,
  nowMs: number
): { unitPrice: number; retailTotal: number; lineTotal: number; savings: number; discountLabel?: string } {
  const retailTotal = item.product.price * item.quantity;
  const flashActive =
    Boolean(flashSale?.active) &&
    flashSale!.productId === item.product.id &&
    flashSale!.endsAt > nowMs &&
    flashSale!.soldUnits < flashSale!.totalUnits;

  let pct = 0;
  let discountLabel: string | undefined;

  if (flashActive && flashSale) {
    const trioTier = flashSale.bundles?.find((b) => b.quantity >= 3);
    const duoTier = flashSale.bundles?.find((b) => b.quantity === 2);
    if (item.quantity >= 3) {
      pct = trioTier?.discountPct || Math.min(60, flashSale.discountPct + 18);
      discountLabel = `3× VIP Flash (-${pct}%)`;
    } else if (item.quantity === 2) {
      pct = duoTier?.discountPct || Math.min(50, flashSale.discountPct + 10);
      discountLabel = `2× Duo Flash (-${pct}%)`;
    } else {
      pct = flashSale.discountPct;
      discountLabel = `Flash Drop (-${pct}%)`;
    }
  } else if (item.quantity >= 3) {
    pct = 15;
    discountLabel = '3+ Bundle (-15%)';
  } else if (item.quantity === 2) {
    pct = 10;
    discountLabel = '2× Bundle (-10%)';
  }

  const unitPrice = Number((item.product.price * (1 - pct / 100)).toFixed(2));
  const lineTotal = Number((unitPrice * item.quantity).toFixed(2));
  const savings = Math.max(0, Number((retailTotal - lineTotal).toFixed(2)));
  return { unitPrice, retailTotal, lineTotal, savings, discountLabel };
}

const GoogleMarkSvg: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

interface InChatPaymentCardProps {
  headline: string;
  subline?: string;
  suggestedAmounts?: number[];
  initialAmount?: number;
  payouts: PayoutSettings;
  viewerName: string;
  compact?: boolean;
  onClose?: () => void;
  onSubmitTip: (payload: {
    amount: number;
    method: SuperChatMethod;
    author: string;
    text: string;
  }) => void;
}

const InChatPaymentWidget: React.FC<InChatPaymentCardProps> = ({
  headline,
  subline,
  suggestedAmounts = [5, 10, 25, 50],
  initialAmount = 10,
  payouts,
  viewerName,
  compact = false,
  onClose,
  onSubmitTip,
}) => {
  const availableMethods = useMemo<SuperChatMethod[]>(() => {
    const list: SuperChatMethod[] = ['card'];
    if (payouts.venmoHandle) list.push('venmo');
    if (payouts.paypalHandle) list.push('paypal');
    if (payouts.cashappTag) list.push('cashapp');
    if (payouts.stripeUrl) list.push('stripe');
    return list;
  }, [payouts]);

  const [amount, setAmount] = useState<number>(initialAmount);
  const [method, setMethod] = useState<SuperChatMethod>('card');
  const [note, setNote] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sentReceipt, setSentReceipt] = useState<number | null>(null);
  const [showInlineFrame, setShowInlineFrame] = useState(false);

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount]);

  const handleInfo = useMemo(() => {
    if (method === 'venmo' && payouts.venmoHandle) {
      const h = payouts.venmoHandle.replace(/^@/, '');
      return {
        label: 'Venmo',
        handle: `@${h}`,
        qrPayload: `https://venmo.com/${encodeURIComponent(h)}?txn=pay&amount=${amount}`,
      };
    }
    if (method === 'paypal' && payouts.paypalHandle) {
      const h = payouts.paypalHandle.replace(/^@/, '');
      return {
        label: 'PayPal',
        handle: `paypal.me/${h}`,
        qrPayload: `https://paypal.me/${encodeURIComponent(h)}/${amount}`,
      };
    }
    if (method === 'cashapp' && payouts.cashappTag) {
      const h = payouts.cashappTag.replace(/^\$/, '');
      return {
        label: 'Cash App',
        handle: `$${h}`,
        qrPayload: `https://cash.app/$${encodeURIComponent(h)}/${amount}`,
      };
    }
    if (method === 'stripe' && payouts.stripeUrl) {
      return {
        label: 'Creator Link',
        handle: payouts.stripeUrl.replace(/^https?:\/\//, '').slice(0, 28),
        qrPayload: payouts.stripeUrl,
      };
    }
    return null;
  }, [method, payouts, amount]);

  useEffect(() => {
    if (!handleInfo?.qrPayload) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    void QRCode.toDataURL(handleInfo.qrPayload, {
      width: 112,
      margin: 1,
      color: { dark: '#071024', light: '#ffffff' },
    }).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [handleInfo?.qrPayload]);

  const handleCompleteInChat = () => {
    if (processing) return;
    setProcessing(true);
    window.setTimeout(() => {
      onSubmitTip({
        amount: Math.max(1, Math.min(500, Math.round(amount || 5))),
        method,
        author: viewerName.trim() || 'Viewer',
        text: note.trim() || `Supported the stream directly in chat ($${amount})!`,
      });
      setProcessing(false);
      setSentReceipt(amount);
      setNote('');
      window.setTimeout(() => {
        setSentReceipt(null);
        onClose?.();
      }, 1500);
    }, 200);
  };

  return (
    <div className={`gather-pay-card rounded-[16px] ${compact ? 'p-3' : 'p-3.5'} space-y-2.5 animate-gather-msg`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink)]">
            <DollarSign className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" strokeWidth={1.75} />
            <span className="truncate">{headline}</span>
          </div>
          <p className="text-[11px] text-[var(--ink-2)] mt-0.5 leading-snug">
            {subline || '0% platform fee · Instant checkout inside chat'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment drawer"
            className="w-6 h-6 rounded-[7px] hover:bg-[var(--fill-hover)] text-[var(--ink-3)] hover:text-[var(--ink)] grid place-items-center cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {suggestedAmounts.slice(0, 4).map((preset) => {
          const active = amount === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              className={`h-8 rounded-[8px] text-[12px] font-mono-num font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                active
                  ? 'gather-btn-primary text-white'
                  : 'gather-liquid-pill text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              ${preset}
            </button>
          );
        })}
        <div className="relative flex items-center">
          <span className="absolute left-2 text-[11px] font-mono-num text-[var(--ink-3)] pointer-events-none">
            $
          </span>
          <input
            type="number"
            min={1}
            max={500}
            value={amount}
            aria-label="Custom tip amount"
            onChange={(e) => setAmount(Math.max(1, Math.min(500, Number(e.target.value || 1))))}
            className="w-full h-8 pl-5 pr-1.5 rounded-[8px] bg-white/[0.05] border border-white/12 text-[12px] font-mono-num font-semibold text-[var(--ink)] focus:outline-none focus:border-[var(--cyan)]"
          />
        </div>
      </div>

      <div className="gather-seg w-full overflow-x-auto gather-scroll">
        {availableMethods.map((m) => {
          const active = method === m;
          const label =
            m === 'card'
              ? 'Instant Pay'
              : m === 'venmo'
              ? 'Venmo'
              : m === 'paypal'
              ? 'PayPal'
              : m === 'cashapp'
              ? 'Cash App'
              : 'Sheet';
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethod(m);
                setShowInlineFrame(false);
              }}
              className={`gather-seg-btn flex-1 ${active ? 'active' : ''}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {method === 'card' ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px] bg-white/[0.03] border border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <CreditCard className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" strokeWidth={1.65} />
            <span className="text-[11.5px] text-[var(--ink-2)] truncate">
              Apple Pay · Google Pay · Card
            </span>
          </div>
          <span className="text-[10.5px] font-mono-num text-[var(--ok)] whitespace-nowrap shrink-0 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.65} />
            Direct
          </span>
        </div>
      ) : method === 'stripe' && payouts.stripeUrl ? (
        <div className="rounded-[10px] bg-white/[0.03] border border-white/10 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-[var(--ink-2)] truncate">
              Inline Checkout ({handleInfo?.handle})
            </span>
            <button
              type="button"
              onClick={() => setShowInlineFrame((v) => !v)}
              className="h-6 px-2.5 rounded-[6px] bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[11px] font-semibold text-[var(--accent-text)] cursor-pointer whitespace-nowrap shrink-0"
            >
              {showInlineFrame ? 'Hide' : 'Open'}
            </button>
          </div>
          {showInlineFrame && (
            <iframe
              src={payouts.stripeUrl}
              title="In-Chat Creator Payment Sheet"
              className="w-full h-44 rounded-[8px] border border-white/10 bg-white"
              sandbox="allow-scripts allow-forms allow-same-origin"
            />
          )}
        </div>
      ) : (
        handleInfo && (
          <div className="flex items-center gap-3 p-2.5 rounded-[10px] bg-white/[0.03] border border-white/10">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`Scan ${handleInfo.label} QR`}
                referrerPolicy="no-referrer"
                className="w-13 h-13 rounded-[7px] bg-white p-1 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-mono-num font-bold text-[var(--ink)] truncate">
                  {handleInfo.handle}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(handleInfo.handle);
                    setCopiedHandle(true);
                    window.setTimeout(() => setCopiedHandle(false), 1600);
                  }}
                  className="h-6 px-2 rounded-[6px] bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-semibold text-[var(--accent-text)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedHandle ? <Check className="w-3 h-3 text-[var(--ok)]" /> : <Copy className="w-3 h-3" />}
                  {copiedHandle ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-[var(--ink-3)] leading-tight flex items-center gap-1">
                <QrCode className="w-3 h-3 text-[var(--cyan)] shrink-0" />
                <span>Scan or copy handle</span>
              </p>
            </div>
          </div>
        )
      )}

      {sentReceipt !== null ? (
        <div className="h-9 rounded-[9px] bg-[var(--ok)]/16 border border-[var(--ok)]/35 px-3 flex items-center justify-center gap-2 text-[12px] font-semibold text-[var(--ok)]">
          <Check className="w-4 h-4" />
          <span>${sentReceipt} Tip Sent Live</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCompleteInChat();
              }
            }}
            placeholder="Add a shoutout note..."
            className="flex-1 min-w-0 h-9 px-3 rounded-[9px] bg-white/[0.045] border border-white/12 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
          />
          <button
            type="button"
            disabled={processing}
            onClick={handleCompleteInChat}
            className="h-9 px-3.5 rounded-[9px] gather-btn-tip text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{processing ? 'Sending...' : `Send $${amount}`}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const WatchPageView: React.FC<WatchPageViewProps> = ({
  room,
  clientId,
  isHost = false,
  user,
  onSignInWithGoogle,
  isSubscribed = false,
  subscribing = false,
  onToggleSubscribe,
  onRaiseHand,
  onLowerHand,
  broadcastStream,
  localPreviewCanvas,
  elapsedSec,
  isPreviewMode,
  bagOpen,
  onSetBagOpen,
  onBagCountChange,
  onSwitchWatchMode,
  onSendChat,
  onToggleChatLike,
  onToggleChatReaction,
  onPinChatMessage,
  onDeleteChatMessage,
  onBlockChatUser,
  onUnblockChatUser,
  onAskQuestion,
  onUpvoteQuestion,
  onPlaceOrder,
  onVotePoll,
  onCreateClip,
  onJoinSquadQueue,
  onSendSuperChat,
  onSendHype,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const isShopMode = room.watchMode === 'shop';
  const isGamerMode = room.watchMode === 'gamer';
  const isStandardMode = room.watchMode === 'standard';

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [railTab, setRailTab] = useState<RailTab>('chat');
  const [shopSubTab, setShopSubTab] = useState<ShopSubTab>('lookbook');
  const [gamerSubTab, setGamerSubTab] = useState<GamerSubTab>('squad');
  const [programSubTab, setProgramSubTab] = useState<ProgramSubTab>('agenda');
  const [viewerCaptionsOn, setViewerCaptionsOn] = useState(true);

  const [viewerName, setViewerName] = useState('Alex');
  const [chatText, setChatText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatReplyRef | null>(null);
  const [locallyBlocked, setLocallyBlocked] = useState<string[]>([]);
  const [tipDrawerOpen, setTipDrawerOpen] = useState(false);

  useEffect(() => {
    setTipDrawerOpen(false);
  }, [room.roomCode]);

  useEffect(() => {
    if (!isShopMode && railTab === 'bag') {
      setRailTab('chat');
      onSetBagOpen(false);
    }
    if (isShopMode && railTab === 'qa') {
      setRailTab('companion');
      setShopSubTab('qa');
    }
  }, [isShopMode, railTab, onSetBagOpen]);

  const [handPopoverOpen, setHandPopoverOpen] = useState(false);
  const [handTopic, setHandTopic] = useState('');

  const [questionDraft, setQuestionDraft] = useState('');
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>({});

  const [bag, setBag] = useState<BagItem[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [buyerFullName, setBuyerFullName] = useState('');
  const [buyerCity, setBuyerCity] = useState('Austin, TX');
  const [shippingAddress, setShippingAddress] = useState('410 Congress Ave');
  const [checkoutMethod, setCheckoutMethod] = useState<'Apple Pay' | 'Google Pay' | 'Card' | 'PayPal'>('Apple Pay');
  const [lastReceipt, setLastReceipt] = useState<CompletedReceipt | null>(null);

  const [votedPollId, setVotedPollId] = useState<string | null>(null);
  const [clipLabel, setClipLabel] = useState('');
  const [clipSavedToast, setClipSavedToast] = useState(false);
  const [squadHandle, setSquadHandle] = useState('');
  const [squadPlatform, setSquadPlatform] = useState('PC · Discord');
  const [squadRole, setSquadRole] = useState('Flex');
  const [squadRank, setSquadRank] = useState('Ascendant');
  const [squadJoined, setSquadJoined] = useState(false);

  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedLobby, setCopiedLobby] = useState(false);
  const [hypeParticles, setHypeParticles] = useState<FloatingHypeParticle[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (user?.displayName) {
      setViewerName(user.displayName);
      setBuyerFullName((prev) => prev || user.displayName || '');
    } else if (user?.email) {
      const localPart = user.email.split('@')[0];
      setViewerName(localPart);
      setBuyerFullName((prev) => prev || localPart);
    }
  }, [user?.displayName, user?.email]);

  const effectiveViewerName = useMemo(() => {
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return viewerName.trim() || 'Viewer';
  }, [user, viewerName]);

  const canPostToChat = Boolean(user) || isPreviewMode;

  useEffect(() => {
    if (bagOpen && isShopMode) {
      setRailTab('bag');
    }
  }, [bagOpen, isShopMode]);

  useEffect(() => {
    const count = isShopMode ? bag.reduce((sum, item) => sum + item.quantity, 0) : 0;
    onBagCountChange(count);
  }, [bag, isShopMode, onBagCountChange]);

  useEffect(() => {
    if (videoRef.current && broadcastStream) {
      videoRef.current.srcObject = broadcastStream;
      void videoRef.current.play().catch(() => {});
    }
  }, [broadcastStream]);

  useEffect(() => {
    if (!isPreviewMode || !localPreviewCanvas || !mirrorCanvasRef.current) return;
    let raf = 0;
    const dst = mirrorCanvasRef.current;
    const ctx = dst.getContext('2d');
    const copyFrame = () => {
      if (ctx && localPreviewCanvas.width > 0 && localPreviewCanvas.height > 0) {
        if (dst.width !== localPreviewCanvas.width || dst.height !== localPreviewCanvas.height) {
          dst.width = localPreviewCanvas.width;
          dst.height = localPreviewCanvas.height;
        }
        ctx.drawImage(localPreviewCanvas, 0, 0);
      }
      raf = requestAnimationFrame(copyFrame);
    };
    raf = requestAnimationFrame(copyFrame);
    return () => cancelAnimationFrame(raf);
  }, [isPreviewMode, localPreviewCanvas]);

  useEffect(() => {
    if (chatScrollRef.current && railTab === 'chat') {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [room.chatMessages.length, railTab, tipDrawerOpen]);

  const pinnedProduct = useMemo(
    () =>
      isShopMode
        ? room.commerce.products.find((p) => p.id === room.commerce.pinnedProductId) ||
          room.commerce.products[0]
        : undefined,
    [isShopMode, room.commerce.products, room.commerce.pinnedProductId]
  );

  const lookbookOthers = useMemo(
    () =>
      isShopMode
        ? room.commerce.products.filter((p) => p.id !== pinnedProduct?.id)
        : [],
    [isShopMode, room.commerce.products, pinnedProduct?.id]
  );

  const activeFlashSale = useMemo(() => {
    const fs = room.commerce.activeFlashSale;
    if (!isShopMode || !fs || !fs.active || fs.endsAt <= nowMs) return null;
    return fs;
  }, [isShopMode, room.commerce.activeFlashSale, nowMs]);

  const flashProduct = useMemo(() => {
    if (!activeFlashSale) return undefined;
    return (
      room.commerce.products.find((p) => p.id === activeFlashSale.productId) || pinnedProduct
    );
  }, [activeFlashSale, room.commerce.products, pinnedProduct]);

  const sortedQuestions = useMemo<AudienceQuestion[]>(() => {
    return [...(room.questions || [])].sort((a, b) => b.upvotes - a.upvotes);
  }, [room.questions]);

  const bagPricing = useMemo(() => {
    let retailSubtotal = 0;
    let finalTotal = 0;
    let totalSavings = 0;
    const lines = bag.map((item) => {
      const calc = computeBagLinePricing(item, activeFlashSale, nowMs);
      retailSubtotal += calc.retailTotal;
      finalTotal += calc.lineTotal;
      totalSavings += calc.savings;
      return { item, ...calc };
    });
    return {
      lines,
      retailSubtotal: Number(retailSubtotal.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
      totalSavings: Number(totalSavings.toFixed(2)),
    };
  }, [bag, activeFlashSale, nowMs]);

  const addToBag = (product: ProductItem, quantityToAdd = 1, bundleLabel?: string, openDrawer = true) => {
    const variant = selectedVariants[product.id] || product.variants[0] || 'Standard';
    setLastReceipt(null);
    setBag((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.product.id === product.id && i.variant === variant
      );
      if (existingIdx >= 0) {
        return prev.map((item, idx) =>
          idx === existingIdx
            ? {
                ...item,
                quantity: Math.min(product.stock, Math.max(item.quantity + quantityToAdd, quantityToAdd)),
                bundleLabel: bundleLabel || item.bundleLabel,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          variant,
          quantity: Math.min(product.stock, Math.max(1, quantityToAdd)),
          bundleLabel,
        },
      ];
    });
    if (openDrawer) {
      setRailTab('bag');
      onSetBagOpen(true);
    }
  };

  const setBundleInBag = (product: ProductItem, targetQuantity: number, bundleLabel: string) => {
    const variant = selectedVariants[product.id] || product.variants[0] || 'Standard';
    setLastReceipt(null);
    setBag((prev) => {
      const filtered = prev.filter((i) => !(i.product.id === product.id && i.variant === variant));
      return [
        ...filtered,
        {
          product,
          variant,
          quantity: Math.min(Math.max(1, product.stock), targetQuantity),
          bundleLabel,
        },
      ];
    });
    setRailTab('bag');
    onSetBagOpen(true);
  };

  const handleCompleteBagOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (bag.length === 0) return;
    const buyer = (buyerFullName || effectiveViewerName).trim() || 'Live Shopper';
    const city = buyerCity.trim() || 'Austin, TX';
    const addr = shippingAddress.trim() || 'Express In-Stream Delivery';
    const orderNumber = `GTH-${Math.floor(1000 + Math.random() * 9000)}`;

    const itemsPayload = bagPricing.lines.map(({ item, discountLabel }) => ({
      productId: item.product.id,
      quantity: item.quantity,
      variant: item.variant,
      bundleLabel: discountLabel || item.bundleLabel,
    }));

    onPlaceOrder({
      buyerName: buyer,
      buyerCity: city,
      paymentMethod: checkoutMethod,
      items: itemsPayload,
    });

    setLastReceipt({
      orderNumber,
      buyerName: buyer,
      buyerCity: city,
      shippingAddress: addr,
      paymentMethod: checkoutMethod,
      items: bagPricing.lines.map(({ item, lineTotal, discountLabel }) => ({
        title: item.product.title,
        source: item.product.source,
        variant: item.variant,
        quantity: item.quantity,
        lineTotal,
        bundleLabel: discountLabel || item.bundleLabel,
      })),
      subtotal: bagPricing.retailSubtotal,
      savings: bagPricing.totalSavings,
      total: bagPricing.finalTotal,
      createdAt: Date.now(),
    });
    setBag([]);
  };

  const triggerHypeBurst = () => {
    onSendHype();
    const kinds: FloatingHypeParticle['kind'][] = ['flame', 'zap', 'heart', 'spark'];
    const id = `hp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next: FloatingHypeParticle = {
      id,
      leftPct: 72 + Math.round(Math.random() * 20),
      kind: kinds[Math.floor(Math.random() * kinds.length)],
    };
    setHypeParticles((prev) => [...prev.slice(-8), next]);
    window.setTimeout(() => {
      setHypeParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1250);
  };

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPostToChat || !chatText.trim()) return;
    onSendChat(chatText.trim(), effectiveViewerName, replyingTo || undefined);
    setChatText('');
    setReplyingTo(null);
  };

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPostToChat || !questionDraft.trim()) return;
    if (onAskQuestion) {
      onAskQuestion(questionDraft.trim(), effectiveViewerName);
    } else {
      onSendChat(`Q: ${questionDraft.trim()}`, effectiveViewerName);
    }
    setQuestionDraft('');
  };

  const myHandEntry = useMemo(() => {
    const queue = room.handRaiseQueue || [];
    return queue.find(
      (h) => (clientId && h.id === clientId) || (user?.uid && h.uid === user.uid)
    );
  }, [room.handRaiseQueue, clientId, user?.uid]);

  const myHandPosition = useMemo(() => {
    if (!myHandEntry) return 0;
    return (room.handRaiseQueue || []).findIndex((h) => h.id === myHandEntry.id) + 1;
  }, [room.handRaiseQueue, myHandEntry]);

  const liveSalePopup = useMemo(() => {
    const p = room.commerce.latestSalePopup;
    if (!p || nowMs - p.createdAt > 7500) return null;
    return p;
  }, [room.commerce.latestSalePopup, nowMs]);

  const activeHypeTrain = useMemo(() => {
    const ht = room.hypeTrain;
    if (!ht || !ht.active || ht.endsAt <= nowMs) return null;
    return ht;
  }, [room.hypeTrain, nowMs]);

  const activePoll = room.gamer.activePoll;
  const totalPollVotes = activePoll
    ? activePoll.options.reduce((sum, o) => sum + o.votes, 0)
    : 0;
  const isVertical = room.aspectRatio === '9:16';
  const onStageSpeakers = room.participants.filter((p) => p.onStage);
  const bagTotalCount = bag.reduce((s, i) => s + i.quantity, 0);

  const liveCaptionLine =
    room.overlays.captionText ||
    `${onStageSpeakers[0]?.name || 'Host'}: Welcome to ${room.title} — drop your questions in Q&A.`;

  const renderStageViewport = () => (
    <div className="flex-1 min-h-0 w-full flex flex-col gather-glass rounded-[20px] p-1.5 sm:p-2 relative overflow-hidden">
      <div className="gather-stage-wrap relative min-h-[260px]">
        {isPreviewMode && localPreviewCanvas ? (
          <div className={isVertical ? 'gather-stage-frame-vertical' : 'gather-stage-frame'}>
            <canvas ref={mirrorCanvasRef} className="w-full h-full block object-contain" />
          </div>
        ) : broadcastStream ? (
          <div className={isVertical ? 'gather-stage-frame-vertical' : 'gather-stage-frame'}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              controls
              className="w-full h-full object-contain bg-[#03060f]"
            />
          </div>
        ) : (
          <StageCanvas
            room={room}
            localClientId="watch-viewer"
            localStream={null}
            screenStream={null}
            remoteStreams={{}}
            activeMedia={null}
            videoFx={DEFAULT_VIDEO_FX}
            editMode={false}
            viewerMode
            onExitEditMode={() => {}}
            onUpdateCustomElements={() => {}}
            onDropMediaFile={() => {}}
            onMediaPageChange={() => {}}
            onStopMedia={() => {}}
            onCanvasReady={() => {}}
          />
        )}

        {/* Ephemeral Live Claim Toast */}
        {liveSalePopup && (
          <div className="pointer-events-none absolute top-3.5 left-1/2 -translate-x-1/2 z-20 max-w-[90%] px-3.5 py-2 rounded-[14px] gather-glass-elevated border-emerald-400/40 flex items-center gap-3 animate-gather-msg">
            {liveSalePopup.productImageUrl && (
              <img
                src={liveSalePopup.productImageUrl}
                alt={liveSalePopup.productTitle}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-[8px] object-cover border border-white/15 shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10.5px] font-mono-num font-semibold text-emerald-400">
                <span>Claimed #{liveSalePopup.orderNumber}</span>
                <span className="text-white/90">${liveSalePopup.total.toFixed(2)}</span>
              </div>
              <div className="text-[12px] font-medium text-white truncate">
                {liveSalePopup.buyerName} · {liveSalePopup.quantity}× {liveSalePopup.productTitle}
              </div>
            </div>
          </div>
        )}

        {/* Floating Hype Bursts */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {hypeParticles.map((p) => (
            <div
              key={p.id}
              style={{ left: `${p.leftPct}%`, bottom: '20px' }}
              className="absolute animate-gather-float"
            >
              <div className="w-8 h-8 rounded-full gather-glass-elevated grid place-items-center text-[var(--cyan)]">
                {p.kind === 'flame' ? (
                  <Flame className="w-4 h-4 text-amber-400" strokeWidth={1.65} />
                ) : p.kind === 'heart' ? (
                  <Heart className="w-4 h-4 text-rose-400" strokeWidth={1.65} />
                ) : p.kind === 'spark' ? (
                  <Sparkles className="w-4 h-4 text-sky-300" strokeWidth={1.65} />
                ) : (
                  <Zap className="w-4 h-4 text-emerald-400" strokeWidth={1.65} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRaiseHandControl = () =>
    onRaiseHand ? (
      <div className="relative">
        {myHandEntry ? (
          <button
            type="button"
            onClick={() => onLowerHand?.()}
            className="h-8 px-3 rounded-[10px] bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Hand className="w-3.5 h-3.5" strokeWidth={1.65} />
            <span className="font-mono-num">#{myHandPosition} · Lower</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setHandPopoverOpen((v) => !v)}
            className="h-8 px-3 rounded-[10px] gather-liquid-pill text-[12px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Hand className="w-3.5 h-3.5 text-amber-300" strokeWidth={1.65} />
            <span>Call In</span>
          </button>
        )}

        {handPopoverOpen && !myHandEntry && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRaiseHand(
                handTopic.trim() || 'Would love to join the live stage for a quick question!'
              );
              setHandTopic('');
              setHandPopoverOpen(false);
            }}
            className="absolute right-0 top-10 z-40 w-[280px] p-3.5 rounded-[16px] gather-glass-elevated space-y-2.5"
          >
            <div className="flex items-center justify-between text-[12px] font-semibold text-[var(--ink)]">
              <span>Request Stage Call-In</span>
              <button
                type="button"
                onClick={() => setHandPopoverOpen(false)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.65} />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={handTopic}
              onChange={(e) => setHandTopic(e.target.value)}
              placeholder="Topic or question for the host..."
              className="w-full h-8 px-2.5 rounded-[8px] bg-white/[0.05] border border-white/12 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
            />
            <button
              type="submit"
              className="w-full h-8 rounded-[8px] gather-btn-primary text-[12px] font-semibold cursor-pointer whitespace-nowrap"
            >
              Send Request
            </button>
          </form>
        )}
      </div>
    ) : null;

  const renderShareButton = () => (
    <button
      type="button"
      onClick={() => {
        const url = `${window.location.origin}/?watch=${room.roomCode}`;
        void navigator.clipboard.writeText(url);
        setCopiedShare(true);
        window.setTimeout(() => setCopiedShare(false), 1800);
      }}
      aria-label="Copy Watch Link"
      className="h-8 px-3 rounded-[10px] gather-liquid-pill text-[12px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
    >
      {copiedShare ? (
        <Check className="w-3.5 h-3.5 text-[var(--ok)]" strokeWidth={1.75} />
      ) : (
        <Share2 className="w-3.5 h-3.5" strokeWidth={1.65} />
      )}
      <span>{copiedShare ? 'Copied' : 'Share'}</span>
    </button>
  );

  const renderNotifyButton = () =>
    onToggleSubscribe ? (
      <button
        type="button"
        disabled={subscribing}
        onClick={() => void onToggleSubscribe()}
        className={`h-8 px-3 rounded-[10px] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
          isSubscribed
            ? 'bg-emerald-500/14 border border-emerald-400/30 text-emerald-300'
            : 'gather-liquid-pill text-[var(--ink-2)] hover:text-[var(--ink)]'
        }`}
      >
        {isSubscribed ? (
          <BellRing className="w-3.5 h-3.5" strokeWidth={1.65} />
        ) : (
          <Bell className="w-3.5 h-3.5 text-[var(--cyan)]" strokeWidth={1.65} />
        )}
        <span>{subscribing ? 'Saving...' : isSubscribed ? 'Subscribed' : 'Notify'}</span>
      </button>
    ) : null;

  const renderFormatSwitch = () =>
    isPreviewMode && onSwitchWatchMode ? (
      <div className="gather-seg shrink-0" role="tablist" aria-label="Preview Stream Format">
        {(
          [
            { id: 'standard', label: 'Broadcast' },
            { id: 'shop', label: 'Shop' },
            { id: 'gamer', label: 'Arena' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={room.watchMode === m.id}
            onClick={() => onSwitchWatchMode(m.id)}
            className={`gather-seg-btn ${room.watchMode === m.id ? 'active' : ''}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col lg:overflow-hidden">
      {/* 75% Cinema Stage / 25% Unified Liquid-Glass Companion Rail */}
      <div className="flex-1 min-h-0 w-full px-2 sm:px-3.5 pb-2.5 grid grid-cols-1 lg:grid-cols-[calc(75%-6px)_calc(25%-6px)] gap-3 overflow-y-auto lg:overflow-hidden">
        {/* ===================================================================== */}
        {/* LEFT COLUMN (75%): CINEMA STAGE + MINIMAL HEADER + BELOW-STAGE BAR    */}
        {/* ===================================================================== */}
        <section className="min-h-0 min-w-0 w-full flex flex-col gap-2.5 overflow-hidden">
          {/* Unified Editorial Stream Header */}
          <header className="relative z-20 shrink-0 px-1 pt-0.5 pb-1.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ink-3)]">
                <span
                  className={`font-semibold font-mono-num whitespace-nowrap inline-flex items-center gap-1.5 ${
                    room.isLive ? 'text-[var(--live)]' : 'text-[var(--cyan)]'
                  }`}
                >
                  {room.isLive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--live)]" />}
                  {room.isLive ? `Live · ${formatClock(elapsedSec)}` : 'Preview'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono-num text-[var(--ink-2)]">
                  <Users className="w-3 h-3 text-[var(--ink-3)]" strokeWidth={1.65} />
                  {Math.max(1, room.viewerCount)}
                </span>

                {isShopMode && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[var(--cyan)]">{room.commerce.storeLabel}</span>
                  </>
                )}

                {isGamerMode && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[var(--cyan)]">{room.gamer.gameTitle}</span>
                    {room.gamer.currentMap && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{room.gamer.currentMap}</span>
                      </>
                    )}
                    {room.gamer.seriesScore && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono-num font-semibold text-amber-300">
                          <Trophy className="w-3 h-3" strokeWidth={1.65} />
                          {room.gamer.seriesScore}
                        </span>
                      </>
                    )}
                  </>
                )}

                {isStandardMode && onStageSpeakers.length > 0 && (
                  <>
                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline truncate text-[var(--ink-2)]">
                      {onStageSpeakers.map((s) => s.name).join(', ')}
                    </span>
                  </>
                )}

                {isStandardMode && room.upcomingStream && (
                  <>
                    <span aria-hidden="true" className="hidden xl:inline">·</span>
                    <a
                      href={`/api/notifications/calendar.ics?title=${encodeURIComponent(
                        room.upcomingStream.title
                      )}&iso=${encodeURIComponent(
                        room.upcomingStream.scheduledIso
                      )}&roomCode=${encodeURIComponent(room.roomCode)}`}
                      download={`gather-${room.roomCode}.ics`}
                      className="hidden xl:inline-flex items-center gap-1 text-[var(--accent-text)] hover:underline whitespace-nowrap shrink-0"
                    >
                      <Calendar className="w-3 h-3" strokeWidth={1.65} />
                      <span>{room.upcomingStream.title}</span>
                    </a>
                  </>
                )}
              </div>

              <h1 className="font-editorial text-[20px] sm:text-[24px] font-semibold tracking-[-0.025em] leading-tight text-[var(--ink)] text-balance truncate">
                {room.title}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {renderFormatSwitch()}

              {isGamerMode && room.gamer.lobbyCode && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(room.gamer.lobbyCode);
                    setCopiedLobby(true);
                    window.setTimeout(() => setCopiedLobby(false), 1600);
                  }}
                  className="h-8 px-3 rounded-[10px] gather-liquid-pill text-[11.5px] font-mono-num font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedLobby ? (
                    <Check className="w-3.5 h-3.5 text-[var(--ok)]" strokeWidth={1.75} />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[var(--cyan)]" strokeWidth={1.65} />
                  )}
                  <span>{copiedLobby ? 'Copied' : room.gamer.lobbyCode}</span>
                </button>
              )}

              {isGamerMode && (
                <button
                  type="button"
                  onClick={triggerHypeBurst}
                  className="h-8 px-3.5 rounded-[10px] gather-btn-primary text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Flame className="w-3.5 h-3.5" strokeWidth={1.65} />
                  <span>Hype</span>
                  <span className="font-mono-num opacity-95">{room.gamer.hypeCount}</span>
                </button>
              )}

              {isShopMode && (
                <button
                  type="button"
                  onClick={() => {
                    setRailTab('bag');
                    onSetBagOpen(true);
                  }}
                  className="h-8 px-3.5 rounded-[10px] gather-btn-primary text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.65} />
                  <span>Bag ({bagTotalCount})</span>
                  {bagPricing.finalTotal > 0 && (
                    <span className="font-mono-num opacity-95">· ${bagPricing.finalTotal.toFixed(0)}</span>
                  )}
                </button>
              )}

              {isStandardMode && (
                <button
                  type="button"
                  onClick={() => setViewerCaptionsOn((v) => !v)}
                  className={`h-8 px-3 rounded-[10px] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    viewerCaptionsOn
                      ? 'bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[var(--accent-text)]'
                      : 'gather-liquid-pill text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Captions className="w-3.5 h-3.5" strokeWidth={1.65} />
                  <span>Captions</span>
                </button>
              )}

              {!isShopMode && renderRaiseHandControl()}
              {renderNotifyButton()}
              {renderShareButton()}
            </div>
          </header>

          {/* Maximized 75% Cinema Video Player */}
          {renderStageViewport()}

          {/* BELOW-PLAYER CONTEXTUAL STRIPS (Never Overlapping Video) */}
          {isShopMode && activeFlashSale && flashProduct ? (
            <div className="shrink-0 gather-glass rounded-[14px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center gap-1.5 font-mono-num text-[12.5px] font-semibold text-amber-300 whitespace-nowrap shrink-0">
                  <Clock className="w-3.5 h-3.5" strokeWidth={1.65} />
                  {formatClock((activeFlashSale.endsAt - nowMs) / 1000)}
                </span>
                <span className="font-editorial text-[14.5px] font-semibold text-[var(--ink)] truncate">
                  {flashProduct.title}
                </span>
                <span className="font-mono-num text-[11.5px] text-amber-300/90 whitespace-nowrap shrink-0">
                  {Math.max(0, activeFlashSale.totalUnits - activeFlashSale.soldUnits)} left
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(() => {
                  const duoPct =
                    activeFlashSale.bundles?.find((b) => b.quantity === 2)?.discountPct ||
                    Math.min(50, activeFlashSale.discountPct + 10);
                  const trioPct =
                    activeFlashSale.bundles?.find((b) => b.quantity >= 3)?.discountPct ||
                    Math.min(60, activeFlashSale.discountPct + 18);
                  return (
                    <>
                      <button
                        type="button"
                        disabled={flashProduct.stock <= 0}
                        onClick={() => setBundleInBag(flashProduct, 1, `1× Flash (-${activeFlashSale.discountPct}%)`)}
                        className="h-7 px-3 rounded-[8px] gather-liquid-pill text-[11.5px] font-mono-num font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap"
                      >
                        1× ${(flashProduct.price * (1 - activeFlashSale.discountPct / 100)).toFixed(0)}
                      </button>
                      <button
                        type="button"
                        disabled={flashProduct.stock < 2}
                        onClick={() => setBundleInBag(flashProduct, 2, `2× Duo (-${duoPct}%)`)}
                        className="h-7 px-3 rounded-[8px] bg-amber-500/18 hover:bg-amber-500/28 border border-amber-400/35 text-[11.5px] font-mono-num font-semibold text-amber-200 cursor-pointer whitespace-nowrap transition-colors"
                      >
                        2× -{duoPct}%
                      </button>
                      <button
                        type="button"
                        disabled={flashProduct.stock < 3}
                        onClick={() => setBundleInBag(flashProduct, 3, `3× VIP (-${trioPct}%)`)}
                        className="h-7 px-3 rounded-[8px] gather-btn-tip text-[11.5px] font-mono-num font-semibold cursor-pointer whitespace-nowrap"
                      >
                        3× -{trioPct}%
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : isShopMode && room.commerce.recentOrders.length > 0 ? (
            <div className="shrink-0 gather-glass rounded-[12px] px-4 py-2 flex items-center justify-between gap-3 text-[12px]">
              <div className="flex items-center gap-2 min-w-0">
                <Zap className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" strokeWidth={1.65} />
                <span className="truncate text-[var(--ink-2)]">
                  Latest claim:{' '}
                  <strong className="text-[var(--ink)]">{room.commerce.recentOrders[0].buyerName}</strong> ·{' '}
                  {room.commerce.recentOrders[0].quantity}× {room.commerce.recentOrders[0].productTitle}
                </span>
              </div>
              <span className="font-mono-num font-semibold text-[var(--ok)] shrink-0">
                ${room.commerce.recentOrders[0].total.toFixed(2)}
              </span>
            </div>
          ) : null}

          {isGamerMode && activePoll && activePoll.options.length >= 2 && (
            <div className="shrink-0 gather-glass rounded-[14px] px-4 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="font-semibold text-[var(--ink)] flex items-center gap-1.5 truncate">
                  <BarChart3 className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" strokeWidth={1.65} />
                  <span className="truncate">{activePoll.question}</span>
                </span>
                <span className="font-mono-num text-[11.5px] text-[var(--ink-3)] shrink-0">
                  {totalPollVotes} predictions
                </span>
              </div>
              {(() => {
                const leftOpt = activePoll.options[0];
                const rightOpt = activePoll.options[1];
                const leftPct =
                  totalPollVotes > 0 ? Math.round((leftOpt.votes / totalPollVotes) * 100) : 50;
                const rightPct = 100 - leftPct;
                const hasVoted = votedPollId === activePoll.id;
                return (
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden flex">
                      <div
                        style={{ width: `${leftPct}%` }}
                        className="h-full bg-gradient-to-r from-[#3b82f6] to-[#7dd3fc] transition-all duration-500 ease-out"
                      />
                      <div
                        style={{ width: `${rightPct}%` }}
                        className="h-full bg-gradient-to-r from-[#818cf8] to-[#f43f5e] transition-all duration-500 ease-out"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { opt: leftOpt, pct: leftPct, tone: 'text-[var(--cyan)]' },
                        { opt: rightOpt, pct: rightPct, tone: 'text-rose-300' },
                      ].map(({ opt, pct, tone }) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!activePoll.isOpen || hasVoted}
                          onClick={() => {
                            onVotePoll(opt.id);
                            setVotedPollId(activePoll.id);
                          }}
                          className="h-7 px-3 rounded-[8px] gather-liquid-pill flex items-center justify-between gap-2 text-[11.5px] cursor-pointer disabled:cursor-default"
                        >
                          <span className="truncate font-medium text-[var(--ink)]">{opt.label}</span>
                          <span className={`font-mono-num font-bold shrink-0 ${tone}`}>{pct}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {isStandardMode && viewerCaptionsOn && (
            <div className="shrink-0 gather-glass rounded-[12px] px-4 py-2 flex items-center gap-2.5 text-[12px] text-[var(--ink)]">
              <Captions className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" strokeWidth={1.65} />
              <p className="truncate leading-snug text-[var(--ink-2)]">{liveCaptionLine}</p>
            </div>
          )}
        </section>

        {/* ===================================================================== */}
        {/* RIGHT RAIL (25%): UNIFIED DEEP OBSIDIAN LIQUID-GLASS CONSOLE           */}
        {/* ===================================================================== */}
        <aside className="gather-glass-elevated rounded-[20px] flex flex-col min-h-[460px] lg:min-h-0 lg:h-full w-full overflow-hidden">
          {/* Single Compact Header Tab Bar */}
          <div className="px-3 py-2.5 border-b border-[var(--line)] shrink-0">
            <div className="gather-seg w-full" role="tablist" aria-label="Stream Companion">
              <button
                type="button"
                role="tab"
                aria-selected={railTab === 'chat'}
                onClick={() => {
                  setRailTab('chat');
                  onSetBagOpen(false);
                }}
                className={`gather-seg-btn flex-1 ${railTab === 'chat' ? 'active' : ''}`}
              >
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.65} />
                <span>{isGamerMode ? 'Chat' : 'Live Chat'}</span>
              </button>

              {isShopMode && (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={railTab === 'companion'}
                    onClick={() => {
                      setRailTab('companion');
                      onSetBagOpen(false);
                    }}
                    className={`gather-seg-btn flex-1 ${railTab === 'companion' ? 'active' : ''}`}
                  >
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={1.65} />
                    <span>Shop ({room.commerce.products.length})</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={railTab === 'bag'}
                    onClick={() => {
                      setRailTab('bag');
                      onSetBagOpen(true);
                    }}
                    className={`gather-seg-btn flex-1 ${railTab === 'bag' ? 'active' : ''}`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.65} />
                    <span>Bag ({bagTotalCount})</span>
                  </button>
                </>
              )}

              {isGamerMode && (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={railTab === 'companion'}
                    onClick={() => setRailTab('companion')}
                    className={`gather-seg-btn flex-1 ${railTab === 'companion' ? 'active' : ''}`}
                  >
                    <Gamepad2 className="w-3.5 h-3.5" strokeWidth={1.65} />
                    <span>Arena</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={railTab === 'qa'}
                    onClick={() => setRailTab('qa')}
                    className={`gather-seg-btn flex-1 ${railTab === 'qa' ? 'active' : ''}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.65} />
                    <span>Q&amp;A ({sortedQuestions.length})</span>
                  </button>
                </>
              )}

              {isStandardMode && (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={railTab === 'qa'}
                    onClick={() => setRailTab('qa')}
                    className={`gather-seg-btn flex-1 ${railTab === 'qa' ? 'active' : ''}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.65} />
                    <span>Q&amp;A ({sortedQuestions.length})</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={railTab === 'companion'}
                    onClick={() => setRailTab('companion')}
                    className={`gather-seg-btn flex-1 ${railTab === 'companion' ? 'active' : ''}`}
                  >
                    <ListChecks className="w-3.5 h-3.5" strokeWidth={1.65} />
                    <span>Program</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* TAB 1: LIVE CHAT                                                  */}
          {/* ================================================================= */}
          {railTab === 'chat' && (
            <>
              {activeHypeTrain && (
                <div className="px-3.5 py-2 border-b border-[var(--line)] shrink-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                      <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={1.65} />
                      <span>Hype Train · Lv.{activeHypeTrain.level}</span>
                    </span>
                    <span className="font-mono-num text-[var(--ink-3)]">
                      {Math.round(
                        (activeHypeTrain.points / Math.max(1, activeHypeTrain.goalPoints)) * 100
                      )}
                      % · {formatClock((activeHypeTrain.endsAt - nowMs) / 1000)}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (activeHypeTrain.points / Math.max(1, activeHypeTrain.goalPoints)) * 100
                          )
                        )}%`,
                      }}
                      className="h-full bg-gradient-to-r from-[#7dd3fc] via-[#3b82f6] to-[#10b981] transition-all duration-300"
                    />
                  </div>
                </div>
              )}

              {(() => {
                const pinned = room.pinnedChatId
                  ? room.chatMessages.find((m) => m.id === room.pinnedChatId)
                  : null;
                if (!pinned) return null;
                return (
                  <div className="px-3.5 py-2 border-b border-[var(--line)] bg-[var(--accent-soft)] flex items-center justify-between gap-2 text-[11.5px] shrink-0">
                    <div className="min-w-0 truncate">
                      <Pin className="w-3 h-3 text-[var(--cyan)] inline mr-1.5" strokeWidth={1.65} />
                      <span className="font-semibold text-[var(--ink)]">{pinned.author}: </span>
                      <span className="text-[var(--ink-2)]">{pinned.text}</span>
                    </div>
                    {isHost && onPinChatMessage && (
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

              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto px-2.5 pt-4 pb-2 space-y-1 gather-scroll min-h-0"
              >
                {room.chatMessages
                  .filter((msg) => {
                    if (msg.role === 'payment-card') return false;
                    if (locallyBlocked.includes(msg.author.toLowerCase())) return false;
                    return true;
                  })
                  .map((msg) => {
                    const actorKey = user?.uid || clientId || effectiveViewerName;
                    const likedByMe = Boolean(msg.likedBy?.includes(actorKey));
                    const likeCount = msg.likes ?? msg.likedBy?.length ?? 0;
                    const isPinned = room.pinnedChatId === msg.id;
                    const isOwn =
                      (user?.uid && msg.authorUid === user.uid) ||
                      msg.author.toLowerCase() === effectiveViewerName.toLowerCase();
                    const av = getWatchAvatar(msg.author);
                    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    if (msg.role === 'superchat' && msg.superChat) {
                      const tierStyles =
                        msg.superChat.tier === 'rose'
                          ? 'border-rose-400/35 bg-gradient-to-br from-rose-500/18 via-fuchsia-500/8 to-transparent'
                          : msg.superChat.tier === 'amber'
                          ? 'border-amber-400/35 bg-gradient-to-br from-amber-500/18 via-orange-500/8 to-transparent'
                          : msg.superChat.tier === 'emerald'
                          ? 'border-emerald-400/35 bg-gradient-to-br from-emerald-500/18 via-teal-500/8 to-transparent'
                          : 'border-sky-400/35 bg-gradient-to-br from-sky-500/18 via-blue-500/8 to-transparent';
                      return (
                        <div
                          key={msg.id}
                          className={`group relative my-1.5 p-3 rounded-[14px] border gather-superchat-sheen animate-gather-msg space-y-1.5 ${tierStyles}`}
                        >
                          {onToggleChatReaction && (
                            <HoverReactionMenu
                              reactions={msg.reactions}
                              actorId={actorKey}
                              onSelect={(emoji) => onToggleChatReaction(msg.id, emoji)}
                            />
                          )}
                          <div className="flex items-start gap-2.5">
                            {msg.avatarUrl ? (
                              <img
                                src={msg.avatarUrl}
                                alt={msg.author}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full object-cover border border-white/20 shrink-0"
                              />
                            ) : (
                              <span
                                className={`w-7 h-7 rounded-full border text-[10px] font-semibold grid place-items-center shrink-0 ${av.cls}`}
                              >
                                {av.initials}
                              </span>
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold text-[var(--ink)] truncate">
                                  {msg.author}{' '}
                                  <span className="font-mono-num font-normal text-[var(--ink-3)]">
                                    · {timeStr}
                                  </span>
                                </span>
                                <span className="font-mono-num font-bold text-[12px] text-[var(--ink)] shrink-0">
                                  ${msg.superChat.amount}
                                </span>
                              </div>
                              <p className="text-[12.5px] font-medium text-[var(--ink)] leading-snug">
                                {msg.text}
                              </p>
                              <ReactionBadgeRow
                                reactions={msg.reactions}
                                actorId={actorKey}
                                onToggle={
                                  onToggleChatReaction
                                    ? (emoji) => onToggleChatReaction(msg.id, emoji)
                                    : undefined
                                }
                              />
                              <div className="flex items-center gap-3 pt-0.5 text-[11px] text-[var(--ink-3)]">
                                {onToggleChatLike && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleChatLike(msg.id)}
                                    className={`inline-flex items-center gap-1 cursor-pointer ${
                                      likedByMe ? 'text-rose-400 font-semibold' : 'hover:text-[var(--ink)]'
                                    }`}
                                  >
                                    <Heart className={`w-3 h-3 ${likedByMe ? 'fill-current' : ''}`} />
                                    {likeCount > 0 && <span className="font-mono-num">{likeCount}</span>}
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
                                  className="inline-flex items-center gap-1 hover:text-[var(--ink)] cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                >
                                  <CornerUpLeft className="w-3 h-3" />
                                  <span>Reply</span>
                                </button>
                                {isHost && onPinChatMessage && (
                                  <button
                                    type="button"
                                    onClick={() => onPinChatMessage(isPinned ? null : msg.id)}
                                    className={`inline-flex items-center gap-1 cursor-pointer transition-opacity ${
                                      isPinned
                                        ? 'text-[var(--cyan)] font-semibold opacity-100'
                                        : 'hover:text-[var(--ink)] opacity-0 group-hover:opacity-100'
                                    }`}
                                  >
                                    <Pin className="w-3 h-3" />
                                    <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (msg.role === 'order') {
                      if (!isShopMode) return null;
                      return (
                        <div
                          key={msg.id}
                          className="my-1 px-3 py-2 rounded-[11px] bg-[var(--ok)]/10 border border-[var(--ok)]/25 text-[12px] space-y-0.5 animate-gather-msg"
                        >
                          <span className="text-[10.5px] font-mono-num font-semibold text-[var(--ok)]">
                            In-Stream Claim
                          </span>
                          <p className="text-[var(--ink)] font-medium">{msg.text}</p>
                        </div>
                      );
                    }

                    if (msg.role === 'system') {
                      return (
                        <div key={msg.id} className="text-[11px] text-[var(--ink-3)] px-2 py-1">
                          {msg.text}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className="group relative px-2.5 py-2 rounded-[11px] hover:bg-white/[0.04] transition-colors text-[12.5px] animate-gather-msg"
                      >
                        {onToggleChatReaction && (
                          <HoverReactionMenu
                            reactions={msg.reactions}
                            actorId={actorKey}
                            onSelect={(emoji) => onToggleChatReaction(msg.id, emoji)}
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
                              className={`w-7 h-7 rounded-full border text-[10px] font-semibold grid place-items-center shrink-0 mt-0.5 ${av.cls}`}
                            >
                              {av.initials}
                            </span>
                          )}

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="truncate">
                                <span
                                  className={`font-semibold ${
                                    msg.role === 'host' ? 'text-[var(--accent-text)]' : 'text-[var(--ink)]'
                                  }`}
                                >
                                  {msg.author}
                                </span>
                                {msg.role === 'host' && (
                                  <span className="text-[var(--cyan)] font-medium"> · Host</span>
                                )}
                                {msg.role === 'guest' && (
                                  <span className="text-[var(--ink-3)] font-medium"> · Stage</span>
                                )}
                                <span className="font-mono-num text-[var(--ink-3)]"> · {timeStr}</span>
                              </span>
                            </div>

                            {msg.replyTo && (
                              <div className="pl-2.5 py-0.5 rounded-r-[6px] bg-white/[0.03] text-[11px] text-[var(--ink-3)] truncate">
                                <span className="font-semibold text-[var(--ink-2)]">
                                  @{msg.replyTo.author}:
                                </span>{' '}
                                {msg.replyTo.text}
                              </div>
                            )}

                            <p className="text-[12.5px] text-[var(--ink-2)] leading-snug break-words">
                              {msg.text}
                            </p>

                            <ReactionBadgeRow
                              reactions={msg.reactions}
                              actorId={actorKey}
                              onToggle={
                                onToggleChatReaction
                                  ? (emoji) => onToggleChatReaction(msg.id, emoji)
                                  : undefined
                              }
                            />

                            <div className="flex items-center gap-3 pt-0.5 text-[11px] text-[var(--ink-3)]">
                              {onToggleChatLike && (
                                <button
                                  type="button"
                                  onClick={() => onToggleChatLike(msg.id)}
                                  className={`inline-flex items-center gap-1 cursor-pointer transition-all ${
                                    likedByMe
                                      ? 'text-rose-400 font-semibold opacity-100'
                                      : likeCount > 0
                                      ? 'opacity-80 hover:opacity-100 hover:text-[var(--ink)]'
                                      : 'opacity-0 group-hover:opacity-100 hover:text-[var(--ink)]'
                                  }`}
                                >
                                  <Heart className={`w-3 h-3 ${likedByMe ? 'fill-current' : ''}`} />
                                  {likeCount > 0 && <span className="font-mono-num">{likeCount}</span>}
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
                                className="inline-flex items-center gap-1 hover:text-[var(--ink)] cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              >
                                <CornerUpLeft className="w-3 h-3" />
                                <span>Reply</span>
                              </button>

                              {isHost && onPinChatMessage && (
                                <button
                                  type="button"
                                  onClick={() => onPinChatMessage(isPinned ? null : msg.id)}
                                  className={`inline-flex items-center gap-1 cursor-pointer transition-opacity ${
                                    isPinned
                                      ? 'text-[var(--cyan)] font-semibold opacity-100'
                                      : 'hover:text-[var(--ink)] opacity-0 group-hover:opacity-100'
                                  }`}
                                >
                                  <Pin className="w-3 h-3" />
                                  <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                                </button>
                              )}

                              {(isHost || isOwn) && onDeleteChatMessage && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteChatMessage(msg.id)}
                                  aria-label="Delete message"
                                  className="inline-flex items-center gap-1 hover:text-[var(--danger)] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}

                              {msg.role !== 'host' && !isOwn && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isHost && onBlockChatUser) {
                                      onBlockChatUser(msg.author, msg.authorUid);
                                    } else {
                                      setLocallyBlocked((prev) =>
                                        prev.includes(msg.author.toLowerCase())
                                          ? prev
                                          : [...prev, msg.author.toLowerCase()]
                                      );
                                    }
                                  }}
                                  aria-label={isHost ? `Block ${msg.author}` : `Hide ${msg.author}`}
                                  title={isHost ? `Block ${msg.author} from room` : `Hide ${msg.author}`}
                                  className="inline-flex items-center gap-1 hover:text-[var(--danger)] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {isHost ? <Ban className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {(locallyBlocked.length > 0 || (isHost && (room.blockedUsers?.length || 0) > 0)) && (
                <div className="mx-3 mb-2 px-2.5 py-1.5 rounded-[9px] bg-white/[0.04] border border-white/10 flex flex-wrap items-center gap-1.5 text-[11px] shrink-0">
                  <span className="text-[var(--ink-3)]">Hidden:</span>
                  {locallyBlocked.map((name) => (
                    <button
                      key={`loc-${name}`}
                      type="button"
                      onClick={() => setLocallyBlocked((prev) => prev.filter((n) => n !== name))}
                      className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{name}</span>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  ))}
                  {isHost &&
                    onUnblockChatUser &&
                    (room.blockedUsers || []).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onUnblockChatUser(b.id)}
                        className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[var(--danger)] hover:text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{b.author}</span>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    ))}
                </div>
              )}

              {tipDrawerOpen && room.commerce.payouts.enabled && (
                <div className="px-3 pb-2 shrink-0 animate-gather-drawer">
                  <InChatPaymentWidget
                    headline="Direct Creator Tip · 0% Fee"
                    subline="100% goes to the creator — checkout inside chat"
                    initialAmount={10}
                    payouts={room.commerce.payouts}
                    viewerName={effectiveViewerName}
                    compact
                    onClose={() => setTipDrawerOpen(false)}
                    onSubmitTip={onSendSuperChat}
                  />
                </div>
              )}

              {!canPostToChat ? (
                <div className="p-3 border-t border-[var(--line)] space-y-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-3)] px-0.5">
                    <Lock className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" strokeWidth={1.65} />
                    <span>Sign in to chat &amp; react</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onSignInWithGoogle?.()}
                    className="w-full h-10 px-3 rounded-[11px] gather-liquid-pill text-[var(--ink)] font-semibold text-[12.5px] inline-flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
                  >
                    <GoogleMarkSvg />
                    <span>Continue with Google</span>
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmitChat}
                  className="p-3 border-t border-[var(--line)] space-y-2 shrink-0"
                >
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)] min-w-0">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={effectiveViewerName}
                          referrerPolicy="no-referrer"
                          className="w-4 h-4 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-[9px] font-bold grid place-items-center shrink-0">
                          {getWatchAvatar(effectiveViewerName).initials}
                        </span>
                      )}
                      <span className="truncate font-semibold text-[var(--ink)]">
                        {effectiveViewerName}
                      </span>
                    </div>

                    {user && onToggleSubscribe && (
                      <button
                        type="button"
                        disabled={subscribing}
                        onClick={() => void onToggleSubscribe()}
                        className={`text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                          isSubscribed ? 'text-emerald-400' : 'text-[var(--accent-text)] hover:underline'
                        }`}
                      >
                        {isSubscribed ? <Check className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                        <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
                      </button>
                    )}
                  </div>

                  {replyingTo && (
                    <div className="px-2.5 py-1.5 rounded-[8px] bg-[var(--accent-soft)] flex items-center justify-between gap-2 text-[11px]">
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
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder={
                        replyingTo
                          ? `Reply to @${replyingTo.author}...`
                          : isGamerMode
                          ? 'Drop hype or callouts...'
                          : 'Message live chat...'
                      }
                    />
                    {chatText.length > 0 && (
                      <button
                        type="button"
                        aria-label="Clear chat input"
                        title="Clear"
                        onClick={(e) => {
                          setChatText('');
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
                    {room.commerce.payouts.enabled && (
                      <button
                        type="button"
                        onClick={() => setTipDrawerOpen((v) => !v)}
                        aria-label="Tip creator directly in chat"
                        title="Tip creator directly in chat"
                        className={`h-8 w-8 rounded-[8px] grid place-items-center shrink-0 cursor-pointer transition-colors ${
                          tipDrawerOpen
                            ? 'gather-btn-tip'
                            : 'bg-[var(--ok)]/14 hover:bg-[var(--ok)]/24 text-[var(--ok)]'
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                    <button
                      type="submit"
                      aria-label="Send message"
                      className={`gather-send-btn ${chatText.trim() ? 'ready' : ''}`}
                    >
                      <ArrowUp className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* ================================================================= */}
          {/* TAB 2A: UNIFIED SHOP COMPANION (LOOKBOOK / CLAIMS / FIT Q&A)     */}
          {/* ================================================================= */}
          {isShopMode && railTab === 'companion' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Sub-view Bar Inside Chat Panel */}
              <div className="px-3.5 py-2 border-b border-[var(--line)] flex items-center gap-4 text-[12px] shrink-0">
                {(
                  [
                    { id: 'lookbook', label: `Lookbook (${room.commerce.products.length})` },
                    { id: 'claims', label: `Claims (${room.commerce.recentOrders.length})` },
                    { id: 'qa', label: `Fit Q&A (${sortedQuestions.length})` },
                  ] as const
                ).map((sub) => {
                  const active = shopSubTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setShopSubTab(sub.id)}
                      className={`py-1 font-medium cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
                        active
                          ? 'text-[var(--ink)] border-[var(--cyan)]'
                          : 'text-[var(--ink-3)] hover:text-[var(--ink)] border-transparent'
                      }`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 gather-scroll min-h-0">
                {shopSubTab === 'lookbook' && (
                  <>
                    {pinnedProduct && (
                      <div className="rounded-[14px] overflow-hidden bg-white/[0.03] border border-white/12">
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg)]">
                          <img
                            src={pinnedProduct.imageUrl}
                            alt={pinnedProduct.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                          <div className="absolute left-3 right-3 bottom-2.5 flex items-end justify-between gap-2">
                            <span className="text-[11px] font-medium text-sky-200">
                              On Camera · {pinnedProduct.source}
                            </span>
                            <span className="font-mono-num text-[15px] font-bold text-white">
                              $
                              {activeFlashSale && activeFlashSale.productId === pinnedProduct.id
                                ? (pinnedProduct.price * (1 - activeFlashSale.discountPct / 100)).toFixed(0)
                                : pinnedProduct.price.toFixed(0)}
                            </span>
                          </div>
                        </div>
                        <div className="p-3 space-y-2.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="font-editorial text-[16px] font-semibold text-[var(--ink)] truncate">
                              {pinnedProduct.title}
                            </h3>
                            <span className="text-[11px] font-mono-num text-[var(--ink-3)] shrink-0">
                              {pinnedProduct.stock} left
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {pinnedProduct.variants.length > 0 && (
                              <select
                                aria-label={`Select variant for ${pinnedProduct.title}`}
                                value={selectedVariants[pinnedProduct.id] || pinnedProduct.variants[0]}
                                onChange={(e) =>
                                  setSelectedVariants((prev) => ({
                                    ...prev,
                                    [pinnedProduct.id]: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-white/[0.06] border border-white/12 text-[11.5px] text-[var(--ink)]"
                              >
                                {pinnedProduct.variants.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              disabled={pinnedProduct.stock <= 0}
                              onClick={() => addToBag(pinnedProduct, 1, undefined, true)}
                              className="h-8 px-3.5 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                            >
                              {pinnedProduct.stock > 0 ? 'Add to Bag' : 'Sold Out'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {lookbookOthers.length > 0 && (
                      <div className="divide-y divide-[var(--line)]">
                        {lookbookOthers.map((prod, idx) => {
                          const isFlashProd = activeFlashSale?.productId === prod.id;
                          const displayPrice = isFlashProd
                            ? prod.price * (1 - activeFlashSale!.discountPct / 100)
                            : prod.price;
                          return (
                            <div
                              key={prod.id}
                              className="py-3 first:pt-1 last:pb-1 flex gap-3 hover:bg-white/[0.025] rounded-[10px] px-1 transition-colors"
                            >
                              <div className="relative w-18 h-18 rounded-[10px] overflow-hidden bg-[var(--bg)] shrink-0">
                                <img
                                  src={prod.imageUrl}
                                  alt={prod.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono-num text-[var(--ink-3)]">
                                    <span>
                                      0{idx + 2} · {prod.source}
                                    </span>
                                    <span>{prod.stock} left</span>
                                  </div>
                                  <h4 className="font-editorial text-[14px] font-semibold text-[var(--ink)] truncate">
                                    {prod.title}
                                  </h4>
                                </div>
                                <div className="flex items-center justify-between gap-2 pt-1.5">
                                  {prod.variants.length > 0 ? (
                                    <select
                                      aria-label={`Select variant for ${prod.title}`}
                                      value={selectedVariants[prod.id] || prod.variants[0]}
                                      onChange={(e) =>
                                        setSelectedVariants((prev) => ({
                                          ...prev,
                                          [prod.id]: e.target.value,
                                        }))
                                      }
                                      className="flex-1 min-w-0 h-7 px-2 rounded-[6px] bg-white/[0.05] border border-white/10 text-[11px] text-[var(--ink)]"
                                    >
                                      {prod.variants.map((v) => (
                                        <option key={v} value={v}>
                                          {v}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span />
                                  )}
                                  <button
                                    type="button"
                                    disabled={prod.stock <= 0}
                                    onClick={() => addToBag(prod, 1, undefined, true)}
                                    className="h-7 px-3 rounded-[7px] gather-liquid-pill hover:border-[var(--cyan)] text-[var(--ink)] text-[11px] font-mono-num font-semibold cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    ${displayPrice.toFixed(0)} · Claim
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {shopSubTab === 'claims' && (
                  <div className="divide-y divide-[var(--line)]">
                    {room.commerce.recentOrders.length === 0 ? (
                      <p className="text-[12px] text-[var(--ink-3)] py-8 text-center">
                        Live claims appear here as shoppers reserve pieces in-stream.
                      </p>
                    ) : (
                      room.commerce.recentOrders.map((ord) => (
                        <div key={ord.id} className="py-2.5 first:pt-0 space-y-0.5">
                          <div className="flex items-center justify-between text-[11px] text-[var(--ok)] font-mono-num font-semibold">
                            <span>#{ord.orderNumber || 'Claimed'}</span>
                            <span>${ord.total.toFixed(2)}</span>
                          </div>
                          <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">
                            {ord.buyerName} · {ord.quantity}× {ord.productTitle}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {shopSubTab === 'qa' && (
                  <div className="space-y-3">
                    {canPostToChat ? (
                      <form onSubmit={handleSubmitQuestion} className="flex gap-1.5">
                        <input
                          type="text"
                          value={questionDraft}
                          onChange={(e) => setQuestionDraft(e.target.value)}
                          placeholder="Ask about sizing or materials..."
                          className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-white/[0.05] border border-white/12 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                        />
                        <button
                          type="submit"
                          className="h-8 px-3 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold cursor-pointer shrink-0"
                        >
                          Ask
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onSignInWithGoogle?.()}
                        className="w-full h-9 px-3 rounded-[9px] gather-liquid-pill text-[var(--ink)] font-medium text-[12px] inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <GoogleMarkSvg />
                        <span>Sign in with Google to Ask</span>
                      </button>
                    )}

                    <div className="divide-y divide-[var(--line)]">
                      {sortedQuestions.map((q) => {
                        const upvoted = Boolean(upvotedIds[q.id]);
                        return (
                          <div key={q.id} className="py-2.5 first:pt-0 space-y-1.5">
                            <p className="text-[12.5px] text-[var(--ink)] leading-snug">{q.text}</p>
                            <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                              <span>{q.author}</span>
                              <button
                                type="button"
                                disabled={upvoted}
                                onClick={() => {
                                  if (upvoted) return;
                                  setUpvotedIds((prev) => ({ ...prev, [q.id]: true }));
                                  onUpvoteQuestion?.(q.id);
                                }}
                                className={`h-6 px-2 rounded-[6px] font-mono-num font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                  upvoted ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-white/[0.05] text-[var(--ink-2)]'
                                }`}
                              >
                                <ThumbsUp className="w-3 h-3" />
                                <span>{q.upvotes}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2B: UNIFIED GAMING ARENA (SQUAD / RIG / CLIPS / POLL)         */}
          {/* ================================================================= */}
          {isGamerMode && railTab === 'companion' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3.5 py-2 border-b border-[var(--line)] flex items-center gap-3.5 text-[12px] overflow-x-auto gather-scroll shrink-0">
                {(
                  [
                    { id: 'squad', label: `Squad (${room.squadQueue.length})` },
                    { id: 'rig', label: 'Pro Rig' },
                    { id: 'clips', label: `Clips (${room.gamer.clips.length})` },
                    { id: 'poll', label: 'Poll' },
                  ] as const
                ).map((sub) => {
                  const active = gamerSubTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setGamerSubTab(sub.id)}
                      className={`py-1 font-medium cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
                        active
                          ? 'text-[var(--ink)] border-[var(--cyan)]'
                          : 'text-[var(--ink-3)] hover:text-[var(--ink)] border-transparent'
                      }`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 gather-scroll min-h-0">
                {gamerSubTab === 'squad' && (
                  <>
                    {squadJoined ? (
                      <div className="p-3 rounded-[10px] bg-[var(--ok)]/14 border border-[var(--ok)]/30 text-[12px] text-[var(--ok)] font-medium">
                        Queued as <span className="font-mono-num font-bold">{squadHandle}</span> ({squadRole} · {squadRank})
                      </div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!squadHandle.trim()) return;
                          onJoinSquadQueue(squadHandle.trim(), squadPlatform, undefined, squadRole, squadRank);
                          setSquadJoined(true);
                        }}
                        className="space-y-2 pb-2 border-b border-[var(--line)]"
                      >
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={squadHandle}
                            onChange={(e) => setSquadHandle(e.target.value)}
                            placeholder="Riot ID / Gamertag..."
                            className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-white/[0.05] border border-white/12 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                          />
                          <select
                            aria-label="Gaming platform"
                            value={squadPlatform}
                            onChange={(e) => setSquadPlatform(e.target.value)}
                            className="h-8 px-2 rounded-[8px] bg-white/[0.05] border border-white/12 text-[11px] text-[var(--ink)]"
                          >
                            <option value="PC · Discord">PC</option>
                            <option value="PlayStation">PS5</option>
                            <option value="Xbox">Xbox</option>
                          </select>
                        </div>
                        <div className="flex gap-1.5">
                          <select
                            aria-label="In-game role"
                            value={squadRole}
                            onChange={(e) => setSquadRole(e.target.value)}
                            className="h-8 px-2 rounded-[8px] bg-white/[0.05] border border-white/12 text-[11px] text-[var(--ink)]"
                          >
                            <option value="Flex">Flex</option>
                            <option value="Entry">Entry</option>
                            <option value="IGL">IGL</option>
                            <option value="Sentinel">Sentinel</option>
                            <option value="Support">Support</option>
                          </select>
                          <select
                            aria-label="Competitive rank"
                            value={squadRank}
                            onChange={(e) => setSquadRank(e.target.value)}
                            className="h-8 px-2 rounded-[8px] bg-white/[0.05] border border-white/12 text-[11px] text-[var(--ink)]"
                          >
                            <option value="Radiant">Radiant</option>
                            <option value="Immortal">Immortal</option>
                            <option value="Ascendant">Ascendant</option>
                            <option value="Diamond">Diamond</option>
                            <option value="Platinum">Platinum</option>
                          </select>
                          <button
                            type="submit"
                            className="flex-1 h-8 px-3 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Join Queue
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="divide-y divide-[var(--line)]">
                      {room.squadQueue.length === 0 ? (
                        <p className="text-[12px] text-[var(--ink-3)] py-6 text-center">
                          Drop your handle, role &amp; rank to join next lobby.
                        </p>
                      ) : (
                        room.squadQueue.map((q, i) => (
                          <div key={q.id} className="py-2.5 first:pt-0 space-y-0.5">
                            <div className="flex items-center justify-between text-[10.5px] font-mono-num text-[var(--cyan)]">
                              <span>
                                #{i + 1} · {q.role || 'Flex'}
                              </span>
                              <span>{q.rank || 'Ranked'}</span>
                            </div>
                            <div className="text-[13px] font-semibold text-[var(--ink)] truncate">
                              {q.handle}
                            </div>
                            <div className="text-[11px] text-[var(--ink-3)] truncate">{q.platform}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {gamerSubTab === 'rig' && (
                  <div className="divide-y divide-[var(--line)]">
                    {room.gamer.gearSpecs.map((spec) => (
                      <div key={spec.id} className="py-2.5 first:pt-0 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10.5px] font-mono-num text-[var(--ink-3)] flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-[var(--cyan)]" strokeWidth={1.65} />
                            <span>{spec.category}</span>
                          </div>
                          <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">
                            {spec.label}
                          </div>
                        </div>
                        <span className="text-[12px] font-mono-num text-[var(--ink-2)] text-right shrink-0">
                          {spec.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {gamerSubTab === 'clips' && (
                  <div className="space-y-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        onCreateClip(
                          clipLabel.trim() || `${effectiveViewerName}'s Clutch`,
                          elapsedSec,
                          effectiveViewerName
                        );
                        setClipLabel('');
                        setClipSavedToast(true);
                        window.setTimeout(() => setClipSavedToast(false), 2000);
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        type="text"
                        value={clipLabel}
                        onChange={(e) => setClipLabel(e.target.value)}
                        placeholder="Title 30s clutch clip..."
                        className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-white/[0.05] border border-white/12 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                      />
                      <button
                        type="submit"
                        className="h-8 px-3 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Clapperboard className="w-3.5 h-3.5" strokeWidth={1.65} />
                        <span>{clipSavedToast ? 'Saved!' : formatClock(elapsedSec)}</span>
                      </button>
                    </form>
                    <div className="divide-y divide-[var(--line)]">
                      {room.gamer.clips.map((c) => (
                        <div key={c.id} className="py-2.5 first:pt-0 space-y-0.5">
                          <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">
                            {c.label}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                            <span className="truncate">{c.createdBy}</span>
                            <span className="font-mono-num text-[var(--cyan)]">
                              {formatClock(c.timestampSec)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {gamerSubTab === 'poll' && (
                  <div className="space-y-3">
                    {activePoll ? (
                      <>
                        <div>
                          <div className="text-[11px] font-mono-num text-[var(--cyan)]">
                            {activePoll.isOpen ? 'Live Poll' : 'Closed'} · {totalPollVotes} votes
                          </div>
                          <h3 className="font-editorial text-[15px] font-semibold text-[var(--ink)] mt-0.5">
                            {activePoll.question}
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {activePoll.options.map((opt) => {
                            const pct =
                              totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                            const hasVoted = votedPollId === activePoll.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={!activePoll.isOpen || hasVoted}
                                onClick={() => {
                                  onVotePoll(opt.id);
                                  setVotedPollId(activePoll.id);
                                }}
                                className="w-full relative h-9 px-3 rounded-[9px] overflow-hidden bg-white/[0.04] border border-white/10 hover:border-[var(--accent-line)] text-left cursor-pointer disabled:cursor-default"
                              >
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="absolute inset-y-0 left-0 bg-[var(--accent-soft)] transition-all duration-500 ease-out"
                                />
                                <div className="relative flex items-center justify-between text-[12px]">
                                  <span className="font-medium text-[var(--ink)] truncate pr-2">
                                    {opt.label}
                                  </span>
                                  <span className="font-mono-num font-bold text-[var(--accent-text)] shrink-0">
                                    {pct}%
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-[12px] text-[var(--ink-3)] py-6 text-center">
                        No active prediction right now.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2C: UNIFIED BROADCAST PROGRAM (AGENDA / POLL / MOMENTS)       */}
          {/* ================================================================= */}
          {isStandardMode && railTab === 'companion' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3.5 py-2 border-b border-[var(--line)] flex items-center gap-4 text-[12px] shrink-0">
                {(
                  [
                    { id: 'agenda', label: `Agenda (${room.rundown.steps.length})` },
                    { id: 'poll', label: 'Poll' },
                    { id: 'clips', label: `Moments (${room.gamer.clips.length})` },
                  ] as const
                ).map((sub) => {
                  const active = programSubTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setProgramSubTab(sub.id)}
                      className={`py-1 font-medium cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
                        active
                          ? 'text-[var(--ink)] border-[var(--cyan)]'
                          : 'text-[var(--ink-3)] hover:text-[var(--ink)] border-transparent'
                      }`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 gather-scroll min-h-0">
                {programSubTab === 'agenda' && (
                  <div className="divide-y divide-[var(--line)]">
                    {room.rundown.steps.map((step, idx) => {
                      const isActive = room.rundown.activeStepId === step.id;
                      return (
                        <div
                          key={step.id}
                          className={`py-3 first:pt-1 space-y-1 px-2 rounded-[10px] transition-colors ${
                            isActive ? 'bg-[var(--accent-soft)]' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono-num text-[var(--ink-3)]">
                            <span>
                              0{idx + 1} · {step.durationMin}m
                            </span>
                            <span className={isActive ? 'text-[var(--cyan)] font-semibold' : ''}>
                              {isActive ? 'On Air' : step.completed ? 'Done' : 'Up Next'}
                            </span>
                          </div>
                          <h3 className="font-editorial text-[14.5px] font-semibold text-[var(--ink)] leading-snug">
                            {step.title}
                          </h3>
                          <p className="text-[11.5px] text-[var(--ink-2)] leading-snug">
                            {step.bannerSub || step.bannerTitle}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {programSubTab === 'poll' && (
                  <div className="space-y-3">
                    {activePoll ? (
                      <>
                        <div>
                          <div className="text-[11px] font-mono-num text-[var(--cyan)]">
                            {activePoll.isOpen ? 'Live Poll' : 'Closed'} · {totalPollVotes} votes
                          </div>
                          <h3 className="font-editorial text-[15px] font-semibold text-[var(--ink)] mt-0.5">
                            {activePoll.question}
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {activePoll.options.map((opt) => {
                            const pct =
                              totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                            const hasVoted = votedPollId === activePoll.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={!activePoll.isOpen || hasVoted}
                                onClick={() => {
                                  onVotePoll(opt.id);
                                  setVotedPollId(activePoll.id);
                                }}
                                className="w-full relative h-9 px-3 rounded-[9px] overflow-hidden bg-white/[0.04] border border-white/10 hover:border-[var(--accent-line)] text-left cursor-pointer disabled:cursor-default"
                              >
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="absolute inset-y-0 left-0 bg-[var(--accent-soft)] transition-all duration-500 ease-out"
                                />
                                <div className="relative flex items-center justify-between text-[12px]">
                                  <span className="font-medium text-[var(--ink)] truncate pr-2">
                                    {opt.label}
                                  </span>
                                  <span className="font-mono-num font-bold text-[var(--accent-text)] shrink-0">
                                    {pct}%
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-[12px] text-[var(--ink-3)] py-6 text-center">
                        No live poll open right now.
                      </p>
                    )}
                  </div>
                )}

                {programSubTab === 'clips' && (
                  <div className="space-y-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        onCreateClip(
                          clipLabel.trim() || `${effectiveViewerName}'s Highlight`,
                          elapsedSec,
                          effectiveViewerName
                        );
                        setClipLabel('');
                        setClipSavedToast(true);
                        window.setTimeout(() => setClipSavedToast(false), 2000);
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        type="text"
                        value={clipLabel}
                        onChange={(e) => setClipLabel(e.target.value)}
                        placeholder="Name this 30s moment..."
                        className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-white/[0.05] border border-white/12 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                      />
                      <button
                        type="submit"
                        className="h-8 px-3 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Clapperboard className="w-3.5 h-3.5" strokeWidth={1.65} />
                        <span>{clipSavedToast ? 'Saved!' : formatClock(elapsedSec)}</span>
                      </button>
                    </form>
                    <div className="divide-y divide-[var(--line)]">
                      {room.gamer.clips.map((c) => (
                        <div key={c.id} className="py-2.5 first:pt-0 space-y-0.5">
                          <div className="text-[12.5px] font-semibold text-[var(--ink)] truncate">
                            {c.label}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                            <span className="truncate">{c.createdBy}</span>
                            <span className="font-mono-num text-[var(--cyan)]">
                              {formatClock(c.timestampSec)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: Q&A (STANDARD & GAMER MODES)                               */}
          {/* ================================================================= */}
          {!isShopMode && railTab === 'qa' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto px-3.5 py-3 gather-scroll">
                {sortedQuestions.length === 0 ? (
                  <p className="text-[12px] text-[var(--ink-3)] py-8 text-center">
                    Ask the first question below — top-voted questions go to stage.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--line)]">
                    {sortedQuestions.map((q) => {
                      const upvoted = Boolean(upvotedIds[q.id]);
                      return (
                        <div key={q.id} className="py-3 first:pt-1 space-y-2">
                          <p className="text-[12.5px] font-medium text-[var(--ink)] leading-snug">
                            {q.text}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                            <span>{q.author}</span>
                            <button
                              type="button"
                              disabled={upvoted}
                              onClick={() => {
                                if (upvoted) return;
                                setUpvotedIds((prev) => ({ ...prev, [q.id]: true }));
                                onUpvoteQuestion?.(q.id);
                              }}
                              className={`h-6 px-2.5 rounded-[6px] font-mono-num font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                upvoted
                                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                                  : 'bg-white/[0.05] text-[var(--ink-2)] hover:text-[var(--ink)]'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{q.upvotes}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {canPostToChat ? (
                <form
                  onSubmit={handleSubmitQuestion}
                  className="p-3 border-t border-[var(--line)] shrink-0"
                >
                  <div className="gather-composer">
                    <input
                      type="text"
                      value={questionDraft}
                      onChange={(e) => setQuestionDraft(e.target.value)}
                      placeholder="Ask a question for the stage..."
                    />
                    {questionDraft.length > 0 && (
                      <button
                        type="button"
                        aria-label="Clear question input"
                        title="Clear"
                        onClick={(e) => {
                          setQuestionDraft('');
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
                      aria-label="Submit question"
                      className={`gather-send-btn ${questionDraft.trim() ? 'ready' : ''}`}
                    >
                      <ArrowUp className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 border-t border-[var(--line)] shrink-0">
                  <button
                    type="button"
                    onClick={() => void onSignInWithGoogle?.()}
                    className="w-full h-10 px-3 rounded-[11px] gather-liquid-pill text-[var(--ink)] font-semibold text-[12.5px] inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <GoogleMarkSvg />
                    <span>Continue with Google to Ask</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: EXPRESS BAG & CHECKOUT (SHOP MODE)                         */}
          {/* ================================================================= */}
          {isShopMode && railTab === 'bag' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 gather-scroll">
                {lastReceipt && bag.length === 0 ? (
                  <div className="p-3.5 rounded-[14px] bg-white/[0.04] border border-emerald-400/30 space-y-3 animate-gather-msg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-[9px] bg-emerald-500/18 text-emerald-400 grid place-items-center shrink-0">
                          <PackageCheck className="w-4 h-4" strokeWidth={1.65} />
                        </div>
                        <div>
                          <div className="text-[11px] font-mono-num font-semibold text-emerald-400">
                            #{lastReceipt.orderNumber} Confirmed
                          </div>
                          <div className="font-editorial text-[14.5px] font-semibold text-[var(--ink)]">
                            In-Stream Claim Placed
                          </div>
                        </div>
                      </div>
                      <span className="text-[12.5px] font-mono-num font-bold text-[var(--ink)]">
                        ${lastReceipt.total.toFixed(2)}
                      </span>
                    </div>

                    <div className="divide-y divide-[var(--line)] border-y border-[var(--line)] py-2 space-y-2">
                      {lastReceipt.items.map((it, idx) => (
                        <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-[12px]">
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--ink)] truncate">
                              {it.quantity}× {it.title}
                            </div>
                            <div className="text-[10.5px] text-[var(--ink-3)]">
                              {it.source} · {it.variant}
                            </div>
                          </div>
                          <span className="font-mono-num font-semibold text-[var(--ink)] shrink-0">
                            ${it.lineTotal.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setLastReceipt(null);
                          setRailTab('companion');
                          setShopSubTab('lookbook');
                          onSetBagOpen(false);
                        }}
                        className="h-8 rounded-[9px] gather-liquid-pill text-[11.5px] font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap"
                      >
                        Shop Lookbook
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRailTab('chat');
                          onSetBagOpen(false);
                        }}
                        className="h-8 rounded-[9px] gather-btn-primary text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Back to Chat
                      </button>
                    </div>
                  </div>
                ) : bag.length === 0 ? (
                  <div className="py-10 px-3 text-center space-y-3">
                    <ShoppingBag className="w-7 h-7 text-[var(--ink-3)] mx-auto" strokeWidth={1.5} />
                    <div className="space-y-1">
                      <p className="font-editorial text-[15px] text-[var(--ink)] font-semibold">
                        Express Bag is Empty
                      </p>
                      <p className="text-[11.5px] text-[var(--ink-3)] max-w-[230px] mx-auto">
                        Claim pieces from the Shop tab with zero redirects.
                      </p>
                    </div>
                    {pinnedProduct && pinnedProduct.stock > 0 && (
                      <button
                        type="button"
                        onClick={() => addToBag(pinnedProduct, 1, undefined, true)}
                        className="h-8 px-3.5 rounded-[9px] gather-btn-primary text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        + Add {pinnedProduct.title}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-[var(--line)]">
                      {bagPricing.lines.map(({ item, lineTotal, retailTotal, discountLabel }, idx) => (
                        <div
                          key={`${item.product.id}-${item.variant}`}
                          className="py-3 first:pt-1 flex gap-2.5"
                        >
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.title}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-[9px] object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 text-[10px] font-mono-num text-[var(--ink-3)]">
                              <span>{item.product.source}</span>
                              {discountLabel && (
                                <span className="text-amber-300 font-semibold">{discountLabel}</span>
                              )}
                            </div>
                            <h4 className="font-editorial text-[13.5px] font-semibold text-[var(--ink)] truncate">
                              {item.product.title}
                            </h4>
                            <p className="text-[11px] text-[var(--ink-3)]">{item.variant}</p>
                            <div className="mt-1.5 flex items-center justify-between">
                              <div className="inline-flex items-center gap-1 bg-white/[0.05] border border-white/10 rounded-[6px] px-1 py-0.5">
                                <button
                                  type="button"
                                  aria-label="Decrease quantity"
                                  onClick={() =>
                                    setBag((prev) =>
                                      prev
                                        .map((b, i) =>
                                          i === idx ? { ...b, quantity: b.quantity - 1 } : b
                                        )
                                        .filter((b) => b.quantity > 0)
                                    )
                                  }
                                  className="w-5 h-5 grid place-items-center text-[var(--ink-2)] cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-[11px] font-mono-num px-1">{item.quantity}</span>
                                <button
                                  type="button"
                                  aria-label="Increase quantity"
                                  onClick={() =>
                                    setBag((prev) =>
                                      prev.map((b, i) =>
                                        i === idx
                                          ? { ...b, quantity: Math.min(b.product.stock, b.quantity + 1) }
                                          : b
                                      )
                                    )
                                  }
                                  className="w-5 h-5 grid place-items-center text-[var(--ink-2)] cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                {retailTotal > lineTotal && (
                                  <span className="font-mono-num text-[11px] line-through text-[var(--ink-3)]">
                                    ${retailTotal.toFixed(2)}
                                  </span>
                                )}
                                <span className="font-mono-num text-[12.5px] font-bold text-[var(--ok)]">
                                  ${lineTotal.toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Remove item"
                                  onClick={() => setBag((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <form
                      id="gather-express-checkout-form"
                      onSubmit={handleCompleteBagOrder}
                      className="pt-3 border-t border-[var(--line)] space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11.5px] font-semibold text-[var(--ink)]">
                        <span>Express Checkout</span>
                        <span className="text-[10.5px] font-mono-num text-[var(--ok)]">0% Fee</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          required
                          value={buyerFullName}
                          onChange={(e) => setBuyerFullName(e.target.value)}
                          placeholder="Full Name"
                          className="h-8 px-2.5 rounded-[8px] bg-white/[0.045] border border-white/12 text-[11.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                        />
                        <input
                          type="text"
                          required
                          value={buyerCity}
                          onChange={(e) => setBuyerCity(e.target.value)}
                          placeholder="City, State"
                          className="h-8 px-2.5 rounded-[8px] bg-white/[0.045] border border-white/12 text-[11.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                        />
                      </div>
                      <input
                        type="text"
                        required
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="Street Shipping Address"
                        className="w-full h-8 px-2.5 rounded-[8px] bg-white/[0.045] border border-white/12 text-[11.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                      />
                      <div className="grid grid-cols-4 gap-1">
                        {(['Apple Pay', 'Google Pay', 'Card', 'PayPal'] as const).map((pm) => (
                          <button
                            key={pm}
                            type="button"
                            onClick={() => setCheckoutMethod(pm)}
                            className={`h-7 rounded-[7px] text-[10.5px] font-semibold cursor-pointer whitespace-nowrap ${
                              checkoutMethod === pm
                                ? 'gather-btn-primary text-white'
                                : 'gather-liquid-pill text-[var(--ink-2)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {pm}
                          </button>
                        ))}
                      </div>
                    </form>
                  </>
                )}
              </div>

              {bag.length > 0 && (
                <div className="p-3.5 border-t border-[var(--line)] space-y-2 shrink-0">
                  {bagPricing.totalSavings > 0 && (
                    <div className="flex items-center justify-between text-[11.5px] text-amber-300 font-semibold">
                      <span>Bundle Savings</span>
                      <span className="font-mono-num">-${bagPricing.totalSavings.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--ink-2)]">Total (Free Shipping)</span>
                    <span className="font-mono-num font-bold text-[var(--ink)]">
                      ${bagPricing.finalTotal.toFixed(2)}
                    </span>
                  </div>
                  <button
                    type="submit"
                    form="gather-express-checkout-form"
                    className="w-full h-10 rounded-[11px] gather-btn-tip text-[13px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Pay with {checkoutMethod} · ${bagPricing.finalTotal.toFixed(2)}
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
