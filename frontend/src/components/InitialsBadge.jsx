import React from 'react';

/**
 * Small circular badge showing the first 2 letters of a username, in that user's color.
 * Used to show "who edited this" across the app.
 *
 * Props:
 *  - username: string  (e.g. 'rutvij0213')
 *  - color: string     (hex, falls back to slate gray)
 *  - title: string     (optional tooltip — defaults to username)
 *  - size: 'xs' | 'sm' | 'md'  (default 'sm')
 *  - testId
 */
const InitialsBadge = ({ username, color, title, size = 'sm', testId }) => {
  const isSystem = !username || username === 'system' || username === 'anonymous';
  const display = isSystem ? 'sys' : (username.slice(0, 2).toUpperCase());
  const bg = isSystem ? '#94A3B8' : (color || '#0F3D2A');

  const dims = size === 'xs'
    ? { w: 20, h: 20, fs: 9 }
    : size === 'md'
    ? { w: 32, h: 32, fs: 12 }
    : { w: 24, h: 24, fs: 10 };

  return (
    <span
      title={title || (isSystem ? 'System / unknown user' : `Edited by ${username}`)}
      data-testid={testId}
      data-username={username || 'system'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dims.w,
        height: dims.h,
        borderRadius: '50%',
        background: bg,
        color: '#fff',
        fontSize: dims.fs,
        fontWeight: 700,
        letterSpacing: '0.5px',
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
      }}
    >
      {display}
    </span>
  );
};

export default InitialsBadge;
