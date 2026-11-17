import {
  BackdropId,
  DestinationConfig,
  GearSpec,
  ProductItem,
  RundownStep,
  SceneTemplate,
  SponsorBanner,
  StageFont,
  VideoFxSettings,
} from '../types/studio';

export const SCENE_TEMPLATES: SceneTemplate[] = [
  { id: 'solo', name: 'Solo', aspect: '16:9', description: 'Single host full frame' },
  { id: 'duo', name: 'Duo Split', aspect: '16:9', description: 'Two speakers side by side' },
  { id: 'spotlight', name: 'Spotlight', aspect: '16:9', description: 'Lead speaker + side strip' },
  { id: 'grid4', name: 'Quad Grid', aspect: '16:9', description: 'Up to four cameras' },
  { id: 'grid6', name: 'Six Room', aspect: '16:9', description: 'Full six-person panel' },
  { id: 'screen-cam', name: 'Screen + Cam', aspect: '16:9', description: 'Game or screen share + cam' },
  { id: 'slides-cam', name: 'Slides + Cam', aspect: '16:9', description: 'Presentation deck + speaker' },
  { id: 'pip', name: 'Picture-in-Pic', aspect: '16:9', description: 'Full media + floating cam' },
  { id: 'full-media', name: 'Full Stage', aspect: '16:9', description: 'Slides, video, or share only' },
];

export const VERTICAL_TEMPLATES: SceneTemplate[] = [
  { id: 'v-solo', name: 'Vertical Solo', aspect: '9:16', description: 'Full portrait speaker' },
  { id: 'v-duo', name: 'Stacked Duo', aspect: '9:16', description: 'Top & bottom split' },
  { id: 'v-screen', name: 'Media + Cam', aspect: '9:16', description: 'Top media + bottom cam' },
  { id: 'v-slides', name: 'Deck + Pip', aspect: '9:16', description: 'Centered deck + cam bubble' },
];

export const ACCENT_SWATCHES = [
  { label: 'Gather Cobalt', value: '#2f6bf0' },
  { label: 'Sky Cyan', value: '#22b8cf' },
  { label: 'Studio Indigo', value: '#7c6cf2' },
  { label: 'Emerald', value: '#2f9e77' },
  { label: 'Amber Ember', value: '#e8794a' },
  { label: 'Crimson', value: '#e11d48' },
];

export const BACKDROP_PRESETS: Record<
  BackdropId,
  { name: string; gradient: [string, string]; gridTint: string }
> = {
  dusk: {
    name: 'Dusk',
    gradient: ['#080c16', '#101d3b'],
    gridTint: 'rgba(47, 107, 240, 0.08)',
  },
  graphite: {
    name: 'Graphite',
    gradient: ['#0d1017', '#1a202c'],
    gridTint: 'rgba(255, 255, 255, 0.04)',
  },
  ember: {
    name: 'Ember',
    gradient: ['#160c12', '#2d161b'],
    gridTint: 'rgba(225, 29, 72, 0.08)',
  },
  forest: {
    name: 'Forest',
    gradient: ['#081412', '#112a24'],
    gridTint: 'rgba(52, 211, 153, 0.07)',
  },
  paper: {
    name: 'Paper',
    gradient: ['#e9eef7', '#dfe6f2'],
    gridTint: 'rgba(15, 23, 42, 0.05)',
  },
};

export const STAGE_FONTS: StageFont[] = [
  'Plus Jakarta Sans',
  'Onest',
  'Playfair Display',
  'DM Serif Display',
  'Bebas Neue',
  'JetBrains Mono',
];

export const CAPTION_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'hi-IN', label: 'हिन्दी' },
];

export const DEFAULT_SPONSORS: SponsorBanner[] = [
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
];

export const DEFAULT_BANNER_PRESETS = [
  { title: 'Episode 12: Building Live', subtitle: 'Drop your questions in Q&A to get featured on stage' },
  { title: 'Ask Us Anything', subtitle: 'Upvote audience questions in real time' },
  { title: 'Live Studio Drop', subtitle: 'Limited studio run — tap product card below' },
  { title: 'Squad Queue Open', subtitle: 'Submit your gamertag on the Watch Page to join next match' },
];

export const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-mug',
    source: 'etsy',
    title: 'Cobalt Glaze Pour-Over Mug',
    price: 38.0,
    currency: 'USD',
    imageUrl: '/src/assets/images/product_ceramic_mug_1794839256911.jpg',
    url: 'https://www.etsy.com',
    stock: 9,
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
];

export const DEFAULT_GEAR_SPECS: GearSpec[] = [
  { id: 'gear-1', category: 'Mic', label: 'Primary Voice', value: 'Studio Dynamic XLR', productId: 'prod-mic' },
  { id: 'gear-2', category: 'Board', label: 'Keyboard', value: 'Gather 65% Cobalt', productId: 'prod-kb' },
  { id: 'gear-3', category: 'Display', label: 'Capture', value: '1440p 120Hz Low-Latency' },
  { id: 'gear-4', category: 'Audio', label: 'Bus', value: 'WebAudio Clarity EQ +4dB' },
];

export const DEFAULT_RUNDOWN: RundownStep[] = [
  {
    id: 'step-1',
    title: 'Cold Open & Guest Intros',
    durationMin: 4,
    sceneId: 'duo',
    bannerTitle: 'Welcome to Gather Live',
    bannerSub: 'Say hello in Watch Chat — show begins now',
    completed: false,
  },
  {
    id: 'step-2',
    title: 'Deep Dive & Live Screen Demo',
    durationMin: 10,
    sceneId: 'screen-cam',
    bannerTitle: 'Architecture & Live Walkthrough',
    bannerSub: 'Drop your questions in the Audience Q&A tab',
    completed: false,
  },
  {
    id: 'step-3',
    title: 'Upvoted Audience Q&A & Closing',
    durationMin: 8,
    sceneId: 'spotlight',
    bannerTitle: 'Live Audience Q&A',
    bannerSub: 'Featuring top-voted questions directly on stage',
    completed: false,
  },
];

export const DEFAULT_VIDEO_FX: VideoFxSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  mirror: true,
  blurBg: false,
  chromaKey: false,
  chromaColor: '#16a34a',
  chromaTolerance: 38,
};

export const DEFAULT_DESTINATIONS: DestinationConfig[] = [
  {
    id: 'dest-yt',
    platform: 'youtube',
    label: 'YouTube Live',
    channelUrl: 'https://youtube.com/live',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
    streamKey: '',
    enabled: true,
  },
  {
    id: 'dest-tw',
    platform: 'twitch',
    label: 'Twitch',
    channelUrl: 'https://twitch.tv',
    rtmpUrl: 'rtmp://live.twitch.tv/app',
    streamKey: '',
    enabled: false,
  },
  {
    id: 'dest-li',
    platform: 'linkedin',
    label: 'LinkedIn Live',
    channelUrl: 'https://linkedin.com/video/live',
    rtmpUrl: 'rtmps://1-edge-upload.linkedin.com:443/rtmp',
    streamKey: '',
    enabled: false,
  },
  {
    id: 'dest-x',
    platform: 'x',
    label: 'X (Twitter)',
    channelUrl: 'https://x.com/i/broadcasts',
    rtmpUrl: 'rtmps://va.pscp.tv:443/x',
    streamKey: '',
    enabled: false,
  },
  {
    id: 'dest-kick',
    platform: 'kick',
    label: 'Kick',
    channelUrl: 'https://kick.com',
    rtmpUrl: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app',
    streamKey: '',
    enabled: false,
  },
  {
    id: 'dest-tt',
    platform: 'tiktok',
    label: 'TikTok Live',
    channelUrl: 'https://tiktok.com/live',
    rtmpUrl: 'rtmp://push.tiktokv.com/live',
    streamKey: '',
    enabled: false,
  },
  {
    id: 'dest-ig',
    platform: 'instagram',
    label: 'Instagram Live',
    channelUrl: 'https://instagram.com',
    rtmpUrl: 'rtmps://live-upload.instagram.com:443/rtmp',
    streamKey: '',
    enabled: false,
  },
  {
    id: 'dest-rtmp',
    platform: 'custom',
    label: 'Custom RTMP',
    channelUrl: '',
    rtmpUrl: 'rtmp://your-ingest-endpoint/live',
    streamKey: '',
    enabled: false,
  },
];

export const HERO_STUDIO_IMAGE = '/src/assets/images/hero_studio_backdrop_1794839256456.jpg';
