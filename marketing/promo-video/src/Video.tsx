import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { FontLoader } from './fonts';
import {
  Architecture,
  Audience,
  ColdOpen,
  Close,
  Problem,
  Recap,
  Reveal,
  Status,
  Tracking,
} from './scenes';
import { C } from './theme';

/**
 * Timeline. Scenes are butted together and cross-dissolve via their own edge
 * fades (see components/Scene.tsx), so these numbers are the single source of
 * truth for pacing.
 */
const TIMELINE = [
  { C: ColdOpen, from: 0, dur: 130 },
  { C: Problem, from: 130, dur: 160 },
  { C: Reveal, from: 290, dur: 150 },
  { C: Tracking, from: 440, dur: 260 },
  { C: Recap, from: 700, dur: 240 },
  { C: Architecture, from: 940, dur: 290 },
  { C: Audience, from: 1230, dur: 190 },
  { C: Status, from: 1420, dur: 200 },
  { C: Close, from: 1620, dur: 240 },
] as const;

export const TOTAL_FRAMES = 1860;

export const TaskerVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bgDeep }}>
    <FontLoader />
    {TIMELINE.map(({ C: Comp, from, dur }, i) => (
      <Sequence key={i} from={from} durationInFrames={dur}>
        <Comp durationInFrames={dur} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
