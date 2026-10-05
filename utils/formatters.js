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
   * Display metadata for a category: label, colours, and the icon name.
   *
   * `icon` is a Material Symbols name from assets/icons/icons.js, so the same
   * key drives the popup pill, the dashboard chart legend and the PDF. Colours
   * match the --cat-* tokens in assets/design/tokens.css; when one changes,
   * both must change together.
   */
  getCategoryMeta(categoryKey) {
    const categories = {
      'Development': {
        label: 'Development & Code',
        color: '#5A3BE0',
        bgColor: '#EEEAFD',
        icon: 'code'
      },
      'AI': {
        label: 'AI Tools',
        color: '#7B4FD8',
        bgColor: '#F0E9FC',
        icon: 'smart_toy'
      },
      'Research': {
        label: 'Research & Docs',
        color: '#24735A',
        bgColor: '#E1F1E9',
        icon: 'menu_book'
      },
      'Education': {
        label: 'Learning & Courses',
        color: '#2C6E9B',
        bgColor: '#E2EEF6',
        icon: 'school'
      },
      'Productivity': {
        label: 'Productivity & Work',
        color: '#A8760F',
        bgColor: '#FBEFD6',
        icon: 'checklist'
      },
      'Communication': {
        label: 'Communication & Email',
        color: '#C05F3C',
        bgColor: '#FBE5DC',
        icon: 'forum'
      },
      'Design': {
        label: 'Design & Creative',
        color: '#B8478A',
        bgColor: '#FBE2F0',
        icon: 'design_services'
      },
      'Career': {
        label: 'Jobs & Career',
        color: '#7A5C3D',
        bgColor: '#F2EAE1',
        icon: 'work'
      },
      'Finance': {
        label: 'Finance & Admin',
        color: '#4E7A1F',
        bgColor: '#EAF2DE',
        icon: 'payments'
      },
      'News': {
        label: 'News & Reading',
        color: '#3F7A72',
        bgColor: '#DFEEEB',
        icon: 'newspaper'
      },
      'Social': {
        label: 'Social & Community',
        color: '#34659F',
        bgColor: '#E3ECF9',
        icon: 'groups'
      },
      'Health': {
        label: 'Health & Wellbeing',
        color: '#B04A6E',
        bgColor: '#FAE3EC',
        icon: 'stethoscope'
      },
      'Travel': {
        label: 'Travel & Local',
        color: '#0E8A8A',
        bgColor: '#DDF0F0',
        icon: 'flight'
      },
      'Shopping': {
        label: 'Shopping & E-Commerce',
        color: '#A9601F',
        bgColor: '#FAEADA',
        icon: 'shopping_bag'
      },
      'Entertainment': {
        label: 'Media & Games',
        color: '#A83C55',
        bgColor: '#FAE0E5',
        icon: 'movie'
      },
      'Other': {
        label: 'Unrecognised',
        color: '#6E6D69',
        bgColor: '#F1F1EE',
        icon: 'public'
      }
    };

    return categories[categoryKey] || categories['Other'];
  },

  /* ---------------------------------------------------------------------
     Site catalogue
     ---------------------------------------------------------------------
     Keyed by registrable domain and matched by exact host or parent suffix,
     so one entry covers every subdomain: 'google.com' would catch all of
     Google, which is why the Google properties that mean different things
     are listed individually and the bare domain is not listed at all.

     This is long on purpose. The previous version recognised about fifty
     sites and filed everything else under "Other", which on a real week meant
     four fifths of the day was reported as unrecognised - a tracker that
     cannot name where the time went is not telling you where the time went.

     Ordering is irrelevant to matching (it is a map, not a rule list); the
     grouping is for whoever edits it next.
     ------------------------------------------------------------------- */
  SITE_CATEGORIES: {
    // --- Development ---------------------------------------------------
    'github.com': 'Development', 'gitlab.com': 'Development', 'bitbucket.org': 'Development',
    'stackoverflow.com': 'Development', 'stackexchange.com': 'Development',
    'serverfault.com': 'Development', 'superuser.com': 'Development',
    'npmjs.com': 'Development', 'pypi.org': 'Development', 'crates.io': 'Development',
    'packagist.org': 'Development', 'rubygems.org': 'Development', 'nuget.org': 'Development',
    'maven.org': 'Development', 'mvnrepository.com': 'Development',
    'react.dev': 'Development', 'reactjs.org': 'Development', 'nextjs.org': 'Development',
    'vuejs.org': 'Development', 'nuxt.com': 'Development', 'svelte.dev': 'Development',
    'angular.dev': 'Development', 'angular.io': 'Development', 'solidjs.com': 'Development',
    'astro.build': 'Development', 'remix.run': 'Development', 'vitejs.dev': 'Development',
    'webpack.js.org': 'Development', 'tailwindcss.com': 'Development',
    'nodejs.org': 'Development', 'deno.com': 'Development', 'bun.sh': 'Development',
    'python.org': 'Development', 'go.dev': 'Development', 'rust-lang.org': 'Development',
    'java.com': 'Development', 'oracle.com': 'Development', 'kotlinlang.org': 'Development',
    'swift.org': 'Development', 'php.net': 'Development', 'ruby-lang.org': 'Development',
    'rubyonrails.org': 'Development', 'djangoproject.com': 'Development',
    'laravel.com': 'Development', 'spring.io': 'Development', 'nestjs.com': 'Development',
    'fastapi.tiangolo.com': 'Development', 'flask.palletsprojects.com': 'Development',
    'postgresql.org': 'Development', 'mysql.com': 'Development', 'sqlite.org': 'Development',
    'mongodb.com': 'Development', 'redis.io': 'Development', 'clickhouse.com': 'Development',
    'supabase.com': 'Development', 'planetscale.com': 'Development', 'neon.tech': 'Development',
    'prisma.io': 'Development', 'drizzle.team': 'Development',
    'docker.com': 'Development', 'kubernetes.io': 'Development', 'helm.sh': 'Development',
    'terraform.io': 'Development', 'hashicorp.com': 'Development', 'pulumi.com': 'Development',
    'ansible.com': 'Development', 'argoproj.github.io': 'Development',
    'vercel.com': 'Development', 'netlify.com': 'Development', 'render.com': 'Development',
    'fly.io': 'Development', 'railway.app': 'Development', 'heroku.com': 'Development',
    'digitalocean.com': 'Development', 'linode.com': 'Development', 'cloudflare.com': 'Development',
    'firebase.google.com': 'Development', 'console.aws.amazon.com': 'Development',
    'aws.amazon.com': 'Development', 'portal.azure.com': 'Development',
    'azure.microsoft.com': 'Development', 'console.cloud.google.com': 'Development',
    'cloud.google.com': 'Development',
    'sentry.io': 'Development', 'datadoghq.com': 'Development', 'grafana.com': 'Development',
    'newrelic.com': 'Development', 'pagerduty.com': 'Development', 'honeycomb.io': 'Development',
    'circleci.com': 'Development', 'travis-ci.com': 'Development', 'jenkins.io': 'Development',
    'sonarsource.com': 'Development', 'sonarqube.org': 'Development', 'snyk.io': 'Development',
    'postman.com': 'Development', 'swagger.io': 'Development', 'insomnia.rest': 'Development',
    'codepen.io': 'Development', 'jsfiddle.net': 'Development', 'codesandbox.io': 'Development',
    'stackblitz.com': 'Development', 'replit.com': 'Development', 'glitch.com': 'Development',
    'regex101.com': 'Development', 'regexr.com': 'Development', 'devdocs.io': 'Development',
    'caniuse.com': 'Development', 'jetbrains.com': 'Development',
    'code.visualstudio.com': 'Development', 'visualstudio.com': 'Development',
    'sourceforge.net': 'Development', 'apache.org': 'Development', 'gnu.org': 'Development',
    'kernel.org': 'Development', 'archlinux.org': 'Development', 'ubuntu.com': 'Development',
    'debian.org': 'Development', 'stackshare.io': 'Development', 'localhost': 'Development',
    'playwright.dev': 'Development', 'cypress.io': 'Development', 'selenium.dev': 'Development',
    'browserstack.com': 'Development', 'jestjs.io': 'Development', 'vitest.dev': 'Development',
    'developer.apple.com': 'Development', 'developer.android.com': 'Development',
    'reactnative.dev': 'Development', 'flutter.dev': 'Development', 'expo.dev': 'Development',
    'unity.com': 'Development', 'unrealengine.com': 'Development', 'godotengine.org': 'Development',
    'etherscan.io': 'Development', 'ethereum.org': 'Development', 'solana.com': 'Development',
    'alchemy.com': 'Development', 'hardhat.org': 'Development',
    'roadmap.sh': 'Development', 'refactoring.guru': 'Development', 'baeldung.com': 'Development',
    'geeksforgeeks.org': 'Development', 'w3schools.com': 'Development', 'freecodecamp.org': 'Development',
    'digitalocean.com/community': 'Development', 'css-tricks.com': 'Development',
    'smashingmagazine.com': 'Development', 'web.dev': 'Development', 'developers.google.com': 'Development',

    // --- AI ------------------------------------------------------------
    'chatgpt.com': 'AI', 'openai.com': 'AI', 'claude.ai': 'AI', 'anthropic.com': 'AI',
    'gemini.google.com': 'AI', 'aistudio.google.com': 'AI', 'ai.google.dev': 'AI',
    'perplexity.ai': 'AI', 'copilot.microsoft.com': 'AI', 'github.com/copilot': 'AI',
    'mistral.ai': 'AI', 'cohere.com': 'AI', 'deepseek.com': 'AI', 'x.ai': 'AI',
    'groq.com': 'AI', 'openrouter.ai': 'AI', 'together.ai': 'AI', 'fireworks.ai': 'AI',
    'huggingface.co': 'AI', 'replicate.com': 'AI', 'modal.com': 'AI', 'baseten.co': 'AI',
    'ollama.com': 'AI', 'lmstudio.ai': 'AI', 'vllm.ai': 'AI', 'runpod.io': 'AI',
    'langchain.com': 'AI', 'llamaindex.ai': 'AI', 'crewai.com': 'AI',
    'modelcontextprotocol.io': 'AI', 'langfuse.com': 'AI', 'braintrust.dev': 'AI',
    'promptfoo.dev': 'AI', 'ragas.io': 'AI', 'wandb.ai': 'AI', 'mlflow.org': 'AI',
    'pinecone.io': 'AI', 'weaviate.io': 'AI', 'qdrant.tech': 'AI', 'trychroma.com': 'AI',
    'pytorch.org': 'AI', 'tensorflow.org': 'AI', 'scikit-learn.org': 'AI', 'keras.io': 'AI',
    'midjourney.com': 'AI', 'runwayml.com': 'AI', 'elevenlabs.io': 'AI', 'suno.com': 'AI',
    'leonardo.ai': 'AI', 'ideogram.ai': 'AI', 'civitai.com': 'AI', 'stability.ai': 'AI',
    'cursor.com': 'AI', 'codeium.com': 'AI', 'tabnine.com': 'AI', 'v0.dev': 'AI',
    'lovable.dev': 'AI', 'bolt.new': 'AI', 'windsurf.com': 'AI', 'devin.ai': 'AI',
    'notebooklm.google.com': 'AI', 'poe.com': 'AI', 'character.ai': 'AI',
    'scale.com': 'AI', 'surgehq.ai': 'AI', 'labelbox.com': 'AI', 'argilla.io': 'AI',
    'paperswithcode.com': 'AI', 'openreview.net': 'AI', 'lesswrong.com': 'AI',
    'alignmentforum.org': 'AI', 'kaggle.com': 'AI', 'colab.research.google.com': 'AI',

    // --- Design --------------------------------------------------------
    'figma.com': 'Design', 'sketch.com': 'Design', 'framer.com': 'Design',
    'penpot.app': 'Design', 'invisionapp.com': 'Design', 'zeplin.io': 'Design',
    'dribbble.com': 'Design', 'behance.net': 'Design', 'awwwards.com': 'Design',
    'canva.com': 'Design', 'adobe.com': 'Design', 'affinity.serif.com': 'Design',
    'unsplash.com': 'Design', 'pexels.com': 'Design', 'pixabay.com': 'Design',
    'freepik.com': 'Design', 'flaticon.com': 'Design', 'thenounproject.com': 'Design',
    'fontawesome.com': 'Design', 'fonts.google.com': 'Design', 'fontshare.com': 'Design',
    'myfonts.com': 'Design', 'coolors.co': 'Design', 'colorhunt.co': 'Design',
    'miro.com': 'Design', 'excalidraw.com': 'Design', 'whimsical.com': 'Design',
    'lucidchart.com': 'Design', 'lottiefiles.com': 'Design', 'blender.org': 'Design',
    'shadcn.com': 'Design', 'ui.shadcn.com': 'Design', 'mui.com': 'Design',
    'chakra-ui.com': 'Design', 'storybook.js.org': 'Design', 'dovetail.com': 'Design',
    'maze.co': 'Design', 'usertesting.com': 'Design', 'hotjar.com': 'Design',

    // --- Productivity --------------------------------------------------
    'docs.google.com': 'Productivity', 'sheets.google.com': 'Productivity',
    'slides.google.com': 'Productivity', 'drive.google.com': 'Productivity',
    'keep.google.com': 'Productivity', 'forms.google.com': 'Productivity',
    'calendar.google.com': 'Productivity', 'office.com': 'Productivity',
    'sharepoint.com': 'Productivity', 'onedrive.live.com': 'Productivity',
    'notion.so': 'Productivity', 'notion.site': 'Productivity', 'coda.io': 'Productivity',
    'airtable.com': 'Productivity', 'obsidian.md': 'Productivity', 'evernote.com': 'Productivity',
    'roamresearch.com': 'Productivity', 'logseq.com': 'Productivity', 'craft.do': 'Productivity',
    'atlassian.net': 'Productivity', 'atlassian.com': 'Productivity', 'jira.com': 'Productivity',
    'confluence.com': 'Productivity', 'trello.com': 'Productivity', 'asana.com': 'Productivity',
    'linear.app': 'Productivity', 'monday.com': 'Productivity', 'clickup.com': 'Productivity',
    'basecamp.com': 'Productivity', 'shortcut.com': 'Productivity', 'height.app': 'Productivity',
    'smartsheet.com': 'Productivity', 'wrike.com': 'Productivity', 'productboard.com': 'Productivity',
    'todoist.com': 'Productivity', 'ticktick.com': 'Productivity', 'things.app': 'Productivity',
    'calendly.com': 'Productivity', 'cal.com': 'Productivity', 'doodle.com': 'Productivity',
    'dropbox.com': 'Productivity', 'box.com': 'Productivity', 'wetransfer.com': 'Productivity',
    'zapier.com': 'Productivity', 'make.com': 'Productivity', 'n8n.io': 'Productivity',
    'ifttt.com': 'Productivity', 'retool.com': 'Productivity',
    'salesforce.com': 'Productivity', 'hubspot.com': 'Productivity', 'pipedrive.com': 'Productivity',
    'zoho.com': 'Productivity', 'zendesk.com': 'Productivity', 'intercom.com': 'Productivity',
    'freshdesk.com': 'Productivity', 'helpscout.com': 'Productivity', 'front.com': 'Productivity',
    'docusign.com': 'Productivity', 'pandadoc.com': 'Productivity', 'dropbox.com/sign': 'Productivity',
    'grammarly.com': 'Productivity', 'deepl.com': 'Productivity', 'translate.google.com': 'Productivity',
    'ilovepdf.com': 'Productivity', 'smallpdf.com': 'Productivity', 'pdf24.org': 'Productivity',
    'tinypng.com': 'Productivity', 'cloudconvert.com': 'Productivity', 'remove.bg': 'Productivity',
    'amplitude.com': 'Productivity', 'mixpanel.com': 'Productivity', 'posthog.com': 'Productivity',
    'analytics.google.com': 'Productivity', 'looker.com': 'Productivity', 'tableau.com': 'Productivity',
    'powerbi.microsoft.com': 'Productivity', 'metabase.com': 'Productivity',
    'snowflake.com': 'Productivity', 'databricks.com': 'Productivity', 'getdbt.com': 'Productivity',
    'search.google.com': 'Productivity', 'ahrefs.com': 'Productivity', 'semrush.com': 'Productivity',
    'mailchimp.com': 'Productivity', 'klaviyo.com': 'Productivity', 'beehiiv.com': 'Productivity',
    'typeform.com': 'Productivity', 'surveymonkey.com': 'Productivity', 'jotform.com': 'Productivity',
    'bamboohr.com': 'Productivity', 'rippling.com': 'Productivity', 'gusto.com': 'Productivity',
    'deel.com': 'Productivity', 'vanta.com': 'Productivity', 'drata.com': 'Productivity',

    // --- Communication -------------------------------------------------
    'mail.google.com': 'Communication', 'gmail.com': 'Communication',
    'outlook.com': 'Communication', 'outlook.office.com': 'Communication',
    'outlook.live.com': 'Communication', 'mail.yahoo.com': 'Communication',
    'proton.me': 'Communication', 'protonmail.com': 'Communication',
    'fastmail.com': 'Communication', 'hey.com': 'Communication', 'zoho.com/mail': 'Communication',
    'slack.com': 'Communication', 'teams.microsoft.com': 'Communication',
    'discord.com': 'Communication', 'telegram.org': 'Communication', 'web.telegram.org': 'Communication',
    'whatsapp.com': 'Communication', 'web.whatsapp.com': 'Communication',
    'signal.org': 'Communication', 'messenger.com': 'Communication',
    'zoom.us': 'Communication', 'meet.google.com': 'Communication', 'webex.com': 'Communication',
    'gotomeeting.com': 'Communication', 'skype.com': 'Communication', 'whereby.com': 'Communication',
    'loom.com': 'Communication', 'around.co': 'Communication', 'gather.town': 'Communication',

    // --- Research ------------------------------------------------------
    'wikipedia.org': 'Research', 'wikimedia.org': 'Research', 'wiktionary.org': 'Research',
    'arxiv.org': 'Research', 'biorxiv.org': 'Research', 'ssrn.com': 'Research',
    'scholar.google.com': 'Research', 'semanticscholar.org': 'Research',
    'researchgate.net': 'Research', 'academia.edu': 'Research', 'jstor.org': 'Research',
    'sciencedirect.com': 'Research', 'springer.com': 'Research', 'nature.com': 'Research',
    'science.org': 'Research', 'plos.org': 'Research', 'ieee.org': 'Research',
    'acm.org': 'Research', 'pubmed.ncbi.nlm.nih.gov': 'Research', 'ncbi.nlm.nih.gov': 'Research',
    'britannica.com': 'Research', 'wolframalpha.com': 'Research', 'archive.org': 'Research',
    'ourworldindata.org': 'Research', 'statista.com': 'Research', 'data.gov': 'Research',
    'census.gov': 'Research', 'worldbank.org': 'Research', 'oecd.org': 'Research',
    'dictionary.com': 'Research', 'merriam-webster.com': 'Research', 'thesaurus.com': 'Research',
    'gov.uk': 'Research', 'usa.gov': 'Research', 'europa.eu': 'Research',
    'readthedocs.io': 'Research', 'gitbook.io': 'Research', 'stackoverflow.blog': 'Research',

    // --- Education -----------------------------------------------------
    'coursera.org': 'Education', 'udemy.com': 'Education', 'edx.org': 'Education',
    'khanacademy.org': 'Education', 'udacity.com': 'Education', 'skillshare.com': 'Education',
    'pluralsight.com': 'Education', 'linkedin.com/learning': 'Education',
    'frontendmasters.com': 'Education', 'egghead.io': 'Education', 'codecademy.com': 'Education',
    'datacamp.com': 'Education', 'brilliant.org': 'Education', 'duolingo.com': 'Education',
    'busuu.com': 'Education', 'babbel.com': 'Education', 'memrise.com': 'Education',
    'anki.net': 'Education', 'ankiweb.net': 'Education', 'quizlet.com': 'Education',
    'leetcode.com': 'Education', 'hackerrank.com': 'Education', 'codewars.com': 'Education',
    'exercism.org': 'Education', 'advent-of-code.com': 'Education', 'adventofcode.com': 'Education',
    'classroom.google.com': 'Education', 'instructure.com': 'Education',
    'blackboard.com': 'Education', 'moodle.org': 'Education', 'canvas.net': 'Education',
    'gradescope.com': 'Education', 'chegg.com': 'Education', 'coursehero.com': 'Education',
    'openstax.org': 'Education', 'ted.com': 'Education', 'masterclass.com': 'Education',
    'scrimba.com': 'Education', 'educative.io': 'Education', 'oreilly.com': 'Education',

    // --- News ----------------------------------------------------------
    'nytimes.com': 'News', 'washingtonpost.com': 'News', 'wsj.com': 'News',
    'theguardian.com': 'News', 'bbc.co.uk': 'News', 'bbc.com': 'News',
    'reuters.com': 'News', 'apnews.com': 'News', 'cnn.com': 'News', 'nbcnews.com': 'News',
    'cbsnews.com': 'News', 'abcnews.go.com': 'News', 'foxnews.com': 'News',
    'npr.org': 'News', 'aljazeera.com': 'News', 'dw.com': 'News', 'france24.com': 'News',
    'economist.com': 'News', 'ft.com': 'News', 'bloomberg.com': 'News',
    'politico.com': 'News', 'axios.com': 'News', 'thehill.com': 'News',
    'techcrunch.com': 'News', 'theverge.com': 'News', 'arstechnica.com': 'News',
    'wired.com': 'News', 'engadget.com': 'News', 'zdnet.com': 'News', 'cnet.com': 'News',
    'venturebeat.com': 'News', 'theinformation.com': 'News', 'news.ycombinator.com': 'News',
    'slashdot.org': 'News', 'lobste.rs': 'News', 'techmeme.com': 'News',
    'punchng.com': 'News', 'vanguardngr.com': 'News', 'premiumtimesng.com': 'News',
    'independent.co.uk': 'News', 'telegraph.co.uk': 'News', 'thetimes.co.uk': 'News',
    'newsweek.com': 'News', 'time.com': 'News', 'theatlantic.com': 'News',
    'newyorker.com': 'News', 'vox.com': 'News', 'businessinsider.com': 'News',
    'forbes.com': 'News', 'fortune.com': 'News', 'cnbc.com': 'News',

    // --- Social --------------------------------------------------------
    'x.com': 'Social', 'twitter.com': 'Social', 'reddit.com': 'Social',
    'linkedin.com': 'Social', 'facebook.com': 'Social', 'instagram.com': 'Social',
    'tiktok.com': 'Social', 'threads.net': 'Social', 'threads.com': 'Social',
    'bsky.app': 'Social', 'mastodon.social': 'Social', 'pinterest.com': 'Social',
    'tumblr.com': 'Social', 'snapchat.com': 'Social', 'quora.com': 'Social',
    'nextdoor.com': 'Social', 'meetup.com': 'Social', 'discourse.org': 'Social',
    'nairaland.com': 'Social', 'vk.com': 'Social', 'weibo.com': 'Social',
    'medium.com': 'Social', 'substack.com': 'Social', 'dev.to': 'Social',
    'hashnode.com': 'Social', 'producthunt.com': 'Social', 'indiehackers.com': 'Social',

    // --- Entertainment (media and games) --------------------------------
    'youtube.com': 'Entertainment', 'youtu.be': 'Entertainment', 'netflix.com': 'Entertainment',
    'spotify.com': 'Entertainment', 'twitch.tv': 'Entertainment', 'hulu.com': 'Entertainment',
    'disneyplus.com': 'Entertainment', 'primevideo.com': 'Entertainment', 'max.com': 'Entertainment',
    'hbomax.com': 'Entertainment', 'paramountplus.com': 'Entertainment', 'peacocktv.com': 'Entertainment',
    'appletv.com': 'Entertainment', 'crunchyroll.com': 'Entertainment', 'vimeo.com': 'Entertainment',
    'dailymotion.com': 'Entertainment', 'soundcloud.com': 'Entertainment',
    'music.apple.com': 'Entertainment', 'music.youtube.com': 'Entertainment',
    'bandcamp.com': 'Entertainment', 'tidal.com': 'Entertainment', 'deezer.com': 'Entertainment',
    'audible.com': 'Entertainment', 'imdb.com': 'Entertainment', 'letterboxd.com': 'Entertainment',
    'rottentomatoes.com': 'Entertainment', 'goodreads.com': 'Entertainment',
    'steampowered.com': 'Entertainment', 'steamcommunity.com': 'Entertainment',
    'epicgames.com': 'Entertainment', 'gog.com': 'Entertainment', 'itch.io': 'Entertainment',
    'roblox.com': 'Entertainment', 'minecraft.net': 'Entertainment', 'ea.com': 'Entertainment',
    'playstation.com': 'Entertainment', 'xbox.com': 'Entertainment', 'nintendo.com': 'Entertainment',
    'chess.com': 'Entertainment', 'lichess.org': 'Entertainment', 'ign.com': 'Entertainment',
    'gamespot.com': 'Entertainment', 'polygon.com': 'Entertainment', 'kotaku.com': 'Entertainment',
    'espn.com': 'Entertainment', 'skysports.com': 'Entertainment', 'bbc.co.uk/sport': 'Entertainment',
    'fifa.com': 'Entertainment', 'nba.com': 'Entertainment', 'premierleague.com': 'Entertainment',
    'ninegag.com': 'Entertainment', '9gag.com': 'Entertainment', 'giphy.com': 'Entertainment',

    // --- Shopping ------------------------------------------------------
    'amazon.com': 'Shopping', 'amazon.co.uk': 'Shopping', 'ebay.com': 'Shopping',
    'etsy.com': 'Shopping', 'aliexpress.com': 'Shopping', 'alibaba.com': 'Shopping',
    'temu.com': 'Shopping', 'shein.com': 'Shopping', 'walmart.com': 'Shopping',
    'target.com': 'Shopping', 'bestbuy.com': 'Shopping', 'costco.com': 'Shopping',
    'ikea.com': 'Shopping', 'wayfair.com': 'Shopping', 'homedepot.com': 'Shopping',
    'asos.com': 'Shopping', 'zalando.com': 'Shopping', 'zara.com': 'Shopping',
    'hm.com': 'Shopping', 'uniqlo.com': 'Shopping', 'nike.com': 'Shopping',
    'adidas.com': 'Shopping', 'argos.co.uk': 'Shopping', 'johnlewis.com': 'Shopping',
    'currys.co.uk': 'Shopping', 'jumia.com.ng': 'Shopping', 'konga.com': 'Shopping',
    'shopify.com': 'Shopping', 'woocommerce.com': 'Shopping', 'gumtree.com': 'Shopping',
    'craigslist.org': 'Shopping', 'vinted.com': 'Shopping', 'depop.com': 'Shopping',
    'newegg.com': 'Shopping', 'flipkart.com': 'Shopping', 'mercadolibre.com': 'Shopping',

    // --- Finance -------------------------------------------------------
    'paypal.com': 'Finance', 'wise.com': 'Finance', 'revolut.com': 'Finance',
    'monzo.com': 'Finance', 'starlingbank.com': 'Finance', 'n26.com': 'Finance',
    'chase.com': 'Finance', 'bankofamerica.com': 'Finance', 'wellsfargo.com': 'Finance',
    'citi.com': 'Finance', 'capitalone.com': 'Finance', 'americanexpress.com': 'Finance',
    'hsbc.com': 'Finance', 'barclays.co.uk': 'Finance', 'lloydsbank.com': 'Finance',
    'natwest.com': 'Finance', 'santander.com': 'Finance', 'nationwide.co.uk': 'Finance',
    'gtbank.com': 'Finance', 'zenithbank.com': 'Finance', 'accessbankplc.com': 'Finance',
    'kuda.com': 'Finance', 'opayweb.com': 'Finance', 'flutterwave.com': 'Finance',
    'paystack.com': 'Finance', 'stripe.com': 'Finance', 'squareup.com': 'Finance',
    'venmo.com': 'Finance', 'cash.app': 'Finance', 'remitly.com': 'Finance',
    'coinbase.com': 'Finance', 'binance.com': 'Finance', 'kraken.com': 'Finance',
    'crypto.com': 'Finance', 'blockchain.com': 'Finance', 'metamask.io': 'Finance',
    'robinhood.com': 'Finance', 'fidelity.com': 'Finance', 'vanguard.com': 'Finance',
    'schwab.com': 'Finance', 'etrade.com': 'Finance', 'interactivebrokers.com': 'Finance',
    'wealthfront.com': 'Finance', 'betterment.com': 'Finance', 'trading212.com': 'Finance',
    'quickbooks.intuit.com': 'Finance', 'intuit.com': 'Finance', 'xero.com': 'Finance',
    'freshbooks.com': 'Finance', 'waveapps.com': 'Finance', 'wave.com': 'Finance',
    'bill.com': 'Finance', 'ramp.com': 'Finance', 'brex.com': 'Finance',
    'expensify.com': 'Finance', 'netsuite.com': 'Finance', 'sage.com': 'Finance',
    'irs.gov': 'Finance', 'hmrc.gov.uk': 'Finance', 'turbotax.intuit.com': 'Finance',
    'marketwatch.com': 'Finance', 'investopedia.com': 'Finance', 'morningstar.com': 'Finance',
    'nerdwallet.com': 'Finance', 'creditkarma.com': 'Finance', 'tradingview.com': 'Finance',
    'yahoo.com/finance': 'Finance', 'finance.yahoo.com': 'Finance', 'coinmarketcap.com': 'Finance',

    // --- Health --------------------------------------------------------
    'webmd.com': 'Health', 'mayoclinic.org': 'Health', 'healthline.com': 'Health',
    'nhs.uk': 'Health', 'cdc.gov': 'Health', 'who.int': 'Health', 'nih.gov': 'Health',
    'medlineplus.gov': 'Health', 'drugs.com': 'Health', 'goodrx.com': 'Health',
    'zocdoc.com': 'Health', 'patient.info': 'Health', 'medscape.com': 'Health',
    'uptodate.com': 'Health', 'mychart.com': 'Health', 'teladoc.com': 'Health',
    'myfitnesspal.com': 'Health', 'strava.com': 'Health', 'fitbit.com': 'Health',
    'garmin.com': 'Health', 'peloton.com': 'Health', 'whoop.com': 'Health',
    'headspace.com': 'Health', 'calm.com': 'Health', 'betterhelp.com': 'Health',
    'sleepfoundation.org': 'Health', 'nutrition.gov': 'Health', 'examine.com': 'Health',

    // --- Travel & local ------------------------------------------------
    'booking.com': 'Travel', 'airbnb.com': 'Travel', 'expedia.com': 'Travel',
    'hotels.com': 'Travel', 'agoda.com': 'Travel', 'trivago.com': 'Travel',
    'skyscanner.net': 'Travel', 'kayak.com': 'Travel', 'momondo.com': 'Travel',
    'google.com/travel': 'Travel', 'tripadvisor.com': 'Travel', 'lonelyplanet.com': 'Travel',
    'maps.google.com': 'Travel', 'openstreetmap.org': 'Travel', 'waze.com': 'Travel',
    'citymapper.com': 'Travel', 'rome2rio.com': 'Travel', 'trainline.com': 'Travel',
    'nationalrail.co.uk': 'Travel', 'tfl.gov.uk': 'Travel', 'uber.com': 'Travel',
    'lyft.com': 'Travel', 'bolt.eu': 'Travel', 'ryanair.com': 'Travel',
    'easyjet.com': 'Travel', 'britishairways.com': 'Travel', 'united.com': 'Travel',
    'delta.com': 'Travel', 'emirates.com': 'Travel', 'lufthansa.com': 'Travel',
    'flightradar24.com': 'Travel', 'seatguru.com': 'Travel', 'gov.uk/visas': 'Travel',
    'yelp.com': 'Travel', 'opentable.com': 'Travel', 'zillow.com': 'Travel',
    'rightmove.co.uk': 'Travel', 'zoopla.co.uk': 'Travel', 'realtor.com': 'Travel',

    // --- Career --------------------------------------------------------
    'indeed.com': 'Career', 'glassdoor.com': 'Career', 'monster.com': 'Career',
    'ziprecruiter.com': 'Career', 'wellfound.com': 'Career', 'angel.co': 'Career',
    'otta.com': 'Career', 'welcometothejungle.com': 'Career', 'seek.com.au': 'Career',
    'totaljobs.com': 'Career', 'reed.co.uk': 'Career', 'cv-library.co.uk': 'Career',
    'greenhouse.io': 'Career', 'lever.co': 'Career', 'ashbyhq.com': 'Career',
    'workable.com': 'Career', 'smartrecruiters.com': 'Career', 'teamtailor.com': 'Career',
    'jobvite.com': 'Career', 'workday.com': 'Career', 'myworkdayjobs.com': 'Career',
    'levels.fyi': 'Career', 'blind.com': 'Career', 'teamblind.com': 'Career',
    'upwork.com': 'Career', 'fiverr.com': 'Career', 'toptal.com': 'Career',
    'freelancer.com': 'Career', 'contra.com': 'Career', 'remoteok.com': 'Career',
    'weworkremotely.com': 'Career', 'hnhiring.com': 'Career', 'resume.io': 'Career',
    'novoresume.com': 'Career', 'canva.com/resumes': 'Career',

    // --- Reference utilities -------------------------------------------
    // Small single-purpose tools. They are nobody's job, but they are not
    // unrecognised either, and "Other" should mean genuinely unknown.
    'timeanddate.com': 'Productivity', 'worldtimebuddy.com': 'Productivity',
    'calculator.net': 'Productivity', 'speedtest.net': 'Productivity',
    'whois.com': 'Development', 'unicode.org': 'Development',
    'emojipedia.org': 'Design', 'random.org': 'Development',
    'jsonformatter.org': 'Development', 'base64decode.org': 'Development',
    'crontab.guru': 'Development', 'explainshell.com': 'Development',
    'downdetector.com': 'Development', 'ipinfo.io': 'Development',
    'crunchbase.com': 'Research', 'ycombinator.com': 'Research',
    'similarweb.com': 'Research', 'builtwith.com': 'Research',
    'eventbrite.com': 'Social', 'lu.ma': 'Social',
    'allrecipes.com': 'Health', 'bbcgoodfood.com': 'Health', 'seriouseats.com': 'Health',
    'weather.com': 'Research', 'accuweather.com': 'Research', 'met.gov.uk': 'Research',
    'metoffice.gov.uk': 'Research',

    // --- Developer tooling & infrastructure SaaS ------------------------
    'sourcegraph.com': 'Development', 'raycast.com': 'Development', 'warp.dev': 'Development',
    'zed.dev': 'Development', 'linear.dev': 'Development', 'koyeb.com': 'Development',
    'porter.run': 'Development', 'encore.dev': 'Development', 'trigger.dev': 'Development',
    'inngest.com': 'Development', 'temporal.io': 'Development', 'nats.io': 'Development',
    'rabbitmq.com': 'Development', 'kafka.apache.org': 'Development', 'celeryq.dev': 'Development',
    'auth0.com': 'Development', 'okta.com': 'Development', 'clerk.com': 'Development',
    'workos.com': 'Development', 'logto.io': 'Development', 'keycloak.org': 'Development',
    'twilio.com': 'Development', 'sendgrid.com': 'Development', 'resend.com': 'Development',
    'postmarkapp.com': 'Development', 'mailgun.com': 'Development', 'vonage.com': 'Development',
    'contentful.com': 'Development', 'sanity.io': 'Development', 'strapi.io': 'Development',
    'payloadcms.com': 'Development', 'directus.io': 'Development', 'storyblok.com': 'Development',
    'wordpress.org': 'Development', 'webflow.com': 'Design', 'wix.com': 'Design',
    'squarespace.com': 'Design', 'ghost.org': 'Development',
    'algolia.com': 'Development', 'typesense.org': 'Development', 'meilisearch.com': 'Development',
    'elastic.co': 'Development', 'opensearch.org': 'Development',
    'launchdarkly.com': 'Development', 'statsig.com': 'Development', 'split.io': 'Development',
    'optimizely.com': 'Development', 'unleash.io': 'Development',
    'bugsnag.com': 'Development', 'rollbar.com': 'Development', 'logrocket.com': 'Development',
    'betterstack.com': 'Development', 'uptimerobot.com': 'Development',
    'downdetector.com': 'Development', 'pcpartpicker.com': 'Development',
    'lucid.co': 'Productivity', 'dbdiagram.io': 'Development', 'drawsql.app': 'Development',

    // --- Billing, fintech, money ---------------------------------------
    'lemonsqueezy.com': 'Finance', 'paddle.com': 'Finance', 'chargebee.com': 'Finance',
    'recurly.com': 'Finance', 'polar.sh': 'Finance', 'gumroad.com': 'Finance',
    'mercury.com': 'Finance', 'wealthsimple.com': 'Finance', 'trade-republic.com': 'Finance',
    'freetrade.io': 'Finance', 'plaid.com': 'Finance', 'adyen.com': 'Finance',
    'klarna.com': 'Finance', 'afterpay.com': 'Finance', 'sumup.com': 'Finance',

    // --- People, HR, hiring ---------------------------------------------
    'lattice.com': 'Productivity', 'culture-amp.com': 'Productivity',
    '15five.com': 'Productivity', 'leapsome.com': 'Productivity', 'personio.com': 'Productivity',
    'hibob.com': 'Productivity', 'justworks.com': 'Productivity',
    'hired.com': 'Career', 'triplebyte.com': 'Career', 'guru.com': 'Career',
    'peopleperhour.com': 'Career', 'arc.dev': 'Career', 'dice.com': 'Career',
    'builtin.com': 'Career', 'jobscan.co': 'Career',

    // --- Community & events ---------------------------------------------
    'skool.com': 'Social', 'mighty-networks.com': 'Social', 'slack-community.com': 'Social',
    'lu.ma/events': 'Social', 'seatgeek.com': 'Entertainment', 'stubhub.com': 'Entertainment',
    'viagogo.com': 'Entertainment', 'ticketmaster.com': 'Entertainment',
    'bandsintown.com': 'Entertainment', 'songkick.com': 'Entertainment',

    // --- Music, film, games media ---------------------------------------
    'last.fm': 'Entertainment', 'mixcloud.com': 'Entertainment', 'sofar.fm': 'Entertainment',
    'discogs.com': 'Entertainment', 'genius.com': 'Entertainment',
    'backloggd.com': 'Entertainment', 'howlongtobeat.com': 'Entertainment',
    'opencritic.com': 'Entertainment', 'metacritic.com': 'Entertainment',
    'speedrun.com': 'Entertainment', 'trueachievements.com': 'Entertainment',

    // --- Travel, property, local ----------------------------------------
    'omio.com': 'Travel', 'busbud.com': 'Travel', 'flixbus.com': 'Travel',
    'getyourguide.com': 'Travel', 'viator.com': 'Travel', 'hostelworld.com': 'Travel',
    'vrbo.com': 'Travel', 'houzz.com': 'Travel', 'apartments.com': 'Travel',
    'idealista.com': 'Travel', 'seloger.com': 'Travel', 'immobilienscout24.de': 'Travel',
    'onthemarket.com': 'Travel', 'purplebricks.co.uk': 'Travel',

    // --- Health, fitness, medical ---------------------------------------
    'noom.com': 'Health', 'cronometer.com': 'Health', 'hevyapp.com': 'Health',
    'strong.app': 'Health', 'nike.com/run-club': 'Health', 'osmosis.org': 'Health',
    'amboss.com': 'Health', 'geekymedics.com': 'Health', 'bmj.com': 'Health',
    'thelancet.com': 'Health', 'nutritionfacts.org': 'Health', 'eatthismuch.com': 'Health',

    // --- Learning ---------------------------------------------------------
    'outschool.com': 'Education', 'preply.com': 'Education', 'italki.com': 'Education',
    'wyzant.com': 'Education', 'varsitytutors.com': 'Education', 'mathway.com': 'Education',
    'symbolab.com': 'Education', 'desmos.com': 'Education', 'geogebra.org': 'Education',
    'sparknotes.com': 'Education', 'studysmarter.co.uk': 'Education',

    // --- Journalism, science writing, reviews -----------------------------
    'sciencedaily.com': 'News', 'phys.org': 'News', 'quantamagazine.org': 'News',
    'undark.org': 'News', 'nautil.us': 'News', 'aeon.co': 'News',
    'poynter.org': 'News', 'niemanlab.org': 'News', 'pressgazette.co.uk': 'News',
    'wirecutter.com': 'Shopping', 'rtings.com': 'Shopping',
    'camelcamelcamel.com': 'Shopping', 'trustpilot.com': 'Shopping',
    'which.co.uk': 'Shopping', 'consumerreports.org': 'Shopping'
  },

  /* ---------------------------------------------------------------------
     Fallbacks, tried in order once the catalogue misses.

     Each is a genuine signal rather than a guess: a hostname that starts
     with "docs." really is documentation, a .edu really is a university.
     They exist so an unlisted site still lands somewhere truthful, because
     a catalogue can never be complete - there is always another SaaS tool.
     ------------------------------------------------------------------- */
  HOST_PREFIX_RULES: [
    ['docs.', 'Research'], ['developer.', 'Development'], ['developers.', 'Development'],
    ['dev.', 'Development'], ['api.', 'Development'], ['git.', 'Development'],
    ['jenkins.', 'Development'], ['ci.', 'Development'], ['status.', 'Development'],
    ['mail.', 'Communication'], ['webmail.', 'Communication'], ['chat.', 'Communication'],
    ['meet.', 'Communication'], ['calendar.', 'Productivity'], ['drive.', 'Productivity'],
    ['admin.', 'Productivity'], ['dashboard.', 'Productivity'], ['app.', 'Productivity'],
    ['portal.', 'Productivity'], ['support.', 'Productivity'], ['help.', 'Productivity'],
    ['careers.', 'Career'], ['jobs.', 'Career'], ['boards.', 'Career'],
    ['shop.', 'Shopping'], ['store.', 'Shopping'], ['checkout.', 'Shopping'],
    ['news.', 'News'], ['blog.', 'News'], ['learn.', 'Education'],
    ['academy.', 'Education'], ['school.', 'Education'], ['library.', 'Research'],
    ['bank.', 'Finance'], ['pay.', 'Finance'], ['billing.', 'Finance'],
    ['health.', 'Health'], ['maps.', 'Travel'], ['music.', 'Entertainment'],
    ['play.', 'Entertainment'], ['video.', 'Entertainment'], ['tv.', 'Entertainment']
  ],

  // Suffixes you have to earn: a registrar will not sell you .edu or .gov, and
  // .bank requires verification. These outrank a page title.
  STRONG_SUFFIX_RULES: [
    ['.edu', 'Education'], ['.ac.uk', 'Education'], ['.edu.au', 'Education'],
    ['.edu.ng', 'Education'], ['.ac.jp', 'Education'], ['.sch.uk', 'Education'],
    ['.gov', 'Research'], ['.gov.uk', 'Research'], ['.gov.ng', 'Research'],
    ['.mil', 'Research'], ['.int', 'Research'],
    ['.bank', 'Finance'], ['.insurance', 'Finance'], ['.travel', 'Travel'],
    ['.pharmacy', 'Health']
  ],

  // Suffixes anyone can buy, chosen for what they suggest rather than what
  // they prove. Tried only after the page title, which is better evidence.
  //
  // .io and .sh are deliberately absent. They read as "developer" but are now
  // the default TLD for any startup - a board-game review site and an AI video
  // tool both sit on .io - so treating them as Development mislabels a whole
  // class of site with false confidence.
  WEAK_SUFFIX_RULES: [
    ['.dev', 'Development'], ['.app', 'Productivity'],
    ['.shop', 'Shopping'], ['.store', 'Shopping'],
    ['.news', 'News'], ['.blog', 'News'],
    ['.tv', 'Entertainment'], ['.game', 'Entertainment'], ['.games', 'Entertainment']
  ],

  // Words that carry a category wherever they appear in a hostname. Kept
  // narrow and unambiguous: "bank" is worth matching, "app" is not.
  HOST_KEYWORD_RULES: [
    ['recruit', 'Career'], ['hiring', 'Career'], ['careers', 'Career'],
    ['bank', 'Finance'], ['invoice', 'Finance'], ['payroll', 'Finance'],
    ['tax', 'Finance'], ['crypto', 'Finance'], ['wallet', 'Finance'],
    ['clinic', 'Health'], ['hospital', 'Health'], ['pharmacy', 'Health'],
    ['medical', 'Health'], ['doctor', 'Health'], ['dental', 'Health'],
    ['fitness', 'Health'], ['university', 'Education'], ['college', 'Education'],
    ['course', 'Education'], ['tutorial', 'Education'], ['hotel', 'Travel'],
    ['flight', 'Travel'], ['airline', 'Travel'], ['airport', 'Travel'],
    ['travel', 'Travel'], ['booking', 'Travel'], ['realestate', 'Travel'],
    ['recipe', 'Health'], ['weather', 'Research'], ['wiki', 'Research'],
    ['journal', 'Research'], ['podcast', 'Entertainment'], ['game', 'Entertainment'],
    ['sport', 'Entertainment'], ['stream', 'Entertainment'], ['music', 'Entertainment'],
    ['forum', 'Social'], ['community', 'Social'], ['social', 'Social'],
    ['shop', 'Shopping'], ['market', 'Shopping'], ['deals', 'Shopping']
  ],

  // Ordered: the first match wins, so the most specific phrases come first.
  // Single words that mean different things in different contexts ("home",
  // "app", "new") are deliberately absent - a wrong category is worse than
  // "Other", which at least admits it does not know.
  TITLE_RULES: [
    // AI first: "AI video generator" is an AI product before it is a video
    // one, and the later Entertainment rules would otherwise claim it.
    ['generative ai', 'AI'], ['ai assistant', 'AI'], ['ai agent', 'AI'],
    ['ai writing', 'AI'], ['ai video', 'AI'], ['ai image', 'AI'],
    ['ai search', 'AI'], ['ai model', 'AI'], ['chatbot', 'AI'],
    ['large language model', 'AI'], ['llm', 'AI'], ['prompt engineering', 'AI'],
    ['machine learning', 'AI'], ['neural network', 'AI'],

    ['api reference', 'Development'], ['api docs', 'Development'],
    ['api key', 'Development'], ['api client', 'Development'],
    ['rest api', 'Development'], ['graphql', 'Development'],
    ['developer doc', 'Development'], ['for developers', 'Development'],
    ['documentation', 'Research'], ['docs', 'Research'],
    ['sdk', 'Development'], ['github', 'Development'], ['stack overflow', 'Development'],
    ['npm', 'Development'], ['changelog', 'Development'], ['release notes', 'Development'],
    ['pull request', 'Development'], ['merge request', 'Development'],
    ['open source', 'Development'], ['self-hosted', 'Development'],

    ['pricing', 'Productivity'], ['dashboard', 'Productivity'], ['admin', 'Productivity'],
    ['spreadsheet', 'Productivity'], ['presentation', 'Productivity'],
    ['meeting', 'Productivity'], ['agenda', 'Productivity'], ['check-in', 'Productivity'],
    ['standup', 'Productivity'], ['roadmap', 'Productivity'], ['kanban', 'Productivity'],

    ['careers at', 'Career'], ['job description', 'Career'], ['apply now', 'Career'],
    ['vacanc', 'Career'], ['hiring', 'Career'], ['salary', 'Career'], ['resume', 'Career'],
    ['curriculum vitae', 'Career'],

    ['invoice', 'Finance'], ['billing', 'Finance'], ['checkout', 'Shopping'],
    ['add to cart', 'Shopping'], ['free shipping', 'Shopping'], ['product review', 'Shopping'],
    ['tax return', 'Finance'], ['exchange rate', 'Finance'], ['stock price', 'Finance'],

    ['course', 'Education'], ['lesson', 'Education'], ['lecture', 'Education'],
    ['tutorial', 'Education'], ['certification', 'Education'], ['syllabus', 'Education'],
    ['exam', 'Education'], ['quiz', 'Education'],

    ['recipe', 'Health'], ['symptom', 'Health'], ['workout', 'Health'],
    ['calories', 'Health'], ['diagnosis', 'Health'], ['treatment', 'Health'],

    ['flight', 'Travel'], ['hotel', 'Travel'], ['itinerary', 'Travel'],
    ['directions to', 'Travel'], ['for sale', 'Travel'], ['for rent', 'Travel'],

    ['episode', 'Entertainment'], ['playlist', 'Entertainment'], ['soundtrack', 'Entertainment'],
    ['trailer', 'Entertainment'], ['walkthrough', 'Entertainment'], ['livestream', 'Entertainment'],
    ['highlights', 'Entertainment'], ['full match', 'Entertainment'],

    ['wikipedia', 'Research'], ['journal of', 'Research'], ['abstract', 'Research'],
    ['white paper', 'Research'], ['case study', 'Research'],

    ['newsletter', 'News'], ['breaking', 'News'], ['opinion', 'News']
  ],

  /**
   * Longest-suffix lookup in the site catalogue.
   *
   * Walks the hostname from the most specific label set to the least, so
   * 'console.aws.amazon.com' matches its own entry rather than falling
   * through to Amazon's shopping entry. Costs at most one map lookup per
   * dot in the hostname.
   */
  lookupSite(host) {
    const parts = String(host || '').split('.');
    // `i < parts.length` rather than `- 1`: stopping a label early never tries
    // the bare hostname, so a single-label host - 'localhost', an intranet
    // machine name - could never match its own catalogue entry.
    for (let i = 0; i < parts.length; i++) {
      const candidate = parts.slice(i).join('.');
      const hit = this.SITE_CATEGORIES[candidate];
      if (hit) return hit;
    }
    return null;
  },

  /**
   * Subdomains that describe the *use* of a site rather than the site itself.
   *
   * docs.stripe.com is API documentation, not banking; developer.spotify.com
   * is engineering, not music. These beat the catalogue's entry for the parent
   * domain - but only after an exact whole-host match, because docs.google.com
   * is Google Docs and has its own entry.
   */
  TECHNICAL_PREFIXES: [
    ['docs.', 'Research'], ['developer.', 'Development'], ['developers.', 'Development'],
    ['api.', 'Development'], ['dev.', 'Development'], ['devcenter.', 'Development'],
    ['status.', 'Development'], ['careers.', 'Career'], ['jobs.', 'Career']
  ],

  /**
   * Which category a page belongs to.
   *
   * Order matters: the user's own rule beats everything, then the exact
   * catalogue, then structural signals in the hostname, then the page title.
   * 'Other' is reached only when none of that says anything - it means
   * "unrecognised", not "unproductive", which is why it is labelled that way
   * and scored at the midpoint.
   */
  categorizeActivity(url, title = '') {
    const domain = this.getDomain(url).toLowerCase();
    const lowerTitle = (title || '').toLowerCase();
    const fullUrl = String(url || '').toLowerCase();

    // The user's own rule wins over every built-in guess below.
    const override = this.lookupDomainOverride(domain);
    if (override) return override;

    // A handful of catalogue entries carry a path because the same host
    // serves different things ('linkedin.com/learning' is not Social).
    const pathKeys = this.PATH_QUALIFIED_KEYS ||
      (this.PATH_QUALIFIED_KEYS = Object.keys(this.SITE_CATEGORIES).filter(k => k.indexOf('/') !== -1));
    for (let i = 0; i < pathKeys.length; i++) {
      if (fullUrl.includes(pathKeys[i])) return this.SITE_CATEGORIES[pathKeys[i]];
    }

    // An entry naming the whole host is the most specific thing we have.
    const exact = this.SITE_CATEGORIES[domain];
    if (exact) return exact;

    // Then "what is this subdomain for", which outranks what the parent site
    // sells: docs.stripe.com is documentation, stripe.com is payments.
    for (let i = 0; i < this.TECHNICAL_PREFIXES.length; i++) {
      if (domain.startsWith(this.TECHNICAL_PREFIXES[i][0])) return this.TECHNICAL_PREFIXES[i][1];
    }

    const known = this.lookupSite(domain);
    if (known) return known;

    for (let i = 0; i < this.HOST_PREFIX_RULES.length; i++) {
      if (domain.startsWith(this.HOST_PREFIX_RULES[i][0])) return this.HOST_PREFIX_RULES[i][1];
    }

    for (let i = 0; i < this.STRONG_SUFFIX_RULES.length; i++) {
      if (domain.endsWith(this.STRONG_SUFFIX_RULES[i][0])) return this.STRONG_SUFFIX_RULES[i][1];
    }

    for (let i = 0; i < this.HOST_KEYWORD_RULES.length; i++) {
      if (domain.includes(this.HOST_KEYWORD_RULES[i][0])) return this.HOST_KEYWORD_RULES[i][1];
    }

    // Last resort: the page title.
    //
    // A hostname is opaque - nothing in "algolia.com" says what Algolia is -
    // but a title is written precisely to say what the page is, and most sites
    // put their category in it: "API Reference", "Pricing", "Careers at X",
    // "How to ... - Recipe". This is the only signal that generalises to a site
    // nobody has catalogued, so it is worth more than a handful of words.
    for (let i = 0; i < this.TITLE_RULES.length; i++) {
      if (lowerTitle.includes(this.TITLE_RULES[i][0])) return this.TITLE_RULES[i][1];
    }

    // Only now the suffixes anyone can buy, as a hint rather than a finding.
    for (let i = 0; i < this.WEAK_SUFFIX_RULES.length; i++) {
      if (domain.endsWith(this.WEAK_SUFFIX_RULES[i][0])) return this.WEAK_SUFFIX_RULES[i][1];
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
   * 'Other' sits at the midpoint deliberately: unrecognised time is unknown,
   * not unproductive, and scoring it as either extreme would be a guess. With
   * the site catalogue in place it should now be a small slice; if it is large
   * for you, the sites in it are worth adding as rules in Settings.
   */
  DEFAULT_CATEGORY_WEIGHTS: {
    'Development': 1.0,
    'Productivity': 1.0,
    'AI': 0.9,
    'Research': 0.9,
    'Design': 0.9,
    'Education': 0.8,
    'Communication': 0.6,
    'Finance': 0.6,
    // Job hunting is real work, but it is not the work you are being paid for
    // today - which is the thing this score is trying to describe.
    'Career': 0.5,
    'Other': 0.5,
    'News': 0.4,
    'Health': 0.3,
    'Travel': 0.25,
    'Shopping': 0.2,
    'Entertainment': 0.1,
    'Social': 0.1
  },

  // The weights actually in force: defaults with the user's overrides applied.
  // Replaced wholesale by applyPreferences(); scoring only ever reads this.
  CATEGORY_WEIGHTS: null,

  // domain -> category, e.g. { 'linkedin.com': 'Productivity' }. Consulted
  // before the built-in rules, so a user can settle what a site means to them
  // rather than argue with a substring match.
  DOMAIN_CATEGORY_OVERRIDES: {},

  // Display order for the settings UI, most productive default first.
  CATEGORY_KEYS: [
    'Development', 'Productivity', 'AI', 'Research', 'Design', 'Education',
    'Communication', 'Finance', 'Career', 'Other', 'News', 'Health', 'Travel',
    'Social', 'Shopping', 'Entertainment'
  ],

  /**
   * Adopt the user's scoring preferences.
   *
   * Overrides are stored sparsely - only categories the user actually moved -
   * so a category left alone keeps following its default, including if that
   * default changes in a later version.
   */
  applyPreferences(settings) {
    const prefs = settings || {};
    const weights = { ...this.DEFAULT_CATEGORY_WEIGHTS };

    Object.keys(prefs.categoryWeights || {}).forEach((name) => {
      const value = Number(prefs.categoryWeights[name]);
      if (!Number.isFinite(value)) return;
      weights[name] = Math.min(1, Math.max(0, value));
    });

    this.CATEGORY_WEIGHTS = weights;

    const overrides = {};
    Object.keys(prefs.domainCategories || {}).forEach((domain) => {
      const category = prefs.domainCategories[domain];
      const key = String(domain || '').trim().toLowerCase().replace(/^www\./, '');
      if (key && this.CATEGORY_KEYS.indexOf(category) !== -1) {
        overrides[key] = category;
      }
    });
    this.DOMAIN_CATEGORY_OVERRIDES = overrides;
  },

  /**
   * The user's own ruling on what a domain is, if they made one.
   * Matches subdomains too, so 'linkedin.com' also covers 'www.linkedin.com'
   * and 'business.linkedin.com'.
   */
  lookupDomainOverride(domain) {
    const host = String(domain || '').toLowerCase();
    if (!host) return null;
    const keys = Object.keys(this.DOMAIN_CATEGORY_OVERRIDES);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (host === key || host.endsWith('.' + key)) {
        return this.DOMAIN_CATEGORY_OVERRIDES[key];
      }
    }
    return null;
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
      // Falls back to the defaults when preferences have not been hydrated yet,
      // so a score is never computed against an empty weight table.
      const weights = this.CATEGORY_WEIGHTS || this.DEFAULT_CATEGORY_WEIGHTS;
      const weight = weights[name] !== undefined ? weights[name] : weights['Other'];
      weighted += weight * seconds;
      total += seconds;
    });

    if (total < this.MIN_SCORE_SECONDS) return null;
    return Math.round((weighted / total) * 100);
  },

  // Below this span there is nothing meaningful to reconcile - a 20-minute
  // stretch with a 5-minute gap says nothing about a working day.
  MIN_COVERAGE_SPAN_SECONDS: 3600,

  /**
   * How much of the day Tasker could actually see.
   *
   * Tasker only observes Chrome, so its total is not a working day - time in an
   * editor, on calls, or in desktop apps is invisible to it. The activity map
   * already carries first/last timestamps, so the elapsed span between the first
   * and last tracked thing can be compared against the time actually recorded.
   * The difference is time spent somewhere Tasker cannot follow, or away from the
   * machine entirely. Naming that gap is what stops the headline number from
   * being read as a whole working day.
   *
   * @returns {object|null} null when the day is too short to judge, or too old
   *   to carry timestamps (days recorded before the activity layer shipped).
   */
  computeCoverage(dayData) {
    const activities = (dayData && dayData.activities) || {};
    const keys = Object.keys(activities);
    if (keys.length === 0) return null;

    let firstAt = Infinity;
    let lastAt = 0;
    keys.forEach((key) => {
      const a = activities[key];
      if (a && Number.isFinite(a.firstAt)) firstAt = Math.min(firstAt, a.firstAt);
      if (a && Number.isFinite(a.lastAt)) lastAt = Math.max(lastAt, a.lastAt);
    });

    if (!Number.isFinite(firstAt) || lastAt <= firstAt) return null;

    const elapsedSeconds = Math.round((lastAt - firstAt) / 1000);
    if (elapsedSeconds < this.MIN_COVERAGE_SPAN_SECONDS) return null;

    // Tracked time can nudge past the span through rounding at the edges, so
    // the gap is a shortfall or nothing - never negative.
    const trackedSeconds = Math.max(0, Math.round(dayData.totalSeconds || 0));
    const unaccountedSeconds = Math.max(0, elapsedSeconds - trackedSeconds);

    return {
      firstAt,
      lastAt,
      elapsedSeconds,
      trackedSeconds,
      unaccountedSeconds,
      coveragePercent: Math.min(100, Math.round((trackedSeconds / elapsedSeconds) * 100))
    };
  },

  /**
   * Clock time of a timestamp, e.g. "9:12 AM".
   */
  formatClockTime(ms) {
    return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },

  /**
   * One plain sentence naming what the headline number leaves out.
   */
  formatCoverageNote(coverage) {
    if (!coverage) return '';
    const span = `${this.formatClockTime(coverage.firstAt)} and ${this.formatClockTime(coverage.lastAt)}`;
    const tracked = this.formatDuration(coverage.trackedSeconds);
    const gap = this.formatDuration(coverage.unaccountedSeconds);

    if (coverage.unaccountedSeconds < 300) {
      return `Between ${span} you were in Chrome for ${tracked}, which is nearly all of it. ` +
        `Anything done in an editor, on a call, or in a desktop app is still not counted here.`;
    }

    return `Between ${span} you were in Chrome for ${tracked}. The other ${gap} went somewhere ` +
      `Tasker cannot see - an editor, a call, a desktop app, or away from the machine. ` +
      `Treat this as browser time, not a whole working day.`;
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
  //
  // Matched as substrings of the hostname. This list is best-effort and can
  // never be complete - a challenger bank launches every week - so it is a
  // safety net, not the guarantee. The guarantee is the user's own exclusion
  // list, which stops those sites being recorded at all.
  SENSITIVE_DETAIL_DOMAINS: [
    // Mail - subject lines are the message
    'mail.google', 'outlook', 'mail.yahoo', 'proton.me', 'protonmail',
    'mail.com', 'zoho.com/mail', 'fastmail',

    // Banking, incumbent and challenger. Titles here routinely carry balances.
    'bank', 'paypal', 'chase', 'amex', 'wellsfargo', 'capitalone',
    'monzo', 'revolut', 'starling', 'n26.', 'chime.com', 'nubank',
    'wise.com', 'sofi.com', 'ally.com', 'discover.com', 'citi',
    'hsbc', 'barclays', 'lloyds', 'natwest', 'santander', 'usbank',
    'tdbank', 'nationwide', 'venmo', 'cashapp', 'monese', 'kuda.com',

    // Brokerages, pensions and crypto - portfolio values in the title
    'fidelity', 'schwab', 'vanguard', 'etrade', 'robinhood', 'wealthfront',
    'betterment', 'coinbase', 'binance', 'kraken.com', 'blockchain.com',
    'metamask', 'ledger.com', 'crypto.com',

    // Health
    'mychart', 'healthcare', 'clinic', 'patient', 'pharmacy',
    'medicare', 'medicaid', 'nhs.uk', 'teladoc', 'zocdoc', 'goodrx',

    // Tax and payroll
    'turbotax', 'hmrc', 'irs.gov', 'gusto.com', 'adp.com'
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
   * The repo or ticket an activity belongs to, or null if it is neither.
   *
   * Derived from the action/label pair that describeActivity() already produced,
   * rather than from a new stored field - which means the rollup works on history
   * collected before this shipped, with no migration and no re-parsing of URLs
   * that are no longer around.
   */
  deriveWorkKey(activity) {
    const action = String((activity && activity.action) || '');
    const label = String((activity && activity.label) || '').trim();
    if (!label) return null;

    if (action === 'Worked ticket') {
      return { type: 'ticket', key: label.toUpperCase() };
    }

    // "#12 in dan/tasker" - pull requests and issues.
    const inRepo = label.match(/^#(\d+)\s+in\s+(\S+\/\S+)$/);
    if (inRepo) return { type: 'repo', key: inRepo[2] };

    // "dan/tasker" or "dan/tasker/service-worker.js" - commits, code, browsing.
    if (action === 'Reviewed commits' || action === 'Browsed repo' || action === 'Read code') {
      const parts = label.split('/').filter(Boolean);
      if (parts.length >= 2) return { type: 'repo', key: `${parts[0]}/${parts[1]}` };
    }

    return null;
  },

  /**
   * Short name for one item within a rollup: "PR #12", "Issue #7", "commits".
   */
  shortItemLabel(activity) {
    const action = String((activity && activity.action) || '');
    const label = String((activity && activity.label) || '');
    const num = label.match(/^#(\d+)/);

    if (action === 'Reviewed PR' && num) return `PR #${num[1]}`;
    if (action === 'Issue' && num) return `Issue #${num[1]}`;
    if (action === 'Reviewed commits') return 'commits';
    if (action === 'Read code') return 'code';
    if (action === 'Browsed repo') return 'browsing';
    if (action === 'Worked ticket') return 'ticket';
    return action.toLowerCase() || 'activity';
  },

  /**
   * Group a day's or month's activities by the repo or ticket they belong to.
   *
   * "6h on github.com" is not an answer to what someone worked on; "2h 14m on
   * dan/tasker across PR #12, PR #15 and commits" is. Everything that resolves
   * to neither a repo nor a ticket is left out entirely rather than bundled into
   * a misleading "other" bucket.
   *
   * @returns {Array} longest-first, each { type, key, seconds, visits, items }
   */
  rollupWork(source, limit = 10) {
    const activities = (source && source.activities) || {};
    const groups = {};

    Object.keys(activities).forEach((activityKey) => {
      const activity = activities[activityKey];
      if (!activity || !(activity.seconds > 0)) return;

      const work = this.deriveWorkKey(activity);
      if (!work) return;

      const groupKey = `${work.type}:${work.key}`;
      if (!groups[groupKey]) {
        groups[groupKey] = { type: work.type, key: work.key, seconds: 0, visits: 0, items: [] };
      }

      const group = groups[groupKey];
      group.seconds += activity.seconds;
      group.visits += activity.visits || 1;

      const name = this.shortItemLabel(activity);
      const existing = group.items.find(item => item.name === name);
      if (existing) existing.seconds += activity.seconds;
      else group.items.push({ name, seconds: activity.seconds });
    });

    return Object.keys(groups)
      .map(k => groups[k])
      .map((group) => {
        group.items.sort((a, b) => b.seconds - a.seconds);
        return group;
      })
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, limit);
  },

  /**
   * "PR #12, PR #15, commits" - the pieces of work under one repo or ticket.
   */
  formatRollupItems(group, limit = 4) {
    const all = (group && group.items) || [];

    // A ticket's only "item" is the ticket itself, so listing it restates the
    // row's own name. Nothing useful to add, so add nothing.
    if (all.length === 1 && all[0].name === 'ticket') return '';

    const names = all.slice(0, limit).map(item => item.name);
    const remaining = all.length - names.length;
    if (remaining > 0) names.push(`+${remaining} more`);
    return names.join(', ');
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

    // Say what this number is not, in the artifact itself. A log handed to a
    // manager or attached to an invoice travels without any of the app's context.
    const coverage = this.computeCoverage(dayData);
    if (coverage) {
      md += `> **Coverage:** ${this.formatCoverageNote(coverage)}\n\n`;
    }

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

    const workGroups = this.rollupWork(dayData, 10);
    if (workGroups.length > 0) {
      md += `## 🧰 Repos & Tickets\n`;
      workGroups.forEach((group) => {
        const detail = this.formatRollupItems(group);
        md += `- **${group.key}** — ${this.formatDuration(group.seconds)}${detail ? ` (${detail})` : ''}\n`;
      });
      md += `\n`;
    }

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

    const monthWork = this.rollupWork(monthStats, 15);
    if (monthWork.length > 0) {
      md += `## 🧰 Repos & Tickets This Month\n`;
      monthWork.forEach((group) => {
        const detail = this.formatRollupItems(group);
        md += `- **${group.key}** — ${this.formatDuration(group.seconds)}${detail ? ` (${detail})` : ''}\n`;
      });
      md += `\n`;
    }

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
    text += `⏱️ Time in Chrome: ${totalTime} | Score: ${this.formatScore(dayData.productivityScore)}\n`;

    const coverage = this.computeCoverage(dayData);
    if (coverage && coverage.unaccountedSeconds >= 300) {
      text += `ℹ️ Browser time only - ${this.formatDuration(coverage.unaccountedSeconds)} of this span happened outside Chrome.\n`;
    }
    text += `\n`;

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
