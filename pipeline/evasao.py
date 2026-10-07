"""
Radar de evasão: modelo de machine learning (scikit-learn) que estima a chance de cada aluno
ativo sair da escola, treinado no histórico de 2022 a 2025.

- Alvo: evadiu (no meio do ano ou não renovou) x continuou. Quem se formou fica de fora.
- Validação temporal: treina em 2022-2024 e mede em 2025, um ano que o modelo nunca viu.
- Compara regressão logística, random forest, gradient boosting e a regra por pontos do painel original.
- O modelo final (refeito com 2022-2025) pontua os alunos de 2026 e explica cada risco
  pelas variáveis que mais pesaram pra aquele aluno.
"""
import math
import statistics as st
from collections import Counter

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score, roc_curve
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

VARS = ["nota_media", "pct_notas_baixas", "pct_faltas", "ocorrencias", "fin_atrasados", "fin_dias_max",
        "fin_dias_medio", "bolsa_pct", "anos_escola", "serie_idx", "sem_nota"]
NOMES_VARS = {"nota_media": "Média das notas", "pct_notas_baixas": "Notas abaixo de 6", "pct_faltas": "Faltas",
              "ocorrencias": "Ocorrências", "fin_atrasados": "Mensalidades em atraso", "fin_dias_max": "Maior atraso (dias)",
              "fin_dias_medio": "Atraso médio (dias)", "bolsa_pct": "Bolsa/desconto", "anos_escola": "Anos na escola",
              "serie_idx": "Série", "sem_nota": "Sem nota (EI/1º ano)"}
DESC_VARS = {"nota_media": "média de todas as notas lançadas no ano (0 a 10)",
             "pct_notas_baixas": "fração das notas abaixo de 6",
             "pct_faltas": "dias de falta sobre dias letivos (catraca)",
             "ocorrencias": "ocorrências disciplinares registradas no ano",
             "fin_atrasados": "mensalidades pagas com atraso ou em aberto",
             "fin_dias_max": "maior atraso de mensalidade, em dias",
             "fin_dias_medio": "atraso médio das mensalidades atrasadas, em dias",
             "bolsa_pct": "desconto ou bolsa na mensalidade",
             "anos_escola": "há quantos anos o aluno estuda na escola",
             "serie_idx": "série (0 = Baby ... 15 = 3ª série do médio)",
             "sem_nota": "Educação Infantil e 1º ano, avaliados por parecer (sem nota)"}
ALTO, MEDIO = 0.30, 0.15   # faixas: 2x e 1x a taxa média histórica de evasão (~15%)
SEMENTE = 42


def score_regra(x):
    """Regra por pontos do painel original (0 a 8), usada como linha de base."""
    s = 0
    s += 2 if x["fin_atrasados"] >= 4 else 1 if x["fin_atrasados"] >= 2 else 0
    s += 2 if x["fin_dias_max"] >= 90 else 1 if x["fin_dias_max"] >= 30 else 0
    nota = x["nota_media"]
    s += 0 if nota is None else 2 if nota < 5 else 1 if nota < 6 else 0
    s += 2 if x["pct_faltas"] > 0.25 else 1 if x["pct_faltas"] > 0.15 else 0
    return s


def matriz(regs, medianas):
    X = []
    for x in regs:
        sem = x["nota_media"] is None
        X.append([medianas["nota_media"] if sem else x["nota_media"],
                  medianas["pct_notas_baixas"] if sem else x["pct_notas_baixas"],
                  x["pct_faltas"], x["ocorrencias"], x["fin_atrasados"], x["fin_dias_max"], x["fin_dias_medio"],
                  x["bolsa_pct"], x["anos_escola"], x["serie_idx"], 1.0 if sem else 0.0])
    return np.array(X, dtype=float)


def metricas(y, p):
    ordem = np.argsort(-p)
    k = max(1, int(round(len(p) * 0.10)))
    capt = y[ordem[:k]].sum() / max(1, y.sum())
    fpr, tpr, _ = roc_curve(y, p)
    passo = max(1, len(fpr) // 40)
    return {"auc": round(float(roc_auc_score(y, p)), 3), "ap": round(float(average_precision_score(y, p)), 3),
            "captura_top10": round(float(capt), 3), "lift_top10": round(float(capt / 0.10), 2),
            "roc": [[round(float(a), 3), round(float(b), 3)] for a, b in list(zip(fpr, tpr))[::passo] + [(1.0, 1.0)]]}


def calibracao(y, p, faixas=8):
    ordem = np.argsort(p)
    saida = []
    for parte in np.array_split(ordem, faixas):
        if len(parte):
            saida.append([round(float(p[parte].mean()), 3), round(float(y[parte].mean()), 3), int(len(parte))])
    return saida


def motivos(x):
    """Texto curto pros sinais que puxam o risco de um aluno (mostrado como chips na tela)."""
    m = []
    if x["fin_atrasados"] >= 2:
        m.append(f"{x['fin_atrasados']} mensalidades em atraso")
    if x["fin_dias_max"] >= 30:
        m.append(f"atraso de até {x['fin_dias_max']} dias")
    if x["pct_faltas"] > 0.10:
        m.append(f"faltas {x['pct_faltas'] * 100:.0f}%".replace(".", ","))
    if x["nota_media"] is not None and x["nota_media"] < 6.5:
        m.append(f"média {x['nota_media']:.1f}".replace(".", ","))
    if x["pct_notas_baixas"] and x["pct_notas_baixas"] >= 0.25:
        m.append(f"{x['pct_notas_baixas'] * 100:.0f}% das notas abaixo de 6")
    if x["ocorrencias"] >= 3:
        m.append(f"{x['ocorrencias']} ocorrências")
    return m


def agregar_evasao(ped, coord, alunos, cfg):
    hist = [dict(x, serie_idx=cfg.ordem_serie(x["serie"])) for x in ped["evasao_hist"] if x["desfecho"] != "formou"]
    medianas = {"nota_media": st.median(x["nota_media"] for x in hist if x["nota_media"] is not None),
                "pct_notas_baixas": st.median(x["pct_notas_baixas"] for x in hist if x["pct_notas_baixas"] is not None)}
    y_all = np.array([1 if x["desfecho"].startswith("evadiu") else 0 for x in hist])
    anos = np.array([x["ano"] for x in hist])
    X_all = matriz(hist, medianas)
    treino, teste = anos <= 2024, anos == 2025

    modelos = {
        "Regressão logística": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
        "Random forest": RandomForestClassifier(n_estimators=400, max_depth=7, min_samples_leaf=8, max_features="sqrt",
                                                random_state=SEMENTE, n_jobs=-1),
        "Gradient boosting": GradientBoostingClassifier(n_estimators=160, max_depth=2, learning_rate=0.05,
                                                        subsample=0.8, random_state=SEMENTE),
    }
    resultados = {}
    for nome, m in modelos.items():
        m.fit(X_all[treino], y_all[treino])
        p = m.predict_proba(X_all[teste])[:, 1]
        resultados[nome] = {"metricas": metricas(y_all[teste], p), "calibracao": calibracao(y_all[teste], p)}
    regra = np.array([score_regra(x) for x, t in zip(hist, teste) if t], dtype=float)
    resultados["Regra por pontos (0-8)"] = {"metricas": metricas(y_all[teste], regra + np.random.RandomState(0).rand(len(regra)) * 1e-3)}

    # escolhe o melhor no ano de validação; em empate técnico fica a logística, que explica cada variável
    auc = {k: v["metricas"]["auc"] for k, v in resultados.items() if k in modelos}
    escolhido = max(auc, key=auc.get)
    if escolhido != "Regressão logística" and auc[escolhido] - auc["Regressão logística"] < 0.01:
        escolhido = "Regressão logística"

    # importância: queda de AUC ao embaralhar cada variável no ano de validação
    imp = permutation_importance(modelos[escolhido], X_all[teste], y_all[teste], scoring="roc_auc",
                                 n_repeats=20, random_state=SEMENTE)
    importancia = sorted([[NOMES_VARS[v], round(float(m), 4)] for v, m in zip(VARS, imp.importances_mean)], key=lambda x: -x[1])
    lr = modelos["Regressão logística"][-1]
    coef = sorted([[NOMES_VARS[v], round(float(c), 3)] for v, c in zip(VARS, lr.coef_[0])], key=lambda x: -abs(x[1]))
    # importância "de impureza" da random forest (quanto cada variável ajuda a separar os grupos nas árvores)
    imp_rf = sorted([[NOMES_VARS[v], round(float(m), 4)] for v, m in zip(VARS, modelos["Random forest"].feature_importances_)],
                    key=lambda x: -x[1])

    # modelo final: refeito com todo o histórico, pontua os alunos ativos de 2026
    final = modelos[escolhido]
    final.fit(X_all, y_all)
    taxa_base = float(y_all.mean())
    # a explicação por aluno usa a logística refeita com tudo: contribuição = coeficiente x valor padronizado
    explicador = modelos["Regressão logística"] if escolhido == "Regressão logística" else         make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)).fit(X_all, y_all)
    esc, lr_f = explicador[0], explicador[-1]

    ped_por_id = {p["id"]: p for p in ped["alunos"]}
    alunos_coord = {r[0]: dict(zip(coord["alunos"]["campos"], r)) for r in coord["alunos"]["linhas"]}
    dic = coord["alunos"]["dic"]
    entrada = {a["id"]: a["entrada"] for a in alunos}
    desconto = {a["id"]: a["desconto"] for a in alunos}
    decisao = {a["id"]: a.get("decisao_prox") for a in alunos}
    atuais = []
    for aid, c in alunos_coord.items():
        p = ped_por_id[aid]
        serie = dic["serie"][c["serie"]]
        notas = [t[0] for d in p["notas"].values() for t in d]
        x = {"id": aid, "nota_media": round(st.mean(notas), 2) if notas else None,
             "pct_notas_baixas": round(sum(n < 6 for n in notas) / len(notas), 3) if notas else None,
             "pct_faltas": round(1 - c["freq"], 3) if c["freq"] is not None else 0.0, "ocorrencias": c["n_oc"],
             "bolsa_pct": desconto[aid], "anos_escola": cfg.ano - entrada[aid], "serie_idx": cfg.ordem_serie(serie), **p["fin"]}
        atuais.append((x, c))
    X_at = matriz([x for x, _ in atuais], medianas)
    prob = final.predict_proba(X_at)[:, 1]

    contrib = (X_at - esc.mean_) / esc.scale_ * lr_f.coef_[0]
    lista = []
    for (x, c), pr, ct, xv in zip(atuais, prob, contrib, X_at):
        faixa = "alto" if pr >= ALTO else "medio" if pr >= MEDIO else "baixo"
        top = sorted(range(len(VARS)), key=lambda j: -abs(ct[j]))[:5]
        lista.append({"id": x["id"], "prob": round(float(pr), 4), "faixa": faixa,
                      "porque": [[VARS[j], round(float(xv[j]), 3), round(float(ct[j]), 3)] for j in top],
                      "regra": score_regra(x), "nota": x["nota_media"], "faltas": x["pct_faltas"],
                      "atrasos": x["fin_atrasados"], "dias": x["fin_dias_max"], "oc": x["ocorrencias"],
                      "bolsa": x["bolsa_pct"], "motivos": motivos(x), "rematricula": decisao.get(x["id"])})
    lista.sort(key=lambda a: -a["prob"])

    # checagem no ciclo atual: quem o modelo aponta já está atrasando a rematrícula?
    def sinalizou(g):
        return round(sum(a["rematricula"] in ("pendente", "nao_renova") for a in g) / len(g), 3) if g else None
    nao_formando = [a for a in lista if a["rematricula"] != "formando"]
    checagem = {f: {"n": len(g), "sem_rematricula": sinalizou(g)}
                for f, g in (("alto", [a for a in nao_formando if a["faixa"] == "alto"]),
                             ("medio", [a for a in nao_formando if a["faixa"] == "medio"]),
                             ("baixo", [a for a in nao_formando if a["faixa"] == "baixo"]),
                             ("todos", nao_formando))}

    return {
        "modelo": escolhido, "taxa_base": round(taxa_base, 4), "faixas": {"alto": ALTO, "medio": MEDIO},
        "treino": {"anos": "2022-2024", "n": int(treino.sum()), "evadiram": int(y_all[treino].sum())},
        "validacao": {"ano": 2025, "n": int(teste.sum()), "evadiram": int(y_all[teste].sum())},
        "resultados": resultados, "importancia": importancia, "coeficientes": coef, "importancia_rf": imp_rf,
        "intercepto": round(float(lr_f.intercept_[0]), 3),
        "variaveis": [{"k": v, "nome": NOMES_VARS[v], "desc": DESC_VARS[v],
                       "evadiu": media_grupo(hist, v, True), "continuou": media_grupo(hist, v, False)} for v in VARS if v != "sem_nota"],
        "por_ano": {str(a): {"n": int((anos == a).sum()), "evadiram": int(y_all[anos == a].sum())} for a in sorted(set(anos.tolist()))},
        "historico": historico(ped["evasao_hist"]),
        "sinais": sinais(hist),
        "atuais": lista, "checagem": checagem,
    }


def media_grupo(hist, var, evadiu):
    if var == "serie_idx":
        return None
    vals = [x[var] for x in hist if x[var] is not None and x["desfecho"].startswith("evadiu") == evadiu]
    return round(st.mean(vals), 3) if vals else None


def historico(regs):
    por_ano = {}
    for x in regs:
        por_ano.setdefault(x["ano"], Counter())[x["desfecho"]] += 1
    # motivos declarados só existem pra quem saiu no meio do ano (quem não renovou raramente justifica)
    motivos_c = Counter(x["motivo"] for x in regs if x.get("motivo") and x["desfecho"] == "evadiu_meio")
    meses = Counter(x["mes_saida"] for x in regs if x.get("mes_saida"))
    return {"por_ano": {str(a): dict(c) for a, c in sorted(por_ano.items())}, "motivos": motivos_c.most_common(),
            "mes_saida": [meses.get(m, 0) for m in range(1, 13)]}


def sinais(hist):
    """Sinais binários: % dos que evadiram x % dos que continuaram (lift em pontos percentuais)."""
    evad = [x for x in hist if x["desfecho"].startswith("evadiu")]
    cont = [x for x in hist if x["desfecho"] == "continuou"]
    regras = [
        ("2+ mensalidades em atraso", lambda x: x["fin_atrasados"] >= 2),
        ("Atraso acima de 30 dias", lambda x: x["fin_dias_max"] > 30),
        ("Média abaixo de 6", lambda x: x["nota_media"] is not None and x["nota_media"] < 6),
        ("25%+ das notas abaixo de 6", lambda x: (x["pct_notas_baixas"] or 0) >= 0.25),
        ("Faltas acima de 10%", lambda x: x["pct_faltas"] > 0.10),
        ("Faltas acima de 15%", lambda x: x["pct_faltas"] > 0.15),
        ("3+ ocorrências", lambda x: x["ocorrencias"] >= 3),
        ("Bolsa de 20% ou mais", lambda x: x["bolsa_pct"] >= 0.20),
        ("Até 1 ano na escola", lambda x: x["anos_escola"] <= 1),
    ]
    out = []
    for nome, f in regras:
        pe = sum(map(f, evad)) / len(evad)
        pc = sum(map(f, cont)) / len(cont)
        base = [x for x in hist if f(x)]
        taxa = sum(x["desfecho"].startswith("evadiu") for x in base) / len(base) if base else 0
        out.append({"sinal": nome, "evadiram": round(pe, 3), "continuaram": round(pc, 3), "lift_pp": round((pe - pc) * 100, 1),
                    "n": len(base), "taxa_evasao": round(taxa, 3)})
    return sorted(out, key=lambda s: -s["lift_pp"])
