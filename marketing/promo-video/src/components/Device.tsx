import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F } from '../theme';

/**
 * Browser-chrome frame around a real product screenshot.
 * The label is the actual extension surface being shown — no invented URLs.
 */
export const Device: React.FC<{
  src: string;
  label: string;
  delay?: number;
  width?: number;
  /** Slow push-in. Keep small; large values read as cheap. */
  zoom?: number;
  focus?: { x: number; y: number };
}> = ({ src, label, delay = 0, width = 1180, zoom = 0.045, focus }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, mass: 0.9, stiffness: 90 },
  });

  const local = Math.max(0, frame - delay);
  const scale = interpolate(p, [0, 1], [0.955, 1]) * (1 + local * (zoom / 260));
  const originX = focus ? focus.x : 50;
  const originY = focus ? focus.y : 50;

  return (
    <div
      style={{
        width,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [46, 0])}px) scale(${scale})`,
        transformOrigin: `${originX}% ${originY}%`,
        borderRadius: 20,
        overflow: 'hidden',
        border: `1px solid rgba(248,250,247,0.14)`,
        background: '#1B0C11',
        boxShadow:
          '0 60px 140px -30px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.4), 0 0 90px -40px rgba(250,226,97,0.25)',
      }}
    >
      <div
        style={{
          height: 46,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 18px',
          borderBottom: `1px solid rgba(248,250,247,0.08)`,
          background: 'rgba(248,250,247,0.04)',
        }}
      >
        {['#FF6B6B', '#FBC02D', '#5DD39E'].map((c) => (
          <span
            key={c}
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: c,
              opacity: 0.55,
            }}
          />
        ))}
        <span
          style={{
            marginLeft: 16,
            fontFamily: F.mono,
            fontSize: 16,
            letterSpacing: '0.08em',
            color: C.muted,
          }}
        >
          {label}
        </span>
      </div>
      <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
    </div>
  );
};
