#!/usr/bin/env python3
"""
Generate the noir/ site. Content is read from the ORIGINAL pages one level up,
so nothing is retyped by hand: run this from noir/tools/ any time the source
pages change.

    python3 noir/tools/build.py

Everything it writes is inside noir/. The old site is never touched.
"""
import re, html, os, pathlib

HERE = pathlib.Path(__file__).resolve().parent
NOIR = HERE.parent
SRC  = NOIR.parent                      # the original site root

# ---------------------------------------------------------------- helpers
def read(p):
    return (SRC / p).read_text(encoding="utf-8")

def strip_tags(s):
    s = re.sub(r"(?s)<(script|style)\b.*?</\1>", "", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()

def inner(s):
    """collapse whitespace inside a fragment but keep its tags"""
    return re.sub(r"\s+", " ", s).strip()

# ---------------------------------------------------------------- template
NAV = [("writing.html", "Research"), ("projects.html", "Projects"),
       ("about.html", "About"), ("index.html#contact", "Contact")]

import hashlib
def asset_v(rel):
    """short content hash so browsers refetch css/js when they change"""
    f = NOIR / rel
    return hashlib.sha1(f.read_bytes()).hexdigest()[:8] if f.exists() else "0"

def shell(*, up, title, desc, body, hour=None, plate=False, page="", current="", back=None):
    """up = relative prefix back to the noir root ('' or '../../')
    back = (href, label) for the back link; None on home. Defaults to Home."""
    hattr = f' data-hour="{hour}"' if hour else ""
    home_cur = ' aria-current="page"' if page == "home" else ""
    if page == "home":
        back_html = ""
        brand_lbl = ""
    else:
        brand_lbl = '<span class="bl">Home</span>'

        href, label = back or ("index.html", "Home")
        back_html = f'<a class="back" href="{up}{href}"><span aria-hidden="true">&larr;</span> {label}</a>'
    nav = ""
    home_lbl = ""
    return f"""<!DOCTYPE html>
<html lang="en"{hattr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="author" content="Pandu Ranga Reddy Konala">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<link rel="icon" href="{up}assets/icons/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="{up}assets/icons/favicon-32x32.png">
<link rel="apple-touch-icon" href="{up}assets/icons/apple-touch-icon.png">
<link rel="stylesheet" href="{up}assets/css/noir.css?v={asset_v("assets/css/noir.css")}">
</head>
<body{f' data-page="{page}"' if page else ""}>
<canvas id="sky"></canvas><div class="vig"></div><div class="grain"></div>
<div class="bar t"></div><div class="bar b"></div>
<nav class="bgsw" id="bgsw"><span class="lbl">Sky</span><a data-t="now">Now</a><a data-t="6.3">Dawn</a><a data-t="12">Day</a><a data-t="18.3">Dusk</a><a data-t="23">Night</a></nav>

<a class="skip" href="#content">Skip to content</a>
<header class="top">
  <nav class="rail" aria-label="Primary">
    <span class="slot">{back_html}</span>
    <a class="brand" href="{up}index.html"{home_cur} aria-label="Home"><img src="{up}assets/icons/fox.webp" alt="" width="28" height="28">{brand_lbl}</a>
    <span class="slot"></span>
  </nav>
</header>
<div class="shell">
<main id="content">
{body}
</main>
<footer id="contact">
  <p class="lets mono">Let's connect!</p>
  <a class="mail" href="mailto:p.konala.uow@gmail.com">p.konala.uow@gmail.com</a>
  <div class="links">
    <a href="https://github.com/PanduKonala" target="_blank" rel="noopener">GitHub</a>
    <a href="https://www.linkedin.com/in/pandu-konala-179064149/" target="_blank" rel="noopener">LinkedIn</a>
    <a href="https://app.hackthebox.com/profile/99839" target="_blank" rel="noopener">Hack The Box</a>
    <a href="{up}assets/files/CV_Konala_Pandu_2026.pdf" target="_blank" rel="noopener">CV</a>
  </div>
</footer>
</div>

<script type="module" src="{up}assets/js/scene.js?v={asset_v("assets/js/scene.js")}"></script>
</body>
</html>
"""

# ---------------------------------------------------------------- list data
# The cards in the old markup vary; the canonical list already lives in the
# sample we designed against, so read it from there and rewrite the hrefs.
def entries_from_sample(section_id):
    s = (SRC / "redesign-samples" / "d-noir.html").read_text(encoding="utf-8")
    block = re.search(r'(?s)<section id="%s">.*?</section>' % section_id, s).group(0)
    rows = []
    for m in re.finditer(r'(?s)<a class="entry" href="\.\./([^"]+)">'
                         r'<span class="yr">(.*?)</span>'
                         r'<h4>(.*?)</h4>'
                         r'<p class="abs">(.*?)</p>'
                         r'<span class="kind([^"]*)">(.*?)</span></a>', block):
        href, yr, title, abs_, kcls, kind = m.groups()
        rows.append(dict(href=href, yr=yr, title=title, abs=abs_,
                         kcls=kcls.strip(), kind=kind))
    return rows

RESEARCH = entries_from_sample("research")
PROJECTS = entries_from_sample("projects")
assert len(RESEARCH) == 8 and len(PROJECTS) == 7, (len(RESEARCH), len(PROJECTS))

def entry_html(r, up):
    k = f'kind {r["kcls"]}'.strip()
    return (f'<a class="entry" href="{up}{r["href"]}">'
            f'<span class="yr">{r["yr"]}</span>'
            f'<h4>{r["title"]}</h4>'
            f'<p class="abs">{r["abs"]}</p>'
            f'<span class="{k}">{r["kind"]}</span></a>')

# ---------------------------------------------------------------- detail pages
def parse_detail(path):
    s = read(path)
    b = re.sub(r"(?s)<(script|style)\b.*?</\1>", "", s)
    d = {}
    d["title"]  = inner(re.search(r"(?s)<h1>(.*?)</h1>", b).group(1))
    m = re.search(r'(?s)<span class="detail-badge">(.*?)</span>', b)
    d["badge"]  = inner(m.group(1)) if m else ""
    d["facts"]  = []
    for mi in re.finditer(r'(?s)<div class="meta-item">(.*?)</div>', b):
        chunk = mi.group(1)
        k = re.search(r'(?s)<span class="meta-label">(.*?)</span>', chunk)
        vs = re.findall(r'(?s)<span class="meta-value">(.*?)</span>', chunk)
        if k and vs:
            d["facts"].append((inner(k.group(1)), [inner(v) for v in vs]))
    d["sections"] = []
    for ms in re.finditer(r'(?s)<div class="detail-section"[^>]*>(.*?)</div>', b):
        chunk = ms.group(1)
        h = re.search(r"(?s)<h2>(.*?)</h2>", chunk)
        if not h:
            continue
        rest = chunk[h.end():]
        parts = re.findall(r"(?s)(<p>.*?</p>|<ul>.*?</ul>|<ol>.*?</ol>)", rest)
        d["sections"].append((inner(h.group(1)), [inner(p) for p in parts]))
    d["theme"] = (re.search(r'<body class="theme-(\w+)"', b) or [None, "green"])[1]
    return d

DETAILS = sorted(
    [p for p in (SRC / "blog-work").glob("*/*.html")] +
    [p for p in (SRC / "blog-projects").glob("*/*.html")]
)

def build_detail(p):
    rel  = p.relative_to(SRC).as_posix()          # blog-work/x/x.html
    d    = parse_detail(rel)
    up   = "../../"
    is_proj = rel.startswith("blog-projects")
    back = "projects.html" if is_proj else "writing.html"
    backlabel = "Projects" if is_proj else "Research"
    # find this page's list row for the date + one-line abstract
    row = next((r for r in (PROJECTS if is_proj else RESEARCH) if r["href"] == rel), None)
    pt  = "pt" if (row and row["kcls"] == "pt") else ""
    facts = "".join(
        f'<div class="f"><span class="k">{k}</span>' +
        "".join(f'<span class="v">{v}</span>' for v in vs) + "</div>"
        for k, vs in d["facts"])
    prose = "".join(
        f"<section><h2>{h}</h2>{''.join(ps)}</section>" for h, ps in d["sections"])
    body = f"""
<div class="masthead compact">
  <div class="crumb">
    <a href="{up}index.html">Home</a><span class="sep">/</span>
    <a href="{up}{back}">{backlabel}</a>
  </div>
  <h1 class="big title ink">{d['title']}</h1>
</div>

<section class="slab">
  <div class="panel detail">
    <div class="aside">
      <span class="badge {pt}">{d['badge'] or backlabel}</span>
      <div class="facts">{facts}</div>
      <p style="margin-top:22px"><a class="btn" href="{up}{back}">&larr; All {backlabel.lower()}</a></p>
    </div>
    <div class="prose">{prose}</div>
  </div>
</section>
"""
    out = NOIR / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(shell(up=up, title=f"{strip_tags(d['title'])} · Pandu Konala",
                         desc=strip_tags(row["abs"]) if row else strip_tags(d["title"]),
                         body=body, page="detail", back=(back, backlabel)), encoding="utf-8")
    return rel, len(d["facts"]), len(d["sections"])

# ---------------------------------------------------------------- about data
def about_data():
    b = re.sub(r"(?s)<(script|style|head)\b.*?</\1>", "", read("about.html"))
    d = {}
    d["paras"] = [inner(p) for p in re.findall(r"(?s)<p>(.*?)</p>",
                  re.search(r'(?s)<div class="about-text[^"]*">(.*?)</div>\s*</div>', b).group(1))]
    d["paras"] = [p for p in d["paras"] if len(strip_tags(p)) > 80][:2]
    # research principles
    d["pillars"] = [(inner(h), inner(p)) for h, p in
                    re.findall(r"(?s)<h3>(.*?)</h3>\s*<p>(.*?)</p>", b)][:3]
    # education cards carry a logo; principles do not
    edu = []
    for card in re.findall(r'(?s)<div class="education-card">(.*?)</div>\s*</div>', b):
        img  = re.search(r'src="assets/img/([^"]+)"', card)
        h3   = re.search(r"(?s)<h3>(.*?)</h3>", card)
        det  = [inner(x) for x in re.findall(r"(?s)<p>(.*?)</p>", card)]
        date = re.search(r'(?s)<p class="education-date">(.*?)</p>', card)
        if img and h3 and img.group(1) in ("waikato.png", "lancaster.png", "amrita.png"):
            dt = inner(date.group(1)) if date else ""
            edu.append(dict(logo=img.group(1), degree=inner(h3.group(1)),
                            lines=[x for x in det if x != dt], date=dt))
    d["edu"] = edu
    # timeline groups, keyed by the <h2> above them
    d["groups"] = []
    chunks = re.split(r"(?s)<h2[^>]*>(.*?)</h2>", b)
    for i in range(1, len(chunks) - 1, 2):
        head, blk = inner(chunks[i]), chunks[i + 1]
        rows = []
        for hdr in re.findall(r'(?s)<div class="timeline-header">(.*?)</div>', blk):
            date  = re.search(r'(?s)<span class="timeline-date">(.*?)</span>', hdr)
            title = re.search(r'(?s)<span class="timeline-title">(.*?)</span>', hdr)
            types = [inner(t) for t in re.findall(r'(?s)<span class="timeline-type">(.*?)</span>', hdr)]
            link  = re.search(r'(?s)<a([^>]+)>(.*?)</a>', hdr)
            if date and title:
                rows.append(dict(when=inner(date.group(1)), what=inner(title.group(1)),
                                 more=types, link=inner(link.group(0)) if link else ""))
        if rows:
            d["groups"].append((head, rows))
    # skills
    d["skills"] = [(inner(n), img) for img, n in
                   re.findall(r'(?s)<div class="skill-item"[^>]*>.*?src="assets/img/([^"]+)".*?<(?:span|p|h4)[^>]*>(.*?)</', b)]
    if not d["skills"]:
        d["skills"] = [(strip_tags(it), (re.search(r'src="assets/img/([^"]+)"', it) or [0,""])[1])
                       for it in re.findall(r'(?s)<div class="skill-item".*?</div>\s*</div>', b)]
        d["skills"] = [(n, i) for n, i in d["skills"] if n and i]
    d["cv_news"] = (re.search(r'href="(https://web\.archive\.org/[^"]+)"', b) or [None, "#"])[1]
    return d

# ---------------------------------------------------------------- pages
def build_index():
    """Home is one screen: masthead, a compact three-door strip, compact footer."""
    doors = [
        ("01", "writing.html",  "Research",  f"{len(RESEARCH)} papers &amp; patents"),
        ("02", "projects.html", "Projects",  f"{len(PROJECTS)} builds"),
        ("03", "about.html",    "About Me",  "The long version"),
    ]
    door_html = "".join(f'''
  <a class="door" href="{href}">
    <span class="dno mono">&sect; {no}</span>
    <h3>{title}</h3><em>{cta}</em><span class="arr" aria-hidden="true">&rarr;</span>
  </a>''' for no, href, title, cta in doors)

    body = f"""
<div class="masthead">
  <div class="kicker">
    <span class="mono">Associate Scientist &middot; The University of Waikato</span>
    <span class="tag">Scientist. Ethical Hacker. &amp; Much More.</span>
  </div>
  <h1 class="big ink" id="nm">Pandu|Konala</h1>
</div>

<div class="doors">{door_html}
</div>
"""
    (NOIR / "index.html").write_text(shell(
        up="", title="Pandu Konala — Scientist. Ethical Hacker. & Much More.",
        desc="Pandu Ranga Reddy Konala — Associate Scientist at the University of Waikato. "
             "Infrastructure as Code security, supply-chain integrity and quantum software engineering.",
        body=body, page="home"), encoding="utf-8")


def build_list(fname, num, heading, lede, rows, count_label):
    body = f"""
<div class="masthead compact">
  <div class="crumb"><a href="index.html">Home</a><span class="sep">/</span><span class="mono">{heading}</span></div>
  <h1 class="big ink">{heading}</h1>
  <p class="pglede ink-dim">{lede}</p>
</div>

<section class="slab">
  <div class="panel rv">
    <div class="shead"><span class="mono" style="color:var(--gold)">&sect; {num}</span><span class="dash"></span><span class="mono">{count_label}</span><h2>{heading}</h2></div>
    {''.join(entry_html(r, '') for r in rows)}
  </div>
</section>
"""
    (NOIR / fname).write_text(shell(
        up="", title=f"{heading} · Pandu Konala", desc=strip_tags(lede), body=body,
        page=fname.replace(".html", "")), encoding="utf-8")


def build_about():
    d = about_data()
    pillars = "".join(f'<div class="pillar"><h4>{h}</h4><p>{p}</p></div>' for h, p in d["pillars"])
    edu = "".join(
        f'<div class="row"><span class="when">{e["date"]}</span>'
        f'<div><h4>{e["degree"]}</h4><div class="where">{" &middot; ".join(e["lines"])}</div></div>'
        f'<span class="tag"><img src="assets/img/{e["logo"]}" alt="" height="26" '
        f'style="vertical-align:middle;opacity:.85;filter:grayscale(.3)"></span></div>'
        for e in d["edu"])
    body = f"""
<div class="masthead compact">
  <div class="crumb"><a href="index.html">Home</a><span class="sep">/</span><span class="mono">About</span></div>
  <h1 class="big ink">About Me</h1>
  <p class="pglede ink-dim">From curiosity to expertise.</p>
</div>

<section class="slab">
  <div class="panel about-grid rv">
    <div class="shead"><span class="mono" style="color:var(--gold)">&sect; 01</span><span class="dash"></span><span class="mono">Pandu Ranga Reddy Konala</span><h2>Who</h2></div>

    <figure>
      <img src="assets/img/portrait.jpg" alt="Pandu Konala" width="400" height="400">
      <figcaption class="mono" style="margin-top:10px">Hamilton, New Zealand</figcaption>
      <p style="margin-top:20px"><a class="cv" href="assets/files/CV_Konala_Pandu_2026.pdf" target="_blank" rel="noopener">View CV</a></p>
      <p style="margin-top:14px"><a class="mono" style="color:var(--cyan);text-decoration:none"
        href="{d['cv_news']}" target="_blank" rel="noopener">Cyber Security Project at Waikato &rarr;</a></p>
    </figure>
    <div>{''.join(f'<p>{p}</p>' for p in d['paras'])}</div>
  </div>
</section>

<section class="slab">
  <div class="panel rv">
    <div class="shead"><span class="mono" style="color:var(--gold)">&sect; 02</span><span class="dash"></span><span class="mono">How I work</span><h2>Research Principles</h2></div>
    <div class="pillars">{pillars}</div>
  </div>
</section>

<section class="slab">
  <div class="panel rv">
    <div class="shead"><span class="mono" style="color:var(--gold)">&sect; 03</span><span class="dash"></span><span class="mono">2015&ndash;2026</span><h2>Education</h2></div>
<div class="tl">{edu}</div></div>
</section>


"""
    (NOIR / "about.html").write_text(shell(
        up="", title="About · Pandu Konala",
        desc="Pandu Ranga Reddy Konala: research principles, education, certifications "
             "and professional experience. Full detail in the CV.", body=body, page="about"), encoding="utf-8")


def build_404():
    body = """
<div class="oops">
  <p class="mono" style="color:var(--gold)">Lost in the valley</p>
  <h1 class="code ink">404</h1>
  <p class="pglede ink-dim" style="max-width:34ch">That page is not on the map. The river keeps flowing though.</p>
  <p><a class="btn" href="index.html">Go home</a></p>
</div>
"""
    (NOIR / "404.html").write_text(shell(
        up="", title="404 · Pandu Konala",
        desc="That page could not be found on Pandu Konala's site. Head back to the home page.",
        body=body, hour="23", page="404"), encoding="utf-8")


def copy_local_pdfs():
    """Detail pages that link a PDF next to themselves: bring the file along."""
    n = 0
    for pg in NOIR.rglob("*.html"):
        for u in re.findall(r'href="([^":]+\.pdf)"', pg.read_text(encoding="utf-8")):
            dst = pg.parent / u
            if dst.exists():
                continue
            src = SRC / dst.resolve().relative_to(NOIR)
            if src.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(src.read_bytes()); n += 1
    if n:
        print(f"  copied {n} local pdf(s)")


def main():
    build_index()
    build_list("writing.html", "01", "Research",
               "Peer-reviewed papers and patents on Infrastructure as Code security, "
               "supply-chain integrity and decentralised systems.",
               RESEARCH, f"{len(RESEARCH)} papers &amp; patents")
    build_list("projects.html", "02", "Projects",
               "Things built end to end: quantum authentication, IoT safety systems, "
               "machine learning and cryptography.",
               PROJECTS, f"{len(PROJECTS)} builds")
    build_about()
    build_404()
    for p in DETAILS:
        rel, nf, ns = build_detail(p)
        print(f"  {rel:58s} {nf} facts, {ns} sections")
    copy_local_pdfs()
    print("built:", len(list(NOIR.rglob('*.html'))), "html files")


if __name__ == "__main__":
    main()
