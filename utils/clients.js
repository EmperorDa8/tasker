/**
 * Tasker - client attribution and CSV export
 *
 * Turns "6h on github.com" into "6h for Acme", which is the difference between
 * a number that is interesting and a number you can put on an invoice.
 *
 * Domains map to clients the same way they map to categories: sparsely, and
 * matching subdomains, so one rule for `atlassian.net` covers every project
 * board under it. A domain with no rule is reported as unassigned rather than
 * guessed at - an invoice built on a guess is worse than one with a gap in it.
 */

const TaskerClients = {
  UNASSIGNED: '__unassigned__',
  UNASSIGNED_LABEL: 'Unassigned',

  // clientId -> name, and domain -> clientId. Both rebuilt by applyPreferences.
  CLIENTS: {},
  DOMAIN_CLIENTS: {},

  /**
   * Adopt the user's client list and domain rules.
   * Rules pointing at a client that no longer exists are dropped, so deleting a
   * client cannot leave hours attributed to a name the user cannot see.
   */
  applyPreferences(settings) {
    const prefs = settings || {};

    const clients = {};
    (Array.isArray(prefs.clients) ? prefs.clients : []).forEach((entry) => {
      if (!entry || !entry.id) return;
      const name = String(entry.name || '').trim();
      if (!name) return;
      clients[String(entry.id)] = name;
    });
    this.CLIENTS = clients;

    const domains = {};
    Object.keys(prefs.clientDomains || {}).forEach((domain) => {
      const clientId = String(prefs.clientDomains[domain] || '');
      const key = String(domain || '').trim().toLowerCase().replace(/^www\./, '');
      if (key && clients[clientId]) domains[key] = clientId;
    });
    this.DOMAIN_CLIENTS = domains;
  },

  /** Client id for a domain, or null. Subdomain-aware, longest rule wins. */
  lookupClientId(domain) {
    const host = String(domain || '').toLowerCase().replace(/^www\./, '');
    if (!host) return null;

    let best = null;
    Object.keys(this.DOMAIN_CLIENTS).forEach((key) => {
      if (host === key || host.endsWith('.' + key)) {
        // A rule for `acme.atlassian.net` must beat one for `atlassian.net`,
        // which is how one agency's board is split from another's.
        if (!best || key.length > best.length) best = key;
      }
    });
    return best ? this.DOMAIN_CLIENTS[best] : null;
  },

  clientName(clientId) {
    if (!clientId || clientId === this.UNASSIGNED) return this.UNASSIGNED_LABEL;
    return this.CLIENTS[clientId] || this.UNASSIGNED_LABEL;
  },

  /**
   * Seconds per client across a set of days.
   *
   * @param {Array<{dateKey: string, day: object|null}>} days
   * @returns {Array<{clientId, name, seconds, domains: Array}>} largest first
   */
  rollUp(days) {
    const totals = {};

    (days || []).forEach((entry) => {
      const day = entry && entry.day;
      if (!day || !day.domains) return;

      Object.keys(day.domains).forEach((domain) => {
        const seconds = Number(day.domains[domain]) || 0;
        if (seconds <= 0) return;

        const clientId = this.lookupClientId(domain) || this.UNASSIGNED;
        if (!totals[clientId]) totals[clientId] = { seconds: 0, domains: {} };
        totals[clientId].seconds += seconds;
        totals[clientId].domains[domain] = (totals[clientId].domains[domain] || 0) + seconds;
      });
    });

    return Object.keys(totals).map((clientId) => ({
      clientId,
      name: this.clientName(clientId),
      seconds: totals[clientId].seconds,
      domains: Object.keys(totals[clientId].domains)
        .map(d => ({ domain: d, seconds: totals[clientId].domains[d] }))
        .sort((a, b) => b.seconds - a.seconds)
    })).sort((a, b) => b.seconds - a.seconds);
  },

  /* ------------------------------------------------------------------ CSV - */

  /**
   * Escape one CSV field.
   *
   * Two separate problems. The RFC one: a field containing a comma, quote or
   * newline must be quoted, with inner quotes doubled. And the spreadsheet one:
   * Excel, Sheets and LibreOffice treat a leading =, +, - or @ as a formula, so
   * a client named "=cmd|..." would execute on open. Prefixing an apostrophe
   * neutralises that and is invisible once the sheet is loaded.
   */
  escapeCsv(value) {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    if (/[",\n\r]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
    return text;
  },

  /**
   * One row per day per domain: the grain someone needs to build an invoice,
   * and the grain a pivot table can roll back up however they like.
   *
   * @param {Array<{dateKey, day}>} days
   * @returns {string} CSV including a header row
   */
  buildCsv(days) {
    const header = ['Date', 'Client', 'Domain', 'Category', 'Hours', 'Seconds'];
    const rows = [header.map(h => this.escapeCsv(h)).join(',')];

    (days || []).forEach((entry) => {
      const day = entry && entry.day;
      if (!day || !day.domains) return;

      Object.keys(day.domains)
        .sort((a, b) => day.domains[b] - day.domains[a])
        .forEach((domain) => {
          const seconds = Number(day.domains[domain]) || 0;
          if (seconds <= 0) return;

          const clientId = this.lookupClientId(domain);
          // categorizeActivity works from a URL, and a bare host is enough for
          // it: the path-qualified rules simply do not match, which is correct
          // when all we know is the domain.
          const category = (typeof Formatters !== 'undefined' && Formatters.categorizeActivity)
            ? Formatters.categorizeActivity('https://' + domain, '')
            : '';

          rows.push([
            entry.dateKey,
            clientId ? this.clientName(clientId) : this.UNASSIGNED_LABEL,
            domain,
            category,
            (seconds / 3600).toFixed(2),
            seconds
          ].map(v => this.escapeCsv(v)).join(','));
        });
    });

    // CRLF: Excel is the most common destination and is happiest with it.
    return rows.join('\r\n') + '\r\n';
  },

  /** A filename that sorts chronologically in a folder of them. */
  csvFileName(fromKey, toKey) {
    return `Tasker_${fromKey}_to_${toKey}.csv`;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.TaskerClients = TaskerClients;
}
