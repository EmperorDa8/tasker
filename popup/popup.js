/**
 * Tasker - popup controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  const el = {
    toggleTracking: $('toggleTrackingBtn'),
    statusText: $('statusText'),
    openDashboard: $('openDashboardBtn'),
    todayTime: $('todayTimeDisplay'),
    scoreRing: $('scoreRing'),
    score: $('productivityScore'),
    activeDomain: $('activeDomain'),
    activeCategory: $('activeCategoryPill'),
    syncDrive: $('syncDriveBtn'),
    downloadPdf: $('downloadPdfBtn'),
    copySummary: $('copySummaryBtn'),
    categoryList: $('categoryList'),
    categoryCount: $('categoriesTotalCount'),
    workProfileBody: $('workProfileBody'),
    workProfileWindow: $('workProfileWindow'),
    highlightInput: $('highlightInput'),
    addHighlight: $('addHighlightBtn'),
    highlightsList: $('highlightsList'),
    highlightBadge: $('highlightBadge'),
    logCurrentWin: $('logCurrentWinBtn'),
    driveStatusText: $('driveStatusText'),
    driveStatusDot: $('driveStatusDot'),
    openOptions: $('openOptionsBtn'),
    helpToggle: $('quickHelpToggleBtn'),
    helpDrawer: $('helpDrawer'),
    closeHelp: $('closeHelpDrawer'),
    onboarding: $('onboardingCard'),
    dismissOnboarding: $('dismissOnboardingBtn'),
    toast: $('popupToast')
  };

  let currentSeconds = 0;
  let currentDayData = null;
  let currentHighlights = [];
  let isPaused = false;

  const settings = await TaskerUI.initSurface();
  if (settings && settings.hasSeenOnboarding) {
    el.onboarding.classList.add('hidden');
  }

  /* ------------------------------------------------------------ helpers - */

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.toast.classList.add('hidden'), 2600);
  }

  async function send(action, payload) {
    const res = await chrome.runtime.sendMessage({ action, ...(payload || {}) });
    if (!res || !res.success) {
      throw new Error((res && res.error) || 'The extension did not respond');
    }
    return res.data;
  }

  /**
   * Run a button's action with a pending state, and put the button back
   * whatever happens. Every async button in here previously restored itself
   * on the happy path only, so one failed sync left a dead "Syncing..." button
   * until the popup was reopened.
   */
  async function withPending(button, pendingLabel, task) {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML =
      `<span data-icon="sync" data-size="sm" class="spin"></span>` +
      `<span class="btn-label">${Formatters.escapeHtml(pendingLabel)}</span>`;
    if (typeof TaskerIcons !== 'undefined') TaskerIcons.hydrate(button);

    try {
      return await task();
    } finally {
      button.innerHTML = original;
      button.disabled = false;
      if (typeof TaskerIcons !== 'undefined') TaskerIcons.hydrate(button);
    }
  }

  /* -------------------------------------------------------------- render - */

  function renderTrackingState(paused) {
    isPaused = !!paused;
    el.toggleTracking.classList.toggle('is-recording', !isPaused);
    el.toggleTracking.classList.toggle('is-paused', isPaused);
    el.statusText.textContent = isPaused ? 'Paused' : 'Recording';
  }

  function renderScore(score) {
    const hasScore = score !== null && score !== undefined;
    el.score.textContent = hasScore ? String(score) : '—';
    // The ring is driven by a custom property so the "no score yet" case is an
    // empty ring rather than a ring that looks like a zero.
    el.scoreRing.style.setProperty('--score', hasScore ? score : 0);
    el.scoreRing.title = hasScore
      ? `Focus score ${score}/100 - a weighted average of where today's time went`
      : 'Not enough tracked time yet to score the day';
  }

  function renderCategories(categories, totalSeconds) {
    const keys = Object.keys(categories || {})
      .filter(k => categories[k] > 0)
      .sort((a, b) => categories[b] - categories[a]);

    el.categoryCount.textContent = `${keys.length} active`;

    if (keys.length === 0) {
      el.categoryList.innerHTML =
        '<p class="empty-note">Nothing tracked yet today. Start browsing and categories appear here.</p>';
      return;
    }

    el.categoryList.innerHTML = keys.slice(0, 4).map((key) => {
      const seconds = categories[key];
      const meta = Formatters.getCategoryMeta(key);
      const percent = totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0;
      return `
        <div class="category-item">
          <div class="cat-top">
            <span class="cat-name">
              <span class="cat-glyph" style="background:${meta.bgColor}; color:${meta.color}"
                    data-icon="${meta.icon}" data-size="sm"></span>
              ${Formatters.escapeHtml(key)}
            </span>
            <span class="cat-time">${Formatters.formatDuration(seconds)} · ${percent}%</span>
          </div>
          <div class="cat-track">
            <div class="cat-fill" style="width:${percent}%; background:${meta.color}"></div>
          </div>
        </div>`;
    }).join('');
  }

  function renderHighlights(highlights) {
    el.highlightBadge.textContent = `${highlights.length} logged`;

    if (highlights.length === 0) {
      el.highlightsList.innerHTML =
        '<li class="empty-note">Nothing logged yet. Use a chip above, or the keyboard shortcut.</li>';
      return;
    }

    el.highlightsList.innerHTML = highlights.map(item => `
      <li class="highlight-item">
        <span class="highlight-text" title="${Formatters.escapeHtml(item.title)}">${Formatters.escapeHtml(item.title)}</span>
        <span class="highlight-time">${Formatters.escapeHtml(item.time || '')}</span>
        <button class="delete-hl-btn" data-id="${Formatters.escapeHtml(item.id)}"
                title="Remove" aria-label="Remove accomplishment">
          <span data-icon="close" data-size="xs"></span>
        </button>
      </li>`).join('');

    el.highlightsList.querySelectorAll('.delete-hl-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await send('DELETE_HIGHLIGHT', { id: btn.getAttribute('data-id') });
          showToast('Removed');
          await refresh();
        } catch (err) {
          showToast(err.message);
        }
      });
    });
  }

  /**
   * The work profile is fetched separately from GET_STATUS.
   *
   * It reads three weeks of history, and the popup should not wait on that to
   * show today's number - the timer and the category list are what the user
   * opened this for.
   */
  async function loadWorkProfile() {
    try {
      const profile = await send('GET_WORK_PROFILE');
      if (profile && profile.stats && profile.stats.windowDays) {
        el.workProfileWindow.textContent = `last ${profile.stats.windowDays} days`;
      }
      TaskerUI.renderWorkProfile(el.workProfileBody, profile, {
        dense: true,
        onCorrect: openOptions
      });
    } catch (err) {
      el.workProfileBody.innerHTML =
        `<p class="wp-note">Could not read your recent activity: ${Formatters.escapeHtml(err.message)}</p>`;
    }
  }

  async function refresh() {
    try {
      const data = await send('GET_STATUS');
      currentDayData = data.dayData;
      currentHighlights = data.highlights || [];

      renderTrackingState(data.isPaused);

      currentSeconds = data.totalSeconds || 0;
      el.todayTime.textContent = Formatters.formatDuration(currentSeconds);
      renderScore(data.dayData.productivityScore);

      if (data.activeTab) {
        const meta = Formatters.getCategoryMeta(data.activeTab.category);
        el.activeDomain.textContent = data.activeTab.domain || 'Active browsing';
        el.activeCategory.textContent = data.activeTab.category || 'General';
        el.activeCategory.style.background = meta.bgColor;
        el.activeCategory.style.color = meta.color;
      } else {
        el.activeDomain.textContent = isPaused ? 'Recording paused' : 'Idle - nothing being tracked';
        el.activeCategory.textContent = '—';
        el.activeCategory.style.background = '';
        el.activeCategory.style.color = '';
      }

      renderCategories(data.dayData.categories || {}, currentSeconds);
      renderHighlights(currentHighlights);

      if (data.lastSync) {
        const when = new Date(data.lastSync.syncedAt);
        el.driveStatusText.textContent = `Synced ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
        el.driveStatusDot.className = 'state-dot';
      } else {
        el.driveStatusText.textContent = 'Not synced today';
        el.driveStatusDot.className = 'state-dot is-idle';
      }

      if (typeof TaskerIcons !== 'undefined') TaskerIcons.hydrate(document);
    } catch (err) {
      console.warn('Tasker popup: could not reach the service worker', err);
      el.activeDomain.textContent = 'Extension is waking up…';
    }
  }

  /* --------------------------------------------------------------- wire - */

  function openOptions() {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open(chrome.runtime.getURL('options/options.html'));
  }

  el.dismissOnboarding.addEventListener('click', async () => {
    el.onboarding.classList.add('hidden');
    await TaskerStorage.saveSettings({ hasSeenOnboarding: true });
  });

  el.helpToggle.addEventListener('click', () => el.helpDrawer.classList.toggle('hidden'));
  el.closeHelp.addEventListener('click', () => el.helpDrawer.classList.add('hidden'));
  el.openDashboard.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' }));
  el.openOptions.addEventListener('click', openOptions);

  el.toggleTracking.addEventListener('click', async () => {
    try {
      const data = await send('TOGGLE_TRACKING');
      renderTrackingState(data.isPaused);
      showToast(data.isPaused ? 'Recording paused' : 'Recording resumed');
    } catch (err) {
      showToast(err.message);
    }
  });

  el.syncDrive.addEventListener('click', () => {
    withPending(el.syncDrive, 'Syncing', async () => {
      try {
        const result = await send('SYNC_DRIVE_TODAY');
        const kind = result.mimeType === 'application/pdf' ? 'PDF' : 'log';
        showToast(`Today's ${kind} is in your Drive folder`);
        el.driveStatusText.textContent = 'Synced just now';
        el.driveStatusDot.className = 'state-dot';
      } catch (err) {
        // A sync failure is nearly always a sign-in problem, and the message
        // from driveSync already says which one - so show it rather than a
        // generic "something went wrong".
        showToast(err.message);
        el.driveStatusDot.className = 'state-dot is-error';
      }
    });
  });

  el.downloadPdf.addEventListener('click', () => {
    withPending(el.downloadPdf, 'Building', async () => {
      try {
        const filename = await TaskerUI.downloadReportPdf('daily', { dateKey: Formatters.getDateKey() });
        showToast(`Saved ${filename}`);
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  el.copySummary.addEventListener('click', async () => {
    if (!currentDayData) return showToast('Nothing tracked yet today');
    const text = Formatters.formatDailyLogForClipboard(
      Formatters.getDateKey(), currentDayData, currentHighlights);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Summary copied');
    } catch (err) {
      showToast('Could not reach the clipboard');
    }
  });

  document.querySelectorAll('.quick-chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const title = chip.getAttribute('data-text');
      if (!title) return;
      try {
        await send('ADD_HIGHLIGHT', { highlight: { title, category: 'Productivity' } });
        showToast(`Logged: ${title}`);
        await refresh();
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  el.logCurrentWin.addEventListener('click', async () => {
    try {
      const result = await send('LOG_CURRENT_WIN');
      showToast(result.ok ? `Logged: ${result.highlight.title}` : (result.reason || 'Nothing to log'));
      if (result.ok) await refresh();
    } catch (err) {
      showToast(err.message);
    }
  });

  el.addHighlight.addEventListener('click', async () => {
    const title = el.highlightInput.value.trim();
    if (!title) return;
    try {
      await send('ADD_HIGHLIGHT', { highlight: { title, category: 'Productivity' } });
      el.highlightInput.value = '';
      showToast('Logged');
      await refresh();
    } catch (err) {
      showToast(err.message);
    }
  });

  el.highlightInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.addHighlight.click();
  });

  /* --------------------------------------------------------------- start - */

  await refresh();
  loadWorkProfile();

  // Local ticker so the figure moves while the popup is open. The worker owns
  // the real total; this only advances the display between refreshes.
  setInterval(() => {
    if (isPaused) return;
    currentSeconds += 1;
    el.todayTime.textContent = Formatters.formatDuration(currentSeconds);
  }, 1000);
});
