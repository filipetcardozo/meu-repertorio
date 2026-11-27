"""
Playback enviado como faixas prontas (`source: 'stems'`, ex.: exportadas do Moises).

Em vez de separar, junta as faixas: cada uma é convertida para mp3 em
`playbacks/{uid}/stems/{id}/{nome}.mp3` (mesmo formato das faixas do Demucs, para o player), a soma vira o
áudio completo em `storagePath` (`playbacks/{uid}/{id}.mix.mp3`, usado pela análise da harmonia, pelos
acordes e pelo player sem faixas) e a soma das faixas de voz vai para o reconhecimento da letra.

As faixas enviadas ficam em `playbacks/{uid}/import/{id}/` até esta etapa terminar (o worker.py grava
`stems`, apaga `importStems` e apaga os originais). Reprocessar depois usa as faixas já convertidas.
"""
from __future__ import annotations

import os
import re
from typing import Callable

import numpy as np

VOCAL_NAMES = {"vocals", "lead_vocals", "backing_vocals"}
# fica disponível no mixer, mas não entra no áudio completo (atrapalharia a análise)
MIX_EXCLUDE = {"click"}
MAX_STEMS = 16
MODEL = "import"


def import_prefix(uid: str, playback_id: str) -> str:
    return f"playbacks/{uid}/import/{playback_id}/"


def mix_path(uid: str, playback_id: str) -> str:
    return f"playbacks/{uid}/{playback_id}.mix.mp3"


def imported_items(data: dict, playback_id: str) -> list[dict]:
    """Faixas enviadas, só as da pasta deste playback (o documento é gravado pelo app) e com nomes únicos."""
    prefix = import_prefix(data["userId"], playback_id)
    out: list[dict] = []
    seen: set[str] = set()
    for s in (data.get("importStems") or [])[:MAX_STEMS]:
        s = s or {}
        path = str(s.get("path") or "")
        if not path.startswith(prefix) or ".." in path or "/" in path[len(prefix):]:
            continue
        name = re.sub(r"[^a-z0-9_]", "", str(s.get("name") or "").lower())[:40] or f"faixa{len(out) + 1}"
        base, n = name, 2
        while name in seen:
            name, n = f"{base}_{n}", n + 1
        seen.add(name)
        label = str(s.get("label") or "").strip()[:40] or name
        out.append({"name": name, "label": label, "path": path})
    return out


def _add(acc: np.ndarray | None, w: np.ndarray) -> np.ndarray:
    if acc is None:
        return w.copy()
    if w.shape[1] > acc.shape[1]:
        acc = np.pad(acc, ((0, 0), (0, w.shape[1] - acc.shape[1])))
    acc[:, : w.shape[1]] += w
    return acc


def _fit(w: np.ndarray, n: int) -> np.ndarray:
    return w if w.shape[1] == n else np.pad(w, ((0, 0), (0, n - w.shape[1])))


def _peak(w: np.ndarray | None) -> float:
    return float(np.max(np.abs(w))) if w is not None and w.size else 0.0


def from_import(data: dict, bucket, tmp: str, playback_id: str,
                on_progress: Callable[[float], None] | None = None):
    """Converte as faixas enviadas. Devolve (stems_field, voz [2, n] ou None, áudio completo local,
    caminhos gravados no Storage, caminhos dos originais para apagar)."""
    from separate import SR, decode, encode_mp3

    uid = data["userId"]
    items = imported_items(data, playback_id)
    if not items:
        raise ValueError("Nenhuma faixa válida para importar.")
    if data.get("storagePath") != mix_path(uid, playback_id):
        raise ValueError("Caminho do áudio completo inválido.")
    prog = on_progress or (lambda _f: None)
    n_items = len(items)

    # baixa
    local: list[str] = []
    for i, it in enumerate(items):
        ext = os.path.splitext(it["path"])[1].lower() or ".mp3"
        dst = os.path.join(tmp, f"in{i:02d}{ext}")
        bucket.blob(it["path"]).download_to_filename(dst)
        local.append(dst)
        prog(0.3 * (i + 1) / n_items)

    # 1ª passada: tamanho, pico, soma (áudio completo) e voz, uma faixa por vez (pouca memória)
    mix = vocals = None
    peak, length = 0.0, 0
    for i, (it, src) in enumerate(zip(items, local)):
        w = decode(src, min_seconds=0.5)
        length = max(length, w.shape[1])
        peak = max(peak, _peak(w))
        if it["name"] not in MIX_EXCLUDE:
            mix = _add(mix, w)
        if it["name"] in VOCAL_NAMES:
            vocals = _add(vocals, w)
        del w
        prog(0.3 + 0.3 * (i + 1) / n_items)
    if mix is None:
        raise ValueError("Só veio a faixa de metrônomo.")
    # uma escala só para todas as faixas (como no Demucs): o app multiplica a soma por `gain`
    scale = min(1.0, 0.98 / peak) if peak > 0 else 1.0

    # 2ª passada: faixas em mp3
    uploaded: list[str] = []
    tracks = []
    for i, (it, src) in enumerate(zip(items, local)):
        w = _fit(decode(src, min_seconds=0.5), length) * scale
        out = os.path.join(tmp, f"{it['name']}.mp3")
        encode_mp3(w, out)
        del w
        path = f"playbacks/{uid}/stems/{playback_id}/{it['name']}.mp3"
        blob = bucket.blob(path)
        blob.cache_control = "private, max-age=31536000"
        blob.upload_from_filename(out, content_type="audio/mpeg")
        uploaded.append(path)
        tracks.append({"name": it["name"], "label": it["label"], "path": path})
        os.remove(out)
        prog(0.6 + 0.35 * (i + 1) / n_items)

    # áudio completo
    mix = _fit(mix, length)
    mix *= min(1.0, 0.98 / (_peak(mix) or 1.0))
    mix_local = os.path.join(tmp, "mix.mp3")
    encode_mp3(mix, mix_local)
    del mix
    blob = bucket.blob(data["storagePath"])
    blob.cache_control = "private, max-age=31536000"
    blob.upload_from_filename(mix_local, content_type="audio/mpeg")
    uploaded.append(data["storagePath"])
    prog(1.0)

    stems_field = {"status": "ready", "tracks": tracks, "gain": round(1.0 / scale, 4),
                   "durationSec": round(length / SR, 2), "model": MODEL, "error": None}
    print(f"{n_items} faixas importadas ({length / SR:.0f}s), voz: {'sim' if vocals is not None else 'não'}")
    return stems_field, vocals, mix_local, uploaded, [it["path"] for it in items]


def from_saved(data: dict, bucket, tmp: str):
    """Reprocessar um playback de faixas já importadas: usa o áudio completo e as faixas de voz guardadas.
    Devolve (stems_field, voz ou None, áudio completo local)."""
    from separate import decode

    stems = data.get("stems") or {}
    if stems.get("status") != "ready" or not stems.get("tracks"):
        raise ValueError("As faixas enviadas não existem mais. Envie as faixas de novo.")
    src = os.path.join(tmp, os.path.basename(data["storagePath"]))
    bucket.blob(data["storagePath"]).download_to_filename(src)
    vocals = None
    for t in stems["tracks"]:
        if t.get("name") in VOCAL_NAMES:
            dst = os.path.join(tmp, f"v_{t['name']}.mp3")
            bucket.blob(t["path"]).download_to_filename(dst)
            vocals = _add(vocals, decode(dst, min_seconds=0.5))
    return stems, vocals, src
