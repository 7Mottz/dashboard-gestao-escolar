"""
Coordenação pedagógica: transforma data/pedagogico.json nos números das abas Geral, Alunos,
Fundamental I, Fundamental II, Ensino Médio e Simulados.

Regras (as mesmas do painel original, todas na escala 0-10):
- aprovação: média >= 7
- risco por nota: nota < 6 em 2 ou mais disciplinas; risco por falta: 25% ou mais de faltas
- classificação do aluno: Ótimo (média >= 9 e freq >= 95%), Bom (>= 8 e >= 90%), Atenção (>= 7 e >= 75%),
  Risco (só uma das duas abaixo), Alto risco (as duas abaixo), Sem dados (sem nota: EI e 1º ano)
"""
import math
import statistics as st
from collections import Counter, defaultdict

from util import compactar

NOTA_APROV, NOTA_RISCO, DISC_RISCO, FALTA_RISCO = 7.0, 6.0, 2, 0.25
SEGS = {"fund1": "Fundamental I", "fund2": "Fundamental II", "em": "Ensino Médio"}
CLASSES = ["Ótimo", "Bom", "Atenção", "Risco", "Alto risco", "Sem dados"]


def media(xs):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs), 2) if xs else None


def pearson(xs, ys):
    if len(xs) < 3:
        return None
    mx, my = st.mean(xs), st.mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
    return round(num / den, 3) if den else None


def ultima_nota(tris):
    """Nota mais recente da disciplina: a fechada do último trimestre fechado, ou a parcial do atual."""
    for nota, rec, fech in reversed(tris):
        v = fech if fech is not None else nota
        if v is not None:
            return v
    return None


def classificar(m, f):
    if m is None or f is None:
        return "Sem dados"
    nota_ok, freq_ok = m >= 7, f >= 0.75
    if nota_ok and freq_ok:
        return "Ótimo" if m >= 9 and f >= 0.95 else "Bom" if m >= 8 and f >= 0.90 else "Atenção"
    return "Risco" if nota_ok != freq_ok else "Alto risco"


def quadrante(pres, m):
    if pres >= 0.75:
        return "engajado" if m >= 7 else "presente_baixo"
    return "ausente_bom" if m >= 7 else "critico"


def agregar_coordenacao(ped, alunos, cfg):
    nomes = {a["id"]: a["nome"] for a in alunos}
    reg = {a["id"]: a["anos"][str(cfg.ano)] for a in alunos if str(cfg.ano) in a["anos"]}
    dias = ped["dias_letivos"]
    nd = len(dias)
    disc_todas = sorted({d for ds in ped["disciplinas"].values() for d in ds})
    docentes = {d["id"]: d for d in ped["docentes"]}

    # ---------------------------------------------------------- um registro por aluno ativo
    base, detalhe = [], {}
    idx_txt = {}   # textos repetidos (tipo e observação de ocorrência, área de parecer) viram índices
    def ix(campo, v):
        lista = idx_txt.setdefault(campo, {})
        return lista.setdefault(v, len(lista))
    for p in ped["alunos"]:
        r = reg[p["id"]]
        seg = cfg.segmento[r["serie"]]
        dias_aluno = nd - p["inicio"]
        aulas_dia = ped["aulas_dia"].get(seg, 5)
        # frequência oficial é por aula: dias inteiros de falta x aulas do dia + faltas avulsas de aula
        faltas_aulas = len(p["faltas"]) * aulas_dia + p.get("faltas_parciais", 0)
        aulas = dias_aluno * aulas_dia
        freq = max(0.0, 1 - faltas_aulas / aulas) if aulas else None
        ult = {d: ultima_nota(t) for d, t in p["notas"].items()}
        m = media(ult.values())
        disc_risco = sorted([(d, v) for d, v in ult.items() if v is not None and v < NOTA_RISCO], key=lambda x: x[1])
        pct_falta = 1 - freq if freq is not None else 0
        nota_ruim, falta_ruim = len(disc_risco) >= DISC_RISCO, pct_falta >= FALTA_RISCO
        tipo_risco = "combinado" if nota_ruim and falta_ruim else "nota" if nota_ruim else "falta" if falta_ruim else None
        base.append({
            "id": p["id"], "nome": nomes[p["id"]], "serie": r["serie"], "turma": r["turma"], "segmento": seg,
            "media": m, "freq": round(freq, 4) if freq is not None else None,
            "faltas": faltas_aulas, "aulas": aulas,
            "n_oc": len(p["ocorrencias"]), "ult_oc": p["ocorrencias"][0]["data"] if p["ocorrencias"] else None,
            "classif": classificar(m, freq), "risco": tipo_risco, "n_disc_risco": len(disc_risco),
            "clubes": ", ".join(p["clubes"]) or None,
        })
        detalhe[p["id"]] = {
            "n": [[disc_todas.index(d), t] for d, t in p["notas"].items()],
            "o": [[o["data"], ix("tipo", o["tipo"]), ix("obs", o["obs"]), int(o["imped"]), o["por"], int(o["visivel"]), o["anexo"]]
                  for o in p["ocorrencias"]],
            "p": [[x["tri"], ix("area", x["area"]), x["nivel"], x["frases"], x["fechamento"], x["prof"], int(x["confirmado"])]
                  for x in p["pareceres"]],
            "c": p["clubes"],
        }
    por_id = {b["id"]: b for b in base}
    ped_por_id = {p["id"]: p for p in ped["alunos"]}

    segmentos = {k: agregar_segmento(k, nome, base, ped_por_id, ped, cfg, disc_todas) for k, nome in SEGS.items()}

    return {
        "disciplinas": disc_todas,
        "trimestres": ped["trimestres"],
        "tri_atual": ped["tri_atual"],
        "dias_letivos": dias,
        "series_parecer": ped["series_parecer"],
        "fragmentos": ped["fragmentos"],
        "fechamentos": ped["fechamentos"],
        "alunos": compactar(base, ["id", "nome", "serie", "turma", "segmento", "media", "freq", "faltas", "aulas", "n_oc",
                                   "ult_oc", "classif", "risco", "n_disc_risco", "clubes"],
                            ["serie", "turma", "segmento", "classif", "risco"]),
        "detalhe": {str(k): v for k, v in detalhe.items()},
        "textos": {campo: list(v) for campo, v in idx_txt.items()},
        "segmentos": segmentos,  # recuperação usa índice de disciplina (ver disc_todas)
        "geral": agregar_geral(segmentos, base, ped_por_id, disc_todas, ped),
        "docentes": [{k: d[k] for k in ("id", "nome", "segmentos", "funcao", "graduacao", "pos_graduacao", "especializacao",
                                        "mestrado", "doutorado", "outros")} for d in ped["docentes"]],
        "simulados": agregar_simulados(ped["simulados"]),
    }


def agregar_segmento(chave, nome_seg, base, ped_por_id, ped, cfg, disc_todas):
    todos = [b for b in base if b["segmento"] == nome_seg]
    com_nota = [b for b in todos if b["media"] is not None]
    turmas = sorted({b["turma"] for b in todos}, key=lambda t: (cfg.ordem_serie(t.rsplit(" ", 1)[0]), t))
    disc = ped["disciplinas"][nome_seg]
    tris = ped["trimestres"]
    tot_faltas, tot_aulas = sum(b["faltas"] for b in todos), sum(b["aulas"] for b in todos)
    risco = [b for b in todos if b["risco"]]

    # média por turma e por turma x disciplina (nota mais recente de cada disciplina)
    por_turma, heat = [], {}
    for t in turmas + ["__TODAS__"]:
        alunos_t = [b for b in com_nota if t == "__TODAS__" or b["turma"] == t]
        linhas = []
        for d in disc:
            vals = [ultima_nota(ped_por_id[b["id"]]["notas"][d]) for b in alunos_t if d in ped_por_id[b["id"]]["notas"]]
            vals = [v for v in vals if v is not None]
            if vals:
                linhas.append({"disciplina": d, "media": round(st.mean(vals), 2), "n": len(vals),
                               "abaixo_7": sum(v < 7 for v in vals), "min": min(vals), "max": max(vals)})
        heat[t] = linhas
        if t != "__TODAS__" and alunos_t:
            ms = [b["media"] for b in alunos_t]
            por_turma.append({"turma": t, "n": sum(1 for b in todos if b["turma"] == t), "n_nota": len(ms),
                              "media": round(st.mean(ms), 2), "mediana": round(st.median(ms), 2), "min": min(ms),
                              "max": max(ms), "abaixo_7": sum(m < 7 for m in ms)})
    n_por_turma = Counter(b["turma"] for b in todos)
    for t in turmas:   # turmas sem nota (1º ano no Fund I) aparecem só na contagem
        if not any(x["turma"] == t for x in por_turma):
            por_turma.append({"turma": t, "n": n_por_turma[t], "n_nota": 0, "media": None})
    por_turma.sort(key=lambda x: turmas.index(x["turma"]))

    # recuperação por trimestre: aluno com pelo menos 1 disciplina abaixo de 7 na nota do trimestre
    recup = {}
    for t in tris:
        i = t["num"] - 1
        lancadas = sum(1 for b in com_nota for d in ped_por_id[b["id"]]["notas"].values() if len(d) > i)
        if not lancadas:
            continue
        turmas_rec = []
        for tm in turmas:
            alunos_rec = []
            for b in com_nota:
                if b["turma"] != tm:
                    continue
                notas_t = {d: v[i][0] for d, v in ped_por_id[b["id"]]["notas"].items() if len(v) > i}
                baixas = sorted([(d, n) for d, n in notas_t.items() if n < 7], key=lambda x: x[1])
                if baixas:
                    alunos_rec.append({"id": b["id"], "media": media(notas_t.values()),
                                       "disc": [[disc_todas.index(d), n] for d, n in baixas]})
            if any(b["turma"] == tm for b in com_nota):
                top = Counter(disc_todas[d] for a in alunos_rec for d, _ in a["disc"]).most_common(5)
                turmas_rec.append({"turma": tm, "n": len(alunos_rec), "total": sum(1 for b in com_nota if b["turma"] == tm),
                                   "top": top, "alunos": sorted(alunos_rec, key=lambda a: -len(a["disc"]))})
        recup[str(t["num"])] = {"fechado": t["fechado"], "lancadas": lancadas, "total": sum(x["n"] for x in turmas_rec),
                                "por_turma": turmas_rec}

    # correlação presença x nota
    pts = [b for b in com_nota if b["freq"] is not None]
    pontos = [[b["id"], b["turma"], round(b["freq"], 4), b["media"], b["faltas"], b["aulas"], quadrante(b["freq"], b["media"])]
              for b in pts]
    quad = Counter(p[6] for p in pontos)

    # calendário de presença diária (catraca): por dia e turma, com quem faltou
    dias = ped["dias_letivos"]
    cal = {}
    ativos_dia = defaultdict(list)
    for b in todos:
        p = ped_por_id[b["id"]]
        faltou = set(p["faltas"])
        for i in range(p["inicio"], len(dias)):
            ativos_dia[i].append((b, i in faltou))
    for i, lista in ativos_dia.items():
        por_t = defaultdict(lambda: [0, []])
        for b, f in lista:
            por_t[b["turma"]][0] += 1
            if f:
                por_t[b["turma"]][1].append(b["id"])
        falt = sum(len(v[1]) for v in por_t.values())
        cal[dias[i]] = {"esp": len(lista), "faltas": falt,
                        "turmas": [[t, v[0], v[1]] for t, v in sorted(por_t.items(), key=lambda x: turmas.index(x[0]))]}

    # 1º ano (avaliação descritiva) fica fora das estatísticas de nota do Fund I
    sem_nota = [b for b in todos if b["media"] is None]
    info_parecer = None
    if sem_nota and chave == "fund1":
        info_parecer = {"alunos": len(sem_nota), "turmas": len({b["turma"] for b in sem_nota}),
                        "series": sorted({b["serie"] for b in sem_nota})}

    return {
        "nome": nome_seg, "disciplinas": disc, "turmas": turmas,
        "kpis": {"alunos": len(todos), "media": media(b["media"] for b in com_nota),
                 "aprov": round(sum(b["media"] >= NOTA_APROV for b in com_nota) / len(com_nota), 4) if com_nota else None,
                 "n_aprov": sum(b["media"] >= NOTA_APROV for b in com_nota), "n_nota": len(com_nota),
                 "presenca": round(1 - tot_faltas / tot_aulas, 4) if tot_aulas else None, "faltas": tot_faltas, "aulas": tot_aulas,
                 "risco": len(risco), "risco_tipos": dict(Counter(b["risco"] for b in risco))},
        "por_turma": por_turma, "heatmap": heat, "recuperacao": recup,
        "correlacao": {"pontos": pontos, "pearson": pearson([p[2] for p in pontos], [p[3] for p in pontos]), "quadrantes": dict(quad)},
        "calendario": cal,
        "risco": [b["id"] for b in sorted(risco, key=lambda b: (b["risco"] != "combinado", b["media"] or 10))],
        "info_parecer": info_parecer,
    }


def agregar_geral(segmentos, base, ped_por_id, disc_todas, ped):
    linhas = []
    for k, s in segmentos.items():
        kp = s["kpis"]
        rec_t1 = s["recuperacao"].get("1", {}).get("total", 0)
        linhas.append({"key": k, "nome": s["nome"], "alunos": kp["alunos"], "turmas": len(s["turmas"]), "media": kp["media"],
                       "aprov": kp["aprov"], "presenca": kp["presenca"], "risco": kp["risco"], "rec_t1": rec_t1,
                       "rec": {t: v["total"] for t, v in s["recuperacao"].items()}})
    seg_alunos = [b for b in base if b["segmento"] in SEGS.values()]
    com_nota = [b for b in seg_alunos if b["media"] is not None]
    tot_f, tot_a = sum(b["faltas"] for b in seg_alunos), sum(b["aulas"] for b in seg_alunos)
    # média ponderada pelos alunos com nota de cada segmento
    pond = sum(l["media"] * segmentos[l["key"]]["kpis"]["n_nota"] for l in linhas if l["media"]) / max(1, sum(
        segmentos[l["key"]]["kpis"]["n_nota"] for l in linhas if l["media"]))

    # disciplinas com mais alunos em recuperação, por trimestre (geral e por segmento)
    ranking = {}
    for t in ped["trimestres"]:
        i = t["num"] - 1
        cont = {"__TODAS__": Counter()}
        for b in com_nota:
            for d, v in ped_por_id[b["id"]]["notas"].items():
                if len(v) > i and v[i][0] < 7:
                    cont["__TODAS__"][d] += 1
                    cont.setdefault(b["segmento"], Counter())[d] += 1
        if cont["__TODAS__"]:
            ranking[str(t["num"])] = {k: c.most_common(12) for k, c in cont.items()}

    top = sorted([b for b in com_nota if b["segmento"] in ("Fundamental II", "Ensino Médio")],
                 key=lambda b: (-b["media"], -(b["freq"] or 0)))[:10]
    return {
        "kpis": {"alunos": len(seg_alunos), "segmentos": len(linhas), "turmas": sum(l["turmas"] for l in linhas),
                 "media": round(pond, 2), "aprov": round(sum(b["media"] >= 7 for b in com_nota) / len(com_nota), 4),
                 "n_aprov": sum(b["media"] >= 7 for b in com_nota), "n_nota": len(com_nota),
                 "presenca": round(1 - tot_f / tot_a, 4), "risco": sum(l["risco"] for l in linhas)},
        "segmentos": linhas,
        "ranking_recuperacao": ranking,
        "top10": [b["id"] for b in top],
    }


def agregar_simulados(provas):
    saida = []
    for p in provas:
        al = p["por_aluno"]
        notas = sorted((a["nota"] for a in al), reverse=True)
        media_esc = st.mean(notas) if notas else 0
        dp = st.pstdev(notas) if len(notas) > 1 else 1
        areas = ["linguagens", "matematica", "ciencias_humanas", "ciencias_natureza"]
        chave_area = "por_area" if p["tri"] else "acertos_por_area"
        esc_area = {k: round(st.mean(a[chave_area][k] for a in al), 1) for k in areas}
        desv = p["rede"]["media_desvio"]
        rede = {"media": {k: round(v + desv * (1 if p["tri"] else 0.3), 1) for k, v in esc_area.items()},
                "maxima": {k: round(v + (210 if p["tri"] else 34), 1) for k, v in esc_area.items()},
                "minima": {k: round(max(0, v - (230 if p["tri"] else 40)), 1) for k, v in esc_area.items()}}
        # posição da escola entre as escolas da rede e de cada aluno entre os alunos da rede
        rede_media, rede_dp = media_esc + desv * (1 if p["tri"] else 0.3), (95 if p["tri"] else 16)
        z_esc = (media_esc - rede_media) / (rede_dp / 4)
        ranking_escola = max(1, round(412 * 0.5 * math.erfc(z_esc / math.sqrt(2))))
        for pos, a in enumerate(sorted(al, key=lambda a: -a["nota"]), 1):
            a["rank_esc"] = pos
            z = (a["nota"] - rede_media) / rede_dp
            a["rank_rede"] = max(1, round(p["rede"]["alunos"] * 0.5 * math.erfc(z / math.sqrt(2))))
            q = pos / len(al)
            a["recomendacao"] = "Desafiar" if q <= 0.2 else "Consolidar" if q <= 0.5 else "Orientar" if q <= 0.8 else "Intervir"
        por_turma = []
        for t in sorted({a["turma"] for a in al}):
            g = [a for a in al if a["turma"] == t]
            por_turma.append({"turma": t, "n": len(g), "media": round(st.mean(a["nota"] for a in g), 1),
                              "areas": {k: round(st.mean(a[chave_area][k] for a in g), 1) for k in areas}})
        item = {k: p[k] for k in ("id", "nome", "categoria", "data", "series", "tri", "inscritos")}
        item.update({"participantes": len(al), "participacao": round(len(al) / p["inscritos"], 4) if p["inscritos"] else None,
                     "media": round(media_esc, 1), "dp": round(dp, 1), "ranking": ranking_escola, "escolas_rede": 412,
                     "alunos_rede": p["rede"]["alunos"], "areas": esc_area, "rede": rede, "por_turma": por_turma,
                     "alunos": [{k: v for k, v in a.items() if k not in ("nome", "serie")} for a in al]})
        if p["tri"]:
            item["redacao"] = {c: round(st.mean(a["redacao"][c] for a in al), 1) for c in ("C1", "C2", "C3", "C4", "C5", "total")}
        saida.append(item)
    return saida
