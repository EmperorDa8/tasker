/**
 * Tasker - Smart Activity Summarizer & Monthly Recap Generator
 */

// Endpoint of the Tasker summary service. The Gemini key lives there, never in
// this extension - anything shipped here is readable by anyone who installs it.
// Replace with your deployed URL, and add the same origin to host_permissions.
const SUMMARY_SERVICE_URL = 'https://tasker-extension.onrender.com/v1/monthly-summary';

// The service sleeps when idle on a free host, and waking it takes tens of
// seconds. Without a deadline the recap view would sit there waiting instead of
// falling back, so give up early and let the offline summary take over.
const SUMMARY_TIMEOUT_MS = 10000;

const ActivitySummarizer = {
  /**
   * Synthesize daily notes & accomplishment report
   */
  async generateDailySummary(dateKey) {
    const dayData = await TaskerStorage.getDayData(dateKey);
    const highlights = await TaskerStorage.getHighlights(dateKey);
    const notes = await TaskerStorage.getNotes(dateKey);
    const profile = await this.getWorkProfile();

    const markdown = Formatters.generateDailyMarkdown(dateKey, dayData, highlights, notes);
    return {
      dateKey,
      totalSeconds: dayData.totalSeconds,
      formattedTime: Formatters.formatDuration(dayData.totalSeconds),
      highlightsCount: highlights.length,
      notesCount: notes.length,
      markdown,
      dayData,
      highlights,
      notes,
      profile
    };
  },

  /**
   * The current work-profile inference, or null when it is switched off.
   *
   * Reads a rolling window rather than the single day being reported: one day
   * cannot establish what someone does for a living, and the detector refuses
   * to answer from that little evidence anyway.
   *
   * Never throws. An inference failing is not a reason for a report to fail -
   * the report is the thing the user asked for, the profile is a garnish.
   */
  async getWorkProfile() {
    try {
      const settings = await TaskerStorage.getSettings();
      if (settings.workProfile && settings.workProfile.enabled === false) return null;

      const days = await TaskerStorage.getRecentDays(RoleDetector.LOOKBACK_DAYS);
      return RoleDetector.infer(days, settings);
    } catch (err) {
      console.warn('Tasker: work profile inference failed', err);
      return null;
    }
  },

  /**
   * Synthesize monthly accomplishment recap report
   */
  async generateMonthlyRecap(monthKey) {
    const monthStats = await TaskerStorage.getMonthlyStats(monthKey);
    const settings = await TaskerStorage.getSettings();

    // Optional AI polish. Falls back silently to the rule-based summary if the
    // service is unreachable, rate-limited, or the user has switched it off.
    let aiInsights = null;
    if (settings.aiSummariesEnabled !== false) {
      try {
        aiInsights = await this.requestAiSummary(monthStats);
      } catch (err) {
        console.warn('AI summary unavailable, using rule-based summary:', err && err.message);
      }
    }

    if (aiInsights) {
      monthStats.milestones = aiInsights.milestones || monthStats.milestones;
      monthStats.aiSummaryParagraph = aiInsights.summaryParagraph;
    }

    const profile = await this.getWorkProfile();
    const markdown = Formatters.generateMonthlyRecapMarkdown(monthKey, monthStats);
    
    // Save generated recap in storage
    await TaskerStorage.set({ [`recap_${monthKey}`]: { monthKey, markdown, stats: monthStats, timestamp: Date.now() } });

    return {
      monthKey,
      monthStats,
      markdown,
      profile
    };
  },

  /**
   * Ask the Tasker summary service to write the month's narrative.
   *
   * Only aggregate totals are sent: the month, total time, active-day count, and
   * seconds per category. URLs, page titles, domains, notes and milestones never
   * leave the device - the service could not reconstruct browsing history from
   * this payload even if it tried.
   *
   * The inferred work profile is deliberately NOT sent either. It is the most
   * personal thing Tasker derives, it is inferred rather than observed, and the
   * summary service has no use for it.
   */
  async requestAiSummary(monthStats) {
    const installId = await TaskerStorage.getInstallId();

    const categories = {};
    Object.keys(monthStats.categories || {}).slice(0, 20).forEach(name => {
      categories[String(name).substring(0, 40)] = Math.round(monthStats.categories[name]) || 0;
    });

    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);

    try {
      const response = await fetch(SUMMARY_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installId,
          monthKey: monthStats.monthKey,
          totalSeconds: Math.round(monthStats.totalSeconds) || 0,
          daysTracked: monthStats.daysTrackedCount || 0,
          categories
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`summary service ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      // An abort is the expected outcome for a sleeping service, not a bug -
      // name it clearly so the caller's log line explains what happened.
      if (err && err.name === 'AbortError') {
        throw new Error(`summary service did not respond within ${SUMMARY_TIMEOUT_MS / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(deadline);
    }
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.ActivitySummarizer = ActivitySummarizer;
}
