"""
Simula a base de alunos ano a ano, de 2016 até a campanha em andamento.

Cada ano: veteranos avançam de série (alguns não renovam), a 3ª série do médio
se forma, uns poucos ex-alunos voltam, e os novos completam as turmas. Os novos
de 2026 e 2027 saem dos leads que matricularam no funil; o resto é quem chegou
sem passar pelo CRM.
"""
import math
from datetime import date, timedelta

from .comum import (ANO, ANO_PROX, DATA_REF, NOMES_SERIE, PESO_SERIE, PRIMEIRO_ANO, SEDE, SEGMENTO_DA_SERIE,
                    SERIES, data_beta, data_entre, iso, nome_aluno, nome_responsavel, rnd, sortear)

TOTAL_ALVO = {2016: 612, 2017: 628, 2018: 645, 2019: 661, 2020: 634, 2021: 659,
              2022: 694, 2023: 728, 2024: 757, 2025: 786, 2026: 808}
RETENCAO = {2017: 0.87, 2018: 0.88, 2019: 0.88, 2020: 0.82, 2021: 0.86, 2022: 0.88,
            2023: 0.88, 2024: 0.87, 2025: 0.86, 2026: 0.85}
P_EVASAO = 0.028
DURACAO_REMATRICULA = 105
VAGAS = {s[1]: s[3] for s in SERIES}
TURNOS = {s[1]: s[4] for s in SERIES}


def inicio_campanha(ano_letivo):
    d = date(ano_letivo - 1, 8, 15)
    while d.weekday() != 0:  # começa sempre numa segunda
        d += timedelta(days=1)
    return d


def alvo_por_serie(total):
    soma = sum(PESO_SERIE)
    return {s: round(total * p / soma) for s, p in zip(NOMES_SERIE, PESO_SERIE)}


def sortear_desconto():
    r = rnd.random()
    if r < 0.70:
        return 0.0
    if r < 0.88:
        return rnd.choice([0.05, 0.10, 0.15])
    if r < 0.97:
        return rnd.choice([0.20, 0.25, 0.30, 0.40])
    return 0.50


def data_novo(ano_letivo):
    # quem chega sem lead: pico entre novembro e fevereiro, um pouco ao longo do ano
    meses = {(ano_letivo - 1, 9): 8, (ano_letivo - 1, 10): 12, (ano_letivo - 1, 11): 14, (ano_letivo - 1, 12): 12,
             (ano_letivo, 1): 22, (ano_letivo, 2): 18, (ano_letivo, 3): 6, (ano_letivo, 4): 2,
             (ano_letivo, 5): 2, (ano_letivo, 6): 2, (ano_letivo, 7): 1, (ano_letivo, 8): 1}
    y, m = sortear(meses)
    return date(y, m, rnd.randint(1, 28))


def data_rematricula(ano_letivo):
    ini = inicio_campanha(ano_letivo)
    if rnd.random() < 0.08:  # os atrasados de sempre
        return data_entre(ini + timedelta(days=DURACAO_REMATRICULA), date(ano_letivo, 2, 20))
    return data_beta(ini, DURACAO_REMATRICULA, 1.25, 2.4)


class Simulacao:
    def __init__(self, leads):
        self.alunos = []
        self.proximo_id = 10001
        self.leads_matriculados = {}
        for l in leads:
            if l["matriculou"]:
                self.leads_matriculados.setdefault(l["ano_letivo"], []).append(l)

    def criar_aluno(self, ano, lead=None):
        nome = lead["aluno"] if lead else nome_aluno()
        serie_ini = None
        a = {
            "id": self.proximo_id,
            "nome": nome,
            "responsavel": lead["responsavel"] if lead else nome_responsavel(nome.split()[-1]),
            "lat": round(SEDE[0] + rnd.gauss(0, 0.022), 5),
            "lng": round(SEDE[1] + rnd.gauss(0, 0.026), 5),
            "entrada": ano,
            "desconto": sortear_desconto(),
            "contraturno": rnd.random() < 0.22,
            "lead": lead["id"] if lead else None,
            "decisao_prox": None,
            "anos": {},
        }
        self.proximo_id += 1
        self.alunos.append(a)
        return a

    @staticmethod
    def matricular(a, ano, serie, data):
        a["anos"][ano] = {
            "serie": serie,
            "turma": None,
            "turno": None,
            "data_matricula": data,
            "status": "cursando",
            "data_inativo": None,
            "acordo": ano >= 2025 and rnd.random() < 0.03,
            "inad": round(rnd.uniform(0.1, 0.6), 2) if rnd.random() < 0.07 else 0.0,
        }

    def ativos(self, ano):
        return [a for a in self.alunos if ano in a["anos"] and a["anos"][ano]["status"] == "cursando"]

    def ano_inicial(self, ano):
        for serie, alvo in alvo_por_serie(TOTAL_ALVO[ano]).items():
            idx = NOMES_SERIE.index(serie)
            for _ in range(alvo):
                a = self.criar_aluno(ano)
                a["entrada"] = ano - rnd.randint(0, idx) if idx else ano
                self.matricular(a, ano, serie, data_rematricula(ano))

    def rematricular(self, ano):
        for a in self.ativos(ano - 1):
            serie_ant = a["anos"][ano - 1]["serie"]
            if serie_ant == "3ª série":
                if ano == ANO_PROX:
                    a["decisao_prox"] = "formando"
                continue
            prox = NOMES_SERIE[NOMES_SERIE.index(serie_ant) + 1]
            if ano <= ANO:
                if rnd.random() < RETENCAO[ano]:
                    self.matricular(a, ano, prox, data_rematricula(ano))
                continue
            # campanha em andamento: só entra quem já renovou até a data de referência
            r = rnd.random()
            if r < 0.89:
                d = data_beta(inicio_campanha(ano), DURACAO_REMATRICULA, 1.25, 2.4)
                if d <= DATA_REF:
                    self.matricular(a, ano, prox, d)
                    a["decisao_prox"] = "rematriculado"
                else:
                    a["decisao_prox"] = "pendente"
            elif r < 0.95:
                a["decisao_prox"] = "nao_renova"
            else:
                a["decisao_prox"] = "pendente"

    def egressos_que_voltam(self, ano):
        if ano < PRIMEIRO_ANO + 2 or ano > ANO:
            return
        ex = []
        for a in self.alunos:
            anos = sorted(a["anos"])
            ultimo = anos[-1]
            if ultimo >= ano - 1 or a["anos"][ultimo]["serie"] == "3ª série":
                continue
            ex.append((a, ultimo))
        rnd.shuffle(ex)
        for a, ultimo in ex[: round(TOTAL_ALVO[ano] * 0.012)]:
            idx = NOMES_SERIE.index(a["anos"][ultimo]["serie"]) + (ano - ultimo)
            if idx < len(NOMES_SERIE):
                self.matricular(a, ano, NOMES_SERIE[idx], data_novo(ano))

    def novos(self, ano):
        for lead in self.leads_matriculados.get(ano, []):
            a = self.criar_aluno(ano, lead)
            self.matricular(a, ano, lead["serie"], date.fromisoformat(lead["matriculou"]))
        if ano <= ANO:
            contagem = {}
            for a in self.alunos:
                if ano in a["anos"]:
                    s = a["anos"][ano]["serie"]
                    contagem[s] = contagem.get(s, 0) + 1
            for serie, alvo in alvo_por_serie(TOTAL_ALVO[ano]).items():
                for _ in range(max(0, alvo - contagem.get(serie, 0))):
                    self.matricular(self.criar_aluno(ano), ano, serie, data_novo(ano))
        else:
            # campanha em andamento: alguns chegaram sem passar pelo CRM
            pesos = dict(zip(NOMES_SERIE, PESO_SERIE))
            for _ in range(round(len(self.leads_matriculados.get(ano, [])) * 0.2)):
                d = data_entre(inicio_campanha(ano), DATA_REF)
                self.matricular(self.criar_aluno(ano), ano, sortear(pesos), d)

    def evasao(self, ano):
        if ano > ANO:
            return
        limite = min(date(ano, 11, 30), DATA_REF)
        for a in self.alunos:
            r = a["anos"].get(ano)
            if not r or rnd.random() >= P_EVASAO:
                continue
            ini = max(date(ano, 2, 15), r["data_matricula"] + timedelta(days=20))
            d = data_entre(ini, limite)
            if d <= limite:
                r["status"] = "evadido" if rnd.random() < 0.7 else "transferido"
                r["data_inativo"] = d

    def montar_turmas(self, ano):
        por_serie = {}
        for a in self.alunos:
            r = a["anos"].get(ano)
            if r:
                por_serie.setdefault(r["serie"], []).append(r)
        for serie, regs in por_serie.items():
            regs.sort(key=lambda r: r["data_matricula"])
            n_turmas = max(1, math.ceil(len(regs) / VAGAS[serie]))
            turnos = TURNOS[serie]
            for i, r in enumerate(regs):
                t = i % n_turmas
                r["turma"] = f"{serie} {'ABCD'[t]}"
                r["turno"] = turnos[t % len(turnos)]

    def rodar(self):
        for ano in range(PRIMEIRO_ANO, ANO_PROX + 1):
            if ano == PRIMEIRO_ANO:
                self.ano_inicial(ano)
            else:
                self.rematricular(ano)
                self.egressos_que_voltam(ano)
                self.novos(ano)
            self.evasao(ano)
            self.montar_turmas(ano)
        return self.alunos


def serializar(alunos):
    saida = []
    for a in alunos:
        b = dict(a)
        b["anos"] = {str(ano): {**r, "data_matricula": iso(r["data_matricula"]), "data_inativo": iso(r["data_inativo"])}
                     for ano, r in sorted(a["anos"].items())}
        saida.append(b)
    return saida


def gerar_alunos(leads):
    return serializar(Simulacao(leads).rodar())
