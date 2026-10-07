"""
Parte pedagógica da base: notas por trimestre, frequência diária, ocorrências, pareceres,
clubes, corpo docente, simulados externos e o histórico usado pelo radar de evasão.

Usa um gerador aleatório próprio (seed derivada) pra não mexer em nenhum número das outras
partes da base. Cada aluno tem um "risco" interno que piora um pouco nota, frequência,
ocorrências e atraso de mensalidade; ele NÃO vai pro painel. O modelo de evasão precisa
achar esse sinal sozinho, só pelos indicadores.

Não existe nenhum dado de saúde/laudo aqui, nem inventado.
"""
import math
import random
from datetime import date, timedelta

from .comum import ANO, DATA_REF, PRIMEIROS, SEED, SEGMENTO_DA_SERIE, SOBRENOMES

r = random.Random(SEED + 11)

DISCIPLINAS = {
    "Fundamental I": ["Língua Portuguesa", "Matemática", "Ciências", "História", "Geografia", "Inglês", "Arte", "Educação Física"],
    "Fundamental II": ["Língua Portuguesa", "Redação", "Matemática", "Ciências", "História", "Geografia", "Inglês", "Arte", "Educação Física"],
    "Ensino Médio": ["Língua Portuguesa", "Literatura", "Redação", "Matemática", "Física", "Química", "Biologia",
                     "História", "Geografia", "Filosofia", "Sociologia", "Inglês", "Educação Física"],
}
# dificuldade relativa (somada à nota esperada do aluno)
EFEITO_DISC = {"Matemática": -0.55, "Física": -0.7, "Química": -0.5, "Redação": -0.25, "Língua Portuguesa": -0.15,
               "Biologia": -0.2, "Literatura": 0.0, "Ciências": 0.05, "História": 0.1, "Geografia": 0.15, "Inglês": 0.2,
               "Filosofia": 0.25, "Sociologia": 0.3, "Arte": 0.7, "Educação Física": 0.9}
AULAS_DIA = {"Fundamental I": 5, "Fundamental II": 6, "Ensino Médio": 7}
SERIES_PARECER = {"Baby", "Maternal", "Jardim I", "Jardim II", "1º ano"}   # avaliação descritiva, sem nota

TRIMESTRES = [
    {"num": 1, "ini": date(ANO, 2, 2), "fim": date(ANO, 5, 8)},
    {"num": 2, "ini": date(ANO, 5, 11), "fim": date(ANO, 8, 21)},
    {"num": 3, "ini": date(ANO, 8, 24), "fim": date(ANO, 12, 11)},
]
FERIADOS = {date(ANO, 2, 16), date(ANO, 2, 17), date(ANO, 4, 3), date(ANO, 4, 21), date(ANO, 5, 1), date(ANO, 6, 4),
            date(ANO, 9, 7), date(ANO, 10, 12)} | {date(ANO, 7, 13) + timedelta(days=i) for i in range(12)}

PROF_NOMES = ["Adriana", "Beatriz", "Carla", "Daniela", "Eliane", "Fernanda", "Gustavo", "Helena", "Igor", "Kátia", "Leonardo", "Márcia", "Natália", "Otávio", "Paula", "Renata", "Sérgio", "Tatiana", "Vinícius",
              "Wesley", "Aline", "Cristina", "Denise", "Eduardo", "Flávia", "Gabriela", "Henrique", "Isadora",
              "Joana", "Luciana", "Marcelo", "Patrícia", "Ricardo", "Sabrina", "Thiago", "Vanessa", "Rodrigo", "Simone",
              "Larissa", "Fábio", "Priscila", "André", "Mirela", "Caio", "Roberta", "Diogo"]

OCORRENCIAS = {
    # tipo: (peso base, peso extra por risco, impedimento?, observações possíveis)
    "Atraso": (3.0, 1.0, 0.25, ["Chegou após o sinal da primeira aula.", "Entrada após o início da aula, sem justificativa.",
                                "Terceiro atraso no mês; responsável comunicado."]),
    "Sem material": (2.2, 0.8, 0, ["Veio sem o material da disciplina.", "Esqueceu o livro e o caderno.",
                                   "Sem material pela segunda vez na semana."]),
    "Sem uniforme": (1.2, 0.4, 0, ["Compareceu sem o uniforme completo.", "Sem a camiseta do uniforme."]),
    "Tarefa não realizada": (2.6, 1.4, 0, ["Não entregou a tarefa de casa.", "Atividade avaliativa não entregue no prazo.",
                                           "Tarefa incompleta, segunda vez no trimestre."]),
    "Uso de celular": (1.4, 1.2, 0, ["Usou o celular durante a explicação.", "Celular recolhido e devolvido ao final da aula."]),
    "Conversa excessiva": (1.8, 1.0, 0, ["Conversas paralelas atrapalhando a turma.", "Orientado várias vezes a retomar a atividade."]),
    "Desrespeito": (0.25, 0.9, 0.3, ["Falta de respeito com colega em sala.", "Resposta desrespeitosa ao professor."]),
    "Saída sem autorização": (0.2, 0.6, 0.5, ["Saiu da sala sem autorização.", "Encontrado fora da sala no horário de aula."]),
    "Elogio": (1.3, -0.5, 0, ["Ajudou colegas com dificuldade na atividade.", "Excelente participação no projeto.",
                              "Destaque na apresentação do trabalho."]),
}

CLUBES = {
    "Educação Infantil": ["Ballet", "Judô", "Musicalização"],
    "Fundamental I": ["Robótica", "Xadrez", "Futsal", "Ballet", "Judô", "Teatro", "Coral"],
    "Fundamental II": ["Robótica", "Xadrez", "Futsal", "Vôlei", "Teatro", "Coral", "Iniciação científica"],
    "Ensino Médio": ["Robótica", "Vôlei", "Futsal", "Teatro", "Iniciação científica", "Debate", "Olimpíadas"],
}

# pareceres descritivos: fragmentos por área e nível (0 = precisa de apoio, 1 = em desenvolvimento, 2 = consolidado)
AREAS_PARECER = {
    "ei": ["Linguagem oral e escrita", "Matemática", "Natureza e sociedade", "Movimento", "Artes e música", "Identidade e autonomia"],
    "f1": ["Língua Portuguesa", "Matemática", "Ciências", "Convivência"],
}
FRAG = {
    "Linguagem oral e escrita": [
        ["Ainda se comunica mais por gestos do que pela fala e precisa de incentivo para participar das rodas de conversa.",
         "Reconhece poucas letras do próprio nome; seguiremos com atividades de identificação."],
        ["Participa das rodas de conversa e já relata acontecimentos simples na sequência.",
         "Reconhece as letras do próprio nome e de alguns colegas."],
        ["Expressa ideias com clareza, amplia o vocabulário e reconta histórias com riqueza de detalhes.",
         "Escreve o próprio nome e arrisca hipóteses de escrita com segurança."]],
    "Matemática": [
        ["Está iniciando a contagem e precisa de apoio concreto para relacionar número e quantidade.",
         "Ainda confunde a sequência numérica além do cinco."],
        ["Conta objetos até dez e compara quantidades com apoio de materiais.",
         "Começa a resolver pequenas situações-problema oralmente."],
        ["Relaciona número e quantidade com autonomia e resolve situações-problema com estratégias próprias.",
         "Demonstra raciocínio lógico nas brincadeiras de classificação e seriação."]],
    "Natureza e sociedade": [
        ["Mostra pouco interesse nas investigações propostas; buscaremos temas do seu cotidiano."],
        ["Participa das investigações sobre plantas e animais e faz boas perguntas."],
        ["Demonstra curiosidade científica, levanta hipóteses e registra descobertas com entusiasmo."]],
    "Movimento": [
        ["Ainda demonstra insegurança em atividades de equilíbrio e coordenação."],
        ["Participa das atividades corporais e vem ganhando segurança nos circuitos."],
        ["Tem ótima coordenação motora ampla e fina e participa de todas as propostas com alegria."]],
    "Artes e música": [
        ["Precisa de estímulo para explorar materiais e se expressar nas produções artísticas."],
        ["Explora tintas, massinha e instrumentos e já cria produções com intenção."],
        ["Cria produções originais, canta e acompanha ritmos com muita expressividade."]],
    "Identidade e autonomia": [
        ["Ainda depende bastante do adulto nas rotinas de higiene e alimentação; seguimos acolhendo."],
        ["Vem conquistando autonomia nas rotinas e já resolve pequenos conflitos com mediação."],
        ["É autônomo nas rotinas, cuida dos seus pertences e ajuda os colegas."]],
    "Língua Portuguesa": [
        ["Encontra-se na fase pré-silábica; o trabalho com consciência fonológica será intensificado.",
         "Precisa de apoio na leitura de palavras simples."],
        ["Está na fase silábico-alfabética e lê pequenas frases com apoio.",
         "Produz textos curtos com ajuda do professor."],
        ["Está alfabético, lê com fluência textos curtos e produz pequenas histórias com coerência.",
         "Demonstra prazer pela leitura e participa ativamente das rodas literárias."]],
    "Ciências": [
        ["Participa pouco dos experimentos; vamos incentivar o registro das observações."],
        ["Participa dos experimentos e registra as observações com desenhos."],
        ["Formula hipóteses, observa com atenção e explica os resultados com suas palavras."]],
    "Convivência": [
        ["Está aprendendo a esperar a vez e a lidar com frustrações; seguimos com a mediação dos conflitos."],
        ["Relaciona-se bem com a turma e vem respeitando os combinados da sala."],
        ["É gentil, cooperativo e uma referência positiva para os colegas."]],
}
FECHAMENTO = ["Seguimos acompanhando de perto o desenvolvimento ao longo do próximo trimestre.",
              "Contamos com a parceria da família para dar continuidade a essas conquistas.",
              "Parabéns pelas conquistas deste trimestre!"]

SIMULADOS = [
    # nome, categoria, data, séries, tem TRI/redação?
    ("Avaliação Nacional 1", "Avaliação Nacional", date(ANO, 4, 15), ["9º ano", "1ª série"], False),
    ("Simulado ENEM 1", "Simulado ENEM", date(ANO, 4, 25), ["2ª série", "3ª série"], True),
    ("Simulado da Rede 1", "Simulado da Rede", date(ANO, 5, 6), ["9º ano", "1ª série"], False),
    ("Simulado ENEM 2", "Simulado ENEM", date(ANO, 6, 20), ["2ª série", "3ª série"], True),
    ("Avaliação Nacional 2", "Avaliação Nacional", date(ANO, 8, 19), ["9º ano", "1ª série"], False),
    ("Simulado ENEM 3", "Simulado ENEM", date(ANO, 9, 19), ["2ª série", "3ª série"], True),
    ("Simulado da Rede 2", "Simulado da Rede", date(ANO, 9, 30), ["9º ano", "1ª série"], False),
]
AREAS = ["linguagens", "matematica", "ciencias_humanas", "ciencias_natureza"]
EFEITO_AREA = {"linguagens": 15, "matematica": -10, "ciencias_humanas": 10, "ciencias_natureza": -18}
ALUNOS_REDE = 18400   # tamanho da rede fictícia de escolas que fazem as mesmas provas


def clip(v, lo, hi):
    return max(lo, min(hi, v))


def iso(d):
    return d.isoformat() if d else None


def dias_letivos():
    d, out = TRIMESTRES[0]["ini"], []
    while d <= DATA_REF:
        if d.weekday() < 5 and d not in FERIADOS:
            out.append(d)
        d += timedelta(days=1)
    return out


def trimestre_de(d):
    return next(t["num"] for t in TRIMESTRES if t["ini"] <= d <= t["fim"])


def nome_prof(usados):
    while True:
        n = f"{r.choice(PROF_NOMES)} {r.choice(SOBRENOMES)}"
        if n not in usados:
            usados.add(n)
            return n


def gerar_docentes():
    usados, docs = set(), []
    def novo(seg, funcao, graduacao):
        doc = {"id": len(docs) + 1, "nome": nome_prof(usados), "segmentos": seg, "funcao": funcao, "graduacao": graduacao,
               "pos_graduacao": None, "especializacao": None, "mestrado": None, "doutorado": None, "outros": None}
        if r.random() < 0.55:
            doc["pos_graduacao"] = r.choice(["Psicopedagogia", "Neuroeducação", "Gestão escolar", "Educação inclusiva",
                                             "Metodologias ativas", "Alfabetização e letramento"])
        if r.random() < 0.3:
            doc["especializacao"] = r.choice(["Ensino de Ciências", "Tecnologias na educação", "Educação bilíngue",
                                              "Avaliação da aprendizagem", "Literatura infantil"])
        if r.random() < 0.18:
            doc["mestrado"] = r.choice(["Educação", "Ensino de Matemática", "Letras", "Ensino de Ciências", "História"])
            if r.random() < 0.28:
                doc["doutorado"] = r.choice(["Educação", "Linguística", "Física", "História"])
        if r.random() < 0.3:
            doc["outros"] = r.choice(["Curso de BNCC na prática", "Formação em Cultura Maker", "Certificação Cambridge (inglês)",
                                      "Curso de mediação de conflitos"])
        docs.append(doc)
        return doc

    for _ in range(9):
        novo(["Educação Infantil"], "Professor(a) titular", "Pedagogia")
    for _ in range(11):
        novo(["Fundamental I"], "Professor(a) titular", "Pedagogia")
    especialistas = {"Inglês": "Letras - Inglês", "Arte": "Artes Visuais", "Educação Física": "Educação Física"}
    for disc, grad in especialistas.items():
        for _ in range(2):
            novo(["Fundamental I", "Fundamental II"], f"Professor(a) de {disc}", grad)
    por_area = {"Língua Portuguesa": "Letras", "Redação": "Letras", "Literatura": "Letras", "Matemática": "Matemática",
                "Física": "Física", "Química": "Química", "Biologia": "Ciências Biológicas", "Ciências": "Ciências Biológicas",
                "História": "História", "Geografia": "Geografia", "Filosofia": "Filosofia", "Sociologia": "Ciências Sociais"}
    for disc, grad in por_area.items():
        n = 2 if disc in ("Língua Portuguesa", "Matemática") else 1
        for _ in range(n):
            seg = ["Fundamental II", "Ensino Médio"] if disc not in ("Física", "Química", "Literatura", "Filosofia", "Sociologia", "Ciências") \
                else (["Fundamental II"] if disc == "Ciências" else ["Ensino Médio"])
            novo(seg, f"Professor(a) de {disc}", grad)
    for _ in range(2):
        novo(["Ensino Médio"], "Professor(a) de Inglês", "Letras - Inglês")
    novo(["Ensino Médio"], "Professor(a) de Educação Física", "Educação Física")
    novo(["Fundamental I", "Fundamental II", "Ensino Médio"], "Coordenação pedagógica", "Pedagogia")
    novo(["Educação Infantil", "Fundamental I"], "Coordenação pedagógica", "Pedagogia")
    return docs


def professor_de(docs, segmento, disciplina, turma, cache):
    chave = (turma, disciplina)
    if chave in cache:
        return cache[chave]
    if segmento in ("Educação Infantil", "Fundamental I") and disciplina not in ("Inglês", "Arte", "Educação Física"):
        cand = [d for d in docs if segmento in d["segmentos"] and d["funcao"] == "Professor(a) titular"]
    else:
        cand = [d for d in docs if segmento in d["segmentos"] and d["funcao"].endswith(disciplina)] or \
               [d for d in docs if segmento in d["segmentos"] and d["funcao"].startswith("Professor")]
    cache[chave] = r.choice(cand)["id"]
    return cache[chave]


def risco_latente(a, ano):
    """Risco interno (não exportado). Histórico: depende de como o ano terminou; 2026: da decisão pra 2027."""
    reg = a["anos"][str(ano)]
    if ano < ANO:
        prox = a["anos"].get(str(ano + 1))
        saiu = reg["status"] in ("evadido", "transferido") or (reg["serie"] != "3ª série" and not prox)
        if saiu:
            # parte das saídas não tem sinal nenhum (mudança de cidade etc.): fica com risco baixo
            return r.gauss(0.15, 0.55) if r.random() < 0.3 else r.gauss(1.25, 0.6)
        return r.gauss(0.0, 0.55)
    dec = a.get("decisao_prox")
    return r.gauss({"nao_renova": 1.15, "pendente": 0.55}.get(dec, 0.0), 0.55)


def presenca_esperada(risco):
    """Chance de vir à aula num dia comum. Uns 3% são faltosos crônicos."""
    p = 0.952 - 0.065 * risco + r.gauss(0, 0.042)
    if r.random() < 0.03:
        p -= r.uniform(0.12, 0.28)
    return clip(p, 0.5, 0.995)


def financeiro_sinais(risco):
    atrasos = min(8, poisson(0.22 + 1.5 * max(risco, 0)))
    if not atrasos:
        return {"fin_atrasados": 0, "fin_dias_max": 0, "fin_dias_medio": 0}
    dias = sorted(max(1, int(r.gammavariate(2, 7 + 16 * max(risco, 0)))) for _ in range(atrasos))
    return {"fin_atrasados": atrasos, "fin_dias_max": dias[-1], "fin_dias_medio": round(sum(dias) / len(dias))}


FATOR_OCORR = {"Educação Infantil": 0.15, "Fundamental I": 0.7, "Fundamental II": 1.25, "Ensino Médio": 1.1}


def n_ocorrencias(risco, seg, fracao_ano):
    n = poisson((0.55 + 2.1 * max(risco, 0)) * FATOR_OCORR[seg] * fracao_ano)
    return n + (poisson(0.35 * FATOR_OCORR[seg]) if risco < 0.3 else 0)   # elogios e ocorrências leves acontecem com todo mundo


def poisson(lam):
    l, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= r.random()
        if p <= l:
            return k
        k += 1


def gerar_pedagogico(alunos):
    letivos = dias_letivos()
    idx_dia = {d: i for i, d in enumerate(letivos)}
    tri_atual = trimestre_de(DATA_REF)
    docs = gerar_docentes()
    cache_prof = {}

    ativos = [a for a in alunos if str(ANO) in a["anos"] and a["anos"][str(ANO)]["status"] == "cursando"]
    efeito_turma, efeito_dia = {}, [r.gauss(0, 0.018) - (0.012 if d.weekday() in (0, 4) else 0) for d in letivos]

    saida_alunos, risco_2026, habil_2026 = [], {}, {}
    for a in ativos:
        reg = a["anos"][str(ANO)]
        serie, turma, seg = reg["serie"], reg["turma"], SEGMENTO_DA_SERIE[reg["serie"]]
        risco = risco_latente(a, ANO)
        risco_2026[a["id"]] = risco
        habil = min(9.4, r.gauss(7.7, 0.95) - 0.75 * risco + {"Fundamental I": 0.35, "Ensino Médio": -0.2}.get(seg, 0))
        habil_2026[a["id"]] = habil
        et = efeito_turma.setdefault(turma, r.gauss(0, 0.22))
        out = {"id": a["id"], "notas": {}, "faltas": [], "ocorrencias": [], "pareceres": [], "clubes": []}

        # notas (não há nota na Educação Infantil nem no 1º ano: avaliação descritiva)
        if seg in DISCIPLINAS and serie not in SERIES_PARECER:
            tendencia = r.gauss(0, 0.3)
            for disc in DISCIPLINAS[seg]:
                tris = []
                for t in TRIMESTRES:
                    if t["num"] > tri_atual:
                        break
                    if t["num"] == tri_atual and r.random() > 0.55:   # 3º tri em andamento: só parte lançada
                        break
                    nota = round(clip(habil + EFEITO_DISC.get(disc, 0) + et + tendencia * (t["num"] - 2) + r.gauss(0, 0.7), 0, 10), 1)
                    rec = fech = None
                    if t["num"] < tri_atual:   # trimestre fechado
                        if nota < 7 and r.random() < 0.9:
                            rec = round(clip(nota + abs(r.gauss(1.3, 1.1)), 0, 10), 1)
                        fech = round(max(nota, min(rec, 7.0)) if rec is not None else nota, 1)
                    tris.append([nota, rec, fech])
                out["notas"][disc] = tris

        # frequência diária (catraca): guarda só os dias em que faltou
        ini = max(letivos[0], date.fromisoformat(reg["data_matricula"]))
        p = presenca_esperada(risco)
        out["faltas"] = [idx_dia[d] for d in letivos if d >= ini and r.random() > p + efeito_dia[idx_dia[d]]]
        out["inicio"] = idx_dia.get(next((d for d in letivos if d >= ini), letivos[-1]), 0)
        # faltas avulsas de aula (atraso na 1ª aula, saída antecipada, consulta): a frequência oficial é por aula
        frac = (len(letivos) - out["inicio"]) / len(letivos)
        out["faltas_parciais"] = poisson((4 + 10 * max(risco, 0)) * frac * r.uniform(0.3, 2.2))

        # ocorrências
        for _ in range(n_ocorrencias(risco, seg, 0.8)):   # fevereiro a meados de outubro ~ 80% do ano
            pesos = {k: max(0.05, v[0] + v[1] * risco) for k, v in OCORRENCIAS.items()}
            tipo = r.choices(list(pesos), weights=list(pesos.values()))[0]
            base, _, p_imp, obs = OCORRENCIAS[tipo]
            d = r.choice(letivos[out["inicio"]:] or letivos)
            prof_seg = [x for x in docs if seg in x["segmentos"]] or docs
            anexo = None
            if tipo in ("Desrespeito", "Saída sem autorização", "Elogio") and r.random() < 0.3:
                anexo = r.choice(["imagem", "pdf"])
            out["ocorrencias"].append({"data": iso(d), "tipo": tipo, "obs": r.choice(obs), "imped": r.random() < p_imp,
                                       "por": r.choice(prof_seg)["id"], "visivel": tipo != "Elogio" or r.random() < 0.8,
                                       "anexo": anexo})
        out["ocorrencias"].sort(key=lambda o: o["data"], reverse=True)

        # pareceres descritivos (EI e 1º ano), só dos trimestres fechados; texto montado por fragmentos
        if serie in SERIES_PARECER:
            areas = AREAS_PARECER["ei" if seg == "Educação Infantil" else "f1"]
            nivel_base = clip((habil - 5.6) / 1.4, 0, 2)
            for t in TRIMESTRES:
                if t["num"] >= tri_atual:
                    break
                for area in areas:
                    nivel = int(round(clip(nivel_base + r.gauss(0, 0.6) + 0.15 * (t["num"] - 1), 0, 2)))
                    frases = FRAG[area][nivel]
                    escolha = r.sample(range(len(frases)), k=min(len(frases), 1 + (r.random() < 0.5)))
                    disc_prof = area if area in ("Matemática", "Língua Portuguesa", "Ciências") else "Pedagogia"
                    out["pareceres"].append({"tri": t["num"], "area": area, "nivel": nivel, "frases": escolha,
                                             "fechamento": r.randrange(len(FECHAMENTO)),
                                             "prof": professor_de(docs, seg, disc_prof, turma, cache_prof),
                                             "confirmado": t["num"] < tri_atual - 1 or r.random() < 0.93})

        # clubes
        if r.random() < (0.12 if seg == "Educação Infantil" else 0.3):
            out["clubes"] = r.sample(CLUBES[seg], k=1 + (r.random() < 0.25))

        out["fin"] = financeiro_sinais(risco)
        saida_alunos.append(out)

    return {
        "disciplinas": DISCIPLINAS,
        "aulas_dia": AULAS_DIA,
        "series_parecer": sorted(SERIES_PARECER),
        "trimestres": [{"num": t["num"], "ini": iso(t["ini"]), "fim": iso(t["fim"]), "fechado": t["num"] < tri_atual}
                       for t in TRIMESTRES],
        "tri_atual": tri_atual,
        "dias_letivos": [iso(d) for d in letivos],
        "docentes": docs,
        "fragmentos": FRAG,
        "fechamentos": FECHAMENTO,
        "alunos": saida_alunos,
        "simulados": gerar_simulados(ativos, risco_2026, habil_2026),
        "evasao_hist": gerar_historico_evasao(alunos),
    }


def gerar_simulados(ativos, risco, habil_notas):
    por_serie = {}
    for a in ativos:
        reg = a["anos"][str(ANO)]
        por_serie.setdefault(reg["serie"], []).append((a, reg))
    # mesma habilidade das notas (padronizada), pra quem vai bem no boletim ir bem no simulado
    habil = {k: (v - 7.45) / 0.95 for k, v in habil_notas.items()}
    provas = []
    for i, (nome, cat, dt, series, tri) in enumerate(SIMULADOS):
        if dt > DATA_REF:
            continue
        evolucao = 6 * sum(1 for p in SIMULADOS[:i] if p[1] == cat)   # a escola melhora um pouco a cada edição
        por_aluno = []
        for serie in series:
            for a, reg in por_serie.get(serie, []):
                if r.random() > clip(0.94 - 0.06 * risco[a["id"]], 0.6, 0.99):
                    continue
                z = habil[a["id"]] + r.gauss(0, 0.45)
                al = {"id": a["id"], "nome": a["nome"], "turma": reg["turma"], "serie": serie}
                if tri:
                    al["por_area"] = {k: round(clip(560 + 62 * z + EFEITO_AREA[k] + evolucao + r.gauss(0, 32), 300, 880), 1) for k in AREAS}
                    al["media_tri"] = round(sum(al["por_area"].values()) / 4, 1)
                    comp = [int(clip(round((120 + 38 * z + r.gauss(0, 30)) / 40) * 40, 0, 200)) for _ in range(5)]
                    al["redacao"] = {f"C{j + 1}": comp[j] for j in range(5)} | {"total": sum(comp)}
                    al["nota"] = al["media_tri"]
                else:
                    ac = {k: round(clip(58 + 15 * z + EFEITO_AREA[k] / 4 + evolucao / 2 + r.gauss(0, 8), 5, 100), 1) for k in AREAS}
                    al["acertos_por_area"] = ac
                    al["acertos"] = round(sum(ac.values()) / 4, 1)
                    al["nota_10"] = round(al["acertos"] / 10, 1)
                    al["nota"] = al["acertos"]
                por_aluno.append(al)
        provas.append({"id": i + 1, "nome": nome, "categoria": cat, "data": iso(dt), "series": series, "tri": tri,
                       "inscritos": sum(len(por_serie.get(s, [])) for s in series), "por_aluno": por_aluno,
                       "rede": {"alunos": ALUNOS_REDE, "media_desvio": round(r.uniform(-28, -12), 1)}})
    return provas


def gerar_historico_evasao(alunos):
    """Um registro por aluno-ano (2022-2025) com os sinais do ano e o desfecho, pro modelo aprender."""
    hist = []
    for a in alunos:
        for ano in range(2022, ANO):
            reg = a["anos"].get(str(ano))
            if not reg:
                continue
            prox = a["anos"].get(str(ano + 1))
            if reg["status"] in ("evadido", "transferido"):
                desfecho = "evadiu_meio"
            elif reg["serie"] == "3ª série":
                desfecho = "formou"
            elif not prox:
                desfecho = "evadiu_fim"
            else:
                desfecho = "continuou"
            risco = risco_latente(a, ano)
            seg = SEGMENTO_DA_SERIE[reg["serie"]]
            nota = round(clip(r.gauss(7.7 - 0.75 * risco + {"Fundamental I": 0.35, "Ensino Médio": -0.2}.get(seg, 0), 0.95), 2, 10), 2)
            sem_nota = reg["serie"] in SERIES_PARECER
            # mesma forma que o painel calcula hoje: fração das notas abaixo de 6
            p_baixa = 0.5 * math.erfc((nota - 6) / (1.15 * math.sqrt(2)))
            rec = {"id": a["id"], "ano": ano, "serie": reg["serie"], "segmento": seg, "desfecho": desfecho,
                   "anos_escola": ano - a["entrada"], "bolsa_pct": a["desconto"],
                   "nota_media": None if sem_nota else nota,
                   "pct_notas_baixas": None if sem_nota else round(clip(p_baixa + r.gauss(0, 0.04), 0, 1), 3),
                   "pct_faltas": round(clip(1.005 - presenca_esperada(risco) + r.gauss(0, 0.008), 0.003, 0.5), 3),
                   "ocorrencias": n_ocorrencias(risco, seg, 1.0)}
            rec.update(financeiro_sinais(risco))
            if desfecho == "evadiu_meio":
                rec["mes_saida"] = int(reg["data_inativo"][5:7]) if reg["data_inativo"] else None
                motivos = {"Mudança de cidade": 3, "Transferência para outra escola": 3, "Não informado": 2}
                if rec["fin_atrasados"] >= 2:
                    motivos["Financeiro"] = 6
                if rec["nota_media"] is not None and rec["nota_media"] < 6:
                    motivos["Desempenho / adaptação"] = 5
                if rec["ocorrencias"] >= 4:
                    motivos["Insatisfação com a escola"] = 3
                rec["motivo"] = r.choices(list(motivos), weights=list(motivos.values()))[0]
            elif desfecho == "evadiu_fim":
                rec["motivo"] = "Não renovou (sem justificativa)"
            hist.append(rec)
    return hist
