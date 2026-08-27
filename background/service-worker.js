/**
 * Tasker - Chrome Extension Service Worker (Manifest V3)
 */

try {
  importScripts(
    '../utils/formatters.js',
    '../utils/storage.js',
    './tracker.js',
    './summarizer.js',
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

  // Prune historical storage older than 180 days on install/update
  await TaskerStorage.pruneOldData(180);
});

// Browser Startup Listener
chrome.runtime.onStartup.addListener(async () => {
  console.log('Tasker Browser Startup initiated.');
  await initTracker();
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

  if (alarm.name === 'tasker_auto_drive_sync') {
    // Retention runs on the recurring alarm, not only on install/update, so
    // history cannot grow unbounded for users who go a long time between updates.
    await TaskerStorage.pruneOldData(180);

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
    .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
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
      return await ActivitySummarizer.generateDailySummary(dateKey);
    }

    case 'GET_MONTHLY_RECAP': {
      return await ActivitySummarizer.generateMonthlyRecap(monthKey);
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

    default:
      throw new Error(`Unknown action: ${message.action}`);
  }
}
