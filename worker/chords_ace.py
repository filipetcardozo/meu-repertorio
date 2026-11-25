"""
Reconhecimento de acordes com o consonance-ACE (motor experimental da "cifra pelo áudio").

Modelo: "From Discord to Harmony: Decomposed Consonance-Based Training for Improved Audio Chord
Estimation" (Poltronieri, Serra e Rocamora, ISMIR 2025), https://github.com/andreamust/consonance-ACE
(licença MIT, cópia em worker/licenses/consonance-ACE.txt). Usamos o checkpoint publicado no
repositório (`ACE/checkpoints/conformer_decomposed_smooth.ckpt`, commit fixado em ACE_COMMIT e
conferido por SHA-256 no Dockerfile).

A rede é remontada aqui com os mesmos nomes de camadas do checkpoint (torchaudio Conformer + cabeças
de raiz, baixo e notas), para não trazer as dependências de treino do projeto (lightning, gin, wandb,
mir_eval, harte-library). O pré-processamento e a decodificação seguem ACE/inference.py e
ACE/mir_evaluation.py:

1. áudio original, mono, 22.050 Hz, em trechos de 20 s (cada trecho normalizado pelo pico);
2. CQT de 144 bandas (6 oitavas a partir de C1, 24 por oitava, hop 512), magnitude;
3. a rede devolve, a cada quadro (~23 ms): raiz (12 notas ou "sem acorde"), baixo e as notas
   presentes (sigmoide > 0,5);
4. cada quadro vira um símbolo Harte ("A:min7", "G:maj/3", "N"...), quadros iguais viram segmentos
   e segmentos com menos de 0,5 s são absorvidos pelo anterior.

Saída: {engine, model, segments: [{t0, t1, label}], ...}. A conversão para a notação do app e o
encaixe na grade de tempos ficam em functions/playback_sync (generate.chords_from_segments), que
roda nas Functions sem PyTorch.

    python chords_ace.py <áudio> [saída.json]
"""
from __future__ import annotations

import json
import math
import os
import sys
import time

import numpy as np

ACE_REPO = "https://github.com/andreamust/consonance-ACE"
ACE_COMMIT = "d17633aea4e68e616e735d09df97b97ae3428e71"
CKPT_NAME = "conformer_decomposed_smooth.ckpt"
CKPT_SHA256 = "6ab1a314366fefb3d09e351ae7cb7f826a9e0718e94e7ff164df844ba7bcd954"
CKPT_URL = f"https://raw.githubusercontent.com/andreamust/consonance-ACE/{ACE_COMMIT}/ACE/checkpoints/{CKPT_NAME}"
CKPT_PATH = os.environ.get("ACE_CKPT", "/models/ace/" + CKPT_NAME)
MODEL_NAME = f"consonance-ACE {CKPT_NAME.removesuffix('.ckpt')}@{ACE_COMMIT[:7]}"

SR = 22050
HOP = 512
CHUNK_S = 20.0  # o modelo foi treinado com trechos de 20 s (não dá para mudar com esta loss)
BINS_PER_OCTAVE = 24
N_OCTAVES = 6
FMIN_NOTE = "C1"
THRESHOLD = 0.5  # nota presente
MIN_DURATION = 0.5  # segmento mais curto que isso é absorvido (padrão do inference.py)

SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# grau (em semitons a partir da raiz) -> nome no Harte, como em ACE/mir_evaluation.py
INTERVAL_MAP = ["1", "b9", "9", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"]
# abreviações para deixar o símbolo legível ("C:(1,b3,5,b7)" -> "C:min7"), como o harte-library faz
_SHORT = {
    (0, 4, 7): "maj", (0, 3, 7): "min", (0, 3, 6): "dim", (0, 4, 8): "aug",
    (0, 4, 7, 11): "maj7", (0, 3, 7, 10): "min7", (0, 4, 7, 10): "7", (0, 3, 6, 9): "dim7",
    (0, 3, 6, 10): "hdim7", (0, 3, 7, 11): "minmaj7", (0, 4, 7, 9): "maj6", (0, 3, 7, 9): "min6",
    (0, 2, 4, 7, 10): "9", (0, 2, 4, 7, 11): "maj9", (0, 2, 3, 7, 10): "min9",
    (0, 2, 7): "sus2", (0, 5, 7): "sus4",
}
_IV = {name: i for i, name in enumerate(INTERVAL_MAP)}


# ---------------------------------------------------------------- rede

def _build(hp: dict):
    import torch
    from torch import nn
    from torchaudio.models import Conformer

    class PositionalEncoding(nn.Module):  # ACE/utils.py
        def __init__(self, hidden_size: int, max_len: int = 5000):
            super().__init__()
            pe = torch.zeros(max_len, hidden_size)
            position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
            div = torch.exp(torch.arange(0, hidden_size, 2).float() * (-math.log(10000.0) / hidden_size))
            pe[:, 0::2] = torch.sin(position * div)
            pe[:, 1::2] = torch.cos(position * div)
            self.register_buffer("pe", pe.unsqueeze(0))

        def forward(self, x):
            return x + self.pe[:, : x.size(1)]

    class AceNet(nn.Module):  # ACE/models/conformer_decomposed.py (só a inferência)
        def __init__(self):
            super().__init__()
            d = hp["conformer_dim"]
            voc = hp["vocabularies"]
            self.use_pe = bool(hp.get("positional_encoding"))
            self.positional_encodings = PositionalEncoding(hidden_size=d)
            self.input_projection = nn.Linear(hp["input_dim"], d)
            self.conformer = Conformer(
                input_dim=d, num_heads=hp["num_heads"], ffn_dim=hp["ffn_dim"], num_layers=hp["num_layers"],
                depthwise_conv_kernel_size=hp["depthwise_conv_kernel_size"], dropout=hp["dropout"],
                use_group_norm=hp["use_group_norm"], convolution_first=hp["convolution_first"],
            )
            n_chord = voc["onehot"]
            self.output_chord = nn.Linear(d, n_chord)
            self.bass_fusion = nn.Sequential(nn.Linear(d + n_chord, d), nn.LayerNorm(d), nn.GELU(), nn.Dropout(0.1))
            self.output_bass = nn.Linear(d, voc["bass"])
            self.root_fusion = nn.Sequential(nn.Linear(d + n_chord, d), nn.LayerNorm(d), nn.GELU(), nn.Dropout(0.1))
            self.output_root = nn.Linear(d, voc["root"])

        def forward(self, x):  # x: [B, bandas, quadros]
            lengths = torch.full((x.shape[0],), x.shape[2], dtype=torch.long, device=x.device)
            x = self.input_projection(x.transpose(1, 2))
            if self.use_pe:
                x = self.positional_encodings(x)
            x, _ = self.conformer(x, lengths=lengths)
            chord = self.output_chord(x)
            h = torch.cat([x, chord], dim=-1)
            return self.output_root(self.root_fusion(h)), self.output_bass(self.bass_fusion(h)), chord

    return AceNet()


def load_model(path: str = CKPT_PATH):
    import torch

    if not os.path.exists(path):
        raise FileNotFoundError(f"checkpoint do consonance-ACE não encontrado em {path}")
    # weights_only: só tensores e tipos simples (o arquivo não executa código ao carregar)
    ck = torch.load(path, map_location="cpu", weights_only=True)
    hp = ck["hyper_parameters"]
    hp["vocabularies"] = {**hp["vocabularies"], "root": 13, "bass": 13, "onehot": 12}  # como no inference.py
    net = _build(hp)
    state = {k: v for k, v in ck["state_dict"].items() if not k.startswith("loss.")}
    net.load_state_dict(state, strict=True)
    return net.eval()


# ---------------------------------------------------------------- áudio

def load_audio(path: str):
    """Como o AudioChunkProcessor: arquivo na taxa original, reamostrado para 22.050 Hz, mono. [1, n]"""
    import librosa
    import torch
    from torchaudio.transforms import Resample

    y, sr = librosa.load(path, sr=None, mono=False)
    t = torch.from_numpy(np.ascontiguousarray(y, dtype=np.float32))
    if int(sr) != SR:
        t = Resample(int(sr), SR, dtype=t.dtype)(t)
    if t.ndim == 1:
        t = t.unsqueeze(0)
    elif t.shape[0] > 1:
        t = t.mean(dim=0, keepdim=True)
    return t


def _chunk_features(y, onset: float):
    import librosa
    import torch

    n = int(SR * CHUNK_S)
    s = int(onset * SR)
    sig = y[:, s:s + n] if y.shape[1] > n else y
    if sig.shape[1] < n:
        sig = torch.nn.functional.pad(sig, (0, n - sig.shape[1]))
    peak = sig.abs().max()
    if peak > 0:
        sig = sig / peak
    c = np.abs(librosa.cqt(sig.numpy(), sr=SR, hop_length=HOP, bins_per_octave=BINS_PER_OCTAVE,
                           n_bins=BINS_PER_OCTAVE * N_OCTAVES, fmin=librosa.note_to_hz(FMIN_NOTE)))
    return torch.from_numpy(c.astype(np.float32))  # [1, 144, quadros]


# ---------------------------------------------------------------- decodificação

def _label(root: int, bass: int, notes: np.ndarray) -> str:
    """Um quadro -> símbolo Harte (mesma regra do decode_chord do ACE, com a abreviação no fim)."""
    if root == 12:
        return "N"
    degs = [INTERVAL_MAP[c] for c in np.where(np.roll(notes, -root) > THRESHOLD)[0]]
    txt = ",".join(degs)
    if (("1,3" in txt) or ("1,b3" in txt)) and "5" not in txt:  # tríade sem quinta: põe a quinta
        degs.append("5")
    bass_deg = INTERVAL_MAP[(bass - root) % 12] if bass != 12 and bass != root else ""
    ivs = tuple(sorted({_IV[d] for d in degs}))
    if not degs:
        q = ""  # "C" = C:maj no Harte
    elif ivs in _SHORT:
        q = ":" + _SHORT[ivs]
    else:
        q = ":(" + ",".join(INTERVAL_MAP[i] for i in ivs) + ")"
    return SHARP[root] + q + (("/" + bass_deg) if bass_deg else "")


def _group(times: np.ndarray, labels: list[str], end: float) -> tuple[list[list[float]], list[str]]:
    iv: list[list[float]] = []
    lb: list[str] = []
    for i, lab in enumerate(labels):
        if lb and lb[-1] == lab:
            continue
        if iv:
            iv[-1][1] = float(times[i])
        iv.append([float(times[i]), end])
        lb.append(lab)
    return iv, lb


def _remove_short(iv: list[list[float]], lb: list[str], min_dur: float):
    """remove_short_chords do ACE: o curto estende o anterior (ou, no começo, o próximo)."""
    out_iv: list[list[float]] = []
    out_lb: list[str] = []
    iv = [list(x) for x in iv]
    for i, (x, lab) in enumerate(zip(iv, lb)):
        if x[1] - x[0] < min_dur:
            if out_iv:
                out_iv[-1][1] = x[1]
            elif i + 1 < len(iv):
                iv[i + 1][0] = x[0]
        else:
            out_iv.append(x)
            out_lb.append(lab)
    return out_iv, out_lb


def _merge_same(iv, lb):
    out_iv, out_lb = [], []
    for x, lab in zip(iv, lb):
        if out_lb and out_lb[-1] == lab:
            out_iv[-1][1] = x[1]
        else:
            out_iv.append(list(x))
            out_lb.append(lab)
    return out_iv, out_lb


def recognize(path: str, net=None, on_progress=None) -> dict:
    """Acordes do áudio inteiro: {engine, model, segments: [{t0, t1, label}], sec, ...}."""
    import torch

    t_start = time.monotonic()
    net = net or load_model()
    y = load_audio(path)
    total = y.shape[1] / SR
    n_chunks = max(1, int(np.ceil(total / CHUNK_S)))
    all_iv: list[list[float]] = []
    all_lb: list[str] = []
    with torch.inference_mode():
        for i in range(n_chunks):
            onset = i * CHUNK_S
            x = _chunk_features(y, onset)
            root_l, bass_l, chord_l = net(x)
            root = root_l.argmax(dim=-1)[0].numpy()
            bass = bass_l.argmax(dim=-1)[0].numpy()
            notes = torch.sigmoid(chord_l)[0].numpy()
            T = len(root)
            labels = [_label(int(root[k]), int(bass[k]), notes[k]) for k in range(T)]
            times = np.arange(T) * (CHUNK_S / T)
            iv, lb = _group(times, labels, CHUNK_S)
            iv, lb = _remove_short(iv, lb, MIN_DURATION)
            for x_ in iv:
                all_iv.append([x_[0] + onset, x_[1] + onset])
            all_lb.extend(lb)
            if on_progress:
                on_progress((i + 1) / n_chunks)
    all_iv, all_lb = _remove_short(all_iv, all_lb, MIN_DURATION)
    all_iv, all_lb = _merge_same(all_iv, all_lb)
    segments = []
    for (t0, t1), lab in zip(all_iv, all_lb):
        if t0 >= total:
            break
        segments.append({"t0": round(t0, 3), "t1": round(min(t1, total), 3), "label": lab})
    return {
        "engine": "ace",
        "model": MODEL_NAME,
        "repo": ACE_REPO,
        "commit": ACE_COMMIT,
        "threshold": THRESHOLD,
        "minDuration": MIN_DURATION,
        "duration": round(total, 3),
        "sec": round(time.monotonic() - t_start, 2),
        "segments": segments,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("uso: python chords_ace.py <áudio> [saída.json]", file=sys.stderr)
        sys.exit(2)
    res = recognize(sys.argv[1])
    txt = json.dumps(res, ensure_ascii=False, indent=1)
    if len(sys.argv) > 2:
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            f.write(txt)
    for s in res["segments"]:
        print(f"{s['t0']:8.2f} {s['t1']:8.2f}  {s['label']}")
    print(f"{len(res['segments'])} segmentos em {res['sec']} s ({res['model']})", file=sys.stderr)
