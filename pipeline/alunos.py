"""Agregados das abas Alunado (ano letivo em curso) e Rematrícula (campanha do ano seguinte)."""
from collections import Counter
from datetime import date, timedelta

from util import SEGMENTOS, d, dias, primeiro_ano, registros, veterano_vs_anterior


def acumulado(datas, ini, n):
    """Quantidade acumulada em cada dia, de ini até ini+n. O que veio antes de ini entra no ponto zero."""
    cont = Counter(datas)
    acc = sum(v for k, v in cont.items() if k < ini)
    saida = []
    for i in range(n + 1):
        acc += cont.get(ini + timedelta(days=i), 0)
        saida.append(acc)
    return saida


def curva_calendario(datas, ano_letivo, ate=None):
    """Acumulado por dia do calendário, de 1/ago do ano anterior até 31/jul (365 pontos)."""
    ini = date(ano_letivo - 1, 8, 1)
    cont = Counter(datas)
    acc = sum(v for k, v in cont.items() if k < ini)
    saida = []
    for dia in dias(ini, ini + timedelta(days=364)):
        acc += cont.get(dia, 0)
        saida.append(acc if ate is None or dia <= ate else None)
    return saida


def por_segmento(regs, ano):
    saida = []
    for seg in SEGMENTOS:
        grupo = [(a, r) for a, r in regs if r["_segmento"] == seg]
        vet = sum(veterano_vs_anterior(a, ano) for a, _ in grupo)
        saida.append({"segmento": seg, "veteranos": vet, "novatos": len(grupo) - vet, "total": len(grupo)})
    return saida


def marcar_segmento(regs, cfg):
    for _, r in regs:
        r["_segmento"] = cfg.segmento[r["serie"]]
    return regs


def agregar_alunado(alunos, cfg):
    foco, ant = cfg.ano, cfg.ano - 1
    ref = cfg.data_ref
    regs_f = marcar_segmento(registros(alunos, foco), cfg)
    regs_a = marcar_segmento(registros(alunos, ant), cfg)
    cursando = [(a, r) for a, r in regs_f if r["status"] == "cursando"]
    cursando_ant = [(a, r) for a, r in regs_a if r["status"] == "cursando"]

    total = len(cursando)
    vet_ant = sum(veterano_vs_anterior(a, foco) for a, _ in cursando)
    nov_capt = sum(primeiro_ano(a) == foco for a, _ in cursando)
    formandos_ant = [(a, r) for a, r in cursando_ant if r["serie"] == "3ª série"]
    elegiveis = [(a, r) for a, r in cursando_ant if r["serie"] != "3ª série"]
    retidos = [a for a, _ in elegiveis if str(foco) in a["anos"]]

    datas_f = [d(r["data_matricula"]) for _, r in regs_f]
    datas_a = [d(r["data_matricula"]) for _, r in regs_a]
    ini_f, ini_a = min(datas_f), min(datas_a)
    n = (ref - ini_f).days

    inat_f = [d(r["data_inativo"]) for _, r in regs_f if r["data_inativo"]]
    inat_a = [d(r["data_inativo"]) for _, r in regs_a if r["data_inativo"]]

    atual = acumulado(datas_f, ini_f, n)
    anterior = acumulado(datas_a, ini_a, n)
    dia_ciclo = min(n, 365)

    mensal = {}
    for a, r in regs_f:
        chave = r["data_matricula"][:7]
        m = mensal.setdefault(chave, {"veteranos": 0, "novatos": 0})
        m["veteranos" if veterano_vs_anterior(a, foco) else "novatos"] += 1

    fim_diario = max(datas_f)
    cont_dia = Counter(datas_f)

    series = []
    for serie in cfg.series:
        grupo = [(a, r) for a, r in cursando if r["serie"] == serie]
        turmas = {r["turma"] for _, r in regs_f if r["serie"] == serie}
        vagas = len(turmas) * cfg.vagas[serie]
        vet = sum(veterano_vs_anterior(a, foco) for a, _ in grupo)
        series.append({"serie": serie, "segmento": cfg.segmento[serie], "total": len(grupo),
                       "novatos": len(grupo) - vet, "veteranos": vet, "turmas": len(turmas), "vagas": vagas,
                       "ocupacao": round(len(grupo) / vagas, 4) if vagas else 0})

    turmas = {}
    for a, r in regs_f:
        t = turmas.setdefault(r["turma"], {"turma": r["turma"], "serie": r["serie"], "segmento": r["_segmento"],
                                           "turno": r["turno"], "vagas": cfg.vagas[r["serie"]], "matriculados": 0})
        if r["status"] == "cursando":
            t["matriculados"] += 1
    ocupacao = sorted(turmas.values(), key=lambda t: (cfg.ordem_serie(t["serie"]), t["turma"]))
    for t in ocupacao:
        t["pct"] = round(t["matriculados"] / t["vagas"], 4)

    evadidos = [r for a, r in elegiveis if str(foco) not in a["anos"]]
    por_origem = Counter(r["serie"] for r in evadidos)

    def mensal_inativos(regs):
        c = Counter(d(r["data_inativo"]).month for _, r in regs if r["data_inativo"])
        return [c.get(m, 0) for m in range(1, 13)]

    return {
        "foco": foco,
        "anterior": ant,
        "periodo": {"primeira": ini_f.isoformat(), "ultima": fim_diario.isoformat(), "total": total},
        "kpis": {
            "total": total,
            "registros": len(regs_f),
            "veteranos_ant": vet_ant,
            "novatos_ant": total - vet_ant,
            "novatos_captacao": nov_capt,
            "veteranos_captacao": total - nov_capt,
            "elegiveis_ant": len(elegiveis),
            "retidos": len(retidos),
            "retencao": round(len(retidos) / len(elegiveis), 4),
            "formandos_ant": len(formandos_ant),
        },
        "ritmo": {"dia": dia_ciclo, "atual": atual[dia_ciclo], "anterior": anterior[dia_ciclo]},
        "ciclo": {"inicio_atual": ini_f.isoformat(), "inicio_anterior": ini_a.isoformat(),
                  "atual": atual, "anterior": anterior,
                  "evasoes_atual": acumulado(inat_f, ini_f, n), "evasoes_anterior": acumulado(inat_a, ini_a, n)},
        "calendario": {"atual": curva_calendario(datas_f, foco, ref), "anterior": curva_calendario(datas_a, ant)},
        "mensal": [{"mes": k, **v} for k, v in sorted(mensal.items())],
        "diario": {"inicio": ini_f.isoformat(),
                   "qtd": [cont_dia.get(dia, 0) for dia in dias(ini_f, fim_diario)]},
        "segmentos": por_segmento(cursando, foco),
        "series": series,
        "evasao": {
            "elegiveis": len(elegiveis),
            "evadidos": len(evadidos),
            "pct": round(len(evadidos) / len(elegiveis), 4),
            "formandos": len(formandos_ant),
            "por_serie": [{"serie": s, "segmento": cfg.segmento[s], "qtd": por_origem[s]}
                          for s in cfg.series if por_origem[s]],
        },
        "evasao_mensal": {"atual": mensal_inativos(regs_f), "anterior": mensal_inativos(regs_a)},
        "turmas": ocupacao,
        "mapa": [[a["lat"], a["lng"]] for a, _ in cursando],
    }


def agregar_rematricula(alunos, cfg):
    foco, ant = cfg.ano_prox, cfg.ano
    ref = cfg.data_ref
    ini_f, ini_a = cfg.campanhas[foco], cfg.campanhas[ant]
    dia_ref = (ref - ini_f).days

    regs_f = marcar_segmento(registros(alunos, foco), cfg)
    regs_a = marcar_segmento(registros(alunos, ant), cfg)
    datas_f = [d(r["data_matricula"]) for _, r in regs_f]
    datas_a = [d(r["data_matricula"]) for _, r in regs_a]
    vet = sum(veterano_vs_anterior(a, foco) for a, _ in regs_f)

    diario = []
    for dia in dias(ini_f, ref):
        v = sum(1 for a, r in regs_f if r["data_matricula"] == dia.isoformat() and veterano_vs_anterior(a, foco))
        t = sum(1 for x in datas_f if x == dia)
        diario.append([v, t - v])

    ritmo = []
    for ano in (foco - 2, foco - 1, foco):
        ini = cfg.campanhas[ano]
        datas = [d(r["data_matricula"]) for _, r in registros(alunos, ano)]
        ritmo.append({"ano": ano, "no_dia": sum(1 for x in datas if x <= ini + timedelta(days=dia_ref)),
                      "total_final": len(datas), "atual": ano == foco})

    inat_f = [d(r["data_inativo"]) for _, r in regs_a if r["data_inativo"] and d(r["data_inativo"]) >= ini_f]
    regs_aa = registros(alunos, ant - 1)
    inat_a = [d(r["data_inativo"]) for _, r in regs_aa if r["data_inativo"] and d(r["data_inativo"]) >= ini_a]

    series = []
    for serie in cfg.series:
        grupo = [(a, r) for a, r in regs_f if r["serie"] == serie]
        v = sum(veterano_vs_anterior(a, foco) for a, _ in grupo)
        series.append({"serie": serie, "segmento": cfg.segmento[serie], "veteranos": v,
                       "novatos": len(grupo) - v, "total": len(grupo)})

    base = [(a, r) for a, r in regs_a if r["status"] == "cursando"]
    decisoes = Counter(a["decisao_prox"] for a, _ in base)
    decisoes_seg = []
    for seg in SEGMENTOS:
        c = Counter(a["decisao_prox"] for a, r in base if r["_segmento"] == seg)
        decisoes_seg.append({"segmento": seg, **{k: c.get(k, 0) for k in
                                                ("rematriculado", "pendente", "nao_renova", "formando")}})

    return {
        "foco": foco,
        "anterior": ant,
        "inicio": ini_f.isoformat(),
        "inicio_anterior": ini_a.isoformat(),
        "dia": dia_ref,
        "kpis": {"total": len(regs_f), "veteranos": vet, "novatos": len(regs_f) - vet,
                 "total_ano_atual": len(base)},
        "diario": diario,
        "ritmo": ritmo,
        "ciclo": {"atual": acumulado(datas_f, ini_f, dia_ref), "anterior": acumulado(datas_a, ini_a, max(dia_ref, 200)),
                  "evasoes_atual": acumulado(inat_f, ini_f, dia_ref), "evasoes_anterior": acumulado(inat_a, ini_a, dia_ref)},
        "calendario": {"atual": curva_calendario(datas_f, foco, ref), "anterior": curva_calendario(datas_a, ant)},
        "segmentos": por_segmento(regs_f, foco),
        "series": series,
        "decisoes": {k: decisoes.get(k, 0) for k in ("rematriculado", "pendente", "nao_renova", "formando")},
        "decisoes_segmento": decisoes_seg,
    }
