#!/usr/bin/env python
"""
Transcreve um áudio ou vídeo com o tempo de cada palavra.

    python tools/transcribe.py <arquivo> [--lang pt] [--model small] [--out arquivo.words.json]

Serve para duas coisas:
  1. Legenda sincronizada: `node tools/spec-tool.mjs sync-captions <spec> --words <arquivo.words.json>`
     preenche `wordEndsMs` das layers `karaoke` a partir da locução real.
  2. Ouvir referências: o Claude não escuta áudio; a transcrição dá o texto falado (hook, narração).

Usa faster-whisper local (sem API, sem custo). Na primeira execução baixa o modelo (~460 MB para
`small`). Aceita mp3, wav, m4a, mp4, mov — o decodificador vem junto com o faster-whisper.
"""

import argparse
import json
import os
import sys


def main() -> None:
    # O console do Windows não é UTF-8 por padrão; sem isso, acentos quebram a saída.
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Transcrição com tempo por palavra")
    parser.add_argument("media", help="arquivo de áudio ou vídeo")
    parser.add_argument("--lang", default=None, help="idioma (pt, en, es...); vazio = detectar")
    parser.add_argument("--model", default="small", help="tiny | base | small | medium")
    parser.add_argument("--out", default=None, help="saída .words.json (padrão: ao lado do arquivo)")
    args = parser.parse_args()

    if not os.path.isfile(args.media):
        print(f"arquivo não encontrado: {args.media}", file=sys.stderr)
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper não instalado. Rode: python -m pip install faster-whisper", file=sys.stderr)
        sys.exit(2)

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        args.media,
        language=args.lang,
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

    result = {
        "media": os.path.abspath(args.media),
        "language": info.language,
        "durationMs": round(info.duration * 1000),
        "text": " ".join(text),
        "words": words,
    }

    out = args.out or os.path.splitext(args.media)[0] + ".words.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(json.dumps({"out": out, "language": info.language, "words": len(words), "text": result["text"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
