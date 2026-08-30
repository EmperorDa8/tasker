"""Capture the Chrome Web Store screenshots from the real UI.

The listing images used to be hand-built HTML mockups kept alongside the
extension. They drift: a mockup does not change when the product does, so the
store ends up advertising a version nobody can install. These are screenshots
of the actual popup, dashboard and settings pages, rendered by headless Chrome
against representative data, so regenerating them after a UI change is one
command rather than an afternoon in a design tool.

    python scripts/build_screenshots.py

Writes 1280x800 PNGs to screenshots/final/ - the size the Web Store requires.
Everything it needs is already here: Chrome for rendering, PyMuPDF to turn the
generated PDF report into an image for the report shot.
"""
import base64
import io
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE = os.path.join(ROOT, "build", "screenshots")
OUT = os.path.join(ROOT, "screenshots", "final")

WIDTH, HEIGHT = 1280, 800

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


def find_chrome():
    for path in CHROME_CANDIDATES:
        if os.path.exists(path):
            return path
    sys.exit("error: no Chrome or Edge binary found - add yours to CHROME_CANDIDATES")


# ---------------------------------------------------------------------------
# Representative data. Invented, but shaped like a real week so the shots show
# the product doing its job rather than empty states.
# ---------------------------------------------------------------------------
STUB = r"""
const DAY = {
  totalSeconds: 24180,
  categories: { Development: 11400, AI: 4200, Research: 3600, Communication: 2400,
                Productivity: 1800, Social: 780 },
  domains: { 'github.com': 8100, 'platform.openai.com': 4200, 'react.dev': 3000,
             'linear.app': 2400, 'slack.com': 2400, 'stackoverflow.com': 1800,
             'notion.so': 1500, 'x.com': 780 },
  activities: {
    a: { action: 'Reviewed PR', label: '#412 in acme/platform', domain: 'github.com',
         category: 'Development', seconds: 5400, visits: 4,
         firstAt: Date.now() - 30600000, lastAt: Date.now() - 1000 },
    b: { action: 'Read', label: 'Server Components', domain: 'react.dev',
         category: 'Research', seconds: 3000, visits: 5,
         firstAt: Date.now() - 27000000, lastAt: Date.now() - 4000 },
    c: { action: 'Worked ticket', label: 'ENG-4412', domain: 'linear.app',
         category: 'Productivity', seconds: 2400, visits: 3,
         firstAt: Date.now() - 21600000, lastAt: Date.now() - 9000 },
    d: { action: 'Reviewed PR', label: '#418 in acme/platform', domain: 'github.com',
         category: 'Development', seconds: 2700, visits: 2,
         firstAt: Date.now() - 18000000, lastAt: Date.now() - 12000 }
  },
  productivityScore: 88
};

const PROFILE = {
  status: 'inferred', roleId: 'ai_engineer', label: 'AI / LLM Engineer', family: 'AI',
  icon: 'smart_toy', confidence: 'high', confidenceLabel: 'Strong signal',
  sharePercent: 31, marginPercent: 38,
  aliases: ['Applied AI Engineer', 'Generative AI Engineer', 'GenAI Engineer',
            'AI Software Engineer', 'LLM Engineer', 'Prompt Engineer'],
  evidence: [
    { id: 'llm_api', label: 'LLM provider consoles', seconds: 46800, days: 12,
      sources: ['platform.openai.com', 'console.anthropic.com'] },
    { id: 'code_review', label: 'Pull request review', seconds: 39600, days: 14,
      sources: ['Reviewed PR'] },
    { id: 'llm_frameworks', label: 'LLM application frameworks', seconds: 14400, days: 9,
      sources: ['langchain.com'] },
    { id: 'model_hub', label: 'Model hubs & weights', seconds: 9000, days: 7,
      sources: ['huggingface.co'] },
    { id: 'qna', label: 'Q&A and developer forums', seconds: 6300, days: 8,
      sources: ['stackoverflow.com'] }
  ],
  alternatives: [
    { roleId: 'agent_ops', label: 'Agent / Agentic AI Engineer', icon: 'hub', sharePercent: 14 },
    { roleId: 'fullstack', label: 'Full-stack Engineer', icon: 'terminal', sharePercent: 11 }
  ],
  stats: { totalSeconds: 116100, distinctSignals: 6, distinctSources: 9,
           daysSeen: 14, windowDays: 21 },
  disclaimer: 'This is what your browsing looks like, not a verified fact about you. ' +
    'It is inferred on this device from the tools you spend time in, and you can override it in Settings.'
};

const HIGHLIGHTS = [
  { id: 'h1', title: 'Shipped the retrieval cache', time: '16:40', category: 'Development',
    description: 'Landed PR #412 after review' },
  { id: 'h2', title: 'Reviewed PR #418 in acme/platform', time: '14:05', category: 'Development', description: '' },
  { id: 'h3', title: 'Drafted the Q4 evaluation plan', time: '11:20', category: 'Productivity', description: '' }
];

const MONTH = {
  monthKey: '2026-08', totalSeconds: 468000, daysTrackedCount: 21, avgDailySeconds: 22285,
  monthlyScore: 84,
  categories: { Development: 208000, AI: 96000, Research: 62000, Productivity: 44000,
                Communication: 32000, Education: 16000, Social: 10000 },
  domains: { 'github.com': 172000, 'platform.openai.com': 84000, 'react.dev': 46000,
             'linear.app': 38000, 'huggingface.co': 24000 },
  activities: DAY.activities,
  topDomains: [
    { domain: 'github.com', seconds: 172000 }, { domain: 'platform.openai.com', seconds: 84000 },
    { domain: 'react.dev', seconds: 46000 }, { domain: 'linear.app', seconds: 38000 },
    { domain: 'huggingface.co', seconds: 24000 }
  ],
  topActivities: Object.keys(DAY.activities).map(k => DAY.activities[k]),
  milestones: [
    { title: 'Shipped the retrieval cache', date: '2026-08-28', description: 'Cut median answer latency by 40%' },
    { title: 'Migrated evals to the new harness', date: '2026-08-21', description: 'All 340 cases now run in CI' },
    { title: 'Published the agent design note', date: '2026-08-14', description: 'Circulated to the platform team' }
  ],
  topCategory: 'Development', secondCategory: 'AI',
  aiSummaryParagraph: 'August was dominated by focused platform work, with review cycles ' +
    'concentrated in the first half of the month and a steady research cadence throughout. ' +
    'Time in AI tooling grew to roughly a fifth of the month as the retrieval work landed.'
};

const RESPONSES = {
  GET_STATUS: {
    isPaused: false, activeTab: { domain: 'github.com', category: 'Development' },
    totalSeconds: DAY.totalSeconds, formattedTime: '6h 43m',
    highlightsCount: HIGHLIGHTS.length, notesCount: 1, dayData: DAY, highlights: HIGHLIGHTS,
    notes: [{ id: 'n1', text: 'Write the release notes before standup', time: '17:10' }],
    lastSync: { syncedAt: new Date().toISOString(), name: 'Tasker_Daily_Log_2026-08-28.pdf',
                mimeType: 'application/pdf' },
    settings: { googleDriveFolderName: 'Tasker Activity Logs' }
  },
  GET_WORK_PROFILE: PROFILE,
  GET_MONTHLY_RECAP: { monthKey: '2026-08', monthStats: MONTH, markdown: '', profile: PROFILE },
  GET_DAILY_SUMMARY: { dateKey: '2026-08-28', dayData: DAY, highlights: HIGHLIGHTS,
                       notes: [], markdown: '', profile: PROFILE, formattedTime: '6h 43m' },
  GET_ROLE_CATALOGUE: [
    { id: 'ai_engineer', label: 'AI / LLM Engineer', family: 'AI', icon: 'smart_toy' },
    { id: 'frontend', label: 'Frontend Engineer', family: 'Engineering', icon: 'code' },
    { id: 'product_manager', label: 'Product Manager', family: 'Product', icon: 'flag' }
  ],
  GET_UNRECOGNISED_SITES: [
    { domain: 'internal-wiki.acme.corp', seconds: 9400 },
    { domain: 'deploy-console.acme.corp', seconds: 5200 },
    { domain: 'some-niche-tool.example', seconds: 2600 }
  ]
};

window.chrome = {
  runtime: {
    id: 'screenshot', getURL: p => p, openOptionsPage: () => {},
    sendMessage: async (m) => ({ success: true, data: RESPONSES[m.action] ?? {} })
  },
  storage: { local: { get: (k, cb) => cb({ tasker_settings: { hasSeenOnboarding: true } }),
                      set: (d, cb) => cb && cb(), remove: (k, cb) => cb && cb() } },
  tabs: { create: () => {} }
};
"""


def preview_page(rel_html, out_name, after_load="", head_css=""):
    """Copy a real extension page into the stage with the chrome stub injected."""
    src = io.open(os.path.join(ROOT, rel_html), encoding="utf-8").read()
    depth = "../" * (out_name.count("/") + 1)
    src = (src.replace('href="../', f'href="{depth}')
              .replace('src="../', f'src="{depth}'))
    folder = os.path.dirname(rel_html)
    base = os.path.basename(rel_html).replace(".html", "")
    src = (src.replace(f'href="{base}.css"', f'href="{depth}{folder}/{base}.css"')
              .replace(f'src="{base}.js"', f'src="{depth}{folder}/{base}.js"'))
    src = src.replace(f'<script src="{depth}assets/icons/icons.js"></script>',
                      f'<script src="{depth}stub.js"></script>\n'
                      f'  <script src="{depth}assets/icons/icons.js"></script>')
    if head_css:
        # Hiding sections beats scrolling to them. Headless capture and
        # scrollIntoView do not reliably agree about where the viewport ended
        # up, and the failure mode is a blank screenshot - so the section we
        # want is put at the top of the document instead of scrolled to.
        src = src.replace("</head>", f"<style>{head_css}</style>\n</head>")
    if after_load:
        src = src.replace("</body>", f"<script>{after_load}</script>\n</body>")

    dest = os.path.join(STAGE, out_name)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    io.open(dest, "w", encoding="utf-8", newline="\n").write(src)


def scene(out_name, body, extra_css=""):
    """A 1280x800 composition, for shots that frame something rather than being it."""
    html = f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<link rel="stylesheet" href="../assets/fonts/fonts.css">
<link rel="stylesheet" href="../assets/design/tokens.css">
<style>
  html, body {{ width: {WIDTH}px; height: {HEIGHT}px; overflow: hidden; }}
  body {{ background: var(--bg-app); }}
  .scene {{ width: {WIDTH}px; height: {HEIGHT}px; display: flex; }}
  .copy h2 {{ font-family: var(--font-display); font-size: 40px; font-weight: 700;
             letter-spacing: -0.025em; color: var(--brand-ink); line-height: 1.1; }}
  .copy p {{ margin-top: 14px; font-size: 17px; line-height: 1.55; color: var(--text-body); }}
  .copy .eyebrow {{ font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.08em;
                   text-transform: uppercase; color: var(--text-muted); display: block;
                   margin-bottom: 14px; }}
  {extra_css}
</style></head><body><div class="scene">{body}</div></body></html>"""
    dest = os.path.join(STAGE, out_name)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    io.open(dest, "w", encoding="utf-8", newline="\n").write(html)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def capture(chrome, url, dest, wait_ms=3500):
    profile = os.path.join(STAGE, "_chrome-profile")
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--default-background-color=00000000",
        f"--window-size={WIDTH},{HEIGHT}",
        f"--virtual-time-budget={wait_ms}",
        f"--user-data-dir={profile}",
        f"--screenshot={dest}", url,
    ], check=True, capture_output=True, timeout=180)


def main():
    chrome = find_chrome()
    print("chrome:", chrome)

    if os.path.isdir(STAGE):
        shutil.rmtree(STAGE)
    os.makedirs(STAGE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    # The stage needs the extension's own assets alongside the pages.
    for folder in ("assets", "popup", "options", "dashboard", "utils"):
        shutil.copytree(os.path.join(ROOT, folder), os.path.join(STAGE, folder))
    io.open(os.path.join(STAGE, "stub.js"), "w", encoding="utf-8", newline="\n").write(STUB)

    click = "document.querySelector('.nav-item[data-tab=\"%s\"]').click();"
    preview_page("dashboard/dashboard.html", "shots/1-overview.html",
                 "setTimeout(() => window.scrollTo(0, 0), 900);")
    preview_page("dashboard/dashboard.html", "shots/2-profile.html",
                 f"setTimeout(() => {{ {click % 'work-profile'} }}, 700);")
    preview_page("dashboard/dashboard.html", "shots/3-recap.html",
                 f"setTimeout(() => {{ {click % 'monthly-recap'} }}, 700);")
    preview_page("options/options.html", "shots/5-settings.html", head_css=(
        "#sec-profile, #sec-ai, #sec-scoring, #sec-shortcut, #sec-data,"
        "a[href='#sec-profile'], a[href='#sec-ai'], a[href='#sec-scoring'],"
        "a[href='#sec-shortcut'], a[href='#sec-data'] { display: none !important; }"
        ".content-foot { display: none !important; }"
        "a[href='#sec-reports'] { background: #2A0F14; color: #fff; font-weight: 600; }"
        "a[href='#sec-reports'] [data-icon] { color: #FAE261; }"))
    preview_page("popup/popup.html", "shots/popup-inner.html")

    # The popup is 380px wide; on a 1280x800 canvas it needs framing.
    scene("shots/4-popup.html", f"""
      <div style="flex:1; display:flex; align-items:center; justify-content:center; gap:70px;
                  padding:0 72px; background:linear-gradient(160deg,var(--accent-yellow-soft),var(--bg-app) 62%)">
        <div class="copy" style="max-width:440px">
          <span class="eyebrow">In one click, from any tab</span>
          <h2>Your day, already written down.</h2>
          <p>Time on the tab you are actually looking at, sorted into sixteen categories,
             with a focus score you set the rules for.</p>
          <p>Log a win the moment it happens, then send the whole day as a branded PDF.</p>
        </div>
        <div style="width:380px; height:620px; border-radius:20px; overflow:hidden;
                    box-shadow:0 32px 70px -28px rgba(42,15,20,.42), 0 0 0 1px rgba(42,15,20,.07)">
          <iframe src="popup-inner.html" style="width:380px; height:620px; border:0"></iframe>
        </div>
      </div>""")

    port = free_port()
    handler = partial(SimpleHTTPRequestHandler, directory=STAGE)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}/shots"
    print(f"serving stage on {port}\n")

    shots = [
        ("1-overview.html", "1-overview.png"),
        ("2-profile.html", "2-work-profile.png"),
        ("3-recap.html", "3-monthly-recap.png"),
        ("4-popup.html", "4-popup.png"),
        ("5-settings.html", "5-privacy.png"),
    ]
    for page, name in shots:
        dest = os.path.join(OUT, name)
        capture(chrome, f"{base}/{page}", dest)
        print(f"  {name:26s} {os.path.getsize(dest)/1024:6.0f} KB")

    server.shutdown()
    verify()


def verify():
    """A wrong-sized screenshot is rejected at upload, so check before shipping."""
    import struct
    print()
    bad = 0
    for name in sorted(os.listdir(OUT)):
        if not name.endswith(".png"):
            continue
        data = io.open(os.path.join(OUT, name), "rb").read()
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            print(f"  {name}: not a PNG"); bad += 1; continue
        w, h = struct.unpack(">II", data[16:24])
        store_ok = (w, h) in ((1280, 800), (640, 400), (1400, 560), (440, 280))
        print(f"  {name:26s} {w}x{h}  {'ok' if store_ok else 'WRONG SIZE'}")
        bad += 0 if store_ok else 1
    sys.exit(1) if bad else print("\nall screenshots valid for the Web Store")


if __name__ == "__main__":
    main()
