import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
  Upload,
  X,
} from 'lucide-react';
import { BACKDROP_PRESETS } from '../constants/studioDefaults';
import {
  CustomStageElement,
  MediaAsset,
  Participant,
  ProductItem,
  RoomState,
  VideoFxSettings,
} from '../types/studio';

interface StageCanvasProps {
  room: RoomState;
  localClientId: string;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  activeMedia: MediaAsset | null;
  videoFx: VideoFxSettings;
  editMode: boolean;
  viewerMode?: boolean;
  showSafeZone916?: boolean;
  onExitEditMode: () => void;
  onUpdateCustomElements: (els: CustomStageElement[]) => void;
  onResetCustomElements?: () => void;
  onDropMediaFile: (file: File) => void;
  onMediaPageChange: (delta: number) => void;
  onStopMedia: () => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  mirror = false
) {
  if (!sw || !sh) return;
  const scale = Math.max(dw / sw, dh / sh);
  const cw = dw / scale;
  const ch = dh / scale;
  const sx = (sw - cw) / 2;
  const sy = (sh - ch) / 2;

  ctx.save();
  if (mirror) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(source, sx, sy, cw, ch, 0, 0, dw, dh);
  } else {
    ctx.drawImage(source, sx, sy, cw, ch, dx, dy, dw, dh);
  }
  ctx.restore();
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  if (!sw || !sh) return;
  const scale = Math.min(dw / sw, dh / sh);
  const rw = sw * scale;
  const rh = sh * scale;
  const rx = dx + (dw - rw) / 2;
  const ry = dy + (dh - rh) / 2;
  ctx.drawImage(source, 0, 0, sw, sh, rx, ry, rw, rh);
}

export const StageCanvas: React.FC<StageCanvasProps> = ({
  room,
  localClientId,
  localStream,
  screenStream,
  remoteStreams,
  activeMedia,
  videoFx,
  editMode,
  viewerMode = false,
  showSafeZone916 = false,
  onExitEditMode,
  onUpdateCustomElements,
  onResetCustomElements,
  onDropMediaFile,
  onMediaPageChange,
  onStopMedia,
  onCanvasReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevSnapshotRef = useRef<HTMLCanvasElement | null>(null);
  const transitionStartRef = useRef<number>(0);
  const lastTemplateRef = useRef<string>(room.scene.templateId);

  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const productImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const avatarImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const qrImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const logoImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const bgImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const overlayImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const [vidPlaying, setVidPlaying] = useState(true);
  const [vidLoop, setVidLoop] = useState(false);
  const [vidProgress, setVidProgress] = useState(0);
  const [vidTimeStr, setVidTimeStr] = useState('00:00 / 00:00');
  const [dragTarget, setDragTarget] = useState<{
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    orig: CustomStageElement;
  } | null>(null);

  const isVertical = room.aspectRatio === '9:16';
  const stageW = isVertical ? 720 : 1280;
  const stageH = isVertical ? 1280 : 720;

  // Provide canvas reference to parent for MediaRecorder & WebRTC capture
  useEffect(() => {
    if (canvasRef.current) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  // Trigger dual-buffer transition whenever scene template changes
  useEffect(() => {
    if (lastTemplateRef.current !== room.scene.templateId && canvasRef.current) {
      if (room.scene.transitionType !== 'cut') {
        const snap = document.createElement('canvas');
        snap.width = canvasRef.current.width;
        snap.height = canvasRef.current.height;
        const sctx = snap.getContext('2d');
        if (sctx) {
          sctx.drawImage(canvasRef.current, 0, 0);
          prevSnapshotRef.current = snap;
          transitionStartRef.current = performance.now();
        }
      }
      lastTemplateRef.current = room.scene.templateId;
    }
  }, [room.scene.templateId, room.scene.transitionType]);

  // Sync hidden video elements for local, remote, and screen streams
  useEffect(() => {
    const map = videoElementsRef.current;

    const ensureVideo = (id: string, stream: MediaStream | null) => {
      if (!stream || stream.getVideoTracks().length === 0) {
        map.delete(id);
        return;
      }
      let vid = map.get(id);
      if (!vid) {
        vid = document.createElement('video');
        vid.autoplay = true;
        vid.muted = true;
        vid.playsInline = true;
        map.set(id, vid);
      }
      if (vid.srcObject !== stream) {
        vid.srcObject = stream;
        void vid.play().catch(() => {});
      }
    };

    ensureVideo(localClientId, localStream);
    for (const [peerId, stream] of Object.entries(remoteStreams)) {
      ensureVideo(peerId, stream);
    }

    if (screenStream && screenStream.getVideoTracks().length > 0) {
      if (!screenVideoRef.current) {
        screenVideoRef.current = document.createElement('video');
        screenVideoRef.current.autoplay = true;
        screenVideoRef.current.muted = true;
        screenVideoRef.current.playsInline = true;
      }
      if (screenVideoRef.current.srcObject !== screenStream) {
        screenVideoRef.current.srcObject = screenStream;
        void screenVideoRef.current.play().catch(() => {});
      }
    } else {
      screenVideoRef.current = null;
    }
  }, [localClientId, localStream, remoteStreams, screenStream]);

  // Generate QR code for Watch Page URL when pinned product changes
  useEffect(() => {
    const watchUrl = `${window.location.origin}/?watch=${room.roomCode}`;
    if (qrImgRef.current?.url === watchUrl) return;
    void QRCode.toDataURL(watchUrl, {
      width: 140,
      margin: 1,
      color: { dark: '#080c16', light: '#ffffff' },
    }).then((dataUrl) => {
      const img = new Image();
      img.src = dataUrl;
      qrImgRef.current = { url: watchUrl, img };
    });
  }, [room.roomCode]);

  // Sync video media playback timeline
  useEffect(() => {
    if (!activeMedia || activeMedia.kind !== 'video' || !activeMedia.videoEl) return;
    const vid = activeMedia.videoEl;
    const onTime = () => {
      if (!vid.duration) return;
      setVidProgress(vid.currentTime / vid.duration);
      const fmt = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      setVidTimeStr(`${fmt(vid.currentTime)} / ${fmt(vid.duration)}`);
    };
    vid.addEventListener('timeupdate', onTime);
    return () => vid.removeEventListener('timeupdate', onTime);
  }, [activeMedia]);

  // Main 30fps compositor loop
  useEffect(() => {
    let rafId = 0;
    const startTs = performance.now();

    const getProductImg = (prod: ProductItem): HTMLImageElement | null => {
      const cached = productImgCacheRef.current.get(prod.imageUrl);
      if (cached) return cached;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = prod.imageUrl;
      productImgCacheRef.current.set(prod.imageUrl, img);
      return img;
    };

    const getAvatarImg = (url: string): HTMLImageElement | null => {
      const cached = avatarImgCacheRef.current.get(url);
      if (cached) return cached;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      avatarImgCacheRef.current.set(url, img);
      return img;
    };

    const drawParticipantTile = (
      ctx: CanvasRenderingContext2D,
      p: Participant,
      rect: Rect,
      accent: string,
      showNames: boolean
    ) => {
      const pad = 6;
      const rx = rect.x + pad;
      const ry = rect.y + pad;
      const rw = Math.max(40, rect.w - pad * 2);
      const rh = Math.max(40, rect.h - pad * 2);

      ctx.save();
      drawRoundedRect(ctx, rx, ry, rw, rh, 14);
      ctx.clip();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(rx, ry, rw, rh);

      const vid = videoElementsRef.current.get(p.id);
      const hasLiveVideo =
        p.camOn && vid && vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0;

      if (hasLiveVideo && vid) {
        if (p.id === localClientId) {
          ctx.filter = `brightness(${videoFx.brightness}%) contrast(${videoFx.contrast}%) saturate(${videoFx.saturation}%)`;
        }
        drawImageCover(
          ctx,
          vid,
          vid.videoWidth,
          vid.videoHeight,
          rx,
          ry,
          rw,
          rh,
          p.id === localClientId && videoFx.mirror
        );
        ctx.filter = 'none';
        if (p.id === localClientId && (videoFx.bgMode === 'blur' || videoFx.bgMode === 'dim' || videoFx.blurBg)) {
          const edge = ctx.createRadialGradient(
            rx + rw / 2,
            ry + rh / 2,
            Math.min(rw, rh) * 0.28,
            rx + rw / 2,
            ry + rh / 2,
            Math.max(rw, rh) * 0.65
          );
          edge.addColorStop(0, 'rgba(0,0,0,0)');
          edge.addColorStop(1, videoFx.bgMode === 'dim' ? 'rgba(6,10,22,0.72)' : 'rgba(10,16,32,0.52)');
          ctx.fillStyle = edge;
          ctx.fillRect(rx, ry, rw, rh);
        }
      } else if (p.avatarUrl) {
        const av = getAvatarImg(p.avatarUrl);
        if (av && av.complete && av.naturalWidth > 0) {
          drawImageCover(ctx, av, av.naturalWidth, av.naturalHeight, rx, ry, rw, rh, false);
          const scrim = ctx.createLinearGradient(rx, ry + rh * 0.5, rx, ry + rh);
          scrim.addColorStop(0, 'rgba(8, 12, 22, 0)');
          scrim.addColorStop(1, 'rgba(8, 12, 22, 0.72)');
          ctx.fillStyle = scrim;
          ctx.fillRect(rx, ry, rw, rh);
        } else {
          const grad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
          grad.addColorStop(0, '#131d36');
          grad.addColorStop(1, '#0b1122');
          ctx.fillStyle = grad;
          ctx.fillRect(rx, ry, rw, rh);
        }
      } else {
        // Editorial dark slate tile with crisp monogram
        const grad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
        grad.addColorStop(0, '#131d36');
        grad.addColorStop(1, '#0b1122');
        ctx.fillStyle = grad;
        ctx.fillRect(rx, ry, rw, rh);

        const radius = Math.min(rw, rh) * 0.16;
        ctx.beginPath();
        ctx.arc(rx + rw / 2, ry + rh / 2 - 8, radius, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.max(18, Math.round(radius * 0.72))}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.initials, rx + rw / 2, ry + rh / 2 - 7);
      }

      // Subtle frame hairline
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, rx, ry, rw, rh, 14);
      ctx.stroke();

      // Nameplate (Gather v5 Name Tag Styles: glass | solid | outline | minimal)
      if (showNames) {
        const labelText = `${p.name}${!p.micOn ? ' · Muted' : ''}`;
        const tagStyle = room.brand.nameTagStyle || 'glass';
        ctx.font = '600 14px "DM Sans", sans-serif';
        const metrics = ctx.measureText(labelText);
        const bw = Math.min(rw - 24, metrics.width + 24);
        const bx = rx + 12;
        const by = ry + rh - 40;

        if (tagStyle === 'solid') {
          ctx.fillStyle = accent;
          drawRoundedRect(ctx, bx, by, bw, 28, 7);
          ctx.fill();
        } else if (tagStyle === 'outline') {
          ctx.fillStyle = 'rgba(6, 10, 22, 0.52)';
          drawRoundedRect(ctx, bx, by, bw, 28, 7);
          ctx.fill();
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.5;
          drawRoundedRect(ctx, bx, by, bw, 28, 7);
          ctx.stroke();
        } else if (tagStyle === 'minimal') {
          const scrim = ctx.createLinearGradient(bx - 6, by, bx + bw, by);
          scrim.addColorStop(0, 'rgba(6, 10, 22, 0.68)');
          scrim.addColorStop(1, 'rgba(6, 10, 22, 0)');
          ctx.fillStyle = scrim;
          drawRoundedRect(ctx, bx, by, bw + 12, 28, 6);
          ctx.fill();
        } else {
          // 'glass' default
          ctx.fillStyle = 'rgba(10, 17, 35, 0.76)';
          drawRoundedRect(ctx, bx, by, bw, 28, 8);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.lineWidth = 1;
          drawRoundedRect(ctx, bx, by, bw, 28, 8);
          ctx.stroke();
        }

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, bx + 11, by + 14.5, bw - 20);
      }

      ctx.restore();
    };

    const drawMediaSlot = (ctx: CanvasRenderingContext2D, rect: Rect) => {
      const rx = rect.x + 6;
      const ry = rect.y + 6;
      const rw = Math.max(60, rect.w - 12);
      const rh = Math.max(60, rect.h - 12);

      ctx.save();
      drawRoundedRect(ctx, rx, ry, rw, rh, 14);
      ctx.clip();
      ctx.fillStyle = '#070b14';
      ctx.fillRect(rx, ry, rw, rh);

      if (screenVideoRef.current && screenVideoRef.current.readyState >= 2) {
        const sv = screenVideoRef.current;
        drawImageContain(ctx, sv, sv.videoWidth, sv.videoHeight, rx, ry, rw, rh);
      } else if (activeMedia) {
        if (activeMedia.kind === 'pdf' && activeMedia.pages?.length) {
          const page = activeMedia.pages[activeMedia.currentPage - 1];
          if (page) {
            drawImageContain(ctx, page, page.width, page.height, rx, ry, rw, rh);
          }
        } else if (activeMedia.kind === 'video' && activeMedia.videoEl) {
          const v = activeMedia.videoEl;
          if (v.readyState >= 2) {
            drawImageContain(ctx, v, v.videoWidth, v.videoHeight, rx, ry, rw, rh);
          }
        } else if (activeMedia.kind === 'image' && activeMedia.imageEl) {
          const im = activeMedia.imageEl;
          if (im.complete && im.naturalWidth > 0) {
            drawImageContain(ctx, im, im.naturalWidth, im.naturalHeight, rx, ry, rw, rh);
          }
        }
      } else if (viewerMode) {
        const slateGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
        slateGrad.addColorStop(0, '#0d1528');
        slateGrad.addColorStop(1, '#12213f');
        ctx.fillStyle = slateGrad;
        ctx.fillRect(rx, ry, rw, rh);

        ctx.fillStyle = '#7fa8ff';
        ctx.font = '700 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const slateTag =
          room.watchMode === 'gamer'
            ? room.gamer.gameTitle.toUpperCase()
            : room.watchMode === 'shop'
            ? room.commerce.storeLabel.toUpperCase()
            : 'LIVE BROADCAST · GATHER STUDIO';
        ctx.fillText(slateTag, rx + rw / 2, ry + rh / 2 - 18, rw - 48);

        ctx.fillStyle = '#eef2f9';
        ctx.font = `700 24px "${room.brand.font}", sans-serif`;
        ctx.fillText(room.title || 'Live Broadcast', rx + rw / 2, ry + rh / 2 + 12, rw - 48);
      } else {
        ctx.fillStyle = '#11192e';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = '#8a97ae';
        ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Share your screen or drop PDF / Video / Image here', rx + rw / 2, ry + rh / 2);
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, rx, ry, rw, rh, 14);
      ctx.stroke();
      ctx.restore();
    };

    const renderSceneFrame = (ctx: CanvasRenderingContext2D, now: number) => {
      const w = stageW;
      const h = stageH;
      const preset = BACKDROP_PRESETS[room.brand.backdrop] || BACKDROP_PRESETS.dusk;
      const accent = room.brand.accent || '#2f6bf0';

      // 1. Backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, preset.gradient[0]);
      bgGrad.addColorStop(1, preset.gradient[1]);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      if (room.brand.customBackdropUrl) {
        if (bgImgRef.current?.url !== room.brand.customBackdropUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = room.brand.customBackdropUrl;
          bgImgRef.current = { url: room.brand.customBackdropUrl, img };
        }
        const bi = bgImgRef.current?.img;
        if (bi && bi.complete && bi.naturalWidth > 0) {
          drawImageCover(ctx, bi, bi.naturalWidth, bi.naturalHeight, 0, 0, w, h);
          ctx.fillStyle = `rgba(8, 12, 22, ${room.brand.backdropDim / 100})`;
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        // Subtle architectural studio grid lines
        ctx.strokeStyle = preset.gridTint;
        ctx.lineWidth = 1;
        for (let gx = 0; gx < w; gx += 80) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, h);
          ctx.stroke();
        }
        for (let gy = 0; gy < h; gy += 80) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
          ctx.stroke();
        }
      }

      // 2. Active Stage Participants & Scene Geometry
      const onStage = room.participants.filter((p) => p.onStage).slice(0, 6);
      const pad = 26;
      const area: Rect = { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 };
      const tpl = room.scene.templateId;
      const hasMedia = Boolean(screenVideoRef.current || activeMedia);

      if (room.scene.customElements.length > 0 && (tpl === 'custom' || tpl.startsWith('custom-'))) {
        for (const el of room.scene.customElements) {
          const rect = {
            x: el.x * w,
            y: el.y * h,
            w: el.w * w,
            h: el.h * h,
          };
          if (el.kind === 'media') {
            drawMediaSlot(ctx, rect);
          } else if (el.kind === 'participant') {
            const p = onStage.find((item) => item.id === el.participantId) || onStage[0];
            if (p) drawParticipantTile(ctx, p, rect, accent, room.brand.showNames);
          } else if (el.kind === 'block') {
            ctx.save();
            ctx.fillStyle = el.color || 'rgba(15, 23, 42, 0.85)';
            drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
            ctx.fill();
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
            ctx.stroke();
            ctx.restore();
          } else if (el.kind === 'text') {
            ctx.save();
            ctx.fillStyle = 'rgba(8, 12, 22, 0.82)';
            drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.14)';
            ctx.lineWidth = 1;
            drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
            ctx.stroke();
            ctx.fillStyle = '#f8fafc';
            ctx.font = `700 ${Math.max(16, Math.min(28, Math.round(rect.h * 0.36)))}px "${room.brand.font}", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.text || el.label, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 24);
            ctx.restore();
          } else if (el.kind === 'clock') {
            ctx.save();
            ctx.fillStyle = 'rgba(8, 12, 22, 0.86)';
            drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
            ctx.fill();
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
            ctx.stroke();
            const nowD = new Date();
            const clockStr = nowD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 ${Math.max(18, Math.min(34, Math.round(rect.h * 0.42)))}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(clockStr, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 20);
            ctx.restore();
          } else if (el.kind === 'qr' && qrImgRef.current?.img?.complete) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
            ctx.fill();
            const padQr = Math.min(rect.w, rect.h) * 0.1;
            const qrSize = Math.min(rect.w, rect.h) - padQr * 2;
            ctx.drawImage(qrImgRef.current.img, rect.x + (rect.w - qrSize) / 2, rect.y + (rect.h - qrSize) / 2, qrSize, qrSize);
            ctx.restore();
          }
        }
      } else if ((tpl === 'full-media' || (hasMedia && tpl === 'solo')) && !isVertical) {
        drawMediaSlot(ctx, area);
      } else if (tpl === 'screen-cam' || tpl === 'slides-cam') {
        const mediaW = area.w * 0.72;
        drawMediaSlot(ctx, { x: area.x, y: area.y, w: mediaW, h: area.h });
        const sideW = area.w - mediaW;
        const count = Math.max(1, Math.min(3, onStage.length));
        const tileH = area.h / count;
        onStage.slice(0, count).forEach((p, idx) => {
          drawParticipantTile(
            ctx,
            p,
            { x: area.x + mediaW, y: area.y + idx * tileH, w: sideW, h: tileH },
            accent,
            room.brand.showNames
          );
        });
      } else if (tpl === 'pip') {
        drawMediaSlot(ctx, area);
        if (onStage[0]) {
          const pipW = 280;
          const pipH = 164;
          drawParticipantTile(
            ctx,
            onStage[0],
            { x: area.x + area.w - pipW - 14, y: area.y + area.h - pipH - 14, w: pipW, h: pipH },
            accent,
            room.brand.showNames
          );
        }
      } else if (tpl === 'v-screen' || tpl === 'v-slides') {
        drawMediaSlot(ctx, { x: area.x, y: area.y, w: area.w, h: area.h * 0.62 });
        if (onStage[0]) {
          drawParticipantTile(
            ctx,
            onStage[0],
            { x: area.x, y: area.y + area.h * 0.62, w: area.w, h: area.h * 0.38 },
            accent,
            room.brand.showNames
          );
        }
      } else if (tpl === 'v-duo') {
        const halfH = area.h / 2;
        onStage.slice(0, 2).forEach((p, idx) => {
          drawParticipantTile(
            ctx,
            p,
            { x: area.x, y: area.y + idx * halfH, w: area.w, h: halfH },
            accent,
            room.brand.showNames
          );
        });
      } else if (tpl === 'spotlight' && onStage.length > 1) {
        const leadW = area.w * 0.68;
        drawParticipantTile(
          ctx,
          onStage[0],
          { x: area.x, y: area.y, w: leadW, h: area.h },
          accent,
          room.brand.showNames
        );
        const others = onStage.slice(1);
        const slotH = area.h / others.length;
        others.forEach((p, idx) => {
          drawParticipantTile(
            ctx,
            p,
            { x: area.x + leadW, y: area.y + idx * slotH, w: area.w - leadW, h: slotH },
            accent,
            room.brand.showNames
          );
        });
      } else if (tpl === 'duo' && onStage.length >= 2) {
        const halfW = area.w / 2;
        onStage.slice(0, 2).forEach((p, idx) => {
          drawParticipantTile(
            ctx,
            p,
            { x: area.x + idx * halfW, y: area.y, w: halfW, h: area.h },
            accent,
            room.brand.showNames
          );
        });
      } else {
        // Dynamic Grid (Solo, Grid4, Grid6)
        const list = onStage.length > 0 ? onStage : [];
        if (list.length === 0) {
          ctx.fillStyle = '#8a97ae';
          ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('No speakers on stage — toggle a crew member in the dock', w / 2, h / 2);
        } else {
          const cols = list.length === 1 ? 1 : list.length <= 4 ? 2 : 3;
          const rows = Math.ceil(list.length / cols);
          const cw = area.w / cols;
          const ch = area.h / rows;
          list.forEach((p, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            drawParticipantTile(
              ctx,
              p,
              { x: area.x + col * cw, y: area.y + row * ch, w: cw, h: ch },
              accent,
              room.brand.showNames
            );
          });
        }
      }

      // 2b. Full-Screen Custom PNG Broadcast Overlay (Gather v5)
      if (room.brand.customOverlayUrl) {
        if (overlayImgRef.current?.url !== room.brand.customOverlayUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = room.brand.customOverlayUrl;
          overlayImgRef.current = { url: room.brand.customOverlayUrl, img };
        }
        const oi = overlayImgRef.current?.img;
        if (oi && oi.complete && oi.naturalWidth > 0) {
          ctx.drawImage(oi, 0, 0, w, h);
        }
      }

      // 3. Pinned Product Drop Card + TV-Infomercial Flash Sale HUD (Strictly for Live Shop Mode)
      const pinnedProd =
        room.watchMode === 'shop'
          ? room.commerce.products.find((pr) => pr.id === room.commerce.pinnedProductId)
          : undefined;
      const activeFlash =
        room.watchMode === 'shop' &&
        room.commerce.activeFlashSale?.active &&
        room.commerce.activeFlashSale.endsAt > Date.now()
          ? room.commerce.activeFlashSale
          : null;

      if (pinnedProd) {
        const isFlashProd = activeFlash && activeFlash.productId === pinnedProd.id;
        const cardW = isVertical ? w - 64 : isFlashProd ? 416 : 368;
        const cardH = isFlashProd ? 132 : 108;
        const cx = isVertical ? 32 : w - cardW - 34;
        const cy = room.overlays.banner.visible ? h - cardH - 134 : h - cardH - 54;

        ctx.save();
        ctx.fillStyle = isFlashProd ? 'rgba(14, 14, 30, 0.94)' : 'rgba(10, 15, 28, 0.90)';
        drawRoundedRect(ctx, cx, cy, cardW, cardH, 12);
        ctx.fill();
        ctx.strokeStyle = isFlashProd ? '#f59e0b' : accent;
        ctx.lineWidth = isFlashProd ? 2 : 1.5;
        drawRoundedRect(ctx, cx, cy, cardW, cardH, 12);
        ctx.stroke();

        // Product Thumbnail
        const pImg = getProductImg(pinnedProd);
        if (pImg && pImg.complete && pImg.naturalWidth > 0) {
          ctx.save();
          drawRoundedRect(ctx, cx + 10, cy + 10, 88, 88, 8);
          ctx.clip();
          drawImageCover(ctx, pImg, pImg.naturalWidth, pImg.naturalHeight, cx + 10, cy + 10, 88, 88);
          ctx.restore();
        }

        if (isFlashProd && activeFlash) {
          const remFlashSec = Math.max(0, Math.ceil((activeFlash.endsAt - Date.now()) / 1000));
          const fMin = String(Math.floor(remFlashSec / 60)).padStart(2, '0');
          const fSec = String(remFlashSec % 60).padStart(2, '0');
          const flashUnitLeft = Math.max(0, activeFlash.totalUnits - activeFlash.soldUnits);
          const flashPrice = pinnedProd.price * (1 - activeFlash.discountPct / 100);

          ctx.fillStyle = '#fbbf24';
          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(
            `TV FLASH DEAL · ${fMin}:${fSec} · ONLY ${flashUnitLeft}/${activeFlash.totalUnits} LEFT`,
            cx + 110,
            cy + 12,
            cardW - 196
          );

          ctx.fillStyle = '#f8fafc';
          ctx.font = `700 15px "${room.brand.font}", sans-serif`;
          ctx.fillText(pinnedProd.title, cx + 110, cy + 31, cardW - 196);

          ctx.fillStyle = '#34d399';
          ctx.font = '700 19px "JetBrains Mono", monospace';
          ctx.fillText(`$${flashPrice.toFixed(2)}`, cx + 110, cy + 56);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '500 12px "JetBrains Mono", monospace';
          ctx.fillText(
            `was $${pinnedProd.price.toFixed(2)} · 3× VIP -38%`,
            cx + 196,
            cy + 61,
            cardW - 280
          );

          // Urgency depletion bar along bottom of card
          const barX = cx + 10;
          const barY = cy + cardH - 22;
          const barW = cardW - 96;
          const pctLeft = Math.max(0.06, Math.min(1, flashUnitLeft / Math.max(1, activeFlash.totalUnits)));
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          drawRoundedRect(ctx, barX, barY, barW, 10, 5);
          ctx.fill();
          ctx.fillStyle = flashUnitLeft <= 4 ? '#f43f5e' : '#f59e0b';
          drawRoundedRect(ctx, barX, barY, barW * pctLeft, 10, 5);
          ctx.fill();
        } else {
          // Standard Pinned Drop Metadata
          ctx.fillStyle = '#7fa8ff';
          ctx.font = '600 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(
            `${pinnedProd.source.toUpperCase()} · ${pinnedProd.stock} LEFT`,
            cx + 110,
            cy + 14
          );

          ctx.fillStyle = '#f8fafc';
          ctx.font = `700 15px "${room.brand.font}", sans-serif`;
          ctx.fillText(pinnedProd.title, cx + 110, cy + 33, cardW - 190);

          ctx.fillStyle = '#34d399';
          ctx.font = '700 18px "JetBrains Mono", monospace';
          ctx.fillText(`$${pinnedProd.price.toFixed(2)}`, cx + 110, cy + 64);
        }

        // QR Code
        if (qrImgRef.current?.img?.complete) {
          ctx.fillStyle = '#ffffff';
          drawRoundedRect(ctx, cx + cardW - 76, cy + 16, 62, 62, 6);
          ctx.fill();
          ctx.drawImage(qrImgRef.current.img, cx + cardW - 73, cy + 19, 56, 56);
          ctx.fillStyle = '#aab5ca';
          ctx.font = '500 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('IN-STREAM', cx + cardW - 45, cy + 84);
        }
        ctx.restore();
      }

      // 3b. Live On-Screen Order Sales Popup (Shopify / Etsy In-Stream Purchase Alert)
      const salePopup = room.commerce.latestSalePopup;
      if (salePopup && Date.now() - salePopup.createdAt < 7500) {
        const ageMs = Date.now() - salePopup.createdAt;
        const enterT = Math.min(1, ageMs / 260);
        const exitT = ageMs > 6900 ? Math.max(0, (7500 - ageMs) / 600) : 1;
        const alpha = enterT * exitT;
        const slideOffset = (1 - enterT) * -24;

        const popW = Math.min(w - 68, 468);
        const popH = 78;
        const popX = (w - popW) / 2;
        const popY = 28 + slideOffset;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(8, 20, 28, 0.94)';
        drawRoundedRect(ctx, popX, popY, popW, popH, 14);
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, popX, popY, popW, popH, 14);
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(
          `LIVE ORDER ${salePopup.orderNumber} · ${salePopup.source.toUpperCase()} CHECKOUT`,
          popX + 18,
          popY + 12,
          popW - 36
        );

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `${salePopup.buyerName} (${salePopup.buyerCity}) grabbed ${salePopup.quantity}× ${salePopup.productTitle}`,
          popX + 18,
          popY + 31,
          popW - 36
        );

        ctx.fillStyle = '#fbbf24';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillText(
          `$${salePopup.total.toFixed(2)} paid in-stream · Only ${salePopup.remainingStock} left!`,
          popX + 18,
          popY + 54,
          popW - 36
        );
        ctx.restore();
      }

      // 3c. Twitch-Style Community Hype Train HUD
      const hypeTrain = room.hypeTrain;
      if (hypeTrain && hypeTrain.active && hypeTrain.endsAt > Date.now()) {
        const remHypeSec = Math.max(0, Math.ceil((hypeTrain.endsAt - Date.now()) / 1000));
        const hm = String(Math.floor(remHypeSec / 60)).padStart(2, '0');
        const hs = String(remHypeSec % 60).padStart(2, '0');
        const pct = Math.min(100, Math.round((hypeTrain.points / Math.max(1, hypeTrain.goalPoints)) * 100));
        const hw = 236;
        const hh = 48;
        const hx = w - hw - 34;
        const hy = 34;

        ctx.save();
        ctx.fillStyle = 'rgba(13, 18, 38, 0.88)';
        drawRoundedRect(ctx, hx, hy, hw, hh, 10);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.4;
        drawRoundedRect(ctx, hx, hy, hw, hh, 10);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`HYPE TRAIN LVL ${hypeTrain.level} · ${hm}:${hs}`, hx + 12, hy + 9);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(`${pct}%`, hx + hw - 12, hy + 9);

        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        drawRoundedRect(ctx, hx + 12, hy + 28, hw - 24, 9, 4.5);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        drawRoundedRect(ctx, hx + 12, hy + 28, Math.max(8, ((hw - 24) * pct) / 100), 9, 4.5);
        ctx.fill();
        ctx.restore();
      }

      // 4. Live Gamer Poll Overlay
      const poll = room.gamer.activePoll;
      if (poll && poll.showOnStage) {
        const totalVotes = poll.options.reduce((acc, o) => acc + o.votes, 0);
        const pw = 310;
        const ph = 52 + poll.options.length * 32;
        const px = 34;
        const py = 34;

        ctx.save();
        ctx.fillStyle = 'rgba(10, 15, 28, 0.88)';
        drawRoundedRect(ctx, px, py, pw, ph, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, px, py, pw, ph, 12);
        ctx.stroke();

        ctx.fillStyle = '#7fa8ff';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(
          `${poll.isOpen ? 'LIVE POLL' : 'FINAL RESULT'} · ${totalVotes} VOTES`,
          px + 14,
          py + 12
        );

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(poll.question, px + 14, py + 29, pw - 28);

        poll.options.forEach((opt, i) => {
          const oy = py + 54 + i * 30;
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          drawRoundedRect(ctx, px + 14, oy, pw - 28, 22, 6);
          ctx.fill();

          if (pct > 0) {
            ctx.fillStyle = accent;
            drawRoundedRect(ctx, px + 14, oy, Math.max(12, ((pw - 28) * pct) / 100), 22, 6);
            ctx.fill();
          }

          ctx.fillStyle = '#f8fafc';
          ctx.font = '600 12px "DM Sans", sans-serif';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText(opt.label, px + 22, oy + 11, pw - 86);

          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${pct}%`, px + pw - 22, oy + 11);
        });
        ctx.restore();
      }

      // 5. Featured Chat Comment Spotlight
      if (room.overlays.featuredChatId) {
        const feat = room.chatMessages.find((m) => m.id === room.overlays.featuredChatId);
        if (feat) {
          const sc = feat.superChat;
          const scColor = sc
            ? sc.tier === 'rose'
              ? '#fb7185'
              : sc.tier === 'amber'
              ? '#f59e0b'
              : sc.tier === 'emerald'
              ? '#34d399'
              : '#60a5fa'
            : accent;
          const fw = Math.min(w - 80, 620);
          const fx = 34;
          const fy = h - 165;
          ctx.save();
          ctx.fillStyle = sc ? 'rgba(10, 16, 30, 0.94)' : 'rgba(10, 15, 28, 0.92)';
          drawRoundedRect(ctx, fx, fy, fw, 74, 12);
          ctx.fill();
          ctx.strokeStyle = scColor;
          ctx.lineWidth = sc ? 2 : 1.5;
          drawRoundedRect(ctx, fx, fy, fw, 74, 12);
          ctx.stroke();

          ctx.fillStyle = scColor;
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const headerText = sc
            ? `SUPER CHAT $${sc.amount.toFixed(0)} · ${sc.method.toUpperCase()} · ${feat.author}`
            : `${feat.author} · ${feat.source}`;
          ctx.fillText(headerText, fx + 16, fy + 12, fw - 32);

          ctx.fillStyle = '#ffffff';
          ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(feat.text, fx + 16, fy + 34, fw - 32);
          ctx.restore();
        }
      }

      // 5b. Featured Audience Q&A Spotlight
      if (room.overlays.featuredQuestionId) {
        const qItem = (room.questions || []).find((q) => q.id === room.overlays.featuredQuestionId);
        if (qItem) {
          const qw = Math.min(w - 80, 650);
          const qx = 34;
          const qy = h - 172;
          ctx.save();
          ctx.fillStyle = 'rgba(11, 18, 36, 0.93)';
          drawRoundedRect(ctx, qx, qy, qw, 80, 12);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.6;
          drawRoundedRect(ctx, qx, qy, qw, 80, 12);
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(
            `AUDIENCE Q&A · ${qItem.upvotes} UPVOTES · ${qItem.author.toUpperCase()}`,
            qx + 18,
            qy + 13,
            qw - 36
          );

          ctx.fillStyle = '#ffffff';
          ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(qItem.text, qx + 18, qy + 36, qw - 36);
          ctx.restore();
        }
      }

      // 5c. Compact Live Chat Feed Overlay on Stage (Gather v5)
      if (room.overlays.chatOverlayOnStage) {
        const recentChat = room.chatMessages
          .filter((m) => m.role !== 'system' && m.role !== 'payment-card')
          .slice(-3);
        if (recentChat.length > 0) {
          const cw = 320;
          const cx = w - cw - 34;
          let cy = h - (room.overlays.banner.visible ? 190 : 120) - recentChat.length * 44;
          recentChat.forEach((m) => {
            ctx.save();
            ctx.fillStyle = m.role === 'superchat' ? 'rgba(16, 185, 129, 0.24)' : 'rgba(10, 16, 32, 0.78)';
            drawRoundedRect(ctx, cx, cy, cw, 38, 9);
            ctx.fill();
            ctx.strokeStyle = m.role === 'superchat' ? 'rgba(52, 211, 153, 0.55)' : 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            drawRoundedRect(ctx, cx, cy, cw, 38, 9);
            ctx.stroke();

            ctx.fillStyle = '#93c5fd';
            ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const prefix = m.superChat ? `${m.author} ($${m.superChat.amount}): ` : `${m.author}: `;
            const preW = Math.min(130, ctx.measureText(prefix).width);
            ctx.fillText(prefix, cx + 12, cy + 19, 130);

            ctx.fillStyle = '#f8fafc';
            ctx.font = '500 12px "DM Sans", sans-serif';
            ctx.fillText(m.text, cx + 14 + preW, cy + 19, cw - preW - 26);
            ctx.restore();
            cy += 44;
          });
        }
      }

      // 5d. On-Stage Direct Creator Support QR Card (Gather v5)
      if (room.overlays.showSupportQrOnStage && qrImgRef.current?.img?.complete) {
        const sw = 186;
        const sh = 78;
        const sx = w - sw - 34;
        const sy = 96;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 17, 35, 0.90)';
        drawRoundedRect(ctx, sx, sy, sw, sh, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, sx, sy, sw, sh, 12);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, sx + 10, sy + 10, 58, 58, 6);
        ctx.fill();
        ctx.drawImage(qrImgRef.current.img, sx + 13, sy + 13, 52, 52);

        ctx.fillStyle = '#34d399';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('0% FEE TIP', sx + 78, sy + 16);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Tip in Live Chat', sx + 78, sy + 32, 98);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 10px "DM Sans", sans-serif';
        ctx.fillText('Instant · Direct', sx + 78, sy + 50, 98);
        ctx.restore();
      }

      // 5e. Rotating Sponsor Banner HUD (Gather v5)
      if (room.brand.sponsorsEnabled && room.brand.sponsors && room.brand.sponsors.length > 0) {
        const intervalMs = Math.max(5, room.brand.sponsorIntervalSec || 15) * 1000;
        const activeIdx = Math.floor((now - startTs) / intervalMs) % room.brand.sponsors.length;
        const sp = room.brand.sponsors[activeIdx];
        if (sp) {
          const spW = 250;
          const spH = 48;
          const spX = 34;
          const spY = poll && poll.showOnStage ? 182 : 34;
          ctx.save();
          ctx.fillStyle = 'rgba(10, 17, 35, 0.86)';
          drawRoundedRect(ctx, spX, spY, spW, spH, 10);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 1;
          drawRoundedRect(ctx, spX, spY, spW, spH, 10);
          ctx.stroke();

          ctx.fillStyle = '#8ab4ff';
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('SPONSORED BY', spX + 14, spY + 8);

          ctx.fillStyle = '#ffffff';
          ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(sp.label, spX + 14, spY + 22, spW - 28);
          ctx.restore();
        }
      }

      // 6. Lower-Third Banner
      if (room.overlays.banner.visible && room.overlays.banner.title) {
        const bx = 34;
        const by = room.overlays.ticker.visible ? h - 118 : h - 98;
        const bw = Math.min(w - 68, 640);
        const bh = 64;
        ctx.save();
        if (room.overlays.banner.style === 'block') {
          ctx.fillStyle = accent;
        } else if (room.overlays.banner.style === 'minimal') {
          ctx.fillStyle = 'rgba(6, 10, 22, 0.65)';
        } else if (room.overlays.banner.style === 'glass') {
          ctx.fillStyle = 'rgba(13, 22, 44, 0.82)';
        } else {
          ctx.fillStyle = 'rgba(12, 18, 34, 0.92)';
        }
        drawRoundedRect(ctx, bx, by, bw, bh, 11);
        ctx.fill();
        if (room.overlays.banner.style !== 'block') {
          ctx.strokeStyle =
            room.overlays.banner.style === 'glass'
              ? 'rgba(138, 180, 255, 0.36)'
              : 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 1.2;
          drawRoundedRect(ctx, bx, by, bw, bh, 11);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 20px "${room.brand.font}", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(room.overlays.banner.title, bx + 18, by + 12, bw - 36);

        if (room.overlays.banner.subtitle) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = '500 13px "DM Sans", sans-serif';
          ctx.fillText(room.overlays.banner.subtitle, bx + 18, by + 39, bw - 36);
        }
        ctx.restore();
      }

      // 7. Live Speech Captions (glass | bar | minimal)
      if (room.overlays.captionsEnabled && room.overlays.captionText) {
        const capText = room.overlays.captionText.slice(-110);
        const cStyle = room.overlays.captionStyle || 'glass';
        ctx.save();
        ctx.font = '600 18px "DM Sans", sans-serif';
        const mw = Math.min(w - 100, ctx.measureText(capText).width + 38);
        const cx = (w - mw) / 2;
        const cy = h - (room.overlays.ticker.visible ? 140 : 112);
        if (cStyle === 'bar') {
          ctx.fillStyle = 'rgba(5, 10, 23, 0.92)';
          ctx.fillRect(0, cy - 2, w, 40);
        } else if (cStyle === 'glass') {
          ctx.fillStyle = 'rgba(12, 20, 40, 0.82)';
          drawRoundedRect(ctx, cx, cy, mw, 36, 9);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 1;
          drawRoundedRect(ctx, cx, cy, mw, 36, 9);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(capText, w / 2, cy + 18, mw - 24);
        ctx.restore();
      }

      // 8. Scrolling Ticker
      if (room.overlays.ticker.visible && room.overlays.ticker.text) {
        const ty = h - 38;
        ctx.save();
        ctx.fillStyle = 'rgba(8, 12, 22, 0.94)';
        ctx.fillRect(0, ty, w, 38);
        ctx.fillStyle = accent;
        ctx.fillRect(0, ty, w, 2);

        const text = `${room.overlays.ticker.text}   ·   `;
        ctx.font = '600 14px "DM Sans", sans-serif';
        const tw = ctx.measureText(text).width;
        const offset = ((now - startTs) * 0.08) % Math.max(1, tw);
        ctx.fillStyle = '#e8edf6';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let x = -offset; x < w; x += tw) {
          ctx.fillText(text, x, ty + 20);
        }
        ctx.restore();
      }

      // 8b. Stage Countdown Timer HUD
      if (room.overlays.countdownEndAt && room.overlays.countdownEndAt > Date.now() - 2000) {
        const remSec = Math.max(0, Math.ceil((room.overlays.countdownEndAt - Date.now()) / 1000));
        const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
        const ss = String(remSec % 60).padStart(2, '0');
        const cdLabel = (room.overlays.countdownLabel || 'COUNTDOWN').slice(0, 20).toUpperCase();
        const cdW = 166;
        const cdH = 52;
        const cdX = w - cdW - 34;
        const cdY = room.brand.logoUrl && room.brand.logoPosition === 'tr' ? 84 : 34;
        ctx.save();
        ctx.fillStyle = 'rgba(8, 12, 22, 0.88)';
        drawRoundedRect(ctx, cdX, cdY, cdW, cdH, 10);
        ctx.fill();
        ctx.strokeStyle = remSec <= 10 ? '#e11d48' : accent;
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, cdX, cdY, cdW, cdH, 10);
        ctx.stroke();

        ctx.fillStyle = '#7fa8ff';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(cdLabel, cdX + cdW / 2, cdY + 8);

        ctx.fillStyle = remSec <= 10 ? '#fb7185' : '#ffffff';
        ctx.font = '700 22px "JetBrains Mono", monospace';
        ctx.fillText(`${mm}:${ss}`, cdX + cdW / 2, cdY + 22);
        ctx.restore();
      }

      // 9. Brand Corner Logo
      if (room.brand.logoUrl) {
        if (logoImgRef.current?.url !== room.brand.logoUrl) {
          const img = new Image();
          img.src = room.brand.logoUrl;
          logoImgRef.current = { url: room.brand.logoUrl, img };
        }
        const li = logoImgRef.current?.img;
        if (li && li.complete && li.naturalWidth > 0) {
          const ls = room.brand.logoSize || 44;
          const margin = 26;
          const pos = room.brand.logoPosition;
          const lx = pos === 'tl' || pos === 'bl' ? margin : w - ls - margin;
          const ly = pos === 'tl' || pos === 'tr' ? margin : h - ls - margin;
          ctx.drawImage(li, lx, ly, ls, ls);
        }
      }

      // 10. Frame Treatments
      if (room.brand.frame === 'border') {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
      } else if (room.brand.frame === 'corners') {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        const len = 36;
        [
          [16, 16, 1, 1],
          [w - 16, 16, -1, 1],
          [16, h - 16, 1, -1],
          [w - 16, h - 16, -1, -1],
        ].forEach(([cx, cy, dx, dy]) => {
          ctx.beginPath();
          ctx.moveTo(cx + len * dx, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + len * dy);
          ctx.stroke();
        });
      } else if (room.brand.frame === 'vignette') {
        const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.72);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.52)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const tick = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderSceneFrame(ctx, now);

          // Apply outgoing transition if active
          const prev = prevSnapshotRef.current;
          if (prev) {
            const elapsed = now - transitionStartRef.current;
            const dur = Math.max(120, room.scene.transitionMs || 320);
            if (elapsed >= dur) {
              prevSnapshotRef.current = null;
            } else {
              const t = Math.min(1, elapsed / dur);
              const eased = 1 - Math.pow(1 - t, 3);
              ctx.save();
              if (room.scene.transitionType === 'dissolve') {
                ctx.globalAlpha = 1 - eased;
                ctx.drawImage(prev, 0, 0, stageW, stageH);
              } else if (room.scene.transitionType === 'slide') {
                ctx.drawImage(prev, -stageW * eased, 0, stageW, stageH);
              } else if (room.scene.transitionType === 'push') {
                ctx.globalAlpha = 1 - eased * 0.6;
                ctx.drawImage(prev, 0, stageH * eased, stageW, stageH);
              }
              ctx.restore();
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [room, localClientId, activeMedia, videoFx, stageW, stageH, isVertical]);

  // Custom layout drag/resize pointer handlers
  const handleOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragTarget || !editMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - dragTarget.startX) / rect.width;
    const dy = (e.clientY - dragTarget.startY) / rect.height;

    const updated = room.scene.customElements.map((el) => {
      if (el.id !== dragTarget.id) return el;
      if (dragTarget.mode === 'move') {
        return {
          ...el,
          x: Math.max(0.02, Math.min(0.98 - el.w, dragTarget.orig.x + dx)),
          y: Math.max(0.02, Math.min(0.98 - el.h, dragTarget.orig.y + dy)),
        };
      }
      return {
        ...el,
        w: Math.max(0.15, Math.min(0.98 - el.x, dragTarget.orig.w + dx)),
        h: Math.max(0.15, Math.min(0.98 - el.y, dragTarget.orig.h + dy)),
      };
    });
    onUpdateCustomElements(updated);
  };

  return (
    <div className="gather-stage-wrap">
      <div
        onDragOver={
          viewerMode
            ? undefined
            : (e) => {
                e.preventDefault();
                setDragOver(true);
              }
        }
        onDragLeave={viewerMode ? undefined : () => setDragOver(false)}
        onDrop={
          viewerMode
            ? undefined
            : (e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) onDropMediaFile(file);
              }
        }
        className={isVertical ? 'gather-stage-frame-vertical' : 'gather-stage-frame'}
      >
        <canvas
          ref={canvasRef}
          width={stageW}
          height={stageH}
          aria-label="Broadcast stage program output"
          className="w-full h-full block object-contain"
        />

        {/* StreamYard-Style 9:16 Vertical Crop Safe-Zone Guide (Host Preview Only) */}
        {!viewerMode && !isVertical && showSafeZone916 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[31.64%] border-x-2 border-dashed border-sky-400/65 bg-sky-400/[0.03] flex items-end justify-center pb-2"
          >
            <span className="px-2 py-0.5 rounded bg-slate-950/80 text-[10px] font-mono-num text-sky-300 border border-sky-400/30">
              9:16 Shorts / Reels Safe Frame
            </span>
          </div>
        )}

        {/* Drag-and-drop overlay */}
        {!viewerMode && dragOver && (
          <div className="absolute inset-0 bg-[var(--accent)]/25 backdrop-blur-sm border-2 border-dashed border-[var(--accent)] flex flex-col items-center justify-center gap-2 pointer-events-none">
            <Upload className="w-8 h-8 text-white" />
            <p className="text-sm font-semibold text-white">Drop PDF, Video, or Image to present</p>
          </div>
        )}

        {/* Interactive Custom Layout Editor Overlay */}
        {!viewerMode && editMode && (
          <div
            onPointerMove={handleOverlayPointerMove}
            onPointerUp={() => setDragTarget(null)}
            className="absolute inset-0 bg-black/25 select-none"
          >
            <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 bg-[var(--surface)]/95 backdrop-blur-md border border-[var(--line-2)] px-3 py-1.5 rounded-[8px] text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--ink-2)] mr-1">
                  Stage Designer
                </span>
                {(
                  [
                    { kind: 'text', label: '+ Text', text: 'Live Broadcast' },
                    { kind: 'clock', label: '+ Clock' },
                    { kind: 'block', label: '+ Block' },
                    { kind: 'qr', label: '+ Watch QR' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => {
                      const nextEl: CustomStageElement = {
                        id: `el-${item.kind}-${Date.now().toString(36)}`,
                        kind: item.kind,
                        label: item.label.replace('+ ', ''),
                        text: 'text' in item ? item.text : undefined,
                        x: 0.08,
                        y: 0.08,
                        w: item.kind === 'qr' ? 0.16 : 0.28,
                        h: item.kind === 'qr' ? 0.24 : 0.14,
                      };
                      onUpdateCustomElements([...room.scene.customElements, nextEl]);
                    }}
                    className="h-6 px-2 rounded-[5px] bg-[var(--bg)] hover:border-[var(--accent)] border border-[var(--line-2)] text-[11px] font-medium text-[var(--ink)] cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
                {onResetCustomElements && (
                  <button
                    type="button"
                    onClick={onResetCustomElements}
                    className="h-6 px-2 rounded-[5px] text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onExitEditMode}
                className="h-6 px-2.5 rounded-[5px] bg-[var(--accent)] text-white text-[11px] font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
            {room.scene.customElements.map((el) => (
              <div
                key={el.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragTarget({
                    id: el.id,
                    mode: 'move',
                    startX: e.clientX,
                    startY: e.clientY,
                    orig: el,
                  });
                }}
                style={{
                  left: `${el.x * 100}%`,
                  top: `${el.y * 100}%`,
                  width: `${el.w * 100}%`,
                  height: `${el.h * 100}%`,
                }}
                className="absolute border-2 border-[var(--accent)] bg-[var(--accent)]/15 rounded-lg cursor-move flex items-start justify-between p-2"
              >
                <span className="text-[11px] font-mono-num bg-black/75 text-white px-2 py-0.5 rounded truncate">
                  {el.label}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${el.label}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateCustomElements(
                      room.scene.customElements.filter((item) => item.id !== el.id)
                    );
                  }}
                  className="w-5 h-5 rounded bg-black/75 text-white/80 hover:text-[var(--danger)] grid place-items-center cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDragTarget({
                      id: el.id,
                      mode: 'resize',
                      startX: e.clientX,
                      startY: e.clientY,
                      orig: el,
                    });
                  }}
                  className="absolute bottom-1 right-1 w-4 h-4 rounded bg-white border border-[var(--accent)] cursor-nwse-resize"
                />
              </div>
            ))}
          </div>
        )}

        {/* Active Slide / Video Presentation Control Bar */}
        {activeMedia && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-3.5 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-white text-xs">
            <span className="font-mono-num text-[var(--accent-text)] uppercase">
              {activeMedia.kind}
            </span>
            <span className="max-w-[140px] truncate text-white/85">{activeMedia.name}</span>

            {activeMedia.kind === 'pdf' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onMediaPageChange(-1)}
                  aria-label="Previous slide"
                  className="h-7 w-7 grid place-items-center rounded bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono-num px-1">
                  {activeMedia.currentPage} / {activeMedia.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => onMediaPageChange(1)}
                  aria-label="Next slide"
                  className="h-7 w-7 grid place-items-center rounded bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {activeMedia.kind === 'video' && activeMedia.videoEl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const v = activeMedia.videoEl!;
                    if (v.paused) {
                      void v.play();
                      setVidPlaying(true);
                    } else {
                      v.pause();
                      setVidPlaying(false);
                    }
                  }}
                  className="h-7 px-2 rounded bg-white/10 hover:bg-white/20 inline-flex items-center gap-1 cursor-pointer"
                >
                  {vidPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={vidProgress}
                  onChange={(e) => {
                    const v = activeMedia.videoEl!;
                    if (v.duration) v.currentTime = Number(e.target.value) * v.duration;
                  }}
                  className="gather-range w-20"
                />
                <span className="font-mono-num text-[11px]">{vidTimeStr}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !vidLoop;
                    activeMedia.videoEl!.loop = next;
                    setVidLoop(next);
                  }}
                  aria-label="Toggle loop"
                  className={`h-7 w-7 grid place-items-center rounded cursor-pointer ${
                    vidLoop ? 'bg-[var(--accent)]' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onStopMedia}
              aria-label="Stop presenting"
              className="h-7 w-7 grid place-items-center rounded bg-white/10 hover:bg-[var(--live)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
