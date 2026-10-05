"""
Gera a base fictícia do painel em data/.

Nada aqui é real: alunos, valores, fornecedores e leads são inventados. A seed é
fixa, então rodar de novo produz exatamente os mesmos arquivos.
"""
import json
from pathlib import Path

from gerador.alunos import gerar_alunos, inicio_campanha
from gerador.comum import ANO, ANO_PROX, DATA_REF, ESCOLA, REAJUSTE_ANUAL, SEDE, SERIES
from gerador.financeiro import CONTRATURNO, TAXA_PLATAFORMA, gerar_financeiro
from gerador.funil import gerar_leads

SAIDA = Path(__file__).parent / "data"


def salvar(nome, conteudo):
    caminho = SAIDA / nome
    caminho.write_text(json.dumps(conteudo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  data/{nome} ({caminho.stat().st_size / 1024:.0f} KB)")


def main():
    SAIDA.mkdir(exist_ok=True)
    print("gerando base fictícia:")
    leads = gerar_leads()
    alunos = gerar_alunos(leads)
    salvar("leads.json", leads)
    salvar("alunos.json", alunos)
    salvar("financeiro.json", gerar_financeiro(alunos))

    ativos = sum(1 for a in alunos if str(ANO) in a["anos"] and a["anos"][str(ANO)]["status"] == "cursando")
    salvar("meta.json", {
        "escola": ESCOLA,
        "ano": ANO,
        "ano_proximo": ANO_PROX,
        "data_ref": DATA_REF.isoformat(),
        "sede": SEDE,
        "campanhas": {str(a): inicio_campanha(a).isoformat() for a in range(ANO - 2, ANO_PROX + 1)},
        # parâmetros comerciais que o pipeline usa pra projetar faturamento
        "series": [{"segmento": s[0], "serie": s[1], "mensalidade": s[2], "vagas": s[3], "turnos": s[4]}
                   for s in SERIES],
        "ano_base_mensalidade": ANO,
        "reajuste_anual": REAJUSTE_ANUAL,
        "contraturno_mensal": CONTRATURNO,
        "taxa_plataforma": TAXA_PLATAFORMA,
        "material_anual": {"Educação Infantil": 600, "Fundamental I": 900, "Fundamental II": 1100, "Ensino Médio": 1300},
        # planejamento que vem preenchido na demo; na tela dá pra editar
        "planejamento": {
            "alunos_atuais": ativos,
            "taxa_rematricula": 86,
            "meta_alunos": 860,
            "inicio": f"{ANO}-09-01",
            "fim": f"{ANO_PROX}-03-31",
            "mensalidade": 1450,
        },
    })


if __name__ == "__main__":
    main()
