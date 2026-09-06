#!/usr/bin/env python3
"""Structural sanity for the generated HTML: balanced div nesting, one <h1>,
required landmarks present, no leftover template braces."""
import re, pathlib, sys
NOIR = pathlib.Path(__file__).resolve().parent.parent
fails = []
for pg in sorted(NOIR.rglob("*.html")):
    t = pg.read_text(encoding="utf-8")
    rel = pg.relative_to(NOIR)
    body = re.search(r"(?s)<body.*?</body>", t)
    if not body:
        fails.append((rel, "no <body>")); continue
    b = body.group(0)
    opens  = len(re.findall(r"<div\b", b))
    closes = len(re.findall(r"</div>", b))
    if opens != closes:
        fails.append((rel, f"div imbalance: {opens} open vs {closes} close"))
    if body.group(0).count("<main") != 1:
        fails.append((rel, "expected exactly one <main> landmark"))
    if 'href="#content"' not in body.group(0):
        fails.append((rel, "missing skip-to-content link"))
    for tag in ("section", "header", "footer", "nav", "figure"):
        o = len(re.findall(rf"<{tag}\b", b)); c = len(re.findall(rf"</{tag}>", b))
        if o != c:
            fails.append((rel, f"<{tag}> imbalance: {o}/{c}"))
    h1 = len(re.findall(r"<h1\b", b))
    if h1 != 1:
        fails.append((rel, f"{h1} <h1> (want exactly 1)"))
    for bad in ("{'", "{len(", "{''.join", "None", "{d[", "{up}"):
        if bad in b:
            fails.append((rel, f"unrendered template fragment: {bad!r}"))
    if "canvas id=\"sky\"" not in b: fails.append((rel, "missing sky canvas"))
    if "scene.js" not in t: fails.append((rel, "scene.js not linked"))
    if not re.search(r'<title>.{5,}</title>', t): fails.append((rel, "empty title"))
    if not re.search(r'name="description" content=".{20,}"', t): fails.append((rel, "thin meta description"))
print(f"validated {len(list(NOIR.rglob('*.html')))} pages")
if fails:
    print(f"\n{len(fails)} FAILURE(S):")
    for r, w in fails: print(f"  {r}: {w}")
    sys.exit(1)
print("OK: structure, headings, landmarks and metadata all sound.")
