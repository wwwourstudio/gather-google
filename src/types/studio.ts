export type AspectRatio = '16:9' | '9:16';
export type WatchMode = 'standard' | 'shop' | 'gamer';
export type TransitionType = 'cut' | 'dissolve' | 'slide' | 'push';
export type BackdropId = 'dusk' | 'graphite' | 'ember' | 'forest' | 'paper';
export type FrameStyle = 'none' | 'border' | 'corners' | 'vignette';
export type BannerStyle = 'editorial' | 'broadcast' | 'glass' | 'minimal' | 'block';
export type NameTagStyle = 'glass' | 'solid' | 'outline' | 'minimal';
export type CaptionStyle = 'glass' | 'bar' | 'minimal';
export type StageFont =
  | 'Plus Jakarta Sans'
  | 'Onest'
  | 'Playfair Display'
  | 'DM Serif Display'
  | 'Bebas Neue'
  | 'JetBrains Mono';

export type ParticipantRole = 'host' | 'guest';

export interface Participant {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  role: ParticipantRole;
  onStage: boolean;
  micOn: boolean;
  camOn: boolean;
  sharingScreen: boolean;
  mutedByHost?: boolean;
  joinedAt: number;
}

export interface KnockRequest {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  requestedAt: number;
}

export interface SquadQueueEntry {
  id: string;
  handle: string;
  platform: string;
  role?: string;
  rank?: string;
  note?: string;
  joinedAt: number;
}

export interface AudienceQuestion {
  id: string;
  author: string;
  text: string;
  upvotes: number;
  answered?: boolean;
  createdAt: number;
}

export interface SponsorBanner {
  id: string;
  label: string;
  tagline?: string;
  imageUrl?: string;
}

export interface CustomStageElement {
  id: string;
  kind: 'participant' | 'media' | 'text' | 'clock' | 'block' | 'qr';
  label: string;
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  w: number; // 0..1 normalized
  h: number; // 0..1 normalized
  participantId?: string;
  text?: string;
  color?: string;
}

export interface CustomScenePreset {
  id: string;
  ownerUid?: string;
  name: string;
  aspect: AspectRatio;
  baseTemplateId: string;
  elements: CustomStageElement[];
  backdrop: BackdropId;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerStyle: BannerStyle;
  bannerVisible: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SceneState {
  templateId: string;
  transitionType: TransitionType;
  transitionMs: number;
  customElements: CustomStageElement[];
  savedPresets?: CustomScenePreset[];
}

export interface OverlayState {
  banner: {
    visible: boolean;
    title: string;
    subtitle: string;
    style: BannerStyle;
  };
  ticker: {
    visible: boolean;
    text: string;
  };
  featuredChatId: string | null;
  featuredQuestionId?: string | null;
  chatOverlayOnStage?: boolean;
  showSupportQrOnStage?: boolean;
  captionsEnabled: boolean;
  captionText: string;
  captionLang: string;
  captionStyle?: CaptionStyle;
  countdownEndAt?: number | null;
  countdownLabel?: string;
}

export interface BrandState {
  accent: string;
  backdrop: BackdropId;
  customBackdropUrl?: string;
  customOverlayUrl?: string;
  backdropDim: number;
  font: StageFont;
  frame: FrameStyle;
  nameTagStyle?: NameTagStyle;
  showNames: boolean;
  logoUrl?: string;
  logoPosition: 'tl' | 'tr' | 'bl' | 'br';
  logoSize: number;
  sponsorsEnabled?: boolean;
  sponsorIntervalSec?: number;
  sponsors?: SponsorBanner[];
}

export type ProductSource = 'shopify' | 'etsy' | 'custom';

export interface ProductItem {
  id: string;
  source: ProductSource;
  title: string;
  price: number;
  currency: string;
  imageUrl: string;
  url: string;
  stock: number;
  variants: string[];
  description?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber?: string;
  productId: string;
  productTitle: string;
  variant?: string;
  quantity: number;
  bundleLabel?: string;
  total: number;
  buyerName: string;
  buyerCity?: string;
  paymentMethod?: string;
  source?: ProductSource;
  createdAt: number;
}

export interface FlashSaleBundleTier {
  id: string;
  quantity: number;
  label: string;
  discountPct: number;
  badge?: string;
}

export interface FlashSaleState {
  id: string;
  productId: string;
  discountPct: number;
  totalUnits: number;
  soldUnits: number;
  startedAt: number;
  endsAt: number;
  tagline: string;
  bundles: FlashSaleBundleTier[];
  active: boolean;
}

export interface LiveSalePopup {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerCity: string;
  productTitle: string;
  productImageUrl?: string;
  source: ProductSource;
  quantity: number;
  bundleLabel?: string;
  total: number;
  savingsAmount?: number;
  remainingStock: number;
  paymentMethod?: string;
  createdAt: number;
}

export type SuperChatMethod = 'card' | 'paypal' | 'venmo' | 'cashapp' | 'stripe';
export type SuperChatTier = 'blue' | 'emerald' | 'amber' | 'rose';

export interface PayoutSettings {
  enabled: boolean;
  paypalHandle?: string;
  venmoHandle?: string;
  cashappTag?: string;
  stripeUrl?: string;
}

export interface CommerceState {
  storeLabel: string;
  shopifyDomain?: string;
  etsyShopName?: string;
  products: ProductItem[];
  pinnedProductId: string | null;
  recentOrders: OrderRecord[];
  payouts: PayoutSettings;
  activeFlashSale?: FlashSaleState | null;
  latestSalePopup?: LiveSalePopup | null;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface PollState {
  id: string;
  question: string;
  options: PollOption[];
  isOpen: boolean;
  showOnStage: boolean;
  createdAt: number;
}

export interface GearSpec {
  id: string;
  category: string;
  label: string;
  value: string;
  productId?: string;
}

export interface ClipMarker {
  id: string;
  label: string;
  timestampSec: number;
  createdBy: string;
  createdAt: number;
}

export interface GamerState {
  gameTitle: string;
  modeOrRank: string;
  seriesScore?: string;
  currentMap?: string;
  lobbyCode: string;
  gearSpecs: GearSpec[];
  activePoll: PollState | null;
  clips: ClipMarker[];
  hypeCount: number;
  slowModeSec: number;
}

export interface RundownStep {
  id: string;
  title: string;
  durationMin: number;
  sceneId: string;
  bannerTitle: string;
  bannerSub: string;
  productId?: string;
  completed: boolean;
}

export interface SuperChatInfo {
  amount: number;
  method: SuperChatMethod;
  tier: SuperChatTier;
}

export interface PaymentCardPrompt {
  headline: string;
  note?: string;
  suggestedAmounts?: number[];
}

export interface ChatReplyRef {
  id: string;
  author: string;
  text: string;
}

export interface BlockedChatUser {
  id: string;
  author: string;
  uid?: string;
  blockedAt: number;
}

export const CHAT_REACTION_EMOJIS = ['❤️', '🔥', '😮', '👏', '😂'] as const;
export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJIS)[number];

export interface ChatMessage {
  id: string;
  author: string;
  authorUid?: string;
  avatarUrl?: string;
  role: 'host' | 'guest' | 'viewer' | 'order' | 'superchat' | 'payment-card' | 'system';
  source: 'studio' | 'watch' | 'youtube' | 'twitch';
  text: string;
  timestamp: number;
  replyTo?: ChatReplyRef;
  likes?: number;
  likedBy?: string[];
  reactions?: Record<string, string[]>;
  superChat?: SuperChatInfo;
  paymentCard?: PaymentCardPrompt;
}

export interface HandRaiseEntry {
  id: string;
  uid?: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  topic: string;
  raisedAt: number;
}

export interface HypeTrainState {
  active: boolean;
  level: number;
  points: number;
  goalPoints: number;
  endsAt: number;
  lastContributor?: string;
  lastReason?: string;
}

export interface UpcomingStreamAnnouncement {
  title: string;
  scheduledIso: string;
  description?: string;
  hostName?: string;
}

export interface RoomState {
  roomCode: string;
  title: string;
  hostId: string;
  hostUid?: string;
  isLocked: boolean;
  isLive: boolean;
  liveStartedAt: number | null;
  aspectRatio: AspectRatio;
  watchMode: WatchMode;
  viewerCount: number;
  participants: Participant[];
  lobby: KnockRequest[];
  squadQueue: SquadQueueEntry[];
  handRaiseQueue?: HandRaiseEntry[];
  hypeTrain?: HypeTrainState;
  upcomingStream?: UpcomingStreamAnnouncement | null;
  questions?: AudienceQuestion[];
  pinnedChatId?: string | null;
  blockedUsers?: BlockedChatUser[];
  scene: SceneState;
  overlays: OverlayState;
  brand: BrandState;
  commerce: CommerceState;
  gamer: GamerState;
  rundown: {
    steps: RundownStep[];
    activeStepId: string | null;
  };
  chatMessages: ChatMessage[];
}

export function buildBoxesForTemplate(
  templateId: string,
  aspect: AspectRatio,
  participants: Participant[]
): CustomStageElement[] {
  const onStage = participants.filter((p) => p.onStage);
  const p0 = onStage[0] || participants[0];
  const p1 = onStage[1] || participants[1];
  const p2 = onStage[2] || participants[2];
  const p3 = onStage[3] || participants[3];

  if (aspect === '9:16') {
    if (templateId === 'v-split') {
      return [
        { id: 'box-1', kind: 'participant', label: p0?.name || 'Host', participantId: p0?.id, x: 0.04, y: 0.03, w: 0.92, h: 0.455 },
        { id: 'box-2', kind: 'participant', label: p1?.name || 'Guest', participantId: p1?.id, x: 0.04, y: 0.515, w: 0.92, h: 0.455 },
      ];
    }
    if (templateId === 'v-react') {
      return [
        { id: 'box-media', kind: 'media', label: 'Stage Media', x: 0.03, y: 0.03, w: 0.94, h: 0.94 },
        { id: 'box-cam', kind: 'participant', label: p0?.name || 'Host', participantId: p0?.id, x: 0.56, y: 0.67, w: 0.38, h: 0.27 },
      ];
    }
    if (templateId === 'v-shop') {
      return [
        { id: 'box-host', kind: 'participant', label: p0?.name || 'Host', participantId: p0?.id, x: 0.04, y: 0.03, w: 0.92, h: 0.68 },
        { id: 'box-media', kind: 'media', label: 'Lookbook Card', x: 0.04, y: 0.74, w: 0.92, h: 0.23 },
      ];
    }
    return [
      { id: 'box-solo-v', kind: 'participant', label: p0?.name || 'Host', participantId: p0?.id, x: 0.04, y: 0.03, w: 0.92, h: 0.94 },
    ];
  }

  switch (templateId) {
    case 'duo':
      return [
        { id: 'box-1', kind: 'participant', label: p0?.name || 'Host', participantId: p0?.id, x: 0.03, y: 0.05, w: 0.46, h: 0.9 },
        { id: 'box-2', kind: 'participant', label: p1?.name || 'Co-Host', participantId: p1?.id, x: 0.51, y: 0.05, w: 0.46, h: 0.9 },
      ];
    case 'spotlight':
      return [
        { id: 'box-main', kind: 'participant', label: p0?.name || 'Lead', participantId: p0?.id, x: 0.03, y: 0.05, w: 0.67, h: 0.9 },
        { id: 'box-side-1', kind: 'participant', label: p1?.name || 'Guest 1', participantId: p1?.id, x: 0.72, y: 0.05, w: 0.25, h: 0.435 },
        { id: 'box-side-2', kind: 'participant', label: p2?.name || 'Guest 2', participantId: p2?.id, x: 0.72, y: 0.515, w: 0.25, h: 0.435 },
      ];
    case 'grid-4':
      return [
        { id: 'box-1', kind: 'participant', label: p0?.name || 'Cam 1', participantId: p0?.id, x: 0.03, y: 0.05, w: 0.46, h: 0.435 },
        { id: 'box-2', kind: 'participant', label: p1?.name || 'Cam 2', participantId: p1?.id, x: 0.51, y: 0.05, w: 0.46, h: 0.435 },
        { id: 'box-3', kind: 'participant', label: p2?.name || 'Cam 3', participantId: p2?.id, x: 0.03, y: 0.515, w: 0.46, h: 0.435 },
        { id: 'box-4', kind: 'participant', label: p3?.name || 'Cam 4', participantId: p3?.id, x: 0.51, y: 0.515, w: 0.46, h: 0.435 },
      ];
    case 'slides-cam':
      return [
        { id: 'box-media', kind: 'media', label: 'Keynote Deck', x: 0.03, y: 0.05, w: 0.69, h: 0.9 },
        { id: 'box-cam', kind: 'participant', label: p0?.name || 'Presenter', participantId: p0?.id, x: 0.74, y: 0.24, w: 0.23, h: 0.52 },
      ];
    case 'pip-br':
      return [
        { id: 'box-media', kind: 'media', label: 'Screen / Gameplay', x: 0.025, y: 0.04, w: 0.95, h: 0.92 },
        { id: 'box-pip', kind: 'participant', label: p0?.name || 'Facecam', participantId: p0?.id, x: 0.71, y: 0.63, w: 0.245, h: 0.3 },
      ];
    case 'cinema':
      return [
        { id: 'box-cinema', kind: 'participant', label: p0?.name || 'Cinema Host', participantId: p0?.id, x: 0.02, y: 0.11, w: 0.96, h: 0.78 },
      ];
    default:
      return [
        { id: 'box-solo', kind: 'participant', label: p0?.name || 'Host', participantId: p0?.id, x: 0.03, y: 0.04, w: 0.94, h: 0.92 },
      ];
  }
}

export interface SceneTemplate {
  id: string;
  name: string;
  aspect: AspectRatio;
  description: string;
}

export interface AudioChannelState {
  id: string;
  label: string;
  gain: number; // 0..1.5
  muted: boolean;
  solo: boolean;
  monitor: boolean;
  clarityEq: boolean;
  level: number; // 0..1 live meter
}

export interface VideoFxSettings {
  brightness: number; // 50..150
  contrast: number; // 50..150
  saturation: number; // 0..200
  mirror: boolean;
  blurBg: boolean;
  bgMode?: 'natural' | 'blur' | 'dim';
  chromaKey: boolean;
  chromaColor: string;
  chromaTolerance: number;
}

export interface SlideAiCue {
  pageNumber: number;
  slideTitle: string;
  talkingPoints: string[];
  teleprompterScript: string;
  suggestedBannerTitle: string;
  suggestedBannerSub: string;
  suggestedPollQuestion?: string;
}

export interface MediaAsset {
  id: string;
  kind: 'pdf' | 'video' | 'image';
  name: string;
  url?: string;
  pages?: HTMLCanvasElement[];
  slideTexts?: string[];
  slideCues?: SlideAiCue[];
  currentPage: number;
  totalPages: number;
  videoEl?: HTMLVideoElement;
  imageEl?: HTMLImageElement;
}

export interface MagicClipSuggestion {
  id: string;
  title: string;
  hookCaption: string;
  startSec: number;
  endSec: number;
  aspect: '9:16' | '16:9';
  viralityReason: string;
  category: string;
}

export interface AiGraphicSpec {
  headline: string;
  subtitle: string;
  themeName: string;
  primaryHex: string;
  secondaryHex: string;
  tertiaryHex: string;
  surfaceHex: string;
  pattern: 'aurora' | 'grid' | 'rings' | 'prism';
  badgeText: string;
}

export interface PodcastDirectoryStatus {
  platform: 'spotify' | 'apple' | 'amazon' | 'youtube';
  connected: boolean;
  directoryUrl?: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  summary: string;
  durationSec: number;
  publishedAt: string;
  audioUrl: string;
  audioFormat: 'audio/wav' | 'audio/webm';
  fileSizeBytes: number;
  seasonNumber?: number;
  episodeNumber?: number;
  chapters?: string[];
}

export interface PodcastShowConfig {
  slug: string;
  title: string;
  author: string;
  email: string;
  description: string;
  category: string;
  language: string;
  coverArtUrl: string;
  directories: PodcastDirectoryStatus[];
  episodes: PodcastEpisode[];
}

export interface ScheduledShow {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  durationMin: number;
  watchMode: WatchMode;
  roomCode: string;
  invitees: string;
}

export interface DestinationConfig {
  id: string;
  platform:
    | 'youtube'
    | 'twitch'
    | 'linkedin'
    | 'x'
    | 'kick'
    | 'tiktok'
    | 'instagram'
    | 'custom';
  label: string;
  channelUrl: string;
  streamKey: string;
  rtmpUrl?: string;
  enabled: boolean;
}

export interface AIProducerAction {
  name: string;
  args: Record<string, unknown>;
}

export interface AILogEntry {
  id: string;
  role: 'user' | 'ai';
  text: string;
  actions?: AIProducerAction[];
  timestamp: number;
  pushedToStage?: boolean;
}

