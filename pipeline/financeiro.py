"""Agregados do financeiro: contas, orçamento, fluxo de caixa, empréstimos e indicadores por aluno."""
from collections import Counter, defaultdict

from util import ROTULOS, compactar, d, primeiro_ano, registros

CAMPOS_CONTA = ["id", "plano", "sub", "favorecido", "valor", "vencimento", "situacao", "baixa", "documento",
                "parcela", "empresa", "centro"]
CATEGORICOS_CONTA = ["plano", "sub", "favorecido", "situacao", "empresa", "centro"]


def status_do_mes(n, ref):
    return "fechado" if n < ref.month else "andamento" if n == ref.month else "projecao"


def despesa_escola_por_mes(contas):
    total = defaultdict(float)
    for c in contas:
        if c["centro"] == "Escola":
            total[c["vencimento"][:7]] += c["valor"]
    return total


def indicadores_alunos(alunos, cfg, receitas):
    ano = cfg.ano
    cursando = [(a, r) for a, r in registros(alunos, ano) if r["status"] == "cursando"]
    novos = sum(primeiro_ano(a) == ano for a, _ in cursando)
    ant = [(a, r) for a, r in registros(alunos, ano - 1) if r["status"] == "cursando"]
    elegiveis = [a for a, r in ant if r["serie"] != "3ª série"]
    retidos = [a for a in elegiveis if str(ano) in a["anos"]]
    fechados = [r for r in receitas if not r["previsto"]]
    mensalidades = sum(r["mensalidades"] for r in fechados) / len(fechados)
    return {
        "ano": ano,
        "matriculados": len(cursando),
        "novos": novos,
        "pct_novos": round(novos / len(cursando), 4),
        "retidos": len(retidos),
        "elegiveis": len(elegiveis),
        "retencao": round(len(retidos) / len(elegiveis), 4),
        "ticket_medio": round(mensalidades / len(cursando), 2),
    }


def ltv_e_unit_economics(alunos, cfg, kpis, contas):
    # permanência média de quem já saiu (formado, evadido ou não renovou)
    inicio_historico = min(int(k) for a in alunos for k in a["anos"])
    duracoes = []
    for a in alunos:
        anos = sorted(int(k) for k in a["anos"])
        # quem já estava na base inicial não tem a permanência inteira registrada
        if anos[-1] < cfg.ano and anos[0] > inicio_historico:
            duracoes.append(len(anos))
    tempo_medio = sum(duracoes) / len(duracoes)
    ativos = [a for a, r in registros(alunos, cfg.ano) if r["status"] == "cursando"]
    dist = Counter(cfg.ano - primeiro_ano(a) + 1 for a in ativos)
    ticket = kpis["ticket_medio"]
    ltv_bruto = ticket * 12 * tempo_medio
    taxa = cfg.meta["taxa_plataforma"]

    meses_fechados = cfg.data_ref.month - 1
    marketing = sum(c["valor"] for c in contas if c["plano"] == "Marketing" and int(c["vencimento"][5:7]) <= meses_fechados)
    marketing_ano = marketing / meses_fechados * 12
    cac = marketing_ano / kpis["novos"]
    maior_permanencia = max(dist)
    ratio = ltv_bruto / cac
    return {
        "ltv": {
            "n_alunos": len(ativos),
            "tempo_medio_anos": round(tempo_medio, 2),
            "ltv_bruto": round(ltv_bruto, 2),
            "ltv_liquido": round(ltv_bruto * (1 - taxa), 2),
            "ticket_anual": round(ticket * 12, 2),
            "distribuicao": [{"anos": k, "alunos": dist[k]} for k in sorted(dist)],
        },
        "ue": {
            "ltv": round(ltv_bruto, 2),
            "ticket_mensal": ticket,
            "meses_permanencia": round(tempo_medio * 12, 1),
            "ltv_teto": round(ticket * 12 * maior_permanencia, 2),
            "anos_teto": maior_permanencia,
            "cac": round(cac, 2),
            "marketing_ano": round(marketing_ano, 2),
            "novos_ano": kpis["novos"],
            "payback_meses": round(cac / ticket, 1),
            "ltv_cac": round(ratio, 1),
            "status": "saudável" if ratio >= 3 else "atenção" if ratio >= 1.5 else "crítico",
        },
    }


def coorte(alunos, cfg):
    # safra = ano de entrada; acompanha que % segue matriculado nos anos seguintes
    inicio = min(int(k) for a in alunos for k in a["anos"])
    safras = {}
    for a in alunos:
        ent = primeiro_ano(a)
        if ent <= inicio:  # a base inicial não tem ano de entrada real
            continue
        safras.setdefault(ent, []).append(a)
    matriz = []
    for ent in sorted(safras):
        grupo = safras[ent]
        celulas = []
        for off in range(1, cfg.ano - ent + 1):
            ainda = sum(1 for a in grupo if str(ent + off) in a["anos"])
            celulas.append(round(ainda / len(grupo), 4))
        matriz.append({"safra": ent, "n": len(grupo), "celulas": celulas})
    baseline = {}
    for off in (1, 3, 5, 10):
        vals = [m["celulas"][off - 1] for m in matriz if len(m["celulas"]) >= off]
        if vals:
            baseline[str(off)] = {"media": round(sum(vals) / len(vals), 4), "safras": len(vals)}
    return {"matriz": matriz, "baseline": baseline}


def agregar_financeiro(fin, alunos, cfg):
    ref = cfg.data_ref
    receitas = fin["receitas"]
    contas = fin["contas"]
    desp = despesa_escola_por_mes(contas)
    orcado_mes = [sum(o["teto"][i] for o in fin["orcamento"]) for i in range(12)]

    meses, acum = [], 0.0
    for i, r in enumerate(receitas):
        n = i + 1
        st = status_do_mes(n, ref)
        saidas = desp[r["mes"]] if st == "fechado" else orcado_mes[i]
        delta = r["valor_total_transferir"] - saidas
        meses.append({"mes": r["mes"], "rotulo": ROTULOS[i], "status": st,
                      "entradas": round(r["valor_total_transferir"], 2), "saidas": round(saidas, 2),
                      "despesa_real": round(desp[r["mes"]], 2), "orcado": round(orcado_mes[i], 2),
                      "receita_orcada": fin["receita_orcada"][i],
                      "inicio": round(acum, 2), "resultado": round(delta, 2), "acumulado": round(acum + delta, 2)})
        acum += delta

    kpis = indicadores_alunos(alunos, cfg, receitas)
    extra = ltv_e_unit_economics(alunos, cfg, kpis, contas)
    return {
        "meses": meses,
        "receitas": receitas,
        "contas": compactar(contas, CAMPOS_CONTA, CATEGORICOS_CONTA),
        "orcamento": fin["orcamento"],
        "emprestimos": fin["emprestimos"],
        "kpis_alunos": kpis,
        "ltv": extra["ltv"],
        "ue": extra["ue"],
        "coorte": coorte(alunos, cfg),
    }
