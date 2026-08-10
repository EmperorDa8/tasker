/**
 * Tasker - Formatting Utilities
 */

const Formatters = {
  /**
   * Escape a value for safe interpolation into HTML markup.
   * Page titles, URLs, and AI output are attacker-controlled and must
   * always pass through here before reaching innerHTML.
   * @param {*} value
   * @returns {string}
   */
  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * Format seconds or milliseconds into human-readable duration (e.g. "2h 15m", "45m", "30s")
   * @param {number} seconds
   * @returns {string}
   */
  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (hrs === 0 && (secs > 0 || parts.length === 0)) parts.push(`${secs}s`);

    return parts.join(' ');
  },

  /**
   * Format seconds to HH:MM:SS or MM:SS
   */
  formatTimer(seconds) {
    if (!seconds || seconds <= 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num) => String(num).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  },

  /**
   * Get date key YYYY-MM-DD
   * @param {Date|string|number} [dateInput]
   */
  getDateKey(dateInput = new Date()) {
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Get month key YYYY-MM
   * @param {Date|string|number} [dateInput]
   */
  getMonthKey(dateInput = new Date()) {
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  },

  /**
   * Format date for display: "August 7, 2026"
   */
  formatFullDate(dateKeyStr) {
    const parts = (dateKeyStr || '').split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return dateKeyStr;
  },

  /**
   * Format Month for display: "August 2026"
   */
  formatMonthDisplay(monthKeyStr) {
    const parts = (monthKeyStr || '').split('-');
    if (parts.length === 2) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return monthKeyStr;
  },

  /**
   * Extract clean domain name from URL
   * @param {string} url 
   */
  getDomain(url) {
    if (!url) return 'Unknown';
    try {
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        return 'Chrome Internal';
      }
      const parsed = new URL(url);
      let hostname = parsed.hostname;
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      return hostname || 'Other';
    } catch (e) {
      return 'Other';
    }
  },

  /**
   * Get Category info (Label, Badge Color, Icon SVG path)
   */
  getCategoryMeta(categoryKey) {
    const categories = {
      'Development': {
        label: 'Development & Code',
        color: '#5F44E6', // Teak purple
        bgColor: '#EAE5FC',
        icon: 'code'
      },
      'Research': {
        label: 'Research & Docs',
        color: '#3E7A5E', // Sage green
        bgColor: '#DDEEE4',
        icon: 'book-open'
      },
      'Productivity': {
        label: 'Productivity & Work',
        color: '#A8871B', // Golden yellow
        bgColor: '#FDF1B0',
        icon: 'check-circle'
      },
      'Communication': {
        label: 'Communication & Email',
        color: '#C96A47', // Peach clay
        bgColor: '#FFD9CB',
        icon: 'message-square'
      },
      'Design': {
        label: 'Design & Creative',
        color: '#C2528F', // Rose pink
        bgColor: '#FFDCEF',
        icon: 'feather'
      },
      'Entertainment': {
        label: 'Media & Entertainment',
        color: '#B5485E', // Berry
        bgColor: '#FFE0E6',
        icon: 'film'
      },
      'Social': {
        label: 'Social & Community',
        color: '#3F6FB5', // Muted blue
        bgColor: '#DCE8F7',
        icon: 'users'
      },
      'News': {
        label: 'News & Reading',
        color: '#4E7D74', // Muted teal
        bgColor: '#DCEEE9',
        icon: 'newspaper'
      },
      'Shopping': {
        label: 'Shopping & E-Commerce',
        color: '#C06B2C', // Amber clay
        bgColor: '#FBE6D4',
        icon: 'shopping-bag'
      },
      'Other': {
        label: 'General Browsing',
        color: '#766E70', // Warm gray
        bgColor: '#F0F2EF',
        icon: 'globe'
      }
    };

    return categories[categoryKey] || categories['Other'];
  },

  /**
   * Categorize domain based on URL and title
   */
  categorizeActivity(url, title = '') {
    const domain = this.getDomain(url).toLowerCase();
    const lowerTitle = (title || '').toLowerCase();

    if (domain.includes('github') || domain.includes('gitlab') || domain.includes('stackoverflow') || 
        domain.includes('localhost') || domain.includes('codepen') || domain.includes('replit') ||
        domain.includes('npm') || domain.includes('developer.') || lowerTitle.includes('stack overflow')) {
      return 'Development';
    }

    if (domain.includes('figma') || domain.includes('dribbble') || domain.includes('behance') || 
        domain.includes('canva') || domain.includes('unsplash') || domain.includes('miro')) {
      return 'Design';
    }

    if (domain.includes('docs.google') || domain.includes('notion') || domain.includes('jira') || 
        domain.includes('trello') || domain.includes('asana') || domain.includes('linear') || 
        domain.includes('drive.google') || domain.includes('sheets.google')) {
      return 'Productivity';
    }

    if (domain.includes('gmail') || domain.includes('slack') || domain.includes('teams') || 
        domain.includes('outlook') || domain.includes('zoom') || domain.includes('discord')) {
      return 'Communication';
    }

    if (domain.includes('wikipedia') || domain.includes('arxiv') || domain.includes('medium') || 
        domain.includes('dev.to') || domain.includes('scholar.google') || domain.includes('docs.')) {
      return 'Research';
    }

    if (domain.includes('youtube') || domain.includes('netflix') || domain.includes('spotify') || 
        domain.includes('twitch') || domain.includes('hulu')) {
      return 'Entertainment';
    }

    if (domain.includes('twitter') || domain.includes('x.com') || domain.includes('reddit') || 
        domain.includes('linkedin') || domain.includes('facebook') || domain.includes('instagram')) {
      return 'Social';
    }

    if (domain.includes('nytimes') || domain.includes('bbc') || domain.includes('techcrunch') || 
        domain.includes('news') || domain.includes('hacker news')) {
      return 'News';
    }

    if (domain.includes('amazon') || domain.includes('ebay') || domain.includes('shopify') || 
        domain.includes('store')) {
      return 'Shopping';
    }

    return 'Other';
  },

  /**
   * How much each category counts toward the productivity score.
   *
   * These are a default opinion, not a fact about the user - reading news or
   * talking to colleagues is work for plenty of people. They are kept in one
   * place precisely so they can be overridden per user later without touching
   * the scoring maths.
   *
   * 'Other' sits at the midpoint deliberately: uncategorised time is unknown,
   * not unproductive, and scoring it as either extreme would be a guess.
   */
  CATEGORY_WEIGHTS: {
    'Development': 1.0,
    'Productivity': 1.0,
    'Research': 0.9,
    'Design': 0.9,
    'Communication': 0.6,
    'Other': 0.5,
    'News': 0.4,
    'Shopping': 0.2,
    'Entertainment': 0.1,
    'Social': 0.1
  },

  // Below this much tracked time, the mix is too small to mean anything - ten
  // minutes on one site would read as a perfect or terrible day. Report no
  // score rather than a confident-looking wrong one.
  MIN_SCORE_SECONDS: 600,

  /**
   * Weighted productivity score from the category mix, 0-100.
   *
   * @returns {number|null} null when there is not yet enough data to judge.
   */
  computeProductivityScore(categories) {
    const cats = categories || {};
    const names = Object.keys(cats);
    if (names.length === 0) return null;

    let weighted = 0;
    let total = 0;
    names.forEach((name) => {
      const seconds = Number(cats[name]) || 0;
      if (seconds <= 0) return;
      const weight = this.CATEGORY_WEIGHTS[name] !== undefined
        ? this.CATEGORY_WEIGHTS[name]
        : this.CATEGORY_WEIGHTS['Other'];
      weighted += weight * seconds;
      total += seconds;
    });

    if (total < this.MIN_SCORE_SECONDS) return null;
    return Math.round((weighted / total) * 100);
  },

  /**
   * Render a score for display, including the "not enough data yet" case.
   */
  formatScore(score, suffix = '/100') {
    return (score === null || score === undefined) ? '—' : `${score}${suffix}`;
  },

  // Sites where the page title or URL tends to carry the content itself -
  // an email subject, an account balance, a document of record. Time and
  // domain are still recorded; the specifics deliberately are not.
  SENSITIVE_DETAIL_DOMAINS: [
    'mail.google', 'outlook', 'mail.yahoo', 'proton.me', 'protonmail',
    'bank', 'paypal', 'chase', 'amex', 'wellsfargo', 'capitalone',
    'fidelity', 'schwab', 'mychart', 'healthcare'
  ],

  /**
   * Strip the site's own name off the end of a page title.
   * "Fix flush cap · Pull Request #12 · dan/tasker · GitHub" -> the useful part.
   */
  cleanTitle(title) {
    return String(title || '')
      .replace(/^\s*\(\d+\)\s*/, '')       // unread counters
      .replace(/\s*[-–—|·]\s*[^-–—|·]{1,24}$/, '') // trailing " - Site Name"
      .trim();
  },

  /**
   * Turn a path segment into something readable: "server-components" -> "Server components"
   */
  humanizeSegment(segment) {
    const text = decodeURIComponent(String(segment || ''))
      .replace(/\.(html?|php|aspx?)$/i, '')
      .replace(/[-_+]+/g, ' ')
      .trim();
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  /**
   * Describe what the user was actually doing on a page, from its URL and title.
   *
   * Everything here comes from data the `tabs` permission already provides - no
   * page content is ever read, so this adds detail without widening access.
   *
   * @returns {{action: string, label: string}} action is the verb bucket
   *   ("Searched", "Reviewed PR"), label is the specific thing.
   */
  describeActivity(url, title = '') {
    const domain = this.getDomain(url).toLowerCase();
    const cleaned = this.cleanTitle(title);
    const fallback = { action: 'Visited', label: cleaned || domain };

    if (this.SENSITIVE_DETAIL_DOMAINS.some(d => domain.includes(d))) {
      return { action: 'Visited', label: domain };
    }

    let path = '';
    let params = new URLSearchParams();
    try {
      const parsed = new URL(url);
      path = parsed.pathname || '';
      params = parsed.searchParams;
    } catch (e) {
      return fallback;
    }

    const seg = path.split('/').filter(Boolean);
    const trim = (value, max = 80) => String(value || '').substring(0, max).trim();

    // Search engines - the query is the activity
    const query = params.get('q') || params.get('query') || params.get('p');
    if (query && /google\.|bing\.|duckduckgo\.|search\.brave|ecosia\./.test(domain)) {
      return { action: 'Searched', label: trim(query) };
    }

    if (domain.includes('github.com') || domain.includes('gitlab.com')) {
      const repo = seg.length >= 2 ? `${seg[0]}/${seg[1]}` : null;
      const kind = seg[2] === '-' ? seg[3] : seg[2]; // GitLab nests under /-/
      const num = seg.find(s => /^\d+$/.test(s));
      if (repo && (kind === 'pull' || kind === 'merge_requests') && num) {
        return { action: 'Reviewed PR', label: `#${num} in ${repo}` };
      }
      if (repo && kind === 'issues' && num) {
        return { action: 'Issue', label: `#${num} in ${repo}` };
      }
      if (repo && (kind === 'commit' || kind === 'commits')) {
        return { action: 'Reviewed commits', label: repo };
      }
      if (repo && (kind === 'blob' || kind === 'tree')) {
        return { action: 'Read code', label: `${repo}${seg.length > 4 ? '/' + seg[seg.length - 1] : ''}` };
      }
      if (repo) return { action: 'Browsed repo', label: repo };
    }

    if (domain.includes('stackoverflow.com') || domain.includes('stackexchange.com')) {
      if (seg[0] === 'questions' && cleaned) {
        return { action: 'Read answer', label: trim(cleaned) };
      }
    }

    if (domain.includes('youtube.com') && path.startsWith('/watch')) {
      return { action: 'Watched', label: trim(cleaned) };
    }

    if (domain.includes('docs.google.com')) {
      const kinds = { document: 'Edited doc', spreadsheets: 'Edited sheet', presentation: 'Edited deck', forms: 'Edited form' };
      if (kinds[seg[0]]) return { action: kinds[seg[0]], label: trim(cleaned) };
    }

    if (domain.includes('atlassian.net') || domain.includes('jira')) {
      const ticket = seg.find(s => /^[A-Z][A-Z0-9]+-\d+$/.test(s));
      if (ticket) return { action: 'Worked ticket', label: ticket };
    }

    if (domain.includes('linear.app')) {
      const ticket = seg.find(s => /^[A-Z]+-\d+$/i.test(s));
      if (ticket) return { action: 'Worked ticket', label: ticket.toUpperCase() };
    }

    if (domain.includes('reddit.com') && seg[0] === 'r') {
      return { action: 'Read thread', label: seg[1] ? `r/${seg[1]}` : 'reddit' };
    }

    if (domain.includes('npmjs.com') && seg[0] === 'package') {
      return { action: 'Read package', label: seg.slice(1).join('/') };
    }

    if (domain.includes('notion.so') || domain.includes('notion.site')) {
      return { action: 'Wrote notes', label: trim(cleaned) || 'Notion' };
    }

    if (domain.includes('figma.com')) {
      return { action: 'Designed', label: trim(cleaned) || 'Figma' };
    }

    // Nothing site-specific matched. A real title beats a URL slug; a slug
    // beats nothing.
    if (cleaned) return { action: 'Read', label: trim(cleaned) };
    const lastSegment = this.humanizeSegment(seg[seg.length - 1]);
    if (lastSegment) return { action: 'Read', label: trim(lastSegment) };
    return fallback;
  },

  /**
   * Longest-first list of what the user actually did on a given day.
   *
   * Days recorded before the activity layer existed simply have no `activities`
   * map; they fall back to the flat page totals so old logs still render.
   */
  rankActivities(dayData, limit = 15) {
    const activities = (dayData && dayData.activities) || null;

    if (activities && Object.keys(activities).length > 0) {
      return Object.keys(activities)
        .map(key => activities[key])
        .filter(a => a && a.seconds > 0)
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, limit);
    }

    const pages = (dayData && dayData.pages) || {};
    return Object.keys(pages)
      .map(title => ({ action: 'Visited', label: title, domain: '', seconds: pages[title], visits: 1 }))
      .filter(a => a.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, limit);
  },

  /**
   * Generate Markdown for Daily Activity Log & Notes
   */
  generateDailyMarkdown(dateKey, dayData, highlights = [], notes = []) {
    const formattedDate = this.formatFullDate(dateKey);
    const totalTime = this.formatDuration(dayData.totalSeconds || 0);

    let md = `# 📝 Tasker Daily Activity Log - ${formattedDate}\n\n`;
    md += `**Date:** ${formattedDate}  \n`;
    md += `**Total Active Browsing Time:** ${totalTime}  \n`;
    md += `**Productivity Score:** ${this.formatScore(dayData.productivityScore)}  \n\n`;

    md += `--- \n\n`;
    md += `## 🌟 Key Accomplishments & Highlights\n`;
    if (highlights && highlights.length > 0) {
      highlights.forEach((item) => {
        md += `- **${item.title || item.category}**: ${item.description || item.detail}\n`;
      });
    } else {
      md += `*No manual highlights logged for today yet.*\n`;
    }
    md += `\n`;

    if (notes && notes.length > 0) {
      md += `## 📌 Custom Notes & Journal Entries\n`;
      notes.forEach((n) => {
        md += `- **[${n.time || 'Note'}]**: ${n.text}\n`;
      });
      md += `\n`;
    }

    md += `## 📊 Time Spent by Category\n`;
    const catStats = dayData.categories || {};
    Object.keys(catStats).sort((a,b) => catStats[b] - catStats[a]).forEach((cat) => {
      const meta = this.getCategoryMeta(cat);
      md += `- **${meta.label}**: ${this.formatDuration(catStats[cat])}\n`;
    });
    md += `\n`;

    md += `## 🔍 What You Worked On\n`;
    const activities = this.rankActivities(dayData, 15);
    if (activities.length > 0) {
      activities.forEach((a) => {
        const visits = a.visits > 1 ? ` _(${a.visits} visits)_` : '';
        md += `- **${a.action}:** ${a.label} — ${this.formatDuration(a.seconds)} on \`${a.domain}\`${visits}\n`;
      });
    } else {
      md += `*No detailed activity recorded for this day yet.*\n`;
    }
    md += `\n`;

    md += `## 🌐 Top Visited Domains\n`;
    const domains = dayData.domains || {};
    const topDomains = Object.keys(domains).sort((a,b) => domains[b] - domains[a]).slice(0, 10);
    topDomains.forEach((dom) => {
      md += `- \`${dom}\`: ${this.formatDuration(domains[dom])}\n`;
    });

    md += `\n\n*Generated automatically by Tasker Chrome Extension on ${new Date().toLocaleString()}*\n`;
    return md;
  },

  /**
   * Generate Markdown for Monthly Activity & Achievement Recap Report
   */
  generateMonthlyRecapMarkdown(monthKey, monthStats) {
    const monthDisplay = this.formatMonthDisplay(monthKey);
    
    let md = `# 🏆 Tasker Monthly Accomplishment Recap - ${monthDisplay}\n\n`;
    md += `> "Reflecting on your month of focused effort, learning, and web activity."\n\n`;
    md += `**Month:** ${monthDisplay}  \n`;
    md += `**Total Active Time:** ${this.formatDuration(monthStats.totalSeconds || 0)}  \n`;
    md += `**Days Tracked:** ${monthStats.daysTrackedCount || 0} days  \n`;
    md += `**Average Daily Focus:** ${this.formatDuration(monthStats.avgDailySeconds || 0)}  \n`;
    md += `**Overall Monthly Focus Score:** ${this.formatScore(monthStats.monthlyScore, '%')}  \n\n`;

    md += `---\n\n`;
    md += `## 🚀 Key Monthly Milestones & Achievements\n`;
    if (monthStats.milestones && monthStats.milestones.length > 0) {
      monthStats.milestones.forEach((m, idx) => {
        md += `${idx + 1}. **${m.title}** (${m.date || 'Achievement'}): ${m.description}\n`;
      });
    } else {
      md += `- Successfully completed high-focus research & browser workflows across ${monthStats.topCategory || 'Development'} and ${monthStats.secondCategory || 'Productivity'}.\n`;
      md += `- Maintained consistent daily activity tracking with peak focus achieved on ${monthStats.peakFocusDay || 'mid-month'}.\n`;
    }
    md += `\n`;

    md += `## 📈 Category Breakdown for ${monthDisplay}\n`;
    const cats = monthStats.categories || {};
    Object.keys(cats).sort((a, b) => cats[b] - cats[a]).forEach((cat) => {
      const meta = this.getCategoryMeta(cat);
      const percentage = monthStats.totalSeconds > 0 ? Math.round((cats[cat] / monthStats.totalSeconds) * 100) : 0;
      md += `- **${meta.label}**: ${this.formatDuration(cats[cat])} (${percentage}% of total time)\n`;
    });
    md += `\n`;

    md += `## 👑 Top 5 Most Used Platforms\n`;
    if (monthStats.topDomains && monthStats.topDomains.length > 0) {
      monthStats.topDomains.forEach((item, idx) => {
        md += `${idx + 1}. \`${item.domain}\`: ${this.formatDuration(item.seconds)}\n`;
      });
    }
    md += `\n`;

    md += `---\n`;
    md += `*Exported from Tasker Extension to Google Drive | ${new Date().toLocaleDateString()}*\n`;

    return md;
  },

  /**
   * Format Daily Log as a clean plain-text summary suitable for copying to clipboard
   */
  formatDailyLogForClipboard(dateKey, dayData, highlights = []) {
    const formattedDate = this.formatFullDate(dateKey);
    const totalTime = this.formatDuration(dayData.totalSeconds || 0);

    let text = `📊 Tasker Daily Summary (${formattedDate})\n`;
    text += `⏱️ Total Focus Time: ${totalTime} | Score: ${this.formatScore(dayData.productivityScore)}\n\n`;

    if (highlights && highlights.length > 0) {
      text += `🌟 Key Accomplishments:\n`;
      highlights.forEach(h => {
        text += `• ${h.title}\n`;
      });
      text += `\n`;
    }

    const catStats = dayData.categories || {};
    const catKeys = Object.keys(catStats).sort((a,b) => catStats[b] - catStats[a]);
    if (catKeys.length > 0) {
      text += `🎯 Top Categories:\n`;
      catKeys.slice(0, 3).forEach(c => {
        text += `• ${c}: ${this.formatDuration(catStats[c])}\n`;
      });
    }

    return text;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.Formatters = Formatters;
}
