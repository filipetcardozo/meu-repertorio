# Cloud Functions: playback sincronizado

Funções em Python (2ª geração), região `us-central1` (mesma do projeto Firebase):

| Função | Gatilho | O que faz |
|---|---|---|
| `analyze_playback` | arquivo novo em Storage `playbacks/{uid}/{id}.mp3` | lê a cifra da música, analisa o áudio (andamento, batidas, acordes, tom), alinha e grava a linha do tempo em `playbacks/{id}` |
| `resync_playback` | chamada do app | refaz só o alinhamento com a cifra atual, usando a análise guardada (`playbacks/{uid}/analysis/{id}.npz`) |
| `cleanup_playback` | `playbacks/{id}` apagado | apaga a análise guardada |

O código da sincronia (`playback_sync/`) é o mesmo do protótipo em `prototype/playback-sync`
(lá ficam o banco de testes e as ferramentas de inspeção).

## Publicar

Pré-requisito: projeto no **plano Blaze** (Functions e Storage exigem).

```powershell
cd functions
py -3.13 -m venv venv
.\venv\Scripts\python -m pip install -r requirements.txt
cd ..
firebase deploy --only firestore:rules,storage,functions
```

- `firestore:rules` publica o `firestore.rules` do repositório (o mesmo de antes + a coleção `playbacks`).
- No primeiro deploy de um gatilho de Storage o CLI pode pedir para liberar permissões do Eventarc.
- Custo por música: uma execução de ~10 s com 2 GB de memória (análise) e um arquivo `.npz` pequeno.

## CORS do Storage (troca de tom do áudio)

O player com troca de tom (`src/utils/audio/stretchPlayer.ts`) baixa o mp3 com `fetch`, então o bucket
precisa liberar CORS para o domínio do app. Sem isso o player cai para o `<audio>` comum, sem transpor.

```powershell
gcloud storage buckets update gs://avid-bricolage-313721.appspot.com --cors-file=cors.json
```

## Testar local (emuladores)

```powershell
firebase emulators:start --only auth,firestore,storage,functions
python ..\prototype\playback-sync\seed_emulator.py
```

E o app ligado aos emuladores: configuração `dev-emulators` do `.claude/launch.json`
(porta 3010, `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=1`). Usuário e música de teste: ver `seed_emulator.py`.
