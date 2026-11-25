"""
Peças comuns ao worker do Cloud Run (processamento completo de um playback) e às Functions
(re-sincronizar quando a cifra muda): ler a cifra, montar os campos do resultado e guardar/ler a
análise do áudio e as palavras reconhecidas na voz.
"""
from __future__ import annotations

import hashlib
import io
import json

import numpy as np

from .cifra import Cifra, parse_cifra
from .features import Analysis


def load_cifra(db, lyric_id: str) -> tuple[Cifra, str]:
    lyric = db.collection("lyrics").document(lyric_id).get()
    html = lyric.get("lyric") if lyric.exists else None
    if not html:
        raise ValueError("Música sem cifra")
    cifra = parse_cifra(html)
    if not any(e.chords for e in cifra.events):
        raise ValueError("A cifra não tem acordes para sincronizar")
    return cifra, html


def result_fields(cifra: Cifra, html: str, a: Analysis, res) -> dict:
    """Campos do documento do playback com a sincronia pronta (sem o updatedAt)."""
    timeline = []
    for item in res.timeline:
        e = cifra.events[item["event"]] if item["event"] is not None else None
        timeline.append({
            "t": round(item["t"], 3),
            "lyricIdx": e.lyric_idx if e else None,
            "text": e.text if e and e.text else None,
            "chords": [c.name for c in e.chords] if e else None,
            "section": (cifra.sections[e.section].title or None) if e else None,
            "conf": None if item["conf"] is None else round(item["conf"], 3),
        })
    return {
        "status": "ready",
        "error": None,
        "durationSec": round(a.duration, 2),
        "bpm": round(a.bpm, 1),
        "transpose": res.transpose,
        "timeline": timeline,
        "cifraHash": hashlib.sha1(html.encode("utf-8")).hexdigest(),
    }


def analysis_bytes(a: Analysis) -> bytes:
    buf = io.BytesIO()
    np.savez_compressed(buf, beats=a.beats, units=a.units, chroma=a.chroma, bass=a.bass,
                        energy=a.energy, meta=np.array([a.duration, a.bpm]))
    return buf.getvalue()


def analysis_from_bytes(raw: bytes) -> Analysis:
    z = np.load(io.BytesIO(raw))
    duration, bpm = (float(x) for x in z["meta"])
    return Analysis(duration=duration, bpm=bpm, beats=z["beats"], units=z["units"], chroma=z["chroma"],
                    bass=z["bass"], energy=z["energy"])


def words_bytes(words: list[dict], model: str) -> bytes:
    return json.dumps({"model": model, "words": words}, ensure_ascii=False).encode("utf-8")


def words_from_bytes(raw: bytes) -> list[dict]:
    return json.loads(raw.decode("utf-8")).get("words") or []


# ---------------------------------------------------------------- acordes (consonance-ACE)

def chords_path(uid: str, playback_id: str) -> str:
    """Acordes reconhecidos pelo worker (worker/chords_ace.py), guardados para regenerar sem PyTorch."""
    return f"playbacks/{uid}/analysis/{playback_id}.chords.json"


def chords_bytes(doc: dict) -> bytes:
    """`doc`: {model, segments: [{t0, t1, label}], ...}."""
    return json.dumps(doc, ensure_ascii=False).encode("utf-8")


def chords_from_bytes(raw: bytes) -> dict:
    return json.loads(raw.decode("utf-8"))


def generated_from(a: Analysis, chords_doc: dict, words: list[dict] | None, gin: dict | None,
                   model: str | None = None):
    """Gera a cifra e monta o campo `generated` (sem os carimbos de tempo). Devolve (Generated, campos)."""
    from .generate import generate, generated_fields

    gin = gin or {}
    g = generate(a, chords_doc["segments"], words or None, lyrics=gin.get("lyrics") or None,
                 synced=gin.get("synced") or None)
    return g, {**generated_fields(g, model, chords_doc.get("model")),
               "lyricsFrom": gin.get("source") if gin.get("lyrics") else None,
               "status": "ready", "error": None}
