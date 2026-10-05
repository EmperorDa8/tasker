/**
 * Tasker accounts and licence ownership, on Powabase (GoTrue + PostgREST).
 *
 * Two keys, two jobs:
 *   anon key     - the only thing GoTrue's public endpoints need. Held here, not
 *                  in the extension, so it can be rotated without a Web Store
 *                  release (the one Powabase issues carries an expiry date).
 *   service key  - bypasses RLS. The only writer to public.licenses.
 *
 * Passwords pass through this process to GoTrue over TLS and are never logged,
 * stored or inspected here.
 *
 * Zero-dependency, like the rest of the service. The caller supplies
 * `verifyCheckout` (the Bachs check) so this module knows nothing about payments
 * beyond "was this checkout paid, and for what".
 */

'use strict';

// A licence is re-confirmed with Bachs at most this often when its owner asks
// for their status, so a refund is noticed without a call to Bachs on every poll.
const REVERIFY_AFTER_MS = 12 * 60 * 60 * 1000;

function createAccounts({ url, anonKey, serviceKey, verifyCheckout }) {
  const base = String(url || '').replace(/\/$/, '');
  const configured = !!(base && anonKey && serviceKey);

  async function call(path, opts) {
    const o = opts || {};
    const key = o.key || anonKey;
    const headers = {
      apikey: key,
      Authorization: `Bearer ${o.token || key}`,
      Accept: 'application/json'
    };
    if (o.body) headers['Content-Type'] = 'application/json';
    if (o.prefer) headers.Prefer = o.prefer;

    const res = await fetch(base + path, {
      method: o.method || 'GET',
      headers,
      body: o.body ? JSON.stringify(o.body) : undefined,
      signal: AbortSignal.timeout(10000)
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty body is normal for 201/204 */ }
    return { status: res.status, json };
  }

  /** GoTrue's messages are written for end users ("Invalid login credentials"). */
  function failure(res) {
    const j = res.json || {};
    const known = res.status >= 400 && res.status < 500;
    return {
      ok: false,
      status: known ? res.status : 502,
      code: known ? (j.error_code || j.error || 'auth_error') : 'auth_unavailable',
      message: known
        ? (j.msg || j.error_description || j.message || 'That did not work.')
        : 'The account service is unavailable. Try again shortly.'
    };
  }

  function toSession(j) {
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: j.expires_at ? j.expires_at * 1000 : Date.now() + (j.expires_in || 3600) * 1000,
      user: { id: j.user && j.user.id, email: j.user && j.user.email }
    };
  }

  /* ------------------------------------------------------------- auth - */

  async function signUp(email, password) {
    const res = await call('/auth/v1/signup', { method: 'POST', body: { email, password } });
    if (res.status !== 200 || !res.json) return failure(res);
    // With email confirmation on, GoTrue returns the user and no tokens.
    if (!res.json.access_token) return { ok: true, session: null, needsConfirmation: true };
    return { ok: true, session: toSession(res.json) };
  }

  async function signIn(email, password) {
    const res = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    if (res.status !== 200 || !res.json || !res.json.access_token) return failure(res);
    return { ok: true, session: toSession(res.json) };
  }

  async function refresh(refreshToken) {
    const res = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } });
    if (res.status !== 200 || !res.json || !res.json.access_token) return failure(res);
    return { ok: true, session: toSession(res.json) };
  }

  /** Always succeeds from the caller's side, so it cannot be used to find out who has an account. */
  async function recover(email, redirectTo) {
    await call('/auth/v1/recover', { method: 'POST', body: { email, options: { redirect_to: redirectTo } } })
      .catch(() => null);
    return { ok: true };
  }

  async function resetPassword(accessToken, password) {
    const res = await call('/auth/v1/user', { method: 'PUT', token: accessToken, body: { password } });
    if (res.status !== 200) return failure(res);
    return { ok: true };
  }

  async function signOut(accessToken) {
    await call('/auth/v1/logout?scope=local', { method: 'POST', token: accessToken }).catch(() => null);
    return { ok: true };
  }

  /**
   * Who does this token belong to? Asked of GoTrue on every protected call rather
   * than decoded locally: it also catches a revoked session, and there is no
   * signing secret to hold here.
   */
  async function userFor(accessToken) {
    if (!accessToken) return null;
    const res = await call('/auth/v1/user', { token: accessToken });
    if (res.status !== 200 || !res.json || !res.json.id) return null;
    return { id: res.json.id, email: res.json.email || null };
  }

  /* --------------------------------------------------------- licences - */

  function rest(path, opts) {
    return call(`/rest/v1/${path}`, { key: serviceKey, ...(opts || {}) });
  }

  function patchLicense(checkoutId, fields) {
    return rest(`licenses?checkout_id=eq.${encodeURIComponent(checkoutId)}`, {
      method: 'PATCH',
      body: { ...fields, updated_at: new Date().toISOString() },
      prefer: 'return=minimal'
    });
  }

  /**
   * Attach a paid checkout to an account.
   *
   * The checkout is read back from Bachs first - nothing the caller sends is
   * trusted. Then it is claimed: the first account to claim it owns it, and the
   * unique constraint on checkout_id makes that race-safe. A checkout made while
   * signed in is reserved for that account from the start (it carries the
   * account's id in its metadata), so an order reference leaked from a receipt
   * cannot be claimed by someone else.
   */
  async function claim(user, checkoutId, installId) {
    const result = await verifyCheckout(checkoutId);

    if (!result.valid) {
      if (result.reason === 'refunded') await patchLicense(checkoutId, { status: 'refunded', verified_at: new Date().toISOString() });
      return { valid: false, reason: result.reason, status: result.status };
    }

    const reservedFor = result.metadata && result.metadata.user_id;
    if (reservedFor && reservedFor !== user.id) return { valid: false, reason: 'other_account' };

    // ignore-duplicates: if it already exists this inserts nothing, and the
    // read below decides who owns it.
    const ins = await rest('licenses?on_conflict=checkout_id', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=minimal',
      body: {
        user_id: user.id,
        checkout_id: checkoutId,
        product_id: result.productId || null,
        plan: result.plan || 'lifetime',
        install_id: installId || null,
        purchased_at: result.purchasedAt || null
      }
    });
    if (ins.status >= 300) throw new Error(`licenses_insert_${ins.status}`);

    const got = await rest(`licenses?checkout_id=eq.${encodeURIComponent(checkoutId)}&select=user_id,status`);
    const row = got.json && got.json[0];
    if (!row) throw new Error('licenses_missing_after_insert');
    if (row.user_id !== user.id) return { valid: false, reason: 'already_claimed' };

    // Bachs says paid; make the row say so too (it may have been marked refunded
    // earlier and the payment since restored).
    await patchLicense(checkoutId, { status: 'active', verified_at: new Date().toISOString() });
    return { valid: true, plan: result.plan || 'lifetime', purchasedAt: result.purchasedAt || null, reference: checkoutId };
  }

  /**
   * Does this account own a live licence? Answers from the table, and only goes
   * back to Bachs when the last check is stale - which is how a refund reaches a
   * buyer. If Bachs cannot be reached the stored answer stands: an outage must
   * not lock out someone who paid.
   */
  async function status(user) {
    const got = await rest(`licenses?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active` +
      '&select=checkout_id,plan,purchased_at,verified_at&order=created_at.asc&limit=5');
    if (got.status !== 200 || !Array.isArray(got.json)) throw new Error(`licenses_select_${got.status}`);

    for (const row of got.json) {
      const stale = Date.now() - Date.parse(row.verified_at) > REVERIFY_AFTER_MS;
      if (stale) {
        try {
          const result = await verifyCheckout(row.checkout_id);
          if (result.valid) {
            await patchLicense(row.checkout_id, { verified_at: new Date().toISOString() });
          } else if (result.reason === 'refunded') {
            await patchLicense(row.checkout_id, { status: 'refunded', verified_at: new Date().toISOString() });
            continue;
          }
        } catch { /* keep the stored answer */ }
      }
      return { isPro: true, plan: row.plan, reference: row.checkout_id, purchasedAt: row.purchased_at };
    }
    return { isPro: false };
  }

  return { configured, signUp, signIn, refresh, recover, resetPassword, signOut, userFor, claim, status };
}

module.exports = { createAccounts };
