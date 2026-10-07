"""
Monta as três páginas em docs/: pega cada esqueleto em src/, coloca o CSS e os scripts
de src/js dentro dele e injeta o JSON correspondente de agregados/.

  docs/index.html        Gestão (financeiro, alunado, rematrícula, farol, funil)
  docs/coordenacao.html  Coordenação pedagógica
  docs/evasao.html       Radar de evasão (machine learning)

Cada uma é um HTML único, sem servidor. Dá pra abrir direto no navegador ou publicar
no GitHub Pages.
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"
AGREG = RAIZ / "agregados"
DOCS = RAIZ / "docs"

# (página de saída, esqueleto, dados, scripts na ordem: base e gráficos primeiro, inicialização por último)
PAGINAS = [
    ("index.html", "index.html", "painel.json",
     ["base.js", "graficos.js", "financeiro.js", "alunado.js", "rematricula.js", "farol.js", "funil.js", "apresentacao.js", "app.js"]),
    ("coordenacao.html", "coordenacao.html", "coordenacao.json",
     ["base.js", "graficos.js", "coordenacao.js", "coord_app.js"]),
    ("evasao.html", "evasao.html", "evasao.json",
     ["base.js", "graficos.js", "evasao.js"]),
]


def montar(saida, esqueleto, dados_arq, scripts, css):
    dados = json.loads((AGREG / dados_arq).read_text(encoding="utf-8"))
    # "</" dentro de um <script> fecharia a tag antes da hora
    dados_js = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    js = "\n\n".join((SRC / "js" / nome).read_text(encoding="utf-8") for nome in scripts)
    assert "/*DADOS*/null" in js, "marcador /*DADOS*/null não encontrado em base.js"
    js = js.replace("/*DADOS*/null", dados_js, 1)
    html = (SRC / esqueleto).read_text(encoding="utf-8").replace("/*CSS*/", css, 1).replace("/*JS*/", js, 1)
    destino = DOCS / saida
    destino.write_text(html, encoding="utf-8")
    print(f"docs/{saida} ({destino.stat().st_size / 1024:.0f} KB)")


def main():
    DOCS.mkdir(exist_ok=True)
    css = (SRC / "estilo.css").read_text(encoding="utf-8")
    for pagina in PAGINAS:
        montar(*pagina, css)


if __name__ == "__main__":
    main()
