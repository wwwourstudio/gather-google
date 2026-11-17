import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clapperboard,
  Copy,
  FileText,
  Gamepad2,
  Hand,
  HelpCircle,
  Layers,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Move,
  Music2,
  Palette,
  PhoneOff,
  Play,
  Plus,
  Rss,
  ShoppingBag,
  Sliders,
  Smartphone,
  Sparkles,
  Square,
  ThumbsUp,
  Trash2,
  Unlock,
  UserMinus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { SCENE_TEMPLATES, VERTICAL_TEMPLATES } from '../constants/studioDefaults';
import { CustomScenePreset, CustomStageElement, RoomState, TransitionType } from '../types/studio';
import { audioEngine, CustomStingerItem } from '../utils/audioEngine';
import { ConsoleTab } from './RightConsole';
import { PRESET_STINGER_PADS } from './StingerDeckDrawer';

/* Authentic Gather v5 Miniature 16:9 Scene Preview Card (.sc-pv) */
const ScenePreviewThumb: React.FC<{
  id: string;
  elements?: CustomStageElement[];
  bannerVisible?: boolean;
}> = ({ id, elements, bannerVisible = true }) => {
  const slotCls = 'absolute rounded-[2px] bg-[#e2ecff]/82';
  const mediaCls = 'absolute rounded-[2px] bg-[#38bdf8]/78';
  const bannerCls = 'absolute left-[7%] bottom-[8%] w-[46%] h-[9%] rounded-[1.5px] bg-[#2f6bf0]';

  if (elements && elements.length > 0) {
    return (
      <span className="gather-sc-pv" aria-hidden="true">
        {elements.slice(0, 8).map((el, i) => {
          const isMedia = el.kind === 'media';
          const isAccent = el.kind === 'clock' || el.kind === 'qr';
          const bg = isMedia
            ? 'bg-[#38bdf8]/78'
            : isAccent
            ? 'bg-[#34d399]/75'
            : 'bg-[#e2ecff]/82';
          return (
            <i
              key={el.id || i}
              className={`absolute rounded-[2px] ${bg}`}
              style={{
                left: `${Math.max(2, Math.min(92, el.x * 100))}%`,
                top: `${Math.max(2, Math.min(92, el.y * 100))}%`,
                width: `${Math.max(8, Math.min(96, el.w * 100))}%`,
                height: `${Math.max(8, Math.min(96, el.h * 100))}%`,
              }}
            />
          );
        })}
        {bannerVisible && <i className={bannerCls} />}
      </span>
    );
  }

  return (
    <span className="gather-sc-pv" aria-hidden="true">
      {id === 'solo' || id === 'v-solo' ? (
        <i className={`${slotCls} inset-[9%]`} />
      ) : id === 'duo' || id === 'v-duo' ? (
        <>
          <i className={`${slotCls} left-[7%] top-[10%] w-[41%] h-[78%]`} />
          <i className={`${slotCls} right-[7%] top-[10%] w-[41%] h-[78%]`} />
        </>
      ) : id === 'spotlight' || id === 'trio' ? (
        <>
          <i className={`${slotCls} left-[7%] top-[10%] w-[50%] h-[78%]`} />
          <i className={`${slotCls} right-[7%] top-[10%] w-[33%] h-[36%]`} />
          <i className={`${slotCls} right-[7%] bottom-[12%] w-[33%] h-[36%]`} />
        </>
      ) : id === 'screen-cam' || id === 'slides-cam' || id === 'v-screen' ? (
        <>
          <i className={`${mediaCls} left-[7%] top-[10%] w-[58%] h-[78%]`} />
          <i className={`${slotCls} right-[7%] top-[24%] w-[25%] h-[50%]`} />
        </>
      ) : id === 'pip' ? (
        <>
          <i className={`${mediaCls} inset-[8%]`} />
          <i className={`${slotCls} right-[11%] bottom-[13%] w-[26%] h-[32%] shadow-md`} />
        </>
      ) : (
        <>
          <i className={`${slotCls} left-[7%] top-[10%] w-[41%] h-[36%]`} />
          <i className={`${slotCls} right-[7%] top-[10%] w-[41%] h-[36%]`} />
          <i className={`${slotCls} left-[7%] bottom-[12%] w-[41%] h-[36%]`} />
          <i className={`${slotCls} right-[7%] bottom-[12%] w-[41%] h-[36%]`} />
        </>
      )}
      <i className={bannerCls} />
    </span>
  );
};

interface SceneDeckProps {
  room: RoomState;
  localClientId: string;
  isHost: boolean;
  savedPresets?: CustomScenePreset[];
  onSelectScene: (templateId: string) => void;
  onApplyCustomPreset?: (preset: CustomScenePreset) => void;
  onSaveCustomPreset?: (name: string) => void;
  onDeleteCustomPreset?: (presetId: string) => void;
  onChangeTransition: (type: TransitionType, ms: number) => void;
  onToggleParticipantStage: (id: string, onStage: boolean) => void;
  onAskMuteParticipant: (id: string) => void;
  onKickParticipant: (id: string) => void;
  onAdmitGuest: (id: string) => void;
  onDenyGuest: (id: string) => void;
  onToggleLock: () => void;
  onRemoveSquadEntry: (id: string) => void;
  onFeatureQuestion?: (questionId: string | null) => void;
  onPromoteHand?: (handId: string) => void;
  onLowerHand?: (handId: string) => void;
  onOpenStingers?: () => void;
  onOpenInvite?: () => void;
}

export const SceneDeck: React.FC<SceneDeckProps> = ({
  room,
  localClientId,
  isHost,
  savedPresets = [],
  onSelectScene,
  onApplyCustomPreset,
  onSaveCustomPreset,
  onDeleteCustomPreset,
  onChangeTransition,
  onToggleParticipantStage,
  onAskMuteParticipant,
  onKickParticipant,
  onAdmitGuest,
  onDenyGuest,
  onToggleLock,
  onRemoveSquadEntry,
  onFeatureQuestion,
  onPromoteHand,
  onLowerHand,
  onOpenStingers,
  onOpenInvite,
}) => {
  const [deckTab, setDeckTab] = useState<
    'scenes' | 'crew' | 'stingers' | 'qa' | 'callins' | 'lobby' | 'squad'
  >('scenes');
  const [collapsed, setCollapsed] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [customStingers, setCustomStingers] = useState<CustomStingerItem[]>(() =>
    audioEngine.getCustomStingers()
  );
  const [activeAudioIds, setActiveAudioIds] = useState<string[]>(() =>
    audioEngine.getActiveIds()
  );

  useEffect(() => {
    return audioEngine.subscribe(() => {
      setCustomStingers(audioEngine.getCustomStingers());
      setActiveAudioIds(audioEngine.getActiveIds());
    });
  }, []);

  useEffect(() => {
    if (deckTab === 'squad' && room.watchMode !== 'gamer') {
      setDeckTab('scenes');
    }
  }, [deckTab, room.watchMode]);

  const templates = room.aspectRatio === '9:16' ? VERTICAL_TEMPLATES : SCENE_TEMPLATES;
  const sortedQuestions = [...(room.questions || [])].sort((a, b) => b.upvotes - a.upvotes);

  return (
    <div className="rounded-[12px] gather-glass px-4 py-2.5 space-y-2 shrink-0 min-w-0">
      {/* Deck Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="gather-seg overflow-x-auto gather-scroll" role="tablist" aria-label="Studio deck">
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'scenes'}
            onClick={() => {
              setDeckTab('scenes');
              setCollapsed(false);
            }}
            className={`gather-seg-btn ${deckTab === 'scenes' ? 'active' : ''}`}
          >
            Scenes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'crew'}
            onClick={() => {
              setDeckTab('crew');
              setCollapsed(false);
            }}
            className={`gather-seg-btn font-mono-num ${deckTab === 'crew' ? 'active' : ''}`}
          >
            People ({room.participants.length}/6)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'stingers'}
            onClick={() => {
              setDeckTab('stingers');
              setCollapsed(false);
            }}
            className={`gather-seg-btn font-mono-num ${deckTab === 'stingers' ? 'active' : ''}`}
          >
            <Music2 className="w-3 h-3 text-[var(--accent-text)]" />
            <span>Stingers ({PRESET_STINGER_PADS.length + customStingers.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'qa'}
            onClick={() => {
              setDeckTab('qa');
              setCollapsed(false);
            }}
            className={`gather-seg-btn font-mono-num ${deckTab === 'qa' ? 'active' : ''}`}
          >
            <HelpCircle className="w-3 h-3 text-[var(--cyan)]" />
            <span>Q&amp;A ({sortedQuestions.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'callins'}
            onClick={() => {
              setDeckTab('callins');
              setCollapsed(false);
            }}
            className={`gather-seg-btn font-mono-num ${
              deckTab === 'callins'
                ? 'active'
                : (room.handRaiseQueue?.length || 0) > 0
                  ? 'text-[var(--cyan)]'
                  : ''
            }`}
          >
            <Hand className="w-3 h-3 text-[var(--cyan)]" />
            <span>Call-Ins ({room.handRaiseQueue?.length || 0})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={deckTab === 'lobby'}
            onClick={() => {
              setDeckTab('lobby');
              setCollapsed(false);
            }}
            className={`gather-seg-btn font-mono-num ${
              deckTab === 'lobby'
                ? 'active'
                : room.lobby.length > 0
                ? 'text-[var(--warn)]'
                : ''
            }`}
          >
            Waiting ({room.lobby.length})
          </button>
          {room.watchMode === 'gamer' && (
            <button
              type="button"
              role="tab"
              aria-selected={deckTab === 'squad'}
              onClick={() => {
                setDeckTab('squad');
                setCollapsed(false);
              }}
              className={`gather-seg-btn font-mono-num ${deckTab === 'squad' ? 'active' : ''}`}
            >
              Squad ({room.squadQueue.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {deckTab === 'scenes' && isHost && !collapsed && (
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[11px] text-[var(--ink-3)] mr-1">Transition</span>
              {(['cut', 'dissolve', 'slide', 'push'] as TransitionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChangeTransition(t, room.scene.transitionMs)}
                  className={`h-6 px-2.5 rounded-[6px] text-[11px] font-semibold capitalize whitespace-nowrap cursor-pointer transition-colors ${
                    room.scene.transitionType === t
                      ? 'gather-btn-primary text-white'
                      : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {deckTab === 'stingers' && !collapsed && onOpenStingers && (
            <button
              type="button"
              onClick={onOpenStingers}
              className="h-7 px-2.5 rounded-[7px] gather-btn-primary text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Upload / Record FX</span>
            </button>
          )}

          {isHost && (
            <button
              type="button"
              onClick={onToggleLock}
              className={`h-7 px-2.5 rounded-[7px] border text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                room.isLocked
                  ? 'border-[var(--warn)]/45 text-[var(--warn)] bg-[var(--warn)]/12'
                  : 'border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
              }`}
            >
              {room.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{room.isLocked ? 'Locked' : 'Lock room'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand deck' : 'Collapse deck'}
            className="h-7 w-7 grid place-items-center rounded-[6px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                collapsed ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Gather v5 Fixed-Height Deck Body (112px) */}
      {!collapsed && (
        <div className="h-[112px] flex items-stretch overflow-x-auto overflow-y-hidden gather-scroll pt-0.5">
          {/* SCENES LAYER (Built-in + Saved Custom Scene Presets) */}
          {deckTab === 'scenes' && (
            <div className="flex items-stretch gap-2.5">
              {templates.map((tpl, idx) => {
                const active = room.scene.templateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={!isHost}
                    onClick={() => onSelectScene(tpl.id)}
                    className={`shrink-0 w-[132px] p-1.5 rounded-[10px] border flex flex-col justify-between gap-1.5 text-left transition-all cursor-pointer gather-card-hover ${
                      active
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                        : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <ScenePreviewThumb id={tpl.id} />
                    <div className="flex items-center justify-between gap-1 px-0.5 min-w-0">
                      <span className="text-[12px] font-semibold truncate">{tpl.name}</span>
                      {idx < 4 && (
                        <span className="text-[10px] font-mono-num text-[var(--ink-3)] shrink-0">
                          {idx + 1}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {(() => {
                const mergedPresets =
                  savedPresets.length > 0 ? savedPresets : room.scene.savedPresets || [];
                return mergedPresets
                  .filter((p) => p.aspect === room.aspectRatio)
                  .map((preset) => {
                    const active = room.scene.templateId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`group relative shrink-0 w-[136px] p-1.5 rounded-[10px] border flex flex-col justify-between gap-1.5 text-left transition-all gather-card-hover ${
                          active
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                            : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={!isHost}
                          onClick={() =>
                            onApplyCustomPreset
                              ? onApplyCustomPreset(preset)
                              : onSelectScene(preset.id)
                          }
                          className="w-full text-left flex flex-col gap-1.5 cursor-pointer"
                        >
                          <ScenePreviewThumb
                            id={preset.id}
                            elements={preset.elements}
                            bannerVisible={preset.bannerVisible}
                          />
                          <div className="flex items-center justify-between gap-1 px-0.5 min-w-0">
                            <span className="text-[12px] font-semibold truncate">{preset.name}</span>
                            <span className="text-[9px] font-mono-num text-[var(--cyan)] shrink-0">
                              Saved
                            </span>
                          </div>
                        </button>
                        {isHost && onDeleteCustomPreset && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCustomPreset(preset.id);
                            }}
                            aria-label={`Delete preset ${preset.name}`}
                            className="absolute top-2 right-2 h-5 w-5 rounded-[5px] bg-black/75 text-white/80 hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 grid place-items-center transition-opacity cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  });
              })()}

              {isHost && onSaveCustomPreset && (
                creatingPreset ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const clean = presetNameDraft.trim().slice(0, 36);
                      if (!clean) return;
                      onSaveCustomPreset(clean);
                      setPresetNameDraft('');
                      setCreatingPreset(false);
                    }}
                    className="shrink-0 w-[184px] p-2 rounded-[10px] border border-[var(--accent-line)] bg-[var(--fill-hover)] flex flex-col justify-between gap-1.5"
                  >
                    <input
                      type="text"
                      value={presetNameDraft}
                      onChange={(e) => setPresetNameDraft(e.target.value)}
                      placeholder="Preset name..."
                      maxLength={36}
                      autoFocus
                      className="w-full h-7 px-2 rounded-[6px] bg-[var(--bg)]/85 border border-[var(--glass-border)] text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="submit"
                        disabled={!presetNameDraft.trim()}
                        className="flex-1 h-7 rounded-[6px] gather-btn-primary text-[11px] font-semibold text-white cursor-pointer disabled:opacity-45"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingPreset(false);
                          setPresetNameDraft('');
                        }}
                        aria-label="Cancel preset creation"
                        className="h-7 w-7 grid place-items-center rounded-[6px] bg-[var(--bg)]/70 border border-[var(--glass-border)] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingPreset(true)}
                    className="shrink-0 w-[124px] rounded-[10px] border border-dashed border-[var(--line-2)] hover:border-[var(--accent)] flex flex-col items-center justify-center gap-1.5 text-xs font-semibold text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[var(--accent-text)]" />
                    <span>Save Preset</span>
                  </button>
                )
              )}
            </div>
          )}

          {/* PEOPLE LAYER */}
          {deckTab === 'crew' && (
            <div className="flex items-stretch gap-2.5">
              {room.participants.map((p) => (
                <div
                  key={p.id}
                  className={`group shrink-0 w-[144px] p-1.5 rounded-[10px] border flex flex-col justify-between gap-1.5 transition-colors ${
                    p.onStage
                      ? 'bg-[var(--fill)] border-[var(--live)]/55'
                      : 'bg-[var(--fill)] border-[var(--glass-border)] opacity-85'
                  }`}
                >
                  <div
                    onClick={() => isHost && onToggleParticipantStage(p.id, !p.onStage)}
                    className={`relative aspect-video rounded-[6px] overflow-hidden bg-[#101b3a] grid place-items-center ${
                      isHost ? 'cursor-pointer' : ''
                    }`}
                  >
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full gather-btn-primary text-xs font-display font-bold grid place-items-center">
                        {p.initials}
                      </span>
                    )}
                    <span className="absolute left-1.5 top-1.5 text-[10px] font-mono-num font-semibold px-1.5 py-0.5 rounded bg-black/65 text-white">
                      {p.onStage ? 'Stage' : 'Backstage'}
                    </span>

                    {isHost && p.id !== localClientId && (
                      <div className="absolute right-1 bottom-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAskMuteParticipant(p.id);
                          }}
                          aria-label={`Mute ${p.name}`}
                          className="h-6 w-6 grid place-items-center rounded-[5px] bg-black/75 text-white hover:bg-[var(--accent)] cursor-pointer"
                        >
                          <MicOff className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onKickParticipant(p.id);
                          }}
                          aria-label={`Remove ${p.name}`}
                          className="h-6 w-6 grid place-items-center rounded-[5px] bg-black/75 text-[var(--danger)] hover:bg-[var(--live)] hover:text-white cursor-pointer"
                        >
                          <UserMinus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="px-0.5 min-w-0 flex items-center justify-between gap-1">
                    <span className="text-[12px] font-semibold text-[var(--ink)] truncate">
                      {p.name}
                    </span>
                    {!p.micOn && <MicOff className="w-3 h-3 text-[var(--danger)] shrink-0" />}
                  </div>
                </div>
              ))}

              {onOpenInvite && room.participants.length < 6 && (
                <button
                  type="button"
                  onClick={onOpenInvite}
                  className="shrink-0 w-[132px] rounded-[10px] border border-dashed border-[var(--line-2)] hover:border-[var(--accent)] flex flex-col items-center justify-center gap-1.5 text-xs font-semibold text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Invite guest</span>
                </button>
              )}
            </div>
          )}

          {/* STINGERS LAYER */}
          {deckTab === 'stingers' && (
            <div className="flex items-stretch gap-2">
              {customStingers.map((item) => {
                const isPlaying = activeAudioIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => audioEngine.playCustomStinger(item.id)}
                    className={`shrink-0 w-[148px] p-2.5 rounded-[10px] border flex flex-col justify-between text-left transition-all cursor-pointer gather-card-hover ${
                      isPlaying
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                        : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--accent-line)] text-[var(--ink)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono-num text-[var(--accent-text)] font-semibold">
                        CUSTOM · {item.durationSec}s
                      </span>
                      {isPlaying ? (
                        <Square className="w-3 h-3 text-[var(--accent-text)] fill-current" />
                      ) : (
                        <Play className="w-3 h-3 text-[var(--accent-text)] fill-current" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold truncate">{item.name}</div>
                      <div className="text-[11px] text-[var(--ink-3)]">
                        {item.loop ? 'Loop · Master Bus' : 'Master Audio Bus'}
                      </div>
                    </div>
                  </button>
                );
              })}

              {PRESET_STINGER_PADS.map((pad) => {
                const isPlaying = activeAudioIds.includes(`pad:${pad.id}`);
                return (
                  <button
                    key={pad.id}
                    type="button"
                    onClick={() => audioEngine.playStinger(pad.id)}
                    className={`shrink-0 w-[142px] p-2.5 rounded-[10px] border flex flex-col justify-between text-left transition-all cursor-pointer gather-card-hover ${
                      isPlaying
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)]'
                        : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--glass-border)] text-[var(--ink)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono-num text-[var(--ink-3)]">
                        {pad.durationLabel}
                      </span>
                      {isPlaying ? (
                        <Square className="w-3 h-3 text-[var(--accent-text)] fill-current" />
                      ) : (
                        <Play className="w-3 h-3 text-[var(--ink-2)] fill-current" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold truncate">{pad.label}</div>
                      <div className="text-[11px] text-[var(--ink-3)] truncate">{pad.hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* AUDIENCE Q&A STAGE SPOTLIGHT LAYER */}
          {deckTab === 'qa' && (
            <div className="flex items-stretch gap-2.5">
              {sortedQuestions.length === 0 ? (
                <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Audience questions from the Watch Page appear here sorted by upvotes.</span>
                </div>
              ) : (
                sortedQuestions.map((q) => {
                  const isFeatured = room.overlays.featuredQuestionId === q.id;
                  return (
                    <div
                      key={q.id}
                      className={`shrink-0 w-[260px] p-2.5 rounded-[10px] border flex flex-col justify-between gap-1.5 ${
                        isFeatured
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-line)]'
                          : 'bg-[var(--fill)] border-[var(--glass-border)]'
                      }`}
                    >
                      <p className="text-xs text-[var(--ink)] line-clamp-2 leading-snug">{q.text}</p>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-[var(--ink-3)] inline-flex items-center gap-1 truncate">
                          <ThumbsUp className="w-3 h-3 text-[var(--cyan)] shrink-0" />
                          <span className="font-mono-num font-bold text-[var(--ink)]">{q.upvotes}</span>
                          <span className="truncate">· {q.author}</span>
                        </span>
                        {isHost && onFeatureQuestion && (
                          <button
                            type="button"
                            onClick={() => onFeatureQuestion(isFeatured ? null : q.id)}
                            className={`h-6 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                              isFeatured
                                ? 'gather-btn-primary text-white'
                                : 'bg-[var(--bg)]/70 border border-[var(--glass-border)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {isFeatured ? 'On Stage' : 'Stage Q&A'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* DISCORD-STYLE AUDIENCE RAISE-HAND STAGE CALL-INS */}
          {deckTab === 'callins' && (
            <div className="flex items-stretch gap-2.5">
              {(room.handRaiseQueue || []).length === 0 ? (
                <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
                  <Hand className="w-3.5 h-3.5 text-[var(--cyan)]" />
                  <span>
                    Viewers who raise their hand on the Watch Page appear here for 1-click stage call-ins.
                  </span>
                </div>
              ) : (
                (room.handRaiseQueue || []).map((entry) => (
                  <div
                    key={entry.id}
                    className="shrink-0 w-[264px] p-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--cyan)]/40 flex flex-col justify-between gap-1.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--ink)] truncate">
                        {entry.name}
                      </div>
                      <p className="text-[11px] text-[var(--ink-3)] truncate">{entry.topic}</p>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      {isHost && onPromoteHand && (
                        <button
                          type="button"
                          onClick={() => onPromoteHand(entry.id)}
                          className="h-6 px-2.5 rounded-[6px] gather-btn-primary text-white text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Invite to Stage
                        </button>
                      )}
                      {isHost && onLowerHand && (
                        <button
                          type="button"
                          onClick={() => onLowerHand(entry.id)}
                          aria-label="Dismiss hand raise"
                          className="h-6 w-6 grid place-items-center rounded-[6px] bg-[var(--surface-2)] text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* WAITING LOBBY LAYER */}
          {deckTab === 'lobby' && (
            <div className="flex items-center gap-3">
              {room.lobby.length === 0 ? (
                <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>No guests waiting. Lock the room to screen guests in the Green Room.</span>
                </div>
              ) : (
                room.lobby.map((req) => (
                  <div
                    key={req.id}
                    className="shrink-0 w-[240px] p-3 rounded-[10px] bg-[var(--fill)] border border-[var(--warn)]/45 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--ink)] truncate">
                        {req.name}
                      </div>
                      <div className="text-[11px] text-[var(--ink-3)]">Knocking to join</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAdmitGuest(req.id)}
                        className="h-7 px-2.5 rounded-[6px] gather-btn-tip text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Admit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDenyGuest(req.id)}
                        aria-label="Deny"
                        className="h-7 w-7 grid place-items-center rounded-[6px] bg-[var(--surface-2)] text-[var(--danger)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SQUAD QUEUE LAYER (Strictly Only When watchMode === 'gamer') */}
          {deckTab === 'squad' && room.watchMode === 'gamer' && (
            <div className="flex items-center gap-3">
              {room.squadQueue.length === 0 ? (
                <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Viewers in Gaming Arena can submit gamertags to join your Squad Queue.</span>
                </div>
              ) : (
                room.squadQueue.map((sq) => (
                  <div
                    key={sq.id}
                    className="shrink-0 px-3.5 py-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--glass-border)] flex items-center gap-3"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[var(--ink)]">{sq.handle}</div>
                      <div className="text-[11px] text-[var(--ink-3)]">{sq.platform}</div>
                    </div>
                    {isHost && (
                      <button
                        type="button"
                        onClick={() => onRemoveSquadEntry(sq.id)}
                        aria-label="Remove from queue"
                        className="h-7 w-7 grid place-items-center rounded-[6px] bg-[var(--surface-2)] text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ----------------------------------------------------------------
   Gather v5 76px Vertical Icon Rail
   ---------------------------------------------------------------- */
interface RightRailProps {
  activeTab: ConsoleTab;
  panelOpen: boolean;
  aiBusy?: boolean;
  onSelectTab: (tab: ConsoleTab) => void;
  onTogglePanel: () => void;
}

export const RightRail: React.FC<RightRailProps> = ({
  activeTab,
  panelOpen,
  aiBusy = false,
  onSelectTab,
  onTogglePanel,
}) => {
  const railItems: Array<{ id: ConsoleTab; label: string; icon: React.ReactNode }> = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-[18px] h-[18px]" /> },
    {
      id: 'ai',
      label: 'Cue AI',
      icon: <span className={`gather-orb ${aiBusy ? 'busy' : ''}`} />,
    },
    { id: 'show', label: 'Show', icon: <Layers className="w-[18px] h-[18px]" /> },
    { id: 'shop', label: 'Payouts', icon: <ShoppingBag className="w-[18px] h-[18px]" /> },
    { id: 'look', label: 'Look', icon: <Palette className="w-[18px] h-[18px]" /> },
  ];

  return (
    <nav
      aria-label="Studio panels"
      className="hidden lg:flex w-[76px] shrink-0 flex-col items-center gap-1 py-2.5 px-1.5 rounded-[12px] gather-glass"
    >
      {railItems.map((item) => {
        const active = panelOpen && activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`w-[62px] py-2 rounded-[9px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              active
                ? 'bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[var(--ink)]'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
            }`}
          >
            <span className={active ? 'text-[var(--accent-text)]' : ''}>{item.icon}</span>
            <span className="text-[11px] font-semibold whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onTogglePanel}
        aria-label={panelOpen ? 'Hide side panel' : 'Show side panel'}
        className="mt-auto w-[62px] py-2 rounded-[9px] flex flex-col items-center justify-center gap-1 text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors cursor-pointer"
      >
        {panelOpen ? (
          <ChevronRight className="w-[18px] h-[18px]" />
        ) : (
          <ChevronLeft className="w-[18px] h-[18px]" />
        )}
        <span className="text-[11px] font-semibold whitespace-nowrap">
          {panelOpen ? 'Hide' : 'Open'}
        </span>
      </button>
    </nav>
  );
};

/* ----------------------------------------------------------------
   Gather v5 Bottom Broadcast Transport Dock
   ---------------------------------------------------------------- */
interface BottomDockProps {
  roomCode: string;
  isHost: boolean;
  micOn: boolean;
  camOn: boolean;
  sharingScreen: boolean;
  isRecording: boolean;
  mixerOpen: boolean;
  stingersOpen: boolean;
  editMode: boolean;
  cmdBarOpen: boolean;
  teleprompterOpen?: boolean;
  safeZone916?: boolean;
  aiBusy?: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
  onPickMediaFile: () => void;
  onToggleRecord: () => void;
  onSaveReplayClip: () => void;
  onToggleMixer: () => void;
  onToggleStingers: () => void;
  onToggleEditMode: () => void;
  onToggleCmdBar: () => void;
  onOpenAiMedia?: () => void;
  onToggleTeleprompter?: () => void;
  onOpenPodcastHub?: () => void;
  onToggleSafeZone916?: () => void;
  onLeaveStudio: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  roomCode,
  isHost,
  micOn,
  camOn,
  sharingScreen,
  isRecording,
  mixerOpen,
  stingersOpen,
  editMode,
  cmdBarOpen,
  teleprompterOpen = false,
  safeZone916 = false,
  aiBusy = false,
  onToggleMic,
  onToggleCam,
  onToggleScreen,
  onPickMediaFile,
  onToggleRecord,
  onSaveReplayClip,
  onToggleMixer,
  onToggleStingers,
  onToggleEditMode,
  onToggleCmdBar,
  onOpenAiMedia,
  onToggleTeleprompter,
  onOpenPodcastHub,
  onToggleSafeZone916,
  onLeaveStudio,
}) => {
  const [presentMenuOpen, setPresentMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playingCount, setPlayingCount] = useState(() => audioEngine.getActiveIds().length);
  const presentWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return audioEngine.subscribe(() => {
      setPlayingCount(audioEngine.getActiveIds().length);
    });
  }, []);

  useEffect(() => {
    if (!presentMenuOpen) return;
    const onPointerDown = (ev: MouseEvent) => {
      if (presentWrapRef.current && !presentWrapRef.current.contains(ev.target as Node)) {
        setPresentMenuOpen(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setPresentMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [presentMenuOpen]);

  const stackedBtn =
    'relative h-[48px] min-w-[60px] px-2.5 rounded-[9px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

  return (
    <footer className="relative shrink-0 rounded-[12px] gather-glass px-3 py-1.5 flex items-center justify-between gap-4">
      {/* Left Hardware-Inspired Transport Tools */}
      <div className="flex items-center gap-0.5 overflow-x-auto gather-scroll">
        <button
          type="button"
          onClick={onToggleMic}
          title="Toggle Microphone (M)"
          className={`${stackedBtn} ${
            micOn
              ? 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
              : 'gather-btn-live'
          }`}
        >
          {micOn ? <Mic className="w-[17px] h-[17px]" /> : <MicOff className="w-[17px] h-[17px]" />}
          <span>{micOn ? 'Mic' : 'Muted'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleCam}
          title="Toggle Camera (V)"
          className={`${stackedBtn} ${
            camOn
              ? 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
              : 'gather-btn-live'
          }`}
        >
          {camOn ? (
            <Camera className="w-[17px] h-[17px]" />
          ) : (
            <CameraOff className="w-[17px] h-[17px]" />
          )}
          <span>{camOn ? 'Camera' : 'Cam off'}</span>
        </button>

        {/* Present Menu */}
        <div ref={presentWrapRef} className="relative">
          <button
            type="button"
            onClick={() => setPresentMenuOpen((v) => !v)}
            className={`${stackedBtn} ${
              sharingScreen || presentMenuOpen
                ? 'text-[var(--ink)] bg-[var(--accent-soft)]'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
            }`}
          >
            <MonitorUp className="w-[17px] h-[17px]" />
            <span>{sharingScreen ? 'Sharing' : 'Present'}</span>
          </button>

          {presentMenuOpen && (
            <div className="absolute bottom-14 left-0 z-50 w-64 p-1.5 rounded-[12px] gather-glass-elevated divide-y divide-[var(--line)] animate-gather-modal">
              <button
                type="button"
                onClick={() => {
                  setPresentMenuOpen(false);
                  onToggleScreen();
                }}
                className="w-full p-2.5 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-start gap-2.5 cursor-pointer"
              >
                <MonitorUp className="w-4 h-4 text-[var(--accent-text)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[var(--ink)]">
                    {sharingScreen ? 'Stop screen share' : 'Share screen'}
                  </div>
                  <div className="text-[11px] text-[var(--ink-3)]">
                    Window, game, or browser tab
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPresentMenuOpen(false);
                  onPickMediaFile();
                }}
                className="w-full p-2.5 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-start gap-2.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-[var(--accent-text)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[var(--ink)]">Present slides / PDF</div>
                  <div className="text-[11px] text-[var(--ink-3)]">Page-by-page PDF deck</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPresentMenuOpen(false);
                  onPickMediaFile();
                }}
                className="w-full p-2.5 rounded-[7px] hover:bg-[var(--fill-hover)] text-left flex items-start gap-2.5 cursor-pointer"
              >
                <Video className="w-4 h-4 text-[var(--accent-text)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[var(--ink)]">Play video or image</div>
                  <div className="text-[11px] text-[var(--ink-3)]">MP4, WebM, PNG, or JPG</div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-[var(--line-2)] mx-1.5 shrink-0" />

        <button
          type="button"
          onClick={onToggleMixer}
          title="Pro Audio Mix Bus"
          className={`${stackedBtn} ${
            mixerOpen
              ? 'text-[var(--ink)] bg-[var(--accent-soft)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
          }`}
        >
          <Sliders className="w-[17px] h-[17px]" />
          <span>Mixer</span>
        </button>

        {/* Dedicated Studio Control for Custom Stingers & Audio Effects */}
        <button
          type="button"
          onClick={onToggleStingers}
          title="Custom Stingers & Broadcast Audio FX (S)"
          className={`${stackedBtn} ${
            stingersOpen || playingCount > 0
              ? 'text-[var(--ink)] bg-[var(--accent-soft)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
          }`}
        >
          <Music2 className="w-[17px] h-[17px] text-[var(--accent-text)]" />
          <span className="font-mono-num">
            {playingCount > 0 ? `Stingers (${playingCount})` : 'Stingers'}
          </span>
        </button>

        {isHost && (
          <button
            type="button"
            onClick={onToggleEditMode}
            className={`${stackedBtn} ${
              editMode
                ? 'text-[var(--ink)] bg-[var(--accent-soft)]'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
            }`}
          >
            <Move className="w-[17px] h-[17px]" />
            <span>Layout</span>
          </button>
        )}

        <button
          type="button"
          onClick={onSaveReplayClip}
          className={`${stackedBtn} text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]`}
        >
          <Clapperboard className="w-[17px] h-[17px]" />
          <span>Clip 30s</span>
        </button>

        <button
          type="button"
          onClick={onToggleRecord}
          className={`${stackedBtn} ${
            isRecording
              ? 'gather-btn-live'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
          }`}
        >
          {isRecording ? (
            <Square className="w-4 h-4 fill-current" />
          ) : (
            <Circle className="w-4 h-4 fill-[var(--live)] text-[var(--live)]" />
          )}
          <span>{isRecording ? 'Stop rec' : 'Record'}</span>
        </button>

        {onOpenAiMedia && (
          <button
            type="button"
            onClick={onOpenAiMedia}
            title="AI PDF Slide Cues, Stage Graphics & Viral Magic Clips"
            className={`${stackedBtn} text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]`}
          >
            <Sparkles className="w-[17px] h-[17px] text-[var(--accent-text)]" />
            <span>AI Media</span>
          </button>
        )}

        {onToggleTeleprompter && (
          <button
            type="button"
            onClick={onToggleTeleprompter}
            title="Voice-Synced Eye-Line Teleprompter"
            className={`${stackedBtn} ${
              teleprompterOpen
                ? 'bg-[var(--accent-soft)] text-[var(--ink)]'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
            }`}
          >
            <FileText className="w-[17px] h-[17px]" />
            <span>Prompter</span>
          </button>
        )}

        {onOpenPodcastHub && (
          <button
            type="button"
            onClick={onOpenPodcastHub}
            title="Audio-Only WAV Recorder & Spotify / Apple Podcast RSS Feed"
            className={`${stackedBtn} text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]`}
          >
            <Rss className="w-[17px] h-[17px] text-[var(--ok)]" />
            <span>Podcast</span>
          </button>
        )}

        {isHost && onToggleSafeZone916 && (
          <button
            type="button"
            onClick={onToggleSafeZone916}
            title="Preview 9:16 Vertical Safe Frame"
            className={`${stackedBtn} ${
              safeZone916
                ? 'bg-[var(--accent-soft)] text-[var(--ink)]'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
            }`}
          >
            <Smartphone className="w-[17px] h-[17px]" />
            <span>9:16 Safe</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCmdBar}
          title="Cue AI Producer (/)"
          className={`${stackedBtn} ${
            cmdBarOpen
              ? 'bg-[var(--accent-soft)] text-[var(--ink)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
          }`}
        >
          <span className={`gather-orb ${aiBusy ? 'busy' : ''}`} />
          <span>AI Cue</span>
        </button>
      </div>

      {/* Center Room Code & Copy Invite */}
      <div className="hidden md:flex items-center justify-center gap-2 text-xs text-[var(--ink-3)] font-mono-num">
        <span>Room {roomCode}</span>
        <span>·</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(`${window.location.origin}/?join=${roomCode}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="inline-flex items-center gap-1 text-[var(--accent-text)] hover:underline whitespace-nowrap cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Invite copied' : 'Copy invite'}</span>
        </button>
      </div>

      {/* Right Leave Button */}
      <button
        type="button"
        onClick={onLeaveStudio}
        aria-label="Leave studio"
        className="h-[42px] px-3.5 rounded-[9px] bg-[var(--fill)] hover:bg-[var(--live)] hover:text-white border border-[var(--glass-border)] text-xs font-semibold text-[var(--ink-2)] inline-flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
      >
        <PhoneOff className="w-4 h-4" />
        <span className="hidden sm:inline">Leave</span>
      </button>
    </footer>
  );
};
