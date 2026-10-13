#!/usr/bin/env python3
"""
Transcrição com o tempo de cada palavra — versão do servidor de tools/transcribe.py.

    python3 py/transcribe.py <arquivo> --out <saida.json> [--lang pt] [--model small]

O worker usa isto nos takes (a IA corta pela fala) e nas referências (o texto falado do
vídeo de referência). faster-whisper local: sem API, sem custo. O modelo é baixado na
primeira execução para HF_HOME (volume de mídia, pra não baixar de novo a cada deploy).
"""

import argparse
import json
import os
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("media")
    parser.add_argument("--out", required=True)
    parser.add_argument("--lang", default=None)
    parser.add_argument("--model", default="small")
    parser.add_argument("--threads", type=int, default=2)
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=args.threads)
    segments, info = model.transcribe(
        args.media,
        language=args.lang or None,
        word_timestamps=True,
        vad_filter=True,
    )

    words = []
    text = []
    for segment in segments:
        text.append(segment.text.strip())
        for w in segment.words or []:
            token = w.word.strip()
            if token:
                words.append({"word": token, "startMs": round(w.start * 1000), "endMs": round(w.end * 1000)})

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(
            {"language": info.language, "durationMs": round(info.duration * 1000), "text": " ".join(text), "words": words},
            f,
            ensure_ascii=False,
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # noqa: BLE001 — a mensagem vai pro erro do take
        print(f"transcrição falhou: {err}", file=sys.stderr)
        sys.exit(1)
