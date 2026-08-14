import React, { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

// The product's real brand fonts, shipped locally in assets/fonts and copied into
// public/fonts. Loading them from disk keeps the render fully offline and
// deterministic — no network fetch mid-render.
const FACES = `
@font-face {
  font-family: 'Bricolage Grotesque';
  src: url('${staticFile('fonts/BricolageGrotesque-400_700-latin-1.woff2')}') format('woff2');
  font-weight: 400 700;
  font-display: block;
}
@font-face {
  font-family: 'Figtree';
  src: url('${staticFile('fonts/Figtree-400-latin-7.woff2')}') format('woff2');
  font-weight: 400;
  font-display: block;
}
@font-face {
  font-family: 'DM Mono';
  src: url('${staticFile('fonts/DMMono-400-latin-3.woff2')}') format('woff2');
  font-weight: 400;
  font-display: block;
}
@font-face {
  font-family: 'DM Mono';
  src: url('${staticFile('fonts/DMMono-500-latin-5.woff2')}') format('woff2');
  font-weight: 500;
  font-display: block;
}
`;

const STYLE_ID = 'tasker-brand-faces';

const injectFaces = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = FACES;
  document.head.appendChild(style);
};

/**
 * Holds the frame until every brand face is decoded. delayRender must be called
 * during a component render — never at module scope, or the bundle evaluates it
 * before Remotion has a render to delay.
 */
export const FontLoader: React.FC = () => {
  const [handle] = useState(() => delayRender('Loading Tasker brand fonts'));

  useEffect(() => {
    let cancelled = false;
    injectFaces();

    Promise.all([
      document.fonts.load('600 100px "Bricolage Grotesque"'),
      document.fonts.load('400 100px "Bricolage Grotesque"'),
      document.fonts.load('400 32px "Figtree"'),
      document.fonts.load('400 24px "DM Mono"'),
      document.fonts.load('500 24px "DM Mono"'),
    ])
      .then(() => document.fonts.ready)
      .finally(() => {
        if (!cancelled) continueRender(handle);
      });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return null;
};
