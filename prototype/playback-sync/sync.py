"""
Sincroniza um playback (mp3/wav) com uma cifra e gera:
- <saida>.sync.json  — linha do tempo (o que a Function vai gravar no Firestore);
- <saida>.html       — página de teste: toca o áudio com a cifra rolando e a linha destacada.

    python sync.py playback.mp3 cifra.html            # cifra no formato do app (<pre> com <b>)
    python sync.py playback.mp3 cifra.txt             # ou texto copiado do Cifra Club
    python sync.py playback.mp3 cifra.txt --tom -2    # força a transposição (em semitons)
"""
from __future__ import annotations

import argparse
import html
import json
import os
import time

from align import align
from cifra import parse_cifra
from features import analyze

NOTE = "C C# D D# E F F# G G# A A# B".split()
REVIEW_BELOW = 0.6


def build(audio: str, cifra_path: str, transpose: int | None, out_base: str) -> dict:
    src = open(cifra_path, encoding="utf-8").read()
    cifra = parse_cifra(src)
    t0 = time.time()
    a = analyze(audio)
    res = align(cifra, a, transpose)
    took = time.time() - t0

    timeline = []
    for item in res.timeline:
        e = cifra.events[item["event"]] if item["event"] is not None else None
        timeline.append({
            "t": round(item["t"], 3),
            "event": item["event"],
            "lyricIdx": e.lyric_idx if e else None,
            "text": e.text if e else None,
            "chords": [c.name for c in e.chords] if e else None,
            "section": cifra.sections[e.section].title if e else None,
            "conf": None if item["conf"] is None else round(item["conf"], 3),
            "review": item["conf"] is not None and item["conf"] < REVIEW_BELOW,
        })
    data = {
        "audio": os.path.basename(audio),
        "duration": round(a.duration, 2),
        "bpm": round(a.bpm, 1),
        "transpose": res.transpose,
        "beats": [round(float(b), 3) for b in a.beats],
        "timeline": timeline,
        "processingSeconds": round(took, 2),
        "events": [
            {"idx": e.idx, "section": e.section, "sectionTitle": cifra.sections[e.section].title,
             "text": e.text, "chords": [c.name for c in e.chords], "lyricIdx": e.lyric_idx}
            for e in cifra.events
        ],
    }
    with open(out_base + ".sync.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    # áudio embutido (data URI): a página funciona sozinha, em qualquer lugar
    import base64, mimetypes
    mime = mimetypes.guess_type(audio)[0] or "audio/mpeg"
    audio_src = f"data:{mime};base64," + base64.b64encode(open(audio, "rb").read()).decode()
    with open(out_base + ".html", "w", encoding="utf-8") as f:
        f.write(PAGE.replace("__DATA__", json.dumps(data, ensure_ascii=False))
                .replace("__AUDIO__", audio_src)
                .replace("__TITLE__", html.escape(os.path.basename(audio))))
    return data


PAGE = r"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sincronia · __TITLE__</title>
<style>
  :root { color-scheme: light dark; --bg:#fafaf7; --fg:#1d1d1b; --mut:#8a8a84; --hl:#fff1b8; --acc:#2f6fdb; --warn:#e0a100; --line:#e6e4dc; }
  @media (prefers-color-scheme: dark) { :root { --bg:#161614; --fg:#ecebe6; --mut:#8d8c86; --hl:#4a3f12; --acc:#7aa7ff; --warn:#e3b341; --line:#2b2a27; } }
  * { box-sizing: border-box; }
  body { margin:0; font: 16px/1.45 system-ui, sans-serif; background:var(--bg); color:var(--fg); }
  header { position:sticky; top:0; z-index:2; background:var(--bg); border-bottom:1px solid var(--line); padding:12px 20px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  header h1 { font-size:15px; margin:0; font-weight:600; }
  .meta { color:var(--mut); font-size:13px; font-variant-numeric: tabular-nums; }
  audio { width: min(520px, 100%); }
  main { max-width: 760px; margin: 0 auto; padding: 24px 20px 50vh; }
  .sec { margin: 22px 0 6px; font-size: 13px; color: var(--mut); text-transform: uppercase; letter-spacing: .04em; }
  .ln { padding: 6px 10px; border-radius: 8px; cursor: pointer; transition: background .15s; border-left: 3px solid transparent; }
  .ln:hover { background: color-mix(in srgb, var(--hl) 45%, transparent); }
  .ln.on { background: var(--hl); }
  .ln.review { border-left-color: var(--warn); }
  .ch { font: 600 14px/1.2 ui-monospace, monospace; color: var(--acc); white-space: pre; }
  .tx { font-size: 19px; }
  .ts { float:right; color: var(--mut); font-size: 12px; font-variant-numeric: tabular-nums; }
  .gap { color: var(--mut); font-style: italic; font-size: 14px; }
  .legend { font-size:12px; color:var(--mut); }
  .legend b { display:inline-block; width:10px; height:10px; background:var(--warn); border-radius:2px; margin-right:4px; vertical-align:-1px; }
</style></head>
<body>
<header>
  <h1>__TITLE__</h1>
  <audio id="au" controls preload="auto" src="__AUDIO__"></audio>
  <span class="meta" id="meta"></span>
  <span class="legend"><b></b>conferir (confiança baixa) · clique numa linha para tocar dali</span>
</header>
<main id="sheet"></main>
<script>
const D = __DATA__;
const au = document.getElementById('au');
const sheet = document.getElementById('sheet');
const NOTE = 'C C# D D# E F F# G G# A A# B'.split(' ');
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
document.getElementById('meta').textContent =
  `${D.bpm} BPM · tom do playback: ${D.transpose === 0 ? 'igual à cifra' : (D.transpose > 0 ? '+' : '') + D.transpose + ' semitons'} · análise em ${D.processingSeconds}s`;

// cifra na ordem escrita; cada linha guarda as vezes em que é tocada
const occ = {};
D.timeline.forEach((it, i) => { if (it.event != null) (occ[it.event] ??= []).push(i); });
const rows = {};
let lastSec = -1;
for (const e of D.events) {
  if (e.section !== lastSec) {
    const s = document.createElement('div'); s.className = 'sec'; s.textContent = e.sectionTitle || '·'; sheet.appendChild(s);
    lastSec = e.section;
  }
  const r = document.createElement('div'); r.className = 'ln';
  const times = (occ[e.idx] || []).map((i) => D.timeline[i]);
  if (times.some((t) => t.review)) r.classList.add('review');
  r.innerHTML = `<span class="ts">${times.map((t) => fmt(t.t)).join(' · ') || '—'}</span>` +
    (e.chords.length ? `<div class="ch">${e.chords.join('   ')}</div>` : '') +
    (e.text ? `<div class="tx"></div>` : '');
  if (e.text) r.querySelector('.tx').textContent = e.text;
  r.onclick = () => {
    if (!times.length) return;
    const now = au.currentTime;
    const next = times.find((t) => t.t > now - 0.5) || times[0];
    au.currentTime = Math.max(0, next.t - 0.4); au.play();
  };
  rows[e.idx] = r; sheet.appendChild(r);
}

// linha atual = último item da linha do tempo que já começou (com 0,25 s de antecedência)
const LEAD = 0.25;
let cur = null;
function tick() {
  const t = au.currentTime + LEAD;
  let k = -1;
  for (let i = 0; i < D.timeline.length; i++) { if (D.timeline[i].t <= t) k = i; else break; }
  const ev = k >= 0 ? D.timeline[k].event : null;
  if (ev !== cur) {
    if (cur != null) rows[cur]?.classList.remove('on');
    cur = ev;
    if (cur != null && rows[cur]) {
      rows[cur].classList.add('on');
      const r = rows[cur].getBoundingClientRect();
      const want = window.innerHeight * 0.35;
      window.scrollBy({ top: r.top - want, behavior: 'smooth' });
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
document.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); au.paused ? au.play() : au.pause(); } });
</script>
</body></html>
"""

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("cifra")
    ap.add_argument("--tom", type=int, default=None, help="transposição do playback em semitons (detecta sozinho se omitido)")
    ap.add_argument("--saida", default=None, help="caminho base da saída (padrão: out/<nome do áudio>)")
    args = ap.parse_args()
    base = args.saida or os.path.join(os.path.dirname(__file__), "out", os.path.splitext(os.path.basename(args.audio))[0])
    os.makedirs(os.path.dirname(os.path.abspath(base)), exist_ok=True)
    d = build(args.audio, args.cifra, args.tom, base)
    n_rev = sum(1 for t in d["timeline"] if t["review"])
    print(f"{d['duration']:.0f}s · {d['bpm']} BPM · transposição {d['transpose']:+d} · {len(d['timeline'])} itens "
          f"· {n_rev} para conferir · {d['processingSeconds']}s")
    print("página de teste:", os.path.abspath(base + ".html"))
