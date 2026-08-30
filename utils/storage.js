/**
 * Tasker - Storage Abstraction Layer
 *
 * chrome.storage.local only. Nothing is written to chrome.storage.sync, so no
 * activity data is ever replicated to the user's Google account.
 */

const TaskerStorage = {
  /**
   * Safe getter for chrome.storage.local
   */
  async get(keys) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
      } else {
        const res = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => {
          try {
            const val = localStorage.getItem(k);
            if (val !== null) res[k] = JSON.parse(val);
          } catch(e) {}
        });
        resolve(res);
      }
    });
  },

  /**
   * Safe setter for chrome.storage.local
   */
  async set(data) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(data, () => resolve(true));
      } else {
        Object.keys(data).forEach(k => {
          try {
            localStorage.setItem(k, JSON.stringify(data[k]));
          } catch(e) {}
        });
        resolve(true);
      }
    });
  },

  /**
   * Run a read-modify-write section with no other section interleaved.
   *
   * Day totals are read, mutated and written back as three separate awaits. Two
   * flushes overlapping - an alarm heartbeat and a tab switch, which the 30s
   * heartbeat makes routine - would both read the same starting totals and the
   * second write would silently discard the first one's seconds along with any
   * domain or activity rows it added.
   *
   * Sections must not nest: an inner call would wait on a queue the outer call
   * is still holding, and deadlock.
   */
  _writeQueue: Promise.resolve(),

  serialize(fn) {
    // Chain onto the queue regardless of whether the previous section settled
    // or threw, or one rejection would stall every write after it.
    const run = this._writeQueue.then(fn, fn);
    this._writeQueue = run.then(() => undefined, () => undefined);
    return run;
  },

  /**
   * Persist active tracking tab session for MV3 worker restart resilience
   */
  async saveActiveSession(session) {
    await this.set({ tasker_active_session: session });
  },

  /**
   * Get active tracking tab session across worker restarts
   */
  async getActiveSession() {
    const res = await this.get('tasker_active_session');
    return res.tasker_active_session || null;
  },

  /**
   * Clear active session
   */
  async clearActiveSession() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove('tasker_active_session');
    }
  },

  /**
   * Domain Privacy Presets for easy non-technical setup
   */
  DOMAIN_PRESETS: {
    banking: {
      name: 'Banking & Financial Sites',
      domains: ['bank', 'paypal', 'stripe', 'chase', 'amex', 'fidelity', 'schwab', 'wellsfargo', 'capitalone']
    },
    auth: {
      name: 'Password Managers & Auth',
      domains: ['1password', 'bitwarden', 'lastpass', 'okta', 'auth0', 'accounts.google', 'login']
    },
    privacy: {
      name: 'Email, Health & Personal',
      domains: ['mail.google', 'outlook', 'mychart', 'epic', 'healthcare']
    }
  },

  /**
   * Anonymous per-install identifier used only to apply a fair-use quota on the
   * summary service. Random, generated on this device, tied to no account and to
   * nothing identifying.
   */
  async getInstallId() {
    const res = await this.get('tasker_install_id');
    if (res.tasker_install_id) return res.tasker_install_id;

    let id;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = 'inst_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
    }
    await this.set({ tasker_install_id: id });
    return id;
  },

  /**
   * Get Settings
   */
  async getSettings() {
    const res = await this.get('tasker_settings');
    const defaultSettings = {
      isTrackingPaused: false,
      googleDriveFolderId: '',
      googleDriveFolderName: 'Tasker Activity Logs',
      aiSummariesEnabled: true,
      // Off by default. Enabling it triggers a Google sign-in prompt, which must
      // be the user's decision rather than something a fresh install does on its
      // own six hours after being added.
      autoSyncDrive: false,
      autoSyncIntervalHours: 24,
      blacklistedDomains: ['bank', 'paypal', 'passwords', 'accounts.google.com'],
      minFocusSeconds: 30,
      hasSeenOnboarding: false,
      // Sparse overrides: only what the user actually changed. Categories and
      // domains absent here keep following the built-in defaults.
      categoryWeights: {},
      domainCategories: {},
      // Reports are written as branded PDFs by default: that is the artifact
      // people actually forward. Markdown stays available for anyone piping
      // logs into their own notes system.
      //   'pdf' | 'markdown' | 'both'
      driveFormat: 'pdf',
      // Filing logs into Daily Logs / Monthly Recaps subfolders. Off would
      // leave a flat folder that becomes unusable after a month of daily logs.
      driveOrganizeFolders: true,
      // Work profile inference. `override` is the user's own answer and always
      // beats the inference; `enabled: false` turns the feature off entirely
      // and nothing is computed.
      workProfile: {
        enabled: true,
        override: null
      }
    };
    const merged = { ...defaultSettings, ...(res.tasker_settings || {}) };
    // workProfile is the one nested object here, and the spread above would
    // replace it wholesale - so a stored { override } written by an older
    // version would arrive with `enabled` undefined and read as switched off.
    merged.workProfile = { ...defaultSettings.workProfile, ...(merged.workProfile || {}) };
    return merged;
  },

  /**
   * Save Settings
   */
  async saveSettings(newSettings) {
    const current = await this.getSettings();
    const updated = { ...current, ...newSettings };
    await this.set({ tasker_settings: updated });
    // Adopt the new scoring rules immediately rather than at the next reload,
    // so a slider moved in Options changes the score the user is looking at.
    Formatters.applyPreferences(updated);
    this._prefsReady = Promise.resolve();
    return updated;
  },

  /**
   * Make sure the user's scoring preferences have been loaded into Formatters.
   *
   * Scoring happens in several places - the worker, the popup, the dashboard -
   * and every one of them goes through getDayData or getMonthlyStats. Hydrating
   * here means no caller can forget to, and the promise is cached so this costs
   * one storage read per context rather than one per day rendered.
   */
  async ensurePreferences() {
    if (!this._prefsReady) {
      this._prefsReady = (async () => {
        const settings = await this.getSettings();
        Formatters.applyPreferences(settings);
      })();
    }
    return this._prefsReady;
  },

  _prefsReady: null,

  /**
   * Get Daily Activity Data
   * @param {string} dateKey YYYY-MM-DD
   */
  async getDayData(dateKey) {
    await this.ensurePreferences();
    const key = `day_${dateKey}`;
    const res = await this.get(key);
    const defaultDay = {
      dateKey,
      totalSeconds: 0,
      categories: {},
      domains: {},
      pages: {},
      activities: {},
      sessions: []
    };

    const day = res[key] || defaultDay;

    // Days written before the activity layer shipped have no `activities` map.
    // Default it here so every caller can treat the shape as uniform.
    if (!day.activities) day.activities = {};
    if (!day.sessions) day.sessions = [];

    // Derived on read, never stored. A stored score would go stale the moment
    // more time was recorded, and the weights are expected to change - anything
    // persisted would then be a mix of old and new scoring rules.
    day.productivityScore = Formatters.computeProductivityScore(day.categories);

    return day;
  },

  /**
   * Save Daily Activity Data
   */
  async saveDayData(dateKey, dayData) {
    const key = `day_${dateKey}`;
    await this.set({ [key]: this.stripDerived(dayData) });
  },

  /**
   * Drop read-time derived fields before writing.
   *
   * getDayData attaches the score to the object callers then mutate and hand
   * back. Persisting it would leave stored days carrying a number computed
   * under whichever weights happened to be current at write time.
   */
  stripDerived(dayData) {
    const copy = { ...dayData };
    delete copy.productivityScore;
    return copy;
  },

  /**
   * Save day totals and the active session in a single write. The tracker
   * updates both together on every flush; combining them halves the write rate.
   */
  async saveDayAndSession(dateKey, dayData, session) {
    const payload = { [`day_${dateKey}`]: this.stripDerived(dayData) };
    if (session) payload.tasker_active_session = session;
    await this.set(payload);
  },

  /**
   * Get Daily Highlights
   */
  async getHighlights(dateKey) {
    const key = `highlights_${dateKey}`;
    const res = await this.get(key);
    return res[key] || [];
  },

  /**
   * Add Daily Highlight
   */
  async addHighlight(dateKey, highlightItem) {
    return this.serialize(async () => {
      const list = await this.getHighlights(dateKey);
      const item = {
        id: 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: highlightItem.title || 'Accomplishment',
        description: highlightItem.description || '',
        category: highlightItem.category || 'Productivity',
        timestamp: Date.now()
      };
      list.unshift(item);
      await this.set({ [`highlights_${dateKey}`]: list });
      return item;
    });
  },

  /**
   * Remove Daily Highlight
   */
  async deleteHighlight(dateKey, highlightId) {
    const list = await this.getHighlights(dateKey);
    const updated = list.filter(h => h.id !== highlightId);
    await this.set({ [`highlights_${dateKey}`]: updated });
    return updated;
  },

  /**
   * Get Notes for a date
   */
  async getNotes(dateKey) {
    const key = `notes_${dateKey}`;
    const res = await this.get(key);
    return res[key] || [];
  },

  /**
   * Add Note for a date
   */
  async addNote(dateKey, noteText) {
    const list = await this.getNotes(dateKey);
    const item = {
      id: 'note_' + Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: noteText,
      timestamp: Date.now()
    };
    list.push(item);
    await this.set({ [`notes_${dateKey}`]: list });
    return item;
  },

  /**
   * Delete Note
   */
  async deleteNote(dateKey, noteId) {
    const list = await this.getNotes(dateKey);
    const updated = list.filter(n => n.id !== noteId);
    await this.set({ [`notes_${dateKey}`]: updated });
    return updated;
  },

  /**
   * The last `count` calendar days of activity, newest last.
   *
   * Read as one batched storage call rather than a loop of gets: the work
   * profile inference needs three weeks at once, and 21 sequential reads on
   * every popup open is 21 round trips for data that arrives in one.
   *
   * Days with no record are returned as null rather than skipped, so a caller
   * can tell "nothing happened on Sunday" apart from "Sunday is missing".
   */
  async getRecentDays(count = 21) {
    await this.ensurePreferences();

    const today = new Date();
    const dateKeys = [];
    for (let back = count - 1; back >= 0; back--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
      dateKeys.push(Formatters.getDateKey(d));
    }

    const items = await this.get(dateKeys.map(k => `day_${k}`));
    return dateKeys.map(dateKey => ({
      dateKey,
      day: items[`day_${dateKey}`] || null
    }));
  },

  /**
   * Get Monthly Stats & Recap
   */
  async getMonthlyStats(monthKey) {
    await this.ensurePreferences();
    const parts = String(monthKey || '').split('-');
    if (parts.length !== 2) {
      return { monthKey, totalSeconds: 0, daysTrackedCount: 0, avgDailySeconds: 0, monthlyScore: null, categories: {}, domains: {}, activities: {}, topActivities: [], topDomains: [], milestones: [] };
    }

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Read only this month's keys. Reading the whole store instead would pull
    // every day of history into memory just to use ~30 of them.
    const dateStrs = [];
    const wanted = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${parts[0]}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dateStrs.push(dateStr);
      wanted.push(`day_${dateStr}`, `highlights_${dateStr}`);
    }
    const items = await this.get(wanted);

    let totalSeconds = 0;
    let daysCount = 0;
    const categories = {};
    const domains = {};
    const milestones = [];
    const activities = {};

    for (const dateStr of dateStrs) {
      const day = items[`day_${dateStr}`];
      if (day && day.totalSeconds > 0) {
        daysCount++;
        totalSeconds += day.totalSeconds;

        if (day.categories) {
          Object.keys(day.categories).forEach(c => {
            categories[c] = (categories[c] || 0) + day.categories[c];
          });
        }

        if (day.activities) {
          Object.keys(day.activities).forEach(k => {
            const entry = day.activities[k];
            if (!entry) return;
            if (activities[k]) {
              activities[k].seconds += entry.seconds || 0;
              activities[k].visits += entry.visits || 0;
            } else {
              activities[k] = { ...entry };
            }
          });
        }

        if (day.domains) {
          Object.keys(day.domains).forEach(d => {
            domains[d] = (domains[d] || 0) + day.domains[d];
          });
        }
      }

      const dayHl = items[`highlights_${dateStr}`];
      if (dayHl && Array.isArray(dayHl)) {
        dayHl.forEach(h => {
          milestones.push({ ...h, date: dateStr });
        });
      }
    }

    const topDomains = Object.keys(domains)
      .map(d => ({ domain: d, seconds: domains[d] }))
      .sort((a,b) => b.seconds - a.seconds)
      .slice(0, 5);

    const sortedCategories = Object.keys(categories).sort((a,b) => categories[b] - categories[a]);

    return {
      monthKey,
      totalSeconds,
      daysTrackedCount: daysCount,
      avgDailySeconds: daysCount > 0 ? Math.round(totalSeconds / daysCount) : 0,
      // Scored from the month's actual category mix. The previous formula was
      // 75 + daysTracked/30*20, which measured only how many days the extension
      // had been running and rose whether the time was spent coding or scrolling.
      monthlyScore: Formatters.computeProductivityScore(categories),
      categories,
      domains,
      activities,
      topActivities: Object.keys(activities)
        .map(k => activities[k])
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 15),
      topDomains,
      topCategory: sortedCategories[0] || 'Productivity',
      secondCategory: sortedCategories[1] || 'Research',
      milestones: milestones.slice(0, 15)
    };
  },

  /**
   * Storage maintenance: prune logs older than maxDays (e.g. 180 days)
   */
  async pruneOldData(maxDays = 180, lookbackDays = 400) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    // Generate the keys for the expired window and remove them directly.
    // Discovering them by reading the entire store would cost far more than the
    // delete itself, and removing a key that does not exist is a no-op.
    const today = new Date();
    const keysToRemove = [];
    for (let back = maxDays; back < maxDays + lookbackDays; back++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      keysToRemove.push(`day_${dateStr}`, `highlights_${dateStr}`, `notes_${dateStr}`);
    }

    await new Promise(resolve => chrome.storage.local.remove(keysToRemove, () => resolve()));
    console.log(`Pruned storage older than ${maxDays} days.`);
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.TaskerStorage = TaskerStorage;
}
