import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Bg } from './components/Bg';
import { Device } from './components/Device';
import { Scene } from './components/Scene';
import { Chip, Headline, Kicker, Sub, useRise } from './components/Type';
import { C, F } from './theme';

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

const Bullets: React.FC<{ items: string[]; delay: number; width?: number }> = ({
  items,
  delay,
  width = 640,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 22, width }}>
    {items.map((t, i) => (
      <Bullet key={t} text={t} delay={delay + i * 7} />
    ))}
  </div>
);

const Bullet: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const style = useRise(delay, 18);
  return (
    <div style={{ ...style, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <span
        style={{
          marginTop: 13,
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: C.yellow,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: F.sans,
          fontSize: 26,
          lineHeight: 1.5,
          color: C.body,
        }}
      >
        {text}
      </span>
    </div>
  );
};

const Card: React.FC<{
  title: string;
  body: string;
  tone: string;
  delay: number;
}> = ({ title, body, tone, delay }) => {
  const style = useRise(delay, 30);
  return (
    <div
      style={{
        ...style,
        flex: 1,
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 22,
        padding: '38px 34px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <span
        style={{
          width: 44,
          height: 4,
          borderRadius: 3,
          background: tone,
        }}
      />
      <div
        style={{
          fontFamily: F.display,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: '-0.02em',
          color: C.paper,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: F.sans,
          fontSize: 23,
          lineHeight: 1.5,
          color: C.muted,
        }}
      >
        {body}
      </div>
    </div>
  );
};

const Wordmark: React.FC<{ delay?: number; size?: number }> = ({
  delay = 0,
  size = 74,
}) => {
  const style = useRise(delay, 22);
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 22,
      }}
    >
      <Img
        src={staticFile('icon128.png')}
        style={{ width: size, height: size, borderRadius: '50%' }}
      />
      <span
        style={{
          fontFamily: F.display,
          fontWeight: 600,
          fontSize: size * 0.78,
          letterSpacing: '-0.03em',
          color: C.paper,
        }}
      >
        Tasker
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * 01 — Cold open
 * ------------------------------------------------------------------ */

export const ColdOpen: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => (
  <AbsoluteFill>
    <Bg tint={C.purple} intensity={0.75} />
    <Scene durationInFrames={durationInFrames} center fadeIn={20}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, alignItems: 'center' }}>
        <Headline
          text="“So — what did you get done last month?”"
          delay={10}
          size={92}
          maxWidth={1500}
        />
        <Cursor delay={72} />
      </div>
    </Scene>
  </AbsoluteFill>
);

/** A blinking caret with nothing typed into it. The whole problem, in one mark. */
const Cursor: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const style = useRise(delay, 10);
  const on = Math.floor((frame - delay) / 15) % 2 === 0;
  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', gap: 16 }}>
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 26,
          letterSpacing: '0.14em',
          color: C.muted,
        }}
      >
        your answer
      </span>
      <span
        style={{
          width: 3,
          height: 34,
          background: C.yellow,
          opacity: frame > delay && on ? 1 : 0.12,
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * 02 — The problem
 * ------------------------------------------------------------------ */

const LOST_TABS = [
  'github.com',
  'docs.google.com',
  'figma.com',
  'stackoverflow.com',
  'mail.google.com',
  'notion.so',
  'linear.app',
  'localhost:3000',
];

export const Problem: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Bg tint={C.purple} intensity={0.7} />
      <Scene durationInFrames={durationInFrames}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
          <Kicker delay={0}>The problem</Kicker>
          <Headline text="Almost nobody can." delay={8} size={104} />
          <Sub delay={26} maxWidth={840}>
            Forty tabs a day, five days a week. By the time anyone asks, the evidence has
            evaporated — so the answer gets rebuilt from memory, days later, and it is
            always worse than the truth.
          </Sub>
        </div>

        {/* Tabs drifting up and dissolving — the record disappearing. */}
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          {LOST_TABS.map((d, i) => {
            const start = 20 + i * 9;
            const p = spring({ frame: frame - start, fps, config: { damping: 200 } });
            const life = Math.max(0, frame - start);
            return (
              <div
                key={d}
                style={{
                  position: 'absolute',
                  right: 150 + (i % 3) * 150,
                  top: 190 + i * 78,
                  fontFamily: F.mono,
                  fontSize: 25,
                  color: C.body,
                  background: C.surface,
                  border: `1px solid ${C.line}`,
                  borderRadius: 12,
                  padding: '12px 20px',
                  opacity: p * interpolate(life, [40, 110], [0.85, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                  transform: `translateY(${interpolate(life, [0, 130], [0, -70])}px)`,
                  filter: `blur(${interpolate(life, [50, 120], [0, 7], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })}px)`,
                }}
              >
                {d}
              </div>
            );
          })}
        </AbsoluteFill>
      </Scene>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 * 03 — Reveal
 * ------------------------------------------------------------------ */

export const Reveal: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => (
  <AbsoluteFill>
    <Bg tint={C.yellow} intensity={0.85} />
    <Scene durationInFrames={durationInFrames} center>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 38,
          alignItems: 'center',
        }}
      >
        <Wordmark delay={0} size={82} />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Headline
            text="Your work diary, written while you work."
            delay={14}
            size={96}
            accentWords={['diary,']}
            maxWidth={1400}
          />
        </div>
        <Sub delay={44} maxWidth={960} size={32}>
          A local-first Chrome extension that turns browser time into a daily log and a
          monthly recap — automatically.
        </Sub>
      </div>
    </Scene>
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ *
 * 04 / 05 — Product
 * ------------------------------------------------------------------ */

const SplitScene: React.FC<{
  durationInFrames: number;
  kicker: string;
  headline: string;
  bullets: string[];
  shot: string;
  shotLabel: string;
  tint: string;
}> = ({ durationInFrames, kicker, headline, bullets, shot, shotLabel, tint }) => (
  <AbsoluteFill>
    <Bg tint={tint} intensity={0.7} />
    <Scene durationInFrames={durationInFrames} style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 70,
          width: '100%',
          paddingLeft: 132,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: 660 }}>
          <Kicker delay={0}>{kicker}</Kicker>
          <Headline text={headline} delay={8} size={70} maxWidth={640} />
          <div style={{ height: 6 }} />
          <Bullets items={bullets} delay={30} />
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <Device src={shot} label={shotLabel} delay={16} width={1120} />
        </div>
      </div>
    </Scene>
  </AbsoluteFill>
);

export const Tracking: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => (
  <SplitScene
    durationInFrames={durationInFrames}
    kicker="01 — it records"
    headline="The day gets written down as it happens."
    bullets={[
      'Time on the active tab, attributed to its domain and page title',
      'Sorted automatically across nine activity categories',
      'Idle-aware: the timer pauses when you step away from the machine',
      'Accomplishments logged in the moment, not reconstructed on Friday',
    ]}
    shot="shots/1-overview.png"
    shotLabel="Tasker — Overview"
    tint={C.purple}
  />
);

export const Recap: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => (
  <SplitScene
    durationInFrames={durationInFrames}
    kicker="02 — it reports"
    headline="Then it writes the month for you."
    bullets={[
      'Every day becomes a clean Markdown log',
      'Every month becomes a recap: total focus time, active days, category split',
      'A short written summary of the month, generated for you',
      'Filed into a folder in your own Google Drive',
    ]}
    shot="shots/2-recap.png"
    shotLabel="Tasker — Monthly Recap"
    tint={C.pink}
  />
);

/* ------------------------------------------------------------------ *
 * 06 — Architecture / why it holds up
 * ------------------------------------------------------------------ */

export const Architecture: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => (
  <AbsoluteFill>
    <Bg tint={C.sage} intensity={0.5} />
    <Scene durationInFrames={durationInFrames}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: '100%' }}>
        <Kicker delay={0}>Why it holds up</Kicker>
        <Headline
          text="No backend. Nothing to leak."
          delay={8}
          size={92}
          accentWords={['leak']}
        />
        <Sub delay={30} maxWidth={1080}>
          A time tracker sees your entire working day. This one is built so that day never
          has anywhere else to go.
        </Sub>
        <div style={{ height: 18 }} />
        <div style={{ display: 'flex', gap: 24, width: '100%' }}>
          <Card
            delay={48}
            tone={C.sage}
            title="Stays on the device"
            body="Domains, page titles and durations live in chrome.storage.local. No account, no login, no analytics — there is no server holding your history."
          />
          <Card
            delay={58}
            tone={C.lilac}
            title="Your Drive, not ours"
            body="Optional sync authorises through Google OAuth with the drive.file scope, which can only touch files it created. It cannot read the rest of your Drive."
          />
          <Card
            delay={68}
            tone={C.softYellow}
            title="Only totals ever leave"
            body="The optional AI summary sends aggregate category totals — never URLs, page titles or notes. Switch it off and recaps are generated entirely on-device."
          />
        </div>
      </div>
    </Scene>
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ *
 * 07 — Audience
 * ------------------------------------------------------------------ */

export const Audience: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => (
  <AbsoluteFill>
    <Bg tint={C.lilac} intensity={0.55} />
    <Scene durationInFrames={durationInFrames}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: '100%' }}>
        <Kicker delay={0}>Who it is for</Kicker>
        <Headline
          text="Anyone who has to prove where the time went."
          delay={8}
          size={86}
          maxWidth={1350}
        />
        <div style={{ height: 22 }} />
        <div style={{ display: 'flex', gap: 24, width: '100%' }}>
          <Card
            delay={44}
            tone={C.pink}
            title="Consultants & freelancers"
            body="Invoices and timesheets backed by a record that was kept while the work happened."
          />
          <Card
            delay={54}
            tone={C.purple}
            title="Engineers & designers"
            body="An honest picture of where the week actually went, across every tool that lives in a tab."
          />
          <Card
            delay={64}
            tone={C.yellow}
            title="Anyone facing a review"
            body="Walk into the self-assessment with a month of evidence instead of a vague recollection."
          />
        </div>
      </div>
    </Scene>
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ *
 * 08 — Status
 * ------------------------------------------------------------------ */

export const Status: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => (
  <AbsoluteFill>
    <Bg tint={C.yellow} intensity={0.7} />
    <Scene durationInFrames={durationInFrames}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <Kicker delay={0}>Shipping today</Kicker>
        <Headline
          text="Live on the Chrome Web Store."
          delay={8}
          size={96}
          accentWords={['Live']}
        />
        <Sub delay={28} maxWidth={900}>
          Install it and it starts working. There is no onboarding, because there is no
          account.
        </Sub>
        <div style={{ height: 12 }} />
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', maxWidth: 1300 }}>
          {[
            'Free',
            'No sign-up',
            'No credit card',
            'Manifest V3',
            'MIT licensed',
            'v1.1.0',
          ].map((c, i) => (
            <Chip key={c} delay={46 + i * 5}>
              {c}
            </Chip>
          ))}
        </div>
        <div style={{ height: 10 }} />
        <Sub delay={92} size={24} maxWidth={900}>
          <span style={{ color: C.muted }}>
            Scope, stated plainly: Tasker sees activity inside Chrome. Desktop apps, calls
            and editor time are out of frame.
          </span>
        </Sub>
      </div>
    </Scene>
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ *
 * 09 — Close
 * ------------------------------------------------------------------ */

export const Close: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = spring({ frame: frame - 40, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <Bg tint={C.purple} intensity={0.9} />
      <Scene durationInFrames={durationInFrames} center fadeOut={40}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 34,
            alignItems: 'center',
          }}
        >
          <Wordmark delay={0} size={86} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Headline
              text="Know where your time goes."
              delay={14}
              size={98}
              accentWords={['time']}
              maxWidth={1300}
            />
          </div>
          <div
            style={{
              width: interpolate(line, [0, 1], [0, 420]),
              height: 2,
              background: C.yellow,
              opacity: 0.55,
            }}
          />
          <div
            style={{
              ...useRise(52, 18),
              fontFamily: F.mono,
              fontSize: 36,
              letterSpacing: '0.04em',
              color: C.paper,
            }}
          >
            tasker-landing-liard.vercel.app
          </div>
          <div
            style={{
              ...useRise(64, 14),
              fontFamily: F.mono,
              fontSize: 22,
              letterSpacing: '0.12em',
              color: C.muted,
            }}
          >
            uabdul88@gmail.com
          </div>
        </div>
      </Scene>
    </AbsoluteFill>
  );
};
