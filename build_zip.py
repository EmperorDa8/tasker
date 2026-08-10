"""
Build the Chrome Web Store upload package.

    python build_zip.py                                   # zip as-is
    python build_zip.py --service-url https://x.onrender.com
    python build_zip.py --service-url https://x.onrender.com --version 1.0.1

--service-url rewrites the summary-service origin in BOTH places it appears.
They must match or the extension's CSP blocks the fetch:
    manifest.json   host_permissions   -> https://<host>/*
    summarizer.js   SUMMARY_SERVICE_URL -> https://<host>/v1/monthly-summary

The zip contains only what the extension needs at runtime. Docs, the server,
screenshots and the build scripts are deliberately left out.
"""
import argparse, io, json, os, re, sys, zipfile
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))

INCLUDE_DIRS = ["assets", "background", "dashboard", "options", "popup", "utils"]
INCLUDE_FILES = ["manifest.json"]
# assets/ doubles as a scratch area for screenshots and icon backups.
EXCLUDE_NAMES = {"tasker2.png", "tasker3.png", "logo.svg", "promo-440x280.png"}
EXCLUDE_DIRS = {"_previous"}


def rewrite_service_url(url):
    host = urlparse(url).netloc
    if not host:
        sys.exit(f"error: could not parse a host out of {url!r}")

    # Validate before touching any file. Writing first and refusing afterwards
    # leaves the repo pointing at a worse value than it started with.
    if PLACEHOLDER_HOSTS.search(host):
        sys.exit(f"error: {host!r} is a placeholder, not a real service.\n"
                 f"       Pass your actual deployed hostname, e.g.\n"
                 f"       python build_zip.py --service-url https://tasker-summary.onrender.com")
    if not re.fullmatch(r"[A-Za-z0-9.-]+", host):
        sys.exit(f"error: {host!r} is not a valid hostname "
                 f"(did you paste the angle brackets from the example?)")

    mpath = os.path.join(ROOT, "manifest.json")
    manifest = json.load(io.open(mpath, encoding="utf-8"))
    manifest["host_permissions"] = [f"https://{host}/*"]
    with io.open(mpath, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")

    spath = os.path.join(ROOT, "background", "summarizer.js")
    src = io.open(spath, encoding="utf-8").read()
    new_src, n = re.subn(
        r"const SUMMARY_SERVICE_URL = '[^']*';",
        f"const SUMMARY_SERVICE_URL = 'https://{host}/v1/monthly-summary';",
        src, count=1)
    if n != 1:
        sys.exit("error: could not find SUMMARY_SERVICE_URL in background/summarizer.js")
    io.open(spath, "w", encoding="utf-8", newline="").write(new_src)

    print(f"service host set to {host} (manifest + summarizer)")


def set_version(version):
    mpath = os.path.join(ROOT, "manifest.json")
    manifest = json.load(io.open(mpath, encoding="utf-8"))
    manifest["version"] = version
    with io.open(mpath, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"version set to {version}")


def collect():
    files = [f for f in INCLUDE_FILES if os.path.exists(os.path.join(ROOT, f))]
    for d in INCLUDE_DIRS:
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, d)):
            dirnames[:] = [x for x in dirnames if x not in EXCLUDE_DIRS]
            for name in filenames:
                if name in EXCLUDE_NAMES:
                    continue
                full = os.path.join(dirpath, name)
                files.append(os.path.relpath(full, ROOT).replace("\\", "/"))
    return sorted(files)


# Hosts that are obviously examples rather than a service you own. Shipping one
# would declare host permission for someone else's domain and POST user data to
# it, so treat any match as fatal.
PLACEHOLDER_HOSTS = re.compile(
    r"REPLACE|YOUR[-_]|your-app|your-service|example\.(com|org)|localhost|127\.0\.0\.1",
    re.IGNORECASE)


def preflight(manifest):
    """Refuse to ship a package that still points at a placeholder service."""
    problems = []
    src = io.open(os.path.join(ROOT, "background", "summarizer.js"), encoding="utf-8").read()

    host = urlparse(manifest["host_permissions"][0]).netloc
    if PLACEHOLDER_HOSTS.search(host):
        problems.append(f"manifest host_permissions is a placeholder: {host}")

    m = re.search(r"const SUMMARY_SERVICE_URL = '([^']*)';", src)
    if not m:
        problems.append("could not find SUMMARY_SERVICE_URL in background/summarizer.js")
    else:
        svc_host = urlparse(m.group(1)).netloc
        if PLACEHOLDER_HOSTS.search(svc_host):
            problems.append(f"summarizer.js points at a placeholder: {svc_host}")
        elif host and svc_host != host:
            # A mismatch here is blocked by CSP at runtime, not at build time,
            # so it would otherwise surface as a silent feature failure.
            problems.append(f"host mismatch: manifest={host} summarizer={svc_host}")

    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--service-url")
    ap.add_argument("--version")
    ap.add_argument("--allow-placeholders", action="store_true",
                    help="build anyway (draft uploads only, never for review)")
    args = ap.parse_args()

    if args.service_url:
        rewrite_service_url(args.service_url)
    if args.version:
        set_version(args.version)

    manifest = json.load(io.open(os.path.join(ROOT, "manifest.json"), encoding="utf-8"))
    problems = preflight(manifest)
    if problems:
        print("\n".join(f"  ! {p}" for p in problems))
        if not args.allow_placeholders:
            sys.exit("\nrefusing to build - pass --service-url, or --allow-placeholders for a draft")
        print("  (building anyway: --allow-placeholders)\n")

    out = os.path.join(ROOT, f"tasker-v{manifest['version']}.zip")
    files = collect()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in files:
            z.write(os.path.join(ROOT, rel), rel)

    print(f"\n{os.path.basename(out)}  ({os.path.getsize(out) / 1024:.0f} KB, {len(files)} files)")
    for rel in files:
        print("  " + rel)


if __name__ == "__main__":
    main()
