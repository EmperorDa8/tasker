import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F, SPRING } from '../theme';

/** Shared entrance: rise + fade + a touch of defocus resolving to sharp. */
export const useRise = (delay: number, distance = 26) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: SPRING });
  return {
    opacity: p,
    transform: `translateY(${interpolate(p, [0, 1], [distance, 0])}px)`,
    filter: `blur(${interpolate(p, [0, 1], [10, 0])}px)`,
  };
};

export const Kicker: React.FC<{
  children: React.ReactNode;
  delay?: number;
  color?: string;
}> = ({ children, delay = 0, color = C.yellow }) => {
  const style = useRise(delay, 14);
  return (
    <div
      style={{
        ...style,
        fontFamily: F.mono,
        fontSize: 24,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
      }}
    >
      <span
        style={{
          width: 34,
          height: 2,
          background: color,
          display: 'inline-block',
          borderRadius: 2,
        }}
      />
      {children}
    </div>
  );
};

/** Word-by-word reveal. Keeps long headlines from arriving as a slab. */
export const Headline: React.FC<{
  text: string;
  delay?: number;
  size?: number;
  color?: string;
  accent?: string;
  accentWords?: string[];
  maxWidth?: number;
}> = ({
  text,
  delay = 0,
  size = 104,
  color = C.paper,
  accent = C.yellow,
  accentWords = [],
  maxWidth = 1420,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        maxWidth,
        fontFamily: F.display,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.03,
        letterSpacing: '-0.032em',
        color,
        columnGap: '0.28em',
      }}
    >
      {text.split(' ').map((word, i) => {
        const p = spring({
          frame: frame - delay - i * 2.5,
          fps,
          config: SPRING,
        });
        const isAccent = accentWords.includes(word.replace(/[.,—]/g, ''));
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [38, 0])}px)`,
              filter: `blur(${interpolate(p, [0, 1], [12, 0])}px)`,
              color: isAccent ? accent : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

export const Sub: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  maxWidth?: number;
}> = ({ children, delay = 0, size = 31, maxWidth = 900 }) => {
  const style = useRise(delay, 20);
  return (
    <div
      style={{
        ...style,
        fontFamily: F.sans,
        fontSize: size,
        lineHeight: 1.55,
        color: C.body,
        maxWidth,
      }}
    >
      {children}
    </div>
  );
};

/** Small pill used for factual chips (licence, price, platform). */
export const Chip: React.FC<{
  children: React.ReactNode;
  delay?: number;
  tone?: string;
}> = ({ children, delay = 0, tone = C.paper }) => {
  const style = useRise(delay, 16);
  return (
    <div
      style={{
        ...style,
        fontFamily: F.mono,
        fontSize: 22,
        letterSpacing: '0.06em',
        color: tone,
        border: `1px solid ${C.line}`,
        background: C.surface,
        borderRadius: 999,
        padding: '13px 26px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
};
