/**
 * Tasker - Main Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');

  // Topbar Actions
  const quickSyncBtn = document.getElementById('quickSyncBtn');
  const optionsPageBtn = document.getElementById('optionsPageBtn');

  // Overview Tab Elements
  const overviewTodayTime = document.getElementById('overviewTodayTime');
  const overviewProductivity = document.getElementById('overviewProductivity');
  const overviewHighlightsCount = document.getElementById('overviewHighlightsCount');
  const overviewDriveStatus = document.getElementById('overviewDriveStatus');
  const coverageBanner = document.getElementById('coverageBanner');
  const coverageHeadline = document.getElementById('coverageHeadline');
  const coverageDetail = document.getElementById('coverageDetail');
  const workRollupRow = document.getElementById('workRollupRow');
  const workRollupList = document.getElementById('workRollupList');
  const categoryChartContainer = document.getElementById('categoryChartContainer');
  const topDomainsGroup = document.getElementById('topDomainsGroup');
  const todayActivityGroup = document.getElementById('todayActivityGroup');

  // Monthly Recap Tab Elements
  const monthSelect = document.getElementById('monthSelect');
  const syncMonthToDriveBtn = document.getElementById('syncMonthToDriveBtn');
  const copyMonthMarkdownBtn = document.getElementById('copyMonthMarkdownBtn');
  const downloadMonthMarkdownBtn = document.getElementById('downloadMonthMarkdownBtn');
  const recapMonthTitle = document.getElementById('recapMonthTitle');
  const recapExecutiveSummary = document.getElementById('recapExecutiveSummary');
  const recapTotalTime = document.getElementById('recapTotalTime');
  const recapDaysCount = document.getElementById('recapDaysCount');
  const recapScore = document.getElementById('recapScore');
  const monthlyMilestonesList = document.getElementById('monthlyMilestonesList');
  const monthlyActivityGroup = document.getElementById('monthlyActivityGroup');
  const monthlyCategoryBars = document.getElementById('monthlyCategoryBars');
  const monthlyMarkdownPreview = document.getElementById('monthlyMarkdownPreview');

  // Daily Activity Logs Tab Elements
  const dailyDatePicker = document.getElementById('dailyDatePicker');
  const syncDayToDriveBtn = document.getElementById('syncDayToDriveBtn');
  const dailyFocusDetails = document.getElementById('dailyFocusDetails');
  const dailyNoteInput = document.getElementById('dailyNoteInput');
  const addDailyNoteBtn = document.getElementById('addDailyNoteBtn');
  const dailyNotesList = document.getElementById('dailyNotesList');

  // Drive Sync Tab Elements
  const driveFolderNameInput = document.getElementById('driveFolderNameInput');
  const autoSyncFreqSelect = document.getElementById('autoSyncFreqSelect');
  const saveDriveSettingsBtn = document.getElementById('saveDriveSettingsBtn');
  const testDriveConnBtn = document.getElementById('testDriveConnBtn');
  const sidebarDriveFolder = document.getElementById('sidebarDriveFolder');

  let currentMonthKey = Formatters.getMonthKey();
  let currentSelectedDateKey = Formatters.getDateKey();

  // Dashboard toast helper
  const dashboardToast = (() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#2A0F14; color:#fff; padding:8px 18px; border-radius:9999px; font-size:12px; font-weight:700; box-shadow:0 4px 12px rgba(0,0,0,0.2); z-index:9999; display:none; transition:opacity 0.3s;';
    document.body.appendChild(el);
    return {
      show(msg) {
        el.textContent = msg;
        el.style.display = 'block';
        clearTimeout(el._timer);
        el._timer = setTimeout(() => { el.style.display = 'none'; }, 2400);
      }
    };
  })();

  // 1. Initialize Nav Menu Click Handlers
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  function switchTab(tabId) {
    navItems.forEach(n => n.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    const activeTab = document.getElementById(`tab-${tabId}`);

    if (activeNav) activeNav.classList.add('active');
    if (activeTab) activeTab.classList.add('active');

    // Update Header Text
    const tabTitles = {
      'overview': { title: 'Overview Dashboard', sub: 'Monitor active focus time, daily trends, and top categories.' },
      'monthly-recap': { title: 'Monthly Accomplishment Recap', sub: 'Comprehensive monthly summary of achievements, focus metrics, and highlights.' },
      'daily-logs': { title: 'Daily Activity Logs & Journal', sub: 'Inspect detailed web logs and custom journal notes for any date.' },
      'drive-sync': { title: 'Google Drive Integration Settings', sub: 'Configure automatic background backup to your Google Drive.' }
    };

    if (tabTitles[tabId]) {
      pageTitle.textContent = tabTitles[tabId].title;
      pageSubtitle.textContent = tabTitles[tabId].sub;
    }

    // Refresh specific tab contents
    if (tabId === 'overview') loadOverviewData();
    if (tabId === 'monthly-recap') loadMonthlyRecapData(currentMonthKey);
    if (tabId === 'daily-logs') loadDailyLogData(currentSelectedDateKey);
  }

  // 2. Setup Topbar Actions
  quickSyncBtn.addEventListener('click', async () => {
    const originalHTML = quickSyncBtn.innerHTML;
    quickSyncBtn.disabled = true;
    quickSyncBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Syncing...</span>`;
    try {
      const res = await chrome.runtime.sendMessage({ action: 'SYNC_DRIVE_TODAY' });
      if (res && res.success) {
        dashboardToast.show('Today\'s log synced to Google Drive!');
      } else {
        alert('Google Drive Sync Notice:\n' + (res.error || 'Please ensure you are signed in to Google Chrome.'));
      }
    } catch (e) {
      alert('Google Drive Sync Notice:\nPlease ensure you are signed into your Chrome browser profile with a Google Account.');
    } finally {
      quickSyncBtn.disabled = false;
      quickSyncBtn.innerHTML = originalHTML;
    }
  });

  optionsPageBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  /**
   * Show what today's total does not include.
   *
   * Stays hidden until there is a long enough span to reconcile - on a short
   * morning the gap is noise, and a banner that always fires is one nobody reads.
   */
  function renderCoverage(dayData) {
    const coverage = Formatters.computeCoverage(dayData || {});
    if (!coverage) {
      coverageBanner.classList.add('hidden');
      return;
    }

    coverageHeadline.textContent =
      `Browser time only — ${coverage.coveragePercent}% of your day is visible here`;
    coverageDetail.textContent = Formatters.formatCoverageNote(coverage);
    coverageBanner.classList.remove('hidden');
  }

  /**
   * Time grouped by the repo or ticket it went into.
   *
   * The whole card is hidden when nothing resolves to a repo or ticket - for a
   * marketer or a student it never applies, and an empty "Repos & Tickets" panel
   * would just be a permanent reminder that the tool was built for someone else.
   */
  function renderWorkRollup(dayData) {
    const groups = Formatters.rollupWork(dayData || {}, 8);
    workRollupList.textContent = '';

    if (groups.length === 0) {
      workRollupRow.classList.add('hidden');
      return;
    }

    groups.forEach((group) => {
      const row = document.createElement('div');
      row.className = 'rollup-row';

      const main = document.createElement('div');
      main.className = 'rollup-main';

      const key = document.createElement('div');
      key.className = 'rollup-key';
      const kind = document.createElement('span');
      kind.className = `rollup-kind ${group.type}`;
      kind.textContent = group.type;
      key.appendChild(kind);
      key.appendChild(document.createTextNode(group.key));

      main.appendChild(key);

      const detail = Formatters.formatRollupItems(group);
      if (detail) {
        const items = document.createElement('div');
        items.className = 'rollup-items';
        items.textContent = detail;
        main.appendChild(items);
      }

      const time = document.createElement('div');
      time.className = 'rollup-time';
      time.textContent = Formatters.formatDuration(group.seconds);

      row.appendChild(main);
      row.appendChild(time);
      workRollupList.appendChild(row);
    });

    workRollupRow.classList.remove('hidden');
  }

  // 3. Load Overview Tab Data
  async function loadOverviewData() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
      if (res && res.success && res.data) {
        const d = res.data;
        overviewTodayTime.textContent = d.formattedTime;
        overviewProductivity.textContent = Formatters.formatScore(d.dayData.productivityScore, ' / 100');
        overviewHighlightsCount.textContent = `${d.highlightsCount} items`;
        overviewDriveStatus.textContent = d.lastSync ? 'Synced Today' : 'Ready';

        renderCoverage(d.dayData);
        renderWorkRollup(d.dayData);
        renderOverviewCategories(d.dayData.categories || {}, d.totalSeconds || 0);
        renderOverviewTopDomains(d.dayData.domains || {});
        renderActivityList(
          todayActivityGroup,
          Formatters.rankActivities(d.dayData, 12),
          'No activity recorded yet today.'
        );

        // Settings sync to sidebar
        if (d.settings && d.settings.googleDriveFolderName) {
          sidebarDriveFolder.textContent = d.settings.googleDriveFolderName;
          driveFolderNameInput.value = d.settings.googleDriveFolderName;
        }
      }
    } catch (err) {
      console.warn('Unable to load overview status:', err);
    }
  }

  function renderOverviewCategories(categoriesObj, totalSecs) {
    categoryChartContainer.innerHTML = '';
    const keys = Object.keys(categoriesObj).sort((a,b) => categoriesObj[b] - categoriesObj[a]);

    if (keys.length === 0) {
      categoryChartContainer.innerHTML = `<p style="color:#9C9496; text-align:center; padding: 20px;">No activity logged for today yet.</p>`;
      return;
    }

    keys.forEach(catKey => {
      const seconds = categoriesObj[catKey];
      const meta = Formatters.getCategoryMeta(catKey);
      const percentage = totalSecs > 0 ? Math.round((seconds / totalSecs) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'chart-row';
      row.innerHTML = `
        <div class="chart-row-meta">
          <span style="color: ${meta.color}">${Formatters.escapeHtml(catKey)}</span>
          <span>${Formatters.formatDuration(seconds)} (${percentage}%)</span>
        </div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill" style="width: ${percentage}%; background-color: ${meta.color};"></div>
        </div>
      `;
      categoryChartContainer.appendChild(row);
    });
  }

  function renderOverviewTopDomains(domainsObj) {
    topDomainsGroup.innerHTML = '';
    const sorted = Object.keys(domainsObj).sort((a,b) => domainsObj[b] - domainsObj[a]).slice(0, 5);

    if (sorted.length === 0) {
      topDomainsGroup.innerHTML = `<p style="color:#9C9496; text-align:center; padding:20px;">No domain activity yet.</p>`;
      return;
    }

    sorted.forEach(domain => {
      const seconds = domainsObj[domain];
      const div = document.createElement('div');
      div.className = 'domain-item';
      div.innerHTML = `
        <span class="domain-name">${Formatters.escapeHtml(domain)}</span>
        <span class="domain-time">${Formatters.formatDuration(seconds)}</span>
      `;
      topDomainsGroup.appendChild(div);
    });
  }

  /**
   * Render the "what you worked on" list.
   * Shared by the Overview tab and the Monthly Recap tab - both show the same
   * shape of row, only the source data differs.
   */
  function renderActivityList(container, activities, emptyMessage) {
    container.innerHTML = '';

    if (!activities || activities.length === 0) {
      container.innerHTML = `<p style="color:#9C9496; text-align:center; padding:20px;">${Formatters.escapeHtml(emptyMessage)}</p>`;
      return;
    }

    activities.forEach(item => {
      const meta = Formatters.getCategoryMeta(item.category);
      const visits = item.visits > 1 ? `${item.visits} visits` : '1 visit';
      const div = document.createElement('div');
      div.className = 'activity-item';
      // Every interpolated value here is page-controlled (titles, URLs), so all
      // of it goes through escapeHtml.
      div.innerHTML = `
        <span class="activity-action" style="background:${meta.bgColor}; color:${meta.color};">${Formatters.escapeHtml(item.action)}</span>
        <div class="activity-main">
          <span class="activity-label">${Formatters.escapeHtml(item.label)}</span>
          <span class="activity-meta">${Formatters.escapeHtml(item.domain || '')} · ${visits}</span>
        </div>
        <span class="activity-time">${Formatters.formatDuration(item.seconds)}</span>
      `;
      container.appendChild(div);
    });
  }

  // 4. Monthly Recap Tab Setup & Populate Months
  populateMonthSelect();

  function populateMonthSelect() {
    monthSelect.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = Formatters.getMonthKey(d);
      const mLabel = Formatters.formatMonthDisplay(mKey);
      const opt = document.createElement('option');
      opt.value = mKey;
      opt.textContent = mLabel;
      if (i === 0) opt.selected = true;
      monthSelect.appendChild(opt);
    }
  }

  monthSelect.addEventListener('change', (e) => {
    currentMonthKey = e.target.value;
    loadMonthlyRecapData(currentMonthKey);
  });

  async function loadMonthlyRecapData(monthKey) {
    recapMonthTitle.textContent = `${Formatters.formatMonthDisplay(monthKey)} Recap`;
    monthlyMarkdownPreview.textContent = 'Generating monthly summary report...';

    try {
      const res = await chrome.runtime.sendMessage({ action: 'GET_MONTHLY_RECAP', monthKey });
      if (res && res.success && res.data) {
        const recap = res.data;
        const stats = recap.monthStats;

        recapTotalTime.textContent = Formatters.formatDuration(stats.totalSeconds || 0);
        recapDaysCount.textContent = `${stats.daysTrackedCount || 0} days`;
        recapScore.textContent = Formatters.formatScore(stats.monthlyScore, '%');

        // Executive summary text. The score clause is dropped entirely when
        // there is not enough data, rather than padded with a placeholder.
        const scoreClause = stats.monthlyScore === null || stats.monthlyScore === undefined
          ? ''
          : `, maintaining an overall focus score of ${stats.monthlyScore}%`;
        recapExecutiveSummary.textContent = stats.aiSummaryParagraph ||
          `During ${Formatters.formatMonthDisplay(monthKey)}, you tracked ${stats.daysTrackedCount || 0} active days with a total focus duration of ${Formatters.formatDuration(stats.totalSeconds || 0)}. Your top domain category was ${stats.topCategory || 'Development'}${scoreClause}.`;

        // Render Milestones
        renderMonthlyMilestones(stats.milestones || []);

        renderActivityList(
          monthlyActivityGroup,
          stats.topActivities || [],
          'No detailed activity recorded for this month.'
        );

        // Render Monthly Category Bars
        renderMonthlyCategoryBars(stats.categories || {}, stats.totalSeconds || 0);

        // Render Markdown Preview
        monthlyMarkdownPreview.textContent = recap.markdown || '';
      }
    } catch (err) {
      console.error('Failed to generate monthly recap:', err);
    }
  }

  function renderMonthlyMilestones(milestonesArr) {
    monthlyMilestonesList.innerHTML = '';
    if (milestonesArr.length === 0) {
      monthlyMilestonesList.innerHTML = `<li style="color:#9C9496; text-align:center; padding: 15px;">No major milestones logged yet for this month.</li>`;
      return;
    }

    milestonesArr.forEach((m, idx) => {
      const li = document.createElement('li');
      li.className = 'milestone-item';
      li.innerHTML = `
        <div class="milestone-badge">${idx + 1}</div>
        <div class="milestone-body">
          <strong>${Formatters.escapeHtml(m.title)} ${m.date ? `<span style="font-size:11px; font-weight:normal; color:#766E70;">(${Formatters.escapeHtml(m.date)})</span>` : ''}</strong>
          <p>${Formatters.escapeHtml(m.description || m.detail || 'Accomplished key task.')}</p>
        </div>
      `;
      monthlyMilestonesList.appendChild(li);
    });
  }

  function renderMonthlyCategoryBars(categoriesObj, totalSecs) {
    monthlyCategoryBars.innerHTML = '';
    const keys = Object.keys(categoriesObj).sort((a,b) => categoriesObj[b] - categoriesObj[a]);

    if (keys.length === 0) {
      monthlyCategoryBars.innerHTML = `<p style="color:#9C9496; padding: 10px;">No category stats recorded.</p>`;
      return;
    }

    keys.forEach(catKey => {
      const seconds = categoriesObj[catKey];
      const meta = Formatters.getCategoryMeta(catKey);
      const percentage = totalSecs > 0 ? Math.round((seconds / totalSecs) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'chart-row';
      row.innerHTML = `
        <div class="chart-row-meta">
          <span style="color: ${meta.color}; font-weight:700;">${Formatters.escapeHtml(catKey)}</span>
          <span>${Formatters.formatDuration(seconds)} (${percentage}%)</span>
        </div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill" style="width: ${percentage}%; background-color: ${meta.color};"></div>
        </div>
      `;
      monthlyCategoryBars.appendChild(row);
    });
  }

  // Monthly Actions: Copy to Clipboard, Sync to Drive & Download
  if (copyMonthMarkdownBtn) {
    copyMonthMarkdownBtn.addEventListener('click', async () => {
      const text = monthlyMarkdownPreview ? monthlyMarkdownPreview.textContent : '';
      if (!text || text.includes('Select a month')) {
        dashboardToast.show('No report to copy yet - select a month first.');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        const originalHTML = copyMonthMarkdownBtn.innerHTML;
        copyMonthMarkdownBtn.innerHTML = 'Copied!';
        setTimeout(() => { copyMonthMarkdownBtn.innerHTML = originalHTML; }, 2200);
        dashboardToast.show('Monthly report copied to clipboard!');
      } catch {
        dashboardToast.show('Copy failed - try the download button instead.');
      }
    });
  }

  syncMonthToDriveBtn.addEventListener('click', async () => {
    const originalHTML = syncMonthToDriveBtn.innerHTML;
    syncMonthToDriveBtn.disabled = true;
    syncMonthToDriveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Syncing...</span>`;
    try {
      const res = await chrome.runtime.sendMessage({ action: 'SYNC_DRIVE_MONTH', monthKey: currentMonthKey });
      if (res && res.success) {
        dashboardToast.show(`${Formatters.formatMonthDisplay(currentMonthKey)} recap synced to Google Drive!`);
      } else {
        alert('Google Drive Sync Notice:\n' + (res.error || 'Please ensure you are signed in to Google Chrome.'));
      }
    } catch (e) {
      alert('Google Drive Sync Notice:\nPlease ensure you are signed into your Chrome browser profile with a Google Account.');
    } finally {
      syncMonthToDriveBtn.disabled = false;
      syncMonthToDriveBtn.innerHTML = originalHTML;
    }
  });

  downloadMonthMarkdownBtn.addEventListener('click', () => {
    const text = monthlyMarkdownPreview ? monthlyMarkdownPreview.textContent : '';
    if (!text || text.includes('Select a month')) {
      dashboardToast.show('No report to download - select a month first.');
      return;
    }
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tasker_Monthly_Recap_${currentMonthKey}.md`;
    a.click();
    URL.revokeObjectURL(url);
    dashboardToast.show('Monthly report downloaded!');
  });

  // 5. Daily Activity Logs Tab Setup
  dailyDatePicker.value = currentSelectedDateKey;

  dailyDatePicker.addEventListener('change', (e) => {
    currentSelectedDateKey = e.target.value;
    loadDailyLogData(currentSelectedDateKey);
  });

  async function loadDailyLogData(dateKey) {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'GET_DAILY_SUMMARY', dateKey });
      if (res && res.success && res.data) {
        const summary = res.data;
        const dayData = summary.dayData;

        // Render Daily Focus Details
        dailyFocusDetails.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
            <div><strong>Total Active Time:</strong> ${summary.formattedTime}</div>
            <div><strong>Productivity Score:</strong> ${Formatters.formatScore(dayData.productivityScore)}</div>
          </div>
          <h4 style="margin-bottom:8px; font-size:12px; color:#766E70;">What You Worked On:</h4>
          <div class="activity-list-group" id="dailyActivityGroup" style="margin-bottom:18px;"></div>
          <h4 style="margin-bottom:8px; font-size:12px; color:#766E70;">Top Domains Logged:</h4>
          <ul style="list-style:none; display:flex; flex-direction:column; gap:6px;">
            ${Object.keys(dayData.domains || {}).map(dom => `
              <li style="display:flex; justify-content:space-between; font-size:12px; background:#F0F2EF; padding:6px 10px; border-radius:6px;">
                <span><code>${Formatters.escapeHtml(dom)}</code></span>
                <span style="font-weight:700;">${Formatters.formatDuration(dayData.domains[dom])}</span>
              </li>
            `).join('') || '<li style="color:#9C9496;">No domains recorded for this date.</li>'}
          </ul>
        `;

        // Populated after the innerHTML assignment above, which is what creates
        // the container this writes into.
        renderActivityList(
          document.getElementById('dailyActivityGroup'),
          Formatters.rankActivities(dayData, 12),
          'No detailed activity recorded for this date.'
        );

        // Render Notes List
        renderDailyNotesList(summary.notes || []);
      }
    } catch (err) {
      console.error('Failed to load daily log data:', err);
    }
  }

  function renderDailyNotesList(notesArr) {
    dailyNotesList.innerHTML = '';
    if (notesArr.length === 0) {
      dailyNotesList.innerHTML = `<li style="color:#9C9496; font-size:12px;">No journal notes for this date yet.</li>`;
      return;
    }

    notesArr.forEach(n => {
      const li = document.createElement('li');
      li.style.cssText = 'background:#F0F2EF; padding:8px 10px; border-radius:8px; margin-bottom:6px; display:flex; justify-content:space-between; font-size:12px;';
      li.innerHTML = `
        <div>
          <span style="font-weight:700; color:#766E70;">[${Formatters.escapeHtml(n.time || 'Note')}]</span>
          <span>${Formatters.escapeHtml(n.text)}</span>
        </div>
        <button class="btn-icon" data-id="${Formatters.escapeHtml(n.id)}" style="padding:2px; height:20px; width:20px;">&times;</button>
      `;

      li.querySelector('button').addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        await chrome.runtime.sendMessage({ action: 'DELETE_NOTE', dateKey: currentSelectedDateKey, id });
        await loadDailyLogData(currentSelectedDateKey);
      });

      dailyNotesList.appendChild(li);
    });
  }

  addDailyNoteBtn.addEventListener('click', async () => {
    const text = dailyNoteInput.value.trim();
    if (!text) return;

    await chrome.runtime.sendMessage({ action: 'ADD_NOTE', dateKey: currentSelectedDateKey, text });
    dailyNoteInput.value = '';
    await loadDailyLogData(currentSelectedDateKey);
  });

  syncDayToDriveBtn.addEventListener('click', async () => {
    syncDayToDriveBtn.disabled = true;
    syncDayToDriveBtn.textContent = 'Syncing...';
    try {
      const res = await chrome.runtime.sendMessage({ action: 'SYNC_DRIVE_TODAY', dateKey: currentSelectedDateKey });
      if (res && res.success) {
        alert(`Daily log for ${currentSelectedDateKey} uploaded to Google Drive!`);
      } else {
        alert('Sync Error: ' + (res.error || 'Failed to sync to Drive.'));
      }
    } catch (e) {
      alert('Sync error occurred.');
    } finally {
      syncDayToDriveBtn.disabled = false;
      syncDayToDriveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        </svg>
        <span>Sync Day to Google Drive</span>
      `;
    }
  });

  // 6. Settings & Drive Tab Logic
  saveDriveSettingsBtn.addEventListener('click', async () => {
    const folderName = driveFolderNameInput.value.trim() || 'Tasker Activity Logs';
    const freq = autoSyncFreqSelect.value;
    
    await chrome.runtime.sendMessage({
      action: 'SAVE_SETTINGS',
      settings: {
        googleDriveFolderName: folderName,
        autoSyncIntervalHours: freq
      }
    });

    sidebarDriveFolder.textContent = folderName;
    alert('Drive Sync settings saved successfully!');
  });

  testDriveConnBtn.addEventListener('click', async () => {
    testDriveConnBtn.disabled = true;
    testDriveConnBtn.textContent = 'Connecting...';
    try {
      const res = await chrome.runtime.sendMessage({ action: 'SYNC_DRIVE_TODAY' });
      if (res && res.success) {
        alert('Successfully connected to Google Drive and validated folder access!');
      } else {
        alert('Google OAuth Notice: ' + (res.error || 'Authentication required in Chrome settings.'));
      }
    } catch (e) {
      alert('Drive Connection error. Please verify OAuth client ID or Chrome Login.');
    } finally {
      testDriveConnBtn.disabled = false;
      testDriveConnBtn.textContent = 'Test Connection & Create Folder';
    }
  });

  // Load Overview Initially
  loadOverviewData();
});
