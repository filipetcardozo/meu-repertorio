# Separação de instrumentos (Demucs `htdemucs_6s`)

Separa o áudio de um playback em 6 faixas (voz, bateria, baixo, guitarra, piano e outros) para o
player do modo show ligar, desligar e solar cada uma durante a reprodução.

## Como funciona

```
app ── separate_stems (Function chamável, functions/main.py) ── valida, marca stems.status='queued'
                                   │
                                   └─ executa o Cloud Run Job `separate-stems` (esta pasta) com PLAYBACK_ID
                                          │ baixa playbacks/{uid}/{id}.mp3, roda o Demucs na CPU
                                          │ grava playbacks/{uid}/stems/{id}/{faixa}.mp3
                                          └ atualiza playbacks/{id}.stems (progresso, faixas, erro)
app ── watchPlaybacks (ao vivo) ── mostra o progresso; quando 'ready', carrega as faixas
```

- O áudio original nunca é alterado: o player continua com ele durante a separação e se ela falhar.
- As faixas ficam salvas no Storage e são reaproveitadas nas próximas sessões (o liga/desliga de
  cada faixa fica salvo no aparelho). Apagar o playback apaga as faixas (`cleanup_playback`).
- No app, as faixas tocam num único nó de stretch com 2 canais por faixa
  (`src/utils/audio/stretchPlayer.ts`): posição, velocidade e transposição são as mesmas para todas,
  inclusive ao pular para uma linha da cifra.

**Limite do modelo:** a separação é por tipo de instrumento. Guitarra base e solo de guitarra (e
violão) saem juntos na faixa Guitarra; desligá-la tira os dois. A interface avisa isso.

## Publicar

Pré-requisitos: plano Blaze, APIs Cloud Run e Artifact Registry ativas.

```powershell
# 1. Imagem (Cloud Build) e job: 8 vCPU / 16 GB, até 30 min, sem novas tentativas automáticas
gcloud run jobs deploy separate-stems --source stems --region us-central1 `
  --cpu 8 --memory 16Gi --task-timeout 30m --max-retries 0 `
  --set-env-vars STORAGE_BUCKET=avid-bricolage-313721.appspot.com

# 2. A Function precisa poder executar o job com variáveis próprias (conta de serviço padrão do Compute)
gcloud run jobs add-iam-policy-binding separate-stems --region us-central1 `
  --member serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com --role roles/run.developer

# 3. Function chamável, regras do Storage (leitura das faixas) e Firestore
firebase deploy --only functions,storage,firestore:rules
```

O job usa a conta de serviço padrão (precisa de leitura/escrita no Firestore e no bucket).
Tempo medido: ~0,85 s de CPU por segundo de música com 12 núcleos (música de 4 min ≈ 3–4 min).

## Testar local

```powershell
docker build -t meu-repertorio-stems stems

# validação com gabarito (solo e base de guitarra tocando juntos), usando public/samples
docker run --rm --entrypoint python -v "${PWD}\public\samples:/samples:ro" -v "${PWD}\stems\out:/out" meu-repertorio-stems validate.py synthetic

# uma gravação real: energia de cada faixa a cada 5 s + as faixas em mp3 para ouvir
docker run --rm --entrypoint python -v "C:\pasta:/in:ro" -v "${PWD}\stems\out:/out" meu-repertorio-stems validate.py file "/in/musica.mp3"
```

Com os emuladores, copie `functions/.env.local.example` para `functions/.env.local`: a Function
`separate_stems` passa a rodar o contêiner local (apontando para os emuladores) em vez do Cloud Run.
