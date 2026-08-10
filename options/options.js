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

  const presetBankingBtn = document.getElementById('presetBankingBtn');
  const presetAuthBtn = document.getElementById('presetAuthBtn');
  const presetPrivacyBtn = document.getElementById('presetPrivacyBtn');
  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');

  // Load existing settings
  const settings = await TaskerStorage.getSettings();
  driveFolderName.value = settings.googleDriveFolderName || 'Tasker Activity Logs';
  autoSyncDrive.checked = settings.autoSyncDrive === true;
  aiSummariesEnabled.checked = settings.aiSummariesEnabled !== false;
  blacklistedDomains.value = (settings.blacklistedDomains || []).join(', ');

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

  // Save Settings
  saveSettingsBtn.addEventListener('click', async () => {
    const updated = {
      googleDriveFolderName: driveFolderName.value.trim() || 'Tasker Activity Logs',
      autoSyncDrive: autoSyncDrive.checked,
      aiSummariesEnabled: aiSummariesEnabled.checked,
      blacklistedDomains: blacklistedDomains.value.split(',').map(s => s.trim()).filter(Boolean)
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

      await chrome.runtime.sendMessage({
        action: 'SAVE_SETTINGS',
        settings: {
          googleDriveFolderName: 'Tasker Activity Logs',
          autoSyncDrive: false,
          aiSummariesEnabled: true,
          blacklistedDomains: ['bank', 'paypal', 'passwords', 'accounts.google.com']
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
