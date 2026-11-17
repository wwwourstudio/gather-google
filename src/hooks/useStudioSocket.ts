import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChatReplyRef,
  CustomScenePreset,
  PayoutSettings,
  RoomState,
  SuperChatMethod,
  WatchMode,
} from '../types/studio';

export type ConnectionState = 'offline' | 'connecting' | 'online' | 'reconnecting';

interface UseStudioSocketOptions {
  roomCode: string | null;
  clientId: string;
  role: 'host' | 'guest' | 'viewer';
  name: string;
  avatarUrl?: string;
  hostUid?: string;
  studioTitle?: string;
  initialWatchMode?: WatchMode;
  initialPayouts?: PayoutSettings;
  micOn?: boolean;
  camOn?: boolean;
  localStream: MediaStream | null;
  programStream: MediaStream | null;
  onOrderReceived?: (orderText: string) => void;
  onSuperChatReceived?: (scText: string) => void;
  onPromotedToStage?: () => void;
  onKicked?: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useStudioSocket(opts: UseStudioSocketOptions) {
  const {
    roomCode,
    clientId,
    role,
    name,
    avatarUrl,
    hostUid,
    studioTitle,
    initialWatchMode,
    initialPayouts,
    micOn = true,
    camOn = true,
    localStream,
    programStream,
    onOrderReceived,
    onSuperChatReceived,
    onPromotedToStage,
    onKicked,
  } = opts;

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [connState, setConnState] = useState<ConnectionState>('offline');
  const [knockState, setKnockState] = useState<'none' | 'knocking' | 'admitted' | 'denied'>('none');
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [viewerBroadcastStream, setViewerBroadcastStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const programStreamRef = useRef<MediaStream | null>(programStream);
  const lastSalePopupIdRef = useRef<string | null>(null);
  const lastSuperChatIdRef = useRef<string | null>(null);

  localStreamRef.current = localStream;
  programStreamRef.current = programStream;

  const sendRaw = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string, isProgramBroadcast: boolean) => {
      const existing = peersRef.current.get(peerId);
      if (existing) {
        existing.close();
      }
      const pc = new RTCPeerConnection(RTC_CONFIG);

      const streamToSend = isProgramBroadcast ? programStreamRef.current : localStreamRef.current;
      if (streamToSend && role !== 'viewer') {
        streamToSend.getTracks().forEach((track) => {
          pc.addTrack(track, streamToSend);
        });
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendRaw({
            type: 'webrtc:signal',
            targetId: peerId,
            signal: { candidate: ev.candidate },
          });
        }
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0];
        if (!stream) return;
        if (role === 'viewer') {
          setViewerBroadcastStream(stream);
        } else {
          setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peersRef.current.delete(peerId);
          setRemoteStreams((prev) => {
            const copy = { ...prev };
            delete copy[peerId];
            return copy;
          });
        }
      };

      peersRef.current.set(peerId, pc);
      return pc;
    },
    [role, sendRaw]
  );

  useEffect(() => {
    if (!localStream || role === 'viewer') return;
    for (const [peerId, pc] of peersRef.current.entries()) {
      if (peerId.startsWith('viewer-')) continue;
      const senders = pc.getSenders();
      localStream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          void existingSender.replaceTrack(track);
        } else {
          pc.addTrack(track, localStream);
        }
      });
    }
  }, [localStream, role]);

  useEffect(() => {
    if (!roomCode) {
      setConnState('offline');
      setRoomState(null);
      setKnockState('none');
      setRemoteStreams({});
      setViewerBroadcastStream(null);
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      setConnState(attempt > 0 ? 'reconnecting' : 'connecting');

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnState('online');
        ws.send(
          JSON.stringify({
            type: 'room:join',
            roomCode,
            clientId,
            role,
            name,
            avatarUrl,
            hostUid,
            title: studioTitle,
            watchMode: initialWatchMode,
            payouts: initialPayouts,
            micOn,
            camOn,
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
          const type = String(msg.type || '');

          if (type === 'room:knocking') {
            setKnockState('knocking');
            return;
          }

          if (type === 'room:admitted') {
            setKnockState('admitted');
            return;
          }

          if (type === 'room:denied') {
            setKnockState('denied');
            return;
          }

          if (type === 'room:kicked') {
            onKicked?.();
            return;
          }

          if (type === 'stage:promoted') {
            onPromotedToStage?.();
            return;
          }

          if (type === 'room:joined') {
            setKnockState('admitted');
            if (role === 'viewer') {
              ws.send(JSON.stringify({ type: 'webrtc:signal', signal: { requestStream: true } }));
            }
            return;
          }

          if (type === 'room:state') {
            const nextState = msg.state as RoomState;
            setRoomState(nextState);

            const popup = nextState.commerce.latestSalePopup;
            if (popup && popup.id !== lastSalePopupIdRef.current) {
              if (lastSalePopupIdRef.current !== null) {
                onOrderReceived?.(
                  `${popup.buyerName} (${popup.buyerCity}) bought ${popup.quantity}× ${popup.productTitle} · $${popup.total.toFixed(2)}`
                );
              }
              lastSalePopupIdRef.current = popup.id;
            } else if (!lastSalePopupIdRef.current) {
              lastSalePopupIdRef.current = popup?.id || 'init';
            }

            const latestSc = [...nextState.chatMessages]
              .reverse()
              .find((m) => m.role === 'superchat');
            if (latestSc && latestSc.id !== lastSuperChatIdRef.current) {
              if (lastSuperChatIdRef.current !== null && latestSc.superChat) {
                onSuperChatReceived?.(
                  `$${latestSc.superChat.amount} Super Chat from ${latestSc.author} (${latestSc.superChat.method})`
                );
              }
              lastSuperChatIdRef.current = latestSc.id;
            } else if (!lastSuperChatIdRef.current) {
              lastSuperChatIdRef.current = 'init';
            }

            if (role !== 'viewer') {
              for (const p of nextState.participants) {
                if (p.id !== clientId && !peersRef.current.has(p.id) && clientId < p.id) {
                  const pc = createPeerConnection(p.id, false);
                  const offer = await pc.createOffer();
                  await pc.setLocalDescription(offer);
                  sendRaw({
                    type: 'webrtc:signal',
                    targetId: p.id,
                    signal: { sdp: pc.localDescription },
                  });
                }
              }
            }
            return;
          }

          if (type === 'webrtc:viewer_request' && role === 'host') {
            const viewerId = String(msg.fromId || '');
            if (viewerId && programStreamRef.current) {
              const pc = createPeerConnection(viewerId, true);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              sendRaw({
                type: 'webrtc:signal',
                targetId: viewerId,
                signal: { sdp: pc.localDescription },
              });
            }
            return;
          }

          if (type === 'webrtc:signal') {
            const fromId = String(msg.fromId || '');
            const signal = msg.signal as {
              sdp?: RTCSessionDescriptionInit;
              candidate?: RTCIceCandidateInit;
            };
            if (!fromId || !signal) return;

            let pc = peersRef.current.get(fromId);
            if (!pc && signal.sdp?.type === 'offer') {
              pc = createPeerConnection(fromId, false);
            }
            if (!pc) return;

            if (signal.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              if (signal.sdp.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendRaw({
                  type: 'webrtc:signal',
                  targetId: fromId,
                  signal: { sdp: pc.localDescription },
                });
              }
            } else if (signal.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
          }
        } catch (err) {
          console.error('Socket message handling error:', err);
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        attempt += 1;
        setConnState('reconnecting');
        const delay = Math.min(5000, 1000 * attempt);
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
      for (const pc of peersRef.current.values()) {
        pc.close();
      }
      peersRef.current.clear();
    };
  }, [
    roomCode,
    clientId,
    role,
    name,
    avatarUrl,
    hostUid,
    studioTitle,
    initialWatchMode,
    createPeerConnection,
    sendRaw,
    onKicked,
    onOrderReceived,
    onSuperChatReceived,
    onPromotedToStage,
  ]);

  const sendPatch = useCallback(
    (patch: Record<string, unknown>) => {
      sendRaw({ type: 'room:state_patch', patch });
    },
    [sendRaw]
  );

  const sendParticipantUpdate = useCallback(
    (targetId: string, patch: Record<string, unknown>) => {
      sendRaw({ type: 'room:update_participant', targetId, patch });
    },
    [sendRaw]
  );

  return {
    roomState,
    connState,
    knockState,
    remoteStreams,
    viewerBroadcastStream,
    sendPatch,
    sendParticipantUpdate,
    admitGuest: (targetId: string) => sendRaw({ type: 'room:admit', targetId }),
    denyGuest: (targetId: string) => sendRaw({ type: 'room:deny', targetId }),
    kickGuest: (targetId: string) => sendRaw({ type: 'room:kick', targetId }),
    sendChat: (
      text: string,
      author?: string,
      chatRole?: string,
      source?: string,
      extra?: { authorUid?: string; avatarUrl?: string; replyTo?: ChatReplyRef }
    ) =>
      sendRaw({
        type: 'chat:send',
        text,
        author,
        role: chatRole,
        source,
        authorUid: extra?.authorUid,
        avatarUrl: extra?.avatarUrl,
        replyTo: extra?.replyTo,
      }),
    toggleChatLike: (messageId: string, actorId: string) =>
      sendRaw({ type: 'chat:toggle_like', messageId, actorId }),
    toggleChatReaction: (messageId: string, emoji: string, actorId: string) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chatMessages: prev.chatMessages.map((m) => {
            if (m.id !== messageId) return m;
            const nextReactions: Record<string, string[]> = { ...(m.reactions || {}) };
            const list = Array.isArray(nextReactions[emoji]) ? [...nextReactions[emoji]] : [];
            const idx = list.indexOf(actorId);
            if (idx >= 0) {
              list.splice(idx, 1);
            } else {
              list.push(actorId);
            }
            if (list.length > 0) {
              nextReactions[emoji] = list;
            } else {
              delete nextReactions[emoji];
            }
            return { ...m, reactions: nextReactions };
          }),
        };
      });
      sendRaw({ type: 'chat:toggle_reaction', messageId, emoji, actorId });
    },
    pinChatMessage: (messageId: string | null) => sendRaw({ type: 'chat:pin', messageId }),
    deleteChatMessage: (messageId: string) => sendRaw({ type: 'chat:delete', messageId }),
    blockChatUser: (author: string, uid?: string) =>
      sendRaw({ type: 'chat:block_user', author, uid }),
    unblockChatUser: (blockId: string) => sendRaw({ type: 'chat:unblock_user', blockId }),
    saveScenePreset: (preset: CustomScenePreset) =>
      sendRaw({ type: 'scene:save_preset', preset }),
    applyScenePreset: (presetId: string) => sendRaw({ type: 'scene:apply_preset', presetId }),
    deleteScenePreset: (presetId: string) => sendRaw({ type: 'scene:delete_preset', presetId }),
    sendSuperChat: (payload: {
      amount: number;
      method: SuperChatMethod;
      author: string;
      avatarUrl?: string;
      text: string;
    }) => sendRaw({ type: 'superchat:send', ...payload }),
    askQuestion: (text: string, author: string) =>
      sendRaw({ type: 'qa:ask', text, author }),
    upvoteQuestion: (questionId: string) =>
      sendRaw({ type: 'qa:upvote', questionId }),
    markQuestionAnswered: (questionId: string) =>
      sendRaw({ type: 'qa:answer', questionId }),
    pinProduct: (productId: string | null) => sendRaw({ type: 'commerce:pin', productId }),
    startFlashSale: (payload: {
      productId: string;
      discountPct: number;
      totalUnits: number;
      durationMin: number;
      tagline?: string;
    }) => sendRaw({ type: 'commerce:flash_start', ...payload }),
    stopFlashSale: () => sendRaw({ type: 'commerce:flash_stop' }),
    placeOrder: (payload: {
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
    }) => sendRaw({ type: 'commerce:order', ...payload }),
    raiseHand: (payload: { uid?: string; name: string; avatarUrl?: string; topic: string }) =>
      sendRaw({ type: 'stage:raise_hand', ...payload }),
    lowerHand: (handId?: string) => sendRaw({ type: 'stage:lower_hand', handId }),
    promoteHand: (handId: string) => sendRaw({ type: 'stage:promote_hand', handId }),
    launchPoll: (question: string, options: string[], showOnStage = true) =>
      sendRaw({ type: 'gamer:poll_launch', question, options, showOnStage }),
    votePoll: (optionId: string) => sendRaw({ type: 'gamer:poll_vote', optionId }),
    closePoll: (clear = false) => sendRaw({ type: 'gamer:poll_close', clear }),
    createClip: (label: string, timestampSec: number, createdBy: string) =>
      sendRaw({ type: 'gamer:clip', label, timestampSec, createdBy }),
    joinSquadQueue: (
      handle: string,
      platform: string,
      note?: string,
      role?: string,
      rank?: string
    ) => sendRaw({ type: 'gamer:queue_join', handle, platform, note, role, rank }),
    removeSquadQueue: (queueId: string) => sendRaw({ type: 'gamer:queue_remove', queueId }),
    sendHype: (author?: string) => sendRaw({ type: 'gamer:hype', author }),
  };
}

