import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { PAD } from '../theme';

/**
 * Every scene fades at its own edges, so scenes can be butted together in the
 * timeline and still cross-dissolve without a transition library.
 */
export const Scene: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
  fadeIn?: number;
  fadeOut?: number;
  center?: boolean;
  style?: React.CSSProperties;
}> = ({
  children,
  durationInFrames,
  fadeIn = 14,
  fadeOut = 16,
  center = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        opacity,
        padding: PAD,
        justifyContent: 'center',
        alignItems: center ? 'center' : 'flex-start',
        textAlign: center ? 'center' : 'left',
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
