"""
Validação local da separação (roda no mesmo contêiner do worker).

1) Gabarito sintético (`synthetic`): monta uma música com notas gravadas de verdade (public/samples:
   bateria, baixo, piano, guitarra base e guitarra solo), em que um trecho tem SOLO E BASE ao mesmo
   tempo. Como cada fonte é conhecida, mede quanto de cada uma foi parar em cada faixa:

       captura(fonte -> faixa) = <faixa, fonte> / <fonte, fonte>     (1 = foi inteira para a faixa)

   e quanto de guitarra sobra no "karaokê sem guitarra" (soma das outras faixas) no trecho do solo.

2) Arquivo real (`file <áudio>`): separa e mostra a energia de cada faixa a cada janela, para achar o
   trecho do solo e ver se base e solo saíram juntos em "guitar". Grava as faixas em mp3 para ouvir.

    docker run --rm -v <repo>/public/samples:/samples -v <saída>:/out IMAGEM python validate.py synthetic
    docker run --rm -v <pasta>:/in -v <saída>:/out IMAGEM python validate.py file "/in/musica.mp3"

3) Real com gabarito (`overlay <banda> <guitarra>`): soma uma guitarra gravada sozinha a uma música
   inteira que já tem guitarra base, e mede para onde a guitarra somada foi.
"""
from __future__ import annotations

import json
import os
import sys
import time

import numpy as np

from separate import SR, decode, encode_mp3, separate

SAMPLES = os.environ.get("SAMPLES_DIR", "/samples")
OUT = os.environ.get("OUT_DIR", "/out")


# ---------------------------------------------------------------------------------------------
# Música sintética com gabarito
# ---------------------------------------------------------------------------------------------

def _load(path: str) -> np.ndarray:
    y = decode(path, min_seconds=0).mean(axis=0)
    start = int(np.argmax(np.abs(y) > 0.02 * (np.abs(y).max() + 1e-9)))
    y = y[start:]
    return y / (np.abs(y).max() + 1e-9)


_cache: dict[str, np.ndarray] = {}


def note(bank: str, midi: int) -> np.ndarray:
    key = f"{bank}/{midi}"
    if key not in _cache:
        _cache[key] = _load(os.path.join(SAMPLES, bank, f"{midi}.mp3"))
    return _cache[key]


def drum(name: str) -> np.ndarray:
    if name not in _cache:
        _cache[name] = _load(os.path.join(SAMPLES, "drums", f"{name}.wav"))
    return _cache[name]


def put(buf: np.ndarray, x: np.ndarray, at: float, gain: float, dur: float | None = None, pan: float = 0.0):
    """Soma `x` (mono) em `buf` [2, n] no segundo `at`, com fade no fim e panorâmica (-1 esq .. 1 dir)."""
    i = int(at * SR)
    if dur is not None:
        x = x[: int(dur * SR)].copy()
        f = min(len(x), int(0.03 * SR))
        if f:
            x[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
    n = min(len(x), buf.shape[1] - i)
    if n <= 0:
        return
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + n] += gain * left * x[:n]
    buf[1, i:i + n] += gain * right * x[:n]


def overdrive(x: np.ndarray, drive: float = 6.0) -> np.ndarray:
    return (np.tanh(drive * x) / np.tanh(drive)).astype(np.float32)


# Progressão em Am (i - VI - III - VII), 4 tempos por acorde, 100 BPM.
CHORDS = [  # (nome, notas da guitarra base, fundamental do baixo)
    ("Am", [57, 64, 69, 72], 33), ("F", [53, 60, 65, 69], 29),
    ("C", [55, 60, 64, 67], 36), ("G", [55, 59, 62, 67], 31),
]
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
# Seções: 4 compassos só base, 8 compassos SOLO + BASE, 4 compassos só base.
SECTIONS = [("verso", 4, False), ("solo", 8, True), ("final", 4, False)]
# Frase do solo (pentatônica de Lá menor), em colcheias: (midi, duração em colcheias)
SOLO_PHRASE = [(69, 1), (72, 1), (74, 2), (76, 1), (74, 1), (72, 2), (69, 1), (67, 1), (69, 4),
               (74, 1), (76, 1), (79, 2), (76, 1), (74, 1), (74, 2), (72, 1), (74, 1), (76, 4)]


def synthetic_mix() -> tuple[dict[str, np.ndarray], list[tuple[str, float, float]]]:
    bars = sum(s[1] for s in SECTIONS)
    n = int((bars * BAR + 2) * SR)
    src = {k: np.zeros((2, n), dtype=np.float32) for k in ["drums", "bass", "piano", "rhythm_gtr", "lead_gtr"]}
    rng = np.random.default_rng(7)
    spans = []
    bar = 0
    for name, nbars, with_solo in SECTIONS:
        t_sec = bar * BAR
        spans.append((name, t_sec, t_sec + nbars * BAR))
        for b in range(nbars):
            t0 = (bar + b) * BAR
            _, gtr, root = CHORDS[(bar + b) % 4]
            for beat in range(4):
                tb = t0 + beat * BEAT
                put(src["drums"], drum("kick_v5_1" if beat in (0, 2) else "snare_v6_1"), tb, 0.9)
                for e in range(2):
                    put(src["drums"], drum("hat_v4_1"), tb + e * BEAT / 2, 0.35, pan=0.3)
                put(src["bass"], note("baixo", root), tb, 0.8, dur=BEAT * 0.9)
                # guitarra base: batida para baixo/cima em colcheias, cordas com pequeno atraso
                for e, down in ((0, True), (0.5, False)):
                    strum = gtr if down else gtr[::-1]
                    for k, m in enumerate(strum):
                        put(src["rhythm_gtr"], overdrive(note("guitarra", m), 2.5), tb + e * BEAT + k * 0.012,
                            0.28 * (1.0 if down else 0.7), dur=BEAT * 0.5, pan=-0.6)
            for m in gtr[:3]:  # piano segura o acorde
                put(src["piano"], note("piano", m - 12), t0, 0.22, dur=BAR * 0.95, pan=0.2)
        if with_solo:
            t = t_sec
            end = t_sec + nbars * BAR
            while t < end - 0.01:
                for midi, eighths in SOLO_PHRASE:
                    d = eighths * BEAT / 2
                    if t >= end - 0.01:
                        break
                    put(src["lead_gtr"], overdrive(note("guitarra", midi), 8.0), t + rng.normal(0, 0.005),
                        0.5, dur=d * 0.98, pan=0.5)
                    t += d
        bar += nbars
    return src, spans


def capture(est: np.ndarray, ref: np.ndarray) -> float:
    den = float(np.sum(ref * ref))
    return float(np.sum(est * ref) / den) if den > 1e-9 else float("nan")


def run_synthetic():
    os.makedirs(OUT, exist_ok=True)
    src, spans = synthetic_mix()
    mix = sum(src.values())
    peak = float(np.abs(mix).max())
    for k in src:
        src[k] /= peak / 0.9
    mix = sum(src.values()).astype(np.float32)
    encode_mp3(mix, os.path.join(OUT, "synthetic_mix.mp3"))
    # separa a partir do mp3 (como no app), não do sinal limpo
    wav = decode(os.path.join(OUT, "synthetic_mix.mp3"))
    t0 = time.monotonic()
    res = separate(wav)
    elapsed = time.monotonic() - t0
    stems = {name: res.stems[i] * res.gain for i, name in enumerate(res.names)}
    n = min(mix.shape[1], wav.shape[1])
    # o mp3 tem o mesmo comprimento (o cabeçalho LAME tira o atraso do codificador); confere o alinhamento
    lag = int(np.argmax(np.correlate(wav[0, SR:SR * 3], mix[0, SR:SR * 3 + 2000], mode="full"))) - (2000 + 2 * SR - 1)

    report = {"elapsed_s": round(elapsed, 1), "audio_s": round(n / SR, 1), "mp3_lag_samples": lag, "sections": {}}
    for name, a, b in spans:
        i, j = int(a * SR), min(int(b * SR), n)
        sec = {}
        for s_name in ["lead_gtr", "rhythm_gtr", "bass", "drums", "piano"]:
            ref = src[s_name][:, i:j]
            if np.sum(ref * ref) < 1e-6:
                continue
            sec[s_name] = {stem: round(capture(stems[stem][:, i:j], ref), 3) for stem in res.names}
        # karaokê sem guitarra: soma das outras faixas; quanto de cada guitarra ainda sobra nela
        no_gtr = sum(stems[s][:, i:j] for s in res.names if s != "guitar")
        sec["sem_guitarra_sobra"] = {
            g: round(capture(no_gtr, src[g][:, i:j]), 3)
            for g in ["lead_gtr", "rhythm_gtr"] if np.sum(src[g][:, i:j] ** 2) > 1e-6
        }
        report["sections"][name] = sec
    for stem, x in stems.items():
        encode_mp3(x / res.gain, os.path.join(OUT, f"synthetic_{stem}.mp3"))
    print(json.dumps(report, indent=2, ensure_ascii=False))
    with open(os.path.join(OUT, "synthetic_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------------------------
# Arquivo real
# ---------------------------------------------------------------------------------------------

def run_file(path: str, win_s: float = 5.0):
    os.makedirs(OUT, exist_ok=True)
    base = os.path.splitext(os.path.basename(path))[0]
    wav = decode(path)
    t0 = time.monotonic()
    res = separate(wav)
    elapsed = time.monotonic() - t0
    stems = {name: res.stems[i] * res.gain for i, name in enumerate(res.names)}
    win = int(win_s * SR)
    rows = []
    mix_db = []
    for k in range(0, wav.shape[1] - win // 2, win):
        seg = slice(k, k + win)
        tot = float(np.mean(wav[:, seg] ** 2)) + 1e-12
        mix_db.append(10 * np.log10(tot))
        rows.append({s: round(float(np.mean(x[:, seg] ** 2)) / tot, 3) for s, x in stems.items()})
    resid = wav - sum(stems.values())
    report = {
        "file": os.path.basename(path), "elapsed_s": round(elapsed, 1), "audio_s": round(res.duration, 1),
        "residual_db": round(10 * np.log10(float(np.mean(resid ** 2)) / float(np.mean(wav ** 2)) + 1e-12), 1),
        "share_overall": {s: round(float(np.mean(x ** 2)) / float(np.mean(wav ** 2)), 3) for s, x in stems.items()},
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nfração da energia por faixa a cada {win_s:.0f}s (gtr = guitarra):")
    names = list(stems)
    print("   t  " + " ".join(f"{s[:6]:>6}" for s in names))
    for i, r in enumerate(rows):
        bar = "#" * int(round(r.get("guitar", 0) * 30))
        print(f"{int(i * win_s) // 60:2d}:{int(i * win_s) % 60:02d} " + " ".join(f"{r[s]:6.2f}" for s in names) + f"  {bar}")
    report["windows"] = rows
    for stem, x in stems.items():
        encode_mp3(x / res.gain, os.path.join(OUT, f"{base}_{stem}.mp3"))
    with open(os.path.join(OUT, f"{base}_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------------------------
# Gravações reais com gabarito: uma guitarra gravada sozinha somada por cima de uma banda inteira
# ---------------------------------------------------------------------------------------------

def run_overlay(band_path: str, guitar_path: str, start_s: float = 30.0, dur_s: float = 60.0, guitar_db: float = -3.0):
    """
    Soma uma faixa de guitarra REAL (gravada sozinha) a uma música REAL que já tem guitarra base:
    o trecho vira "solo + base ao mesmo tempo" e a guitarra adicionada é o gabarito.
    Mede quanto dela vai para a faixa Guitarra e quanto sobra no "karaokê sem guitarra".
    """
    os.makedirs(OUT, exist_ok=True)
    i0, n = int(start_s * SR), int(dur_s * SR)
    band = decode(band_path)[:, i0:i0 + n]
    gtr = decode(guitar_path)[:, :n]
    n = min(band.shape[1], gtr.shape[1])
    band, gtr = band[:, :n], gtr[:, :n]
    gtr = gtr * (np.sqrt(np.mean(band ** 2) / (np.mean(gtr ** 2) + 1e-12)) * 10 ** (guitar_db / 20))
    mix = band + gtr
    peak = float(np.abs(mix).max())
    if peak > 0.98:
        mix, band, gtr = mix * 0.98 / peak, band * 0.98 / peak, gtr * 0.98 / peak
    res = separate(mix.astype(np.float32))
    stems = {name: res.stems[i] * res.gain for i, name in enumerate(res.names)}
    no_gtr = sum(stems[s] for s in res.names if s != "guitar")
    # a guitarra que já estava na banda (base): quanto da banda foi para Guitarra quando separamos só a banda
    res_band = separate(band.astype(np.float32))
    band_gtr = res_band.stems[res_band.names.index("guitar")] * res_band.gain
    report = {
        "band": os.path.basename(band_path), "guitar": os.path.basename(guitar_path),
        "trecho_s": [start_s, start_s + n / SR], "guitarra_adicionada_db": guitar_db,
        "guitarra_adicionada_para": {s: round(capture(stems[s], gtr), 3) for s in res.names},
        "sobra_da_guitarra_adicionada_sem_guitarra": round(capture(no_gtr, gtr), 3),
        "guitarra_da_banda_tambem_em_guitar": round(capture(stems["guitar"], band_gtr), 3)
        if np.sum(band_gtr ** 2) > 1e-6 else None,
        "energia_guitarra_da_banda_vs_banda": round(float(np.mean(band_gtr ** 2) / np.mean(band ** 2)), 3),
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    base = "overlay_" + os.path.splitext(os.path.basename(band_path))[0]
    encode_mp3(mix, os.path.join(OUT, f"{base}_mix.mp3"))
    encode_mp3(no_gtr / res.gain, os.path.join(OUT, f"{base}_sem_guitarra.mp3"))
    with open(os.path.join(OUT, f"{base}_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "synthetic"
    if cmd == "synthetic":
        run_synthetic()
    elif cmd == "file" and len(sys.argv) > 2:
        run_file(sys.argv[2])
    elif cmd == "overlay" and len(sys.argv) > 3:
        run_overlay(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
        sys.exit(2)
