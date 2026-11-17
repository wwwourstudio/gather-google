import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';

interface ComposerShareControlProps {
  roomCode: string;
  roomTitle: string;
}

export const ComposerShareControl: React.FC<ComposerShareControlProps> = ({
  roomCode,
  roomTitle,
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const watchUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?watch=${roomCode}`
      : `/?watch=${roomCode}`;
  const shareText = `Watch "${roomTitle || 'Gather Live Broadcast'}" live`;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(watchUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const platforms = [
    {
      name: 'X / Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(watchUrl)}`,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(watchUrl)}`,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93zM6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37z" />
        </svg>
      ),
    },
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${watchUrl}`)}`,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.04 2a9.94 9.94 0 0 0-8.48 15.14L2 22l5-1.31A9.94 9.94 0 1 0 12.04 2m5.79 14.08c-.24.69-1.41 1.31-1.95 1.39-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.18-4.93-4.37-.15-.19-1.18-1.57-1.18-3s.75-2.12 1.01-2.41c.27-.29.58-.36.77-.36h.56c.18 0 .42-.07.66.5.24.58.82 2.02.9 2.17.07.15.12.32.02.51-.09.19-.14.31-.29.48s-.3.38-.43.51c-.14.15-.29.31-.13.6.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.63-.07.17-.2.73-.85.92-1.14.19-.29.39-.24.65-.15.27.1 1.69.8 1.98.94.29.15.48.22.55.34.08.13.08.7-.16 1.39" />
        </svg>
      ),
    },
    {
      name: 'Reddit',
      href: `https://www.reddit.com/submit?url=${encodeURIComponent(watchUrl)}&title=${encodeURIComponent(roomTitle || 'Gather Live Broadcast')}`,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M14.5 15.4c-.6.6-1.5.9-2.5.9s-1.9-.3-2.5-.9a.5.5 0 0 1 .7-.7c.4.4 1.1.6 1.8.6s1.4-.2 1.8-.6a.5.5 0 0 1 .7.7M9.2 13a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4m5.6 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4M22 12c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2s10 4.5 10 10m-3.6-.8c0-.9-.7-1.6-1.6-1.6-.4 0-.8.2-1.1.4-1.1-.8-2.6-1.2-4.2-1.3l.7-3.4 2.4.5a1.1 1.1 0 1 0 .2-.9l-2.8-.6a.4.4 0 0 0-.5.3l-.8 3.9c-1.6.1-3.1.5-4.2 1.3a1.6 1.6 0 0 0-2.7 1.2c0 .6.4 1.2.9 1.4v.5c0 2.5 2.9 4.5 6.5 4.5s6.5-2 6.5-4.5v-.5c.5-.2.9-.8.9-1.4" />
        </svg>
      ),
    },
  ];

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Share Watch Page"
        aria-expanded={open}
        title="Share Watch Page"
        className={`h-7 w-7 shrink-0 grid place-items-center rounded-[7px] cursor-pointer transition-colors ${
          open
            ? 'bg-[var(--accent-soft)] text-[var(--cyan)]'
            : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)]'
        }`}
      >
        <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Share Watch Page"
          className="absolute bottom-full left-0 mb-2.5 z-50 w-[264px] p-3 rounded-[16px] gather-glass-elevated animate-gather-msg space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-editorial text-[13.5px] font-semibold text-[var(--ink)] leading-tight">
                Share Watch Page
              </div>
              <div className="text-[10.5px] text-[var(--ink-3)] font-mono-num truncate">
                {watchUrl}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close share popup"
              className="h-6 w-6 shrink-0 grid place-items-center rounded-[7px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className={`w-full h-8 px-3 rounded-[10px] text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              copied
                ? 'bg-emerald-500/18 border border-emerald-400/35 text-emerald-300'
                : 'gather-btn-primary'
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" strokeWidth={2} />
            ) : (
              <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
            <span>{copied ? 'Copied Watch URL' : 'Copy Watch URL'}</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {platforms.map((p) => (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="h-8 px-2.5 rounded-[10px] gather-liquid-pill text-[11.5px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                {p.icon}
                <span>{p.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
