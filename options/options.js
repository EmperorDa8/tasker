/**
 * Tasker - Options Page Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const driveFolderName = document.getElementById('driveFolderName');
  const autoSyncDrive = document.getElementById('autoSyncDrive');
  const aiSummariesEnabled = document.getElementById('aiSummariesEnabled');
  const blacklistedDomains = document.getElementById('blacklistedDomains');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const saveToast = document.getElementById('saveToast');

  const weightList = document.getElementById('weightList');
  const resetWeightsBtn = document.getElementById('resetWeightsBtn');
  const domainRuleList = document.getElementById('domainRuleList');
  const addDomainRuleBtn = document.getElementById('addDomainRuleBtn');

  const presetBankingBtn = document.getElementById('presetBankingBtn');
  const presetAuthBtn = document.getElementById('presetAuthBtn');
  const presetPrivacyBtn = document.getElementById('presetPrivacyBtn');
  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
  const openShortcutsBtn = document.getElementById('openShortcutsBtn');

  // Load existing settings
  const settings = await TaskerStorage.getSettings();
  driveFolderName.value = settings.googleDriveFolderName || 'Tasker Activity Logs';
  autoSyncDrive.checked = settings.autoSyncDrive === true;
  aiSummariesEnabled.checked = settings.aiSummariesEnabled !== false;
  blacklistedDomains.value = (settings.blacklistedDomains || []).join(', ');

  // --- Focus scoring -------------------------------------------------------

  // Working copy. Nothing here reaches storage until Save is pressed, so a
  // half-typed site rule never starts recategorising the user's history.
  let weights = { ...Formatters.DEFAULT_CATEGORY_WEIGHTS, ...(settings.categoryWeights || {}) };
  let domainRules = Object.keys(settings.domainCategories || {})
    .map(domain => ({ domain, category: settings.domainCategories[domain] }));

  function renderWeights() {
    weightList.textContent = '';

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
      weightList.appendChild(row);
    });
  }

  function renderDomainRules() {
    domainRuleList.textContent = '';

    if (domainRules.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'rule-empty';
      empty.textContent = 'No site rules yet - every site uses the built-in categories.';
      domainRuleList.appendChild(empty);
      return;
    }

    domainRules.forEach((rule, index) => {
      const row = document.createElement('div');
      row.className = 'rule-row';

      const domainInput = document.createElement('input');
      domainInput.type = 'text';
      domainInput.className = 'text-input';
      domainInput.placeholder = 'linkedin.com';
      domainInput.value = rule.domain;
      domainInput.addEventListener('input', () => { rule.domain = domainInput.value; });

      const select = document.createElement('select');
      select.className = 'select-input';
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
      remove.addEventListener('click', () => {
        domainRules.splice(index, 1);
        renderDomainRules();
      });

      row.appendChild(domainInput);
      row.appendChild(select);
      row.appendChild(remove);
      domainRuleList.appendChild(row);
    });
  }

  addDomainRuleBtn.addEventListener('click', () => {
    domainRules.push({ domain: '', category: 'Productivity' });
    renderDomainRules();
    const inputs = domainRuleList.querySelectorAll('.text-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  resetWeightsBtn.addEventListener('click', () => {
    weights = { ...Formatters.DEFAULT_CATEGORY_WEIGHTS };
    renderWeights();
    showSaveToast('Weights reset - press Save to apply.');
  });

  /**
   * Store only what the user actually changed. A category left at its default
   * stays absent, so it keeps tracking that default if a later version revises it.
   */
  function collectWeightOverrides() {
    const overrides = {};
    Formatters.CATEGORY_KEYS.forEach((key) => {
      if (weights[key] !== Formatters.DEFAULT_CATEGORY_WEIGHTS[key]) {
        overrides[key] = weights[key];
      }
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

  renderWeights();
  renderDomainRules();

  function addPresetDomains(newDomainsArr) {
    const currentList = blacklistedDomains.value.split(',').map(s => s.trim()).filter(Boolean);
    const set = new Set([...currentList, ...newDomainsArr]);
    blacklistedDomains.value = Array.from(set).join(', ');
    showSaveToast('Exclusion preset added!');
  }

  presetBankingBtn.addEventListener('click', () => {
    addPresetDomains(TaskerStorage.DOMAIN_PRESETS.banking.domains);
  });

  presetAuthBtn.addEventListener('click', () => {
    addPresetDomains(TaskerStorage.DOMAIN_PRESETS.auth.domains);
  });

  presetPrivacyBtn.addEventListener('click', () => {
    addPresetDomains(TaskerStorage.DOMAIN_PRESETS.privacy.domains);
  });

  // Extensions may open chrome:// pages via the tabs API even though a link to
  // one is blocked, so this is the only way to send the user to the binding UI.
  openShortcutsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  // Save Settings
  saveSettingsBtn.addEventListener('click', async () => {
    const updated = {
      googleDriveFolderName: driveFolderName.value.trim() || 'Tasker Activity Logs',
      autoSyncDrive: autoSyncDrive.checked,
      aiSummariesEnabled: aiSummariesEnabled.checked,
      blacklistedDomains: blacklistedDomains.value.split(',').map(s => s.trim()).filter(Boolean),
      categoryWeights: collectWeightOverrides(),
      domainCategories: collectDomainRules()
    };

    await chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', settings: updated });
    showSaveToast('Settings saved successfully!');
  });

  // Reset Defaults
  resetDefaultsBtn.addEventListener('click', async () => {
    if (confirm('Reset settings to recommended defaults?')) {
      driveFolderName.value = 'Tasker Activity Logs';
      autoSyncDrive.checked = false;
      aiSummariesEnabled.checked = true;
      blacklistedDomains.value = 'bank, paypal, passwords, accounts.google.com';
      weights = { ...Formatters.DEFAULT_CATEGORY_WEIGHTS };
      domainRules = [];
      renderWeights();
      renderDomainRules();

      await chrome.runtime.sendMessage({
        action: 'SAVE_SETTINGS',
        settings: {
          googleDriveFolderName: 'Tasker Activity Logs',
          autoSyncDrive: false,
          aiSummariesEnabled: true,
          blacklistedDomains: ['bank', 'paypal', 'passwords', 'accounts.google.com'],
          categoryWeights: {},
          domainCategories: {}
        }
      });
      showSaveToast('Settings reset to recommended defaults!');
    }
  });

  function showSaveToast(msg) {
    saveToast.textContent = msg;
    saveToast.classList.remove('hidden');
    setTimeout(() => {
      saveToast.classList.add('hidden');
    }, 3000);
  }

  // Export Data as JSON
  exportDataBtn.addEventListener('click', async () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (res) => {
        const jsonStr = JSON.stringify(res, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Tasker_Backup_${Formatters.getDateKey()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  });

  // Clear History Data
  clearDataBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all local tracking history? This action cannot be undone.')) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.clear(() => {
          alert('Tracking history cleared.');
          location.reload();
        });
      }
    }
  });
});
