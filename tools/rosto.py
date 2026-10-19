#!/usr/bin/env python
"""
Diz onde está o rosto em cada cena de um spec e quais posições verticais ficam livres.

    python tools/rosto.py <spec.json> [--amostras 5] [--json saida.json] [--png PASTA]

Por quê: o hook de texto e os elementos só podem ficar em três posições (topo y≈25, centro y≈50,
inferior y≈75 — ver apps/ozempro/roteiro-ugc.md, "Onde cada coisa fica na vertical"), e a escolha
é sempre a que NÃO cobre o rosto. Decidir no olho já pôs texto na frente da influenciadora.

Como: para cada cena pega a 1ª layer de vídeo (footage, generative_video, app_screen_recording),
extrai N quadros do trecho que a cena realmente toca (startFromMs .. startFromMs + durationMs) com
ffmpeg e detecta rostos com YuNet (OpenCV). A caixa do rosto é a união das caixas de todos os
quadros, com 4% de margem. Faixas: topo 18-32, centro 42-58, inferior 68-82 (em % da altura).
Recomendada = a mais distante do rosto; empate: centro, topo, inferior.

Dependência: pip install opencv-python  (ffmpeg no PATH). O modelo YuNet (~230 KB) é baixado na
primeira execução para tools/modelos/ (fora do git). Última linha da saída: JSON.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELO = os.path.join(RAIZ, "tools", "modelos", "face_detection_yunet_2023mar.onnx")
URL_MODELO = ("https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/"
              "face_detection_yunet/face_detection_yunet_2023mar.onnx")
FAIXAS = {"topo": (18, 32), "centro": (42, 58), "inferior": (68, 82)}
PREFERENCIA = ["centro", "topo", "inferior"]  # critério de desempate
TIPOS_VIDEO = ("footage", "generative_video", "app_screen_recording")
LIMIAR = 0.5  # confiança mínima (rosto inclinado raramente passa de 0.75)
MAX_ROSTOS = 1  # rostos aceitos por quadro
MARGEM = 4.0  # % da altura em volta do rosto


def garantir_modelo() -> None:
    # o raw.githubusercontent devolve só o ponteiro do git-lfs (131 bytes); por isso media.*
    if os.path.isfile(MODELO) and os.path.getsize(MODELO) > 10000:
        return
    os.makedirs(os.path.dirname(MODELO), exist_ok=True)
    print("baixando modelo YuNet...", file=sys.stderr)
    urllib.request.urlretrieve(URL_MODELO, MODELO)
    if os.path.getsize(MODELO) < 10000:
        os.remove(MODELO)
        print("download do modelo veio incompleto", file=sys.stderr)
        sys.exit(1)


def extrair_quadros(arquivo, ini_s, dur_s, n, pasta):
    """n quadros espalhados no meio de n fatias iguais do trecho."""
    caminhos = []
    for i in range(n):
        t = ini_s + dur_s * (i + 0.5) / n
        saida = os.path.join(pasta, f"q{i}.jpg")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", arquivo,
                        "-frames:v", "1", "-q:v", "2", saida], check=False)
        if os.path.isfile(saida):
            caminhos.append(saida)
    return caminhos


def detectar(cv2, det, caminho):
    img = cv2.imread(caminho)
    if img is None:
        return None, []
    h, w = img.shape[:2]
    det.setInputSize((w, h))
    _, rostos = det.detect(img)
    caixas = []
    if rostos is not None:
        # YuNet dá vários falsos positivos de baixa confiança em rosto inclinado/olhando para baixo
        # (teto, cabelo); o criativo tem uma pessoa em quadro, então fica só o de maior confiança.
        for r in sorted(rostos, key=lambda r: -r[14])[:MAX_ROSTOS]:
            if r[14] < LIMIAR:
                continue
            x, y, bw, bh = r[:4]
            caixas.append(tuple(float(v) for v in (x / w * 100, y / h * 100, (x + bw) / w * 100, (y + bh) / h * 100)) + (float(r[14]),))
    return img, caixas


def analisar_cena(cv2, det, cena, amostras, pasta_png):
    cid = cena.get("id", "?")
    camada = next((l for l in cena.get("layers", []) if l.get("type") in TIPOS_VIDEO and l.get("src")), None)
    if not camada:
        return {"id": cid, "aviso": "sem layer de vídeo"}
    arquivo = os.path.join(RAIZ, "render", "public", camada["src"])
    if not os.path.isfile(arquivo):
        return {"id": cid, "aviso": f"vídeo não encontrado: {camada['src']}"}
    ini = camada.get("startFromMs", 0) / 1000
    dur = cena.get("durationMs", 1000) / 1000
    with tempfile.TemporaryDirectory() as tmp:
        quadros = extrair_quadros(arquivo, ini, dur, amostras, tmp)
        todas, melhor = [], None
        for q in quadros:
            img, caixas = detectar(cv2, det, q)
            if caixas:
                todas += caixas
                if melhor is None or len(caixas) > len(melhor[1]):
                    melhor = (img, caixas)
        res = {"id": cid, "src": camada["src"], "quadros": len(quadros), "deteccoes": len(todas),
               "confianca": round(sum(c[4] for c in todas) / len(todas), 2) if todas else 0}
        if not todas:
            res.update(rosto=None, livres=list(FAIXAS), recomendada="centro")
            return res
        y0 = max(0.0, min(c[1] for c in todas) - MARGEM)
        y1 = min(100.0, max(c[3] for c in todas) + MARGEM)
        x0 = max(0.0, min(c[0] for c in todas) - MARGEM)
        x1 = min(100.0, max(c[2] for c in todas) + MARGEM)
        livres = [k for k, (a, b) in FAIXAS.items() if b < y0 or a > y1]

        def dist(k):
            a, b = FAIXAS[k]
            return max(y0 - b, a - y1)

        recomendada = None
        if livres:
            recomendada = max(livres, key=lambda k: (round(dist(k), 3), -PREFERENCIA.index(k)))
        res.update(rosto={"yTopo": round(y0, 1), "yBase": round(y1, 1),
                          "xEsq": round(x0, 1), "xDir": round(x1, 1)},
                   livres=livres, recomendada=recomendada)
        if pasta_png and melhor:
            img = melhor[0]
            h, w = img.shape[:2]
            cv2.rectangle(img, (int(x0 / 100 * w), int(y0 / 100 * h)), (int(x1 / 100 * w), int(y1 / 100 * h)), (0, 0, 255), 4)
            for c in melhor[1]:
                cv2.rectangle(img, (int(c[0] / 100 * w), int(c[1] / 100 * h)), (int(c[2] / 100 * w), int(c[3] / 100 * h)), (0, 255, 0), 3)
            for k, (a, b) in FAIXAS.items():
                cor = (255, 200, 0) if k in livres else (0, 0, 0)
                cv2.rectangle(img, (0, int(a / 100 * h)), (int(w * 0.04), int(b / 100 * h)), cor, -1)
            os.makedirs(pasta_png, exist_ok=True)
            cv2.imwrite(os.path.join(pasta_png, f"{cid}.png"), img)
        return res


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Rosto por cena e posições verticais livres")
    ap.add_argument("spec")
    ap.add_argument("--amostras", type=int, default=5, help="quadros por cena")
    ap.add_argument("--json", default=None, help="grava o resultado neste arquivo")
    ap.add_argument("--png", default=os.path.join(RAIZ, "render", "out", "_rosto"),
                    help="pasta dos PNGs com a caixa desenhada (vazio desliga)")
    args = ap.parse_args()
    try:
        import cv2
    except ImportError:
        print("falta opencv-python: pip install opencv-python", file=sys.stderr)
        sys.exit(1)
    if not os.path.isfile(args.spec):
        print(f"spec não encontrado: {args.spec}", file=sys.stderr)
        sys.exit(1)
    garantir_modelo()
    det = cv2.FaceDetectorYN.create(MODELO, "", (320, 320), 0.3)
    spec = json.load(open(args.spec, encoding="utf-8"))
    saida = []
    for cena in spec.get("scenes", []):
        r = analisar_cena(cv2, det, cena, args.amostras, args.png or None)
        saida.append(r)
        if "aviso" in r:
            print(f"{r['id']:<14} AVISO: {r['aviso']}")
        elif r["rosto"] is None:
            print(f"{r['id']:<14} sem rosto | livres: {', '.join(r['livres'])} | recomendada: {r['recomendada']}")
        else:
            f = r["rosto"]
            # confiança média baixa = vídeo borrado/rosto de lado: a caixa pode ser falso positivo
            inc = " (INCERTO, confira o PNG)" if r["confianca"] < 0.6 else ""
            print(f"{r['id']:<14} rosto y {f['yTopo']:.0f}-{f['yBase']:.0f}%{inc} | livres: {', '.join(r['livres']) or 'nenhuma'} | recomendada: {r['recomendada'] or '-'}")
    if args.json:
        json.dump(saida, open(args.json, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(json.dumps(saida, ensure_ascii=False))


if __name__ == "__main__":
    main()
