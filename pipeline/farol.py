"""
Farol: base de alunos e faturamento projetado de cada ciclo.

Cada ciclo é cortado no mesmo dia/mês da data de referência (ex.: 15/10/2025
para o ciclo 2025), assim a comparação entre anos é justa. O ciclo do ano que
vem não tem corte, ele só tem o que já aconteceu até hoje.
"""
from collections import defaultdict
from datetime import date, timedelta

from util import SEGMENTOS, compactar, d, registros

INFANTIL_E_F1 = ("Educação Infantil", "Fundamental I")


def perfil(a, ano):
    anteriores = [int(k) for k in a["anos"] if int(k) < ano]
    if not anteriores:
        return "Matrícula"
    return "Egresso" if ano - max(anteriores) >= 3 else "Rematrícula"


def corte_do_ciclo(cfg, ano):
    if ano > cfg.ano:
        return cfg.data_ref
    return date(ano, cfg.data_ref.month, cfg.data_ref.day)


def linha(cfg, a, r, ano, corte):
    seg = cfg.segmento[r["serie"]]
    p = perfil(a, ano)
    mens_bruto = cfg.mensalidade(r["serie"], ano)
    dm = d(r["data_matricula"])
    inativo = d(r["data_inativo"])
    ativo = not (inativo and inativo <= corte)
    ini = dm.month if dm.year == ano else 1
    fim = inativo.month if inativo else 12
    parcelas = max(0, fim - ini + 1)
    mensal = round(mens_bruto * (1 - a["desconto"]), 2)
    contra_mes = cfg.meta["contraturno_mensal"] if a["contraturno"] and seg in INFANTIL_E_F1 and r["turno"] == "Manhã" else 0
    entrada = round(mens_bruto * 0.5, 2) if p == "Matrícula" else 0
    extra = cfg.meta["material_anual"][seg]
    acordo = round(mensal * 0.5, 2) if r["acordo"] else 0

    bruto = entrada + mens_bruto * parcelas + contra_mes * parcelas + extra + acordo
    descontos = (mens_bruto - mensal) * parcelas
    liquido = bruto - descontos

    if ano < cfg.ano or (ano == cfg.ano and corte.year == ano):
        ate = min(fim, corte.month) if corte.year == ano else fim
        meses_fat = max(0, ate - ini + 1)
    else:
        meses_fat = 0
    faturado = entrada + (mensal + contra_mes) * meses_fat + (extra + acordo if meses_fat else 0)
    recebido = faturado * (1 - r["inad"])

    return {
        "id": a["id"], "nome": a["nome"], "turma": r["turma"], "turno": r["turno"], "segmento": seg,
        "serie": r["serie"], "perfil": p, "ativo": 1 if ativo else 0, "data": r["data_matricula"],
        "entrada": round(entrada, 2), "bruto": round(bruto, 2), "descontos": round(descontos, 2),
        "liquido": round(liquido, 2), "mens_bruto": mens_bruto, "mensal": mensal, "parcelas": parcelas,
        "contraturno": round(contra_mes * parcelas, 2), "extra": extra, "acordo": acordo,
        "faturado": round(faturado, 2), "recebido": round(recebido, 2),
        "_ini": ini, "_fim": fim, "_contra_mes": contra_mes, "_meses_fat": meses_fat, "_inad": r["inad"],
    }


def mensal_do_ciclo(linhas, ano):
    proj, real = defaultdict(lambda: [0.0, 0.0]), defaultdict(lambda: [0.0, 0.0])
    for l in linhas:
        if l["entrada"]:
            k = l["data"][:7]
            proj[k][0] += l["entrada"]
            proj[k][1] += l["entrada"]
            real[k][0] += l["entrada"]
            real[k][1] += l["entrada"] * (1 - l["_inad"])
        for m in range(l["_ini"], l["_fim"] + 1):
            k = f"{ano}-{m:02d}"
            proj[k][0] += l["mens_bruto"] + l["_contra_mes"]
            proj[k][1] += l["mensal"] + l["_contra_mes"]
            if m - l["_ini"] < l["_meses_fat"]:
                real[k][0] += l["mensal"] + l["_contra_mes"]
                real[k][1] += (l["mensal"] + l["_contra_mes"]) * (1 - l["_inad"])
        k = f"{ano}-{l['_ini']:02d}"
        proj[k][0] += l["extra"] + l["acordo"]
        proj[k][1] += l["extra"] + l["acordo"]
    arred = lambda dic: {k: [round(v[0], 2), round(v[1], 2)] for k, v in sorted(dic.items())}
    return arred(proj), arred(real)


CAMPOS = ["id", "nome", "turma", "turno", "segmento", "serie", "perfil", "ativo", "data", "entrada", "bruto",
          "descontos", "liquido", "mens_bruto", "mensal", "parcelas", "contraturno", "extra", "acordo",
          "faturado", "recebido"]


def agregar_farol(alunos, cfg):
    ciclos = {}
    for ano in (cfg.ano - 1, cfg.ano, cfg.ano_prox):
        corte = corte_do_ciclo(cfg, ano)
        linhas = [linha(cfg, a, r, ano, corte) for a, r in registros(alunos, ano) if d(r["data_matricula"]) <= corte]
        linhas.sort(key=lambda l: (cfg.ordem_serie(l["serie"]), l["turma"], l["nome"]))
        proj, real = mensal_do_ciclo(linhas, ano)
        ciclos[str(ano)] = {"corte": corte.isoformat(), "alunos": compactar(linhas, CAMPOS,
                                                                           ["turma", "turno", "segmento", "serie", "perfil"]),
                            "proj_mensal": proj, "real_mensal": real}

    historico = []
    for ano in range(min(int(k) for a in alunos for k in a["anos"]), cfg.ano + 1):
        regs = [(a, r) for a, r in registros(alunos, ano) if r["status"] == "cursando"]
        por_seg = {s: 0 for s in SEGMENTOS}
        for _, r in regs:
            por_seg[cfg.segmento[r["serie"]]] += 1
        fat = sum(linha(cfg, a, r, ano, date(ano, 12, 31))["liquido"] for a, r in registros(alunos, ano))
        historico.append({"ano": ano, "total": len(regs), "segmentos": por_seg, "faturamento": round(fat, 2)})

    curvas = {}
    dia_hoje = (cfg.data_ref - cfg.campanhas[cfg.ano_prox]).days
    for ano, ini in sorted(cfg.campanhas.items()):
        datas = sorted(d(r["data_matricula"]) for _, r in registros(alunos, ano))
        n = dia_hoje if ano == cfg.ano_prox else 240
        acc, pts, i = 0, [], 0
        for k in range(n + 1):
            limite = ini + timedelta(days=k)
            while i < len(datas) and datas[i] <= limite:
                acc += 1
                i += 1
            pts.append(acc)
        curvas[str(ano)] = pts

    return {"ciclos": ciclos, "historico": historico, "curvas": curvas,
            "taxa_plataforma": cfg.meta["taxa_plataforma"]}
