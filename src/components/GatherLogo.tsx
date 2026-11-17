import React, { useState } from 'react';

export const GatherLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 26,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={`inline-grid place-items-center rounded-[8px] bg-[var(--accent)] text-white font-display font-extrabold text-xs shrink-0 ${className}`}
      >
        g
      </span>
    );
  }

  return (
    <img
      src="/icon.png"
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 select-none object-contain ${className}`}
    />
  );
};
