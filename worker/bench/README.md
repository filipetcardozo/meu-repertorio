# Benchmark local do BS-RoFormer-SW em CPU

O ensaio usa o MP3 de 40,4 s de `validate.py synthetic`. Cada configuração roda em um novo processo da imagem local, com os mesmos samples e pesos. `elapsed_s` vai da entrada de `separate` até a devolução das faixas. Inclui importação, carga do modelo, configuração do backend e inferência. A síntese da música, a codificação dos MP3 e as métricas ficam fora desse tempo.

Na raiz do repositório, com o volume de pesos já populado pelo worker local, estes comandos reproduzem a rodada em PowerShell.

```powershell
docker build -f worker/Dockerfile --target local -t meu-repertorio-worker .
New-Item -ItemType Directory -Force worker/out/bench | Out-Null
curl.exe -fL --retry 2 -o worker/out/bench/bs_roformer_sw_6stem_fp32.onnx https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx/resolve/a744f80957374e1735ad70fa122670b7961da8cc/bs_roformer_sw_6stem_fp32.onnx
.\worker\bench\run.ps1
```

Para uma rodada curta, use por exemplo `.\worker\bench\run.ps1 -Run threads -Cases baseline,threads10,threads8`. O download do ONNX só é necessário ao incluir o caso `onnx`. O script confere seu SHA-256 e monta o arquivo em modo somente leitura.

Os resultados ficam em `worker/out/bench/<rodada>/<caso>/`. O script aguarda o playback ativo, monitora o listener durante a medição e interrompe o contêiner de benchmark caso detecte outro playback. Para retomar, repita o mesmo `-Run` e os casos desejados. Cada `profile.json` marca um ensaio concluído. O contêiner roda sem rede e tem 10 GiB de memória.

## Como ler a qualidade

- `synthetic_report.json` contém a projeção de cada fonte em cada faixa por seção. Por exemplo, `sections.verso.piano.piano = 0.856` indica 85,6% de captura do piano no verso. A projeção pode ser negativa. A mistura contém piano, baixo, bateria e duas guitarras. Voz isolada fica fora da cobertura desse gabarito.
- `profile.json` traz os tempos de cada chamada da rede, o tempo de `demix_track` e as diferenças nas seis formas de onda em relação à referência da rodada. As diferenças usam float32 antes do MP3, com o ganho de saída desfeito. `seam_jump_error` mede a maior mudança no salto entre amostras consecutivas na emenda. `seam_100ms_worst_rms` mede o erro RMS da pior vizinhança de ±50 ms. Ambas as métricas usam amplitude digital, com escala cheia igual a 1.
- `cpu-loop` mantém o padding refletido e a ponderação que incidem sobre áudio útil, acumula os pesos em um vetor e pula chamadas inteiramente fora da saída. `batch2` usa o mesmo laço para isolar o efeito do lote. `half-chunk` mantém o overlap em 2. `omp-mkl` explicita 12 threads para as duas bibliotecas desde o início do processo.
- O ONNX FP32 recebe um espectrograma de 345 frames. Esse caso usa chunks fixos de 4 s, overlap 2, STFT e iSTFT Hann no PyTorch e o provedor CPU do ONNX Runtime. O tempo mede essa configuração completa. [Ficha do export](https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx)
