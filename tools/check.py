#!/usr/bin/env python3
"""Standalone-ness check for noir/: every href/src resolves inside the folder,
nothing absolute, nothing left pointing at a CDN or the old site."""
import re, pathlib, sys, urllib.parse

NOIR = pathlib.Path(__file__).resolve().parent.parent
pages = sorted(NOIR.rglob("*.html"))
bad, ext, checked = [], set(), 0

for pg in pages:
    txt = pg.read_text(encoding="utf-8")
    for attr, url in re.findall(r'(?:href|src)="([^"]*)"', txt) and \
                     [("", u) for u in re.findall(r'(?:href|src)="([^"]*)"', txt)]:
        u = url.strip()
        if not u or u.startswith(("mailto:", "tel:", "data:", "#")):
            continue
        if u.startswith(("http://", "https://")):
            ext.add(u.split("/")[2]); continue
        if u.startswith("/"):
            bad.append((pg, u, "ABSOLUTE path breaks a GitHub project page")); continue
        if u.startswith("../") and "../" * 3 in u:
            bad.append((pg, u, "escapes the folder")); continue
        target = (pg.parent / urllib.parse.unquote(u.split("#")[0].split("?")[0])).resolve()
        checked += 1
        try:
            target.relative_to(NOIR)
        except ValueError:
            bad.append((pg, u, "resolves OUTSIDE noir/")); continue
        if not target.exists():
            bad.append((pg, u, "missing file"))

print(f"pages: {len(pages)}   internal refs checked: {checked}")
print("external hosts:", ", ".join(sorted(ext)) or "none")
if bad:
    print(f"\n{len(bad)} PROBLEM(S):")
    for pg, u, why in bad:
        print(f"  {pg.relative_to(NOIR)}  ->  {u}   ({why})")
    sys.exit(1)
print("\nOK: every internal reference resolves inside noir/, no absolute paths.")
