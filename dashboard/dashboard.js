/**
 * Tasker - dashboard controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  const el = {
    navItems: document.querySelectorAll('.nav-item'),
    tabs: document.querySelectorAll('.tab'),
    pageTitle: $('pageTitle'),
    pageSubtitle: $('pageSubtitle'),
    quickSync: $('quickSyncBtn'),
    downloadTodayPdf: $('downloadTodayPdfBtn'),
    optionsPage: $('optionsPageBtn'),
    toast: $('dashToast'),

    coverageBanner: $('coverageBanner'),
    coverageHeadline: $('coverageHeadline'),
    coverageDetail: $('coverageDetail'),
    overviewTodayTime: $('overviewTodayTime'),
    overviewProductivity: $('overviewProductivity'),
    overviewHighlights: $('overviewHighlightsCount'),
    overviewDriveStatus: $('overviewDriveStatus'),
    categoryChart: $('categoryChartContainer'),
    topDomains: $('topDomainsGroup'),
    workRollupRow: $('workRollupRow'),
    workRollupList: $('workRollupList'),
    todayActivity: $('todayActivityGroup'),

    workProfileBody: $('workProfileBody'),
    openProfileSettings: $('openProfileSettingsBtn'),

    monthSelect: $('monthSelect'),
    downloadMonthPdf: $('downloadMonthPdfBtn'),
    copyMonthMarkdown: $('copyMonthMarkdownBtn'),
    syncMonthToDrive: $('syncMonthToDriveBtn'),
    recapMonthTitle: $('recapMonthTitle'),
    recapSummary: $('recapExecutiveSummary'),
    recapTotalTime: $('recapTotalTime'),
    recapDaysCount: $('recapDaysCount'),
    recapScore: $('recapScore'),
    monthlyMilestones: $('monthlyMilestonesList'),
    monthlyCategoryBars: $('monthlyCategoryBars'),
    monthlyActivity: $('monthlyActivityGroup'),
    monthlyMarkdown: $('monthlyMarkdownPreview'),

    datePicker: $('dailyDatePicker'),
    downloadDayPdf: $('downloadDayPdfBtn'),
    syncDayToDrive: $('syncDayToDriveBtn'),
    dailyFocusDetails: $('dailyFocusDetails'),
    dailyNoteInput: $('dailyNoteInput'),
    addDailyNote: $('addDailyNoteBtn'),
    dailyNotes: $('dailyNotesList'),

    sidebarDriveFolder: $('sidebarDriveFolder'),
    driveSummaryFolder: $('driveSummaryFolder'),
    driveSummaryFormat: $('driveSummaryFormat'),
    driveSummaryFiling: $('driveSummaryFiling'),
    driveSummaryAuto: $('driveSummaryAuto'),
    testDriveConn: $('testDriveConnBtn'),
    openDriveSettings: $('openDriveSettingsBtn'),
    driveResult: $('driveResult')
  };

  let currentMonthKey = Formatters.getMonthKey();
  let currentDateKey = Formatters.getDateKey();
  let monthlyMarkdownText = '';

  await TaskerUI.initTheme();

  /* ------------------------------------------------------------ helpers - */

  function toast(message, isError) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    el.toast.style.background = isError ? 'var(--danger)' : '';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.toast.classList.add('hidden'), 3000);
  }

  async function send(action, payload) {
    const res = await chrome.runtime.sendMessage({ action, ...(payload || {}) });
    if (!res || !res.success) throw new Error((res && res.error) || 'The extension did not respond');
    return res.data;
  }

  function icon(name, size) {
    return TaskerIcons.markup(name, size || 'sm');
  }

  /**
   * Run an async button action with a pending state that is always cleared.
   */
  async function withPending(button, label, task) {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span data-icon="sync" data-size="sm" class="spin"></span> ${Formatters.escapeHtml(label)}`;
    TaskerIcons.hydrate(button);
    try {
      return await task();
    } finally {
      button.innerHTML = original;
      button.disabled = false;
      TaskerIcons.hydrate(button);
    }
  }

  function openOptions() {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open(chrome.runtime.getURL('options/options.html'));
  }

  /** One meter row: name, value and a proportion bar. */
  function meterRow(name, value, fraction, color, glyph) {
    const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
    const glyphMarkup = glyph
      ? `<span class="meter-glyph" style="background:${glyph.bg}; color:${glyph.color}"
              data-icon="${glyph.icon}" data-size="sm"></span>`
      : '';
    return `
      <div class="meter">
        <div class="meter-top">
          <span class="meter-name">${glyphMarkup}${Formatters.escapeHtml(name)}</span>
          <span class="meter-value">${Formatters.escapeHtml(value)}</span>
        </div>
        <div class="meter-track">
          <div class="meter-fill" style="width:${pct}%; background:${color}"></div>
        </div>
      </div>`;
  }

  function emptyNote(message) {
    return `<p class="empty-note">${Formatters.escapeHtml(message)}</p>`;
  }

  /* --------------------------------------------------------------- tabs - */

  const TAB_COPY = {
    'overview': {
      title: 'Overview',
      sub: "Today's focus time, categories and what you actually worked on."
    },
    'work-profile': {
      title: 'Work profile',
      sub: 'What your browsing resembles, the evidence behind it, and where it stops short.'
    },
    'monthly-recap': {
      title: 'Monthly recap',
      sub: 'The month as a document: milestones, category mix and a branded PDF.'
    },
    'daily-logs': {
      title: 'Daily logs',
      sub: 'Any single day in detail, with the notes attached to it.'
    },
    'drive-sync': {
      title: 'Google Drive',
      sub: 'Where reports are filed, in what format, and what Tasker can see.'
    }
  };

  function switchTab(tabId) {
    el.navItems.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === tabId));
    el.tabs.forEach(t => t.classList.toggle('active', t.id === `tab-${tabId}`));

    const copy = TAB_COPY[tabId];
    if (copy) {
      el.pageTitle.textContent = copy.title;
      el.pageSubtitle.textContent = copy.sub;
    }

    // The topbar's PDF and Sync buttons act on today, which only makes sense on
    // the tabs that are about today. Elsewhere each tab carries its own.
    const todayActions = tabId === 'overview' || tabId === 'work-profile';
    el.downloadTodayPdf.classList.toggle('hidden', !todayActions);
    el.quickSync.classList.toggle('hidden', !todayActions);

    if (tabId === 'overview') loadOverview();
    if (tabId === 'work-profile') loadWorkProfile();
    if (tabId === 'monthly-recap') loadMonthlyRecap(currentMonthKey);
    if (tabId === 'daily-logs') loadDailyLog(currentDateKey);
    if (tabId === 'drive-sync') loadDriveSummary();
  }

  el.navItems.forEach((item) => {
    item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
  });

  /* ------------------------------------------------------------ overview - */

  /**
   * Say what today's total does not include.
   *
   * Hidden until there is a long enough span to reconcile: on a short morning
   * the gap is noise, and a banner that always fires is one nobody reads.
   */
  function renderCoverage(dayData) {
    const coverage = Formatters.computeCoverage(dayData || {});
    if (!coverage) {
      el.coverageBanner.classList.add('hidden');
      return;
    }
    el.coverageHeadline.textContent =
      `Browser time only - ${coverage.coveragePercent}% of this span is visible here`;
    el.coverageDetail.textContent = Formatters.formatCoverageNote(coverage);
    el.coverageBanner.classList.remove('hidden');
  }

  function renderCategories(container, categories, totalSeconds) {
    const keys = Object.keys(categories || {})
      .filter(k => categories[k] > 0)
      .sort((a, b) => categories[b] - categories[a]);

    if (keys.length === 0) {
      container.innerHTML = emptyNote('Nothing tracked yet.');
      return;
    }

    container.innerHTML = keys.map((key) => {
      const seconds = categories[key];
      const meta = Formatters.getCategoryMeta(key);
      const fraction = totalSeconds > 0 ? seconds / totalSeconds : 0;
      return meterRow(
        meta.label,
        `${Formatters.formatDuration(seconds)} · ${Math.round(fraction * 100)}%`,
        fraction,
        meta.color,
        { icon: meta.icon, bg: meta.bgColor, color: meta.color }
      );
    }).join('');

    TaskerIcons.hydrate(container);
  }

  function renderTopDomains(domains) {
    const sorted = Object.keys(domains || {})
      .sort((a, b) => domains[b] - domains[a])
      .slice(0, 8);

    if (sorted.length === 0) {
      el.topDomains.innerHTML = emptyNote('No sites recorded yet.');
      return;
    }

    el.topDomains.innerHTML = sorted.map(domain => `
      <div class="list-row">
        <span>${Formatters.escapeHtml(domain)}</span>
        <span class="mono">${Formatters.formatDuration(domains[domain])}</span>
      </div>`).join('');
  }

  /**
   * Time grouped by the repo or ticket it went into.
   *
   * The whole card stays hidden when nothing resolves to either - for a
   * marketer or a student it never applies, and an empty "Repositories &
   * tickets" panel is a permanent reminder that the tool was built for
   * somebody else.
   */
  function renderWorkRollup(source) {
    const groups = Formatters.rollupWork(source || {}, 8);
    if (groups.length === 0) {
      el.workRollupRow.classList.add('hidden');
      return;
    }

    el.workRollupList.innerHTML = groups.map((group) => {
      const detail = Formatters.formatRollupItems(group);
      return `
        <div class="rollup">
          <div class="rollup-main">
            <span class="rollup-key">
              <span class="rollup-kind ${Formatters.escapeHtml(group.type)}">${Formatters.escapeHtml(group.type)}</span>
              ${Formatters.escapeHtml(group.key)}
            </span>
            ${detail ? `<span class="rollup-items">${Formatters.escapeHtml(detail)}</span>` : ''}
          </div>
          <span class="rollup-time">${Formatters.formatDuration(group.seconds)}</span>
        </div>`;
    }).join('');

    el.workRollupRow.classList.remove('hidden');
  }

  /**
   * The "what you worked on" list, shared by the overview, the month and the
   * daily log - all three show the same shape of row.
   */
  function renderActivities(container, activities, emptyMessage) {
    if (!activities || activities.length === 0) {
      container.innerHTML = emptyNote(emptyMessage);
      return;
    }

    // Every interpolated value below is page-controlled (titles, URLs), so all
    // of it goes through escapeHtml.
    container.innerHTML = activities.map((item) => {
      const meta = Formatters.getCategoryMeta(item.category);
      const visits = item.visits > 1 ? `${item.visits} visits` : '1 visit';
      const where = item.domain ? `${Formatters.escapeHtml(item.domain)} · ` : '';
      return `
        <div class="activity">
          <span class="activity-action" style="background:${meta.bgColor}; color:${meta.color}">
            ${Formatters.escapeHtml(item.action)}
          </span>
          <div class="activity-main">
            <span class="activity-label" title="${Formatters.escapeHtml(item.label)}">${Formatters.escapeHtml(item.label)}</span>
            <span class="activity-meta">${where}${visits}</span>
          </div>
          <span class="activity-time">${Formatters.formatDuration(item.seconds)}</span>
        </div>`;
    }).join('');
  }

  async function loadOverview() {
    try {
      const data = await send('GET_STATUS');
      el.overviewTodayTime.textContent = data.formattedTime;
      el.overviewProductivity.textContent = Formatters.formatScore(data.dayData.productivityScore, ' / 100');
      el.overviewHighlights.textContent = String(data.highlightsCount || 0);
      el.overviewDriveStatus.textContent = data.lastSync ? 'Synced today' : 'Not synced';

      renderCoverage(data.dayData);
      renderWorkRollup(data.dayData);
      renderCategories(el.categoryChart, data.dayData.categories || {}, data.totalSeconds || 0);
      renderTopDomains(data.dayData.domains || {});
      renderActivities(el.todayActivity, Formatters.rankActivities(data.dayData, 12),
        'No activity recorded yet today.');

      if (data.settings && data.settings.googleDriveFolderName) {
        el.sidebarDriveFolder.textContent = data.settings.googleDriveFolderName;
      }
    } catch (err) {
      console.warn('Tasker dashboard: could not load overview', err);
      el.categoryChart.innerHTML = emptyNote('The extension is waking up. Try again in a moment.');
    }
  }

  /* -------------------------------------------------------- work profile - */

  async function loadWorkProfile() {
    try {
      const profile = await send('GET_WORK_PROFILE');
      TaskerUI.renderWorkProfile(el.workProfileBody, profile, { onCorrect: openOptions });
      TaskerIcons.hydrate(el.workProfileBody);
    } catch (err) {
      el.workProfileBody.innerHTML = `<p class="wp-note">${Formatters.escapeHtml(err.message)}</p>`;
    }
  }

  el.openProfileSettings.addEventListener('click', openOptions);

  /* ------------------------------------------------------- monthly recap - */

  function populateMonthSelect() {
    const now = new Date();
    el.monthSelect.textContent = '';
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = Formatters.getMonthKey(d);
      const option = document.createElement('option');
      option.value = key;
      option.textContent = Formatters.formatMonthDisplay(key);
      if (i === 0) option.selected = true;
      el.monthSelect.appendChild(option);
    }
  }

  function renderMilestones(milestones) {
    if (!milestones || milestones.length === 0) {
      el.monthlyMilestones.innerHTML = `<li>${emptyNote('Nothing logged for this month yet.')}</li>`;
      return;
    }

    el.monthlyMilestones.innerHTML = milestones.map((m, index) => `
      <li class="milestone">
        <span class="milestone-badge">${index + 1}</span>
        <div class="milestone-body">
          <strong>
            ${Formatters.escapeHtml(m.title || 'Accomplishment')}
            ${m.date ? `<time>${Formatters.escapeHtml(m.date)}</time>` : ''}
          </strong>
          ${m.description ? `<p>${Formatters.escapeHtml(m.description)}</p>` : ''}
        </div>
      </li>`).join('');
  }

  async function loadMonthlyRecap(monthKey) {
    el.recapMonthTitle.textContent = Formatters.formatMonthDisplay(monthKey);
    el.recapSummary.textContent = 'Generating the recap…';
    el.monthlyMarkdown.textContent = '';

    try {
      const recap = await send('GET_MONTHLY_RECAP', { monthKey });
      const stats = recap.monthStats;
      monthlyMarkdownText = recap.markdown || '';

      el.recapTotalTime.textContent = Formatters.formatDuration(stats.totalSeconds || 0);
      el.recapDaysCount.textContent = String(stats.daysTrackedCount || 0);
      el.recapScore.textContent = Formatters.formatScore(stats.monthlyScore, '%');

      // The score clause is dropped entirely when there is not enough data,
      // rather than padded out with a placeholder number.
      const scoreClause = stats.monthlyScore == null
        ? ''
        : `, at an overall focus score of ${stats.monthlyScore}%`;
      el.recapSummary.textContent = stats.aiSummaryParagraph ||
        `In ${Formatters.formatMonthDisplay(monthKey)} you tracked ${stats.daysTrackedCount || 0} active ` +
        `day${stats.daysTrackedCount === 1 ? '' : 's'} totalling ${Formatters.formatDuration(stats.totalSeconds || 0)} ` +
        `in Chrome. Your largest category was ${stats.topCategory || 'Development'}${scoreClause}.`;

      renderMilestones(stats.milestones || []);
      renderCategories(el.monthlyCategoryBars, stats.categories || {}, stats.totalSeconds || 0);
      renderActivities(el.monthlyActivity, stats.topActivities || [],
        'No detailed activity recorded for this month.');
      el.monthlyMarkdown.textContent = monthlyMarkdownText;
    } catch (err) {
      el.recapSummary.textContent = `Could not build the recap: ${err.message}`;
    }
  }

  el.monthSelect.addEventListener('change', (event) => {
    currentMonthKey = event.target.value;
    loadMonthlyRecap(currentMonthKey);
  });

  el.copyMonthMarkdown.addEventListener('click', async () => {
    if (!monthlyMarkdownText) return toast('No recap to copy yet');
    try {
      await navigator.clipboard.writeText(monthlyMarkdownText);
      toast('Markdown copied');
    } catch (err) {
      toast('Could not reach the clipboard', true);
    }
  });

  el.downloadMonthPdf.addEventListener('click', () => {
    withPending(el.downloadMonthPdf, 'Building…', async () => {
      try {
        const filename = await TaskerUI.downloadReportPdf('monthly', { monthKey: currentMonthKey });
        toast(`Saved ${filename}`);
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  el.syncMonthToDrive.addEventListener('click', () => {
    withPending(el.syncMonthToDrive, 'Syncing…', async () => {
      try {
        await send('SYNC_DRIVE_MONTH', { monthKey: currentMonthKey });
        toast(`${Formatters.formatMonthDisplay(currentMonthKey)} recap is in your Drive folder`);
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  /* ----------------------------------------------------------- daily log - */

  function renderNotes(notes) {
    if (!notes || notes.length === 0) {
      el.dailyNotes.innerHTML = `<li>${emptyNote('No notes for this date.')}</li>`;
      return;
    }

    el.dailyNotes.innerHTML = notes.map(note => `
      <li class="note-item">
        <time>${Formatters.escapeHtml(note.time || '')}</time>
        <span>${Formatters.escapeHtml(note.text)}</span>
        <button class="note-delete" data-id="${Formatters.escapeHtml(note.id)}"
                title="Delete note" aria-label="Delete note">
          <span data-icon="close" data-size="xs"></span>
        </button>
      </li>`).join('');

    TaskerIcons.hydrate(el.dailyNotes);

    el.dailyNotes.querySelectorAll('.note-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await send('DELETE_NOTE', { dateKey: currentDateKey, id: btn.getAttribute('data-id') });
          await loadDailyLog(currentDateKey);
        } catch (err) {
          toast(err.message, true);
        }
      });
    });
  }

  async function loadDailyLog(dateKey) {
    try {
      const summary = await send('GET_DAILY_SUMMARY', { dateKey });
      const dayData = summary.dayData;
      const total = dayData.totalSeconds || 0;

      const domains = dayData.domains || {};
      const sortedDomains = Object.keys(domains).sort((a, b) => domains[b] - domains[a]).slice(0, 10);

      el.dailyFocusDetails.innerHTML = `
        <div class="stat-grid">
          <div class="stat">
            <span class="t-label">Time in Chrome</span>
            <span class="stat-value">${Formatters.formatDuration(total)}</span>
          </div>
          <div class="stat">
            <span class="t-label">Focus score</span>
            <span class="stat-value">${Formatters.formatScore(dayData.productivityScore, ' / 100')}</span>
          </div>
          <div class="stat">
            <span class="t-label">Accomplishments</span>
            <span class="stat-value">${(summary.highlights || []).length}</span>
          </div>
        </div>
        <h4 class="t-label" style="margin-top:var(--sp-4)">What you worked on</h4>
        <div id="dailyActivityGroup"></div>
        <h4 class="t-label" style="margin-top:var(--sp-4)">Top sites</h4>
        <div id="dailyDomainGroup"></div>`;

      // Populated after the innerHTML above, which is what creates the
      // containers these write into.
      renderActivities(document.getElementById('dailyActivityGroup'),
        Formatters.rankActivities(dayData, 12), 'No detailed activity for this date.');

      const domainGroup = document.getElementById('dailyDomainGroup');
      domainGroup.innerHTML = sortedDomains.length
        ? sortedDomains.map(domain => `
            <div class="list-row">
              <span>${Formatters.escapeHtml(domain)}</span>
              <span class="mono">${Formatters.formatDuration(domains[domain])}</span>
            </div>`).join('')
        : emptyNote('No sites recorded for this date.');

      renderNotes(summary.notes || []);
    } catch (err) {
      el.dailyFocusDetails.innerHTML = emptyNote(err.message);
    }
  }

  el.datePicker.value = currentDateKey;
  el.datePicker.addEventListener('change', (event) => {
    currentDateKey = event.target.value;
    loadDailyLog(currentDateKey);
  });

  el.addDailyNote.addEventListener('click', async () => {
    const text = el.dailyNoteInput.value.trim();
    if (!text) return;
    try {
      await send('ADD_NOTE', { dateKey: currentDateKey, text });
      el.dailyNoteInput.value = '';
      await loadDailyLog(currentDateKey);
      toast('Note saved');
    } catch (err) {
      toast(err.message, true);
    }
  });

  el.downloadDayPdf.addEventListener('click', () => {
    withPending(el.downloadDayPdf, 'Building…', async () => {
      try {
        const filename = await TaskerUI.downloadReportPdf('daily', { dateKey: currentDateKey });
        toast(`Saved ${filename}`);
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  el.syncDayToDrive.addEventListener('click', () => {
    withPending(el.syncDayToDrive, 'Syncing…', async () => {
      try {
        await send('SYNC_DRIVE_TODAY', { dateKey: currentDateKey });
        toast(`${currentDateKey} is in your Drive folder`);
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  /* --------------------------------------------------------------- drive - */

  const FORMAT_LABELS = {
    pdf: 'Branded PDF',
    markdown: 'Markdown',
    both: 'Branded PDF and Markdown'
  };

  async function loadDriveSummary() {
    try {
      const settings = await TaskerStorage.getSettings();
      el.driveSummaryFolder.textContent = settings.googleDriveFolderName || 'Tasker Activity Logs';
      el.driveSummaryFormat.textContent = FORMAT_LABELS[settings.driveFormat] || FORMAT_LABELS.pdf;
      el.driveSummaryFiling.textContent = settings.driveOrganizeFolders === false
        ? 'All reports at the top level'
        : 'Daily Logs / Monthly Recaps subfolders';
      el.driveSummaryAuto.textContent = settings.autoSyncDrive ? 'On, every 6 hours' : 'Off';
      el.sidebarDriveFolder.textContent = settings.googleDriveFolderName || 'Tasker Activity Logs';
    } catch (err) {
      console.warn('Tasker dashboard: could not read settings', err);
    }
  }

  el.testDriveConn.addEventListener('click', () => {
    withPending(el.testDriveConn, 'Checking…', async () => {
      try {
        const result = await send('TEST_DRIVE_CONNECTION');
        const where = result.subfolders && result.subfolders.length
          ? ` Reports will be filed under ${result.subfolders.join(' and ')}.`
          : '';
        el.driveResult.textContent = `Connected. Folder "${result.folderName}" is ready.${where}`;
        el.driveResult.classList.remove('hidden', 'is-error');
      } catch (err) {
        el.driveResult.textContent = err.message;
        el.driveResult.classList.remove('hidden');
        el.driveResult.classList.add('is-error');
      }
    });
  });

  el.openDriveSettings.addEventListener('click', openOptions);

  /* ------------------------------------------------------------- topbar - */

  el.optionsPage.addEventListener('click', openOptions);

  el.quickSync.addEventListener('click', () => {
    withPending(el.quickSync, 'Syncing…', async () => {
      try {
        await send('SYNC_DRIVE_TODAY');
        el.overviewDriveStatus.textContent = 'Synced today';
        toast("Today's report is in your Drive folder");
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  el.downloadTodayPdf.addEventListener('click', () => {
    withPending(el.downloadTodayPdf, 'Building…', async () => {
      try {
        const filename = await TaskerUI.downloadReportPdf('daily', { dateKey: Formatters.getDateKey() });
        toast(`Saved ${filename}`);
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  /* --------------------------------------------------------------- start - */

  populateMonthSelect();
  loadOverview();
  loadDriveSummary();
});
