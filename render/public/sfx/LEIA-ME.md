# sfx

Efeitos sonoros gerados 100% com `ffmpeg` (ruído/tons sintéticos), sem baixar nada da
internet — sem questão de direitos autorais. Picos abaixo de -6 dBFS (discretos, para não
brigar com voiceover/música).

```bash
# whoosh.mp3 (~350ms) — ruído rosa filtrado com "varredura" de frequência: uma camada grave
# (lowpass) que desaparece e uma aguda (highpass+lowpass) que entra, simulando um sweep de
# grave pra agudo, com fade de entrada/saída.
ffmpeg -f lavfi -i "anoisesrc=color=pink:duration=0.35:sample_rate=44100" -filter_complex \
"[0:a]asplit=2[a][b];[a]lowpass=f=1200,volume='max(0,1-t/0.35)':eval=frame[low];\
[b]highpass=f=1200,lowpass=f=6000,volume='min(1,t/0.35)':eval=frame[high];\
[low][high]amix=inputs=2:duration=longest,afade=t=in:d=0.02,afade=t=out:st=0.27:d=0.08,volume=0.35[out]" \
-map "[out]" -ac 1 -ar 44100 whoosh.mp3

# pop.mp3 (~120ms) — tom curto com vibrato (pitch bend) e decaimento exponencial.
ffmpeg -f lavfi -i "sine=frequency=700:duration=0.12:sample_rate=44100" -af \
"vibrato=f=10:d=0.6,volume='exp(-25*t)':eval=frame,afade=t=out:st=0.08:d=0.04,volume=0.4" \
-ac 1 pop.mp3

# click.mp3 (~60ms) — ruído branco filtrado em agudo (highpass) com decaimento rápido.
ffmpeg -f lavfi -i "anoisesrc=color=white:duration=0.06:sample_rate=44100" -af \
"highpass=f=2000,volume='exp(-40*t)':eval=frame,volume=0.15" \
-ac 1 click.mp3

# rise.mp3 (~700ms) — riser suave: mesmo truque do whoosh mas mais longo, com crescendo
# geral (volume sobe com o tempo) em vez de fade só na ponta.
ffmpeg -f lavfi -i "anoisesrc=color=pink:duration=0.7:sample_rate=44100" -filter_complex \
"[0:a]asplit=2[a][b];[a]lowpass=f=2000,volume='max(0,1-t/0.7)':eval=frame[low];\
[b]highpass=f=2000,volume='min(1,t/0.7)':eval=frame[high];\
[low][high]amix=inputs=2:duration=longest,volume='min(1,t/0.7)':eval=frame,\
afade=t=in:d=0.05,afade=t=out:st=0.6:d=0.1,volume=0.3[out]" \
-map "[out]" -ac 1 -ar 44100 rise.mp3
```

## Volume

Os arquivos foram normalizados para **pico de -8 dB** (ffmpeg `volumedetect` + filtro `volume`), para ficarem audíveis sob a música com `volume` entre 0.4 e 0.6 no spec. Ao gerar um efeito novo, normalize igual.
