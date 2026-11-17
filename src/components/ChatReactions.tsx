import React from 'react';
import { CHAT_REACTION_EMOJIS } from '../types/studio';

const REACTION_LABELS: Record<string, string> = {
  '❤️': 'Heart',
  '🔥': 'Fire',
  '😮': 'Wow',
  '👏': 'Clap',
  '😂': 'Laugh',
};

interface HoverReactionMenuProps {
  reactions?: Record<string, string[]>;
  actorId: string;
  onSelect: (emoji: string) => void;
  className?: string;
}

export const HoverReactionMenu: React.FC<HoverReactionMenuProps> = ({
  reactions,
  actorId,
  onSelect,
  className = '',
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Add reaction"
      className={`absolute -top-2.5 right-2 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full gather-glass-elevated opacity-0 translate-y-0.5 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:translate-y-0 focus-within:pointer-events-auto transition-all duration-150 ${className}`}
    >
      {CHAT_REACTION_EMOJIS.map((emoji) => {
        const users = reactions?.[emoji] || [];
        const active = users.includes(actorId);
        const label = REACTION_LABELS[emoji] || emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(emoji);
            }}
            aria-label={`React with ${label}`}
            aria-pressed={active}
            title={label}
            className={`w-6 h-6 rounded-full grid place-items-center text-[13px] leading-none cursor-pointer transition-transform duration-150 hover:scale-115 active:scale-95 ${
              active
                ? 'bg-[var(--accent-soft)] ring-1 ring-[var(--accent-line)]'
                : 'hover:bg-[var(--fill-hover)]'
            }`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
};

interface ReactionBadgeRowProps {
  reactions?: Record<string, string[]>;
  actorId: string;
  onToggle?: (emoji: string) => void;
}

export const ReactionBadgeRow: React.FC<ReactionBadgeRowProps> = ({
  reactions,
  actorId,
  onToggle,
}) => {
  if (!reactions) return null;
  const entries = Object.entries(reactions).filter(([, list]) => Array.isArray(list) && list.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 pt-0.5">
      {entries.map(([emoji, list]) => {
        const active = list.includes(actorId);
        const label = REACTION_LABELS[emoji] || emoji;
        return (
          <button
            key={emoji}
            type="button"
            disabled={!onToggle}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(emoji);
            }}
            aria-label={`${label}: ${list.length}`}
            aria-pressed={active}
            className={`h-[22px] px-1.5 rounded-[7px] text-[11px] inline-flex items-center gap-1 border transition-colors whitespace-nowrap shrink-0 ${
              onToggle ? 'cursor-pointer' : 'cursor-default'
            } ${
              active
                ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)] font-semibold'
                : 'bg-[var(--fill)] hover:bg-[var(--fill-hover)] border-[var(--line)] text-[var(--ink-2)]'
            }`}
          >
            <span className="leading-none text-[12px]">{emoji}</span>
            <span className="font-mono-num text-[10.5px]">{list.length}</span>
          </button>
        );
      })}
    </div>
  );
};
