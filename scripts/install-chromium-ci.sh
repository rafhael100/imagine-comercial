#!/usr/bin/env bash
# F161 — GitHub Actions Chromium bootstrap with a dependency probe.
# Don't run apt if Chromium already launches. This avoids transient DNS
# failures at azure.archive.ubuntu.com on disposable hosted runners.
set -euo pipefail
export PLAYWRIGHT_SKIP_BROWSER_GC=1
npx playwright install chromium
check_browser() {
  node --input-type=module -e '
    import {chromium} from "playwright";
    const browser=await chromium.launch({headless:true});
    try {
      const page=await browser.newPage();
      await page.goto("data:text/html,<html><title>Preview</title></html>");
      if(await page.title()!=="Preview")process.exitCode=1;
    } finally { await browser.close(); }
  '
}
if check_browser; then
  echo "F161: Chromium launched with preinstalled libraries (no apt)."
  exit 0
fi
echo "::warning::F161: missing system libraries; retry with dependency installation."
if [[ "$GITHUB_ACTIONS" != "true" ]]; then
  echo "F161: fallback dependency installation only allowed inside GitHub Actions." >&2
  exit 2
fi
# Update disposable runner apt mirror only, NEVER production or private VPS.
for sources in /etc/apt/sources.list.d/ubuntu.sources /etc/apt/sources.list; do
  if [[ -f "$sources" ]] && grep -q 'azure.archive.ubuntu.com' "$sources"; then
    sudo sed -i 's|azure.archive.ubuntu.com|archive.ubuntu.com|g' "$sources"
  fi
done
npx playwright install-deps chromium
check_browser
echo "F161: browser dependency fallback verified."
