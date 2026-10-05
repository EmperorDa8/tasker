/**
 * Tasker - free tier limits and licence state
 *
 * Two jobs: decide how far back a free install may look, and decide when to
 * raise the upgrade question.
 *
 * The gate is on *viewing*, never on recording. Tracking keeps writing every
 * day whatever the licence says, so upgrading reveals history that was already
 * there rather than starting the clock again. That is also why the prune
 * horizon (180 days) is deliberately longer than the free window (90): the
 * months a free user cannot open still exist to be handed back on upgrade.
 *
 * This is a fair-use boundary, not DRM. Everything here runs on the user's own
 * machine and anyone determined can edit storage; the point is to make the free
 * tier coherent, not to be unbreakable.
 */

const TaskerLicense = {
  FREE_HISTORY_DAYS: 90,

  // Ask after the user has opened recaps for two different months. One recap is
  // curiosity; coming back for a second is the first evidence the thing has
  // become useful, and a prompt shown after value lands converts far better
  // than one shown at install.
  PROMPT_AFTER_RECAPS: 2,
  PROMPT_COOLDOWN_DAYS: 45,

  UPGRADE_URL: 'https://emperorda8.github.io/tasker-extension/#pro',

  /**
   * Kept out of `tasker_settings` on purpose. "Reset to recommended defaults"
   * in Options rewrites that object wholesale, and a paying user must not be
   * able to wipe their own licence with a settings reset.
   */
  LICENSE_KEY: 'tasker_license',
  VIEWS_KEY: 'tasker_recap_views',

  /**
   * A checkout the user has opened but not yet been seen to pay for. Held so the
   * background poll can finish the job after the settings page is closed, and so
   * reopening it shows "waiting for payment" instead of a bare Upgrade button.
   */
  PENDING_KEY: 'tasker_pending_checkout',

  // A hosted checkout lives an hour; the extra quarter-hour covers a bank
  // transfer that settles just after the page expires.
  PENDING_MAX_AGE_MS: 75 * 60 * 1000,

  CHECKOUT_REF_PATTERN: /^chk_[a-z0-9]{8,64}$/i,

  /* ------------------------------------------------------------- licence - */

  async getState() {
    const res = await TaskerStorage.get(this.LICENSE_KEY);
    const stored = res[this.LICENSE_KEY] || null;
    const plan = (stored && stored.plan) || 'free';
    return {
      plan,
      isPro: plan !== 'free',
      activatedAt: (stored && stored.activatedAt) || null,
      reference: (stored && stored.reference) || null,
      verifiedAt: (stored && stored.verifiedAt) || null
    };
  },

  async isPro() {
    return (await this.getState()).isPro;
  },

  /**
   * Record a completed purchase.
   *
   * Nothing here verifies a receipt - whatever payment flow calls this is
   * responsible for having done that first.
   */
  async activate(options) {
    const o = options || {};
    const now = Date.now();
    const record = {
      plan: o.plan || 'lifetime',
      reference: o.reference || null,
      activatedAt: now,
      verifiedAt: now
    };
    await TaskerStorage.set({ [this.LICENSE_KEY]: record });
    return record;
  },

  /** The licence was just re-confirmed with the payment service. */
  async markVerified() {
    const res = await TaskerStorage.get(this.LICENSE_KEY);
    const stored = res[this.LICENSE_KEY];
    if (!stored) return;
    await TaskerStorage.set({ [this.LICENSE_KEY]: { ...stored, verifiedAt: Date.now() } });
  },

  /* ---------------------------------------------------- pending checkout - */

  async getPending() {
    const res = await TaskerStorage.get(this.PENDING_KEY);
    const pending = res[this.PENDING_KEY] || null;
    if (!pending || !pending.checkoutId) return null;
    // An expired pending checkout is no longer pending, whether or not anything
    // got round to deleting it.
    if (Date.now() - (pending.startedAt || 0) > this.PENDING_MAX_AGE_MS) return null;
    return pending;
  },

  async setPending(pending) {
    await TaskerStorage.set({ [this.PENDING_KEY]: pending });
  },

  async clearPending() {
    await TaskerStorage.set({ [this.PENDING_KEY]: null });
  },

  async deactivate() {
    await TaskerStorage.set({ [this.LICENSE_KEY]: null });
  },

  /* -------------------------------------------------------- history window - */

  /**
   * Midnight on the oldest day a free install may open.
   *
   * FREE_HISTORY_DAYS counts today as one of the days, so 90 means today plus
   * the previous 89 - "the last 90 days" as a person would read it.
   */
  cutoffDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (this.FREE_HISTORY_DAYS - 1));
  },

  oldestVisibleDateKey() {
    return Formatters.getDateKey(this.cutoffDate());
  },

  /** YYYY-MM-DD keys are fixed width, so lexical order is date order. */
  isDateVisible(dateKey) {
    return String(dateKey || '') >= this.oldestVisibleDateKey();
  },

  /**
   * How a whole month sits against the window.
   *
   *   'open'    every day of it is inside the window
   *   'partial' the window starts part-way through the month
   *   'locked'  the whole month is older than the window
   *
   * A partial month is withheld rather than shown clipped. Its totals would be
   * missing the days before the cutoff, and a recap that silently under-reports
   * a month is worse than one the user is told they cannot open yet.
   */
  monthState(monthKey) {
    const parts = String(monthKey || '').split('-');
    if (parts.length !== 2) return 'locked';

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!year || !month) return 'locked';

    const cutoff = this.cutoffDate();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    if (monthStart.getTime() >= cutoff.getTime()) return 'open';
    if (monthEnd.getTime() >= cutoff.getTime()) return 'partial';
    return 'locked';
  },

  /**
   * Resolve a month against both the licence and the window.
   * @returns {Promise<{allowed: boolean, state: string, oldestVisible: string}>}
   */
  async monthAccess(monthKey) {
    const oldestVisible = this.oldestVisibleDateKey();
    if (await this.isPro()) return { allowed: true, state: 'open', oldestVisible };
    const state = this.monthState(monthKey);
    return { allowed: state === 'open', state, oldestVisible };
  },

  /* --------------------------------------------------------- upgrade ask - */

  /**
   * Note that a recap was actually rendered for `monthKey`.
   *
   * Distinct months, not opens: re-reading September four times in September is
   * one month's worth of evidence, and counting it as four would fire the
   * prompt at somebody who has not yet seen Tasker span a month boundary.
   */
  async recordRecapView(monthKey) {
    const res = await TaskerStorage.get(this.VIEWS_KEY);
    const record = res[this.VIEWS_KEY] || { months: [], promptDismissedAt: null };
    const months = Array.isArray(record.months) ? record.months : [];

    if (monthKey && !months.includes(monthKey)) {
      months.push(monthKey);
      // Only the count is ever read; cap the list so it cannot grow forever.
      record.months = months.slice(-24);
      await TaskerStorage.set({ [this.VIEWS_KEY]: record });
    }
    return (record.months || months).length;
  },

  async shouldPromptUpgrade() {
    if (await this.isPro()) return false;

    const res = await TaskerStorage.get(this.VIEWS_KEY);
    const record = res[this.VIEWS_KEY];
    if (!record || !Array.isArray(record.months)) return false;
    if (record.months.length < this.PROMPT_AFTER_RECAPS) return false;

    if (record.promptDismissedAt) {
      const daysSince = (Date.now() - record.promptDismissedAt) / 86400000;
      if (daysSince < this.PROMPT_COOLDOWN_DAYS) return false;
    }
    return true;
  },

  async dismissPrompt() {
    const res = await TaskerStorage.get(this.VIEWS_KEY);
    const record = res[this.VIEWS_KEY] || { months: [] };
    record.promptDismissedAt = Date.now();
    await TaskerStorage.set({ [this.VIEWS_KEY]: record });
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.TaskerLicense = TaskerLicense;
}
