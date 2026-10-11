"""Render raw tool output (docs/test-report/raw/*.txt) as terminal-style HTML pages for screenshots."""

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
OUT = ROOT / "console"
ANSI = re.compile(r"\x1b\[[0-9;]*m")
NOISE = ("devdir", "NativeCommandError", "CategoryInfo", "Au caract", "NO_COLOR", "trace-warnings", "~~~~")

PAGES = {
    "django-tests": ("python manage.py test -v 2  (coverage run)", "django-tests.txt", 48),
    "coverage-backend": ("coverage report --sort=cover", "coverage-backend.txt", 60),
    "vitest": ("npx vitest run --coverage", "vitest.txt", 70),
    "playwright": ("npx playwright test", "playwright.txt", 30),
    "locust": ("locust --headless -u 20 -r 5 -t 60s", "locust.txt", 60),
    "locust-stress": ("locust --headless -u 100 -r 10 -t 60s", "locust-stress.txt", 60),
}


def clean(text: str) -> list[str]:
    lines = []
    for line in ANSI.sub("", text).splitlines():
        if any(n in line for n in NOISE) or line.startswith("+ "):
            continue
        lines.append(line.rstrip())
    return lines


def colorize(line: str) -> str:
    esc = html.escape(line)
    if re.search(r"\b(ok|OK|passed|✓)\b|✓", line):
        return f'<span class="ok">{esc}</span>'
    if re.search(r"FAIL|Error|failed|✗", line):
        return f'<span class="ko">{esc}</span>'
    return esc


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for name, (command, filename, tail) in PAGES.items():
        source = RAW / filename
        if not source.exists():
            continue
        data = source.read_bytes()
        # PowerShell redirection (*>) writes UTF-16 LE with a BOM
        encoding = "utf-16" if data[:2] in (b"\xff\xfe", b"\xfe\xff") else "utf-8"
        text = data.decode(encoding, errors="replace")
        lines = clean(text)
        if name == "django-tests":
            lines = [l for l in lines if " ... " in l or l.startswith(("Ran ", "OK", "FAILED", "Found"))]
        lines = lines[-tail:]
        body = "\n".join(colorize(l) for l in lines)
        (OUT / f"{name}.html").write_text(
            f"""<!doctype html><meta charset="utf-8"><title>{name}</title>
<style>
body{{margin:0;background:#0d1117;font:13px/1.45 Consolas,'Cascadia Mono',monospace;color:#c9d1d9}}
.bar{{background:#161b22;padding:10px 16px;border-bottom:1px solid #30363d;color:#8b949e}}
.bar b{{color:#58a6ff}} .dot{{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px}}
pre{{margin:0;padding:16px;white-space:pre-wrap}} .ok{{color:#3fb950}} .ko{{color:#f85149}}
</style>
<div class="bar"><span class="dot" style="background:#f85149"></span><span class="dot" style="background:#d29922"></span><span class="dot" style="background:#3fb950"></span>
&nbsp;PS C:\\resumematch-ai&gt; <b>{html.escape(command)}</b></div>
<pre>{body}</pre>""",
            encoding="utf-8",
        )
        print("wrote", name)


if __name__ == "__main__":
    main()
