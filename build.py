"""Roda tudo em sequência: gera a base fictícia, agrega e monta o HTML."""
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
ETAPAS = ["gerar_dados.py", "pipeline/agregar.py", "pipeline/gerar_html.py"]

for etapa in ETAPAS:
    print(f"\n> {etapa}", flush=True)
    subprocess.run([sys.executable, str(RAIZ / etapa)], check=True)

print("\npronto: abra docs/index.html no navegador")
