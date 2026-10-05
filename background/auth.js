/**
 * Tasker - account session (service worker side)
 *
 * An account exists for one reason: so a Pro purchase belongs to a person rather
 * than to a string that can be pasted around, and follows them to a new machine.
 * Nothing about tracking needs one, and nothing here runs unless the user signs
 * in. Free use stays accountless.
 *
 * The extension never talks to the auth provider. It talks to the Tasker
 * service, which holds the provider's keys. That keeps those keys out of
 * readable extension source and lets them be rotated without a store release.
 * The password goes to the service over TLS, is forwarded, and is never stored
 * on either side of this call.
 *
 * Only the access/refresh tokens are kept, in chrome.storage.local under their
 * own key (not in tasker_settings, which "reset to defaults" rewrites).
 */

const SERVICE_BASE = SUMMARY_SERVICE_URL.replace('/v1/monthly-summary', '');

function serviceError(message, code) {
  const err = new Error(message);
  err.code = code || 'error';
  return err;
}

const TaskerAuth = {
  KEY: 'tasker_auth',

  // Refresh this long before expiry rather than after: a request that goes out
  // with a token that dies in flight comes back 401 for no reason.
  REFRESH_MARGIN_MS: 60 * 1000,

  _refreshing: null,

  /* ------------------------------------------------------------ storage - */

  async getSession() {
    const res = await TaskerStorage.get(this.KEY);
    const s = res[this.KEY];
    return s && s.accessToken && s.refreshToken ? s : null;
  },

  async _save(session) {
    await TaskerStorage.set({ [this.KEY]: session });
  },

  async _clear() {
    await TaskerStorage.set({ [this.KEY]: null });
  },

  async state() {
    const s = await this.getSession();
    return { signedIn: !!s, email: s && s.user ? s.user.email : null };
  },

  /* ---------------------------------------------------------- transport - */

  async _request(path, body, token) {
    let res;
    try {
      res = await fetch(SERVICE_BASE + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body || {}),
        signal: AbortSignal.timeout(20000)
      });
    } catch (err) {
      throw serviceError('Could not reach Tasker. Check your connection and try again.', 'network');
    }

    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, json: json || {} };
  },

  /** Turn a service failure into an Error carrying a message fit to show. */
  _fail(res) {
    const j = res.json || {};
    if (res.status === 501) return serviceError('Accounts are not switched on yet.', 'not_configured');
    if (res.status === 429) return serviceError(j.message || 'Too many attempts. Try again in an hour.', 'rate_limited');
    return serviceError(j.message || `Tasker returned ${res.status}.`, j.error || 'error');
  },

  /* ------------------------------------------------------ sign up / in - */

  async signUp(email, password) {
    const res = await this._request('/v1/auth/signup', { email, password });
    if (res.status !== 200) throw this._fail(res);
    if (!res.json.session) return { email, needsConfirmation: true };
    await this._save(res.json.session);
    return { email: res.json.session.user.email };
  },

  async signIn(email, password) {
    const res = await this._request('/v1/auth/signin', { email, password });
    if (res.status !== 200 || !res.json.session) throw this._fail(res);
    await this._save(res.json.session);
    return { email: res.json.session.user.email };
  },

  /**
   * Local sign-out comes first and cannot fail: the user asked to be signed out,
   * and a dead network must not leave them signed in. Telling the server to
   * revoke the session is a courtesy after that.
   */
  async signOut() {
    const s = await this.getSession();
    await this._clear();
    if (s) await this._request('/v1/auth/signout', {}, s.accessToken).catch(() => null);
  },

  async recover(email) {
    const res = await this._request('/v1/auth/recover', { email });
    if (res.status !== 200) throw this._fail(res);
  },

  /* ------------------------------------------------------------ tokens - */

  /**
   * A token good for at least a minute, or null if nobody is signed in (or the
   * session was ended server-side and cannot be refreshed).
   */
  async accessToken(force) {
    const s = await this.getSession();
    if (!s) return null;
    if (!force && s.expiresAt - Date.now() > this.REFRESH_MARGIN_MS) return s.accessToken;
    return this._refresh(s);
  },

  /**
   * Refresh tokens rotate and are single-use, so two callers refreshing at once
   * would burn the token between them. They share one in-flight refresh.
   */
  _refresh(session) {
    if (!this._refreshing) {
      this._refreshing = (async () => {
        let res;
        try {
          res = await this._request('/v1/auth/refresh', { refreshToken: session.refreshToken });
        } catch (err) {
          // Offline: keep the session. Hand back the old token and let the
          // caller's request fail on its own terms.
          return session.accessToken;
        }
        if (res.status === 200 && res.json.session) {
          await this._save(res.json.session);
          return res.json.session.accessToken;
        }
        // The provider said no (revoked, rotated away, expired). That session is
        // finished; leaving it would just fail every call from here on. A 429 or
        // a 5xx is not a verdict on the session, so those leave it alone.
        if ([400, 401, 403, 422].includes(res.status)) {
          await this._clear();
          return null;
        }
        return session.accessToken;
      })().finally(() => { this._refreshing = null; });
    }
    return this._refreshing;
  },

  /**
   * POST to an endpoint that needs the signed-in user. Retries once with a
   * freshly refreshed token if the first attempt is told the session is invalid.
   */
  async authedPost(path, body) {
    let token = await this.accessToken();
    if (!token) throw serviceError('Sign in to continue.', 'signin_required');

    let res = await this._request(path, body, token);
    if (res.status === 401) {
      token = await this.accessToken(true);
      if (!token) throw serviceError('Your session has expired. Sign in again.', 'signin_required');
      res = await this._request(path, body, token);
    }

    if (res.status === 401) throw serviceError('Your session has expired. Sign in again.', 'signin_required');
    if (res.status !== 200) throw this._fail(res);
    return res.json;
  }
};
