"""
Monta docs/index.html: pega o esqueleto em src/index.html, coloca o CSS e os
scripts de src/js dentro dele e injeta agregados/painel.json.

O resultado é um HTML único, sem servidor. Dá pra abrir direto no navegador
ou publicar no GitHub Pages.
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"
DADOS = RAIZ / "agregados" / "painel.json"
SAIDA = RAIZ / "docs" / "index.html"

# ordem importa: base e gráficos primeiro, app.js por último
SCRIPTS = ["base.js", "graficos.js", "financeiro.js", "alunado.js", "rematricula.js",
           "farol.js", "funil.js", "apresentacao.js", "app.js"]


def main():
    dados = json.loads(DADOS.read_text(encoding="utf-8"))
    # "</" dentro de um <script> fecharia a tag antes da hora
    dados_js = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    js = "\n\n".join((SRC / "js" / nome).read_text(encoding="utf-8") for nome in SCRIPTS)
    assert "/*DADOS*/null" in js, "marcador /*DADOS*/null não encontrado em base.js"
    js = js.replace("/*DADOS*/null", dados_js, 1)

    html = (SRC / "index.html").read_text(encoding="utf-8")
    html = html.replace("/*CSS*/", (SRC / "estilo.css").read_text(encoding="utf-8"), 1)
    html = html.replace("/*JS*/", js, 1)

    SAIDA.parent.mkdir(exist_ok=True)
    SAIDA.write_text(html, encoding="utf-8")
    print(f"docs/index.html ({SAIDA.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
