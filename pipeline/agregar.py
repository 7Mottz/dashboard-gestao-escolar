"""
Lê a base em data/ e monta agregados/painel.json, o único arquivo que o HTML usa.

Cada aba tem seu módulo aqui no pipeline. O que dá pra calcular antes, é
calculado aqui; o que depende de filtro na tela (funil, ficha do aluno, drill
das despesas) vai em formato compacto pro navegador.
"""
import json

from alunos import agregar_alunado, agregar_rematricula
from farol import agregar_farol
from financeiro import agregar_financeiro
from funil import agregar_funil
from insights import gerar_insights
from util import RAIZ, Config, ler


def main():
    meta = ler("meta.json")
    cfg = Config(meta)
    alunos = ler("alunos.json")
    fin = ler("financeiro.json")
    leads = ler("leads.json")

    painel = {
        "meta": {k: meta[k] for k in ("escola", "ano", "ano_proximo", "data_ref", "sede", "campanhas", "planejamento")},
        "financeiro": agregar_financeiro(fin, alunos, cfg),
        "alunado": agregar_alunado(alunos, cfg),
        "rematricula": agregar_rematricula(alunos, cfg),
        "farol": agregar_farol(alunos, cfg),
        "funil": agregar_funil(leads, cfg),
    }
    painel["financeiro"]["insights"] = gerar_insights(painel, fin["contas"], cfg)

    saida = RAIZ / "agregados"
    saida.mkdir(exist_ok=True)
    destino = saida / "painel.json"
    destino.write_text(json.dumps(painel, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"agregados/painel.json ({destino.stat().st_size / 1024:.0f} KB)")
    for k, v in painel.items():
        print(f"  {k:12s} {len(json.dumps(v, ensure_ascii=False)) / 1024:7.0f} KB")


if __name__ == "__main__":
    main()
