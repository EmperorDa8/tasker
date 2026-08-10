/**
 * Tasker - Popup UI Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const toggleTrackingBtn = document.getElementById('toggleTrackingBtn');
  const statusText = document.getElementById('statusText');
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const todayTimeDisplay = document.getElementById('todayTimeDisplay');
  const productivityScore = document.getElementById('productivityScore');
  const activeDomain = document.getElementById('activeDomain');
  const activeCategoryPill = document.getElementById('activeCategoryPill');
  const syncDriveBtn = document.getElementById('syncDriveBtn');
  const monthlyRecapBtn = document.getElementById('monthlyRecapBtn');
  const categoryList = document.getElementById('categoryList');
  const categoriesTotalCount = document.getElementById('categoriesTotalCount');
  const highlightInput = document.getElementById('highlightInput');
  const addHighlightBtn = document.getElementById('addHighlightBtn');
  const highlightsList = document.getElementById('highlightsList');
  const highlightBadge = document.getElementById('highlightBadge');
  const driveStatusText = document.getElementById('driveStatusText');
  const openOptionsBtn = document.getElementById('openOptionsBtn');

  // Additional UI Elements
  const quickHelpToggleBtn = document.getElementById('quickHelpToggleBtn');
  const helpDrawer = document.getElementById('helpDrawer');
  const closeHelpDrawer = document.getElementById('closeHelpDrawer');
  const onboardingCard = document.getElementById('onboardingCard');
  const dismissOnboardingBtn = document.getElementById('dismissOnboardingBtn');
  const copySummaryBtn = document.getElementById('copySummaryBtn');
  const popupToast = document.getElementById('popupToast');
  const suggestionChipBtns = document.querySelectorAll('.chip-btn');

  let currentDayData = null;
  let currentHighlights = [];

  // Check Onboarding state
  const settings = await TaskerStorage.getSettings();
  if (settings.hasSeenOnboarding) {
    onboardingCard.style.display = 'none';
  }

  dismissOnboardingBtn.addEventListener('click', async () => {
    onboardingCard.style.display = 'none';
    await TaskerStorage.saveSettings({ hasSeenOnboarding: true });
  });

  // Quick Help Drawer Toggle
  quickHelpToggleBtn.addEventListener('click', () => {
    helpDrawer.classList.toggle('hidden');
  });

  closeHelpDrawer.addEventListener('click', () => {
    helpDrawer.classList.add('hidden');
  });

  // 1-Click Copy Summary to Clipboard
  copySummaryBtn.addEventListener('click', () => {
    if (!currentDayData) return;
    const dateKey = Formatters.getDateKey();
    const summaryText = Formatters.formatDailyLogForClipboard(dateKey, currentDayData, currentHighlights);
    
    navigator.clipboard.writeText(summaryText).then(() => {
      showToast('Copied daily summary to clipboard!');
    }).catch(err => {
      showToast('Copied to clipboard!');
    });
  });

  // Suggestion Chips Click
  suggestionChipBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-text');
      if (!text) return;

      try {
        await chrome.runtime.sendMessage({
          action: 'ADD_HIGHLIGHT',
          highlight: { title: text, category: 'Productivity' }
        });
        showToast(`Logged: "${text}"`);
        await refreshPopupData();
      } catch (e) {
        console.error('Failed to log chip item:', e);
      }
    });
  });

  function showToast(msg) {
    popupToast.textContent = msg;
    popupToast.classList.remove('hidden');
    setTimeout(() => {
      popupToast.classList.add('hidden');
    }, 2200);
  }

  // 1. Load initial status from Service Worker
  await refreshPopupData();

  // 2. Start local live timer ticker
  timerTicker = setInterval(() => {
    if (!toggleTrackingBtn.classList.contains('paused')) {
      currentSeconds += 1;
      todayTimeDisplay.textContent = Formatters.formatDuration(currentSeconds);
    }
  }, 1000);

  // 3. Event Listener: Toggle Recording State
  toggleTrackingBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'TOGGLE_TRACKING' });
      if (response && response.success) {
        updateTrackingStateUI(response.data.isPaused);
      }
    } catch (e) {
      console.error('Failed to toggle tracking:', e);
    }
  });

  // 4. Event Listener: Open Full Dashboard
  openDashboardBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
  });

  // 5. Event Listener: Sync Today's Log to Google Drive
  syncDriveBtn.addEventListener('click', async () => {
    const originalText = syncDriveBtn.innerHTML;
    syncDriveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
      </svg>
      <span>Syncing...</span>
    `;
    syncDriveBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ action: 'SYNC_DRIVE_TODAY' });
      if (response && response.success) {
        driveStatusText.textContent = 'Drive Synced!';
        showToast('Synced to Google Drive!');
        syncDriveBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Synced!</span>
        `;
        setTimeout(() => {
          syncDriveBtn.innerHTML = originalText;
          syncDriveBtn.disabled = false;
        }, 2500);
      } else {
        alert('Google Drive Sync Notice:\n\n' + (response.error || 'Please sign in to Google Chrome or configure OAuth in Settings.'));
        syncDriveBtn.innerHTML = originalText;
        syncDriveBtn.disabled = false;
      }
    } catch (err) {
      alert('Google Drive Sync Notice:\nPlease ensure you are logged into your Chrome browser profile with a Google Account.');
      syncDriveBtn.innerHTML = originalText;
      syncDriveBtn.disabled = false;
    }
  });

  // 6. Event Listener: Open Monthly Recap in Dashboard
  monthlyRecapBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
  });

  // 7. Event Listener: Add Custom Highlight
  addHighlightBtn.addEventListener('click', async () => {
    const val = highlightInput.value.trim();
    if (!val) return;

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'ADD_HIGHLIGHT',
        highlight: { title: val, category: 'Productivity' }
      });
      if (res && res.success) {
        highlightInput.value = '';
        showToast('Milestone logged!');
        await refreshPopupData();
      }
    } catch (e) {
      console.error('Failed to add highlight:', e);
    }
  });

  highlightInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addHighlightBtn.click();
  });

  // 8. Event Listener: Options Page
  openOptionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  /**
   * Helper: Fetch latest extension data
   */
  async function refreshPopupData() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
      if (res && res.success && res.data) {
        const data = res.data;
        currentDayData = data.dayData;
        currentHighlights = data.highlights || [];

        // Recording state
        updateTrackingStateUI(data.isPaused);

        // Time display
        currentSeconds = data.totalSeconds || 0;
        todayTimeDisplay.textContent = Formatters.formatDuration(currentSeconds);
        productivityScore.textContent = Formatters.formatScore(data.dayData.productivityScore);

        // Active tab domain
        if (data.activeTab) {
          activeDomain.textContent = data.activeTab.domain || 'Active Browsing';
          activeCategoryPill.textContent = data.activeTab.category || 'General';
          const meta = Formatters.getCategoryMeta(data.activeTab.category);
          activeCategoryPill.style.backgroundColor = meta.bgColor;
          activeCategoryPill.style.color = meta.color;
        } else {
          activeDomain.textContent = 'Idle / Waiting';
          activeCategoryPill.textContent = 'General';
        }

        // Render Categories
        renderCategories(data.dayData.categories || {}, data.totalSeconds || 0);

        // Render Highlights
        renderHighlights(data.highlights || []);

        // Drive Sync Status
        if (data.lastSync) {
          driveStatusText.textContent = `Synced Today`;
        }
      }
    } catch (err) {
      console.warn('Unable to contact service worker:', err);
    }
  }

  function updateTrackingStateUI(isPaused) {
    if (isPaused) {
      toggleTrackingBtn.classList.remove('active');
      toggleTrackingBtn.classList.add('paused');
      statusText.textContent = 'Paused';
    } else {
      toggleTrackingBtn.classList.remove('paused');
      toggleTrackingBtn.classList.add('active');
      statusText.textContent = 'Recording';
    }
  }

  function renderCategories(categoriesObj, totalSecs) {
    categoryList.innerHTML = '';
    const keys = Object.keys(categoriesObj).sort((a, b) => categoriesObj[b] - categoriesObj[a]);
    categoriesTotalCount.textContent = `${keys.length} active`;

    if (keys.length === 0) {
      categoryList.innerHTML = `<div class="empty-state" style="font-size:11px; color:#9C9496; text-align:center; padding:10px;">Start browsing to log categories automatically</div>`;
      return;
    }

    keys.slice(0, 3).forEach(catKey => {
      const seconds = categoriesObj[catKey];
      const meta = Formatters.getCategoryMeta(catKey);
      const percentage = totalSecs > 0 ? Math.round((seconds / totalSecs) * 100) : 0;

      const item = document.createElement('div');
      item.className = 'category-item';
      item.innerHTML = `
        <div class="cat-top">
          <div class="cat-name-group">
            <span class="cat-color-dot" style="background-color: ${meta.color}"></span>
            <span>${Formatters.escapeHtml(catKey)}</span>
          </div>
          <span class="cat-time">${Formatters.formatDuration(seconds)} (${percentage}%)</span>
        </div>
        <div class="cat-progress-bg">
          <div class="cat-progress-fill" style="width: ${percentage}%; background-color: ${meta.color};"></div>
        </div>
      `;
      categoryList.appendChild(item);
    });
  }

  function renderHighlights(highlightsArr) {
    highlightsList.innerHTML = '';
    highlightBadge.textContent = `${highlightsArr.length} logged`;

    if (highlightsArr.length === 0) {
      highlightsList.innerHTML = `<li class="highlight-item" style="color: #9C9496; justify-content: center;">No milestones logged yet today. Use quick chips above!</li>`;
      return;
    }

    highlightsArr.forEach(item => {
      const li = document.createElement('li');
      li.className = 'highlight-item';
      li.innerHTML = `
        <span class="highlight-text">${Formatters.escapeHtml(item.title)}</span>
        <button class="delete-hl-btn" data-id="${Formatters.escapeHtml(item.id)}" title="Remove milestone">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      li.querySelector('.delete-hl-btn').addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        await chrome.runtime.sendMessage({ action: 'DELETE_HIGHLIGHT', id });
        showToast('Milestone removed');
        await refreshPopupData();
      });

      highlightsList.appendChild(li);
    });
  }
});
