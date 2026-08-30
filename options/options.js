/**
 * Tasker - settings controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  const el = {
    save: $('saveSettingsBtn'),
    saveBottom: $('saveSettingsBtnBottom'),
    resetDefaults: $('resetDefaultsBtn'),
    toast: $('saveToast'),

    workProfileEnabled: $('workProfileEnabled'),
    workProfileBody: $('workProfileBody'),
    roleOverride: $('roleOverride'),
    clearOverride: $('clearOverrideBtn'),
    overrideField: $('overrideField'),

    driveFormat: $('driveFormat'),
    driveFolderName: $('driveFolderName'),
    driveOrganizeFolders: $('driveOrganizeFolders'),
    autoSyncDrive: $('autoSyncDrive'),
    testDrive: $('testDriveBtn'),
    driveResult: $('driveResult'),

    aiSummariesEnabled: $('aiSummariesEnabled'),

    weightList: $('weightList'),
    resetWeights: $('resetWeightsBtn'),
    domainRuleList: $('domainRuleList'),
    unrecognisedList: $('unrecognisedList'),
    addDomainRule: $('addDomainRuleBtn'),

    blacklist: $('blacklistedDomains'),
    presetBanking: $('presetBankingBtn'),
    presetAuth: $('presetAuthBtn'),
    presetPrivacy: $('presetPrivacyBtn'),

    openShortcuts: $('openShortcutsBtn'),
    exportData: $('exportDataBtn'),
    clearData: $('clearDataBtn'),
    sideNav: $('sideNav')
  };

  /* ------------------------------------------------------------ helpers - */

  function toast(message, isError) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    el.toast.style.background = isError ? 'var(--danger)' : '';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.toast.classList.add('hidden'), 3200);
  }

  async function send(action, payload) {
    const res = await chrome.runtime.sendMessage({ action, ...(payload || {}) });
    if (!res || !res.success) throw new Error((res && res.error) || 'The extension did not respond');
    return res.data;
  }

  /**
   * Read/write for a segmented control. The chosen value lives on the DOM
   * rather than in a parallel variable, so the control and the value it
   * represents cannot fall out of step.
   */
  function segValue(group) {
    const active = group.querySelector('.seg.is-active');
    return active ? active.getAttribute('data-value') : null;
  }

  function setSeg(group, value) {
    group.querySelectorAll('.seg').forEach((seg) => {
      seg.classList.toggle('is-active', seg.getAttribute('data-value') === value);
    });
  }

  el.driveFormat.addEventListener('click', (event) => {
    const seg = event.target.closest('.seg');
    if (!seg) return;
    setSeg(el.driveFormat, seg.getAttribute('data-value'));
  });

  /* ------------------------------------------------------------- loading - */

  const settings = await TaskerStorage.getSettings();

  el.driveFolderName.value = settings.googleDriveFolderName || 'Tasker Activity Logs';
  el.autoSyncDrive.checked = settings.autoSyncDrive === true;
  el.driveOrganizeFolders.checked = settings.driveOrganizeFolders !== false;
  el.aiSummariesEnabled.checked = settings.aiSummariesEnabled !== false;
  el.blacklist.value = (settings.blacklistedDomains || []).join(', ');
  el.workProfileEnabled.checked = (settings.workProfile || {}).enabled !== false;
  setSeg(el.driveFormat, settings.driveFormat || 'pdf');

  // Working copies. Nothing reaches storage until Save, so a half-typed site
  // rule never starts recategorising history mid-keystroke.
  let weights = { ...Formatters.DEFAULT_CATEGORY_WEIGHTS, ...(settings.categoryWeights || {}) };
  let domainRules = Object.keys(settings.domainCategories || {})
    .map(domain => ({ domain, category: settings.domainCategories[domain] }));

  /* -------------------------------------------------------- work profile - */

  /**
   * Populate the override picker from the detector's own catalogue, so the
   * list of roles a user can pick can never drift from the list the detector
   * knows how to report.
   */
  async function loadRoleCatalogue(selected) {
    try {
      const roles = await send('GET_ROLE_CATALOGUE');
      const byFamily = {};
      roles.forEach((role) => {
        (byFamily[role.family] = byFamily[role.family] || []).push(role);
      });

      el.roleOverride.textContent = '';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'Let Tasker work it out from my browsing';
      el.roleOverride.appendChild(none);

      Object.keys(byFamily).sort().forEach((family) => {
        const group = document.createElement('optgroup');
        group.label = family;
        byFamily[family].forEach((role) => {
          const option = document.createElement('option');
          option.value = role.id;
          option.textContent = role.label;
          if (role.id === selected) option.selected = true;
          group.appendChild(option);
        });
        el.roleOverride.appendChild(group);
      });
    } catch (err) {
      el.overrideField.classList.add('hidden');
    }
  }

  async function refreshWorkProfile() {
    if (!el.workProfileEnabled.checked) {
      el.workProfileBody.innerHTML =
        '<div class="wp-empty"><div><strong>Switched off</strong>' +
        '<p>Nothing is being inferred, and nothing is stored about your role.</p></div></div>';
      return;
    }
    try {
      const profile = await send('GET_WORK_PROFILE');
      TaskerUI.renderWorkProfile(el.workProfileBody, profile, {});
      if (typeof TaskerIcons !== 'undefined') TaskerIcons.hydrate(el.workProfileBody);
    } catch (err) {
      el.workProfileBody.innerHTML =
        `<p class="wp-note">${Formatters.escapeHtml(err.message)}</p>`;
    }
  }

  el.workProfileEnabled.addEventListener('change', async () => {
    // This one saves on the spot rather than waiting for the Save button:
    // it is a consent decision, and a consent toggle that needs a second
    // click to take effect is a consent toggle people get wrong.
    const current = await TaskerStorage.getSettings();
    await send('SAVE_SETTINGS', {
      settings: {
        workProfile: { ...current.workProfile, enabled: el.workProfileEnabled.checked }
      }
    });
    el.overrideField.classList.toggle('hidden', !el.workProfileEnabled.checked);
    await refreshWorkProfile();
    toast(el.workProfileEnabled.checked ? 'Work profile is on' : 'Work profile is off');
  });

  el.roleOverride.addEventListener('change', async () => {
    const roleId = el.roleOverride.value || null;
    try {
      await send('SET_WORK_PROFILE_OVERRIDE', { roleId });
      await refreshWorkProfile();
      toast(roleId ? 'Work profile set' : 'Back to inferring from your browsing');
    } catch (err) {
      toast(err.message, true);
    }
  });

  el.clearOverride.addEventListener('click', async () => {
    el.roleOverride.value = '';
    el.roleOverride.dispatchEvent(new Event('change'));
  });

  el.overrideField.classList.toggle('hidden', !el.workProfileEnabled.checked);
  await loadRoleCatalogue((settings.workProfile || {}).override);
  refreshWorkProfile();

  /* --------------------------------------------------------------- drive - */

  el.testDrive.addEventListener('click', async () => {
    const original = el.testDrive.innerHTML;
    el.testDrive.disabled = true;
    el.testDrive.innerHTML = '<span data-icon="sync" data-size="sm" class="spin"></span> Checking…';
    if (typeof TaskerIcons !== 'undefined') TaskerIcons.hydrate(el.testDrive);

    try {
      const result = await send('TEST_DRIVE_CONNECTION');
      const where = result.subfolders && result.subfolders.length
        ? ` Reports will be filed under ${result.subfolders.join(' and ')}.`
        : '';
      el.driveResult.textContent =
        `Connected. Folder "${result.folderName}" is ready in your Drive.${where}`;
      el.driveResult.classList.remove('hidden', 'is-error');
    } catch (err) {
      el.driveResult.textContent = err.message;
      el.driveResult.classList.remove('hidden');
      el.driveResult.classList.add('is-error');
    } finally {
      el.testDrive.innerHTML = original;
      el.testDrive.disabled = false;
      if (typeof TaskerIcons !== 'undefined') TaskerIcons.hydrate(el.testDrive);
    }
  });

  /* ------------------------------------------------------------- scoring - */

  function renderWeights() {
    el.weightList.textContent = '';

    Formatters.CATEGORY_KEYS.forEach((key) => {
      const meta = Formatters.getCategoryMeta(key);
      const value = weights[key];
      const isCustom = value !== Formatters.DEFAULT_CATEGORY_WEIGHTS[key];

      const row = document.createElement('div');
      row.className = 'weight-row' + (isCustom ? ' is-custom' : '');

      const name = document.createElement('div');
      name.className = 'weight-name';
      const dot = document.createElement('span');
      dot.className = 'weight-dot';
      dot.style.backgroundColor = meta.color;
      name.appendChild(dot);
      name.appendChild(document.createTextNode(meta.label));

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.step = '5';
      slider.value = String(Math.round(value * 100));
      slider.setAttribute('aria-label', `${meta.label} weight`);

      const readout = document.createElement('span');
      readout.className = 'weight-value';
      readout.textContent = `${Math.round(value * 100)}%`;

      slider.addEventListener('input', () => {
        const pct = Number(slider.value);
        weights[key] = pct / 100;
        readout.textContent = `${pct}%`;
        row.classList.toggle('is-custom', weights[key] !== Formatters.DEFAULT_CATEGORY_WEIGHTS[key]);
      });

      row.appendChild(name);
      row.appendChild(slider);
      row.appendChild(readout);
      el.weightList.appendChild(row);
    });
  }

  function renderDomainRules() {
    el.domainRuleList.textContent = '';

    if (domainRules.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'rule-empty';
      empty.textContent = 'No site rules yet - every site uses the built-in categories.';
      el.domainRuleList.appendChild(empty);
      return;
    }

    domainRules.forEach((rule, index) => {
      const row = document.createElement('div');
      row.className = 'rule-row';

      const domainInput = document.createElement('input');
      domainInput.type = 'text';
      domainInput.className = 'input';
      domainInput.placeholder = 'linkedin.com';
      domainInput.value = rule.domain;
      domainInput.addEventListener('input', () => { rule.domain = domainInput.value; });

      const select = document.createElement('select');
      select.className = 'select';
      Formatters.CATEGORY_KEYS.forEach((key) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = Formatters.getCategoryMeta(key).label;
        if (key === rule.category) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener('change', () => { rule.category = select.value; });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'rule-remove';
      remove.textContent = '×';
      remove.title = 'Remove this rule';
      remove.setAttribute('aria-label', 'Remove this rule');
      remove.addEventListener('click', () => {
        domainRules.splice(index, 1);
        renderDomainRules();
      });

      row.appendChild(domainInput);
      row.appendChild(select);
      row.appendChild(remove);
      el.domainRuleList.appendChild(row);
    });
  }

  el.addDomainRule.addEventListener('click', () => {
    domainRules.push({ domain: '', category: 'Productivity' });
    renderDomainRules();
    const inputs = el.domainRuleList.querySelectorAll('.input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  el.resetWeights.addEventListener('click', () => {
    weights = { ...Formatters.DEFAULT_CATEGORY_WEIGHTS };
    renderWeights();
    toast('Weights reset - press Save to apply');
  });

  /**
   * Store only what the user actually changed. A category left at its default
   * stays absent, so it keeps following that default if a later version
   * revises it.
   */
  function collectWeightOverrides() {
    const overrides = {};
    Formatters.CATEGORY_KEYS.forEach((key) => {
      if (weights[key] !== Formatters.DEFAULT_CATEGORY_WEIGHTS[key]) overrides[key] = weights[key];
    });
    return overrides;
  }

  function collectDomainRules() {
    const map = {};
    domainRules.forEach((rule) => {
      const domain = String(rule.domain || '')
        .trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];
      if (domain) map[domain] = rule.category;
    });
    return map;
  }

  /**
   * The user's own long tail: sites that reached "Other" in the last three
   * weeks, biggest first, each with a one-click category picker.
   *
   * Saving happens immediately rather than on the Save button. The row
   * disappears the moment it is placed, so leaving it pending would show a
   * list that disagrees with itself.
   */
  async function renderUnrecognised() {
    let sites;
    try {
      sites = await send('GET_UNRECOGNISED_SITES');
    } catch (err) {
      el.unrecognisedList.textContent = '';
      return;
    }

    el.unrecognisedList.textContent = '';

    if (!sites.length) {
      const done = document.createElement('p');
      done.className = 'unknown-empty';
      done.textContent = 'Nothing unrecognised - every site you visited in the last three weeks was categorised.';
      el.unrecognisedList.appendChild(done);
      return;
    }

    sites.forEach((site) => {
      const row = document.createElement('div');
      row.className = 'unknown-row';

      const name = document.createElement('span');
      name.className = 'unknown-domain';
      name.textContent = site.domain;
      name.title = site.domain;

      const time = document.createElement('span');
      time.className = 'unknown-time';
      time.textContent = Formatters.formatDuration(site.seconds);

      const select = document.createElement('select');
      select.className = 'select';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Place this site…';
      select.appendChild(blank);
      Formatters.CATEGORY_KEYS.forEach((key) => {
        if (key === 'Other') return;
        const option = document.createElement('option');
        option.value = key;
        option.textContent = Formatters.getCategoryMeta(key).label;
        select.appendChild(option);
      });

      select.addEventListener('change', async () => {
        if (!select.value) return;
        // Written straight through as a site rule, which is the same mechanism
        // the rules list below uses - so a choice made here shows up there and
        // can be changed or removed in one place.
        const current = await TaskerStorage.getSettings();
        const rules = { ...(current.domainCategories || {}), [site.domain]: select.value };
        await send('SAVE_SETTINGS', { settings: { domainCategories: rules } });

        domainRules = Object.keys(rules).map(d => ({ domain: d, category: rules[d] }));
        renderDomainRules();
        row.remove();
        toast(`${site.domain} is now ${Formatters.getCategoryMeta(select.value).label}`);
      });

      row.appendChild(name);
      row.appendChild(time);
      row.appendChild(select);
      el.unrecognisedList.appendChild(row);
    });
  }

  renderWeights();
  renderDomainRules();
  renderUnrecognised();

  /* -------------------------------------------------------------- privacy - */

  function addPresetDomains(list) {
    const current = el.blacklist.value.split(',').map(s => s.trim()).filter(Boolean);
    el.blacklist.value = Array.from(new Set([...current, ...list])).join(', ');
    toast('Added - press Save to apply');
  }

  el.presetBanking.addEventListener('click', () => addPresetDomains(TaskerStorage.DOMAIN_PRESETS.banking.domains));
  el.presetAuth.addEventListener('click', () => addPresetDomains(TaskerStorage.DOMAIN_PRESETS.auth.domains));
  el.presetPrivacy.addEventListener('click', () => addPresetDomains(TaskerStorage.DOMAIN_PRESETS.privacy.domains));

  // Extensions may open chrome:// pages through the tabs API even though a
  // link to one is blocked, so this is the only route to the binding UI.
  el.openShortcuts.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  /* ----------------------------------------------------------------- save - */

  async function saveAll() {
    const current = await TaskerStorage.getSettings();
    await send('SAVE_SETTINGS', {
      settings: {
        googleDriveFolderName: el.driveFolderName.value.trim() || 'Tasker Activity Logs',
        driveFormat: segValue(el.driveFormat) || 'pdf',
        driveOrganizeFolders: el.driveOrganizeFolders.checked,
        autoSyncDrive: el.autoSyncDrive.checked,
        aiSummariesEnabled: el.aiSummariesEnabled.checked,
        blacklistedDomains: el.blacklist.value.split(',').map(s => s.trim()).filter(Boolean),
        categoryWeights: collectWeightOverrides(),
        domainCategories: collectDomainRules(),
        // Carried through rather than rebuilt: the override is saved the
        // moment it is picked, and rebuilding it from the <select> here would
        // silently clobber it whenever the picker had not finished loading.
        workProfile: { ...current.workProfile, enabled: el.workProfileEnabled.checked }
      }
    });
    toast('Settings saved');
  }

  el.save.addEventListener('click', () => saveAll().catch(err => toast(err.message, true)));
  el.saveBottom.addEventListener('click', () => saveAll().catch(err => toast(err.message, true)));

  el.resetDefaults.addEventListener('click', async () => {
    if (!confirm('Reset every setting to its default? Your tracked history is not affected.')) return;

    el.driveFolderName.value = 'Tasker Activity Logs';
    el.autoSyncDrive.checked = false;
    el.driveOrganizeFolders.checked = true;
    el.aiSummariesEnabled.checked = true;
    el.workProfileEnabled.checked = true;
    el.blacklist.value = 'bank, paypal, passwords, accounts.google.com';
    setSeg(el.driveFormat, 'pdf');
    weights = { ...Formatters.DEFAULT_CATEGORY_WEIGHTS };
    domainRules = [];
    renderWeights();
    renderDomainRules();

    try {
      await send('SAVE_SETTINGS', {
        settings: {
          googleDriveFolderName: 'Tasker Activity Logs',
          driveFormat: 'pdf',
          driveOrganizeFolders: true,
          autoSyncDrive: false,
          aiSummariesEnabled: true,
          blacklistedDomains: ['bank', 'paypal', 'passwords', 'accounts.google.com'],
          categoryWeights: {},
          domainCategories: {},
          workProfile: { enabled: true, override: null }
        }
      });
      el.roleOverride.value = '';
      await refreshWorkProfile();
      toast('Settings reset to defaults');
    } catch (err) {
      toast(err.message, true);
    }
  });

  /* ----------------------------------------------------------------- data - */

  el.exportData.addEventListener('click', () => {
    chrome.storage.local.get(null, (all) => {
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Tasker_Backup_${Formatters.getDateKey()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast('Backup downloaded');
    });
  });

  el.clearData.addEventListener('click', () => {
    if (!confirm('Delete all local tracking history? This cannot be undone, and nothing already in your Drive is touched.')) return;
    chrome.storage.local.clear(() => {
      alert('Local history deleted.');
      location.reload();
    });
  });

  /* ------------------------------------------------------- section index - */

  // Highlight the section currently on screen. A settings page long enough to
  // need an index is long enough to need to know where you are in it.
  const sections = Array.from(document.querySelectorAll('.card[id]'));
  const links = Array.from(el.sideNav.querySelectorAll('.side-link'));

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    sections.forEach(section => observer.observe(section));
  }
});
