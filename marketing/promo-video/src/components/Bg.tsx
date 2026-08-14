import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { C } from '../theme';

/**
 * Presentation surface: two slow-drifting radial glows, a vignette and an
 * animated grain plate. Deliberately low-contrast — it should never compete
 * with the type or the product screenshots.
 */
export const Bg: React.FC<{ tint?: string; intensity?: number }> = ({
  tint = C.purple,
  intensity = 1,
}) => {
  const frame = useCurrentFrame();

  const drift = (seed: number, range: number) =>
    Math.sin((frame + seed * 220) / 210) * range;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(58% 62% at ${28 + drift(1, 5)}% ${
            24 + drift(2, 6)
          }%, ${tint}2E 0%, transparent 62%)`,
          opacity: intensity,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(52% 56% at ${76 + drift(3, 6)}% ${
            74 + drift(4, 5)
          }%, ${C.yellow}1C 0%, transparent 60%)`,
          opacity: intensity,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 120% at 50% 50%, transparent 42%, ${C.bgDeep}D9 100%)`,
        }}
      />
      <Grain />
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  // Re-seed a few times a second so the grain shimmers rather than crawls.
  const seed = Math.floor(frame / 2);
  const dots = new Array(150).fill(0).map((_, i) => ({
    x: random(`x${seed}-${i}`) * 100,
    y: random(`y${seed}-${i}`) * 100,
    o: interpolate(random(`o${seed}-${i}`), [0, 1], [0.015, 0.055]),
    r: interpolate(random(`r${seed}-${i}`), [0, 1], [1, 2.4]),
  }));

  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.r / 12}
            fill={C.paper}
            opacity={d.o}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
