"""Render a Markdown report (default TECHNICAL_REPORT.md) as a styled, printable .html next to it.

Usage: python build_html.py [source.md]  (PDF via frontend/scripts/report-to-pdf.mjs)
"""

import re
import sys
from pathlib import Path

import markdown

SRC = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "TECHNICAL_REPORT.md"

CSS = """
@page { size: A4; margin: 16mm 14mm; }
body { font: 10.5pt/1.5 'Segoe UI', Calibri, sans-serif; color: #1c2b25; max-width: 1000px; margin: auto; padding: 24px; }
h1 { color: #14352b; font-size: 24pt; border-bottom: 3px solid #2f8f73; padding-bottom: 6px; }
h2 { color: #1f4d3e; font-size: 16pt; margin-top: 28px; border-bottom: 1px solid #cfe3d9; padding-bottom: 4px; page-break-after: avoid; }
h3 { color: #1f4d3e; font-size: 12.5pt; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 10px 0 16px; font-size: 9pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: #dcefe6; color: #14352b; text-align: left; }
th, td { border: 1px solid #c4d8ce; padding: 5px 7px; vertical-align: top; }
td img { width: 100%; border: 1px solid #c4d8ce; }
p > img, body > p img { display: block; max-width: 100%; margin: 10px auto; border: 1px solid #c4d8ce; box-shadow: 0 2px 8px rgba(0,0,0,.08); page-break-inside: avoid; }
code { font-family: Consolas, monospace; background: #eef4f1; padding: 1px 4px; border-radius: 3px; font-size: 9pt; }
pre { background: #0f1f19; color: #d7efe4; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 8.5pt; page-break-inside: avoid; }
pre code { background: none; color: inherit; }
blockquote { border-left: 4px solid #2f8f73; margin: 10px 0; padding: 4px 12px; background: #f1f8f4; font-style: italic; }
hr { border: none; border-top: 1px solid #cfe3d9; margin: 22px 0; }
"""


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    title = re.search(r"^# (.+)$", text, re.M)
    lang = "en" if SRC.stem == "TECHNICAL_REPORT" else "fr"
    body = markdown.markdown(text, extensions=["tables", "fenced_code"])
    dest = SRC.with_suffix(".html")
    dest.write_text(
        f'<!doctype html><html lang="{lang}"><meta charset="utf-8"><title>{title.group(1) if title else SRC.stem}</title>'
        f"<style>{CSS}</style><body>{body}</body></html>",
        encoding="utf-8",
    )
    print("wrote", dest)


if __name__ == "__main__":
    main()
