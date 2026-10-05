/**
 * Tasker - Pro purchase flow (service worker side)
 *
 * The extension never talks to Bachs and holds no payment keys: a published
 * extension is readable source, so a secret in it is public. The Tasker service
 * creates the hosted checkout and answers "does this account own a paid, unrefunded
 * licence?". Unlocking rests on that answer, never on the browser redirect - the
 * buyer can close the tab at any point after paying, and a redirect proves
 * nothing anyway.
 *
 * A licence belongs to an account, so every call here needs a signed-in user.
 *
 *   start()            open a checkout for this account and begin watching it
 *   poll()             alarm tick: has the pending checkout been paid yet?
 *   restore()          claim a checkout by its order reference
 *   syncFromAccount()  ask what this account owns - the new-device path
 *   recheck()          daily: a refunded licence stops being Pro
 *
 * Lives in the worker rather than the settings page so the unlock completes even
 * when the page that started it has been closed.
 */

const TaskerPayments = {
  POLL_ALARM: 'tasker_checkout_poll',
  RECHECK_ALARM: 'tasker_license_recheck',

  // Chrome's alarm floor is 30 seconds from version 120, which is this
  // extension's minimum. Fast enough that the unlock feels like part of paying.
  POLL_PERIOD_MINUTES: 0.5,
  RECHECK_PERIOD_MINUTES: 24 * 60,

  /**
   * Open a checkout for this account and start watching for the payment.
   * Reuses a still-live pending checkout instead of minting a second one, so
   * clicking Upgrade twice reopens the same page.
   */
  async start() {
    if (await TaskerLicense.isPro()) throw serviceError('Pro is already active on this device.', 'already_pro');

    const existing = await TaskerLicense.getPending();
    if (existing && existing.checkoutUrl) {
      await this._open(existing.checkoutUrl);
      this._watch();
      return { checkoutId: existing.checkoutId, reused: true };
    }

    const installId = await TaskerStorage.getInstallId();
    const created = await TaskerAuth.authedPost('/v1/checkout/create', { installId });

    // The service is ours, but this URL is about to be opened in a tab. Only a
    // plain https page may be, whatever the response says.
    if (!/^https:\/\//i.test(created.checkoutUrl || '') ||
        !TaskerLicense.CHECKOUT_REF_PATTERN.test(created.checkoutId || '')) {
      throw serviceError('The payment service sent back something unexpected.', 'bad_response');
    }

    await TaskerLicense.setPending({
      checkoutId: created.checkoutId,
      checkoutUrl: created.checkoutUrl,
      startedAt: Date.now()
    });
    await this._open(created.checkoutUrl);
    this._watch();
    return { checkoutId: created.checkoutId, reused: false };
  },

  async _open(url) {
    await chrome.tabs.create({ url });
  },

  _watch() {
    chrome.alarms.create(this.POLL_ALARM, {
      delayInMinutes: this.POLL_PERIOD_MINUTES,
      periodInMinutes: this.POLL_PERIOD_MINUTES
    });
  },

  _stopWatching() {
    chrome.alarms.clear(this.POLL_ALARM);
  },

  /**
   * Claim one checkout for the signed-in account. Returns the service's answer
   * untouched; callers decide what each reason means for them.
   */
  async check(checkoutId) {
    const installId = await TaskerStorage.getInstallId();
    return TaskerAuth.authedPost('/v1/license/verify', { reference: checkoutId, installId });
  },

  /** One alarm tick. Errors are swallowed: the next tick is the retry. */
  async poll() {
    const pending = await TaskerLicense.getPending();
    if (!pending) {
      await TaskerLicense.clearPending();
      this._stopWatching();
      return;
    }

    let result;
    try {
      result = await this.check(pending.checkoutId);
    } catch (err) {
      return;
    }

    if (result.valid) {
      await TaskerLicense.activate({ plan: result.plan || 'lifetime', reference: pending.checkoutId });
      await TaskerLicense.clearPending();
      this._stopWatching();
    } else if (result.reason !== 'pending') {
      // expired, cancelled, failed or unknown: nothing more will happen to it.
      await TaskerLicense.clearPending();
      this._stopWatching();
    }
  },

  /**
   * Claim a checkout the buyer typed or pasted. Throws on a transport failure or
   * when signed out; returns the service's reason when the answer is no.
   */
  async restore(reference) {
    const id = String(reference || '').trim();
    if (!TaskerLicense.CHECKOUT_REF_PATTERN.test(id)) {
      throw serviceError('That does not look like an order reference. It starts with "chk_".', 'bad_reference');
    }

    const result = await this.check(id);
    if (result.valid) {
      await TaskerLicense.activate({ plan: result.plan || 'lifetime', reference: id });
      await TaskerLicense.clearPending();
      this._stopWatching();
    }
    return result;
  },

  /**
   * Ask what this account owns and make the device agree. This is how Pro
   * follows a user to a new machine, and how a refund reaches an old one.
   *
   * Only a definite "not Pro" removes the local licence. A network error, an
   * expired session or a server hiccup throws and leaves it alone: locking a
   * paying customer out because the service was down is far worse than keeping a
   * refunded one for another day.
   */
  async syncFromAccount() {
    const status = await TaskerAuth.authedPost('/v1/license/status', {});
    const local = await TaskerLicense.getState();

    if (status.isPro) {
      if (!local.isPro || local.reference !== status.reference) {
        await TaskerLicense.activate({ plan: status.plan || 'lifetime', reference: status.reference });
      } else {
        await TaskerLicense.markVerified();
      }
      await TaskerLicense.clearPending();
      this._stopWatching();
    } else if (local.isPro) {
      await TaskerLicense.deactivate();
    }
    return { isPro: !!status.isPro };
  },

  /** Daily. Best effort: any failure means "try again tomorrow". */
  async recheck() {
    try {
      if ((await TaskerAuth.getSession()) && (await TaskerLicense.isPro())) await this.syncFromAccount();
    } catch (err) {
      /* try again tomorrow */
    }
  },

  /**
   * Alarms outlive the worker but not necessarily an extension update or a
   * browser restart, so lifecycle events call this to make sure they exist.
   */
  async ensureAlarms() {
    const recheck = await chrome.alarms.get(this.RECHECK_ALARM);
    if (!recheck) {
      chrome.alarms.create(this.RECHECK_ALARM, {
        delayInMinutes: 60,
        periodInMinutes: this.RECHECK_PERIOD_MINUTES
      });
    }

    const pending = await TaskerLicense.getPending();
    const poll = await chrome.alarms.get(this.POLL_ALARM);
    if (pending && !poll) this._watch();
    if (!pending && poll) this._stopWatching();
  }
};
