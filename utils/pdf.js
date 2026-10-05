/**
 * Tasker - PDF writer
 *
 * A small, dependency-free PDF 1.4 generator, written because the extension
 * cannot use one off the shelf: the manifest CSP forbids remote script, and
 * bundling a general-purpose PDF library would add megabytes to the package to
 * produce documents that only ever need text, rules, rectangles and a logo.
 *
 * It emits real vector PDF - selectable text, not a screenshot of a web page -
 * using the base-14 fonts every reader has built in, so nothing is embedded and
 * a typical daily report lands around 5-10 KB.
 *
 * Layout is handled by TaskerPDF.Doc: a single-column flow with a cursor, page
 * breaks that keep headings attached to what follows them, and a branded header
 * and footer stamped onto every page once the total page count is known.
 */

const TaskerPDF = {

  /* ---------------------------------------------------------------------
     Font metrics
     ---------------------------------------------------------------------
     Adobe's published widths for Helvetica and Helvetica-Bold, in 1/1000 em.
     Needed for wrapping, centring and right-alignment: without them every
     line would have to be guessed at, and the right margin would drift.
     ------------------------------------------------------------------- */
  WIDTHS: {
    regular: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584],
    bold:    [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584]
  },

  // Anything outside the metric table falls back to this. Only reachable by
  // accented characters, which are rare in these reports and never in the
  // numbers, so a small width error there cannot break a layout.
  FALLBACK_WIDTH: 556,

  /**
   * Fold text the base-14 encoding cannot represent into something it can.
   *
   * Reports carry em dashes, curly quotes and the occasional emoji from a page
   * title. WinAnsi has no glyph for most of them, and an unmapped byte renders
   * as a black box in some readers and nothing at all in others - so they are
   * transliterated here rather than passed through and hoped for.
   */
  sanitize(value) {
    return String(value == null ? '' : value)
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/[•●▪]/g, '-')
      .replace(/ /g, ' ')
      .replace(/[←-⇿]/g, '->')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')  // emoji, symbols, control chars
      .replace(/[ \t]+/g, ' ');
  },

  /**
   * Width of a string at a given size, in points.
   */
  measure(text, size, bold) {
    const table = bold ? this.WIDTHS.bold : this.WIDTHS.regular;
    const str = String(text || '');
    let total = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      const w = (code >= 32 && code <= 126) ? table[code - 32] : this.FALLBACK_WIDTH;
      total += w;
    }
    return (total / 1000) * size;
  },

  /**
   * Break text into lines that fit `maxWidth`, splitting an over-long single
   * word rather than letting it run into the margin.
   */
  wrap(text, size, bold, maxWidth) {
    const clean = this.sanitize(text).trim();
    if (!clean) return [];

    const lines = [];
    clean.split('\n').forEach((paragraph) => {
      const words = paragraph.split(' ').filter(Boolean);
      let line = '';

      const pushHardBreak = (word) => {
        let chunk = '';
        for (let i = 0; i < word.length; i++) {
          const next = chunk + word[i];
          if (this.measure(next, size, bold) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = word[i];
          } else {
            chunk = next;
          }
        }
        return chunk;
      };

      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (this.measure(candidate, size, bold) <= maxWidth) {
          line = candidate;
          return;
        }
        if (line) { lines.push(line); line = ''; }
        line = this.measure(word, size, bold) > maxWidth ? pushHardBreak(word) : word;
      });

      if (line) lines.push(line);
      if (words.length === 0) lines.push('');
    });

    return lines;
  },

  /**
   * Escape a string for a PDF literal: backslash, and both parentheses.
   */
  escape(text) {
    return String(text || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  },

  /**
   * '#5A3BE0' or [r,g,b] 0-255 -> the 0-1 triple PDF operators want.
   */
  color(value) {
    if (Array.isArray(value)) {
      return value.map(v => Math.max(0, Math.min(1, v / 255)));
    }
    const hex = String(value || '#000000').replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const num = parseInt(full, 16);
    if (!Number.isFinite(num)) return [0, 0, 0];
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  },

  /** Trim float noise out of the content stream. */
  n(value) {
    return (Math.round(Number(value) * 100) / 100).toString();
  }
};

/* =========================================================================
   Brand constants for generated documents.

   Held separately from the CSS tokens because a PDF is read outside the
   product - on a phone, in a printed pack, attached to an invoice - and
   must not follow the reader's dark mode.
   ======================================================================= */
TaskerPDF.BRAND = {
  ink: '#2A0F14',
  inkSoft: '#4E2134',
  accent: '#5A3BE0',
  accentSoft: '#EEEAFD',
  gold: '#FAE261',
  body: '#3A3937',
  muted: '#76746F',
  faint: '#A3A29D',
  hairline: '#E2E1DD',
  panel: '#F0F2EF',
  track: '#E2E6E0',
  ok: '#1F7A54',
  name: 'Tasker',
  tagline: 'Activity intelligence, generated on your own device'
};

// Must match Formatters.getCategoryMeta() and the --cat-* tokens. A category
// missing here renders as the grey "Other" bar in a report while showing its
// real colour on screen, which reads as a bug in the report.
TaskerPDF.CATEGORY_COLORS = {
  Development: '#5A3BE0',
  AI: '#7B4FD8',
  Productivity: '#A8760F',
  Research: '#24735A',
  Education: '#2C6E9B',
  Design: '#B8478A',
  Communication: '#C05F3C',
  Career: '#7A5C3D',
  Finance: '#4E7A1F',
  News: '#3F7A72',
  Social: '#34659F',
  Health: '#B04A6E',
  Travel: '#0E8A8A',
  Shopping: '#A9601F',
  Entertainment: '#A83C55',
  Other: '#6E6D69'
};

/* =========================================================================
   Document
   ======================================================================= */

TaskerPDF.Doc = class TaskerPdfDoc {
  /**
   * @param {object} [opts]
   *   title, subtitle, documentKind - stamped into the header and metadata
   */
  constructor(opts) {
    const o = opts || {};

    // A4, in points. A4 rather than Letter because it is the wider default
    // internationally and prints acceptably on Letter; the reverse clips.
    this.width = 595.28;
    this.height = 841.89;
    this.margin = { top: 58, right: 52, bottom: 58, left: 52 };

    this.title = TaskerPDF.sanitize(o.title || 'Tasker Report');
    this.subtitle = TaskerPDF.sanitize(o.subtitle || '');
    this.documentKind = TaskerPDF.sanitize(o.documentKind || 'Activity report');
    this.headerLabel = TaskerPDF.sanitize(o.headerLabel || this.title);

    this.pages = [];
    this.ops = null;
    this.y = 0;
    this.newPage();
  }

  get contentWidth() {
    return this.width - this.margin.left - this.margin.right;
  }

  get bottomLimit() {
    return this.margin.bottom + 26; // leaves room for the footer rule
  }

  /* --- low-level ------------------------------------------------------- */

  push(op) {
    this.ops.push(op);
  }

  newPage() {
    this.ops = [];
    this.pages.push(this.ops);
    // Continuation pages start below the running header; the first page's
    // cover block sets its own position.
    this.y = this.height - this.margin.top;
    return this;
  }

  /**
   * Guarantee `needed` points of room, breaking the page if not.
   * Returns true when a break happened, so callers that want a heading to
   * stay with its content can react.
   */
  ensure(needed) {
    if (this.y - needed >= this.bottomLimit) return false;
    this.newPage();
    this.y -= 6; // clears the running header rule
    return true;
  }

  setFill(color) {
    const [r, g, b] = TaskerPDF.color(color);
    this.push(`${TaskerPDF.n(r)} ${TaskerPDF.n(g)} ${TaskerPDF.n(b)} rg`);
  }

  setStroke(color) {
    const [r, g, b] = TaskerPDF.color(color);
    this.push(`${TaskerPDF.n(r)} ${TaskerPDF.n(g)} ${TaskerPDF.n(b)} RG`);
  }

  rect(x, y, w, h, color) {
    this.setFill(color);
    this.push(`${TaskerPDF.n(x)} ${TaskerPDF.n(y)} ${TaskerPDF.n(w)} ${TaskerPDF.n(h)} re f`);
  }

  /** Rounded rectangle, drawn with four bezier corners. */
  roundRect(x, y, w, h, radius, color) {
    const r = Math.min(radius, w / 2, h / 2);
    const k = r * 0.5523;
    const N = TaskerPDF.n;
    this.setFill(color);
    this.push(
      `${N(x + r)} ${N(y)} m ` +
      `${N(x + w - r)} ${N(y)} l ` +
      `${N(x + w - r + k)} ${N(y)} ${N(x + w)} ${N(y + r - k)} ${N(x + w)} ${N(y + r)} c ` +
      `${N(x + w)} ${N(y + h - r)} l ` +
      `${N(x + w)} ${N(y + h - r + k)} ${N(x + w - r + k)} ${N(y + h)} ${N(x + w - r)} ${N(y + h)} c ` +
      `${N(x + r)} ${N(y + h)} l ` +
      `${N(x + r - k)} ${N(y + h)} ${N(x)} ${N(y + h - r + k)} ${N(x)} ${N(y + h - r)} c ` +
      `${N(x)} ${N(y + r)} l ` +
      `${N(x)} ${N(y + r - k)} ${N(x + r - k)} ${N(y)} ${N(x + r)} ${N(y)} c f`
    );
  }

  circle(cx, cy, r, color) {
    const k = r * 0.5523;
    const N = TaskerPDF.n;
    this.setFill(color);
    this.push(
      `${N(cx + r)} ${N(cy)} m ` +
      `${N(cx + r)} ${N(cy + k)} ${N(cx + k)} ${N(cy + r)} ${N(cx)} ${N(cy + r)} c ` +
      `${N(cx - k)} ${N(cy + r)} ${N(cx - r)} ${N(cy + k)} ${N(cx - r)} ${N(cy)} c ` +
      `${N(cx - r)} ${N(cy - k)} ${N(cx - k)} ${N(cy - r)} ${N(cx)} ${N(cy - r)} c ` +
      `${N(cx + k)} ${N(cy - r)} ${N(cx + r)} ${N(cy - k)} ${N(cx + r)} ${N(cy)} c f`
    );
  }

  line(x1, y1, x2, y2, color, width) {
    this.setStroke(color);
    this.push(`${TaskerPDF.n(width || 0.75)} w`);
    this.push(`${TaskerPDF.n(x1)} ${TaskerPDF.n(y1)} m ${TaskerPDF.n(x2)} ${TaskerPDF.n(y2)} l S`);
  }

  /**
   * Draw one line of text at an absolute position. Everything typographic
   * above this goes through it.
   */
  drawText(text, x, y, opts) {
    const o = opts || {};
    const size = o.size || 10;
    const font = o.bold ? '/F2' : (o.mono ? '/F3' : '/F1');
    const clean = TaskerPDF.sanitize(text);
    if (!clean) return;

    let posX = x;
    if (o.align === 'right') posX = x - TaskerPDF.measure(clean, size, !!o.bold);
    if (o.align === 'center') posX = x - TaskerPDF.measure(clean, size, !!o.bold) / 2;

    this.setFill(o.color || TaskerPDF.BRAND.body);
    this.push('BT');
    if (o.tracking) this.push(`${TaskerPDF.n(o.tracking)} Tc`);
    this.push(`${font} ${TaskerPDF.n(size)} Tf`);
    this.push(`1 0 0 1 ${TaskerPDF.n(posX)} ${TaskerPDF.n(y)} Tm`);
    this.push(`(${TaskerPDF.escape(clean)}) Tj`);
    if (o.tracking) this.push('0 Tc');
    this.push('ET');
  }

  /* --- flow ------------------------------------------------------------- */

  space(amount) {
    this.y -= amount;
    return this;
  }

  /**
   * Wrapped paragraph text in the flow, breaking pages as needed.
   */
  paragraph(text, opts) {
    const o = opts || {};
    const size = o.size || 9.5;
    const leading = o.leading || size * 1.5;
    const indent = o.indent || 0;
    const width = (o.width || this.contentWidth) - indent;
    const lines = TaskerPDF.wrap(text, size, !!o.bold, width);

    lines.forEach((line, i) => {
      this.ensure(leading);
      this.drawText(line, this.margin.left + indent, this.y - size, {
        size,
        bold: o.bold,
        mono: o.mono,
        color: o.color || TaskerPDF.BRAND.body,
        tracking: o.tracking
      });
      this.y -= leading;
      if (i === lines.length - 1 && o.after) this.y -= o.after;
    });
    return this;
  }

  /**
   * Section heading with the accent tick that marks a new section.
   */
  section(text, opts) {
    const o = opts || {};
    // A heading with nothing under it at the foot of a page is the classic
    // generated-report tell, so demand room for the heading plus two lines.
    this.ensure(58);
    this.space(o.tight ? 10 : 20);

    const size = 12.5;
    const tickH = size + 1;
    this.roundRect(this.margin.left, this.y - tickH + 1.5, 3, tickH, 1.5, o.accent || TaskerPDF.BRAND.accent);
    this.drawText(text, this.margin.left + 11, this.y - size + 2.5, {
      size,
      bold: true,
      color: TaskerPDF.BRAND.ink
    });
    this.y -= tickH + 9;
    return this;
  }

  /** Small uppercase label, for column headers and metadata. */
  label(text, opts) {
    const o = opts || {};
    this.ensure(14);
    this.drawText(String(text).toUpperCase(), o.x != null ? o.x : this.margin.left, this.y - 7, {
      size: 7,
      bold: true,
      color: o.color || TaskerPDF.BRAND.faint,
      tracking: 0.9
    });
    if (!o.inline) this.y -= 13;
    return this;
  }

  rule(opts) {
    const o = opts || {};
    this.ensure(12);
    this.space(o.before == null ? 6 : o.before);
    this.line(this.margin.left, this.y, this.width - this.margin.right, this.y,
      o.color || TaskerPDF.BRAND.hairline, 0.6);
    this.space(o.after == null ? 12 : o.after);
    return this;
  }

  /**
   * A labelled row with a value hard against the right margin, and an
   * optional proportion bar beneath it. This is the workhorse of the
   * category and domain breakdowns.
   */
  meterRow(name, value, fraction, color) {
    this.ensure(30);
    const left = this.margin.left;
    const right = this.width - this.margin.right;

    this.drawText(name, left, this.y - 9, { size: 9.5, color: TaskerPDF.BRAND.ink });
    this.drawText(value, right, this.y - 9, {
      size: 9.5, bold: true, align: 'right', color: TaskerPDF.BRAND.body
    });
    this.y -= 15;

    const track = right - left;
    const pct = Math.max(0, Math.min(1, Number(fraction) || 0));
    this.roundRect(left, this.y - 4, track, 4, 2, TaskerPDF.BRAND.track);
    if (pct > 0) {
      this.roundRect(left, this.y - 4, Math.max(3, track * pct), 4, 2, color || TaskerPDF.BRAND.accent);
    }
    this.y -= 13;
    return this;
  }

  /**
   * A bulleted line with an optional trailing value, used for activities,
   * accomplishments and rollups.
   */
  bullet(text, trailing, opts) {
    const o = opts || {};
    const size = o.size || 9.5;
    const leading = size * 1.45;
    const trailingWidth = trailing ? TaskerPDF.measure(TaskerPDF.sanitize(trailing), size, true) + 14 : 0;
    const textWidth = this.contentWidth - 14 - trailingWidth;
    const lines = TaskerPDF.wrap(text, size, false, textWidth);
    if (lines.length === 0) return this;

    this.ensure(leading * lines.length + 4);

    // Marker sits on the first line's optical centre, not its baseline.
    this.circle(this.margin.left + 3, this.y - size * 0.62, 1.7, o.markerColor || TaskerPDF.BRAND.accent);

    lines.forEach((line, i) => {
      this.drawText(line, this.margin.left + 14, this.y - size, {
        size, color: o.color || TaskerPDF.BRAND.body
      });
      if (i === 0 && trailing) {
        this.drawText(trailing, this.width - this.margin.right, this.y - size, {
          size, bold: true, align: 'right', color: o.trailingColor || TaskerPDF.BRAND.ink
        });
      }
      this.y -= leading;
    });
    this.y -= 3;
    return this;
  }

  /**
   * A tinted callout panel: coverage caveats, privacy notes, the work-profile
   * disclaimer. Anything the reader must not skim past.
   */
  callout(title, body, opts) {
    const o = opts || {};
    const pad = 12;
    const innerWidth = this.contentWidth - pad * 2;
    const titleLines = title ? TaskerPDF.wrap(title, 9.5, true, innerWidth) : [];
    const bodyLines = TaskerPDF.wrap(body, 9, false, innerWidth);
    const boxHeight = pad * 2 + titleLines.length * 14 + bodyLines.length * 13;

    this.ensure(boxHeight + 8);

    const top = this.y;
    this.roundRect(this.margin.left, top - boxHeight, this.contentWidth, boxHeight, 8,
      o.background || TaskerPDF.BRAND.panel);
    this.roundRect(this.margin.left, top - boxHeight, 3, boxHeight, 1.5,
      o.accent || TaskerPDF.BRAND.accent);

    let cursor = top - pad;
    titleLines.forEach((line) => {
      this.drawText(line, this.margin.left + pad, cursor - 9, {
        size: 9.5, bold: true, color: o.titleColor || TaskerPDF.BRAND.ink
      });
      cursor -= 14;
    });
    bodyLines.forEach((line) => {
      this.drawText(line, this.margin.left + pad, cursor - 9, {
        size: 9, color: o.bodyColor || TaskerPDF.BRAND.muted
      });
      cursor -= 13;
    });

    this.y = top - boxHeight - 14;
    return this;
  }

  /**
   * The headline figures, as a row of bordered tiles.
   * @param {Array<{label: string, value: string, hint?: string}>} tiles
   */
  statRow(tiles) {
    const items = (tiles || []).filter(Boolean);
    if (items.length === 0) return this;

    const gap = 10;
    const boxW = (this.contentWidth - gap * (items.length - 1)) / items.length;
    const boxH = 64;

    this.ensure(boxH + 10);
    const top = this.y;

    items.forEach((tile, i) => {
      const x = this.margin.left + i * (boxW + gap);
      this.roundRect(x, top - boxH, boxW, boxH, 9, TaskerPDF.BRAND.panel);
      this.drawText(String(tile.label).toUpperCase(), x + 12, top - 18, {
        size: 6.8, bold: true, color: TaskerPDF.BRAND.faint, tracking: 0.9
      });

      // Shrink an over-long value rather than let it collide with the next
      // tile - "12h 45m" and "1,234 items" are not the same width.
      let size = 19;
      while (size > 11 && TaskerPDF.measure(TaskerPDF.sanitize(tile.value), size, true) > boxW - 24) {
        size -= 1;
      }
      this.drawText(tile.value, x + 12, top - 41, {
        size, bold: true, color: tile.color || TaskerPDF.BRAND.ink
      });

      if (tile.hint) {
        this.drawText(tile.hint, x + 12, top - boxH + 11, {
          size: 7.5, color: TaskerPDF.BRAND.muted
        });
      }
    });

    this.y = top - boxH - 16;
    return this;
  }

  /**
   * The Tasker mark: a plum disc carrying the activity pulse in gold.
   * Vector, so it stays crisp at any zoom and adds nothing to the file size.
   */
  logoMark(cx, cy, size, opts) {
    const o = opts || {};
    const r = size / 2;
    this.circle(cx, cy, r, o.discColor || TaskerPDF.BRAND.ink);

    // Pulse trace, in the proportions of the extension icon.
    const s = size / 24;
    const px = cx - r + 2.5 * s;
    const py = cy;
    const pts = [
      [0, 0], [3.4, 0], [6.1, 8.4], [10.4, -8.4], [13.1, 0], [16.9, 0]
    ];
    this.setStroke(o.pulseColor || TaskerPDF.BRAND.gold);
    this.push(`${TaskerPDF.n(2.1 * s)} w 1 J 1 j`);
    const path = pts.map(([dx, dy], i) =>
      `${TaskerPDF.n(px + dx * s)} ${TaskerPDF.n(py + dy * s)} ${i === 0 ? 'm' : 'l'}`
    ).join(' ');
    this.push(`${path} S`);
    return this;
  }

  /**
   * The cover block: brand band, title, subtitle and metadata.
   * Only ever drawn on page one.
   */
  cover(meta) {
    const m = meta || {};
    const bandH = 132;
    const top = this.height;

    this.rect(0, top - bandH, this.width, bandH, TaskerPDF.BRAND.ink);
    // A thin gold seam under the band, so the brand reads as considered
    // rather than as a block of colour.
    this.rect(0, top - bandH, this.width, 3, TaskerPDF.BRAND.gold);

    // Inverted on the dark band: an ink disc on an ink band is invisible.
    this.logoMark(this.margin.left + 16, top - 44, 32, {
      discColor: TaskerPDF.BRAND.gold,
      pulseColor: TaskerPDF.BRAND.ink
    });
    this.drawText(TaskerPDF.BRAND.name, this.margin.left + 42, top - 50, {
      size: 17, bold: true, color: '#FFFFFF'
    });
    this.drawText(String(this.documentKind).toUpperCase(), this.margin.left + 42, top - 64, {
      size: 7, bold: true, color: TaskerPDF.BRAND.gold, tracking: 1.2
    });

    if (m.generatedAt) {
      this.drawText(m.generatedAt, this.width - this.margin.right, top - 50, {
        size: 8.5, align: 'right', color: '#C9BFC3'
      });
    }

    this.drawText(this.title, this.margin.left, top - 100, {
      size: 21, bold: true, color: '#FFFFFF'
    });
    if (this.subtitle) {
      this.drawText(this.subtitle, this.margin.left, top - 118, {
        size: 9.5, color: '#C9BFC3'
      });
    }

    this.y = top - bandH - 26;
    return this;
  }

  /* --- output ----------------------------------------------------------- */

  /**
   * Stamp the running header and footer onto every page.
   *
   * Deferred to build time because the footer says "Page 2 of 7", and the
   * total is not known until the flow has finished laying itself out.
   */
  finishPages() {
    const total = this.pages.length;

    this.pages.forEach((ops, index) => {
      const saved = this.ops;
      this.ops = ops;

      // Running header, from page two onward - page one has the cover band.
      if (index > 0) {
        const hy = this.height - 34;
        this.logoMark(this.margin.left + 7, hy + 3, 14);
        this.drawText(TaskerPDF.BRAND.name, this.margin.left + 20, hy, {
          size: 9, bold: true, color: TaskerPDF.BRAND.ink
        });
        this.drawText(this.headerLabel, this.width - this.margin.right, hy, {
          size: 8, align: 'right', color: TaskerPDF.BRAND.muted
        });
        this.line(this.margin.left, hy - 9, this.width - this.margin.right, hy - 9,
          TaskerPDF.BRAND.hairline, 0.6);
      }

      const fy = this.margin.bottom - 14;
      this.line(this.margin.left, fy + 15, this.width - this.margin.right, fy + 15,
        TaskerPDF.BRAND.hairline, 0.6);
      this.drawText(TaskerPDF.BRAND.tagline, this.margin.left, fy, {
        size: 7.5, color: TaskerPDF.BRAND.faint
      });
      this.drawText(`Page ${index + 1} of ${total}`, this.width - this.margin.right, fy, {
        size: 7.5, color: TaskerPDF.BRAND.faint, align: 'right'
      });

      this.ops = saved;
    });
  }

  /**
   * Serialise to PDF bytes.
   * @returns {Uint8Array}
   */
  build() {
    this.finishPages();

    const objects = [];
    const add = (body) => { objects.push(body); return objects.length; }; // 1-based

    // Object numbering has to be known up front for /Kids and /Parent, so the
    // fixed objects are allocated first and the pages laid out after them.
    const catalogId = 1;
    const pagesId = 2;
    const fontRegularId = 3;
    const fontBoldId = 4;
    const fontMonoId = 5;
    const infoId = 6;
    const firstPageId = 7;

    const pageIds = [];
    const contentIds = [];
    this.pages.forEach((_, i) => {
      pageIds.push(firstPageId + i * 2);
      contentIds.push(firstPageId + i * 2 + 1);
    });

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] =
      `<< /Type /Pages /Count ${this.pages.length} ` +
      `/Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`;
    objects[fontRegularId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[fontBoldId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objects[fontMonoId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';

    const stamp = this.pdfDate(new Date());
    objects[infoId - 1] =
      `<< /Title (${TaskerPDF.escape(this.title)}) ` +
      `/Author (Tasker Chrome Extension) ` +
      `/Subject (${TaskerPDF.escape(this.documentKind)}) ` +
      `/Creator (Tasker) /Producer (Tasker PDF writer) ` +
      `/CreationDate (${stamp}) /ModDate (${stamp}) >>`;

    this.pages.forEach((ops, i) => {
      const stream = ops.join('\n');
      objects[pageIds[i] - 1] =
        `<< /Type /Page /Parent ${pagesId} 0 R ` +
        `/MediaBox [0 0 ${TaskerPDF.n(this.width)} ${TaskerPDF.n(this.height)}] ` +
        `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontMonoId} 0 R >> >> ` +
        `/Contents ${contentIds[i]} 0 R >>`;
      objects[contentIds[i] - 1] =
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    // Assemble, recording each object's byte offset for the xref table.
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    objects.forEach((body, i) => {
      offsets[i] = out.length;
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefStart = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => {
      out += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n`;
    out += `startxref\n${xrefStart}\n%%EOF\n`;

    // Latin-1 out: every byte written above is already in that range, and
    // TextEncoder would silently widen the high bytes of the binary marker
    // into multi-byte UTF-8, corrupting the xref offsets.
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
    return bytes;
  }

  /** PDF date literal: D:YYYYMMDDHHmmSS+HH'mm' */
  pdfDate(date) {
    const p = (v) => String(Math.abs(Math.floor(v))).padStart(2, '0');
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    return `D:${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
      `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}` +
      `${sign}${p(offsetMinutes / 60)}'${p(offsetMinutes % 60)}'`;
  }

  /** Bytes as a Blob, for download links and Drive uploads. */
  blob() {
    return new Blob([this.build()], { type: 'application/pdf' });
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.TaskerPDF = TaskerPDF;
}
