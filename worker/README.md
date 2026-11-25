# Processamento do playback (Cloud Run Job `process-playback`)

Todo áudio enviado passa por aqui, uma vez, do começo ao fim. A música só fica pronta no final, com
a sincronia definitiva: não existe versão provisória.

1. **Faixas**: separa em 6 (voz, bateria, baixo, guitarra, piano e outros) com o Demucs `htdemucs_6s`.
2. **Letra**: reconhece o que é cantado na faixa de voz (faster-whisper `small`, CPU), com o tempo de cada palavra.
3. **Sincronia**: analisa a harmonia do áudio original e alinha com a cifra usando acordes + letra
   (`functions/playback_sync`, o mesmo código das Functions).

```
app ── envia o áudio (Storage playbacks/{uid}/{id}.mp3)
         └─ analyze_playback (Function, functions/main.py): status 'processing', stage 'queued'
               └─ executa o job `process-playback` (esta pasta) com PLAYBACK_ID
                     ├ grava playbacks/{uid}/stems/{id}/{faixa}.mp3
                     ├ grava playbacks/{uid}/analysis/{id}.npz e {id}.words.json
                     └ atualiza playbacks/{id}: stage/progress durante, e no fim status 'ready' + timeline
app ── watchPlaybacks (ao vivo) ── mostra a etapa e o progresso; quando 'ready', toca
```

- **Por que a voz:** os acordes sozinhos não separam partes com a mesma harmonia. Em "Falta Você"
  (verso e refrão com quase os mesmos acordes) a letra caiu no trecho certo em 4 de 47 linhas só
  com acordes e em 42 de 48 com a voz. Em playback sem voz, o resultado é o mesmo de antes.
- **Se uma etapa falhar:** sem faixas (ou sem voz reconhecida), alinha só pelos acordes e o playback
  fica pronto do mesmo jeito; `stems.status = 'error'` explica. Sem cifra ou com o áudio ilegível,
  `status = 'error'`. O áudio original nunca é alterado.
- **Re-sincronizar** (a cifra mudou): a Function `resync_playback` reaproveita a análise e as palavras
  guardadas e refaz só o alinhamento, em segundos.
- **Processar de novo** (`reprocess_playback`): para playbacks antigos (sem faixas), com erro ou
  parados no meio (sem progresso há 35 min).
- Apagar o playback apaga as faixas, a análise e as palavras (`cleanup_playback`).

**Limite da separação:** é por tipo de instrumento. Guitarra base e solo de guitarra (e violão) saem
juntos na faixa Guitarra; desligá-la tira os dois. O player avisa isso.

## Publicar

Pré-requisitos: plano Blaze, APIs Cloud Run, Cloud Build e Artifact Registry ativas. Os comandos
rodam na **raiz do repositório** (a imagem usa `functions/playback_sync`; o `.gcloudignore` da raiz
limita o upload ao que a imagem usa).

```powershell
# 1. Imagem (Cloud Build)
gcloud builds submit --config worker/cloudbuild.yaml --project avid-bricolage-313721 .

# 2. Job: 8 vCPU / 16 GB, até 30 min, sem novas tentativas automáticas
gcloud run jobs deploy process-playback --project avid-bricolage-313721 --region us-central1 `
  --image us-central1-docker.pkg.dev/avid-bricolage-313721/cloud-run-source-deploy/process-playback `
  --cpu 8 --memory 16Gi --task-timeout 30m --max-retries 0 `
  --set-env-vars STORAGE_BUCKET=avid-bricolage-313721.appspot.com

# 3. A Function precisa poder executar o job com variáveis próprias (conta de serviço padrão do Compute)
gcloud run jobs add-iam-policy-binding process-playback --project avid-bricolage-313721 --region us-central1 `
  --member serviceAccount:657722499129-compute@developer.gserviceaccount.com --role roles/run.developer

# 4. Functions e regras
firebase deploy --project avid-bricolage-313721 --only functions,storage,firestore:rules
```

O job usa a conta de serviço padrão (precisa de leitura/escrita no Firestore e no bucket).
Tempo medido no PC de desenvolvimento (12 núcleos), música de 3:38: ~2 min separando, ~2 min
reconhecendo a letra, segundos sincronizando (≈ 4,5 min no total).

## Testar local

```powershell
docker build -f worker/Dockerfile -t meu-repertorio-worker .

# validação da separação com gabarito (solo e base de guitarra tocando juntos), usando public/samples
docker run --rm --entrypoint python -v "${PWD}\public\samples:/samples:ro" -v "${PWD}\worker\out:/out" meu-repertorio-worker validate.py synthetic

# uma gravação real: energia de cada faixa a cada 5 s + as faixas em mp3 para ouvir
docker run --rm --entrypoint python -v "C:\pasta:/in:ro" -v "${PWD}\worker\out:/out" meu-repertorio-worker validate.py file "/in/musica.mp3"
```

Com os emuladores, copie `functions/.env.local.example` para `functions/.env.local`: a Function
`analyze_playback` passa a rodar o contêiner local (apontando para os emuladores) em vez do Cloud Run.
