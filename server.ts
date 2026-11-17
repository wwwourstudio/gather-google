import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel, FunctionDeclaration } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// Initialize Gemini client strictly server-side
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// --- Authoritative Room Store ---
interface ClientMeta {
  ws: WebSocket;
  clientId: string;
  roomCode: string;
  role: 'host' | 'guest' | 'viewer';
  name: string;
}

interface ServerRoomState {
  roomCode: string;
  title: string;
  hostId: string;
  isLocked: boolean;
  isLive: boolean;
  liveStartedAt: number | null;
  aspectRatio: '16:9' | '9:16';
  watchMode: 'standard' | 'shop' | 'gamer';
  viewerCount: number;
  participants: Array<{
    id: string;
    name: string;
    initials: string;
    avatarUrl?: string;
    role: 'host' | 'guest';
    onStage: boolean;
    micOn: boolean;
    camOn: boolean;
    sharingScreen: boolean;
    mutedByHost?: boolean;
    joinedAt: number;
  }>;
  lobby: Array<{
    id: string;
    name: string;
    initials: string;
    avatarUrl?: string;
    requestedAt: number;
  }>;
  squadQueue: Array<{
    id: string;
    handle: string;
    platform: string;
    role?: string;
    rank?: string;
    note?: string;
    joinedAt: number;
  }>;
  questions: Array<{
    id: string;
    author: string;
    text: string;
    upvotes: number;
    answered?: boolean;
    createdAt: number;
  }>;
  scene: {
    templateId: string;
    transitionType: 'cut' | 'dissolve' | 'slide' | 'push';
    transitionMs: number;
    customElements: unknown[];
    savedPresets?: Array<Record<string, unknown>>;
  };
  overlays: {
    banner: { visible: boolean; title: string; subtitle: string; style: string };
    ticker: { visible: boolean; text: string };
    featuredChatId: string | null;
    featuredQuestionId?: string | null;
    chatOverlayOnStage?: boolean;
    showSupportQrOnStage?: boolean;
    captionsEnabled: boolean;
    captionText: string;
    captionLang: string;
    captionStyle?: 'glass' | 'bar' | 'minimal';
    countdownEndAt?: number | null;
    countdownLabel?: string;
  };
  brand: Record<string, unknown>;
  commerce: {
    storeLabel: string;
    shopifyDomain?: string;
    etsyShopName?: string;
    products: Array<{
      id: string;
      source: 'shopify' | 'etsy' | 'custom';
      title: string;
      price: number;
      currency: string;
      imageUrl: string;
      url: string;
      stock: number;
      variants: string[];
      description?: string;
    }>;
    pinnedProductId: string | null;
    recentOrders: Array<{
      id: string;
      productId: string;
      productTitle: string;
      variant?: string;
      quantity: number;
      total: number;
      buyerName: string;
      createdAt: number;
    }>;
    payouts: {
      enabled: boolean;
      paypalHandle?: string;
      venmoHandle?: string;
      cashappTag?: string;
      stripeUrl?: string;
    };
  };
  gamer: {
    gameTitle: string;
    modeOrRank: string;
    seriesScore?: string;
    currentMap?: string;
    lobbyCode: string;
    gearSpecs: unknown[];
    activePoll: {
      id: string;
      question: string;
      options: Array<{ id: string; label: string; votes: number }>;
      isOpen: boolean;
      showOnStage: boolean;
      createdAt: number;
    } | null;
    clips: Array<{
      id: string;
      label: string;
      timestampSec: number;
      createdBy: string;
      createdAt: number;
    }>;
    hypeCount: number;
    slowModeSec: number;
  };
  rundown: {
    steps: unknown[];
    activeStepId: string | null;
  };
  chatMessages: Array<{
    id: string;
    author: string;
    authorUid?: string;
    avatarUrl?: string;
    role: 'host' | 'guest' | 'viewer' | 'order' | 'superchat' | 'payment-card' | 'system';
    source: 'studio' | 'watch' | 'youtube' | 'twitch';
    text: string;
    timestamp: number;
    replyTo?: {
      id: string;
      author: string;
      text: string;
    };
    likes?: number;
    likedBy?: string[];
    reactions?: Record<string, string[]>;
    superChat?: {
      amount: number;
      method: 'card' | 'paypal' | 'venmo' | 'cashapp' | 'stripe';
      tier: 'blue' | 'emerald' | 'amber' | 'rose';
    };
    paymentCard?: {
      headline: string;
      note?: string;
      suggestedAmounts?: number[];
    };
  }>;
  pinnedChatId?: string | null;
  blockedUsers?: Array<{
    id: string;
    author: string;
    uid?: string;
    blockedAt: number;
  }>;
  hostUid?: string;
  handRaiseQueue: Array<{
    id: string;
    uid?: string;
    name: string;
    initials: string;
    avatarUrl?: string;
    topic: string;
    raisedAt: number;
  }>;
  hypeTrain: {
    active: boolean;
    level: number;
    points: number;
    goalPoints: number;
    endsAt: number;
    lastContributor?: string;
    lastReason?: string;
  };
  upcomingStream: {
    title: string;
    scheduledIso: string;
    description?: string;
    hostName?: string;
  } | null;
}

interface ServerFlashSale {
  id: string;
  productId: string;
  discountPct: number;
  totalUnits: number;
  soldUnits: number;
  startedAt: number;
  endsAt: number;
  tagline: string;
  bundles: Array<{
    id: string;
    quantity: number;
    label: string;
    discountPct: number;
    badge?: string;
  }>;
  active: boolean;
}

interface ServerPodcastEpisode {
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

interface ServerPodcastShow {
  slug: string;
  title: string;
  author: string;
  email: string;
  description: string;
  category: string;
  language: string;
  coverArtUrl: string;
  directories: Array<{
    platform: 'spotify' | 'apple' | 'amazon' | 'youtube';
    connected: boolean;
    directoryUrl?: string;
  }>;
  episodes: ServerPodcastEpisode[];
}

const rooms = new Map<string, ServerRoomState>();
const roomSockets = new Map<string, Map<string, ClientMeta>>();
const podcastShows = new Map<string, ServerPodcastShow>();
const podcastAudioBuffers = new Map<string, { buffer: Buffer; mimeType: string }>();

function createServerSilentOrChordWavBuffer(durationSec = 4): Buffer {
  const sampleRate = 22050;
  const numChannels = 1;
  const frameCount = sampleRate * durationSec;
  const dataByteLength = frameCount * 2;
  const buf = Buffer.alloc(44 + dataByteLength);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataByteLength, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataByteLength, 40);
  const freqs = [261.63, 329.63, 392.0, 523.25];
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t / 0.15) * Math.exp(-t * 0.55);
    let sample = 0;
    for (let f = 0; f < freqs.length; f++) {
      sample += Math.sin(2 * Math.PI * freqs[f] * t) * 0.16;
    }
    const pcm = Math.max(-1, Math.min(1, sample * env));
    buf.writeInt16LE(Math.round(pcm * 32767), 44 + i * 2);
  }
  return buf;
}

function ensurePodcastShow(rawSlug: string, origin = 'http://localhost:3000'): ServerPodcastShow {
  const slug =
    rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'gather-live';
  let show = podcastShows.get(slug);
  if (!show) {
    const seedEpId = `ep-seed-${slug}`;
    if (!podcastAudioBuffers.has(seedEpId)) {
      podcastAudioBuffers.set(seedEpId, {
        buffer: createServerSilentOrChordWavBuffer(5),
        mimeType: 'audio/wav',
      });
    }
    const seedBuf = podcastAudioBuffers.get(seedEpId)!;
    show = {
      slug,
      title: 'The Gather Live Broadcast',
      author: 'Gather Studio Creators',
      email: 'podcasts@gather.studio',
      description:
        'Zero-fee live broadcasts recorded in uncompressed 16-bit WAV directly from the Gather Master Audio Bus and syndicated automatically via RSS.',
      category: 'Technology',
      language: 'en-us',
      coverArtUrl: `${origin}/icon.png`,
      directories: [
        { platform: 'spotify', connected: true, directoryUrl: 'https://creators.spotify.com' },
        { platform: 'apple', connected: true, directoryUrl: 'https://podcastsconnect.apple.com' },
        { platform: 'amazon', connected: false, directoryUrl: 'https://podcasters.amazon.com' },
        { platform: 'youtube', connected: false, directoryUrl: 'https://studio.youtube.com' },
      ],
      episodes: [
        {
          id: seedEpId,
          title: 'Episode 01 · Zero-Fee Live Broadcast & Audio Architecture',
          summary:
            'Recorded live on Gather Studio with isolated WebAudio tracks, AI chapters, and direct creator tipping.',
          durationSec: 5,
          publishedAt: new Date(Date.now() - 3600 * 1000).toUTCString(),
          audioUrl: `${origin}/api/podcast/audio/${seedEpId}.wav`,
          audioFormat: 'audio/wav',
          fileSizeBytes: seedBuf.buffer.byteLength,
          seasonNumber: 1,
          episodeNumber: 1,
          chapters: ['00:00 Studio Intro', '00:02 Master Audio Bus Check'],
        },
      ],
    };
    podcastShows.set(slug, show);
  }
  return show;
}

function advanceHypeTrain(
  room: ServerRoomState,
  pointsAdded: number,
  contributor: string,
  reason: string
) {
  const now = Date.now();
  if (!room.hypeTrain || (room.hypeTrain.active && room.hypeTrain.endsAt < now)) {
    room.hypeTrain = {
      active: false,
      level: 1,
      points: 0,
      goalPoints: 100,
      endsAt: 0,
    };
  }
  const ht = room.hypeTrain;
  ht.points += pointsAdded;
  ht.lastContributor = contributor;
  ht.lastReason = reason;

  if (!ht.active && ht.points >= 25) {
    ht.active = true;
    ht.endsAt = now + 3 * 60 * 1000;
  } else if (ht.active) {
    ht.endsAt = Math.max(ht.endsAt, now + 90 * 1000);
  }

  while (ht.points >= ht.goalPoints && ht.level < 5) {
    ht.points -= ht.goalPoints;
    ht.level += 1;
    ht.goalPoints = Math.round(ht.goalPoints * 1.35);
    ht.endsAt = now + 3 * 60 * 1000;
  }
}

function buildFlashBundles(discountPct: number): ServerFlashSale['bundles'] {
  const base = Math.max(5, Math.min(60, Math.round(discountPct)));
  const duo = Math.min(70, base + 10);
  const trio = Math.min(75, base + 18);
  return [
    { id: 'tier-1', quantity: 1, label: '1× Single', discountPct: base, badge: `${base}% OFF` },
    {
      id: 'tier-2',
      quantity: 2,
      label: '2× Duo Bundle',
      discountPct: duo,
      badge: `POPULAR · ${duo}% OFF`,
    },
    {
      id: 'tier-3',
      quantity: 3,
      label: '3× VIP Pack',
      discountPct: trio,
      badge: `BEST VALUE · ${trio}% OFF`,
    },
  ];
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'G'
  );
}

function createDefaultRoom(
  roomCode: string,
  hostId: string,
  hostName: string,
  initialMode?: 'standard' | 'shop' | 'gamer',
  isViewerDemo = false
): ServerRoomState {
  const watchMode: 'standard' | 'shop' | 'gamer' =
    initialMode ||
    (roomCode.startsWith('GAMER') ? 'gamer' : roomCode.startsWith('SHOP') ? 'shop' : 'standard');
  const isGamer = watchMode === 'gamer';
  const isShop = watchMode === 'shop';

  return {
    roomCode,
    title: isGamer
      ? 'Ranked Squad Co-Stream'
      : isShop
      ? 'Studio Ceramic & Audio Live Drop'
      : 'Gather Keynote & Founder Town Hall',
    hostId,
    isLocked: false,
    isLive: isViewerDemo,
    liveStartedAt: isViewerDemo ? Date.now() - 240000 : null,
    aspectRatio: '16:9',
    watchMode,
    viewerCount: 0,
    participants: isViewerDemo
      ? [
          {
            id: 'demo-host',
            name: 'Maya Chen',
            initials: 'MC',
            avatarUrl: '/src/assets/images/host_maya_studio_1794840297410.jpg',
            role: 'host',
            onStage: true,
            micOn: true,
            camOn: false,
            sharingScreen: false,
            joinedAt: Date.now(),
          },
          {
            id: 'demo-guest',
            name: 'Jordan Lee',
            initials: 'JL',
            avatarUrl: '/src/assets/images/host_jordan_studio_1794840296850.jpg',
            role: 'guest',
            onStage: true,
            micOn: true,
            camOn: false,
            sharingScreen: false,
            joinedAt: Date.now(),
          },
        ]
      : [],
    lobby: [],
    squadQueue: isGamer && isViewerDemo
      ? [
          {
            id: 'sq-demo-1',
            handle: 'Kuro#NA1',
            platform: 'PC · Discord',
            role: 'Sentinel',
            rank: 'Immortal II',
            note: 'Controller / Sentinel',
            joinedAt: Date.now() - 120000,
          },
          {
            id: 'sq-demo-2',
            handle: 'NovaPulse',
            platform: 'PlayStation',
            role: 'IGL',
            rank: 'Ascendant III',
            note: 'Ready for next lobby',
            joinedAt: Date.now() - 45000,
          },
        ]
      : [],
    questions: [
      {
        id: 'qa-demo-1',
        author: 'Elena V.',
        text: 'How are you running 8-platform simulcast + WebRTC audio mixing with zero monthly fees?',
        upvotes: 14,
        answered: false,
        createdAt: Date.now() - 180000,
      },
      {
        id: 'qa-demo-2',
        author: 'Marcus T.',
        text: 'Can guests join from mobile Safari with isolated audio channels and custom stingers?',
        upvotes: 9,
        answered: false,
        createdAt: Date.now() - 95000,
      },
    ],
    scene: {
      templateId: isViewerDemo ? 'duo' : 'solo',
      transitionType: 'dissolve',
      transitionMs: 320,
      customElements: [],
      savedPresets: [],
    },
    overlays: {
      banner: {
        visible: isViewerDemo,
        title: isGamer
          ? 'Ranked Squad Co-Stream'
          : isShop
          ? 'Live Studio Drop · Limited Batch'
          : 'Episode 12: Zero-Fee Broadcast Architecture',
        subtitle: isGamer
          ? 'Vote in the live prediction poll & join the squad queue'
          : isShop
          ? 'Add directly to your Express Bag without leaving the stream'
          : 'Upvote live questions in Q&A or tip directly inside chat',
        style: 'glass',
      },
      ticker: {
        visible: false,
        text: 'Welcome to gather. — 100% Free Studio · Direct in-chat creator support with 0% platform cut',
      },
      featuredChatId: null,
      featuredQuestionId: null,
      chatOverlayOnStage: false,
      showSupportQrOnStage: false,
      captionsEnabled: false,
      captionText: '',
      captionLang: 'en-US',
      captionStyle: 'glass',
      countdownEndAt: null,
      countdownLabel: '',
    },
    brand: {
      accent: '#2f6bf0',
      backdrop: 'dusk',
      backdropDim: 35,
      font: 'Plus Jakarta Sans',
      frame: 'none',
      nameTagStyle: 'glass',
      showNames: true,
      logoPosition: 'tr',
      logoSize: 44,
      sponsorsEnabled: false,
      sponsorIntervalSec: 15,
      sponsors: [
        {
          id: 'spon-1',
          label: 'Gather Studio',
          tagline: '100% Free Broadcast Studio · Made in Texas',
        },
        {
          id: 'spon-2',
          label: 'Direct Creator Pay',
          tagline: '0% Platform Fees · Instant In-Chat Tips',
        },
      ],
    },
    commerce: {
      storeLabel: 'Studio Merch & Curated Drops',
      products: [
        {
          id: 'prod-mug',
          source: 'etsy',
          title: 'Cobalt Glaze Pour-Over Mug',
          price: 38.0,
          currency: 'USD',
          imageUrl: '/src/assets/images/product_ceramic_mug_1794839256911.jpg',
          url: 'https://www.etsy.com',
          stock: 18,
          variants: ['12oz Matte Slate', '16oz Cobalt Drip'],
          description: 'Hand-thrown stoneware mug fired with deep cobalt ash glaze.',
        },
        {
          id: 'prod-mic',
          source: 'shopify',
          title: 'Studio Dynamic XLR Broadcast Mic',
          price: 189.0,
          currency: 'USD',
          imageUrl: '/src/assets/images/product_broadcast_mic_1794839257210.jpg',
          url: 'https://www.shopify.com',
          stock: 14,
          variants: ['Obsidian + Boom Arm', 'Mic Only'],
          description: 'Cardioid dynamic vocal microphone tuned for low-noise live broadcasts.',
        },
        {
          id: 'prod-kb',
          source: 'shopify',
          title: 'Gather 65% Cobalt Mechanical Board',
          price: 145.0,
          currency: 'USD',
          imageUrl: '/src/assets/images/product_gaming_keyboard_1794839258672.jpg',
          url: 'https://www.shopify.com',
          stock: 6,
          variants: ['Linear Tactile · Navy', 'Silent Red · Cobalt'],
          description: 'Gasket-mounted anodized 65% board with coiled aviator cable.',
        },
      ],
      pinnedProductId: isShop ? 'prod-mug' : null,
      recentOrders: [],
      payouts: {
        enabled: true,
        paypalHandle: 'gatherstudio',
        venmoHandle: 'gather-live',
        cashappTag: 'GatherLive',
        stripeUrl: '',
      },
      activeFlashSale: isShop
        ? {
            id: `flash-init-${roomCode}`,
            productId: 'prod-mug',
            discountPct: 20,
            totalUnits: 15,
            soldUnits: 7,
            startedAt: Date.now() - 90000,
            endsAt: Date.now() + 9 * 60 * 1000,
            tagline: 'TV FLASH DROP · VOLUME BUNDLE PRICING',
            bundles: buildFlashBundles(20),
            active: true,
          }
        : null,
      latestSalePopup: null,
    } as ServerRoomState['commerce'] & {
      activeFlashSale?: ServerFlashSale | null;
      latestSalePopup?: Record<string, unknown> | null;
    },
    gamer: {
      gameTitle: 'Valorant · Ranked Co-Stream',
      modeOrRank: 'Ascendant II · NA West',
      seriesScore: 'BO3 · 1–0',
      currentMap: 'Ascent',
      lobbyCode: `GTH-${roomCode}`,
      gearSpecs: [
        { id: 'gear-1', category: 'Mic', label: 'Primary Voice', value: 'Studio Dynamic XLR', productId: 'prod-mic' },
        { id: 'gear-2', category: 'Board', label: 'Keyboard', value: 'Gather 65% Cobalt', productId: 'prod-kb' },
        { id: 'gear-3', category: 'Display', label: 'Capture', value: '1440p 120Hz Low-Latency' },
      ],
      activePoll: isGamer
        ? {
            id: 'poll-demo',
            question: 'Next map challenge?',
            options: [
              { id: 'opt-1', label: 'Ascent · Sheriff Only', votes: 18 },
              { id: 'opt-2', label: 'Bind · Rush A Site', votes: 11 },
            ],
            isOpen: true,
            showOnStage: true,
            createdAt: Date.now(),
          }
        : isViewerDemo
        ? {
            id: 'poll-talk',
            question: 'Which segment should we dive deeper into next?',
            options: [
              { id: 'opt-a', label: 'WebRTC Sub-Second Audio Bus', votes: 24 },
              { id: 'opt-b', label: '0%-Fee Direct Creator Tipping', votes: 31 },
            ],
            isOpen: true,
            showOnStage: false,
            createdAt: Date.now(),
          }
        : null,
      clips: isViewerDemo
        ? [
            {
              id: 'clip-demo-1',
              label: isGamer ? '4K Clutch on Ascent B' : 'Live Architecture Breakdown',
              timestampSec: 142,
              createdBy: 'Maya Chen',
              createdAt: Date.now() - 180000,
            },
            {
              id: 'clip-demo-2',
              label: isGamer ? 'Wallbang Operator Pick · Mid' : 'Zero-Fee Creator Payouts Demo',
              timestampSec: 255,
              createdBy: 'Jordan Lee',
              createdAt: Date.now() - 60000,
            },
          ]
        : [],
      hypeCount: isViewerDemo ? 128 : isGamer ? 24 : 0,
      slowModeSec: 0,
    },
    rundown: {
      steps: [
        {
          id: 'step-1',
          title: 'Cold Open & Guest Intros',
          durationMin: 4,
          sceneId: 'duo',
          bannerTitle: 'Welcome to Gather Live',
          bannerSub: 'Say hello in Watch Chat — show begins now',
          completed: true,
        },
        {
          id: 'step-2',
          title: isShop ? 'Featured Drop Walkthrough' : 'Deep Dive & Live Demo',
          durationMin: 10,
          sceneId: 'spotlight',
          bannerTitle: isShop ? 'Live Drop: Cobalt Pour-Over Mug' : 'Zero-Fee Studio Walkthrough',
          bannerSub: isShop
            ? 'Tap Express Checkout right inside the Watch Page'
            : 'Drop your questions in the Audience Q&A tab',
          productId: isShop ? 'prod-mug' : undefined,
          completed: false,
        },
        {
          id: 'step-3',
          title: 'Upvoted Audience Q&A & Closing',
          durationMin: 8,
          sceneId: 'screen-cam',
          bannerTitle: 'Live Audience Q&A',
          bannerSub: 'Featuring top-voted questions directly on stage',
          completed: false,
        },
      ],
      activeStepId: 'step-2',
    },
    chatMessages: [
      {
        id: `host-${roomCode}-welcome`,
        author: isViewerDemo ? 'Maya Chen' : hostName || 'Studio',
        avatarUrl: isViewerDemo ? '/src/assets/images/host_maya_studio_1794840297410.jpg' : undefined,
        role: isViewerDemo ? 'host' : 'system',
        source: 'studio',
        text: isViewerDemo
          ? isGamer
            ? 'Welcome in! Vote in the prediction poll or drop your tag for next lobby.'
            : isShop
            ? 'Welcome to the live drop! Claim a piece from the lookbook or tap $ Support in the composer.'
            : 'Welcome to the broadcast! Upvote questions in Q&A or tap $ Support in the composer.'
          : `Studio ${roomCode} initialized by ${hostName}. Share the invite or Watch Link when ready.`,
        timestamp: Date.now() - 90000,
        likes: isViewerDemo ? 6 : 0,
        likedBy: [],
        reactions: isViewerDemo ? { '❤️': ['v1', 'v2'], '🔥': ['v3'] } : {},
      },
      ...(isViewerDemo
        ? [
            {
              id: 'sc-demo-1',
              author: 'Devon R.',
              role: 'superchat' as const,
              source: 'watch' as const,
              text: isGamer
                ? 'Run Sheriff-only on Ascent! Huge clutch earlier.'
                : isShop
                ? 'Grabbed the 16oz Cobalt Drip mug — love the live glaze demo!'
                : 'Switched our weekly podcast from StreamYard to Gather — zero fees is insane!',
              timestamp: Date.now() - 48000,
              likes: 4,
              likedBy: [],
              superChat: {
                amount: 25,
                method: 'card' as const,
                tier: 'amber' as const,
              },
            },
            {
              id: 'reply-demo-1',
              author: 'Jordan Lee',
              avatarUrl: '/src/assets/images/host_jordan_studio_1794840296850.jpg',
              role: 'guest' as const,
              source: 'studio' as const,
              text: isGamer
                ? 'Locked in — Sheriff round coming right after this buy phase.'
                : isShop
                ? 'Appreciate you Devon! Packaging batch #07 live on camera next.'
                : 'Wait until you hear the uncompressed isolated WAV stem export too.',
              timestamp: Date.now() - 25000,
              replyTo: {
                id: 'sc-demo-1',
                author: 'Devon R.',
                text: isGamer
                  ? 'Run Sheriff-only on Ascent! Huge clutch earlier.'
                  : isShop
                  ? 'Grabbed the 16oz Cobalt Drip mug — love the live glaze demo!'
                  : 'Switched our weekly podcast from StreamYard to Gather — zero fees is insane!',
              },
              likes: 3,
              likedBy: [],
            },
          ]
        : []),
    ],
    pinnedChatId: null,
    blockedUsers: [],
    handRaiseQueue: isViewerDemo && !isShop
      ? [
          {
            id: 'hr-demo-1',
            name: 'Samira K.',
            initials: 'SK',
            topic: 'How are you routing DAW stingers + podcast WAV in real time?',
            raisedAt: Date.now() - 70000,
          },
        ]
      : [],
    hypeTrain: {
      active: isViewerDemo,
      level: isViewerDemo ? 2 : 1,
      points: isViewerDemo ? 68 : 0,
      goalPoints: isViewerDemo ? 135 : 100,
      endsAt: isViewerDemo ? Date.now() + 165000 : 0,
      lastContributor: isViewerDemo ? 'Devon R.' : undefined,
      lastReason: isViewerDemo ? '$25 Super Chat' : undefined,
    },
    upcomingStream: {
      title: isShop
        ? 'Friday Ceramics & Synth Hardware Flash Show'
        : 'Next Live Episode · Creator Town Hall & Q&A',
      scheduledIso: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      description: 'Subscribe with 1 click to get an email reminder 15 minutes before we go live.',
      hostName: isViewerDemo ? 'Maya Chen' : hostName || 'Gather Host',
    },
  };
}

function broadcastRoomState(roomCode: string) {
  const room = rooms.get(roomCode);
  const clients = roomSockets.get(roomCode);
  if (!room || !clients) return;

  let viewers = 0;
  for (const meta of clients.values()) {
    if (meta.role === 'viewer') viewers++;
  }
  room.viewerCount = viewers;

  const comm = room.commerce as ServerRoomState['commerce'] & {
    activeFlashSale?: ServerFlashSale | null;
  };
  if (comm.activeFlashSale?.active && comm.activeFlashSale.endsAt <= Date.now()) {
    comm.activeFlashSale.active = false;
  }
  if (room.hypeTrain?.active && room.hypeTrain.endsAt <= Date.now()) {
    room.hypeTrain.active = false;
  }

  const payload = JSON.stringify({ type: 'room:state', state: room });
  for (const meta of clients.values()) {
    if (meta.ws.readyState === WebSocket.OPEN) {
      meta.ws.send(payload);
    }
  }
}

function sendToClient(roomCode: string, targetId: string, payload: unknown) {
  const clients = roomSockets.get(roomCode);
  const target = clients?.get(targetId);
  if (target && target.ws.readyState === WebSocket.OPEN) {
    target.ws.send(JSON.stringify(payload));
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let joinedRoomCode: string | null = null;
    let joinedClientId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        const type = String(msg.type || '');

        if (type === 'room:join') {
          const roomCode = String(msg.roomCode || 'LIVE01').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'LIVE01';
          const clientId = String(msg.clientId || `c-${Math.random().toString(36).slice(2, 9)}`);
          const role = (msg.role as 'host' | 'guest' | 'viewer') || 'guest';
          const name = String(msg.name || (role === 'viewer' ? 'Viewer' : 'Guest')).slice(0, 40);
          const avatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl : undefined;
          const hostUid = typeof msg.hostUid === 'string' ? msg.hostUid.slice(0, 128) : undefined;

          joinedRoomCode = roomCode;
          joinedClientId = clientId;

          let room = rooms.get(roomCode);
          if (!room) {
            const reqMode =
              msg.watchMode === 'gamer' || msg.watchMode === 'shop' || msg.watchMode === 'standard'
                ? msg.watchMode
                : undefined;
            const isViewerDemo =
              role === 'viewer' &&
              (roomCode === 'GAMER1' || roomCode === 'SHOP01' || roomCode === 'CAST01');
            room = createDefaultRoom(roomCode, clientId, name, reqMode, isViewerDemo);
            if (typeof msg.title === 'string' && msg.title.trim()) {
              room.title = msg.title.trim().slice(0, 80);
            }
            if (role === 'host' && hostUid) {
              room.hostUid = hostUid;
            }
            if (msg.payouts && typeof msg.payouts === 'object') {
              const po = msg.payouts as Record<string, unknown>;
              room.commerce.payouts = {
                enabled: po.enabled !== false,
                paypalHandle: typeof po.paypalHandle === 'string' ? po.paypalHandle.slice(0, 60) : room.commerce.payouts.paypalHandle,
                venmoHandle: typeof po.venmoHandle === 'string' ? po.venmoHandle.slice(0, 60) : room.commerce.payouts.venmoHandle,
                cashappTag: typeof po.cashappTag === 'string' ? po.cashappTag.slice(0, 40) : room.commerce.payouts.cashappTag,
                stripeUrl: typeof po.stripeUrl === 'string' ? po.stripeUrl.slice(0, 240) : room.commerce.payouts.stripeUrl,
              };
            }
            rooms.set(roomCode, room);
          } else if (role === 'host' && hostUid) {
            room.hostUid = hostUid;
          }

          if (!roomSockets.has(roomCode)) {
            roomSockets.set(roomCode, new Map());
          }
          roomSockets.get(roomCode)!.set(clientId, {
            ws,
            clientId,
            roomCode,
            role,
            name,
          });

          if (role === 'viewer') {
            ws.send(JSON.stringify({ type: 'room:joined', clientId, role: 'viewer' }));
            broadcastRoomState(roomCode);
            return;
          }

          // Check room lock for guests
          const isHost = role === 'host' || room.hostId === clientId;
          if (!isHost && room.isLocked && !room.participants.some((p) => p.id === clientId)) {
            const existsLobby = room.lobby.some((l) => l.id === clientId);
            if (!existsLobby) {
              room.lobby.push({
                id: clientId,
                name,
                initials: getInitials(name),
                avatarUrl,
                requestedAt: Date.now(),
              });
            }
            ws.send(JSON.stringify({ type: 'room:knocking', clientId, roomCode }));
            broadcastRoomState(roomCode);
            return;
          }

          // Admit to studio crew (idempotent)
          const existing = room.participants.find((p) => p.id === clientId);
          if (!existing && room.participants.length < 6) {
            room.participants.push({
              id: clientId,
              name,
              initials: getInitials(name),
              avatarUrl,
              role: isHost ? 'host' : 'guest',
              onStage: true,
              micOn: Boolean(msg.micOn ?? true),
              camOn: Boolean(msg.camOn ?? true),
              sharingScreen: false,
              joinedAt: Date.now(),
            });
          }

          ws.send(JSON.stringify({ type: 'room:joined', clientId, role: isHost ? 'host' : 'guest' }));
          broadcastRoomState(roomCode);
          return;
        }

        if (!joinedRoomCode || !joinedClientId) return;
        const room = rooms.get(joinedRoomCode);
        if (!room) return;

        if (type === 'room:admit') {
          const targetId = String(msg.targetId || '');
          const reqIdx = room.lobby.findIndex((l) => l.id === targetId);
          if (reqIdx !== -1 && room.participants.length < 6) {
            const [req] = room.lobby.splice(reqIdx, 1);
            if (!room.participants.some((p) => p.id === req.id)) {
              room.participants.push({
                id: req.id,
                name: req.name,
                initials: req.initials,
                avatarUrl: req.avatarUrl,
                role: 'guest',
                onStage: true,
                micOn: true,
                camOn: true,
                sharingScreen: false,
                joinedAt: Date.now(),
              });
            }
            sendToClient(joinedRoomCode, targetId, { type: 'room:admitted', clientId: targetId });
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'room:deny') {
          const targetId = String(msg.targetId || '');
          room.lobby = room.lobby.filter((l) => l.id !== targetId);
          sendToClient(joinedRoomCode, targetId, { type: 'room:denied', clientId: targetId });
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'room:kick') {
          const targetId = String(msg.targetId || '');
          room.participants = room.participants.filter((p) => p.id !== targetId);
          sendToClient(joinedRoomCode, targetId, { type: 'room:kicked' });
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'room:update_participant') {
          const targetId = String(msg.targetId || joinedClientId);
          const patch = (msg.patch as Record<string, unknown>) || {};
          const p = room.participants.find((item) => item.id === targetId);
          if (p) {
            if (typeof patch.name === 'string') {
              p.name = patch.name.slice(0, 40);
              p.initials = getInitials(p.name);
            }
            if (typeof patch.onStage === 'boolean') p.onStage = patch.onStage;
            if (typeof patch.micOn === 'boolean') p.micOn = patch.micOn;
            if (typeof patch.camOn === 'boolean') p.camOn = patch.camOn;
            if (typeof patch.sharingScreen === 'boolean') p.sharingScreen = patch.sharingScreen;
            if (typeof patch.mutedByHost === 'boolean') {
              p.mutedByHost = patch.mutedByHost;
              if (patch.mutedByHost) p.micOn = false;
            }
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'room:state_patch') {
          const patch = (msg.patch as Partial<ServerRoomState>) || {};
          if (typeof patch.title === 'string') room.title = patch.title.slice(0, 80);
          if (typeof patch.isLocked === 'boolean') room.isLocked = patch.isLocked;
          if (typeof patch.isLive === 'boolean') {
            room.isLive = patch.isLive;
            room.liveStartedAt = patch.isLive ? room.liveStartedAt ?? Date.now() : null;
          }
          if (patch.aspectRatio === '16:9' || patch.aspectRatio === '9:16') {
            room.aspectRatio = patch.aspectRatio;
          }
          if (patch.watchMode === 'standard' || patch.watchMode === 'shop' || patch.watchMode === 'gamer') {
            room.watchMode = patch.watchMode;
          }
          if (patch.scene) {
            room.scene = { ...room.scene, ...patch.scene };
          }
          if (patch.overlays) {
            room.overlays = {
              ...room.overlays,
              ...patch.overlays,
              banner: patch.overlays.banner
                ? { ...room.overlays.banner, ...patch.overlays.banner }
                : room.overlays.banner,
              ticker: patch.overlays.ticker
                ? { ...room.overlays.ticker, ...patch.overlays.ticker }
                : room.overlays.ticker,
            };
          }
          if (patch.brand) {
            room.brand = { ...room.brand, ...patch.brand };
          }
          if (patch.gamer) {
            room.gamer = { ...room.gamer, ...patch.gamer };
          }
          if (patch.rundown) {
            room.rundown = { ...room.rundown, ...patch.rundown };
          }
          if (patch.commerce) {
            room.commerce = { ...room.commerce, ...patch.commerce };
          }
          if ('upcomingStream' in patch) {
            room.upcomingStream = patch.upcomingStream ?? null;
          }
          if (typeof patch.hostUid === 'string') {
            room.hostUid = patch.hostUid.slice(0, 128);
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:send') {
          const text = String(msg.text || '').trim().slice(0, 400);
          if (!text) return;
          const clientMeta = roomSockets.get(joinedRoomCode)?.get(joinedClientId);
          const author = String(msg.author || clientMeta?.name || 'Guest').slice(0, 40);
          const authorUid = typeof msg.authorUid === 'string' ? msg.authorUid.slice(0, 128) : undefined;
          const blocked = (room.blockedUsers || []).some(
            (b) =>
              (authorUid && b.uid && b.uid === authorUid) ||
              b.author.toLowerCase() === author.toLowerCase()
          );
          if (blocked) {
            sendToClient(joinedRoomCode, joinedClientId, {
              type: 'chat:blocked_notice',
              message: 'You have been blocked from posting in this room.',
            });
            return;
          }
          const avatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl.slice(0, 500) : undefined;
          const rawReply = msg.replyTo as Record<string, unknown> | undefined;
          const replyTo =
            rawReply && typeof rawReply.id === 'string' && typeof rawReply.author === 'string'
              ? {
                  id: String(rawReply.id).slice(0, 80),
                  author: String(rawReply.author).slice(0, 40),
                  text: String(rawReply.text || '').slice(0, 140),
                }
              : undefined;
          const chatMsg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            author,
            authorUid,
            avatarUrl,
            role: (msg.role as ServerRoomState['chatMessages'][0]['role']) || (clientMeta?.role ?? 'viewer'),
            source: (msg.source as ServerRoomState['chatMessages'][0]['source']) || (clientMeta?.role === 'viewer' ? 'watch' : 'studio'),
            text,
            timestamp: Date.now(),
            replyTo,
            likes: 0,
            likedBy: [],
            reactions: {},
          };
          room.chatMessages = [...room.chatMessages.slice(-99), chatMsg];
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:toggle_reaction') {
          const messageId = String(msg.messageId || '');
          const rawEmoji = String(msg.emoji || '').trim();
          const allowedEmojis = new Set(['❤️', '🔥', '😮', '👏', '😂']);
          if (!messageId || !allowedEmojis.has(rawEmoji)) return;
          const actorId = String(msg.actorId || joinedClientId).slice(0, 128);
          const target = room.chatMessages.find((m) => m.id === messageId);
          if (target) {
            const nextReactions: Record<string, string[]> = { ...(target.reactions || {}) };
            const currentList = Array.isArray(nextReactions[rawEmoji])
              ? [...nextReactions[rawEmoji]]
              : [];
            const idx = currentList.indexOf(actorId);
            if (idx >= 0) {
              currentList.splice(idx, 1);
            } else if (currentList.length < 200) {
              currentList.push(actorId);
            }
            if (currentList.length > 0) {
              nextReactions[rawEmoji] = currentList;
            } else {
              delete nextReactions[rawEmoji];
            }
            target.reactions = nextReactions;
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'chat:toggle_like') {
          const messageId = String(msg.messageId || '');
          const actorId = String(msg.actorId || joinedClientId).slice(0, 128);
          const target = room.chatMessages.find((m) => m.id === messageId);
          if (target) {
            const list = Array.isArray(target.likedBy) ? [...target.likedBy] : [];
            const idx = list.indexOf(actorId);
            if (idx >= 0) {
              list.splice(idx, 1);
            } else {
              list.push(actorId);
            }
            target.likedBy = list;
            target.likes = list.length;
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'chat:pin') {
          const messageId = typeof msg.messageId === 'string' && msg.messageId ? msg.messageId : null;
          if (messageId && !room.chatMessages.some((m) => m.id === messageId)) return;
          room.pinnedChatId = room.pinnedChatId === messageId ? null : messageId;
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:delete') {
          const messageId = String(msg.messageId || '');
          if (!messageId) return;
          room.chatMessages = room.chatMessages.filter((m) => m.id !== messageId);
          if (room.pinnedChatId === messageId) room.pinnedChatId = null;
          if (room.overlays.featuredChatId === messageId) room.overlays.featuredChatId = null;
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:block_user') {
          const author = String(msg.author || '').trim().slice(0, 40);
          const uid = typeof msg.uid === 'string' && msg.uid.trim() ? msg.uid.trim().slice(0, 128) : undefined;
          if (!author && !uid) return;
          const existing = room.blockedUsers || [];
          const already = existing.some(
            (b) => (uid && b.uid === uid) || (author && b.author.toLowerCase() === author.toLowerCase())
          );
          if (!already) {
            room.blockedUsers = [
              ...existing,
              {
                id: `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
                author: author || 'User',
                uid,
                blockedAt: Date.now(),
              },
            ].slice(-50);
          }
          const purgedIds = new Set(
            room.chatMessages
              .filter(
                (m) =>
                  (uid && m.authorUid === uid) ||
                  (author && m.author.toLowerCase() === author.toLowerCase())
              )
              .map((m) => m.id)
          );
          room.chatMessages = room.chatMessages.filter((m) => !purgedIds.has(m.id));
          if (room.pinnedChatId && purgedIds.has(room.pinnedChatId)) room.pinnedChatId = null;
          if (room.overlays.featuredChatId && purgedIds.has(room.overlays.featuredChatId)) {
            room.overlays.featuredChatId = null;
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'chat:unblock_user') {
          const blockId = String(msg.blockId || '');
          room.blockedUsers = (room.blockedUsers || []).filter((b) => b.id !== blockId);
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'scene:save_preset') {
          const rawPreset = msg.preset as Record<string, unknown> | undefined;
          if (!rawPreset || typeof rawPreset.id !== 'string' || typeof rawPreset.name !== 'string') return;
          const cleanName = rawPreset.name.trim().slice(0, 36);
          if (!cleanName) return;
          const preset = {
            ...rawPreset,
            id: rawPreset.id.slice(0, 80),
            name: cleanName,
            aspect: rawPreset.aspect === '9:16' ? ('9:16' as const) : ('16:9' as const),
            elements: Array.isArray(rawPreset.elements) ? rawPreset.elements.slice(0, 12) : [],
          };
          const prev = room.scene.savedPresets || [];
          const next = [preset, ...prev.filter((p) => p.id !== preset.id)].slice(0, 16);
          room.scene.savedPresets = next;
          room.scene.templateId = preset.id;
          room.scene.customElements = preset.elements;
          room.aspectRatio = preset.aspect;
          if (typeof rawPreset.backdrop === 'string') {
            room.brand.backdrop = rawPreset.backdrop;
          }
          if (typeof rawPreset.bannerTitle === 'string') {
            room.overlays.banner = {
              visible: Boolean(rawPreset.bannerVisible),
              title: String(rawPreset.bannerTitle).slice(0, 80),
              subtitle: String(rawPreset.bannerSubtitle || '').slice(0, 120),
              style: String(rawPreset.bannerStyle || 'glass'),
            };
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'scene:apply_preset') {
          const presetId = String(msg.presetId || '');
          const preset = (room.scene.savedPresets || []).find((p) => p.id === presetId);
          if (!preset) return;
          room.scene.templateId = String(preset.id);
          room.scene.customElements = Array.isArray(preset.elements) ? preset.elements : [];
          if (preset.aspect === '9:16' || preset.aspect === '16:9') {
            room.aspectRatio = preset.aspect;
          }
          if (typeof preset.backdrop === 'string') {
            room.brand.backdrop = preset.backdrop;
          }
          if (typeof preset.bannerTitle === 'string') {
            room.overlays.banner = {
              visible: Boolean(preset.bannerVisible),
              title: String(preset.bannerTitle).slice(0, 80),
              subtitle: String(preset.bannerSubtitle || '').slice(0, 120),
              style: String(preset.bannerStyle || 'glass'),
            };
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'scene:delete_preset') {
          const presetId = String(msg.presetId || '');
          room.scene.savedPresets = (room.scene.savedPresets || []).filter((p) => p.id !== presetId);
          if (room.scene.templateId === presetId) {
            room.scene.templateId = room.aspectRatio === '9:16' ? 'v-solo' : 'solo';
            room.scene.customElements = [];
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'superchat:send') {
          const amount = Math.max(1, Math.min(500, Math.round(Number(msg.amount || 5))));
          const rawMethod = String(msg.method || 'card');
          const method: 'card' | 'paypal' | 'venmo' | 'cashapp' | 'stripe' =
            rawMethod === 'card' ||
            rawMethod === 'venmo' ||
            rawMethod === 'cashapp' ||
            rawMethod === 'stripe'
              ? rawMethod
              : 'paypal';
          const tier: 'blue' | 'emerald' | 'amber' | 'rose' =
            amount >= 50 ? 'rose' : amount >= 25 ? 'amber' : amount >= 10 ? 'emerald' : 'blue';
          const text = String(msg.text || '').trim().slice(0, 280) || `Sent a $${amount} Direct Tip!`;
          const author = String(msg.author || 'Viewer').trim().slice(0, 40) || 'Viewer';
          const avatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl.slice(0, 500) : undefined;
          const scMsg = {
            id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            author,
            avatarUrl,
            role: 'superchat' as const,
            source: 'watch' as const,
            text,
            timestamp: Date.now(),
            likes: 0,
            likedBy: [],
            superChat: { amount, method, tier },
          };
          room.chatMessages = [...room.chatMessages.slice(-99), scMsg];
          room.gamer.hypeCount += Math.max(1, Math.floor(amount / 5));
          advanceHypeTrain(room, Math.max(15, amount * 2), author, `$${amount} Super Chat`);
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'qa:ask') {
          const text = String(msg.text || '').trim().slice(0, 220);
          const author = String(msg.author || 'Viewer').trim().slice(0, 40) || 'Viewer';
          if (text) {
            room.questions = [
              {
                id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                author,
                text,
                upvotes: 1,
                answered: false,
                createdAt: Date.now(),
              },
              ...(room.questions || []).slice(0, 29),
            ];
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'qa:upvote') {
          const questionId = String(msg.questionId || '');
          const q = (room.questions || []).find((item) => item.id === questionId);
          if (q) {
            q.upvotes += 1;
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'qa:answer') {
          const questionId = String(msg.questionId || '');
          const q = (room.questions || []).find((item) => item.id === questionId);
          if (q) {
            q.answered = !q.answered;
            if (q.answered && room.overlays.featuredQuestionId === questionId) {
              room.overlays.featuredQuestionId = null;
            }
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'commerce:pin') {
          room.commerce.pinnedProductId = typeof msg.productId === 'string' ? msg.productId : null;
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'commerce:flash_start') {
          const productId = String(msg.productId || room.commerce.products[0]?.id || '');
          const prod = room.commerce.products.find((p) => p.id === productId);
          if (!prod) return;
          const discountPct = Math.max(5, Math.min(75, Math.round(Number(msg.discountPct || 20))));
          const totalUnits = Math.max(2, Math.min(200, Math.round(Number(msg.totalUnits || Math.max(5, prod.stock)))));
          const durationMin = Math.max(1, Math.min(60, Math.round(Number(msg.durationMin || 5))));
          const tagline =
            String(msg.tagline || 'LIVE TV FLASH SALE · VOLUME BUNDLE DISCOUNTS')
              .trim()
              .slice(0, 64) || 'LIVE TV FLASH SALE';
          const comm = room.commerce as ServerRoomState['commerce'] & {
            activeFlashSale?: ServerFlashSale | null;
          };
          comm.activeFlashSale = {
            id: `flash-${Date.now().toString(36)}`,
            productId: prod.id,
            discountPct,
            totalUnits,
            soldUnits: 0,
            startedAt: Date.now(),
            endsAt: Date.now() + durationMin * 60 * 1000,
            tagline,
            bundles: buildFlashBundles(discountPct),
            active: true,
          };
          room.commerce.pinnedProductId = prod.id;
          room.watchMode = 'shop';
          room.chatMessages = [
            ...room.chatMessages.slice(-99),
            {
              id: `msg-flash-${Date.now()}`,
              author: 'Flash Drop',
              role: 'system',
              source: 'studio',
              text: `⚡ FLASH SALE LIVE: ${prod.title} — Up to ${Math.min(75, discountPct + 18)}% OFF volume bundles · Strictly ${totalUnits} units for ${durationMin}m!`,
              timestamp: Date.now(),
            },
          ];
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'commerce:flash_stop') {
          const comm = room.commerce as ServerRoomState['commerce'] & {
            activeFlashSale?: ServerFlashSale | null;
          };
          if (comm.activeFlashSale) {
            comm.activeFlashSale.active = false;
            comm.activeFlashSale = null;
          }
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'commerce:order') {
          const comm = room.commerce as ServerRoomState['commerce'] & {
            activeFlashSale?: ServerFlashSale | null;
            latestSalePopup?: Record<string, unknown> | null;
          };
          const buyerName = String(msg.buyerName || 'Watch Viewer').trim().slice(0, 40) || 'Watch Viewer';
          const buyerCity = String(msg.buyerCity || 'Austin, TX').trim().slice(0, 40) || 'Austin, TX';
          const paymentMethod = String(msg.paymentMethod || 'Express Pay').trim().slice(0, 30);
          const rawItems = Array.isArray(msg.items)
            ? (msg.items as Array<Record<string, unknown>>)
            : [
                {
                  productId: msg.productId,
                  quantity: msg.quantity,
                  variant: msg.variant,
                  bundleLabel: msg.bundleLabel,
                },
              ];

          let grandTotal = 0;
          let totalSavings = 0;
          let totalUnitsBought = 0;
          let primaryTitle = '';
          let primaryImage = '';
          let primarySource: 'shopify' | 'etsy' | 'custom' = 'shopify';
          let primaryRemaining = 0;
          let appliedBundleLabel = '';
          const orderNumber = `GTH-${Math.floor(1000 + Math.random() * 9000)}`;

          for (const rawItem of rawItems) {
            const productId = String(rawItem.productId || '');
            const qty = Math.max(1, Math.min(10, Math.round(Number(rawItem.quantity || 1))));
            const variant = typeof rawItem.variant === 'string' ? rawItem.variant.slice(0, 40) : undefined;
            const prod = room.commerce.products.find((p) => p.id === productId);
            if (!prod || prod.stock < 1) continue;

            const actualQty = Math.min(qty, prod.stock);
            prod.stock -= actualQty;

            let unitPrice = prod.price;
            let itemBundleLabel =
              typeof rawItem.bundleLabel === 'string' ? rawItem.bundleLabel.slice(0, 40) : '';
            const flash = comm.activeFlashSale;
            if (
              flash &&
              flash.active &&
              flash.productId === prod.id &&
              flash.endsAt > Date.now() &&
              flash.soldUnits < flash.totalUnits
            ) {
              const matchedTier =
                [...flash.bundles]
                  .sort((a, b) => b.quantity - a.quantity)
                  .find((b) => actualQty >= b.quantity) || flash.bundles[0];
              const pct = matchedTier ? matchedTier.discountPct : flash.discountPct;
              unitPrice = Number((prod.price * (1 - pct / 100)).toFixed(2));
              if (!itemBundleLabel && matchedTier) {
                itemBundleLabel = matchedTier.label;
              }
              flash.soldUnits = Math.min(flash.totalUnits, flash.soldUnits + actualQty);
              if (flash.soldUnits >= flash.totalUnits) {
                flash.active = false;
              }
            }

            const lineTotal = Number((unitPrice * actualQty).toFixed(2));
            const lineSavings = Math.max(0, Number((prod.price * actualQty - lineTotal).toFixed(2)));
            grandTotal = Number((grandTotal + lineTotal).toFixed(2));
            totalSavings = Number((totalSavings + lineSavings).toFixed(2));
            totalUnitsBought += actualQty;

            if (!primaryTitle) {
              primaryTitle = prod.title;
              primaryImage = prod.imageUrl;
              primarySource = prod.source;
              primaryRemaining =
                flash && flash.productId === prod.id
                  ? Math.max(0, flash.totalUnits - flash.soldUnits)
                  : prod.stock;
              appliedBundleLabel = itemBundleLabel;
            }

            const orderRec = {
              id: `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
              orderNumber,
              productId: prod.id,
              productTitle: prod.title,
              variant,
              quantity: actualQty,
              bundleLabel: itemBundleLabel || undefined,
              total: lineTotal,
              buyerName,
              buyerCity,
              paymentMethod,
              source: prod.source,
              createdAt: Date.now(),
            };
            room.commerce.recentOrders = [orderRec, ...room.commerce.recentOrders.slice(0, 24)];
          }

          if (totalUnitsBought > 0) {
            const summaryTitle =
              rawItems.length > 1
                ? `${primaryTitle} + ${rawItems.length - 1} more`
                : primaryTitle;
            comm.latestSalePopup = {
              id: `popup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              orderNumber,
              buyerName,
              buyerCity,
              productTitle: summaryTitle,
              productImageUrl: primaryImage,
              source: primarySource,
              quantity: totalUnitsBought,
              bundleLabel: appliedBundleLabel || undefined,
              total: grandTotal,
              savingsAmount: totalSavings > 0 ? totalSavings : undefined,
              remainingStock: primaryRemaining,
              paymentMethod,
              createdAt: Date.now(),
            };

            advanceHypeTrain(room, Math.max(20, Math.round(grandTotal / 2)), buyerName, `Order ${orderNumber}`);

            room.chatMessages = [
              ...room.chatMessages.slice(-99),
              {
                id: `msg-ord-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                author: buyerName,
                role: 'order',
                source: 'watch',
                text: `Ordered ${totalUnitsBought}× ${summaryTitle}${appliedBundleLabel ? ` (${appliedBundleLabel})` : ''} from ${buyerCity} · $${grandTotal.toFixed(2)}${totalSavings > 0 ? ` (Saved $${totalSavings.toFixed(2)})` : ''}`,
                timestamp: Date.now(),
              },
            ];
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'stage:raise_hand') {
          const handName = String(msg.name || 'Viewer').trim().slice(0, 40) || 'Viewer';
          const topic =
            String(msg.topic || 'Wants to join the live conversation')
              .trim()
              .slice(0, 100) || 'Wants to join stage';
          const uid = typeof msg.uid === 'string' ? msg.uid.slice(0, 128) : undefined;
          const avatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl.slice(0, 500) : undefined;
          const existingIdx = room.handRaiseQueue.findIndex(
            (h) => (uid && h.uid === uid) || h.id === joinedClientId
          );
          if (existingIdx === -1 && room.handRaiseQueue.length < 20) {
            room.handRaiseQueue.push({
              id: joinedClientId,
              uid,
              name: handName,
              initials: getInitials(handName),
              avatarUrl,
              topic,
              raisedAt: Date.now(),
            });
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'stage:lower_hand') {
          const targetId = String(msg.handId || joinedClientId);
          room.handRaiseQueue = room.handRaiseQueue.filter(
            (h) => h.id !== targetId && h.uid !== targetId
          );
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'stage:promote_hand') {
          const handId = String(msg.handId || '');
          const idx = room.handRaiseQueue.findIndex((h) => h.id === handId);
          if (idx !== -1 && room.participants.length < 6) {
            const [hand] = room.handRaiseQueue.splice(idx, 1);
            if (!room.participants.some((p) => p.id === hand.id)) {
              room.participants.push({
                id: hand.id,
                name: hand.name,
                initials: hand.initials,
                avatarUrl: hand.avatarUrl,
                role: 'guest',
                onStage: true,
                micOn: true,
                camOn: false,
                sharingScreen: false,
                joinedAt: Date.now(),
              });
            }
            sendToClient(joinedRoomCode, hand.id, { type: 'stage:promoted', roomCode: joinedRoomCode });
            room.chatMessages = [
              ...room.chatMessages.slice(-99),
              {
                id: `msg-hand-${Date.now()}`,
                author: 'Stage Call-In',
                role: 'system',
                source: 'studio',
                text: `${hand.name} was invited onto the live broadcast stage!`,
                timestamp: Date.now(),
              },
            ];
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'gamer:poll_launch') {
          const question = String(msg.question || '').trim().slice(0, 140);
          const rawOptions = Array.isArray(msg.options) ? msg.options : [];
          const options = rawOptions
            .map((label, idx) => ({
              id: `opt-${idx}-${Date.now().toString(36)}`,
              label: String(label).trim().slice(0, 60),
              votes: 0,
            }))
            .filter((o) => o.label.length > 0)
            .slice(0, 4);
          if (question && options.length >= 2) {
            room.gamer.activePoll = {
              id: `poll-${Date.now().toString(36)}`,
              question,
              options,
              isOpen: true,
              showOnStage: msg.showOnStage !== false,
              createdAt: Date.now(),
            };
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'gamer:poll_vote') {
          const optionId = String(msg.optionId || '');
          const poll = room.gamer.activePoll;
          if (poll && poll.isOpen) {
            const opt = poll.options.find((o) => o.id === optionId);
            if (opt) {
              opt.votes += 1;
              broadcastRoomState(joinedRoomCode);
            }
          }
          return;
        }

        if (type === 'gamer:poll_close') {
          if (room.gamer.activePoll) {
            room.gamer.activePoll.isOpen = false;
            if (msg.clear) room.gamer.activePoll = null;
            broadcastRoomState(joinedRoomCode);
          }
          return;
        }

        if (type === 'gamer:clip') {
          const label = String(msg.label || 'Highlight Moment').slice(0, 80);
          const timestampSec = Math.max(0, Number(msg.timestampSec || 0));
          const createdBy = String(msg.createdBy || 'Viewer').slice(0, 40);
          room.gamer.clips = [
            {
              id: `clip-${Date.now().toString(36)}`,
              label,
              timestampSec,
              createdBy,
              createdAt: Date.now(),
            },
            ...room.gamer.clips.slice(0, 24),
          ];
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'gamer:queue_join') {
          const handle = String(msg.handle || '').trim().slice(0, 40);
          const platform = String(msg.platform || 'PC / Crossplay').slice(0, 30);
          const role = typeof msg.role === 'string' && msg.role.trim() ? msg.role.trim().slice(0, 24) : undefined;
          const rank = typeof msg.rank === 'string' && msg.rank.trim() ? msg.rank.trim().slice(0, 24) : undefined;
          const note = typeof msg.note === 'string' ? msg.note.slice(0, 80) : undefined;
          if (handle) {
            const exists = room.squadQueue.some((q) => q.handle.toLowerCase() === handle.toLowerCase());
            if (!exists) {
              room.squadQueue.push({
                id: `sq-${Date.now().toString(36)}`,
                handle,
                platform,
                role,
                rank,
                note,
                joinedAt: Date.now(),
              });
              broadcastRoomState(joinedRoomCode);
            }
          }
          return;
        }

        if (type === 'gamer:queue_remove') {
          const queueId = String(msg.queueId || '');
          room.squadQueue = room.squadQueue.filter((q) => q.id !== queueId);
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'gamer:hype') {
          room.gamer.hypeCount += 1;
          advanceHypeTrain(room, 6, String(msg.author || 'Viewer').slice(0, 30), 'Hype Combo');
          broadcastRoomState(joinedRoomCode);
          return;
        }

        if (type === 'webrtc:signal') {
          const targetId = String(msg.targetId || '');
          if (targetId) {
            sendToClient(joinedRoomCode, targetId, {
              type: 'webrtc:signal',
              fromId: joinedClientId,
              signal: msg.signal,
            });
          } else {
            // Broadcast stream offer request to studio host
            sendToClient(joinedRoomCode, room.hostId, {
              type: 'webrtc:viewer_request',
              fromId: joinedClientId,
            });
          }
          return;
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      if (!joinedRoomCode || !joinedClientId) return;
      const clients = roomSockets.get(joinedRoomCode);
      if (clients) {
        clients.delete(joinedClientId);
      }
      const room = rooms.get(joinedRoomCode);
      if (room) {
        room.participants = room.participants.filter((p) => p.id !== joinedClientId);
        room.lobby = room.lobby.filter((l) => l.id !== joinedClientId);
        broadcastRoomState(joinedRoomCode);
      }
    });
  });

  // --- REST API Routes ---

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false });
      return;
    }
    res.json({
      exists: true,
      title: room.title,
      isLocked: room.isLocked,
      isLive: room.isLive,
      watchMode: room.watchMode,
      participantCount: room.participants.length,
      viewerCount: room.viewerCount,
    });
  });

  // Shopify Public Storefront /products.json Importer
  app.post('/api/commerce/shopify-import', async (req, res) => {
    try {
      let rawUrl = String(req.body?.storeUrl || '').trim();
      if (!rawUrl) {
        res.status(400).json({ error: 'Please provide a Shopify store URL or domain.' });
        return;
      }
      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = `https://${rawUrl}`;
      }
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        res.status(400).json({ error: 'Invalid store URL protocol.' });
        return;
      }

      const endpoint = `${parsed.origin}/products.json?limit=12`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const upstream = await fetch(endpoint, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'gather-studio-commerce' },
      });
      clearTimeout(timer);

      if (!upstream.ok) {
        res.status(502).json({
          error: `Storefront responded with status ${upstream.status}. Ensure the store exposes public /products.json.`,
        });
        return;
      }

      const json = (await upstream.json()) as {
        products?: Array<{
          id: number | string;
          title: string;
          handle: string;
          body_html?: string;
          variants?: Array<{ title?: string; price?: string; available?: boolean }>;
          images?: Array<{ src?: string }>;
        }>;
      };

      const items = (json.products || []).slice(0, 12).map((p) => {
        const firstPrice = Number(p.variants?.[0]?.price || 0);
        const variants = (p.variants || [])
          .map((v) => v.title || 'Default')
          .filter((v) => v !== 'Default Title')
          .slice(0, 5);
        const cleanDesc = (p.body_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
        return {
          id: `shop-${p.id}`,
          source: 'shopify' as const,
          title: p.title,
          price: Number.isFinite(firstPrice) && firstPrice > 0 ? firstPrice : 29,
          currency: 'USD',
          imageUrl: p.images?.[0]?.src || '/src/assets/images/product_ceramic_mug_1794839256911.jpg',
          url: `${parsed.origin}/products/${p.handle}`,
          stock: p.variants?.some((v) => v.available === false) ? 3 : 12,
          variants: variants.length > 0 ? variants : ['Standard'],
          description: cleanDesc || undefined,
        };
      });

      res.json({ storeOrigin: parsed.origin, products: items });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach Shopify store.';
      res.status(500).json({ error: message });
    }
  });

  // Gemini AI Producer Endpoint (Function Calling + On-Air Research)
  app.post('/api/ai/producer', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets. Please add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    try {
      const prompt = String(req.body?.prompt || '').trim();
      const context = (req.body?.context as Record<string, unknown>) || {};
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required.' });
        return;
      }

      const tools: FunctionDeclaration[] = [
        {
          name: 'switch_scene',
          description: 'Switch the broadcast stage scene layout.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              templateId: {
                type: Type.STRING,
                description: 'One of: solo, duo, spotlight, grid4, grid6, screen-cam, slides-cam, pip, full-media, v-solo, v-duo, v-screen, v-slides',
              },
            },
            required: ['templateId'],
          },
        },
        {
          name: 'show_banner',
          description: 'Show a lower-third headline and subtitle banner on the broadcast stage.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Short punchy lower-third headline (max 45 chars).' },
              subtitle: { type: Type.STRING, description: 'Supporting subline (max 70 chars).' },
            },
            required: ['title'],
          },
        },
        {
          name: 'hide_banner',
          description: 'Hide the current lower-third banner from the stage.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              confirm: { type: Type.BOOLEAN },
            },
          },
        },
        {
          name: 'set_ticker',
          description: 'Show or update the scrolling ticker along the bottom of the stage.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              visible: { type: Type.BOOLEAN },
              text: { type: Type.STRING, description: 'Concise ticker copy.' },
            },
            required: ['visible'],
          },
        },
        {
          name: 'toggle_captions',
          description: 'Enable or disable live stage captions.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              enabled: { type: Type.BOOLEAN },
            },
            required: ['enabled'],
          },
        },
        {
          name: 'pin_product',
          description: 'Pin a product from the live commerce catalog onto the broadcast stage and Watch Page.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING, description: 'ID of the product to pin, matching one from context.products.' },
            },
            required: ['productId'],
          },
        },
        {
          name: 'unpin_product',
          description: 'Remove the currently pinned product overlay from the stage.',
          parameters: {
            type: Type.OBJECT,
            properties: { confirm: { type: Type.BOOLEAN } },
          },
        },
        {
          name: 'launch_poll',
          description: 'Launch a live interactive poll for Watch Page viewers.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: 'Poll question for viewers.' },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 short poll options.',
              },
            },
            required: ['question', 'options'],
          },
        },
        {
          name: 'trigger_sound',
          description: 'Play a soundboard stinger cue into the studio mix.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              pad: {
                type: Type.STRING,
                description: 'One of: intro, order, applause, whoosh, hype, drumroll, alert',
              },
            },
            required: ['pad'],
          },
        },
        {
          name: 'next_rundown_step',
          description: 'Advance the show rundown to the next scheduled segment cue.',
          parameters: {
            type: Type.OBJECT,
            properties: { confirm: { type: Type.BOOLEAN } },
          },
        },
        {
          name: 'start_countdown',
          description: 'Start or clear an on-stage broadcast countdown timer.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              minutes: { type: Type.NUMBER, description: 'Minutes for countdown (0 to clear).' },
              label: { type: Type.STRING, description: 'Short timer label e.g. Starting Soon, Drop Ends.' },
            },
            required: ['minutes'],
          },
        },
      ];

      const systemInstruction = `You are the live AI Showrunner & Researcher inside "gather", a browser broadcast studio.
Keep spoken/text responses crisp, broadcast-ready, and concise (1-3 sentences unless asked for deeper research).
Whenever the user asks to change layout/scenes, show/hide banners, update ticker, toggle captions, pin/unpin a product, launch a viewer poll, play a sound cue, start a countdown timer, or advance the rundown, call the corresponding tool(s) immediately using the live studio context provided.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Live Studio Context:\n${JSON.stringify(context)}\n\nHost / Producer Request:\n${prompt}`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ functionDeclarations: tools }],
        },
      });

      const actions = (response.functionCalls || []).map((fc) => ({
        name: fc.name || '',
        args: (fc.args as Record<string, unknown>) || {},
      }));

      let replyText = (response.text || '').trim();
      if (!replyText && actions.length > 0) {
        replyText = `Executed ${actions.map((a) => a.name.replace(/_/g, ' ')).join(', ')}.`;
      }

      res.json({ text: replyText, actions });
    } catch (err) {
      console.error('Gemini AI Producer error:', err);
      const message = err instanceof Error ? err.message : 'AI Producer request failed.';
      res.status(500).json({ error: message });
    }
  });

  // Gemini Post-Show Notes & Chapters Generator
  app.post('/api/ai/summary', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const studioData = req.body || {};
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate clean, publish-ready Show Notes, Key Takeaways, YouTube Chapter Timestamps (starting from 00:00), and Featured Products/Clips summary in Markdown from this live session:\n${JSON.stringify(studioData)}`,
        config: {
          systemInstruction:
            'You are a broadcast show notes editor. Output structured Markdown with crisp headings: Overview, Chapter Timestamps, Key Highlights, and Featured Links/Products.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({ markdown: (response.text || '').trim() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate show notes.';
      res.status(500).json({ error: message });
    }
  });

  // Gemini AI PDF Slide Deck Analyzer -> Per-Slide Teleprompter Cues & Banners
  app.post('/api/ai/pdf-analyze', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const deckName = String(req.body?.deckName || 'Presentation').slice(0, 100);
      const rawSlides = Array.isArray(req.body?.slideTexts) ? (req.body.slideTexts as unknown[]) : [];
      const slideTexts = rawSlides.slice(0, 20).map((s, idx) => ({
        pageNumber: idx + 1,
        text: String(s || `Slide ${idx + 1}`).slice(0, 1200),
      }));

      if (slideTexts.length === 0) {
        res.status(400).json({ error: 'No slide text provided for analysis.' });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze this broadcast slide deck ("${deckName}") and produce concise speaker talking points, a natural conversational teleprompter script, a lower-third banner, and an optional audience poll question for each slide:\n${JSON.stringify(slideTexts)}`,
        config: {
          systemInstruction:
            'You are an executive broadcast producer. For each slide in the deck, craft punchy, high-clarity live delivery notes optimized for an eye-line teleprompter.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                slideTitle: { type: Type.STRING },
                talkingPoints: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                teleprompterScript: { type: Type.STRING },
                suggestedBannerTitle: { type: Type.STRING },
                suggestedBannerSub: { type: Type.STRING },
                suggestedPollQuestion: { type: Type.STRING },
              },
              required: [
                'pageNumber',
                'slideTitle',
                'talkingPoints',
                'teleprompterScript',
                'suggestedBannerTitle',
                'suggestedBannerSub',
              ],
            },
          },
        },
      });

      const cues = JSON.parse((response.text || '[]').trim());
      res.json({ cues });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF slide analysis failed.';
      res.status(500).json({ error: message });
    }
  });

  // Gemini AI Magic Clips & Video Highlight Detector
  app.post('/api/ai/magic-clips', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const payload = req.body || {};
      const durationSec = Math.max(30, Number(payload.durationSec || 180));
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Identify 3 high-retention viral Magic Clips (each 15-45 seconds long within total duration ${durationSec}s) from this broadcast/video session:\n${JSON.stringify(payload)}`,
        config: {
          systemInstruction:
            'You are a short-form broadcast video editor (Riverside / Opus style). Return 3 distinct viral clip moments with scroll-stopping hook captions, exact start/end timestamps within the session duration, recommended aspect ratio (9:16 or 16:9), and why each clip converts.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                hookCaption: { type: Type.STRING },
                startSec: { type: Type.INTEGER },
                endSec: { type: Type.INTEGER },
                aspect: { type: Type.STRING },
                viralityReason: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: [
                'id',
                'title',
                'hookCaption',
                'startSec',
                'endSec',
                'aspect',
                'viralityReason',
                'category',
              ],
            },
          },
        },
      });

      const clips = JSON.parse((response.text || '[]').trim());
      res.json({ clips });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Magic Clips detection failed.';
      res.status(500).json({ error: message });
    }
  });

  // Gemini AI Broadcast Stage Graphic, Backdrop & Podcast Cover Designer
  app.post('/api/ai/stage-graphic', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
      return;
    }

    try {
      const prompt = String(req.body?.prompt || 'Modern optical glass broadcast studio').slice(0, 300);
      const mode = String(req.body?.mode || 'backdrop');
      const studioTitle = String(req.body?.studioTitle || 'Gather Live').slice(0, 80);

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Design a cohesive broadcast art specification (${mode}) for show "${studioTitle}" matching creative direction: "${prompt}"`,
        config: {
          systemInstruction:
            'You are a broadcast motion-graphics art director. Output crisp hex colors (#RRGGBB), pattern choice (aurora, grid, rings, or prism), headline, subtitle, and badge text with high WCAG contrast.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              themeName: { type: Type.STRING },
              primaryHex: { type: Type.STRING },
              secondaryHex: { type: Type.STRING },
              tertiaryHex: { type: Type.STRING },
              surfaceHex: { type: Type.STRING },
              pattern: { type: Type.STRING },
              badgeText: { type: Type.STRING },
            },
            required: [
              'headline',
              'subtitle',
              'themeName',
              'primaryHex',
              'secondaryHex',
              'tertiaryHex',
              'surfaceHex',
              'pattern',
              'badgeText',
            ],
          },
        },
      });

      const spec = JSON.parse((response.text || '{}').trim());
      res.json({ spec });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI Stage Graphic design failed.';
      res.status(500).json({ error: message });
    }
  });

  // --- Hosted Podcast RSS 2.0 Syndication & Audio Endpoints ---
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  app.get('/api/podcast/audio/:fileName', (req, res) => {
    const raw = String(req.params.fileName || '').replace(/\.(wav|webm|mp3)$/i, '');
    const audio = podcastAudioBuffers.get(raw);
    if (!audio) {
      res.status(404).send('Audio episode not found');
      return;
    }
    res.setHeader('Content-Type', audio.mimeType);
    res.setHeader('Content-Length', String(audio.buffer.byteLength));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(audio.buffer);
  });

  app.get('/api/podcast/:slug/rss.xml', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const origin = `${proto}://${req.get('host')}`;
    const show = ensurePodcastShow(String(req.params.slug || 'gather-live'), origin);
    const feedUrl = `${origin}/api/podcast/${show.slug}/rss.xml`;
    const coverUrl = show.coverArtUrl.startsWith('http')
      ? show.coverArtUrl
      : `${origin}${show.coverArtUrl.startsWith('/') ? '' : '/'}${show.coverArtUrl}`;

    const itemsXml = show.episodes
      .map((ep, idx) => {
        const epUrl = ep.audioUrl.startsWith('http')
          ? ep.audioUrl
          : `${origin}${ep.audioUrl.startsWith('/') ? '' : '/'}${ep.audioUrl}`;
        const chapterNotes =
          ep.chapters && ep.chapters.length > 0
            ? `\n\nChapters:\n${ep.chapters.join('\n')}`
            : '';
        return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.summary + chapterNotes)}</description>
      <pubDate>${escapeXml(ep.publishedAt)}</pubDate>
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <enclosure url="${escapeXml(epUrl)}" length="${ep.fileSizeBytes}" type="${escapeXml(ep.audioFormat)}" />
      <itunes:duration>${Math.max(1, Math.round(ep.durationSec))}</itunes:duration>
      <itunes:episode>${ep.episodeNumber ?? show.episodes.length - idx}</itunes:episode>
      <itunes:season>${ep.seasonNumber ?? 1}</itunes:season>
      <itunes:explicit>false</itunes:explicit>
    </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(show.title)}</title>
    <link>${escapeXml(origin)}</link>
    <language>${escapeXml(show.language)}</language>
    <copyright>&#169; ${new Date().getFullYear()} ${escapeXml(show.author)}</copyright>
    <itunes:author>${escapeXml(show.author)}</itunes:author>
    <description>${escapeXml(show.description)}</description>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>${escapeXml(show.author)}</itunes:name>
      <itunes:email>${escapeXml(show.email)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(coverUrl)}" />
    <itunes:category text="${escapeXml(show.category)}" />
    <itunes:explicit>false</itunes:explicit>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  });

  app.get('/api/podcast/:slug', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const origin = `${proto}://${req.get('host')}`;
    const show = ensurePodcastShow(String(req.params.slug || 'gather-live'), origin);
    res.json({
      show,
      rssUrl: `${origin}/api/podcast/${show.slug}/rss.xml`,
    });
  });

  app.post('/api/podcast/:slug/config', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const origin = `${proto}://${req.get('host')}`;
    const show = ensurePodcastShow(String(req.params.slug || 'gather-live'), origin);
    const body = (req.body as Record<string, unknown>) || {};
    if (typeof body.title === 'string' && body.title.trim()) show.title = body.title.trim().slice(0, 100);
    if (typeof body.author === 'string' && body.author.trim()) show.author = body.author.trim().slice(0, 80);
    if (typeof body.email === 'string' && body.email.trim()) show.email = body.email.trim().slice(0, 120);
    if (typeof body.description === 'string') show.description = body.description.trim().slice(0, 800);
    if (typeof body.category === 'string' && body.category.trim()) show.category = body.category.trim().slice(0, 60);
    if (typeof body.coverArtUrl === 'string' && body.coverArtUrl.trim()) {
      show.coverArtUrl = body.coverArtUrl.trim();
    }
    if (Array.isArray(body.directories)) {
      show.directories = body.directories as ServerPodcastShow['directories'];
    }
    res.json({
      show,
      rssUrl: `${origin}/api/podcast/${show.slug}/rss.xml`,
    });
  });

  app.post('/api/podcast/:slug/episodes', (req, res) => {
    try {
      const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
      const origin = `${proto}://${req.get('host')}`;
      const show = ensurePodcastShow(String(req.params.slug || 'gather-live'), origin);
      const body = (req.body as Record<string, unknown>) || {};
      const title = String(body.title || `Episode ${show.episodes.length + 1} · Live Broadcast`).trim().slice(0, 120);
      const summary =
        String(body.summary || 'Recorded live in Gather Studio and distributed via RSS.').trim().slice(0, 1500);
      const durationSec = Math.max(1, Math.round(Number(body.durationSec || 60)));
      const audioFormat: 'audio/wav' | 'audio/webm' =
        body.audioFormat === 'audio/webm' ? 'audio/webm' : 'audio/wav';
      const ext = audioFormat === 'audio/webm' ? 'webm' : 'wav';
      const epId = `ep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      let buffer: Buffer;
      if (typeof body.audioBase64 === 'string' && body.audioBase64.length > 20) {
        buffer = Buffer.from(body.audioBase64, 'base64');
      } else {
        buffer = createServerSilentOrChordWavBuffer(5);
      }

      podcastAudioBuffers.set(epId, { buffer, mimeType: audioFormat });
      const episode: ServerPodcastEpisode = {
        id: epId,
        title,
        summary,
        durationSec,
        publishedAt: new Date().toUTCString(),
        audioUrl: `${origin}/api/podcast/audio/${epId}.${ext}`,
        audioFormat,
        fileSizeBytes: buffer.byteLength,
        seasonNumber: 1,
        episodeNumber: show.episodes.length + 1,
        chapters: Array.isArray(body.chapters)
          ? (body.chapters as unknown[]).map((c) => String(c).slice(0, 100)).slice(0, 20)
          : undefined,
      };
      show.episodes = [episode, ...show.episodes.slice(0, 49)];
      res.json({
        episode,
        show,
        rssUrl: `${origin}/api/podcast/${show.slug}/rss.xml`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish podcast episode.';
      res.status(500).json({ error: message });
    }
  });

  // --- Upcoming Live Stream Email Notification Dispatch & Calendar Invite (.ics) ---
  app.post('/api/notifications/send-stream-alert', async (req, res) => {
    try {
      const body = (req.body as Record<string, unknown>) || {};
      const hostName = String(body.hostName || 'Gather Host').trim().slice(0, 60);
      const title = String(body.title || 'Upcoming Live Broadcast').trim().slice(0, 100);
      const scheduledIso = String(body.scheduledIso || new Date(Date.now() + 3600000).toISOString()).slice(0, 40);
      const roomCode = String(body.roomCode || 'LIVE01').slice(0, 20);
      const watchUrl = String(body.watchUrl || '').slice(0, 300);
      const rawSubs = Array.isArray(body.subscribers) ? (body.subscribers as Array<Record<string, unknown>>) : [];
      const validRecipients = rawSubs
        .map((s) => ({
          email: String(s.email || '').trim().toLowerCase(),
          name: String(s.name || 'Subscriber').trim().slice(0, 60),
        }))
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))
        .slice(0, 200);

      let deliveredViaProvider = false;
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey && validRecipients.length > 0) {
        const emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Gather Live <alerts@resend.dev>',
            to: validRecipients.map((r) => r.email),
            subject: `🔴 Live Alert: ${hostName} scheduled "${title}"`,
            html: `<p><strong>${escapeXml(hostName)}</strong> is going live on Gather:</p><h2>${escapeXml(title)}</h2><p>Starts: ${escapeXml(new Date(scheduledIso).toLocaleString())}</p><p><a href="${escapeXml(watchUrl)}">Join Watch Page (${escapeXml(roomCode)})</a></p>`,
          }),
        });
        deliveredViaProvider = emailResp.ok;
      }

      res.json({
        queuedCount: validRecipients.length,
        deliveredViaProvider,
        subject: `Live Alert: ${hostName} — "${title}"`,
        scheduledIso,
        recipientsPreview: validRecipients.slice(0, 5).map((r) => r.email),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to dispatch stream email alerts.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/notifications/calendar.ics', (req, res) => {
    const title = String(req.query.title || 'Gather Live Broadcast').slice(0, 100);
    const room = String(req.query.room || 'LIVE01').slice(0, 20);
    const iso = String(req.query.iso || new Date(Date.now() + 3600000).toISOString());
    const start = new Date(iso);
    const validStart = Number.isNaN(start.getTime()) ? new Date(Date.now() + 3600000) : start;
    const end = new Date(validStart.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const watchUrl = `${proto}://${req.get('host')}/?watch=${encodeURIComponent(room)}`;

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Gather Studio//Live Stream Reminder//EN',
      'BEGIN:VEVENT',
      `UID:gather-${room}-${validStart.getTime()}@gather.studio`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(validStart)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${title.replace(/[\r\n,]/g, ' ')}`,
      `DESCRIPTION:Watch live on Gather: ${watchUrl}`,
      `URL:${watchUrl}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gather-${room.toLowerCase()}.ics"`);
    res.send(ics);
  });

  // Vite or Static Hosting
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });

    // Vite 8 injects /@vite/client and invokes transport.connect() even when hmr/ws are false,
    // which causes an unhandled WebSocket rejection behind single-port reverse proxies.
    app.use('/@vite/client', (_req, res, next) => {
      const origEnd = res.end.bind(res);
      const chunks: Buffer[] = [];
      let intercepted = false;

      res.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
        intercepted = true;
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), (encoding as BufferEncoding) || 'utf8'));
        }
        if (typeof encoding === 'function') encoding();
        else if (typeof cb === 'function') cb();
        return true;
      }) as typeof res.write;

      res.end = ((chunk?: unknown, encoding?: unknown, cb?: unknown) => {
        if (!intercepted && !chunk) {
          return origEnd(chunk as never, encoding as never, cb as never);
        }
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), (encoding as BufferEncoding) || 'utf8'));
        }
        let body = Buffer.concat(chunks).toString('utf8');
        body = body.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          '/* HMR disabled */'
        );
        res.removeHeader('Content-Length');
        res.setHeader('Content-Type', 'application/javascript');
        return origEnd(
          body,
          'utf8',
          typeof encoding === 'function' ? (encoding as () => void) : (cb as (() => void) | undefined)
        );
      }) as typeof res.end;

      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`gather studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start gather server:', err);
  process.exit(1);
});
