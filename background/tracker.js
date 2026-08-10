/**
 * Tasker - Activity Tracker Engine (Production & MV3 Lifecycle Resilient)
 */

// A single flush may never credit more than this. A longer gap means the worker
// was suspended, the machine slept, or the browser was closed - none of which are
// observed activity, so they must not be counted as focus time.
const MAX_SINGLE_FLUSH_SECONDS = 1800;

// A restored session older than this cannot be trusted (browser closed / machine
// slept without an idle event), so it is discarded rather than credited.
const STALE_SESSION_SECONDS = 300;

// Upper bound on distinct page titles retained per day. Sites that put unread
// counts in the title would otherwise add a new key on every notification.
const MAX_PAGE_KEYS_PER_DAY = 200;

// Upper bound on distinct activities retained per day. Higher than the page cap
// because activities are the finer-grained record (one domain yields many), but
// still bounded so a day object cannot grow without limit.
const MAX_ACTIVITY_KEYS_PER_DAY = 300;

// Flush cadence. Bounds worst-case data loss on worker death to one interval.
const TICK_INTERVAL_MS = 60000;

// Cumulative seconds on one domain in a day before it earns an auto-highlight.
const AUTO_HIGHLIGHT_SECONDS = 1800;

class ActivityTracker {
  constructor() {
    this.activeTab = null; // { tabId, url, title, domain, category, startTime, lastActiveAt }
    this.isIdle = false;
    this.trackingPaused = false;
    this.timerInterval = null;
    this.blacklistedDomains = [];
    this.carryMs = 0; // sub-second remainder, carried so short visits are not lost
  }

  async init() {
    const settings = await TaskerStorage.getSettings();
    this.trackingPaused = settings.isTrackingPaused;
    this.blacklistedDomains = settings.blacklistedDomains || [];

    // Restore active session state across service worker restarts
    await this.restoreSession();

    // Register listeners if in Chrome Extension runtime
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
      chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
      if (chrome.windows) {
        chrome.windows.onFocusChanged.addListener(this.handleWindowFocus.bind(this));
      }
      if (chrome.idle) {
        chrome.idle.onStateChanged.addListener(this.handleIdleState.bind(this));
        chrome.idle.setDetectionInterval(60); // 1 minute idle threshold
      }

      // Sync active tab state initially
      this.syncCurrentTab();
    }

    // Start 5-second tick interval to record active time smoothly
    this.startTickInterval();
  }

  /**
   * Re-adopt the session persisted before the worker was torn down.
   *
   * Only a recent session is trustworthy. A stale one means the browser was
   * closed or the machine slept - there is no evidence the user was active for
   * that gap, so it is dropped rather than counted as focus time.
   */
  async restoreSession() {
    const restored = await TaskerStorage.getActiveSession();
    if (!restored || !restored.startTime) return;

    const referenceMs = restored.lastActiveAt || restored.startTime;
    const ageSeconds = (Date.now() - referenceMs) / 1000;

    if (ageSeconds > STALE_SESSION_SECONDS) {
      await TaskerStorage.clearActiveSession();
      this.activeTab = null;
      return;
    }

    this.activeTab = restored;
    this.carryMs = restored.carryMs || 0;
    await this.flushActiveTime();
  }

  async setPausedState(isPaused) {
    this.trackingPaused = isPaused;
    if (isPaused) {
      await this.flushActiveTime();
      await TaskerStorage.clearActiveSession();
      this.activeTab = null;
    } else {
      this.syncCurrentTab();
    }
  }

  async syncCurrentTab() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        this.switchTab(tabs[0]);
      }
    });
  }

  async handleTabActivated(activeInfo) {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      if (tab) this.switchTab(tab);
    });
  }

  async handleTabUpdated(tabId, changeInfo, tab) {
    if (tab.active && (changeInfo.url || changeInfo.title)) {
      this.switchTab(tab);
    }
  }

  async handleWindowFocus(windowId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Window lost focus
      await this.flushActiveTime();
      await TaskerStorage.clearActiveSession();
      this.activeTab = null;
    } else {
      this.syncCurrentTab();
    }
  }

  async handleIdleState(newState) {
    if (newState === 'idle' || newState === 'locked') {
      this.isIdle = true;
      await this.flushActiveTime();
      await TaskerStorage.clearActiveSession();
    } else if (newState === 'active') {
      this.isIdle = false;
      this.syncCurrentTab();
    }
  }

  isUrlBlacklisted(url) {
    if (!url) return true;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
      return true;
    }
    const lowerUrl = url.toLowerCase();
    return this.blacklistedDomains.some(b => lowerUrl.includes(b.toLowerCase()));
  }

  async switchTab(tab) {
    if (this.trackingPaused || this.isIdle) return;
    if (!tab || !tab.url || this.isUrlBlacklisted(tab.url)) {
      await this.flushActiveTime();
      await TaskerStorage.clearActiveSession();
      this.activeTab = null;
      return;
    }

    const domain = Formatters.getDomain(tab.url);
    const category = Formatters.categorizeActivity(tab.url, tab.title);

    // The page already being tracked just changed its title (unread counters,
    // live scores, "now playing"). Refresh metadata in memory and let the running
    // session keep accruing - restarting it here would reset the clock and write
    // to storage on every notification.
    if (this.activeTab && this.activeTab.tabId === tab.id && this.activeTab.domain === domain) {
      const sameActivity = this.activeTab.activityKey ===
        this.buildActivityKey(domain, Formatters.describeActivity(tab.url, tab.title));

      // Same tab, same domain, same thing being done - just refresh metadata.
      if (sameActivity) {
        this.activeTab.title = tab.title || this.activeTab.title;
        this.activeTab.url = tab.url;
        this.activeTab.category = category;
        return;
      }
      // Same domain but a genuinely different activity (PR #1 -> PR #2). Bank
      // the time against the old activity before switching, or the second one
      // inherits the first one's minutes.
      await this.flushActiveTime();
    }

    // Genuine navigation: bank the time spent on the previous tab first.
    await this.flushActiveTime();

    const now = Date.now();
    const activity = Formatters.describeActivity(tab.url, tab.title);
    this.activeTab = {
      tabId: tab.id,
      url: tab.url,
      title: tab.title || domain,
      domain: domain,
      category: category,
      action: activity.action,
      label: activity.label,
      activityKey: this.buildActivityKey(domain, activity),
      startTime: now,
      lastActiveAt: now
    };

    // Persist active session to storage so MV3 worker termination preserves state
    await TaskerStorage.saveActiveSession(this.activeTab);
  }

  /**
   * Build the per-day page key, normalising titles that churn.
   */
  /**
   * Stable identity for "the same thing being done on the same site", so
   * returning to a PR after lunch adds to it rather than creating a new row.
   */
  buildActivityKey(domain, activity) {
    return `${domain}|${activity.action}|${activity.label}`.substring(0, 160);
  }

  buildPageKey(tabMeta) {
    const raw = tabMeta.title || tabMeta.domain || 'Unknown';
    const cleaned = String(raw).replace(/^\s*\(\d+\)\s*/, '').trim();
    return (cleaned || tabMeta.domain || 'Unknown').substring(0, 60);
  }

  /**
   * Add recorded seconds to one calendar day's totals.
   */
  async applyToDay(dateKey, seconds, tabMeta, session, isNewVisit = false) {
    const dayData = await TaskerStorage.getDayData(dateKey);

    dayData.totalSeconds = (dayData.totalSeconds || 0) + seconds;

    dayData.categories = dayData.categories || {};
    dayData.categories[tabMeta.category] = (dayData.categories[tabMeta.category] || 0) + seconds;

    dayData.domains = dayData.domains || {};
    dayData.domains[tabMeta.domain] = (dayData.domains[tabMeta.domain] || 0) + seconds;

    // Bounded page map: once the cap is reached, keep updating known pages but
    // stop minting new keys so a single tab cannot grow the day object forever.
    dayData.pages = dayData.pages || {};
    const pageKey = this.buildPageKey(tabMeta);
    if (dayData.pages[pageKey] !== undefined) {
      dayData.pages[pageKey] += seconds;
    } else if (Object.keys(dayData.pages).length < MAX_PAGE_KEYS_PER_DAY) {
      dayData.pages[pageKey] = seconds;
    }

    // What was actually done, not just where. Same cap logic as pages: keep
    // updating activities already known, stop minting new keys past the limit.
    dayData.activities = dayData.activities || {};
    const activityKey = tabMeta.activityKey ||
      this.buildActivityKey(tabMeta.domain, { action: 'Visited', label: tabMeta.title || tabMeta.domain });
    const existing = dayData.activities[activityKey];

    if (existing) {
      existing.seconds += seconds;
      existing.lastAt = Date.now();
      // A visit is a fresh arrival, not a flush. Consecutive flushes of one
      // sitting share a key and must not each count as a separate visit.
      if (isNewVisit) existing.visits += 1;
    } else if (Object.keys(dayData.activities).length < MAX_ACTIVITY_KEYS_PER_DAY) {
      dayData.activities[activityKey] = {
        action: tabMeta.action || 'Visited',
        label: tabMeta.label || tabMeta.title || tabMeta.domain,
        domain: tabMeta.domain,
        category: tabMeta.category,
        seconds,
        visits: 1,
        firstAt: Date.now(),
        lastAt: Date.now()
      };
    }

    // Day totals and the active session go out in a single storage write.
    await TaskerStorage.saveDayAndSession(dateKey, dayData, session);

    if ((dayData.domains[tabMeta.domain] || 0) >= AUTO_HIGHLIGHT_SECONDS) {
      await this.autoGenerateHighlight(dateKey, tabMeta);
    }
  }

  async flushActiveTime() {
    if (!this.activeTab || !this.activeTab.startTime) return;

    const now = Date.now();
    let elapsedMs = (now - this.activeTab.startTime) + this.carryMs;

    // Cap the credit. Anything beyond this was not observable activity.
    const maxMs = MAX_SINGLE_FLUSH_SECONDS * 1000;
    const wasTruncated = elapsedMs > maxMs;
    if (wasTruncated) elapsedMs = maxMs;

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const startedAtMs = now - elapsedMs;

    // Advance the clock and keep the sub-second remainder, so a run of brief
    // visits accumulates instead of being discarded a fraction at a time.
    this.activeTab.startTime = now;
    this.activeTab.lastActiveAt = now;
    this.carryMs = wasTruncated ? 0 : elapsedMs - (elapsedSeconds * 1000);
    this.activeTab.carryMs = this.carryMs;

    if (elapsedSeconds < 1) return; // nothing whole yet; remainder is carried

    const tabMeta = { ...this.activeTab };
    const startKey = Formatters.getDateKey(startedAtMs);
    const endKey = Formatters.getDateKey(now);

    // The first flush of a sitting is the one that counts as a visit; the
    // per-minute flushes that follow are the same visit continuing.
    const isNewVisit = !this.activeTab.visitCounted;
    this.activeTab.visitCounted = true;

    if (startKey !== endKey) {
      // Session crossed midnight - attribute each part to the day it happened on.
      const midnight = new Date(now);
      midnight.setHours(0, 0, 0, 0);
      const beforeSec = Math.max(0, Math.floor((midnight.getTime() - startedAtMs) / 1000));
      const afterSec = Math.max(0, elapsedSeconds - beforeSec);
      if (beforeSec > 0) await this.applyToDay(startKey, beforeSec, tabMeta, null, isNewVisit);
      // Crossing midnight starts the activity fresh on the new day, so it is a
      // first visit there regardless of how long it had already been running.
      if (afterSec > 0) await this.applyToDay(endKey, afterSec, tabMeta, this.activeTab, true);
      else await TaskerStorage.saveActiveSession(this.activeTab);
    } else {
      await this.applyToDay(endKey, elapsedSeconds, tabMeta, this.activeTab, isNewVisit);
    }
  }

  async autoGenerateHighlight(dateKey, tabMeta) {
    const title = `Focused on ${tabMeta.domain}`;
    const existing = await TaskerStorage.getHighlights(dateKey);
    if (existing.some(h => h.title === title)) return;
    await TaskerStorage.addHighlight(dateKey, {
      title,
      description: `Sustained focus time on ${tabMeta.domain}`,
      category: tabMeta.category
    });
  }

  startTickInterval() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.trackingPaused && !this.isIdle && this.activeTab) {
        this.flushActiveTime();
      }
    }, TICK_INTERVAL_MS);
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.ActivityTracker = ActivityTracker;
}
