import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ArrowUp, Mic, X } from 'lucide-react';
import { AiMediaPodcastDrawer, AiPodcastTab } from './components/AiMediaPodcastDrawer';
import { AudioMixerDrawer } from './components/AudioMixerDrawer';
import { AuthModal } from './components/AuthModal';
import { ComposerShareControl } from './components/ComposerShareControl';
import { GreenRoomModal } from './components/GreenRoomModal';
import { LandingView } from './components/LandingView';
import {
  CommandPaletteModal,
  GoLiveModal,
  HelpModal,
  InviteModal,
  RecordingModal,
  ScheduleModal,
  SettingsModal,
  ShowNotesModal,
} from './components/Modals';
import { ConsoleTab, RightConsole } from './components/RightConsole';
import { StageCanvas } from './components/StageCanvas';
import { StingerDeckDrawer } from './components/StingerDeckDrawer';
import { BottomDock, RightRail, SceneDeck } from './components/StudioDock';
import { TeleprompterOverlay } from './components/TeleprompterOverlay';
import { TopBar } from './components/TopBar';
import { WatchPageView } from './components/WatchPageView';
import {
  DEFAULT_DESTINATIONS,
  DEFAULT_GEAR_SPECS,
  DEFAULT_PRODUCTS,
  DEFAULT_RUNDOWN,
  DEFAULT_SPONSORS,
  DEFAULT_VIDEO_FX,
  SCENE_TEMPLATES,
} from './constants/studioDefaults';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { useStudioSocket } from './hooks/useStudioSocket';
import {
  AIProducerAction,
  AILogEntry,
  AudioChannelState,
  buildBoxesForTemplate,
  ChatReplyRef,
  CustomScenePreset,
  CustomStageElement,
  DestinationConfig,
  MediaAsset,
  PayoutSettings,
  RoomState,
  RundownStep,
  ScheduledShow,
  SlideAiCue,
  TransitionType,
  VideoFxSettings,
  WatchMode,
} from './types/studio';
import { audioEngine, SoundboardPadId } from './utils/audioEngine';
import { extractPdfDeck } from './utils/pdfLoader';

type AppViewMode = 'landing' | 'studio' | 'watch';

interface ToastItem {
  id: string;
  text: string;
}

function parseRoomCodeFromInput(raw: string): string {
  const trimmed = raw.trim();
  try {
    if (trimmed.includes('://') || trimmed.includes('?')) {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://gather.app/${trimmed}`);
      const code = u.searchParams.get('join') || u.searchParams.get('watch');
      if (code) return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    }
  } catch {
    // ignore URL parse error
  }
  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CAST01';
}

function sanitizeHostKey(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 56);
  return clean || 'GATHERLIVE';
}

function makeFallbackRoom(roomCode: string, watchMode: WatchMode = 'standard'): RoomState {
  const isGamer = watchMode === 'gamer';
  const isShop = watchMode === 'shop';
  return {
    roomCode,
    title: isGamer
      ? 'Ranked Squad Co-Stream'
      : isShop
      ? 'Studio Objects Live Drop'
      : 'Design Systems & Live Q&A',
    hostId: 'demo-host',
    isLocked: false,
    isLive: true,
    liveStartedAt: Date.now(),
    aspectRatio: '16:9',
    watchMode,
    viewerCount: 248,
    participants: [
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
    ],
    lobby: [],
    squadQueue: isGamer
      ? [
          {
            id: 'sq-demo-1',
            handle: 'Kuro#NA1',
            platform: 'PC · Discord',
            role: 'Sentinel / IGL',
            rank: 'Ascendant II',
            note: 'Controller / Sentinel',
            joinedAt: Date.now() - 120000,
          },
          {
            id: 'sq-demo-2',
            handle: 'NovaPulse',
            platform: 'PlayStation',
            role: 'Duelist',
            rank: 'Diamond III',
            note: 'Ready for next lobby',
            joinedAt: Date.now() - 45000,
          },
        ]
      : [],
    questions: [
      {
        id: 'q-demo-1',
        author: 'Elena V.',
        text: 'How are you routing multi-track browser audio without local OBS plugins?',
        upvotes: 14,
        answered: false,
        createdAt: Date.now() - 180000,
      },
      {
        id: 'q-demo-2',
        author: 'Marcus T.',
        text: 'Can guests join from mobile Safari and still share slides?',
        upvotes: 9,
        answered: false,
        createdAt: Date.now() - 95000,
      },
    ],
    handRaiseQueue: [
      {
        id: 'hand-demo-1',
        name: 'Sasha K.',
        initials: 'SK',
        topic: 'Question on zero-latency audio routing & podcast RSS',
        raisedAt: Date.now() - 75000,
      },
    ],
    hypeTrain: {
      active: true,
      level: 2,
      points: 145,
      goalPoints: 200,
      endsAt: Date.now() + 4 * 60 * 1000,
      lastContributor: 'Devon R.',
      lastReason: '$25 Super Chat',
    },
    upcomingStream: {
      title: 'Creator Commerce & Zero-Fee Audio Deep Dive',
      scheduledIso: '2026-11-20T18:00:00',
    },
    pinnedChatId: null,
    blockedUsers: [],
    scene: {
      templateId: 'duo',
      transitionType: 'dissolve',
      transitionMs: 320,
      customElements: [],
      savedPresets: [],
    },
    overlays: {
      banner: {
        visible: true,
        title: isGamer
          ? 'Ranked Squad Co-Stream'
          : isShop
          ? 'Studio Objects Live Drop'
          : 'Design Systems & Live Q&A',
        subtitle: isGamer
          ? 'Vote in the live prediction poll & join the squad queue'
          : isShop
          ? 'Shop Shopify & Etsy volume bundles right inside Gather'
          : 'Ask questions in Q&A & tip creators directly inside chat',
        style: 'editorial',
      },
      ticker: {
        visible: false,
        text: 'Welcome to gather. — 100% Free browser broadcast studio · 0% creator fees',
      },
      featuredChatId: null,
      featuredQuestionId: null,
      chatOverlayOnStage: false,
      showSupportQrOnStage: false,
      captionsEnabled: false,
      captionText: '',
      captionLang: 'en-US',
      captionStyle: 'glass',
    },
    brand: {
      accent: '#2f6bf0',
      backdrop: 'dusk',
      backdropDim: 35,
      font: 'Plus Jakarta Sans',
      frame: 'none',
      showNames: true,
      nameTagStyle: 'glass',
      logoPosition: 'tr',
      logoSize: 44,
      sponsorsEnabled: false,
      sponsorIntervalSec: 15,
      sponsors: DEFAULT_SPONSORS,
    },
    commerce: {
      storeLabel: 'Gather Studio Store · Shopify & Etsy Sync',
      products: DEFAULT_PRODUCTS,
      pinnedProductId: isShop ? DEFAULT_PRODUCTS[0].id : null,
      recentOrders: [],
      activeFlashSale: isShop
        ? {
            id: 'flash-demo-1',
            productId: DEFAULT_PRODUCTS[0].id,
            active: true,
            discountPct: 20,
            totalUnits: 15,
            soldUnits: 7,
            startedAt: Date.now() - 60000,
            endsAt: Date.now() + 9 * 60 * 1000,
            tagline: 'TV LIVE FLASH · VOLUME BUNDLES ACTIVE',
            bundles: [
              { id: 'b1', quantity: 1, label: '1× Single', discountPct: 20 },
              { id: 'b2', quantity: 2, label: '2× Duo Bundle', discountPct: 30, badge: 'Popular' },
              { id: 'b3', quantity: 3, label: '3× VIP Pack', discountPct: 38, badge: 'Best Value' },
            ],
          }
        : null,
      latestSalePopup: null,
      payouts: {
        enabled: true,
        paypalHandle: 'gatherstudio',
        venmoHandle: 'gather-live',
        cashappTag: 'GatherLive',
      },
    },
    gamer: {
      gameTitle: 'Valorant · Ranked Co-Stream',
      modeOrRank: 'Ascendant II · NA West',
      seriesScore: 'BO3 · 1–0',
      currentMap: 'Ascent',
      lobbyCode: `GTH-${roomCode}`,
      gearSpecs: DEFAULT_GEAR_SPECS,
      activePoll: {
        id: 'poll-demo',
        question: isGamer
          ? 'Next map challenge?'
          : 'Which topic should we deep-dive next?',
        options: isGamer
          ? [
              { id: 'o1', label: 'Ascent · Sheriff Only', votes: 18 },
              { id: 'o2', label: 'Bind · Rush A Site', votes: 11 },
            ]
          : [
              { id: 'o1', label: 'WebRTC Low-Latency Mixing', votes: 24 },
              { id: 'o2', label: 'Zero-Fee Creator Monetization', votes: 31 },
            ],
        isOpen: true,
        showOnStage: isGamer,
        createdAt: Date.now(),
      },
      clips: [
        {
          id: 'clip-demo-1',
          label: isGamer ? '4K Clutch on Ascent B' : 'Live Audio Bus Architecture Breakdown',
          timestampSec: 142,
          createdBy: 'Maya Chen',
          createdAt: Date.now() - 180000,
        },
      ],
      hypeCount: 128,
      slowModeSec: 0,
    },
    rundown: { steps: DEFAULT_RUNDOWN, activeStepId: DEFAULT_RUNDOWN[0].id },
    chatMessages: [
      {
        id: 'm1',
        author: 'Maya Chen',
        avatarUrl: '/src/assets/images/host_maya_studio_1794840297410.jpg',
        role: 'host',
        source: 'studio',
        text: isGamer
          ? 'Welcome in! Vote in the prediction poll or drop your tag for next lobby.'
          : isShop
          ? 'Welcome in! Flash volume bundles are live — check out right inside Express Bag.'
          : 'Welcome to the live broadcast! Drop questions in Q&A or click $ Support in chat.',
        timestamp: Date.now() - 90000,
        likes: 6,
        likedBy: ['v1', 'v2', 'v3'],
        reactions: { '❤️': ['v1', 'v2'], '🔥': ['v3'] },
      },
      {
        id: 'm2',
        author: 'Elena V.',
        role: 'viewer',
        source: 'watch',
        text: isGamer
          ? 'That mid lurk timing on Ascent was insane.'
          : isShop
          ? 'Does the cobalt ceramic mug ship internationally?'
          : 'Audio routing sounds super clean on AirPods.',
        timestamp: Date.now() - 62000,
        replyTo: {
          id: 'm1',
          author: 'Maya Chen',
          text: isGamer
            ? 'Welcome in! Vote in the prediction poll or drop your tag for next lobby.'
            : isShop
            ? 'Welcome in! Flash volume bundles are live — check out right inside Express Bag.'
            : 'Welcome to the live broadcast! Drop questions in Q&A or click $ Support in chat.',
        },
        likes: 3,
        likedBy: ['v2'],
      },
      {
        id: 'sc-demo-1',
        author: 'Devon R.',
        role: 'superchat',
        source: 'watch',
        text: isGamer
          ? 'Run Sheriff-only on Ascent! Huge clutch earlier.'
          : isShop
          ? 'Grabbed the 2× Duo Cobalt Mug bundle — love the live glaze demo!'
          : 'Thank you for making a zero-fee studio that keeps everything right in chat!',
        timestamp: Date.now() - 35000,
        likes: 9,
        likedBy: ['v1', 'v3'],
        superChat: {
          amount: 25,
          method: 'card',
          tier: 'amber',
        },
      },
    ],
  };
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('gather:theme');
      if (saved && JSON.parse(saved) === 'light') return 'light';
    } catch {
      // ignore
    }
    return 'dark';
  });

  const [viewMode, setViewMode] = useState<AppViewMode>('landing');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [clientRole, setClientRole] = useState<'host' | 'guest' | 'viewer'>('host');
  const [displayName, setDisplayName] = useState('Maya Chen');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [studioTitleInit, setStudioTitleInit] = useState('Gather Live Broadcast');
  const [studioFormatInit, setStudioFormatInit] = useState<WatchMode>('standard');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);

  const [greenRoomOpen, setGreenRoomOpen] = useState(false);
  const [greenRoomIsNew, setGreenRoomIsNew] = useState(true);
  const [pendingRoomCode, setPendingRoomCode] = useState('GTH101');

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [programStream, setProgramStream] = useState<MediaStream | null>(null);
  const [activeMedia, setActiveMedia] = useState<MediaAsset | null>(null);

  const [videoFx, setVideoFx] = useState<VideoFxSettings>(DEFAULT_VIDEO_FX);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [stingersOpen, setStingersOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('chat');
  const [panelOpen, setPanelOpen] = useState(true);
  const [cmdBarOpen, setCmdBarOpen] = useState(false);

  // Studio AI Media, Voice Teleprompter, Podcast RSS & 9:16 Safe-Zone states
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [teleprompterScript, setTeleprompterScript] = useState('');
  const [aiMediaOpen, setAiMediaOpen] = useState(false);
  const [aiMediaTab, setAiMediaTab] = useState<AiPodcastTab>('pdf');
  const [safeZone916, setSafeZone916] = useState(false);

  // Viewer Upcoming Stream Email Subscription states
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const [masterGain, setMasterGain] = useState(1.0);
  const [channels, setChannels] = useState<AudioChannelState[]>([
    {
      id: 'local-mic',
      label: 'Host Mic',
      gain: 1.0,
      muted: false,
      solo: false,
      monitor: false,
      clarityEq: true,
      level: 0,
    },
    {
      id: 'media-deck',
      label: 'Media / Video',
      gain: 0.85,
      muted: false,
      solo: false,
      monitor: true,
      clarityEq: false,
      level: 0,
    },
    {
      id: 'stinger-fx',
      label: 'Stingers & FX',
      gain: 1.0,
      muted: false,
      solo: false,
      monitor: true,
      clarityEq: false,
      level: 0,
    },
  ]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedFilename, setRecordedFilename] = useState('gather-recording.webm');
  const [recordingModalOpen, setRecordingModalOpen] = useState(false);

  const [cmdInput, setCmdInput] = useState('');
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiVoiceReadout, setAiVoiceReadout] = useState(false);
  const [showNotesOpen, setShowNotesOpen] = useState(false);
  const [showNotesLoading, setShowNotesLoading] = useState(false);
  const [showNotesMd, setShowNotesMd] = useState('');

  const [isWatchPreview, setIsWatchPreview] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [bagCount, setBagCount] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [savedPayouts, setSavedPayouts] = useState<PayoutSettings>({
    enabled: true,
    paypalHandle: 'gatherstudio',
    venmoHandle: 'gather-live',
    cashappTag: 'GatherLive',
  });

  const [scheduledShows, setScheduledShows] = useState<ScheduledShow[]>(() => {
    try {
      const s = localStorage.getItem('gather:scheduled');
      return s ? (JSON.parse(s) as ScheduledShow[]) : [];
    } catch {
      return [];
    }
  });
  const [savedScenePresets, setSavedScenePresets] = useState<CustomScenePreset[]>(() => {
    try {
      const raw = localStorage.getItem('gather:custom-scenes');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CustomScenePreset[]) : [];
    } catch {
      return [];
    }
  });
  const [destinations, setDestinations] = useState<DestinationConfig[]>(DEFAULT_DESTINATIONS);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);

  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullRecorderRef = useRef<MediaRecorder | null>(null);
  const fullChunksRef = useRef<Blob[]>([]);
  const replayRecorderRef = useRef<MediaRecorder | null>(null);
  const replayChunksRef = useRef<Array<{ blob: Blob; ts: number }>>([]);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  const clientId = useMemo(() => {
    const key = 'gather:clientId';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `u-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  }, []);

  const addToast = useCallback((text: string) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3800);
  }, []);



  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }
    try {
      localStorage.setItem('gather:theme', JSON.stringify(theme));
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const syncRouteFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const watchParam = params.get('watch');
      const joinParam = params.get('join');
      const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();

      if (watchParam) {
        const code = parseRoomCodeFromInput(watchParam);
        setRoomCode(code);
        setClientRole('viewer');
        setIsWatchPreview(false);
        setViewMode('watch');
      } else if (joinParam) {
        const code = parseRoomCodeFromInput(joinParam);
        setPendingRoomCode(code);
        setGreenRoomIsNew(false);
        setGreenRoomOpen(true);
      } else if (rawHash === 'broadcast' || rawHash === 'watch') {
        setRoomCode('CAST01');
        setClientRole('viewer');
        setIsWatchPreview(false);
        setViewMode('watch');
      } else if (rawHash === 'gamer-arena' || rawHash === 'gamer') {
        setRoomCode('GAMER1');
        setClientRole('viewer');
        setIsWatchPreview(false);
        setViewMode('watch');
      } else if (rawHash === 'live-shop' || rawHash === 'shop') {
        setRoomCode('SHOP01');
        setClientRole('viewer');
        setIsWatchPreview(false);
        setViewMode('watch');
      } else if (rawHash.startsWith('watch=')) {
        const code = parseRoomCodeFromInput(rawHash.slice(6));
        setRoomCode(code);
        setClientRole('viewer');
        setIsWatchPreview(false);
        setViewMode('watch');
      }
    };

    syncRouteFromUrl();
    window.addEventListener('hashchange', syncRouteFromUrl);
    return () => window.removeEventListener('hashchange', syncRouteFromUrl);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      if (!u) {
        setIsSubscribed(false);
        return;
      }
      if (u.displayName) setDisplayName(u.displayName);
      if (u.photoURL) setAvatarUrl((prev) => prev || u.photoURL || undefined);
      if (!u.emailVerified) return;

      const userPath = `users/${u.uid}`;
      try {
        await u.getIdToken();
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          setSavedPayouts({
            enabled: true,
            paypalHandle:
              typeof data.paypalHandle === 'string' && data.paypalHandle
                ? data.paypalHandle
                : 'gatherstudio',
            venmoHandle:
              typeof data.venmoHandle === 'string' && data.venmoHandle
                ? data.venmoHandle
                : 'gather-live',
            cashappTag:
              typeof data.cashappTag === 'string' && data.cashappTag
                ? data.cashappTag
                : 'GatherLive',
            stripeUrl: typeof data.stripeUrl === 'string' ? data.stripeUrl : '',
          });
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.GET, userPath);
        } catch {
          // Graceful fallback if Firestore rule denies unverified email or offline
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser || !authUser.emailVerified) return;
    let cancelled = false;
    void (async () => {
      try {
        const q = query(collection(db, 'customScenes'), where('ownerUid', '==', authUser.uid));
        const snap = await getDocs(q);
        if (cancelled) return;
        const remote: CustomScenePreset[] = snap.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>;
            if (typeof data.id !== 'string' || typeof data.name !== 'string') return null;
            return {
              id: data.id,
              ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : authUser.uid,
              name: data.name,
              aspect: data.aspect === '9:16' ? '9:16' : '16:9',
              baseTemplateId:
                typeof data.baseTemplateId === 'string' ? data.baseTemplateId : 'solo',
              elements: Array.isArray(data.elements)
                ? (data.elements as CustomStageElement[])
                : [],
              backdrop:
                (typeof data.backdrop === 'string'
                  ? data.backdrop
                  : 'dusk') as CustomScenePreset['backdrop'],
              bannerTitle: typeof data.bannerTitle === 'string' ? data.bannerTitle : '',
              bannerSubtitle: typeof data.bannerSubtitle === 'string' ? data.bannerSubtitle : '',
              bannerStyle:
                (typeof data.bannerStyle === 'string'
                  ? data.bannerStyle
                  : 'editorial') as CustomScenePreset['bannerStyle'],
              bannerVisible: Boolean(data.bannerVisible),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as CustomScenePreset;
          })
          .filter((item): item is CustomScenePreset => item !== null && item.elements.length > 0);

        if (remote.length > 0) {
          setSavedScenePresets((prev) => {
            const byId = new Map<string, CustomScenePreset>();
            for (const p of remote) byId.set(p.id, p);
            for (const p of prev) {
              if (!byId.has(p.id)) byId.set(p.id, p);
            }
            const merged = Array.from(byId.values());
            try {
              localStorage.setItem('gather:custom-scenes', JSON.stringify(merged));
            } catch {
              // ignore storage error
            }
            return merged;
          });
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.LIST, 'customScenes');
        } catch {
          // Graceful fallback to localStorage presets when offline or unverified
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const handleOrderAlert = useCallback(
    (orderText: string) => {
      audioEngine.playStinger('order');
      addToast(`New Live Order: ${orderText}`);
    },
    [addToast]
  );

  const handleSuperChatAlert = useCallback(
    (scText: string) => {
      audioEngine.playStinger('order');
      addToast(scText);
    },
    [addToast]
  );

  const handlePromotedToStage = useCallback(() => {
    addToast('The host invited you onto the live stage! Check your camera & mic.');
    if (roomCode) {
      setPendingRoomCode(roomCode);
      setGreenRoomIsNew(false);
      setGreenRoomOpen(true);
    }
  }, [addToast, roomCode]);

  const handleKicked = useCallback(() => {
    addToast('You were removed from the studio by the host.');
    setViewMode('landing');
    setRoomCode(null);
  }, [addToast]);

  const socket = useStudioSocket({
    roomCode,
    clientId,
    role: clientRole,
    name: displayName,
    avatarUrl,
    hostUid: authUser?.uid,
    studioTitle: studioTitleInit,
    initialWatchMode: studioFormatInit,
    initialPayouts: savedPayouts,
    micOn,
    camOn,
    localStream,
    programStream,
    onOrderReceived: handleOrderAlert,
    onSuperChatReceived: handleSuperChatAlert,
    onPromotedToStage: handlePromotedToStage,
    onKicked: handleKicked,
  });

  const activeRoom = useMemo(() => {
    if (socket.roomState) return socket.roomState;
    const defaultMode: WatchMode = roomCode?.startsWith('GAMER')
      ? 'gamer'
      : roomCode?.startsWith('SHOP')
      ? 'shop'
      : studioFormatInit;
    return makeFallbackRoom(roomCode || 'CAST01', defaultMode);
  }, [socket.roomState, roomCode, studioFormatInit]);

  const isHost = clientRole === 'host' || activeRoom.hostId === clientId;

  const mergedSavedPresets = useMemo(() => {
    const byId = new Map<string, CustomScenePreset>();
    for (const p of savedScenePresets) byId.set(p.id, p);
    for (const p of activeRoom.scene.savedPresets || []) {
      byId.set(p.id, p);
    }
    return Array.from(byId.values());
  }, [savedScenePresets, activeRoom.scene.savedPresets]);

  const handleSaveCustomPreset = useCallback(
    (rawName: string) => {
      const cleanName = rawName.trim().slice(0, 36);
      if (!cleanName) return;
      const useCustom =
        activeRoom.scene.customElements.length > 0 &&
        (activeRoom.scene.templateId === 'custom' ||
          activeRoom.scene.templateId.startsWith('custom-'));
      const sourceElements = useCustom
        ? activeRoom.scene.customElements.map((el) => ({ ...el }))
        : buildBoxesForTemplate(
            activeRoom.scene.templateId,
            activeRoom.aspectRatio,
            activeRoom.participants
          );
      const boundedElements = sourceElements.slice(0, 12);
      const now = Date.now();
      const presetId = `custom-${now.toString(36)}`;
      const preset: CustomScenePreset = {
        id: presetId,
        ownerUid: authUser?.uid || clientId,
        name: cleanName,
        aspect: activeRoom.aspectRatio,
        baseTemplateId: activeRoom.scene.templateId.slice(0, 64) || 'solo',
        elements: boundedElements,
        backdrop: activeRoom.brand.backdrop,
        bannerTitle: (activeRoom.overlays.banner.title || '').slice(0, 80),
        bannerSubtitle: (activeRoom.overlays.banner.subtitle || '').slice(0, 120),
        bannerStyle: activeRoom.overlays.banner.style,
        bannerVisible: Boolean(activeRoom.overlays.banner.visible),
        createdAt: now,
        updatedAt: now,
      };

      setSavedScenePresets((prev) => {
        const next = [preset, ...prev.filter((p) => p.id !== preset.id)];
        try {
          localStorage.setItem('gather:custom-scenes', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      socket.saveScenePreset(preset);
      socket.applyScenePreset(preset.id);

      if (authUser) {
        const scenePath = `customScenes/${preset.id}`;
        void setDoc(doc(db, 'customScenes', preset.id), {
          id: preset.id,
          ownerUid: authUser.uid,
          name: preset.name,
          aspect: preset.aspect,
          baseTemplateId: preset.baseTemplateId,
          elements: preset.elements,
          backdrop: preset.backdrop,
          bannerTitle: preset.bannerTitle,
          bannerSubtitle: preset.bannerSubtitle,
          bannerStyle: preset.bannerStyle,
          bannerVisible: preset.bannerVisible,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          try {
            handleFirestoreError(err, OperationType.CREATE, scenePath);
          } catch {
            // keep local preset
          }
        });
      }

      addToast(`Saved scene preset "${preset.name}".`);
    },
    [activeRoom, authUser, clientId, socket, addToast]
  );

  const handleApplyCustomPreset = useCallback(
    (preset: CustomScenePreset) => {
      setEditMode(false);
      socket.applyScenePreset(preset.id);
      const nextSaved = mergedSavedPresets.some((p) => p.id === preset.id)
        ? mergedSavedPresets
        : [preset, ...mergedSavedPresets];
      socket.sendPatch({
        aspectRatio: preset.aspect,
        scene: {
          ...activeRoom.scene,
          templateId: preset.id,
          customElements: preset.elements.map((el) => ({ ...el })),
          savedPresets: nextSaved,
        },
        brand: {
          ...activeRoom.brand,
          backdrop: preset.backdrop,
        },
        overlays: {
          ...activeRoom.overlays,
          banner: {
            visible: preset.bannerVisible,
            title: preset.bannerTitle,
            subtitle: preset.bannerSubtitle,
            style: preset.bannerStyle,
          },
        },
      });
      addToast(`Applied scene "${preset.name}".`);
    },
    [activeRoom, mergedSavedPresets, socket, addToast]
  );

  const handleDeleteCustomPreset = useCallback(
    (presetId: string) => {
      setSavedScenePresets((prev) => {
        const next = prev.filter((p) => p.id !== presetId);
        try {
          localStorage.setItem('gather:custom-scenes', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      socket.deleteScenePreset(presetId);
      if (activeRoom.scene.templateId === presetId) {
        socket.sendPatch({
          scene: {
            ...activeRoom.scene,
            templateId: activeRoom.aspectRatio === '9:16' ? 'v-solo' : 'solo',
          },
        });
      }
      if (authUser) {
        const scenePath = `customScenes/${presetId}`;
        void deleteDoc(doc(db, 'customScenes', presetId)).catch((err) => {
          try {
            handleFirestoreError(err, OperationType.DELETE, scenePath);
          } catch {
            // ignore
          }
        });
      }
      addToast('Deleted custom scene preset.');
    },
    [activeRoom, authUser, socket, addToast]
  );

  // Check viewer subscription status whenever authUser or activeRoom changes
  const currentHostKey = useMemo(
    () => sanitizeHostKey(activeRoom.hostUid || activeRoom.roomCode || 'GATHERLIVE'),
    [activeRoom.hostUid, activeRoom.roomCode]
  );

  useEffect(() => {
    if (!authUser || !authUser.emailVerified || viewMode !== 'watch') {
      if (!authUser) setIsSubscribed(false);
      return;
    }
    let cancelled = false;
    const subId = `${currentHostKey}_${authUser.uid}`;
    const subPath = `subscriptions/${subId}`;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'subscriptions', subId));
        if (!cancelled) {
          setIsSubscribed(snap.exists() && Boolean(snap.data()?.active));
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.GET, subPath);
        } catch {
          // ignore if offline
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser, currentHostKey, viewMode]);

  const handleSignInWithGoogle = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        addToast(`Signed in as ${cred.user.displayName || cred.user.email || 'Viewer'}`);
      }
    } catch {
      addToast('Google sign-in popup was closed.');
    }
  }, [addToast]);

  const handleToggleViewerSubscribe = useCallback(async () => {
    let currentUser = authUser;
    if (!currentUser) {
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        currentUser = cred.user;
      } catch {
        addToast('Sign in with Google to receive live stream email alerts.');
        return;
      }
    }
    if (!currentUser || !currentUser.email) {
      addToast('Verified Google email required for stream notifications.');
      return;
    }

    setSubscribing(true);
    const subId = `${currentHostKey}_${currentUser.uid}`;
    const subPath = `subscriptions/${subId}`;
    const subRef = doc(db, 'subscriptions', subId);
    const hostDisplay = (
      activeRoom.participants.find((p) => p.role === 'host')?.name ||
      activeRoom.title ||
      'Gather Host'
    ).slice(0, 60);
    const subName = (currentUser.displayName || currentUser.email.split('@')[0] || 'Viewer').slice(
      0,
      60
    );

    try {
      const existing = await getDoc(subRef);
      if (existing.exists()) {
        const nextActive = !existing.data()?.active;
        const updatePayload: Record<string, unknown> = {
          active: nextActive,
          hostName: hostDisplay,
          subscriberName: subName,
          updatedAt: serverTimestamp(),
        };
        if (activeRoom.hostUid) {
          updatePayload.hostUid = activeRoom.hostUid.slice(0, 128);
        }
        await updateDoc(subRef, updatePayload);
        setIsSubscribed(nextActive);
        addToast(
          nextActive
            ? `Subscribed! You'll get email alerts at ${currentUser.email}.`
            : 'Paused live stream email notifications.'
        );
      } else {
        const createPayload: Record<string, unknown> = {
          subscriptionId: subId,
          hostKey: currentHostKey,
          hostName: hostDisplay,
          subscriberUid: currentUser.uid,
          subscriberEmail: currentUser.email.slice(0, 120),
          subscriberName: subName,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (activeRoom.hostUid) {
          createPayload.hostUid = activeRoom.hostUid.slice(0, 128);
        }
        await setDoc(subRef, createPayload);
        setIsSubscribed(true);
        addToast(`Subscribed! You'll receive upcoming stream emails at ${currentUser.email}.`);
      }
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, subPath);
      } catch {
        addToast('Unable to update subscription right now.');
      }
    } finally {
      setSubscribing(false);
    }
  }, [authUser, currentHostKey, activeRoom, addToast]);

  const handleDispatchStreamEmails = useCallback(
    async (streamTitle: string, scheduledIso?: string, targetRoomCode?: string) => {
      let recipients: Array<{ email: string; name?: string }> = [];
      if (authUser) {
        const subsPath = 'subscriptions';
        try {
          const q = query(collection(db, 'subscriptions'), where('hostUid', '==', authUser.uid));
          const snap = await getDocs(q);
          recipients = snap.docs
            .map((d) => d.data() as Record<string, unknown>)
            .filter((d) => d.active === true && typeof d.subscriberEmail === 'string')
            .map((d) => ({
              email: String(d.subscriberEmail),
              name: typeof d.subscriberName === 'string' ? d.subscriberName : 'Subscriber',
            }));
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.LIST, subsPath);
          } catch {
            // fallback if query fails
          }
        }
      }

      if (recipients.length === 0 && authUser?.email) {
        recipients = [{ email: authUser.email, name: authUser.displayName || 'Host Preview' }];
      }

      try {
        const code = targetRoomCode || activeRoom.roomCode;
        const watchUrl = `${window.location.origin}/?watch=${code}`;
        const res = await fetch('/api/notifications/send-stream-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostName: displayName,
            streamTitle,
            scheduledIso,
            watchUrl,
            roomCode: code,
            subscribers: recipients,
          }),
        });
        const data = (await res.json()) as { sentCount?: number; mode?: string };
        addToast(
          `Dispatched live stream email alert to ${data.sentCount ?? recipients.length} subscriber(s).`
        );
      } catch {
        addToast('Unable to send subscriber email alert.');
      }
    },
    [authUser, activeRoom.roomCode, displayName, addToast]
  );

  useEffect(() => {
    if (localStream) {
      audioEngine.attachStream('local-mic', localStream, false);
    }
  }, [localStream]);

  useEffect(() => {
    for (const [peerId, stream] of Object.entries(socket.remoteStreams)) {
      audioEngine.attachStream(`peer-${peerId}`, stream, true);
    }
  }, [socket.remoteStreams]);

  useEffect(() => {
    const remotePeers = activeRoom.participants.filter((p) => p.id !== clientId);
    setChannels((prev) => {
      const base = prev.filter(
        (c) => c.id === 'local-mic' || c.id === 'media-deck' || c.id === 'stinger-fx'
      );
      const existingPeers = new Map(prev.map((c) => [c.id, c]));
      const peerChannels: AudioChannelState[] = remotePeers.map((p) => {
        const chId = `peer-${p.id}`;
        const existing = existingPeers.get(chId);
        return existing
          ? { ...existing, label: p.name }
          : {
              id: chId,
              label: p.name,
              gain: 1.0,
              muted: !p.micOn,
              solo: false,
              monitor: true,
              clarityEq: true,
              level: 0,
            };
      });
      return [...base, ...peerChannels];
    });
  }, [activeRoom.participants, clientId]);

  const setMicEnabled = useCallback(
    (next: boolean) => {
      setMicOn(next);
      localStream?.getAudioTracks().forEach((t) => {
        t.enabled = next;
      });
      socket.sendParticipantUpdate(clientId, { micOn: next });
      setChannels((prev) =>
        prev.map((c) => {
          if (c.id !== 'local-mic') return c;
          audioEngine.setChannelParams('local-mic', { muted: !next, gain: c.gain });
          return { ...c, muted: !next };
        })
      );
    },
    [localStream, socket, clientId]
  );

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    if (stageCanvasRef.current === canvas) return;
    stageCanvasRef.current = canvas;
    try {
      const videoStream = canvas.captureStream(30);
      const audioMaster = audioEngine.getMasterStream();
      const tracks = [...videoStream.getVideoTracks()];
      if (audioMaster) {
        tracks.push(...audioMaster.getAudioTracks());
      }
      const combined = new MediaStream(tracks);
      setProgramStream(combined);

      if (typeof MediaRecorder !== 'undefined') {
        try {
          const rec = new MediaRecorder(combined, { mimeType: 'video/webm' });
          rec.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              const now = Date.now();
              replayChunksRef.current = [
                ...replayChunksRef.current.filter((c) => now - c.ts < 30000),
                { blob: ev.data, ts: now },
              ];
            }
          };
          rec.start(1000);
          replayRecorderRef.current = rec;
        } catch {
          // ignore if browser blocks MediaRecorder codec
        }
      }
    } catch {
      // ignore captureStream errors
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (viewMode === 'studio' || viewMode === 'watch') {
        setElapsedSec((s) => s + 1);
      }
      if (isRecording) {
        setRecordingSec((s) => s + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [viewMode, isRecording]);

  useEffect(() => {
    if (!activeRoom.overlays.captionsEnabled || viewMode !== 'studio') return;
    interface SpeechRecLike {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      start: () => void;
      stop: () => void;
    }
    type SpeechRecCtor = new () => SpeechRecLike;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecCtor;
      webkitSpeechRecognition?: SpeechRecCtor;
    };
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = activeRoom.overlays.captionLang || 'en-US';
    rec.onresult = (ev) => {
      let text = '';
      for (let i = Math.max(0, ev.results.length - 2); i < ev.results.length; i++) {
        text += ev.results[i][0].transcript + ' ';
      }
      socket.sendPatch({
        overlays: { ...activeRoom.overlays, captionText: text.trim() },
      });
    };
    try {
      rec.start();
    } catch {
      // ignore already started
    }
    return () => {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    };
  }, [activeRoom.overlays.captionsEnabled, activeRoom.overlays.captionLang, viewMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdPaletteOpen((v) => !v);
        return;
      }
      if (viewMode !== 'studio') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape' && cmdBarOpen) {
        setCmdBarOpen(false);
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCmdBarOpen((v) => !v);
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        setMicEnabled(!micOn);
      } else if (e.key.toLowerCase() === 'v') {
        setCamOn((prev) => {
          const next = !prev;
          localStream?.getVideoTracks().forEach((t) => (t.enabled = next));
          socket.sendParticipantUpdate(clientId, { camOn: next });
          return next;
        });
      } else if (e.key.toLowerCase() === 's') {
        setStingersOpen((prev) => {
          const next = !prev;
          if (next) setMixerOpen(false);
          return next;
        });
      } else if (e.key.toLowerCase() === 'p') {
        setTeleprompterOpen((prev) => !prev);
      } else if (['1', '2', '3', '4'].includes(e.key) && isHost) {
        const idx = Number(e.key) - 1;
        const tpl = SCENE_TEMPLATES[idx];
        if (tpl) {
          socket.sendPatch({ scene: { ...activeRoom.scene, templateId: tpl.id } });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, localStream, clientId, isHost, activeRoom.scene, socket, cmdBarOpen, micOn, setMicEnabled]);

  const openNewStudio = (initialFormat: WatchMode = 'standard') => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    setStudioFormatInit(initialFormat);
    setPendingRoomCode(code);
    setGreenRoomIsNew(true);
    setGreenRoomOpen(true);
  };

  const handleOpenWatchDemo = useCallback((demoMode: WatchMode) => {
    const demoCode =
      demoMode === 'gamer' ? 'GAMER1' : demoMode === 'shop' ? 'SHOP01' : 'CAST01';
    const hash =
      demoMode === 'gamer'
        ? '#gamer-arena'
        : demoMode === 'shop'
        ? '#live-shop'
        : '#broadcast';
    setStudioFormatInit(demoMode);
    setRoomCode(demoCode);
    setClientRole('viewer');
    setIsWatchPreview(false);
    setViewMode('watch');
    window.history.replaceState(null, '', hash);
  }, []);

  const handleJoinCode = (raw: string) => {
    const code = parseRoomCodeFromInput(raw);
    setPendingRoomCode(code);
    setGreenRoomIsNew(false);
    setGreenRoomOpen(true);
  };

  const handleEnterStudio = (payload: {
    name: string;
    avatarUrl?: string;
    micOn: boolean;
    camOn: boolean;
    stream: MediaStream | null;
    fx: VideoFxSettings;
    studioTitle?: string;
    watchMode: WatchMode;
    isHost: boolean;
  }) => {
    setDisplayName(payload.name);
    setAvatarUrl(payload.avatarUrl);
    setMicOn(payload.micOn);
    setCamOn(payload.camOn);
    setChannels((prev) =>
      prev.map((c) => (c.id === 'local-mic' ? { ...c, muted: !payload.micOn } : c))
    );
    setLocalStream(payload.stream);
    setVideoFx(payload.fx);
    if (payload.studioTitle) setStudioTitleInit(payload.studioTitle);
    setStudioFormatInit(payload.watchMode);
    setClientRole(payload.isHost ? 'host' : 'guest');
    setRoomCode(pendingRoomCode);
    setGreenRoomOpen(false);
    setViewMode('studio');
    setIsWatchPreview(false);
  };

  const handleToggleScreen = async () => {
    if (sharingScreen && screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setSharingScreen(false);
      socket.sendParticipantUpdate(clientId, { sharingScreen: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setSharingScreen(false);
        socket.sendParticipantUpdate(clientId, { sharingScreen: false });
      };
      setScreenStream(stream);
      setSharingScreen(true);
      socket.sendParticipantUpdate(clientId, { sharingScreen: true });
      if (isHost) {
        socket.sendPatch({ scene: { ...activeRoom.scene, templateId: 'screen-cam' } });
      }
    } catch {
      addToast('Screen share cancelled.');
    }
  };

  const handleDropMediaFile = async (file: File) => {
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        addToast(`Rendering PDF slides & extracting text: ${file.name}…`);
        const { pages, slideTexts } = await extractPdfDeck(file);
        setActiveMedia({
          id: `med-${Date.now()}`,
          kind: 'pdf',
          name: file.name,
          pages,
          slideTexts,
          currentPage: 1,
          totalPages: pages.length,
        });
        if (isHost) {
          socket.sendPatch({ scene: { ...activeRoom.scene, templateId: 'slides-cam' } });
        }
        addToast(`Loaded ${pages.length} slides — click AI Media to generate talking points!`);
      } else if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        const videoEl = document.createElement('video');
        videoEl.src = url;
        videoEl.playsInline = true;
        await videoEl.play().catch(() => {});
        audioEngine.attachMediaElement('media-deck', videoEl);
        setActiveMedia({
          id: `med-${Date.now()}`,
          kind: 'video',
          name: file.name,
          url,
          videoEl,
          currentPage: 1,
          totalPages: 1,
        });
        if (isHost) {
          socket.sendPatch({ scene: { ...activeRoom.scene, templateId: 'slides-cam' } });
        }
      } else if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        const imageEl = new Image();
        imageEl.src = url;
        setActiveMedia({
          id: `med-${Date.now()}`,
          kind: 'image',
          name: file.name,
          url,
          imageEl,
          currentPage: 1,
          totalPages: 1,
        });
        if (isHost) {
          socket.sendPatch({ scene: { ...activeRoom.scene, templateId: 'slides-cam' } });
        }
      }
    } catch {
      addToast('Unable to load dropped media file.');
    }
  };

  const handleToggleRecord = () => {
    if (isRecording && fullRecorderRef.current) {
      fullRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    if (!programStream) {
      addToast('Stage stream is still initializing.');
      return;
    }
    try {
      fullChunksRef.current = [];
      const rec = new MediaRecorder(programStream, { mimeType: 'video/webm' });
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) fullChunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const blob = new Blob(fullChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
        setRecordedFilename(`gather-show-${activeRoom.roomCode}.webm`);
        setRecordingModalOpen(true);
      };
      rec.start(500);
      fullRecorderRef.current = rec;
      setRecordingSec(0);
      setIsRecording(true);
      addToast('Recording started.');
    } catch {
      addToast('Recording unavailable in this browser.');
    }
  };

  const handleSaveReplayClip = () => {
    if (replayChunksRef.current.length === 0) {
      addToast('Replay buffer needs a few seconds of stage playback first.');
      return;
    }
    const blob = new Blob(
      replayChunksRef.current.map((c) => c.blob),
      { type: 'video/webm' }
    );
    const url = URL.createObjectURL(blob);
    setRecordedBlobUrl(url);
    setRecordedFilename(`gather-clip-${Math.round(elapsedSec)}s.webm`);
    setRecordingModalOpen(true);
    socket.createClip(`30s Replay Clip`, Math.round(elapsedSec), displayName);
  };

  const runRundownStep = useCallback(
    (step: RundownStep) => {
      const nextSteps = activeRoom.rundown.steps.map((s) =>
        s.id === step.id ? { ...s, completed: true } : s
      );
      socket.sendPatch({
        scene: { ...activeRoom.scene, templateId: step.sceneId },
        overlays: {
          ...activeRoom.overlays,
          banner: {
            ...activeRoom.overlays.banner,
            visible: true,
            title: step.bannerTitle,
            subtitle: step.bannerSub,
          },
        },
        rundown: {
          steps: nextSteps,
          activeStepId: step.id,
        },
      });
      if (step.productId && activeRoom.watchMode === 'shop') {
        socket.pinProduct(step.productId);
      }
      addToast(`Cue active: ${step.title}`);
    },
    [activeRoom, socket, addToast]
  );

  const applyAiActions = useCallback(
    (actions: AIProducerAction[]) => {
      for (const act of actions) {
        const args = act.args || {};
        if (act.name === 'switch_scene' && typeof args.templateId === 'string') {
          socket.sendPatch({ scene: { ...activeRoom.scene, templateId: args.templateId } });
        } else if (act.name === 'show_banner' && typeof args.title === 'string') {
          socket.sendPatch({
            overlays: {
              ...activeRoom.overlays,
              banner: {
                ...activeRoom.overlays.banner,
                visible: true,
                title: args.title,
                subtitle: typeof args.subtitle === 'string' ? args.subtitle : '',
              },
            },
          });
        } else if (act.name === 'hide_banner') {
          socket.sendPatch({
            overlays: {
              ...activeRoom.overlays,
              banner: { ...activeRoom.overlays.banner, visible: false },
            },
          });
        } else if (act.name === 'set_ticker') {
          socket.sendPatch({
            overlays: {
              ...activeRoom.overlays,
              ticker: {
                visible: Boolean(args.visible),
                text: typeof args.text === 'string' ? args.text : activeRoom.overlays.ticker.text,
              },
            },
          });
        } else if (act.name === 'toggle_captions') {
          socket.sendPatch({
            overlays: { ...activeRoom.overlays, captionsEnabled: Boolean(args.enabled) },
          });
        } else if (act.name === 'pin_product' && typeof args.productId === 'string') {
          socket.pinProduct(args.productId);
        } else if (act.name === 'unpin_product') {
          socket.pinProduct(null);
        } else if (
          act.name === 'launch_poll' &&
          typeof args.question === 'string' &&
          Array.isArray(args.options)
        ) {
          socket.launchPoll(
            args.question,
            args.options.map((o) => String(o)),
            true
          );
        } else if (act.name === 'trigger_sound' && typeof args.pad === 'string') {
          audioEngine.playStinger(args.pad as SoundboardPadId);
        } else if (act.name === 'start_countdown') {
          const mins = typeof args.minutes === 'number' ? args.minutes : 5;
          const label =
            typeof args.label === 'string' && args.label.trim()
              ? args.label.trim()
              : 'Starting Soon';
          socket.sendPatch({
            overlays: {
              ...activeRoom.overlays,
              countdownEndAt: mins > 0 ? Date.now() + mins * 60 * 1000 : null,
              countdownLabel: label,
            },
          });
        } else if (act.name === 'next_rundown_step') {
          const next = activeRoom.rundown.steps.find((s) => !s.completed);
          if (next) runRundownStep(next);
        }
      }
    },
    [activeRoom, socket, runRundownStep]
  );

  const handleAskAi = async (prompt: string) => {
    const userEntry: AILogEntry = {
      id: `ai-u-${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
    };
    setAiLogs((prev) => [...prev, userEntry]);
    setAiBusy(true);
    try {
      const res = await fetch('/api/ai/producer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          context: {
            title: activeRoom.title,
            currentScene: activeRoom.scene.templateId,
            watchMode: activeRoom.watchMode,
            products: activeRoom.commerce.products.map((p) => ({
              id: p.id,
              title: p.title,
              price: p.price,
              stock: p.stock,
              source: p.source,
            })),
            pinnedProductId: activeRoom.commerce.pinnedProductId,
            recentChat: activeRoom.chatMessages.slice(-5),
          },
        }),
      });
      const data = (await res.json()) as {
        text?: string;
        actions?: AIProducerAction[];
        error?: string;
      };
      if (!res.ok || data.error) {
        addToast(data.error || 'AI Producer unavailable.');
        return;
      }

      if (data.actions && data.actions.length > 0) {
        applyAiActions(data.actions);
      }
      const aiText = data.text || 'Done.';
      setAiLogs((prev) => [
        ...prev,
        {
          id: `ai-r-${Date.now()}`,
          role: 'ai',
          text: aiText,
          actions: data.actions,
          timestamp: Date.now(),
        },
      ]);

      if (aiVoiceReadout && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(aiText);
        utter.rate = 1.05;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      addToast('Failed to reach AI Producer endpoint.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleGenerateShowNotes = async () => {
    setShowNotesOpen(true);
    setShowNotesLoading(true);
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeRoom.title,
          clips: activeRoom.gamer.clips,
          orders: activeRoom.commerce.recentOrders,
          products: activeRoom.commerce.products,
          chatMessages: activeRoom.chatMessages.slice(-20),
          rundown: activeRoom.rundown.steps,
        }),
      });
      const data = (await res.json()) as { markdown?: string; error?: string };
      setShowNotesMd(data.markdown || data.error || 'No notes generated.');
    } catch {
      setShowNotesMd('Unable to generate show notes.');
    } finally {
      setShowNotesLoading(false);
    }
  };

  const handleToggleCustomLayout = () => {
    if (!editMode) {
      const existing = activeRoom.scene.customElements;
      const isAlreadyCustom =
        activeRoom.scene.templateId === 'custom' ||
        activeRoom.scene.templateId.startsWith('custom-');
      if (existing.length === 0 || !isAlreadyCustom) {
        const seeded = buildBoxesForTemplate(
          activeRoom.scene.templateId,
          activeRoom.aspectRatio,
          activeRoom.participants
        );
        socket.sendPatch({
          scene: {
            ...activeRoom.scene,
            templateId: isAlreadyCustom ? activeRoom.scene.templateId : 'custom',
            customElements: seeded,
          },
        });
      }
      setEditMode(true);
    } else {
      setEditMode(false);
    }
  };

  const commandActions = [
    {
      id: 'cmd-watch',
      label: 'Preview Public Watch Page',
      run: () => {
        setIsWatchPreview(true);
        setViewMode('watch');
      },
    },
    {
      id: 'cmd-ai-media',
      label: 'Open AI Media Studio (PDF Analyzer, Stage Graphics & Magic Clips)',
      run: () => {
        setAiMediaTab('pdf');
        setAiMediaOpen(true);
      },
    },
    {
      id: 'cmd-prompter',
      label: 'Toggle Eye-Line Voice-Synced Teleprompter',
      shortcut: 'P',
      run: () => setTeleprompterOpen((v) => !v),
    },
    {
      id: 'cmd-podcast',
      label: 'Open Podcast RSS & WAV Syndication Hub (Spotify / Apple)',
      run: () => {
        setAiMediaTab('podcast');
        setAiMediaOpen(true);
      },
    },
    {
      id: 'cmd-mixer',
      label: 'Toggle Pro Audio Mixer',
      run: () => {
        setStingersOpen(false);
        setMixerOpen((v) => !v);
      },
    },
    {
      id: 'cmd-stingers',
      label: 'Toggle Stingers & Custom Audio FX Deck',
      shortcut: 'S',
      run: () => {
        setMixerOpen(false);
        setStingersOpen((v) => !v);
      },
    },
    { id: 'cmd-rec', label: isRecording ? 'Stop Recording' : 'Start Recording', run: handleToggleRecord },
    { id: 'cmd-clip', label: 'Save 30s Replay Clip', run: handleSaveReplayClip },
    { id: 'cmd-notes', label: 'Generate AI Show Notes', run: handleGenerateShowNotes },
  ];

  return (
    <div className="h-screen flex flex-col gather-backdrop p-2.5 gap-2.5 overflow-hidden">
      <TopBar
        mode={viewMode}
        studioTitle={activeRoom.title}
        connState={socket.connState}
        isLive={activeRoom.isLive}
        isRecording={isRecording}
        recordingSec={recordingSec}
        watchMode={activeRoom.watchMode}
        viewerCount={activeRoom.viewerCount}
        bagCount={bagCount}
        theme={theme}
        user={authUser}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onGoHome={() => {
          setIsWatchPreview(false);
          setViewMode('landing');
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
        onCreateStudio={() => openNewStudio('standard')}
        onOpenSchedule={() => setScheduleOpen(true)}
        onOpenWatchDemo={handleOpenWatchDemo}
        onOpenWatchPreview={() => {
          setIsWatchPreview(true);
          setViewMode('watch');
        }}
        onExitWatchPreview={
          isWatchPreview
            ? () => {
                setIsWatchPreview(false);
                setViewMode('studio');
              }
            : undefined
        }
        onLeaveWatch={
          viewMode === 'watch' && !isWatchPreview
            ? () => {
                setIsWatchPreview(false);
                setRoomCode(null);
                setViewMode('landing');
                if (window.location.hash) {
                  window.history.replaceState(null, '', window.location.pathname + window.location.search);
                }
              }
            : undefined
        }
        onOpenInvite={() => setInviteOpen(true)}
        onOpenGoLive={() => setGoLiveOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenCommandPalette={() => setCmdPaletteOpen(true)}
        onOpenBag={() => setBagOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
      />

      {viewMode === 'landing' && (
        <LandingView
          scheduledShows={scheduledShows}
          isSignedIn={Boolean(authUser)}
          userName={authUser?.displayName}
          onCreateStudio={(fmt) => openNewStudio(fmt || 'standard')}
          onJoinCode={handleJoinCode}
          onOpenWatchDemo={handleOpenWatchDemo}
          onOpenSchedule={() => setScheduleOpen(true)}
          onOpenAuth={() => setAuthOpen(true)}
          onLaunchScheduled={(show) => {
            setStudioTitleInit(show.title);
            setStudioFormatInit(show.watchMode);
            setPendingRoomCode(show.roomCode);
            setGreenRoomIsNew(true);
            setGreenRoomOpen(true);
          }}
          onDeleteScheduled={(id) => {
            const next = scheduledShows.filter((s) => s.id !== id);
            setScheduledShows(next);
            localStorage.setItem('gather:scheduled', JSON.stringify(next));
            if (authUser) {
              const showPath = `scheduledShows/${id}`;
              void deleteDoc(doc(db, 'scheduledShows', id)).catch((err) => {
                try {
                  handleFirestoreError(err, OperationType.DELETE, showPath);
                } catch {
                  // ignore
                }
              });
            }
          }}
        />
      )}

      {viewMode === 'studio' &&
        !isHost &&
        (socket.knockState === 'knocking' || socket.knockState === 'denied') && (
          <main className="flex-1 min-h-0 flex items-center justify-center p-4">
            <div className="w-full max-w-[440px] rounded-[16px] gather-glass-elevated p-6 space-y-4 text-center">
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono-num uppercase tracking-wider text-[var(--accent-text)]">
                  Room {roomCode} · Green Room Lobby
                </div>
                <h2 className="font-display text-lg font-bold text-[var(--ink)] tracking-tight">
                  {socket.knockState === 'denied'
                    ? 'Entry declined by host'
                    : 'Waiting for host to admit you'}
                </h2>
                <p className="text-xs leading-relaxed text-[var(--ink-2)]">
                  {socket.knockState === 'denied'
                    ? 'The host did not admit this request to join the live stage.'
                    : `Signed in as ${displayName}. This room is currently locked — you will join automatically once admitted.`}
                </p>
              </div>
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    localStream?.getTracks().forEach((t) => t.stop());
                    setLocalStream(null);
                    setRoomCode(null);
                    setViewMode('landing');
                  }}
                  className="h-9 px-4 rounded-[8px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--line-2)] text-xs font-semibold text-[var(--ink)] cursor-pointer"
                >
                  Return to Home
                </button>
              </div>
            </div>
          </main>
        )}

      {viewMode === 'studio' &&
        (isHost || (socket.knockState !== 'knocking' && socket.knockState !== 'denied')) && (
          <>
            <main
              className={`flex-1 min-h-0 grid grid-cols-1 gap-2.5 ${
                panelOpen
                  ? 'lg:grid-cols-[minmax(0,1fr)_360px_72px]'
                  : 'lg:grid-cols-[minmax(0,1fr)_72px]'
              }`}
            >
              {/* Left Column: Stage Card + Host Teleprompter + Floating AI Command Bar + Deck */}
              <div className="min-w-0 min-h-0 grid grid-rows-[minmax(0,1fr)_auto] gap-2.5">
                <div className="relative min-h-0 rounded-[12px] gather-glass p-3 flex flex-col">
                  {/* Eye-Line Host-Only Teleprompter (Invisible on StageCanvas & Watch Stream) */}
                  <TeleprompterOverlay
                    visible={teleprompterOpen}
                    script={teleprompterScript}
                    onScriptChange={setTeleprompterScript}
                    onClose={() => setTeleprompterOpen(false)}
                    activeMedia={activeMedia}
                    onSelectSlide={(pageIndex) =>
                      setActiveMedia((prev) =>
                        prev && prev.kind === 'pdf'
                          ? { ...prev, currentPage: pageIndex + 1 }
                          : prev
                      )
                    }
                    onPushBanner={(title, subtitle) => {
                      socket.sendPatch({
                        overlays: {
                          ...activeRoom.overlays,
                          banner: {
                            ...activeRoom.overlays.banner,
                            visible: true,
                            title,
                            subtitle,
                          },
                        },
                      });
                      addToast(`Pushed slide lower-third: ${title}`);
                    }}
                    onOpenAiDrawer={() => {
                      setAiMediaTab('pdf');
                      setAiMediaOpen(true);
                    }}
                  />

                  <div className="flex-1 min-h-0">
                    <StageCanvas
                      room={activeRoom}
                      localClientId={clientId}
                      localStream={localStream}
                      screenStream={screenStream}
                      remoteStreams={socket.remoteStreams}
                      activeMedia={activeMedia}
                      videoFx={videoFx}
                      editMode={editMode}
                      showSafeZone916={safeZone916}
                      onExitEditMode={() => setEditMode(false)}
                      onUpdateCustomElements={(els) =>
                        socket.sendPatch({ scene: { ...activeRoom.scene, customElements: els } })
                      }
                      onResetCustomElements={() => {
                        const resetEls: CustomStageElement[] = [
                          {
                            id: 'el-media',
                            kind: 'media',
                            label: 'Media / Screen',
                            x: 0.04,
                            y: 0.08,
                            w: 0.62,
                            h: 0.84,
                          },
                          {
                            id: 'el-host',
                            kind: 'participant',
                            label: displayName,
                            x: 0.69,
                            y: 0.14,
                            w: 0.27,
                            h: 0.42,
                            participantId: clientId,
                          },
                        ];
                        socket.sendPatch({
                          scene: { ...activeRoom.scene, templateId: 'custom', customElements: resetEls },
                        });
                      }}
                      onDropMediaFile={handleDropMediaFile}
                      onMediaPageChange={(delta) =>
                        setActiveMedia((prev) => {
                          if (!prev || prev.kind !== 'pdf') return prev;
                          const next = Math.max(1, Math.min(prev.totalPages, prev.currentPage + delta));
                          return { ...prev, currentPage: next };
                        })
                      }
                      onStopMedia={() => setActiveMedia(null)}
                      onCanvasReady={handleCanvasReady}
                    />
                  </div>

                  {/* Precision AI Producer Command Bar */}
                  {cmdBarOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-20 w-[min(560px,calc(100%-24px))] rounded-[12px] gather-glass-elevated p-3 space-y-2.5">
                      {(() => {
                        const lastAi = [...aiLogs].reverse().find((l) => l.role === 'ai');
                        if (!lastAi) return null;
                        return (
                          <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-[var(--line)] text-xs">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="text-[11px] font-semibold text-[var(--accent-text)]">
                                Cue AI
                              </div>
                              <p className="text-[var(--ink-2)] leading-relaxed line-clamp-3">
                                {lastAi.text}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                socket.sendPatch({
                                  overlays: {
                                    ...activeRoom.overlays,
                                    banner: {
                                      ...activeRoom.overlays.banner,
                                      visible: true,
                                      title: 'AI Producer Cue',
                                      subtitle: lastAi.text.slice(0, 85),
                                    },
                                  },
                                });
                              }}
                              className="shrink-0 h-7 px-2.5 rounded-[6px] bg-[var(--fill)] border border-[var(--line-2)] text-[11px] font-medium text-[var(--ink)] hover:border-[var(--accent)] cursor-pointer"
                            >
                              {lastAi.pushedToStage ? 'On stage' : 'Push to banner'}
                            </button>
                          </div>
                        );
                      })()}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!cmdInput.trim() || aiBusy) return;
                          void handleAskAi(cmdInput.trim());
                          setCmdInput('');
                        }}
                        className="flex items-center gap-2"
                      >
                        <div className="gather-composer flex-1">
                          <ComposerShareControl
                            roomCode={activeRoom.roomCode}
                            roomTitle={activeRoom.title}
                          />
                          <span className={`gather-orb ${aiBusy ? 'busy' : ''}`} />
                          <input
                            type="text"
                            autoFocus
                            value={cmdInput}
                            onChange={(e) => setCmdInput(e.target.value)}
                            placeholder="Direct Cue AI (press / to toggle)…"
                          />
                          {cmdInput.length > 0 && (
                            <button
                              type="button"
                              aria-label="Clear command input"
                              title="Clear"
                              onClick={(e) => {
                                setCmdInput('');
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
                            aria-label="Speak command to AI Producer"
                            onClick={() => {
                              interface SpeechRecLike {
                                lang: string;
                                interimResults: boolean;
                                onresult:
                                  | ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
                                  | null;
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
                              rec.lang = 'en-US';
                              rec.interimResults = false;
                              rec.onresult = (ev) => {
                                const transcript = ev.results?.[0]?.[0]?.transcript;
                                if (transcript) {
                                  setCmdInput(transcript);
                                  void handleAskAi(transcript);
                                }
                              };
                              rec.start();
                            }}
                            className="h-7 w-7 shrink-0 grid place-items-center rounded-[7px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
                          >
                            <Mic className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="submit"
                            aria-label="Send AI command"
                            disabled={aiBusy || !cmdInput.trim()}
                            className={`gather-send-btn ${cmdInput.trim() && !aiBusy ? 'ready' : ''}`}
                          >
                            <ArrowUp className="w-4 h-4 stroke-[2.25]" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCmdBarOpen(false)}
                          aria-label="Close AI cue bar"
                          className="h-9 w-9 shrink-0 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Deck Area */}
                <div className="space-y-2.5 min-w-0">
                  <StingerDeckDrawer
                    open={stingersOpen}
                    sfxChannel={
                      channels.find((c) => c.id === 'stinger-fx') || {
                        id: 'stinger-fx',
                        label: 'Stingers & FX',
                        gain: 1.0,
                        muted: false,
                        solo: false,
                        monitor: true,
                        clarityEq: false,
                        level: 0,
                      }
                    }
                    masterGain={masterGain}
                    localStream={localStream}
                    onUpdateSfxChannel={(patch) => {
                      setChannels((prev) =>
                        prev.map((c) => (c.id === 'stinger-fx' ? { ...c, ...patch } : c))
                      );
                    }}
                    onUpdateMasterGain={(g) => {
                      setMasterGain(g);
                      audioEngine.setMasterGain(g);
                    }}
                    onOpenMixer={() => {
                      setStingersOpen(false);
                      setMixerOpen(true);
                    }}
                    onNotify={addToast}
                    onClose={() => setStingersOpen(false)}
                  />

                  <AudioMixerDrawer
                    open={mixerOpen}
                    channels={channels}
                    masterGain={masterGain}
                    onUpdateChannel={(id, patch) => {
                      if (id === 'local-mic' && typeof patch.muted === 'boolean') {
                        setMicEnabled(!patch.muted);
                      }
                      setChannels((prev) =>
                        prev.map((c) => {
                          if (c.id !== id) return c;
                          const next = { ...c, ...patch };
                          audioEngine.setChannelParams(id, {
                            gain: next.gain,
                            muted: next.muted,
                            monitor: next.monitor,
                            clarityEq: next.clarityEq,
                          });
                          return next;
                        })
                      );
                    }}
                    onUpdateMasterGain={(g) => {
                      setMasterGain(g);
                      audioEngine.setMasterGain(g);
                    }}
                    onOpenStingerDeck={() => {
                      setMixerOpen(false);
                      setStingersOpen(true);
                    }}
                    onClose={() => setMixerOpen(false)}
                  />

                  <SceneDeck
                    room={activeRoom}
                    localClientId={clientId}
                    isHost={isHost}
                    savedPresets={mergedSavedPresets}
                    onSelectScene={(templateId) => {
                      setEditMode(false);
                      socket.sendPatch({ scene: { ...activeRoom.scene, templateId } });
                    }}
                    onApplyCustomPreset={handleApplyCustomPreset}
                    onSaveCustomPreset={handleSaveCustomPreset}
                    onDeleteCustomPreset={handleDeleteCustomPreset}
                    onChangeTransition={(transitionType: TransitionType, transitionMs: number) =>
                      socket.sendPatch({ scene: { ...activeRoom.scene, transitionType, transitionMs } })
                    }
                    onToggleParticipantStage={(id, onStage) =>
                      socket.sendParticipantUpdate(id, { onStage })
                    }
                    onAskMuteParticipant={(id) =>
                      socket.sendParticipantUpdate(id, { mutedByHost: true, micOn: false })
                    }
                    onKickParticipant={(id) => socket.kickGuest(id)}
                    onAdmitGuest={(id) => socket.admitGuest(id)}
                    onDenyGuest={(id) => socket.denyGuest(id)}
                    onToggleLock={() => socket.sendPatch({ isLocked: !activeRoom.isLocked })}
                    onRemoveSquadEntry={(id) => socket.removeSquadQueue(id)}
                    onFeatureQuestion={(id) => {
                      socket.sendPatch({
                        overlays: { ...activeRoom.overlays, featuredQuestionId: id },
                      });
                      if (id) socket.markQuestionAnswered(id);
                    }}
                    onPromoteHand={(handId) => {
                      socket.promoteHand(handId);
                      addToast('Sent live stage invitation to viewer!');
                    }}
                    onLowerHand={(handId) => socket.lowerHand(handId)}
                    onOpenStingers={() => {
                      setMixerOpen(false);
                      setStingersOpen(true);
                    }}
                    onOpenInvite={() => setInviteOpen(true)}
                  />
                </div>

                {/* Compact Mobile Tab Bar */}
                <div className="flex lg:hidden items-center gap-1 p-1 rounded-[8px] gather-glass overflow-x-auto">
                  {(
                    [
                      { id: 'chat', label: 'Chat' },
                      { id: 'ai', label: 'Cue AI' },
                      { id: 'show', label: 'Show' },
                      { id: 'shop', label: 'Payouts' },
                      { id: 'look', label: 'Look' },
                    ] as Array<{ id: ConsoleTab; label: string }>
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setConsoleTab(t.id);
                        setPanelOpen(true);
                      }}
                      className={`flex-1 h-8 px-2.5 rounded-[6px] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                        panelOpen && consoleTab === t.id
                          ? 'bg-[var(--surface-2)] text-[var(--ink)]'
                          : 'text-[var(--ink-3)]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Middle Column: 360px Gather v5 Side Panel */}
              <RightConsole
                room={activeRoom}
                isHost={isHost}
                actorId={authUser?.uid || clientId}
                open={panelOpen}
                activeTab={consoleTab}
                aiLogs={aiLogs}
                aiBusy={aiBusy}
                aiVoiceReadout={aiVoiceReadout}
                onToggleAiVoiceReadout={() => setAiVoiceReadout((v) => !v)}
                onAskAi={handleAskAi}
                onPushAiToStage={(entry) => {
                  socket.sendPatch({
                    overlays: {
                      ...activeRoom.overlays,
                      banner: {
                        ...activeRoom.overlays.banner,
                        visible: true,
                        title: 'AI Research Brief',
                        subtitle: entry.text.slice(0, 85),
                      },
                    },
                  });
                  setAiLogs((prev) =>
                    prev.map((item) =>
                      item.id === entry.id ? { ...item, pushedToStage: true } : item
                    )
                  );
                }}
                onGenerateShowNotes={handleGenerateShowNotes}
                onPatchRoom={(patch) => socket.sendPatch(patch)}
                onSendChat={(text: string, replyTo?: ChatReplyRef) =>
                  socket.sendChat(text, displayName, isHost ? 'host' : 'guest', 'studio', {
                    authorUid: authUser?.uid,
                    avatarUrl: authUser?.photoURL || avatarUrl,
                    replyTo,
                  })
                }
                onToggleChatLike={(messageId) =>
                  socket.toggleChatLike(messageId, authUser?.uid || clientId)
                }
                onToggleChatReaction={(messageId, emoji) =>
                  socket.toggleChatReaction(messageId, emoji, authUser?.uid || clientId)
                }
                onPinChatMessage={(messageId) => socket.pinChatMessage(messageId)}
                onDeleteChatMessage={(messageId) => socket.deleteChatMessage(messageId)}
                onBlockChatUser={(author, uid) => {
                  socket.blockChatUser(author, uid);
                  addToast(`Blocked ${author} from chat.`);
                }}
                onUnblockChatUser={(blockId) => socket.unblockChatUser(blockId)}
                onFeatureChat={(id) =>
                  socket.sendPatch({ overlays: { ...activeRoom.overlays, featuredChatId: id } })
                }
                onFeatureQuestion={(id) => {
                  socket.sendPatch({
                    overlays: { ...activeRoom.overlays, featuredQuestionId: id },
                  });
                  if (id) socket.markQuestionAnswered(id);
                }}
                onPinProduct={(id) => socket.pinProduct(id)}
                onStartFlashSale={(payload) => {
                  socket.startFlashSale(payload);
                  audioEngine.playStinger('intro');
                  addToast('Launched TV Volume Flash Sale with live countdown!');
                }}
                onStopFlashSale={() => {
                  socket.stopFlashSale();
                  addToast('Ended active Flash Sale.');
                }}
                onLaunchPoll={(q, opts, showOnStage) => socket.launchPoll(q, opts, showOnStage)}
                onClosePoll={(clear) => socket.closePoll(clear)}
                onRunRundownStep={runRundownStep}
                onToggleCaptions={() =>
                  socket.sendPatch({
                    overlays: {
                      ...activeRoom.overlays,
                      captionsEnabled: !activeRoom.overlays.captionsEnabled,
                    },
                  })
                }
                onSelectBrandFile={(kind, file) => {
                  const url = URL.createObjectURL(file);
                  if (kind === 'backdrop') {
                    socket.sendPatch({ brand: { ...activeRoom.brand, customBackdropUrl: url } });
                  } else if (kind === 'overlay') {
                    socket.sendPatch({ brand: { ...activeRoom.brand, customOverlayUrl: url } });
                    addToast('Applied full-screen custom PNG overlay.');
                  } else {
                    socket.sendPatch({ brand: { ...activeRoom.brand, logoUrl: url } });
                  }
                }}
              />

              {/* Right Column: 72px Vertical Icon Rail */}
              <RightRail
                activeTab={consoleTab}
                panelOpen={panelOpen}
                aiBusy={aiBusy}
                onSelectTab={(tab) => {
                  if (panelOpen && consoleTab === tab) {
                    setPanelOpen(false);
                  } else {
                    setConsoleTab(tab);
                    setPanelOpen(true);
                  }
                }}
                onTogglePanel={() => setPanelOpen((v) => !v)}
              />
            </main>

            <BottomDock
              roomCode={activeRoom.roomCode}
              isHost={isHost}
              micOn={micOn}
              camOn={camOn}
              sharingScreen={sharingScreen}
              isRecording={isRecording}
              mixerOpen={mixerOpen}
              stingersOpen={stingersOpen}
              editMode={editMode}
              cmdBarOpen={cmdBarOpen}
              teleprompterOpen={teleprompterOpen}
              safeZone916={safeZone916}
              aiBusy={aiBusy}
              onToggleMic={() => setMicEnabled(!micOn)}
              onToggleCam={() => {
                const next = !camOn;
                setCamOn(next);
                localStream?.getVideoTracks().forEach((t) => (t.enabled = next));
                socket.sendParticipantUpdate(clientId, { camOn: next });
              }}
              onToggleScreen={handleToggleScreen}
              onPickMediaFile={() => mediaInputRef.current?.click()}
              onToggleRecord={handleToggleRecord}
              onSaveReplayClip={handleSaveReplayClip}
              onToggleMixer={() => {
                setStingersOpen(false);
                setMixerOpen((v) => !v);
              }}
              onToggleStingers={() => {
                setMixerOpen(false);
                setStingersOpen((v) => !v);
              }}
              onToggleEditMode={handleToggleCustomLayout}
              onToggleCmdBar={() => setCmdBarOpen((v) => !v)}
              onOpenAiMedia={() => {
                setAiMediaTab('pdf');
                setAiMediaOpen(true);
              }}
              onToggleTeleprompter={() => setTeleprompterOpen((v) => !v)}
              onOpenPodcastHub={() => {
                setAiMediaTab('podcast');
                setAiMediaOpen(true);
              }}
              onToggleSafeZone916={() => setSafeZone916((v) => !v)}
              onLeaveStudio={() => {
                localStream?.getTracks().forEach((t) => t.stop());
                screenStream?.getTracks().forEach((t) => t.stop());
                setLocalStream(null);
                setScreenStream(null);
                setRoomCode(null);
                setViewMode('landing');
              }}
            />
          </>
        )}

      {viewMode === 'watch' && (
        <WatchPageView
          room={
            !socket.roomState
              ? roomCode === 'GAMER1'
                ? makeFallbackRoom('GAMER1', 'gamer')
                : roomCode === 'SHOP01'
                ? makeFallbackRoom('SHOP01', 'shop')
                : makeFallbackRoom(roomCode || 'CAST01', 'standard')
              : activeRoom
          }
          clientId={authUser?.uid || clientId}
          isHost={isHost || isWatchPreview}
          user={
            authUser
              ? {
                  uid: authUser.uid,
                  displayName: authUser.displayName,
                  email: authUser.email,
                  photoURL: authUser.photoURL,
                }
              : null
          }
          onSignInWithGoogle={handleSignInWithGoogle}
          isSubscribed={isSubscribed}
          subscribing={subscribing}
          onToggleSubscribe={handleToggleViewerSubscribe}
          onRaiseHand={(topic) => {
            socket.raiseHand({
              uid: authUser?.uid,
              name: authUser?.displayName || displayName,
              avatarUrl: authUser?.photoURL || avatarUrl,
              topic,
            });
            addToast('Raised hand for live stage call-in!');
          }}
          onLowerHand={() => {
            socket.lowerHand();
            addToast('Lowered stage call-in hand.');
          }}
          broadcastStream={socket.viewerBroadcastStream}
          localPreviewCanvas={isWatchPreview ? stageCanvasRef.current : null}
          elapsedSec={elapsedSec}
          isPreviewMode={isWatchPreview}
          bagOpen={bagOpen}
          onSetBagOpen={setBagOpen}
          onBagCountChange={setBagCount}
          onSwitchWatchMode={
            isWatchPreview ||
            roomCode === 'CAST01' ||
            roomCode === 'GAMER1' ||
            roomCode === 'SHOP01'
              ? (m) => {
                  socket.sendPatch({ watchMode: m });
                  if (!isWatchPreview) {
                    window.history.replaceState(
                      null,
                      '',
                      m === 'gamer'
                        ? '#gamer-arena'
                        : m === 'shop'
                        ? '#live-shop'
                        : '#broadcast'
                    );
                  }
                }
              : undefined
          }
          onSendChat={(text, author, replyTo) =>
            socket.sendChat(text, author, 'viewer', 'watch', {
              authorUid: authUser?.uid,
              avatarUrl: authUser?.photoURL || avatarUrl,
              replyTo,
            })
          }
          onToggleChatLike={(messageId) =>
            socket.toggleChatLike(messageId, authUser?.uid || clientId)
          }
          onToggleChatReaction={(messageId, emoji) =>
            socket.toggleChatReaction(messageId, emoji, authUser?.uid || clientId)
          }
          onPinChatMessage={(messageId) => socket.pinChatMessage(messageId)}
          onDeleteChatMessage={(messageId) => socket.deleteChatMessage(messageId)}
          onBlockChatUser={(author, uid) => {
            socket.blockChatUser(author, uid);
            addToast(`Blocked ${author} from room chat.`);
          }}
          onUnblockChatUser={(blockId) => socket.unblockChatUser(blockId)}
          onAskQuestion={(text, author) => socket.askQuestion(text, author)}
          onUpvoteQuestion={(questionId) => socket.upvoteQuestion(questionId)}
          onPlaceOrder={(payload) => socket.placeOrder(payload)}
          onVotePoll={(optionId) => socket.votePoll(optionId)}
          onCreateClip={(label, ts, by) => socket.createClip(label, ts, by)}
          onJoinSquadQueue={(handle, plat, note, role, rank) =>
            socket.joinSquadQueue(handle, plat, note, role, rank)
          }
          onSendSuperChat={(payload) =>
            socket.sendSuperChat({
              ...payload,
              avatarUrl: authUser?.photoURL || avatarUrl,
            })
          }
          onSendHype={() => socket.sendHype(authUser?.displayName || displayName)}
          onExitPreview={
            isWatchPreview
              ? () => {
                  setIsWatchPreview(false);
                  setViewMode('studio');
                }
              : undefined
          }
          onLeaveWatch={() => {
            setIsWatchPreview(false);
            setRoomCode(null);
            setViewMode('landing');
            if (window.location.hash) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }}
        />
      )}

      {aiMediaOpen && (
        <AiMediaPodcastDrawer
          open={aiMediaOpen}
          initialTab={aiMediaTab}
          onClose={() => setAiMediaOpen(false)}
          room={activeRoom}
          activeMedia={activeMedia}
          localStream={localStream}
          onUploadMediaFile={(file) => void handleDropMediaFile(file)}
          onAttachSlideCues={(cues: SlideAiCue[], fullScript: string) => {
            setActiveMedia((prev) => (prev ? { ...prev, slideCues: cues } : prev));
            if (fullScript) setTeleprompterScript(fullScript);
          }}
          onSelectSlide={(pageIndex) => {
            setActiveMedia((prev) =>
              prev && prev.kind === 'pdf' ? { ...prev, currentPage: pageIndex + 1 } : prev
            );
            if (isHost) {
              socket.sendPatch({ scene: { ...activeRoom.scene, templateId: 'slides-cam' } });
            }
          }}
          onOpenTeleprompterWithScript={(script) => {
            setTeleprompterScript(script);
            setTeleprompterOpen(true);
          }}
          onApplyBackdropUrl={(dataUrl) => {
            socket.sendPatch({ brand: { ...activeRoom.brand, customBackdropUrl: dataUrl } });
          }}
          onApplyOverlayUrl={(dataUrl) => {
            socket.sendPatch({ brand: { ...activeRoom.brand, customOverlayUrl: dataUrl } });
          }}
          onPushBanner={(title, subtitle) => {
            socket.sendPatch({
              overlays: {
                ...activeRoom.overlays,
                banner: {
                  ...activeRoom.overlays.banner,
                  visible: true,
                  title,
                  subtitle,
                },
              },
            });
          }}
          onLaunchPoll={(question, options) => socket.launchPoll(question, options, true)}
          onCreateClipMarker={(label, ts) => socket.createClip(label, ts, displayName)}
          onExportReplayClip={handleSaveReplayClip}
          onToast={addToast}
        />
      )}

      <input
        ref={mediaInputRef}
        type="file"
        accept=".pdf,video/*,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleDropMediaFile(f);
          e.target.value = '';
        }}
      />

      <GreenRoomModal
        open={greenRoomOpen}
        roomCode={pendingRoomCode}
        initialName={displayName}
        initialAvatarUrl={avatarUrl}
        initialFx={videoFx}
        initialWatchMode={studioFormatInit}
        isSignedIn={Boolean(authUser)}
        onOpenAuth={() => setAuthOpen(true)}
        isNewStudio={greenRoomIsNew}
        onCancel={() => setGreenRoomOpen(false)}
        onEnter={handleEnterStudio}
      />

      <AuthModal
        open={authOpen}
        user={authUser}
        payouts={savedPayouts}
        onUpdatePayouts={(next) => {
          setSavedPayouts(next);
          if (viewMode === 'studio' && isHost) {
            socket.sendPatch({
              commerce: { ...activeRoom.commerce, payouts: next },
            });
          }
        }}
        onClose={() => setAuthOpen(false)}
      />

      <InviteModal
        open={inviteOpen}
        roomCode={activeRoom.roomCode}
        watchMode={activeRoom.watchMode}
        onClose={() => setInviteOpen(false)}
        onOpenWatchPreview={() => {
          setIsWatchPreview(true);
          setViewMode('watch');
        }}
      />

      <GoLiveModal
        open={goLiveOpen}
        room={activeRoom}
        destinations={destinations}
        onUpdateDestinations={setDestinations}
        onToggleLive={() => {
          const nextLive = !activeRoom.isLive;
          socket.sendPatch({ isLive: nextLive });
          addToast(nextLive ? 'Broadcast is now LIVE!' : 'Broadcast ended.');
        }}
        onNotifySubscribers={() =>
          void handleDispatchStreamEmails(
            activeRoom.title,
            new Date().toISOString(),
            activeRoom.roomCode
          )
        }
        onChangeAspect={(aspectRatio) =>
          socket.sendPatch({
            aspectRatio,
            scene: {
              ...activeRoom.scene,
              templateId: aspectRatio === '9:16' ? 'v-solo' : 'solo',
            },
          })
        }
        onChangeWatchMode={(watchMode) => socket.sendPatch({ watchMode })}
        onClose={() => setGoLiveOpen(false)}
      />

      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSaveShow={(show, notifySubscribers) => {
          const next = [show, ...scheduledShows];
          setScheduledShows(next);
          localStorage.setItem('gather:scheduled', JSON.stringify(next));

          const scheduledIso = `${show.date}T${show.time}:00`;
          if (viewMode === 'studio' && isHost) {
            socket.sendPatch({
              upcomingStream: {
                title: show.title,
                scheduledIso,
              },
            });
          }

          if (authUser) {
            const showPath = `scheduledShows/${show.id}`;
            void setDoc(doc(db, 'scheduledShows', show.id), {
              id: show.id,
              hostUid: authUser.uid,
              hostKey: sanitizeHostKey(authUser.uid),
              hostName: (authUser.displayName || displayName || 'Gather Host').slice(0, 60),
              title: show.title.slice(0, 100),
              description: (show.description || '').slice(0, 500),
              scheduledIso,
              roomCode: sanitizeHostKey(show.roomCode).slice(0, 24),
              watchMode: show.watchMode,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((err) => {
              try {
                handleFirestoreError(err, OperationType.CREATE, showPath);
              } catch {
                // ignore if unverified
              }
            });
          }

          if (notifySubscribers) {
            void handleDispatchStreamEmails(show.title, scheduledIso, show.roomCode);
          } else {
            addToast(`Scheduled "${show.title}"`);
          }
        }}
      />

      <SettingsModal
        open={settingsOpen}
        theme={theme}
        videoFx={videoFx}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onUpdateVideoFx={setVideoFx}
        onClose={() => setSettingsOpen(false)}
      />

      <RecordingModal
        open={recordingModalOpen}
        blobUrl={recordedBlobUrl}
        filename={recordedFilename}
        onClose={() => setRecordingModalOpen(false)}
      />

      <ShowNotesModal
        open={showNotesOpen}
        markdown={showNotesMd}
        loading={showNotesLoading}
        onClose={() => setShowNotesOpen(false)}
      />

      <CommandPaletteModal
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        actions={commandActions}
      />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto px-3.5 py-2 rounded-xl gather-glass-elevated text-xs font-medium text-[var(--ink)] flex items-center gap-2"
            >
              <span>{t.text}</span>
              <button
                type="button"
                onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
