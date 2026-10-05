/**
 * Tasker - shared UI helpers
 *
 * The three surfaces (popup, dashboard, settings) all show the work profile and
 * all offer a PDF. Each one having its own version of that is how the wording of
 * a claim drifts between screens - which matters more than usual here, because
 * the claim is an inference about the person reading it.
 */

const TaskerUI = {

  /**
   * Settings a surface needs before its first paint.
   *
   * Kept as its own call even though there is no longer a theme to apply,
   * because the popup already awaits it and reads onboarding state from the
   * result. Returns null rather than throwing: a surface that cannot reach
   * storage should still render.
   */
  async initSurface() {
    try {
      return await TaskerStorage.getSettings();
    } catch (e) {
      return null;
    }
  },

  esc(value) {
    return Formatters.escapeHtml(value);
  },

  icon(name, size) {
    return (typeof TaskerIcons !== 'undefined') ? TaskerIcons.markup(name, size) : '';
  },

  /**
   * Confidence tier -> chip styling. Kept in one place so "Likely" never
   * appears green on one screen and grey on another.
   */
  confidenceClass(profile) {
    if (!profile) return 'is-muted';
    switch (profile.confidence) {
      case 'stated': return 'is-accent';
      case 'high': return 'is-ok';
      case 'moderate': return 'is-accent';
      case 'emerging': return 'is-warn';
      default: return 'is-muted';
    }
  },

  /**
   * Render the work profile into `container`.
   *
   * Every branch prints the qualification alongside the claim. There is
   * deliberately no compact mode that drops the disclaimer: a badge reading
   * "Backend Engineer" with nothing next to it is exactly the assertion this
   * feature is not allowed to make.
   *
   * @param {HTMLElement} container
   * @param {object|null} profile result from RoleDetector.infer
   * @param {object} [opts] { dense: boolean, onCorrect: function }
   */
  renderWorkProfile(container, profile, opts) {
    if (!container) return;
    const o = opts || {};
    const dense = !!o.dense;

    if (!profile) {
      container.innerHTML = `
        <div class="wp-empty">
          ${this.icon('person_search', 'lg')}
          <div>
            <strong>Work profile is off</strong>
            <p>Turn it on in Settings to see what your browsing pattern resembles.</p>
          </div>
        </div>`;
      return;
    }

    if (profile.status === 'insufficient') {
      const gaps = (profile.shortfall || []).map(g => `<li>${this.esc(g)}</li>`).join('');
      container.innerHTML = `
        <div class="wp-head">
          <span class="wp-icon is-pending">${this.icon('manage_search', 'lg')}</span>
          <div class="wp-title">
            <strong>Not enough evidence yet</strong>
            <span class="t-chip is-muted">No call</span>
          </div>
        </div>
        <p class="wp-note">${this.esc(profile.disclaimer)}</p>
        ${gaps ? `<p class="wp-subtle">Still needed:</p><ul class="wp-gaps">${gaps}</ul>` : ''}
        ${this.correctionLink(o)}`;
      this.bindCorrection(container, o);
      return;
    }

    if (profile.status === 'stated') {
      container.innerHTML = `
        <div class="wp-head">
          <span class="wp-icon is-stated">${this.icon(profile.icon || 'badge', 'lg')}</span>
          <div class="wp-title">
            <strong>${this.esc(profile.label)}</strong>
            <span class="t-chip is-accent">Set by you</span>
          </div>
        </div>
        ${this.aliasRow(profile)}
        <p class="wp-note">${this.esc(profile.disclaimer)}</p>
        ${this.correctionLink(o, 'Change or clear this')}`;
      this.bindCorrection(container, o);
      return;
    }

    if (profile.status === 'ambiguous') {
      const rows = (profile.candidates || []).map(c => `
        <li class="wp-candidate">
          <span class="wp-candidate-name">${this.icon(c.icon || 'work', 'sm')}${this.esc(c.label)}</span>
          <span class="wp-candidate-share">${c.sharePercent}%</span>
          <span class="wp-bar"><i style="width:${Math.max(4, c.sharePercent)}%"></i></span>
        </li>`).join('');

      container.innerHTML = `
        <div class="wp-head">
          <span class="wp-icon is-pending">${this.icon('hub', 'lg')}</span>
          <div class="wp-title">
            <strong>Several profiles fit</strong>
            <span class="t-chip is-warn">Too close to call</span>
          </div>
        </div>
        <p class="wp-note">${this.esc(profile.disclaimer)}</p>
        <ul class="wp-candidates">${rows}</ul>
        ${this.evidenceBlock(profile, dense)}
        ${this.correctionLink(o)}`;
      this.bindDisclosure(container);
      this.bindCorrection(container, o);
      return;
    }

    // A named finding.
    const alts = (profile.alternatives || [])
      .map(a => `${this.esc(a.label)} (${a.sharePercent}%)`).join(', ');

    container.innerHTML = `
      <div class="wp-head">
        <span class="wp-icon">${this.icon(profile.icon || 'work', 'lg')}</span>
        <div class="wp-title">
          <strong>${this.esc(profile.label)}</strong>
          <span class="t-chip ${this.confidenceClass(profile)}">${this.esc(profile.confidenceLabel)}</span>
        </div>
      </div>
      <p class="wp-lead">
        Your browsing pattern over the last ${profile.stats.daysSeen} day${profile.stats.daysSeen === 1 ? '' : 's'}
        most resembles this kind of work &mdash; matched on
        ${profile.stats.distinctSources} tool${profile.stats.distinctSources === 1 ? '' : 's'}.
      </p>
      ${this.aliasRow(profile)}
      <p class="wp-note">${this.esc(profile.disclaimer)}</p>
      ${this.evidenceBlock(profile, dense)}
      ${alts ? `<p class="wp-subtle">Also considered: ${alts}</p>` : ''}
      ${this.correctionLink(o)}`;

    this.bindDisclosure(container);
    this.bindCorrection(container, o);
  },

  /**
   * The job titles this same work is posted under.
   *
   * Shown as chips rather than prose because the point is scanability: someone
   * looking at "AI / LLM Engineer" needs to see at a glance that Applied AI
   * Engineer and GenAI Engineer are the same thing, not a different finding.
   */
  aliasRow(profile) {
    const aliases = (profile && profile.aliases) || [];
    if (aliases.length === 0) return '';
    const chips = aliases.map(a => `<span class="t-chip is-muted">${this.esc(a)}</span>`).join('');
    return `
      <div class="wp-aliases">
        <span class="wp-aliases-label">Also advertised as</span>
        <div class="wp-aliases-chips">${chips}</div>
        <p class="wp-aliases-note">
          These are the same tools in the same tabs, so Tasker reports the family
          rather than picking one title.
        </p>
      </div>`;
  },

  /**
   * The auditable part: what the finding is actually built on.
   *
   * Collapsed by default in the popup because of the space, expanded on the
   * dashboard - but present in both, because a claim the user cannot check is
   * a claim they have to take on trust.
   */
  evidenceBlock(profile, dense) {
    const items = profile.evidence || [];
    if (!items.length) return '';

    const rows = items.map((item) => {
      const where = (item.sources || []).slice(0, 3).map(s => this.esc(s)).join(', ');
      return `
        <li class="wp-evidence-row">
          <span class="wp-evidence-label">
            ${this.esc(item.label)}
            ${where ? `<em>${where}</em>` : ''}
          </span>
          <span class="wp-evidence-value">
            ${Formatters.formatDuration(item.seconds)}
            <i>${item.days}d</i>
          </span>
        </li>`;
    }).join('');

    return `
      <details class="wp-evidence"${dense ? '' : ' open'}>
        <summary>
          ${this.icon('manage_search', 'sm')}
          <span>Evidence (${items.length})</span>
        </summary>
        <ul>${rows}</ul>
      </details>`;
  },

  correctionLink(opts, label) {
    if (!opts || !opts.onCorrect) return '';
    return `<button type="button" class="wp-correct">${label || 'Not right? Set it yourself'}</button>`;
  },

  bindCorrection(container, opts) {
    const btn = container.querySelector('.wp-correct');
    if (btn && opts && opts.onCorrect) btn.addEventListener('click', opts.onCorrect);
  },

  // <details> handles its own toggling; this is here so a future custom
  // disclosure has one place to hook into.
  bindDisclosure() {},

  /**
   * Ask the worker to build a PDF and hand it to the user.
   *
   * The worker returns a plain array of bytes because structured clone cannot
   * carry a Blob between contexts; it is reassembled here.
   *
   * @param {'daily'|'monthly'} kind
   * @param {object} keys { dateKey } or { monthKey }
   * @returns {Promise<string>} the filename that was saved
   */
  async downloadReportPdf(kind, keys) {
    const action = kind === 'monthly' ? 'BUILD_MONTHLY_PDF' : 'BUILD_DAILY_PDF';
    const res = await chrome.runtime.sendMessage({ action, ...keys });

    if (!res || !res.success) {
      throw new Error((res && res.error) || 'Could not build the PDF');
    }

    const bytes = new Uint8Array(res.data.bytes);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = res.data.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Revoking immediately can cancel the download in some Chrome builds, so
    // hold the object URL just long enough for the save to start.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return res.data.filename;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.TaskerUI = TaskerUI;
}
