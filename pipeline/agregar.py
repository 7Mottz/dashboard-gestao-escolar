"""
Lê a base em data/ e monta agregados/painel.json, o único arquivo que o HTML usa.

Cada aba tem seu módulo aqui no pipeline. O que dá pra calcular antes, é
calculado aqui; o que depende de filtro na tela (funil, ficha do aluno, drill
das despesas) vai em formato compacto pro navegador.
"""
import json

from alunos import agregar_alunado, agregar_rematricula
from coordenacao import agregar_coordenacao
from evasao import agregar_evasao
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
    ped = ler("pedagogico.json")

    meta_pub = {k: meta[k] for k in ("escola", "ano", "ano_proximo", "data_ref", "sede", "campanhas", "planejamento")}
    painel = {
        "meta": meta_pub,
        "financeiro": agregar_financeiro(fin, alunos, cfg),
        "alunado": agregar_alunado(alunos, cfg),
        "rematricula": agregar_rematricula(alunos, cfg),
        "farol": agregar_farol(alunos, cfg),
        "funil": agregar_funil(leads, cfg),
    }
    painel["financeiro"]["insights"] = gerar_insights(painel, fin["contas"], cfg)

    # Coordenação e Radar de evasão são páginas próprias, cada uma com o seu JSON
    coord = agregar_coordenacao(ped, alunos, cfg)
    evasao = agregar_evasao(ped, coord, alunos, cfg)
    linhas = [dict(zip(coord["alunos"]["campos"], r)) for r in coord["alunos"]["linhas"]]
    dic = coord["alunos"]["dic"]
    paginas = {
        "painel.json": painel,
        # a ficha do aluno na coordenação mostra só o selo do radar (faixa, chance e sinais)
        "coordenacao.json": {"meta": meta_pub, "coordenacao": coord,
                             "radar": {str(a["id"]): [a["prob"], a["faixa"], a["motivos"]] for a in evasao["atuais"]}},
        "evasao.json": {"meta": meta_pub, "evasao": evasao,
                        "alunos": {str(l["id"]): [l["nome"], dic["turma"][l["turma"]], dic["segmento"][l["segmento"]]] for l in linhas}},
    }

    saida = RAIZ / "agregados"
    saida.mkdir(exist_ok=True)
    for nome, conteudo in paginas.items():
        destino = saida / nome
        destino.write_text(json.dumps(conteudo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"agregados/{nome} ({destino.stat().st_size / 1024:.0f} KB)")
        for k, v in conteudo.items():
            print(f"  {k:12s} {len(json.dumps(v, ensure_ascii=False)) / 1024:7.0f} KB")


if __name__ == "__main__":
    main()
