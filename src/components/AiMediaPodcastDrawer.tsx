import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Mic,
  Play,
  Radio,
  Rss,
  Scissors,
  Sparkles,
  Square,
  Tv,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { GatherLogo } from './GatherLogo';
import {
  AiGraphicSpec,
  MagicClipSuggestion,
  MediaAsset,
  PodcastDirectoryStatus,
  PodcastShowConfig,
  RoomState,
  SlideAiCue,
} from '../types/studio';
import { audioEngine } from '../utils/audioEngine';
import {
  blobToBase64,
  convertBlobToWav,
  renderAiGraphicToDataUrl,
  synthesizeSamplePodcastEpisodeWav,
} from '../utils/wavEncoder';

export type AiPodcastTab = 'pdf' | 'graphics' | 'clips' | 'podcast';

interface AiMediaPodcastDrawerProps {
  open: boolean;
  initialTab: AiPodcastTab;
  onClose: () => void;
  room: RoomState;
  activeMedia: MediaAsset | null;
  localStream: MediaStream | null;
  onUploadMediaFile: (file: File) => void;
  onAttachSlideCues: (cues: SlideAiCue[], fullScript: string) => void;
  onSelectSlide: (pageIndex: number) => void;
  onOpenTeleprompterWithScript: (script: string) => void;
  onApplyBackdropUrl: (dataUrl: string) => void;
  onApplyOverlayUrl: (dataUrl: string) => void;
  onPushBanner: (title: string, subtitle: string) => void;
  onLaunchPoll: (question: string, options: string[]) => void;
  onCreateClipMarker: (label: string, timestampSec: number) => void;
  onExportReplayClip: () => void;
  onToast: (msg: string) => void;
}

const DIRECTORY_LABELS: Record<
  PodcastDirectoryStatus['platform'],
  { name: string; subtitle: string }
> = {
  spotify: { name: 'Spotify for Creators', subtitle: 'Auto-ingests WAV enclosures via RSS' },
  apple: { name: 'Apple Podcasts Connect', subtitle: 'iTunes 2.0 compliant episode tags' },
  amazon: { name: 'Amazon Music & Audible', subtitle: 'Direct syndication feed sync' },
  youtube: { name: 'YouTube Music Podcasts', subtitle: 'RSS audio-to-episode ingestion' },
};

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const AiMediaPodcastDrawer: React.FC<AiMediaPodcastDrawerProps> = ({
  open,
  initialTab,
  onClose,
  room,
  activeMedia,
  localStream,
  onUploadMediaFile,
  onAttachSlideCues,
  onSelectSlide,
  onOpenTeleprompterWithScript,
  onApplyBackdropUrl,
  onApplyOverlayUrl,
  onPushBanner,
  onLaunchPoll,
  onCreateClipMarker,
  onExportReplayClip,
  onToast,
}) => {
  const [tab, setTab] = useState<AiPodcastTab>(initialTab);

  // Tab 1: AI PDF & Teleprompter
  const [pdfAnalyzing, setPdfAnalyzing] = useState(false);
  const [pdfSummary, setPdfSummary] = useState('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // Tab 2: AI Stage Graphics & Thumbnails
  const [graphicMode, setGraphicMode] = useState<
    'backdrop' | 'overlay' | 'thumbnail' | 'podcast-cover'
  >('backdrop');
  const [graphicPrompt, setGraphicPrompt] = useState(
    'Modern deep cobalt broadcast stage with crisp architectural light beams and subtle glass geometry'
  );
  const [graphicLoading, setGraphicLoading] = useState(false);
  const [graphicPreviewUrl, setGraphicPreviewUrl] = useState<string>('');
  const [graphicSpec, setGraphicSpec] = useState<AiGraphicSpec | null>(null);
  const [graphicError, setGraphicError] = useState<string | null>(null);

  // Tab 3: AI Video & Magic Clips
  const [clipsLoading, setClipsLoading] = useState(false);
  const [magicClips, setMagicClips] = useState<MagicClipSuggestion[]>([]);
  const [clipsError, setClipsError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Tab 4: Podcast RSS & WAV Hub
  const podcastSlug = 'gather-live';
  const [podcastShow, setPodcastShow] = useState<PodcastShowConfig | null>(null);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [showRssPreview, setShowRssPreview] = useState(false);
  const [rssXmlText, setRssXmlText] = useState('');
  const [copiedRss, setCopiedRss] = useState(false);

  // Audio-only Master Bus WAV recorder
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordElapsedSec, setRecordElapsedSec] = useState(0);
  const [recordedWavBlob, setRecordedWavBlob] = useState<Blob | null>(null);
  const [recordedWavUrl, setRecordedWavUrl] = useState<string>('');
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeSummary, setEpisodeSummary] = useState('');
  const [publishingEpisode, setPublishingEpisode] = useState(false);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const audioUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    setEpisodeTitle((prev) => prev || `${room.title} — Live Audio Edition`);
    setEpisodeSummary(
      (prev) =>
        prev ||
        `Recorded live in Gather Studio (${room.roomCode}) with uncompressed 16-bit PCM WAV mastering.`
    );
  }, [open, room.title, room.roomCode]);

  const fetchPodcastShow = async () => {
    setPodcastLoading(true);
    try {
      const res = await fetch(`/api/podcast/${podcastSlug}`);
      if (res.ok) {
        const data = (await res.json()) as PodcastShowConfig;
        setPodcastShow(data);
      }
    } catch {
      // ignore transient error
    } finally {
      setPodcastLoading(false);
    }
  };

  useEffect(() => {
    if (open && tab === 'podcast') {
      void fetchPodcastShow();
    }
  }, [open, tab]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (recordedWavUrl) URL.revokeObjectURL(recordedWavUrl);
    };
  }, [recordedWavUrl]);

  if (!open) return null;

  const rssUrl = `${window.location.origin}/api/podcast/${podcastSlug}/rss.xml`;

  // --- Handlers: Tab 1 (AI PDF & Slide Analyzer) ---
  const handleAnalyzeActivePdf = async () => {
    if (!activeMedia || activeMedia.kind !== 'pdf') {
      setPdfError('Upload a PDF slide deck first to generate talking points and teleprompter cues.');
      return;
    }
    setPdfAnalyzing(true);
    setPdfError(null);
    try {
      const slidesPayload =
        activeMedia.slideTexts && activeMedia.slideTexts.length > 0
          ? activeMedia.slideTexts.map((text, idx) => ({
              pageNumber: idx + 1,
              text: text || `Slide ${idx + 1} of ${activeMedia.name}`,
            }))
          : Array.from({ length: activeMedia.totalPages }, (_, idx) => ({
              pageNumber: idx + 1,
              text: `Slide ${idx + 1} from presentation ${activeMedia.name}`,
            }));

      const res = await fetch('/api/ai/pdf-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckName: activeMedia.name,
          showTitle: room.title,
          slides: slidesPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze PDF deck');
      }
      const cues = (data.cues || []) as SlideAiCue[];
      const combinedScript =
        String(data.fullTeleprompterScript || '').trim() ||
        cues.map((c) => `[Slide ${c.pageNumber}: ${c.slideTitle}]\n${c.teleprompterScript}`).join('\n\n');

      setPdfSummary(String(data.executiveSummary || ''));
      onAttachSlideCues(cues, combinedScript);
      onToast(`Analyzed ${cues.length} slides and synced Eye-Line Teleprompter.`);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'PDF analysis failed.');
    } finally {
      setPdfAnalyzing(false);
    }
  };

  // --- Handlers: Tab 2 (AI Stage Graphics) ---
  const handleGenerateGraphic = async () => {
    if (!graphicPrompt.trim()) return;
    setGraphicLoading(true);
    setGraphicError(null);
    try {
      const res = await fetch('/api/ai/stage-graphic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: graphicPrompt.trim(),
          mode: graphicMode,
          showTitle: room.title,
          brandAccent: room.brand.accent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate stage graphic');
      }
      const spec = data as AiGraphicSpec;
      const pngDataUrl = renderAiGraphicToDataUrl(spec, graphicMode);
      setGraphicSpec(spec);
      setGraphicPreviewUrl(pngDataUrl);
    } catch (err) {
      setGraphicError(err instanceof Error ? err.message : 'Graphic generation failed.');
    } finally {
      setGraphicLoading(false);
    }
  };

  const handleApplyGraphic = async () => {
    if (!graphicPreviewUrl) return;
    if (graphicMode === 'backdrop' || graphicMode === 'thumbnail') {
      onApplyBackdropUrl(graphicPreviewUrl);
      onToast('Applied AI backdrop to broadcast stage.');
    } else if (graphicMode === 'overlay') {
      onApplyOverlayUrl(graphicPreviewUrl);
      onToast('Applied AI transparent frame overlay to stage.');
    } else if (graphicMode === 'podcast-cover') {
      await fetch(`/api/podcast/${podcastSlug}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverArtUrl: graphicPreviewUrl }),
      });
      await fetchPodcastShow();
      onToast('Updated Podcast RSS 1400×1400 cover art.');
    }
  };

  const handleDownloadGraphic = () => {
    if (!graphicPreviewUrl) return;
    const a = document.createElement('a');
    a.href = graphicPreviewUrl;
    a.download = `gather-${graphicMode}-${Date.now()}.png`;
    a.click();
  };

  // --- Handlers: Tab 3 (AI Video & Magic Clips) ---
  const handleDetectMagicClips = async () => {
    setClipsLoading(true);
    setClipsError(null);
    try {
      const elapsedSec = room.liveStartedAt
        ? Math.max(60, Math.floor((Date.now() - room.liveStartedAt) / 1000))
        : 420;
      const res = await fetch('/api/ai/magic-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showTitle: room.title,
          videoName: activeMedia?.kind === 'video' ? activeMedia.name : undefined,
          elapsedSec,
          chatHighlights: room.chatMessages.slice(-16).map((m) => `${m.author}: ${m.text}`),
          rundownSteps: room.rundown.steps.map((s) => s.title),
          existingClips: room.gamer.clips.map((c) => `${c.label} @ ${c.timestampSec}s`),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to detect magic clips');
      }
      setMagicClips((data.clips || []) as MagicClipSuggestion[]);
    } catch (err) {
      setClipsError(err instanceof Error ? err.message : 'Magic Clips detection failed.');
    } finally {
      setClipsLoading(false);
    }
  };

  // --- Handlers: Tab 4 (Podcast Master Bus WAV & RSS) ---
  const startAudioRecording = async () => {
    try {
      const masterStream = audioEngine.getMasterStream();
      let targetStream: MediaStream | null = null;
      if (masterStream && masterStream.getAudioTracks().length > 0) {
        targetStream = new MediaStream(masterStream.getAudioTracks());
      } else if (localStream && localStream.getAudioTracks().length > 0) {
        targetStream = new MediaStream(localStream.getAudioTracks());
      } else {
        targetStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      audioChunksRef.current = [];
      const rec = new MediaRecorder(targetStream);
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setIsRecordingAudio(false);
        try {
          const rawBlob = new Blob(audioChunksRef.current, {
            type: rec.mimeType || 'audio/webm',
          });
          const { wavBlob, durationSec } = await convertBlobToWav(rawBlob);
          if (recordedWavUrl) URL.revokeObjectURL(recordedWavUrl);
          const nextUrl = URL.createObjectURL(wavBlob);
          setRecordedWavBlob(wavBlob);
          setRecordedWavUrl(nextUrl);
          setRecordedDurationSec(durationSec);
          onToast(`Mastered ${durationSec}s 16-bit PCM WAV episode.`);
        } catch {
          onToast('Unable to decode recorded audio.');
        }
      };

      rec.start(250);
      audioRecorderRef.current = rec;
      setRecordElapsedSec(0);
      setIsRecordingAudio(true);
      recordTimerRef.current = window.setInterval(() => {
        setRecordElapsedSec((s) => s + 1);
      }, 1000);
    } catch {
      onToast('Microphone or Master Bus audio stream unavailable.');
    }
  };

  const stopAudioRecording = () => {
    const rec = audioRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
  };

  const handleAudioFileUpload = async (file: File) => {
    try {
      const { wavBlob, durationSec } = await convertBlobToWav(file);
      if (recordedWavUrl) URL.revokeObjectURL(recordedWavUrl);
      const nextUrl = URL.createObjectURL(wavBlob);
      setRecordedWavBlob(wavBlob);
      setRecordedWavUrl(nextUrl);
      setRecordedDurationSec(durationSec);
      setEpisodeTitle(file.name.replace(/\.[^.]+$/, ''));
      onToast(`Converted "${file.name}" to broadcast 16-bit PCM WAV.`);
    } catch {
      onToast('Could not transcode uploaded audio file.');
    }
  };

  const handleSynthesizeTestWav = () => {
    const wavBlob = synthesizeSamplePodcastEpisodeWav(8);
    if (recordedWavUrl) URL.revokeObjectURL(recordedWavUrl);
    const nextUrl = URL.createObjectURL(wavBlob);
    setRecordedWavBlob(wavBlob);
    setRecordedWavUrl(nextUrl);
    setRecordedDurationSec(8);
    onToast('Generated 8s stereo WAV studio check clip.');
  };

  const handleDownloadWav = () => {
    if (!recordedWavUrl) return;
    const a = document.createElement('a');
    a.href = recordedWavUrl;
    a.download = `${(episodeTitle || 'gather-episode').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wav`;
    a.click();
  };

  const handlePublishEpisodeToRss = async () => {
    const blobToPublish = recordedWavBlob || synthesizeSamplePodcastEpisodeWav(8);
    const dur = recordedWavBlob ? recordedDurationSec : 8;
    setPublishingEpisode(true);
    try {
      const audioBase64 = await blobToBase64(blobToPublish);
      const res = await fetch(`/api/podcast/${podcastSlug}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: episodeTitle.trim() || `${room.title} — Live Episode`,
          summary:
            episodeSummary.trim() ||
            `Recorded live in Gather Studio (${room.roomCode}) and distributed via Gather RSS.`,
          durationSec: dur,
          audioBase64,
        }),
      });
      if (!res.ok) throw new Error('Publish failed');
      await fetchPodcastShow();
      onToast('Published WAV episode to live Gather Podcast RSS feed!');
    } catch {
      onToast('Failed to publish episode to RSS feed.');
    } finally {
      setPublishingEpisode(false);
    }
  };

  const handleToggleDirectory = async (platform: PodcastDirectoryStatus['platform']) => {
    if (!podcastShow) return;
    const nextDirs = podcastShow.directories.map((d) =>
      d.platform === platform ? { ...d, connected: !d.connected } : d
    );
    const res = await fetch(`/api/podcast/${podcastSlug}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directories: nextDirs }),
    });
    if (res.ok) {
      const updated = (await res.json()) as PodcastShowConfig;
      setPodcastShow(updated);
      const target = updated.directories.find((d) => d.platform === platform);
      onToast(
        `${DIRECTORY_LABELS[platform].name} ${
          target?.connected ? 'connected to auto-sync RSS' : 'paused'
        }.`
      );
    }
  };

  const handleLoadRssXml = async () => {
    if (showRssPreview) {
      setShowRssPreview(false);
      return;
    }
    const res = await fetch(`/api/podcast/${podcastSlug}/rss.xml`);
    const xml = await res.text();
    setRssXmlText(xml);
    setShowRssPreview(true);
  };

  const secondaryBtnCls =
    'h-8 px-3 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[11.5px] font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors';

  const primaryBtnCls =
    'h-8 px-3.5 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45';

  const inputCls =
    'h-9 rounded-[9px] bg-[var(--fill)] border border-[var(--line-2)] px-3 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/68 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[94%] max-w-[920px] max-h-[88vh] flex flex-col rounded-[18px] gather-glass-elevated animate-gather-modal overflow-hidden"
      >
        {/* Header — unified with Gather v5 Modals */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[var(--line)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <GatherLogo size={22} />
            <div className="min-w-0">
              <h2 className="font-display text-[15px] font-bold tracking-tight text-[var(--ink)] truncate">
                AI Media Studio &amp; Podcast Hub
              </h2>
              <p className="text-[11px] text-[var(--ink-3)] truncate">
                Slide decks, eye-line prompter, 1080p stage graphics, clips, and hosted WAV RSS feeds
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors cursor-pointer shrink-0"
            aria-label="Close AI Media Studio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Navigation — native .gather-seg control */}
        <div className="px-5 py-2.5 border-b border-[var(--line)] bg-[var(--fill)] flex items-center justify-between gap-3 overflow-x-auto gather-scroll shrink-0">
          <div className="gather-seg" role="tablist" aria-label="AI Media tools">
            {(
              [
                { id: 'pdf', label: 'AI PDF & Prompter', icon: FileText },
                { id: 'graphics', label: 'Stage Graphics', icon: ImageIcon },
                { id: 'clips', label: 'Magic Clips', icon: Scissors },
                { id: 'podcast', label: 'Podcast RSS & WAV', icon: Rss },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`gather-seg-btn ${active ? 'active' : ''}`}
                >
                  <Icon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 gather-scroll">
          {/* TAB 1: AI PDF & TELEPROMPTER */}
          {tab === 'pdf' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)]">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[13.5px] font-bold text-[var(--ink)]">
                    {activeMedia?.kind === 'pdf'
                      ? `${activeMedia.name} · ${activeMedia.totalPages} slides on stage`
                      : 'PDF Slide Deck & Teleprompter Sync'}
                  </div>
                  <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5 leading-relaxed">
                    Extract slide talking points, lower-thirds, and a voice-synced Eye-Line Prompter script in one click.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadMediaFile(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className={secondaryBtnCls}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{activeMedia?.kind === 'pdf' ? 'Replace PDF' : 'Upload PDF'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={pdfAnalyzing || activeMedia?.kind !== 'pdf'}
                    onClick={() => void handleAnalyzeActivePdf()}
                    className={primaryBtnCls}
                  >
                    {pdfAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{pdfAnalyzing ? 'Analyzing…' : 'Generate Talking Points'}</span>
                  </button>
                </div>
              </div>

              {pdfError && (
                <div className="p-3 rounded-[10px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[12px] text-[var(--danger)]">
                  {pdfError}
                </div>
              )}

              {pdfSummary && (
                <div className="p-4 rounded-[12px] bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-[12px] font-bold text-[var(--ink)]">
                      Executive Deck Brief
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const script =
                          activeMedia?.slideCues
                            ?.map(
                              (c) =>
                                `[Slide ${c.pageNumber}: ${c.slideTitle}]\n${c.teleprompterScript}`
                            )
                            .join('\n\n') || pdfSummary;
                        onOpenTeleprompterWithScript(script);
                        onClose();
                      }}
                      className="h-7 px-3 rounded-[7px] gather-btn-tip text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Mic className="w-3 h-3" />
                      <span>Launch Voice-Synced Prompter</span>
                    </button>
                  </div>
                  <p className="text-[12px] text-[var(--ink-2)] leading-relaxed">{pdfSummary}</p>
                </div>
              )}

              {activeMedia?.kind === 'pdf' && activeMedia.slideCues && activeMedia.slideCues.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeMedia.slideCues.map((cue) => (
                    <div
                      key={cue.pageNumber}
                      className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono-num font-semibold text-[var(--cyan)]">
                            Slide {cue.pageNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelectSlide(cue.pageNumber - 1)}
                            className="text-[11px] font-semibold text-[var(--accent-text)] hover:text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Show on Stage →
                          </button>
                        </div>
                        <h4 className="font-display text-[13.5px] font-semibold text-[var(--ink)]">
                          {cue.slideTitle}
                        </h4>
                        <ul className="space-y-1 text-[11.5px] text-[var(--ink-2)]">
                          {cue.talkingPoints.map((pt, i) => (
                            <li key={i}>· {pt}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-[var(--line)]">
                        <button
                          type="button"
                          onClick={() =>
                            onPushBanner(cue.suggestedBannerTitle, cue.suggestedBannerSub)
                          }
                          className="h-7 px-2.5 rounded-[7px] bg-[var(--surface)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Tv className="w-3 h-3" />
                          <span>Push Banner</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenTeleprompterWithScript(cue.teleprompterScript);
                            onClose();
                          }}
                          className="h-7 px-2.5 rounded-[7px] bg-[var(--surface)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Mic className="w-3 h-3" />
                          <span>Send to Prompter</span>
                        </button>
                        {cue.suggestedPollQuestion && (
                          <button
                            type="button"
                            onClick={() =>
                              onLaunchPoll(cue.suggestedPollQuestion!, [
                                'Strongly Agree',
                                'Curious to Try',
                                'Tell Me More',
                              ])
                            }
                            className="h-7 px-2.5 rounded-[7px] bg-[var(--surface)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Launch Poll
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 px-4 rounded-[12px] bg-[var(--surface)]/50 border border-[var(--line)] text-center space-y-2.5">
                  <FileText className="w-6 h-6 mx-auto text-[var(--accent-text)] opacity-85" />
                  <p className="font-display text-[13px] font-semibold text-[var(--ink)]">
                    {activeMedia?.kind === 'pdf'
                      ? 'Deck ready — generate AI talking points'
                      : 'Ready for your slide deck or live script'}
                  </p>
                  <p className="text-[11.5px] text-[var(--ink-3)] max-w-md mx-auto leading-relaxed">
                    {activeMedia?.kind === 'pdf'
                      ? 'Click Generate Talking Points above to turn your slides into lower-third cues and a teleprompter script.'
                      : 'Upload any PDF deck above to extract talking points, or launch the Eye-Line Prompter directly.'}
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenTeleprompterWithScript('');
                        onClose();
                      }}
                      className={secondaryBtnCls}
                    >
                      <Mic className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>Open Eye-Line Prompter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI STAGE GRAPHICS, BACKDROPS & THUMBNAILS */}
          {tab === 'graphics' && (
            <div className="space-y-4">
              <div className="gather-seg flex-wrap" role="tablist" aria-label="Graphic type">
                {(
                  [
                    { id: 'backdrop', label: '16:9 Stage Backdrop' },
                    { id: 'overlay', label: 'Transparent Frame PNG' },
                    { id: 'thumbnail', label: 'Stream Thumbnail' },
                    { id: 'podcast-cover', label: '1400² Podcast Cover' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={graphicMode === m.id}
                    onClick={() => setGraphicMode(m.id)}
                    className={`gather-seg-btn ${graphicMode === m.id ? 'active' : ''}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={graphicPrompt}
                  onChange={(e) => setGraphicPrompt(e.target.value)}
                  placeholder="Describe your stage backdrop, transparent overlay, or thumbnail..."
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  disabled={graphicLoading}
                  onClick={() => void handleGenerateGraphic()}
                  className={`${primaryBtnCls} h-9`}
                >
                  {graphicLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{graphicLoading ? 'Designing…' : 'Generate HD Asset'}</span>
                </button>
              </div>

              {graphicError && (
                <div className="p-3 rounded-[10px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[12px] text-[var(--danger)]">
                  {graphicError}
                </div>
              )}

              {graphicPreviewUrl ? (
                <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[12px] text-[var(--ink-2)]">
                      <span className="font-semibold text-[var(--ink)]">
                        {graphicSpec?.themeName || 'Custom Broadcast Graphic'}
                      </span>{' '}
                      ·{' '}
                      <span className="font-mono-num">
                        {graphicMode === 'podcast-cover' ? '1400×1400 PNG' : '1920×1080 HD PNG'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadGraphic}
                        className={secondaryBtnCls}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleApplyGraphic()}
                        className="h-8 px-3.5 rounded-[8px] gather-btn-tip text-[11.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {graphicMode === 'podcast-cover'
                            ? 'Set as Podcast Cover'
                            : graphicMode === 'overlay'
                              ? 'Apply Frame Overlay'
                              : 'Apply to Stage'}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div className="rounded-[10px] overflow-hidden border border-[var(--line)] bg-[var(--bg)] flex items-center justify-center max-h-72">
                    <img
                      src={graphicPreviewUrl}
                      alt="Generated broadcast graphic preview"
                      className="max-h-72 w-auto object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="py-8 px-4 rounded-[12px] bg-[var(--surface)]/50 border border-[var(--line)] text-center space-y-2">
                  <ImageIcon className="w-6 h-6 mx-auto text-[var(--accent-text)] opacity-85" />
                  <p className="font-display text-[13px] font-semibold text-[var(--ink)]">
                    Render 1080p stage graphics &amp; show artwork
                  </p>
                  <p className="text-[11.5px] text-[var(--ink-3)] max-w-md mx-auto leading-relaxed">
                    Describe your show aesthetic above to generate custom stage backdrops, transparent PNG camera frames, thumbnails, or podcast covers.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI VIDEO & MAGIC CLIPS */}
          {tab === 'clips' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)]">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[13.5px] font-bold text-[var(--ink)]">
                    Viral Moment Detector &amp; Video Stage Deck
                  </div>
                  <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5 leading-relaxed">
                    Drop MP4/WebM clips onto stage or scan live chat spikes and rundown beats for 9:16 &amp; 16:9 highlights.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadMediaFile(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className={secondaryBtnCls}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Load Video</span>
                  </button>
                  <button
                    type="button"
                    disabled={clipsLoading}
                    onClick={() => void handleDetectMagicClips()}
                    className={primaryBtnCls}
                  >
                    {clipsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{clipsLoading ? 'Scanning…' : 'Find Magic Clips'}</span>
                  </button>
                </div>
              </div>

              {clipsError && (
                <div className="p-3 rounded-[10px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[12px] text-[var(--danger)]">
                  {clipsError}
                </div>
              )}

              {magicClips.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {magicClips.map((clip) => (
                    <div
                      key={clip.id}
                      className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)] font-mono-num">
                          <span>
                            {formatSec(clip.startSec)} – {formatSec(clip.endSec)} · {clip.aspect}
                          </span>
                          <span>{clip.category}</span>
                        </div>
                        <h4 className="font-display text-[13.5px] font-semibold text-[var(--ink)]">
                          {clip.title}
                        </h4>
                        <p className="text-[12px] font-medium text-[var(--cyan)]">
                          “{clip.hookCaption}”
                        </p>
                        <p className="text-[11.5px] text-[var(--ink-3)]">{clip.viralityReason}</p>
                      </div>
                      <div className="flex items-center gap-2 pt-2.5 border-t border-[var(--line)]">
                        <button
                          type="button"
                          onClick={() => {
                            onCreateClipMarker(clip.title, clip.startSec);
                            onExportReplayClip();
                          }}
                          className={primaryBtnCls}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Save 30s Replay</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPushBanner(clip.title, clip.hookCaption)}
                          className={secondaryBtnCls}
                        >
                          <Tv className="w-3.5 h-3.5" />
                          <span>Headline on Stage</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 px-4 rounded-[12px] bg-[var(--surface)]/50 border border-[var(--line)] text-center space-y-2">
                  <Scissors className="w-6 h-6 mx-auto text-[var(--accent-text)] opacity-85" />
                  <p className="font-display text-[13px] font-semibold text-[var(--ink)]">
                    Extract Reels, Shorts &amp; TikTok highlights
                  </p>
                  <p className="text-[11.5px] text-[var(--ink-3)] max-w-md mx-auto leading-relaxed">
                    Click Find Magic Clips to turn your live chat spikes and rundown markers into ready-to-post replay clips.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PODCAST RSS & WAV HUB */}
          {tab === 'podcast' && (
            <div className="space-y-4">
              {/* Hosted RSS 2.0 Feed Bar */}
              <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-[13.5px] font-bold text-[var(--ink)]">
                      Hosted Gather Podcast RSS 2.0 Feed
                    </div>
                    <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                      Paste once into Spotify, Apple Podcasts, or Amazon Music — every published WAV episode syncs automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleLoadRssXml()}
                      className={secondaryBtnCls}
                    >
                      {showRssPreview ? 'Hide XML' : 'Inspect XML'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(rssUrl);
                        setCopiedRss(true);
                        onToast('Copied live Podcast RSS URL to clipboard.');
                        window.setTimeout(() => setCopiedRss(false), 1800);
                      }}
                      className={primaryBtnCls}
                    >
                      {copiedRss ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRss ? 'Copied URL' : 'Copy RSS URL'}</span>
                    </button>
                  </div>
                </div>

                <div className="px-3 py-2 rounded-[8px] bg-[var(--bg)]/65 border border-[var(--line)] font-mono-num text-[11.5px] text-[var(--ink-2)] select-all truncate">
                  {rssUrl}
                </div>

                {showRssPreview && rssXmlText && (
                  <pre className="max-h-40 overflow-auto p-3 rounded-[9px] bg-[var(--bg)] text-[var(--ink-2)] text-[11px] font-mono-num border border-[var(--line)] gather-scroll">
                    {rssXmlText}
                  </pre>
                )}
              </div>

              {/* 1-Click Podcast Platform Auto-Sync Connectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(podcastShow?.directories || []).map((dir) => {
                  const meta = DIRECTORY_LABELS[dir.platform];
                  return (
                    <div
                      key={dir.platform}
                      className="flex items-center justify-between gap-3 p-3 rounded-[11px] bg-[var(--fill)] border border-[var(--line)]"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[var(--ink)] truncate">
                          {meta.name}
                        </div>
                        <div className="text-[11px] text-[var(--ink-3)] truncate">
                          {dir.connected ? 'Auto-sync active on publish' : meta.subtitle}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleDirectory(dir.platform)}
                        className={`h-7 px-2.5 rounded-[7px] text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          dir.connected
                            ? 'bg-[var(--ok)]/16 text-[var(--ok)] border border-[var(--ok)]/35'
                            : 'bg-[var(--surface)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {dir.connected ? 'Connected' : 'Connect'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Audio-Only Master Bus Recorder & Publisher */}
              <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-[13.5px] font-bold text-[var(--ink)]">
                      Master Audio Bus Recorder (16-Bit PCM WAV)
                    </div>
                    <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                      Captures host + guest audio directly with zero video overhead.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <input
                      ref={audioUploadRef}
                      type="file"
                      accept="audio/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleAudioFileUpload(f);
                        e.currentTarget.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => audioUploadRef.current?.click()}
                      className={secondaryBtnCls}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Audio</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSynthesizeTestWav}
                      className={secondaryBtnCls}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Sample WAV</span>
                    </button>
                    {isRecordingAudio ? (
                      <button
                        type="button"
                        onClick={stopAudioRecording}
                        className="h-8 px-3.5 rounded-[8px] gather-btn-live text-[11.5px] font-semibold font-mono-num inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Stop WAV ({formatSec(recordElapsedSec)})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startAudioRecording()}
                        className={primaryBtnCls}
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Record Audio</span>
                      </button>
                    )}
                  </div>
                </div>

                {recordedWavUrl && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[10px] bg-[var(--surface)] border border-[var(--line)]">
                    <audio controls src={recordedWavUrl} className="h-8 flex-1 min-w-[220px]" />
                    <button
                      type="button"
                      onClick={handleDownloadWav}
                      className={secondaryBtnCls}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export .WAV ({formatSec(recordedDurationSec)})</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={episodeTitle}
                    onChange={(e) => setEpisodeTitle(e.target.value)}
                    placeholder="Episode title..."
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={episodeSummary}
                    onChange={(e) => setEpisodeSummary(e.target.value)}
                    placeholder="Show notes & summary for Spotify / Apple..."
                    className={inputCls}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={publishingEpisode}
                    onClick={() => void handlePublishEpisodeToRss()}
                    className="h-8 px-3.5 rounded-[8px] gather-btn-tip text-[11.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
                  >
                    {publishingEpisode ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Rss className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {publishingEpisode
                        ? 'Publishing to RSS…'
                        : 'Publish Episode to Spotify & Apple RSS'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Published Episodes Feed */}
              <div className="space-y-2">
                <div className="text-[11.5px] font-semibold text-[var(--ink-2)] font-mono-num">
                  Published RSS Episodes ({podcastLoading ? '…' : podcastShow?.episodes.length || 0})
                </div>
                {(podcastShow?.episodes || []).map((ep) => (
                  <div
                    key={ep.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[10px] bg-[var(--fill)] border border-[var(--line)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-[var(--ink)] truncate">
                        {ep.title}
                      </div>
                      <div className="text-[11px] text-[var(--ink-3)] font-mono-num">
                        {formatSec(ep.durationSec)} · {(ep.fileSizeBytes / 1024).toFixed(0)} KB WAV ·{' '}
                        {new Date(ep.publishedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <audio controls src={ep.audioUrl} className="h-8 w-56 max-w-full" />
                    <a
                      href={ep.audioUrl}
                      download={`${ep.id}.wav`}
                      className={secondaryBtnCls}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>WAV</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
