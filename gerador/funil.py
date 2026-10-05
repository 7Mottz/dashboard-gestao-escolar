"""Leads do CRM de matrículas, com a linha do tempo de cada um no funil."""
from datetime import date, timedelta

from .comum import (ANO, ANO_PROX, DATA_REF, NOMES_SERIE, celular_mascarado, iso, nome_aluno,
                    nome_responsavel, rnd, sortear)

# peso, conversa, agenda (sobre conversa), visita (sobre agenda), matrícula (sobre visita)
ORIGENS = {
    "Instagram": (30, 0.62, 0.26, 0.84, 0.32),
    "Google": (20, 0.70, 0.30, 0.86, 0.35),
    "Indicação": (14, 0.82, 0.42, 0.92, 0.50),
    "Site": (11, 0.66, 0.28, 0.83, 0.33),
    "WhatsApp": (10, 0.88, 0.33, 0.85, 0.37),
    "Evento": (7, 0.58, 0.35, 0.88, 0.33),
    "Facebook": (5, 0.55, 0.22, 0.80, 0.28),
    "Passou na frente": (3, 0.90, 0.55, 0.95, 0.45),
}
MOTIVOS = {
    "Preço / mensalidade": 26, "Não respondeu mais": 22, "Escolheu outra escola": 18,
    "Distância / logística": 12, "Horário / turno": 7, "Proposta pedagógica": 5,
    "Mudou de cidade": 4, "Sem vaga na série": 3, "Outros": 3,
}
MOTIVOS_POS_VISITA = {
    "Preço / mensalidade": 34, "Escolheu outra escola": 28, "Proposta pedagógica": 10,
    "Distância / logística": 9, "Horário / turno": 7, "Não respondeu mais": 7, "Outros": 5,
}
TOURS = {"Ana (coordenação)": 34, "Bruno (secretaria)": 28, "Carla (direção)": 18, "Diego (comercial)": 20}
SERIE_INTERESSE = dict(zip(NOMES_SERIE, [5, 9, 9, 7, 10, 6, 5, 4, 4, 9, 4, 3, 3, 7, 3, 2]))

# leads por mês ao longo de uma campanha (fev do ano anterior até mar do ano letivo)
PESO_MES = [3, 4, 5, 6, 6, 7, 12, 15, 15, 13, 8, 10, 9, 5]
TOTAL_CAMPANHA = 1900


def meses_da_campanha(ano_letivo):
    meses, y, m = [], ano_letivo - 1, 2
    for _ in PESO_MES:
        meses.append((y, m))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return meses


def linha_do_tempo(origem, criado):
    _, p_conv, p_ag, p_vis, p_mat = ORIGENS[origem]
    ev = {"conversa": None, "agendou": None, "visitou": None, "matriculou": None}
    if rnd.random() < p_conv:
        ev["conversa"] = criado + timedelta(days=rnd.choice([0, 0, 1, 1, 2, 3]))
        if rnd.random() < p_ag:
            ev["agendou"] = ev["conversa"] + timedelta(days=rnd.randint(1, 8))
            visita_marcada = ev["agendou"] + timedelta(days=rnd.randint(2, 10))
            if rnd.random() < p_vis:
                ev["visitou"] = visita_marcada
                if rnd.random() < p_mat:
                    ev["matriculou"] = visita_marcada + timedelta(days=rnd.randint(2, 35))
    return ev


def gerar_lead(i, ano_letivo, criado):
    origem = sortear({k: v[0] for k, v in ORIGENS.items()})
    ev = linha_do_tempo(origem, criado)
    # matrícula para o ano seguinte só abre em agosto: quem decidiu antes espera a campanha
    abertura = date(ano_letivo - 1, 8, 17)
    if ev["matriculou"] and ev["matriculou"] < abertura:
        ev["matriculou"] = abertura + timedelta(days=rnd.randint(0, 25))

    # o que ainda não aconteceu até a data de referência some
    ordem = ["conversa", "agendou", "visitou", "matriculou"]
    for j, k in enumerate(ordem):
        if ev[k] and ev[k] > DATA_REF:
            for k2 in ordem[j:]:
                ev[k2] = None
            break

    ultimo = max([criado] + [d for d in ev.values() if d])
    perdido = None
    if not ev["matriculou"]:
        p_perda = 0.82 if ev["visitou"] else 0.78
        if rnd.random() < p_perda:
            d = ultimo + timedelta(days=rnd.randint(3, 28))
            if d <= DATA_REF:
                perdido = d

    if ev["matriculou"]:
        status = "MATRICULADO"
    elif perdido:
        status = "PERDIDO"
    else:
        status = "PAUSADO" if rnd.random() < 0.07 else "EM_ANDAMENTO"

    if ev["matriculou"]:
        etapa = "Matriculado"
    elif ev["visitou"]:
        etapa = "Pré-matrícula" if rnd.random() < 0.25 else "Visita realizada"
    elif ev["agendou"]:
        etapa = "Visita agendada"
    elif ev["conversa"]:
        etapa = "Em atendimento"
    else:
        etapa = "Sem contato"

    if ev["visitou"]:
        termo = sortear({"QUENTE": 55, "MORNO": 35, "FRIO": 10})
    elif ev["conversa"]:
        termo = sortear({"QUENTE": 20, "MORNO": 50, "FRIO": 30})
    else:
        termo = sortear({"QUENTE": 5, "MORNO": 30, "FRIO": 65})

    motivo = None
    if status == "PERDIDO":
        motivo = sortear(MOTIVOS_POS_VISITA if ev["visitou"] else MOTIVOS)

    aluno = nome_aluno()
    return {
        "id": f"L{i:05d}",
        "funil": f"Funil {ano_letivo}",
        "ano_letivo": ano_letivo,
        "criado": iso(criado),
        "conversa": iso(ev["conversa"]),
        "agendou": iso(ev["agendou"]),
        "visitou": iso(ev["visitou"]),
        "matriculou": iso(ev["matriculou"]),
        "perdido": iso(perdido),
        "status": status,
        "etapa": etapa,
        "origem": origem,
        "serie": sortear(SERIE_INTERESSE),
        "termometro": termo,
        "motivo": motivo,
        "tour": sortear(TOURS) if ev["visitou"] else None,
        "aluno": aluno,
        "responsavel": nome_responsavel(aluno.split()[-1]),
        "celular": celular_mascarado(),
    }


def gerar_leads():
    leads, i = [], 1
    for ano_letivo in (ANO, ANO_PROX):
        for (y, m), peso in zip(meses_da_campanha(ano_letivo), PESO_MES):
            n = round(TOTAL_CAMPANHA * peso / sum(PESO_MES) * rnd.uniform(0.9, 1.1))
            for _ in range(n):
                fim_mes = (date(y, m % 12 + 1, 1) if m < 12 else date(y + 1, 1, 1)) - timedelta(days=1)
                criado = date(y, m, rnd.randint(1, fim_mes.day))
                if criado > DATA_REF:
                    continue
                leads.append(gerar_lead(i, ano_letivo, criado))
                i += 1
    leads.sort(key=lambda l: l["criado"])
    return leads
