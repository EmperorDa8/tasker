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
   * Find a folder by name under `parentId`, creating it if it is not there.
   *
   * Generalised over the parent so the same code makes the top-level folder
   * (parent 'root') and the subfolders inside it.
   */
  async findOrCreateFolder(token, name, parentId) {
    const parent = parentId || 'root';
    const query =
      `name = '${this.escapeDriveQueryValue(name)}' and ` +
      `mimeType = 'application/vnd.google-apps.folder' and ` +
      `'${this.escapeDriveQueryValue(parent)}' in parents and trashed = false`;

    const response = await fetch(`${this.DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error(`Failed to search Drive folders: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) return data.files[0].id;

    const createRes = await fetch(`${this.DRIVE_API_BASE}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent]
      })
    });
    if (!createRes.ok) {
      throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`);
    }
    return (await createRes.json()).id;
  },

  /**
   * Ensure the "Tasker Activity Logs" folder exists, and return its id.
   *
   * The id is cached in settings. A cached id can go stale - the user moves
   * the folder to the bin, or deletes it in Drive - so an id that no longer
   * resolves is discarded and the folder remade, rather than being allowed to
   * fail every subsequent sync with a 404 the user cannot act on.
   */
  async getOrCreateAppFolder(token) {
    const settings = await TaskerStorage.getSettings();
    const folderName = settings.googleDriveFolderName || 'Tasker Activity Logs';

    if (settings.googleDriveFolderId) {
      const stillThere = await this.folderExists(token, settings.googleDriveFolderId);
      if (stillThere) return settings.googleDriveFolderId;
      await TaskerStorage.saveSettings({ googleDriveFolderId: '' });
    }

    const folderId = await this.findOrCreateFolder(token, folderName, 'root');
    await TaskerStorage.saveSettings({ googleDriveFolderId: folderId });
    return folderId;
  },

  /**
   * Is this folder id still a live, untrashed folder?
   */
  async folderExists(token, folderId) {
    try {
      const res = await fetch(
        `${this.DRIVE_API_BASE}/files/${encodeURIComponent(folderId)}?fields=id,trashed,mimeType`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) return false;
      const file = await res.json();
      return !file.trashed && file.mimeType === 'application/vnd.google-apps.folder';
    } catch (e) {
      return false;
    }
  },

  // Where each kind of report is filed. A year of daily logs in one flat
  // folder is technically a backup and practically a haystack.
  SUBFOLDERS: {
    daily: 'Daily Logs',
    monthly: 'Monthly Recaps'
  },

  /**
   * The folder a report of this kind belongs in.
   *
   * Falls back to the top-level folder when the user has turned filing off, or
   * when creating the subfolder fails - a report that lands in the right
   * account but the wrong folder still beats a sync that did not happen.
   */
  async resolveTargetFolder(token, kind) {
    const rootFolder = await this.getOrCreateAppFolder(token);
    const settings = await TaskerStorage.getSettings();
    if (settings.driveOrganizeFolders === false) return rootFolder;

    const name = this.SUBFOLDERS[kind];
    if (!name) return rootFolder;

    try {
      return await this.findOrCreateFolder(token, name, rootFolder);
    } catch (err) {
      console.warn('Tasker: could not create Drive subfolder, filing at top level', err);
      return rootFolder;
    }
  },

  /**
   * Id of an existing file with this name in this folder, or null.
   *
   * Syncing a report is an update, not an append: re-syncing today should
   * replace today's log, not leave two copies for a reader to reconcile.
   */
  async findExistingFile(token, filename, folderId) {
    const query =
      `name = '${this.escapeDriveQueryValue(filename)}' and ` +
      `'${this.escapeDriveQueryValue(folderId)}' in parents and trashed = false`;
    const res = await fetch(`${this.DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.files && data.files.length > 0) ? data.files[0].id : null;
  },

  /**
   * Upload or replace one file.
   *
   * The multipart body is assembled as a Blob rather than a string so binary
   * content survives the trip. Concatenating PDF bytes into a JS string and
   * letting fetch encode the result as UTF-8 mangles every byte above 0x7F,
   * which in a PDF includes the xref offsets - the file uploads successfully
   * and then will not open.
   *
   * @param {string} filename
   * @param {string|Blob} content
   * @param {string} mimeType
   * @param {string} kind 'daily' | 'monthly' - decides the subfolder
   */
  async uploadFile(filename, content, mimeType = 'text/markdown', kind = 'daily') {
    const token = await this.getAuthToken(true);
    const folderId = await this.resolveTargetFolder(token, kind);
    const existingFileId = await this.findExistingFile(token, filename, folderId);

    const metadata = { name: filename, mimeType };
    if (!existingFileId) metadata.parents = [folderId];

    const boundary = `tasker_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      content instanceof Blob ? content : new Blob([content], { type: mimeType }),
      `\r\n--${boundary}--\r\n`
    ]);

    const fields = 'fields=id,name,webViewLink';
    const uploadUrl = existingFileId
      ? `${this.DRIVE_UPLOAD_BASE}/files/${existingFileId}?uploadType=multipart&${fields}`
      : `${this.DRIVE_UPLOAD_BASE}/files?uploadType=multipart&${fields}`;

    const uploadRes = await fetch(uploadUrl, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload to Drive failed (${uploadRes.status}): ${errText}`);
    }

    const fileResult = await uploadRes.json();
    return {
      fileId: fileResult.id,
      name: fileResult.name,
      mimeType,
      webUrl: fileResult.webViewLink || `https://drive.google.com/file/d/${fileResult.id}/view`,
      syncedAt: new Date().toISOString()
    };
  },

  /**
   * Which formats this sync should produce.
   * PDF is the default: it is the artifact people forward without editing.
   */
  async resolveFormats() {
    const settings = await TaskerStorage.getSettings();
    const choice = settings.driveFormat || 'pdf';
    if (choice === 'markdown') return ['markdown'];
    if (choice === 'both') return ['pdf', 'markdown'];
    return ['pdf'];
  },

  /**
   * Sync one day's log.
   *
   * The PDF is listed first deliberately: the returned record is what the
   * popup links to, and the PDF is the file the user actually wants opened.
   */
  async syncDailyLog(dateKey) {
    const summary = await ActivitySummarizer.generateDailySummary(dateKey);
    const formats = await this.resolveFormats();
    const uploads = [];

    if (formats.indexOf('pdf') !== -1) {
      const doc = TaskerReports.buildDailyReport({
        dateKey,
        dayData: summary.dayData,
        highlights: summary.highlights,
        notes: summary.notes,
        profile: summary.profile
      });
      uploads.push(await this.uploadFile(
        TaskerReports.fileName('daily', dateKey, 'pdf'),
        new Blob([doc.build()], { type: 'application/pdf' }),
        'application/pdf',
        'daily'
      ));
    }

    if (formats.indexOf('markdown') !== -1) {
      uploads.push(await this.uploadFile(
        TaskerReports.fileName('daily', dateKey, 'md'),
        summary.markdown,
        'text/markdown',
        'daily'
      ));
    }

    const primary = { ...uploads[0], files: uploads };
    await TaskerStorage.set({ [`last_sync_${dateKey}`]: primary });
    return primary;
  },

  /**
   * Sync one month's recap.
   */
  async syncMonthlyRecap(monthKey) {
    const recap = await ActivitySummarizer.generateMonthlyRecap(monthKey);
    const formats = await this.resolveFormats();
    const uploads = [];

    if (formats.indexOf('pdf') !== -1) {
      const doc = TaskerReports.buildMonthlyReport({
        monthKey,
        monthStats: recap.monthStats,
        profile: recap.profile
      });
      uploads.push(await this.uploadFile(
        TaskerReports.fileName('monthly', monthKey, 'pdf'),
        new Blob([doc.build()], { type: 'application/pdf' }),
        'application/pdf',
        'monthly'
      ));
    }

    if (formats.indexOf('markdown') !== -1) {
      uploads.push(await this.uploadFile(
        TaskerReports.fileName('monthly', monthKey, 'md'),
        recap.markdown,
        'text/markdown',
        'monthly'
      ));
    }

    const primary = { ...uploads[0], files: uploads };
    await TaskerStorage.set({ [`last_recap_sync_${monthKey}`]: primary });
    return primary;
  },

  /**
   * Prove the connection works without writing a report.
   *
   * Creates the folder tree and reports where reports will land, so sign-in
   * can be sorted out before there is anything worth uploading.
   */
  async testConnection() {
    const token = await this.getAuthToken(true);
    const rootFolder = await this.getOrCreateAppFolder(token);
    const settings = await TaskerStorage.getSettings();

    const created = [];
    if (settings.driveOrganizeFolders !== false) {
      const kinds = Object.keys(this.SUBFOLDERS);
      for (let i = 0; i < kinds.length; i++) {
        await this.findOrCreateFolder(token, this.SUBFOLDERS[kinds[i]], rootFolder);
        created.push(this.SUBFOLDERS[kinds[i]]);
      }
    }

    return {
      ok: true,
      folderId: rootFolder,
      folderName: settings.googleDriveFolderName || 'Tasker Activity Logs',
      subfolders: created,
      folderUrl: `https://drive.google.com/drive/folders/${rootFolder}`
    };
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.GoogleDriveSync = GoogleDriveSync;
}
