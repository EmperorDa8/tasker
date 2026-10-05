/**
 * Tasker - Chrome Extension Service Worker (Manifest V3)
 */

try {
  importScripts(
    '../utils/formatters.js',
    '../utils/storage.js',
    '../utils/license.js',
    '../utils/clients.js',
    '../utils/roleDetector.js',
    '../utils/pdf.js',
    '../utils/reportBuilder.js',
    './tracker.js',
    './summarizer.js',
    './auth.js',
    './payments.js',
    './driveSync.js'
  );
} catch (e) {
  console.error('Error loading worker scripts:', e);
}

// Global Activity Tracker Instance
let trackerInstance = null;

// Service Worker Lifecycle Initialization
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Tasker Extension Installed/Updated:', details.reason);
  
  // Create auto sync alarm (every 6 hours)
  chrome.alarms.create('tasker_auto_drive_sync', { periodInMinutes: 360 });

  await pruneHistory();

  await TaskerPayments.ensureAlarms();
});

/**
 * Free installs keep 180 days: the 90 they can open plus 90 more, so upgrading
 * hands back months that already exist. Pro is "every month you have tracked",
 * so Pro is never pruned - unlimitedStorage is already declared for this.
 */
async function pruneHistory() {
  if (await TaskerLicense.isPro()) return;
  await TaskerStorage.pruneOldData(180);
}

// Browser Startup Listener
chrome.runtime.onStartup.addListener(async () => {
  console.log('Tasker Browser Startup initiated.');
  await initTracker();
  await TaskerPayments.ensureAlarms();
});

// Initialize Activity Tracker.
//
// The in-flight promise is memoised, not just the instance. A bare
// `if (!trackerInstance)` check yields at its first await, so two callers
// arriving together - the heartbeat alarm and a popup message on the same cold
// wake - would each build a tracker, double-register the tab listeners and
// count every second twice.
let trackerReady = null;
async function initTracker() {
  if (!trackerReady) {
    trackerReady = (async () => {
      const instance = new ActivityTracker();
      await instance.init();
      trackerInstance = instance;
      return instance;
    })().catch((err) => {
      // A cached REJECTED promise would answer every future call with the same
      // failure - one bad init (a failed importScripts, a storage hiccup) would
      // silently kill tracking for the rest of the browser session. Clear it so
      // the next event gets a genuine retry.
      trackerReady = null;
      throw err;
    });
  }
  return trackerReady;
}

/**
 * Run one event handler, absorbing failures.
 *
 * These listeners are the only callers of initTracker(), and an unhandled
 * rejection inside a service-worker listener is invisible to the user - the
 * extension just quietly stops recording. Logging keeps a failure diagnosable
 * without taking the worker down with it.
 */
async function withTracker(label, fn) {
  try {
    const tracker = await initTracker();
    await fn(tracker);
  } catch (err) {
    console.error(`Tasker: ${label} failed`, err);
  }
}

// Ensure tracker is running on worker awaken
initTracker();

// Clear any badge left behind by a confirmation whose timeout never fired,
// because the worker was suspended in the two seconds after a shortcut press.
// A stuck tick would otherwise sit on the icon until the next one.
if (chrome.action && chrome.action.setBadgeText) {
  chrome.action.setBadgeText({ text: '' });
}

// Tab, window and idle listeners are registered here, synchronously, on the
// worker's first turn. That registration is what tells Chrome to wake a
// suspended worker for these events; a listener added later - inside an async
// init(), say - misses anything that arrives during a cold start. Each handler
// waits for the tracker to be ready, then delegates.
chrome.tabs.onActivated.addListener((activeInfo) => {
  withTracker('tab activated', t => t.handleTabActivated(activeInfo));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  withTracker('tab updated', t => t.handleTabUpdated(tabId, changeInfo, tab));
});

if (chrome.windows) {
  chrome.windows.onFocusChanged.addListener((windowId) => {
    withTracker('window focus', t => t.handleWindowFocus(windowId));
  });
}

if (chrome.idle) {
  chrome.idle.onStateChanged.addListener((newState) => {
    withTracker('idle state', t => t.handleIdleState(newState));
  });
}

/**
 * Confirm a shortcut press on the toolbar icon.
 *
 * The badge is the only feedback channel that costs nothing: a desktop
 * notification would mean the `notifications` permission and a new warning on
 * the install screen, for a message the user needs for two seconds.
 */
function flashBadge(text, color) {
  if (!chrome.action || !chrome.action.setBadgeText) return;
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
}

// Keyboard shortcut: log the current activity as a win without opening anything.
if (chrome.commands) {
  chrome.commands.onCommand.addListener((command) => {
    if (command !== 'log_win') return;
    withTracker('log win', async (t) => {
      const result = await t.logCurrentWin();
      flashBadge(result.ok ? '✓' : '·', result.ok ? '#3E7A5E' : '#766E70');
    });
  });
}

// Alarm Listener: tracker heartbeat and auto Google Drive sync
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // The heartbeat is the reason the worker is awake right now. initTracker()
  // re-adopts and flushes the persisted session on a cold wake; handleTick()
  // covers the case where the worker was already running.
  if (alarm.name === 'tasker_tick') {
    await withTracker('heartbeat', t => t.handleTick());
    return;
  }

  if (alarm.name === TaskerPayments.POLL_ALARM) {
    await TaskerPayments.poll();
    return;
  }

  if (alarm.name === TaskerPayments.RECHECK_ALARM) {
    await TaskerPayments.recheck();
    return;
  }

  if (alarm.name === 'tasker_auto_drive_sync') {
    // Retention runs on the recurring alarm, not only on install/update, so
    // history cannot grow unbounded for users who go a long time between updates.
    await pruneHistory();

    const settings = await TaskerStorage.getSettings();
    if (settings.autoSyncDrive) {
      const todayKey = Formatters.getDateKey();
      try {
        await GoogleDriveSync.syncDailyLog(todayKey);
        console.log('Auto Drive Sync completed for:', todayKey);
      } catch (err) {
        console.warn('Auto Drive Sync warning:', err);
      }
    }
  }
});

// Centralized Message Handler for Popup, Dashboard & Options Page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only trust messages from this extension's own pages
  if (!sender || sender.id !== chrome.runtime.id) return;
  if (!message || typeof message.action !== 'string') return;
  handleAsyncMessage(message, sender)
    .then(res => sendResponse({ success: true, data: res }))
    .catch(err => sendResponse({ success: false, error: err.message || String(err), code: err.code || null }));
  return true; // Keep channel open for async response
});

async function handleAsyncMessage(message, sender) {
  await initTracker();
  const dateKey = message.dateKey || Formatters.getDateKey();
  const monthKey = message.monthKey || Formatters.getMonthKey();

  switch (message.action) {
    case 'GET_STATUS': {
      const settings = await TaskerStorage.getSettings();
      const dayData = await TaskerStorage.getDayData(dateKey);
      const highlights = await TaskerStorage.getHighlights(dateKey);
      const notes = await TaskerStorage.getNotes(dateKey);
      const lastSync = await TaskerStorage.get(`last_sync_${dateKey}`);

      return {
        isPaused: trackerInstance.trackingPaused,
        activeTab: trackerInstance.activeTab,
        totalSeconds: dayData.totalSeconds || 0,
        formattedTime: Formatters.formatDuration(dayData.totalSeconds || 0),
        highlightsCount: highlights.length,
        notesCount: notes.length,
        dayData,
        highlights,
        notes,
        lastSync: lastSync[`last_sync_${dateKey}`] || null,
        settings
      };
    }

    case 'TOGGLE_TRACKING': {
      const currentSettings = await TaskerStorage.getSettings();
      const newState = !currentSettings.isTrackingPaused;
      await TaskerStorage.saveSettings({ isTrackingPaused: newState });
      await trackerInstance.setPausedState(newState);
      return { isPaused: newState };
    }

    case 'LOG_CURRENT_WIN': {
      return await trackerInstance.logCurrentWin();
    }

    case 'ADD_HIGHLIGHT': {
      const item = await TaskerStorage.addHighlight(dateKey, message.highlight);
      return item;
    }

    case 'DELETE_HIGHLIGHT': {
      const updated = await TaskerStorage.deleteHighlight(dateKey, message.id);
      return updated;
    }

    case 'ADD_NOTE': {
      const item = await TaskerStorage.addNote(dateKey, message.text);
      return item;
    }

    case 'DELETE_NOTE': {
      const updated = await TaskerStorage.deleteNote(dateKey, message.id);
      return updated;
    }

    case 'SYNC_DRIVE_TODAY': {
      const result = await GoogleDriveSync.syncDailyLog(dateKey);
      return result;
    }

    case 'SYNC_DRIVE_MONTH': {
      const result = await GoogleDriveSync.syncMonthlyRecap(monthKey);
      return result;
    }

    case 'GET_DAILY_SUMMARY': {
      if (!(await TaskerLicense.isPro()) && !TaskerLicense.isDateVisible(dateKey)) {
        return { dateKey, locked: true, oldestVisible: TaskerLicense.oldestVisibleDateKey() };
      }
      return await ActivitySummarizer.generateDailySummary(dateKey);
    }

    case 'GET_MONTHLY_RECAP': {
      // Checked here rather than in the dashboard so the limit holds for any
      // caller, and so a locked month never costs an AI summary call.
      const access = await TaskerLicense.monthAccess(monthKey);
      if (!access.allowed) {
        return { monthKey, locked: true, state: access.state, oldestVisible: access.oldestVisible };
      }
      return await ActivitySummarizer.generateMonthlyRecap(monthKey);
    }

    case 'GET_CLIENT_ROLLUP': {
      // Read-only, so it stays available on free: seeing that the split exists
      // is the argument for buying the export that acts on it.
      await TaskerStorage.ensurePreferences();
      const days = await TaskerStorage.getDaysInRange(message.from, message.to);
      return {
        from: message.from,
        to: message.to,
        clients: TaskerClients.rollUp(days),
        isPro: await TaskerLicense.isPro()
      };
    }

    case 'BUILD_CSV_EXPORT': {
      if (!(await TaskerLicense.isPro())) {
        throw new Error('CSV export is part of Tasker Pro.');
      }
      await TaskerStorage.ensurePreferences();
      const days = await TaskerStorage.getDaysInRange(message.from, message.to);
      return {
        filename: TaskerClients.csvFileName(message.from, message.to),
        csv: TaskerClients.buildCsv(days)
      };
    }

    case 'AUTH_STATE': {
      const [account, pending] = [await TaskerAuth.state(), await TaskerLicense.getPending()];
      return { ...account, hasPendingCheckout: !!pending };
    }

    case 'AUTH_SIGN_UP':
    case 'AUTH_SIGN_IN': {
      const result = message.action === 'AUTH_SIGN_UP'
        ? await TaskerAuth.signUp(message.email, message.password)
        : await TaskerAuth.signIn(message.email, message.password);
      if (result.needsConfirmation) return result;

      // Signing in on a new machine should simply bring Pro with it. A failure
      // here is not a failed sign-in, so it never surfaces as one.
      let isPro = false;
      try { isPro = (await TaskerPayments.syncFromAccount()).isPro; } catch (e) { /* retried daily */ }
      return { ...result, isPro };
    }

    case 'AUTH_SIGN_OUT': {
      await TaskerAuth.signOut();
      // The licence belongs to the account, so it leaves the device with it.
      await TaskerLicense.deactivate();
      await TaskerLicense.clearPending();
      TaskerPayments._stopWatching();
      return { signedOut: true };
    }

    case 'AUTH_RECOVER': {
      await TaskerAuth.recover(message.email);
      return { sent: true };
    }

    case 'START_CHECKOUT': {
      return await TaskerPayments.start();
    }

    case 'ACTIVATE_LICENSE': {
      // The extension asks the service, and the service asks Bachs. Nothing in
      // this message - not the reference, not a "valid" flag - is trusted on its
      // own: Pro switches on only when the service says the checkout was paid.
      return await TaskerPayments.restore(message.reference);
    }

    case 'OPEN_DASHBOARD': {
      const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
      chrome.tabs.create({ url: dashboardUrl });
      return { opened: true };
    }

    case 'SAVE_SETTINGS': {
      const updated = await TaskerStorage.saveSettings(message.settings);
      if (trackerInstance) {
        trackerInstance.blacklistedDomains = updated.blacklistedDomains || [];
      }
      return updated;
    }

    case 'GET_WORK_PROFILE': {
      // Recomputed on request rather than cached. It is a few hundred
      // arithmetic operations over data already in memory, and a cached
      // profile is a profile that goes on asserting yesterday's answer after
      // the user has changed jobs - or corrected it in Settings.
      return await ActivitySummarizer.getWorkProfile();
    }

    case 'SET_WORK_PROFILE_OVERRIDE': {
      // null clears the override and hands the question back to the detector.
      const settings = await TaskerStorage.getSettings();
      const roleId = message.roleId || null;
      if (roleId !== null && !RoleDetector.ROLES[roleId]) {
        throw new Error(`Unknown work profile: ${roleId}`);
      }
      await TaskerStorage.saveSettings({
        workProfile: { ...settings.workProfile, override: roleId }
      });
      return await ActivitySummarizer.getWorkProfile();
    }

    case 'GET_UNRECOGNISED_SITES': {
      // The catalogue can never be complete - there is always another SaaS
      // tool - so the honest fix for the remainder is to show the user which
      // of THEIR sites went unrecognised and let them place each one in a
      // click. A long tail nobody can enumerate becomes a short list they can.
      const days = await TaskerStorage.getRecentDays(RoleDetector.LOOKBACK_DAYS);
      const totals = {};

      days.forEach(({ day }) => {
        if (!day || !day.domains) return;
        Object.keys(day.domains).forEach((domain) => {
          const seconds = Number(day.domains[domain]) || 0;
          if (seconds <= 0) return;
          // Re-categorise from the domain rather than trusting what was stored:
          // the catalogue has grown since those days were recorded, so a site
          // filed as Other last week may be recognised now.
          if (Formatters.categorizeActivity(`https://${domain}/`, '') !== 'Other') return;
          totals[domain] = (totals[domain] || 0) + seconds;
        });
      });

      return Object.keys(totals)
        .map(domain => ({ domain, seconds: Math.round(totals[domain]) }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 15);
    }

    case 'GET_ROLE_CATALOGUE': {
      // Shipped to the options page so the override picker cannot drift out of
      // step with what the detector actually knows about.
      return Object.keys(RoleDetector.ROLES).map(id => ({
        id,
        label: RoleDetector.ROLES[id].label,
        family: RoleDetector.ROLES[id].family,
        icon: RoleDetector.ROLES[id].icon
      }));
    }

    case 'BUILD_DAILY_PDF': {
      // Bytes rather than a Blob: structured clone cannot carry a Blob across
      // the message boundary, and an array of numbers survives it intact.
      if (!(await TaskerLicense.isPro()) && !TaskerLicense.isDateVisible(dateKey)) {
        throw new Error(`${Formatters.formatFullDate(dateKey)} is outside your ${TaskerLicense.FREE_HISTORY_DAYS}-day history window.`);
      }
      const summary = await ActivitySummarizer.generateDailySummary(dateKey);
      const doc = TaskerReports.buildDailyReport({
        dateKey,
        dayData: summary.dayData,
        highlights: summary.highlights,
        notes: summary.notes,
        profile: summary.profile
      });
      return {
        filename: TaskerReports.fileName('daily', dateKey, 'pdf'),
        bytes: Array.from(doc.build())
      };
    }

    case 'BUILD_MONTHLY_PDF': {
      // Same gate as the recap itself. Without it the PDF button would hand
      // back exactly the month the recap tab had just declined to show.
      const pdfAccess = await TaskerLicense.monthAccess(monthKey);
      if (!pdfAccess.allowed) {
        throw new Error(`${Formatters.formatMonthDisplay(monthKey)} is outside your ${TaskerLicense.FREE_HISTORY_DAYS}-day history window.`);
      }
      const recap = await ActivitySummarizer.generateMonthlyRecap(monthKey);
      const doc = TaskerReports.buildMonthlyReport({
        monthKey,
        monthStats: recap.monthStats,
        profile: recap.profile
      });
      return {
        filename: TaskerReports.fileName('monthly', monthKey, 'pdf'),
        bytes: Array.from(doc.build())
      };
    }

    case 'TEST_DRIVE_CONNECTION': {
      return await GoogleDriveSync.testConnection();
    }

    default:
      throw new Error(`Unknown action: ${message.action}`);
  }
}
