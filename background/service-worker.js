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

// Initialize Activity Tracker
async function initTracker() {
  if (!trackerInstance) {
    trackerInstance = new ActivityTracker();
    await trackerInstance.init();
  }
}

// Ensure tracker is running on worker awaken
initTracker();

// Alarm Listener for Auto Google Drive Sync
chrome.alarms.onAlarm.addListener(async (alarm) => {
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
