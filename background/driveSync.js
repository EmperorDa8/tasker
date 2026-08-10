/**
 * Tasker - Google Drive Sync Service
 * Uses Google Drive API v3 to sync daily logs and monthly recaps.
 */

const GoogleDriveSync = {
  DRIVE_API_BASE: 'https://www.googleapis.com/drive/v3',
  DRIVE_UPLOAD_BASE: 'https://www.googleapis.com/upload/drive/v3',
  SCOPES: ['https://www.googleapis.com/auth/drive.file'],

  /**
   * Escape a value for use inside single quotes in a Drive API "q" query string
   */
  escapeDriveQueryValue(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  },

  /**
   * Turn a chrome.identity failure into something a user can act on.
   *
   * getAuthToken reports several very different situations through the same
   * channel - not signed into Chrome, consent dismissed, access revoked - and a
   * single generic message leaves the user with no idea which one they hit.
   */
  describeAuthFailure(rawMessage) {
    const msg = String(rawMessage || '');

    if (/not signed in|no account|Account not found/i.test(msg)) {
      return 'Sign in to Chrome with the Google account you want your logs saved to, then turn on Drive sync again.';
    }
    if (/did not approve|cancell?ed|closed by user/i.test(msg)) {
      return 'Google sign-in was cancelled. Drive sync stays off until you approve access.';
    }
    if (/revoked|not granted/i.test(msg)) {
      return 'Access to Google Drive was revoked. Turn Drive sync on again to reconnect.';
    }
    return msg
      ? `Google sign-in failed: ${msg}`
      : 'Google sign-in failed. Check your connection and try again.';
  },

  /**
   * Get a valid OAuth access token via chrome.identity.
   *
   * The client ID lives in the manifest oauth2 block and is bound to this
   * extension's Web Store item ID, so there is nothing for the user to configure.
   */
  async getAuthToken(interactive = true) {
    if (typeof chrome === 'undefined' || !chrome.identity) {
      throw new Error('Google sign-in is only available inside the Chrome extension runtime.');
    }

    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        const lastError = chrome.runtime.lastError?.message || '';
        if (token) return resolve(token);
        reject(new Error(this.describeAuthFailure(lastError)));
      });
    });
  },

  /**
   * Ensure dedicated "Tasker Activity Logs" folder exists on Google Drive
   */
  async getOrCreateAppFolder(token) {
    const settings = await TaskerStorage.getSettings();
    if (settings.googleDriveFolderId) {
      return settings.googleDriveFolderId;
    }

    const folderName = settings.googleDriveFolderName || 'Tasker Activity Logs';
    const query = `name = '${this.escapeDriveQueryValue(folderName)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const response = await fetch(`${this.DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to search Drive folders: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      const folderId = data.files[0].id;
      await TaskerStorage.saveSettings({ googleDriveFolderId: folderId });
      return folderId;
    }

    // Create folder
    const createRes = await fetch(`${this.DRIVE_API_BASE}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`);
    }

    const folderData = await createRes.json();
    await TaskerStorage.saveSettings({ googleDriveFolderId: folderData.id });
    return folderData.id;
  },

  /**
   * Upload or update a Markdown/JSON file on Google Drive
   */
  async uploadFile(filename, content, mimeType = 'text/markdown') {
    const token = await this.getAuthToken(true);
    const folderId = await this.getOrCreateAppFolder(token);

    // Check if file already exists in folder
    const checkQuery = `name = '${this.escapeDriveQueryValue(filename)}' and '${this.escapeDriveQueryValue(folderId)}' in parents and trashed = false`;
    const checkRes = await fetch(`${this.DRIVE_API_BASE}/files?q=${encodeURIComponent(checkQuery)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let existingFileId = null;
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData.files && checkData.files.length > 0) {
        existingFileId = checkData.files[0].id;
      }
    }

    const metadata = {
      name: filename,
      mimeType: mimeType
    };

    if (!existingFileId) {
      metadata.parents = [folderId];
    }

    const multipartBoundary = '-------tasker_boundary_12345';
    const delimiter = `\r\n--${multipartBoundary}\r\n`;
    const closeDelimiter = `\r\n--${multipartBoundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      content +
      closeDelimiter;

    const uploadUrl = existingFileId
      ? `${this.DRIVE_UPLOAD_BASE}/files/${existingFileId}?uploadType=multipart`
      : `${this.DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;

    const uploadRes = await fetch(uploadUrl, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${multipartBoundary}"`
      },
      body: multipartRequestBody
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload to Drive failed (${uploadRes.status}): ${errText}`);
    }

    const fileResult = await uploadRes.json();
    return {
      fileId: fileResult.id,
      name: fileResult.name,
      webUrl: `https://drive.google.com/file/d/${fileResult.id}/view`,
      syncedAt: new Date().toISOString()
    };
  },

  /**
   * Sync Daily Activity Log to Google Drive
   */
  async syncDailyLog(dateKey) {
    const dailySummary = await ActivitySummarizer.generateDailySummary(dateKey);
    const filename = `Tasker_Daily_Log_${dateKey}.md`;
    const result = await this.uploadFile(filename, dailySummary.markdown, 'text/markdown');
    
    // Save sync record
    await TaskerStorage.set({ [`last_sync_${dateKey}`]: result });
    return result;
  },

  /**
   * Sync Monthly Accomplishment Recap Report to Google Drive
   */
  async syncMonthlyRecap(monthKey) {
    const recap = await ActivitySummarizer.generateMonthlyRecap(monthKey);
    const filename = `Tasker_Monthly_Recap_${monthKey}.md`;
    const result = await this.uploadFile(filename, recap.markdown, 'text/markdown');

    await TaskerStorage.set({ [`last_recap_sync_${monthKey}`]: result });
    return result;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.GoogleDriveSync = GoogleDriveSync;
}
