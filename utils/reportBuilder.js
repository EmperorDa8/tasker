/**
 * Tasker - branded report composition
 *
 * Turns a day or a month of tracked data into a finished PDF. The layout
 * primitives live in pdf.js; what lives here is the editorial decision of what
 * a Tasker report says, in what order, and what it refuses to imply.
 *
 * Three things are non-negotiable in every document produced here, because
 * these reports leave the device - they get mailed to managers, attached to
 * invoices, filed in a shared Drive:
 *
 *   - The coverage caveat appears near the top, not buried at the end. The
 *     headline number is browser time, never a working day.
 *   - A score is printed as "not enough data" rather than as a number when
 *     there is not enough data.
 *   - An inferred work profile is labelled as an inference, with the evidence
 *     it rests on printed alongside it.
 */

const TaskerReports = {

  /**
   * "Friday, 30 August 2026" - a date a reader can place without decoding.
   */
  longDate(dateKey) {
    const parts = String(dateKey || '').split('-');
    if (parts.length !== 3) return dateKey || '';
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  },

  stamp() {
    return new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  },

  categoryColor(name) {
    return TaskerPDF.CATEGORY_COLORS[name] || TaskerPDF.CATEGORY_COLORS.Other;
  },

  /**
   * The work-profile block, shared by both report kinds.
   *
   * Prints nothing at all when there is no finding - an empty section header
   * saying "we could not tell" is noise in a document someone else will read.
   * The disclaimer is printed inside the block rather than in a footnote,
   * because a footnote is what gets cropped when a page is screenshotted.
   */
  workProfileSection(doc, profile) {
    if (!profile) return;
    if (profile.status === 'insufficient') return;

    doc.section('Work profile');

    if (profile.status === 'stated') {
      doc.callout(profile.label, 'Set by you in Tasker settings. Not inferred from browsing.', {
        background: TaskerPDF.BRAND.accentSoft,
        accent: TaskerPDF.BRAND.accent
      });
      this.aliasLine(doc, profile);
      return;
    }

    if (profile.status === 'ambiguous') {
      doc.callout(
        'Several profiles match about equally',
        profile.disclaimer,
        { background: '#FBEFD6', accent: '#9A6510', titleColor: '#7A4F0C' }
      );
      (profile.candidates || []).forEach((candidate) => {
        doc.meterRow(candidate.label, `${candidate.sharePercent}%`,
          candidate.sharePercent / 100, TaskerPDF.BRAND.muted);
      });
      return;
    }

    // A named finding. The confidence tier and the evidence count sit next to
    // the label, so the claim never appears without its own qualification.
    doc.statRow([
      { label: 'Closest match', value: profile.label, color: TaskerPDF.BRAND.accent },
      { label: 'Confidence', value: profile.confidenceLabel },
      { label: 'Evidence', value: `${profile.stats.distinctSources} tools`, hint: `over ${profile.stats.daysSeen} days` }
    ]);

    doc.callout('This is an inference, not a fact', profile.disclaimer, {
      background: TaskerPDF.BRAND.accentSoft,
      accent: TaskerPDF.BRAND.accent
    });

    this.aliasLine(doc, profile);

    if (profile.evidence && profile.evidence.length) {
      doc.label('What this is based on');
      profile.evidence.forEach((item) => {
        const days = `${item.days} day${item.days === 1 ? '' : 's'}`;
        const where = item.sources && item.sources.length
          ? ` - ${item.sources.slice(0, 3).join(', ')}`
          : '';
        doc.bullet(`${item.label}${where}`,
          `${Formatters.formatDuration(item.seconds)} / ${days}`);
      });
    }

    if (profile.alternatives && profile.alternatives.length) {
      doc.space(4);
      doc.paragraph(
        'Also considered: ' + profile.alternatives
          .map(a => `${a.label} (${a.sharePercent}%)`).join(', ') + '.',
        { size: 8.5, color: TaskerPDF.BRAND.muted }
      );
    }
  },

  /**
   * The other titles the same work is advertised under.
   *
   * This belongs in the document more than it belongs on screen: a report that
   * reaches a manager or a client is exactly where a bare job title would be
   * read as a precise claim. Naming the family instead makes the limit of the
   * claim part of the artifact.
   */
  aliasLine(doc, profile) {
    const note = RoleDetector.aliasNote(profile);
    if (!note) return;
    doc.space(2);
    doc.paragraph(note, { size: 8.5, color: TaskerPDF.BRAND.muted, after: 4 });
  },

  /**
   * Daily activity log.
   *
   * @returns {TaskerPDF.Doc}
   */
  buildDailyReport(payload) {
    const { dateKey, dayData, highlights = [], notes = [], profile = null } = payload;
    const totalSeconds = dayData.totalSeconds || 0;
    const coverage = Formatters.computeCoverage(dayData);

    const doc = new TaskerPDF.Doc({
      title: this.longDate(dateKey),
      subtitle: 'Daily activity log',
      documentKind: 'Daily activity log',
      headerLabel: `Daily log - ${dateKey}`
    });

    doc.cover({ generatedAt: `Generated ${this.stamp()}` });

    // Headline figures first: this is what a reader looks at before deciding
    // whether to read anything else.
    const score = dayData.productivityScore;
    doc.statRow([
      { label: 'Time in Chrome', value: Formatters.formatDuration(totalSeconds) },
      {
        label: 'Focus score',
        value: score === null || score === undefined ? 'n/a' : `${score}/100`,
        hint: score === null || score === undefined ? 'not enough data' : 'weighted by category'
      },
      { label: 'Accomplishments', value: String(highlights.length) },
      { label: 'Categories', value: String(Object.keys(dayData.categories || {}).length) }
    ]);

    // The caveat is placed immediately under the headline number rather than
    // at the end of the document, because it qualifies that number.
    if (coverage) {
      doc.callout('What this number is and is not',
        Formatters.formatCoverageNote(coverage),
        { background: '#F1F1EE', accent: TaskerPDF.BRAND.inkSoft });
    } else {
      doc.callout('Browser time only',
        'Tasker measures active time in Chrome. Work done in an editor, on a call, ' +
        'or in any desktop application is not counted here.',
        { background: '#F1F1EE', accent: TaskerPDF.BRAND.inkSoft });
    }

    // --- Accomplishments ---------------------------------------------------
    doc.section('Key accomplishments');
    if (highlights.length) {
      highlights.forEach((item) => {
        doc.bullet(item.title || item.category || 'Accomplishment', item.time || '');
        if (item.description) {
          doc.paragraph(item.description, {
            size: 8.5, indent: 14, color: TaskerPDF.BRAND.muted, after: 3
          });
        }
      });
    } else {
      doc.paragraph('Nothing was logged as an accomplishment on this day.', {
        size: 9, color: TaskerPDF.BRAND.muted
      });
    }

    // --- Category mix -------------------------------------------------------
    const categories = dayData.categories || {};
    const catKeys = Object.keys(categories).sort((a, b) => categories[b] - categories[a]);
    if (catKeys.length) {
      doc.section('Where the time went');
      catKeys.forEach((name) => {
        const seconds = categories[name];
        const meta = Formatters.getCategoryMeta(name);
        const pct = totalSeconds > 0 ? seconds / totalSeconds : 0;
        doc.meterRow(meta.label,
          `${Formatters.formatDuration(seconds)}  (${Math.round(pct * 100)}%)`,
          pct, this.categoryColor(name));
      });
    }

    // --- What was worked on --------------------------------------------------
    const activities = Formatters.rankActivities(dayData, 14);
    if (activities.length) {
      doc.section('What you worked on');
      activities.forEach((a) => {
        const visits = a.visits > 1 ? ` (${a.visits} visits)` : '';
        const where = a.domain ? ` - ${a.domain}` : '';
        doc.bullet(`${a.action}: ${a.label}${where}${visits}`,
          Formatters.formatDuration(a.seconds));
      });
    }

    // --- Repos and tickets ----------------------------------------------------
    const rollup = Formatters.rollupWork(dayData, 10);
    if (rollup.length) {
      doc.section('Repositories and tickets');
      rollup.forEach((group) => {
        const detail = Formatters.formatRollupItems(group);
        doc.bullet(detail ? `${group.key} - ${detail}` : group.key,
          Formatters.formatDuration(group.seconds));
      });
    }

    // --- Notes ----------------------------------------------------------------
    if (notes.length) {
      doc.section('Notes');
      notes.forEach((note) => {
        doc.bullet(note.text, note.time || '', { markerColor: TaskerPDF.BRAND.gold });
      });
    }

    // --- Sites -----------------------------------------------------------------
    const domains = dayData.domains || {};
    const topDomains = Object.keys(domains)
      .sort((a, b) => domains[b] - domains[a])
      .slice(0, 10);
    if (topDomains.length) {
      doc.section('Top sites');
      topDomains.forEach((domain) => {
        const pct = totalSeconds > 0 ? domains[domain] / totalSeconds : 0;
        doc.meterRow(domain, Formatters.formatDuration(domains[domain]), pct, TaskerPDF.BRAND.inkSoft);
      });
    }

    this.workProfileSection(doc, profile);
    this.privacyFooter(doc);

    return doc;
  },

  /**
   * Monthly accomplishment recap.
   */
  buildMonthlyReport(payload) {
    const { monthKey, monthStats, profile = null } = payload;
    const total = monthStats.totalSeconds || 0;

    const doc = new TaskerPDF.Doc({
      title: Formatters.formatMonthDisplay(monthKey),
      subtitle: 'Monthly accomplishment recap',
      documentKind: 'Monthly recap',
      headerLabel: `Monthly recap - ${monthKey}`
    });

    doc.cover({ generatedAt: `Generated ${this.stamp()}` });

    doc.statRow([
      { label: 'Total tracked', value: Formatters.formatDuration(total) },
      { label: 'Active days', value: String(monthStats.daysTrackedCount || 0) },
      { label: 'Daily average', value: Formatters.formatDuration(monthStats.avgDailySeconds || 0) },
      {
        label: 'Focus score',
        value: monthStats.monthlyScore == null ? 'n/a' : `${monthStats.monthlyScore}%`
      }
    ]);

    // The AI narrative, where one was produced. Labelled as generated, so a
    // reader knows which sentences a model wrote and which are measurements.
    if (monthStats.aiSummaryParagraph) {
      doc.section('Summary');
      doc.paragraph(monthStats.aiSummaryParagraph, { size: 10, leading: 15 });
      doc.space(4);
      doc.paragraph(
        'Written from category totals only. No URLs, page titles or notes were used.',
        { size: 8, color: TaskerPDF.BRAND.faint }
      );
    }

    doc.callout('Browser time only',
      'These totals cover active time in Chrome across ' +
      `${monthStats.daysTrackedCount || 0} tracked day(s). Time in editors, meetings ` +
      'and desktop applications is not included.',
      { background: '#F1F1EE', accent: TaskerPDF.BRAND.inkSoft });

    // --- Milestones ------------------------------------------------------------
    doc.section('Milestones and accomplishments');
    const milestones = monthStats.milestones || [];
    if (milestones.length) {
      milestones.forEach((m) => {
        doc.bullet(m.title || 'Accomplishment', m.date || '');
        if (m.description) {
          doc.paragraph(m.description, {
            size: 8.5, indent: 14, color: TaskerPDF.BRAND.muted, after: 3
          });
        }
      });
    } else {
      doc.paragraph('No accomplishments were logged this month.', {
        size: 9, color: TaskerPDF.BRAND.muted
      });
    }

    // --- Category mix -------------------------------------------------------------
    const categories = monthStats.categories || {};
    const catKeys = Object.keys(categories).sort((a, b) => categories[b] - categories[a]);
    if (catKeys.length) {
      doc.section('Category breakdown');
      catKeys.forEach((name) => {
        const seconds = categories[name];
        const pct = total > 0 ? seconds / total : 0;
        doc.meterRow(Formatters.getCategoryMeta(name).label,
          `${Formatters.formatDuration(seconds)}  (${Math.round(pct * 100)}%)`,
          pct, this.categoryColor(name));
      });
    }

    // --- Work rollup ---------------------------------------------------------------
    const rollup = Formatters.rollupWork(monthStats, 12);
    if (rollup.length) {
      doc.section('Repositories and tickets');
      rollup.forEach((group) => {
        const detail = Formatters.formatRollupItems(group);
        doc.bullet(detail ? `${group.key} - ${detail}` : group.key,
          Formatters.formatDuration(group.seconds));
      });
    }

    // --- Platforms -------------------------------------------------------------------
    if (monthStats.topDomains && monthStats.topDomains.length) {
      doc.section('Most used platforms');
      monthStats.topDomains.forEach((item) => {
        const pct = total > 0 ? item.seconds / total : 0;
        doc.meterRow(item.domain, Formatters.formatDuration(item.seconds), pct, TaskerPDF.BRAND.inkSoft);
      });
    }

    this.workProfileSection(doc, profile);
    this.privacyFooter(doc);

    return doc;
  },

  /**
   * The provenance block that closes every report.
   *
   * A report that travels needs to answer "where did this come from and what
   * was shared" without the reader having to install anything.
   */
  privacyFooter(doc) {
    doc.section('About this report', { tight: true });
    doc.paragraph(
      'Generated by the Tasker Chrome extension on the device that recorded the activity. ' +
      'Activity data is stored locally in the browser and is not transmitted to Tasker or ' +
      'to any third party. This document was written locally and, if it is in Google Drive, ' +
      'it was uploaded to the account holder\'s own Drive folder.',
      { size: 8.5, color: TaskerPDF.BRAND.muted }
    );
  },

  /**
   * File name for a report, stable across regenerations so an update replaces
   * the previous version in Drive rather than piling up alongside it.
   */
  fileName(kind, key, extension) {
    const safeKey = String(key || '').replace(/[^0-9A-Za-z-]/g, '');
    const stem = kind === 'monthly'
      ? `Tasker_Monthly_Recap_${safeKey}`
      : `Tasker_Daily_Log_${safeKey}`;
    return `${stem}.${extension}`;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.TaskerReports = TaskerReports;
}
