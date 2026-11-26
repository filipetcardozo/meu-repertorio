"""Experimentos locais. Montar este arquivo em /app/roformer_cpu.py na imagem local."""
import argparse
import hashlib
import json
import os
import resource
import statistics
import time
from pathlib import Path

import numpy as np


def cpu_demix(config, forward, mix, batch):
    """Variante experimental: mesma soma na mesma ordem, só calcula o áudio devolvido."""
    import torch
    from bs_roformer.utils import get_windowing_array
    from torch.nn.functional import pad

    size = config.inference.chunk_size
    step = size // config.inference.num_overlap
    fade = size // 10
    length = mix.shape[-1]
    border = size - step if length > 2 * (size - step) else 0
    if border:
        mix = pad(mix, (border, border), mode="reflect")
    names = config.training.instruments
    total = mix.shape[-1]
    result = torch.zeros((len(names), 2, length))
    weight = torch.zeros(length)
    window = get_windowing_array(size, fade, "cpu")
    starts = range(0, length + border, step)
    for j in range(0, len(starts), batch):
        offsets = starts[j:j + batch]
        parts = []
        for start in offsets:
            part = mix[:, start:start + size]
            missing = size - part.shape[-1]
            if missing:
                mode = "reflect" if part.shape[-1] > size // 2 + 1 else "constant"
                part = pad(part, (0, missing), mode=mode)
            parts.append(part)
        predictions = forward(parts[0][None] if len(parts) == 1 else torch.stack(parts))
        for start, pred in zip(offsets, predictions):
            w = window
            if start == 0 or start + size >= total:
                w = window.clone()
                if start == 0:
                    w[:fade] = 1
                else:
                    w[-fade:] = 1
            lo = max(0, border - start)
            hi = min(size, border + length - start)
            dest = slice(start + lo - border, start + hi - border)
            result[..., dest] += pred[..., lo:hi] * w[lo:hi]
            weight[dest] += w[lo:hi]
    result /= weight.clamp_min_(torch.finfo(weight.dtype).tiny)
    return dict(zip(names, result.numpy())), None


def onnx_forward(threads, model_path):
    import onnxruntime as ort
    import torch

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = threads
    session = ort.InferenceSession(model_path, opts, providers=["CPUExecutionProvider"])
    stft = dict(n_fft=2048, hop_length=512, win_length=2048, window=torch.hann_window(2048))

    def forward(x):
        spec = torch.stft(x[0], **stft, return_complex=True)
        real, imag = session.run(["out_spec_real", "out_spec_imag"], {
            "spec_real": spec.real[None].contiguous().numpy(),
            "spec_imag": spec.imag[None].contiguous().numpy(),
        })
        masked = torch.complex(torch.from_numpy(real), torch.from_numpy(imag))
        return torch.istft(masked.flatten(0, 2), **stft, length=x.shape[-1]).reshape(1, 6, 2, -1)

    return forward


def compare(audio, ref, names, step):
    """Erro por faixa e nas emendas (antes do MP3). Inclui os canais quase silenciosos."""
    result = {}
    for stem, x, y in zip(names, audio, ref):
        diff = x - y
        boundaries = range(step, x.shape[-1], step)
        seam_peaks = [np.abs(diff[:, i - 1:i + 1]).max() for i in boundaries]
        jumps = [np.abs(diff[:, i] - diff[:, i - 1]).max() for i in boundaries]
        neighborhoods = [diff[:, max(0, i - 2205):i + 2205] for i in boundaries]
        result[stem] = {
            "peak_error": float(np.max(np.abs(diff))),
            "rms_error": float(np.sqrt(np.mean(diff ** 2))),
            "seam_peak_error": float(max(seam_peaks, default=0)),
            "seam_jump_error": float(max(jumps, default=0)),
            "seam_100ms_worst_rms": float(max((np.sqrt(np.mean(d ** 2)) for d in neighborhoods), default=0)),
        }
    return result


def overheads(samples, chunk):
    """Custos isolados, fora do cronômetro de separação. Mediana após aquecimento."""
    import torch
    from torch.nn.functional import pad

    wav = torch.zeros((2, samples))
    outputs = np.zeros((6, 2, samples), dtype=np.float32)
    window = torch.ones(chunk)
    border = chunk // 2

    def autocast():
        with torch.cuda.amp.autocast():
            pass

    def median_ms(fn):
        fn()
        times = []
        for _ in range(7):
            t = time.perf_counter()
            fn()
            times.append(1000 * (time.perf_counter() - t))
        return statistics.median(times)

    return {name: median_ms(fn) for name, fn in {
        "reflect_both_borders": lambda: pad(wav, (border, border), mode="reflect"),
        "cuda_autocast_context": autocast,
        "clone_chunk_window": window.clone,
        "numpy_stack_six_stems": lambda: np.stack(list(outputs)),
        "redundant_astype_float32": lambda: outputs.astype(np.float32),
        "allocate_full_counter": lambda: torch.zeros((6, 2, samples + 2 * border)),
        "allocate_shared_counter": lambda: torch.zeros(samples + 2 * border),
    }.items()}


def profile_network(model, stats):
    totals = stats["module_s"] = {}

    def measure(group, module):
        start = 0.0

        def enter(*_):
            nonlocal start
            start = time.perf_counter()

        def leave(*_):
            totals[group] = totals.get(group, 0.0) + time.perf_counter() - start

        module.register_forward_pre_hook(enter)
        module.register_forward_hook(leave)

    measure("band_split", model.band_split)
    for time_transformer, freq_transformer in model.layers:
        measure("time_transformer", time_transformer)
        measure("freq_transformer", freq_transformer)
    for estimator in model.mask_estimators:
        measure("masks", estimator)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--threads", type=int, default=os.cpu_count())
    parser.add_argument("--interop", type=int)
    parser.add_argument("--overlap", type=int, choices=[1, 2], default=2)
    parser.add_argument("--chunk", type=int, default=588800)
    parser.add_argument("--batch", type=int, choices=[1, 2], default=1)
    parser.add_argument("--cpu-loop", action="store_true")
    parser.add_argument("--backend", choices=["eager", "int8", "jit", "compile", "onnx"], default="eager")
    parser.add_argument("--save-reference", action="store_true")
    args = parser.parse_args()

    import validate
    from separate import StemsResult, _output_scale, separate

    if args.backend == "onnx":
        args.chunk = 176400
    root = Path("/out")
    reference = root / "reference.npy"
    out = Path(validate.OUT)
    stats = dict(options=vars(args), forward_s=[])
    saved = []

    def demix(config, model, mix, device):
        import torch
        from bs_roformer.utils import demix_track

        config.inference.num_overlap = args.overlap
        config.inference.chunk_size = args.chunk
        torch.set_num_threads(args.threads)
        stats.update(threads=torch.get_num_threads(), interop=torch.get_num_interop_threads(),
                     omp=os.getenv("OMP_NUM_THREADS"), mkl=os.getenv("MKL_NUM_THREADS"))
        start = time.monotonic()
        if args.backend == "int8":
            model = torch.ao.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8, inplace=True)
        elif args.backend == "jit":
            try:
                model = torch.jit.script(model)
                stats["jit_mode"] = "script"
            except (RuntimeError, ValueError, TypeError, torch.jit.frontend.FrontendError) as exc:
                print(f"JIT script: {exc}", flush=True)
                stats["jit_mode"] = "trace"
                stats["script_error"] = str(exc)
                eager, graph = model, None

                def traced(x):
                    nonlocal graph
                    if graph is None:
                        graph = torch.jit.freeze(torch.jit.trace(eager, x, check_trace=False).eval())
                    return graph(x)

                model = traced
        elif args.backend == "compile":
            model = torch.compile(model)
        elif args.backend == "onnx":
            model = onnx_forward(args.threads, str(root / "bs_roformer_sw_6stem_fp32.onnx"))
        stats["backend_setup_s"] = time.monotonic() - start
        if args.save_reference:
            profile_network(model, stats)

        def timed(x):
            t = time.monotonic()
            result = model(x)
            elapsed = time.monotonic() - t
            stats["forward_s"].append(elapsed)
            print(f"forward {len(stats['forward_s'])} batch={len(x)} {elapsed:.2f}s", flush=True)
            return result

        t = time.monotonic()
        if args.cpu_loop:
            with torch.inference_mode():
                res = cpu_demix(config, timed, mix, args.batch)
        else:
            res = demix_track(config, timed, mix, device)
        stats["demix_s"] = time.monotonic() - t
        return res

    def measured(wav):
        import bs_roformer
        import torch

        stats["torch"] = torch.__version__
        if args.interop:
            torch.set_num_interop_threads(args.interop)
        bs_roformer.demix_track = demix
        if args.backend == "onnx":
            # Este backend carrega apenas o grafo, sem instanciar uma segunda rede PyTorch.
            from ml_collections import ConfigDict
            names = ["bass", "drums", "other", "vocals", "guitar", "piano"]
            config = ConfigDict(dict(inference={}, training=dict(instruments=names, target_instrument=None)))
            res, _ = demix(config, None, torch.from_numpy(wav), torch.device("cpu"))
            stems = np.stack([res[n] for n in names])
            scale = _output_scale(stems)
            result = StemsResult(names, stems * scale, 1 / scale, wav.shape[1] / validate.SR)
        else:
            result = separate(wav)
        saved.append(result)
        return result

    validate.separate = measured
    validate.run_synthetic()
    result, = saved
    audio = result.stems * result.gain
    if not np.isfinite(audio).all():
        raise ValueError("Saída não finita")
    stats["mix_sha256"] = hashlib.sha256((out / "synthetic_mix.mp3").read_bytes()).hexdigest()
    if args.save_reference:
        np.save(reference, audio, allow_pickle=False)
        stats["overhead_median_ms"] = overheads(audio.shape[-1], args.chunk)
    stats["difference"] = compare(audio, np.load(reference, mmap_mode="r"), result.names, args.chunk // args.overlap)
    stats["peak_rss_mib"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    (out / "profile.json").write_text(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
