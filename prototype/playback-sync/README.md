# Protótipo: sincronia de playback com a cifra

Analisa um playback (mp3/wav, sem voz) e descobre em que segundo cada linha da cifra começa.
É a base da futura Cloud Function (Python) que roda quando o mp3 é enviado.

## Como funciona

1. **Áudio** (`features.py`): separa harmonia de percussão, mede quais das 12 notas soam em cada
   instante (agudos e graves separados), acha o andamento e as batidas.
2. **Cifra** (`cifra.py`): lê o formato do app (`<pre>` com `<b>`) ou texto copiado; monta seções,
   linhas e acordes.
3. **Alinhamento** (`align.py`): Viterbi semi-Markov na grade de meio-tempos. Cada acorde da cifra é
   um estado; entre seções pode seguir, **repetir** (refrão 2x), **pular** (playback cortou uma
   parte) ou passar por trecho **fora da cifra** (intro/solo não escritos). Testa as transposições
   prováveis (playback em outro tom). Cada linha sai com uma **confiança**; abaixo de 0,6 = conferir.

## Uso

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt

# playback real + cifra (HTML do app ou texto copiado do Cifra Club)
.\.venv\Scripts\python sync.py "C:\caminho\playback.mp3" cifra.txt

# banco de testes com gabarito (gera playbacks com os samples de public/samples)
.\.venv\Scripts\python bench.py
```

`sync.py` gera `out/<nome>.sync.json` (linha do tempo) e `out/<nome>.html`, uma página que toca o
áudio com a cifra rolando e a linha atual destacada. Clique numa linha para tocar dali.

## Resultado no banco sintético

| caso | linhas < 0,3 s | < 0,7 s | tom |
|---|---|---|---|
| pop, ordem normal | 100% | 100% | ok |
| pop, +2 tons, intro e solo não escritos | 100% | 100% | ok |
| sertanejo, -3 tons, verso cortado | 100% | 100% | ok |
| sertanejo lento (andamento detectado dobrado) | 100% | 100% | ok |
| difícil: antecipação, tempo humano, 15–20% acordes diferentes da cifra | 92–96% | 96% | ok |
| muito difícil: 30% acordes diferentes, 60% antecipação | 74% | 89% | ok |

Os erros grandes vêm com confiança baixa, então a tela de revisão consegue apontá-los.

## Primeiro teste real: Dilsinho, "Refém" (3:43)

- Tom detectado certo (+1: gravação em E♭, cifra em D) e BPM 99.
- Introdução, primeira parte, segunda parte, refrão, retorno e segundo refrão nos lugares certos
  até 2:35 (conferido contra o reconhecimento livre de acordes).
- 2:35–3:28 ainda incerto: refrão e primeira parte usam os mesmos 4 acordes.
- O que o teste real ensinou (já corrigido): o "fora da cifra" precisa ser calibrado por música
  (mixagem real casa menos que playback limpo); a duração tem que ser por acorde, não por linha
  (a quebra de linha do Cifra Club depende da largura da tela); blocos de tablatura são a mesma parte
  escrita de outro jeito, então pular é de graça; voltar para seção minúscula precisa custar caro.

Cifras e áudios reais ficam em `testdata/real/` (fora do git).

## Limites conhecidos

- Partes com **os mesmos acordes** (intro = verso, verso 1 = verso 2, solo sobre o refrão) são
  indistinguíveis sem voz. O alinhador escolhe a mais provável; a revisão confirma.
- Playback sintético é mais "limpo" que um real. O próximo passo é medir em playbacks reais.
