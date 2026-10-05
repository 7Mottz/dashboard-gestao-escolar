import random
from datetime import date, timedelta

SEED = 2026
rnd = random.Random(SEED)

ESCOLA = "Colégio Horizonte"
DATA_REF = date(2026, 10, 15)   # "hoje" da demo
ANO = 2026                      # ano letivo em curso
ANO_PROX = ANO + 1              # ano da campanha de matrícula/rematrícula em andamento
PRIMEIRO_ANO = 2016             # início do histórico simulado

# cidade fictícia pro mapa (coordenadas genéricas, a escola não existe)
SEDE = (-22.9056, -47.0608)

# segmento, série, mensalidade cheia em 2026, vagas por turma, turnos
SERIES = [
    ("Educação Infantil", "Baby", 1190, 12, ["Tarde"]),
    ("Educação Infantil", "Maternal", 1290, 16, ["Manhã", "Tarde"]),
    ("Educação Infantil", "Jardim I", 1290, 20, ["Manhã", "Tarde"]),
    ("Educação Infantil", "Jardim II", 1340, 20, ["Manhã", "Tarde"]),
    ("Fundamental I", "1º ano", 1420, 26, ["Manhã", "Tarde"]),
    ("Fundamental I", "2º ano", 1420, 26, ["Manhã", "Tarde"]),
    ("Fundamental I", "3º ano", 1420, 28, ["Manhã", "Tarde"]),
    ("Fundamental I", "4º ano", 1460, 28, ["Manhã", "Tarde"]),
    ("Fundamental I", "5º ano", 1460, 28, ["Manhã", "Tarde"]),
    ("Fundamental II", "6º ano", 1580, 32, ["Manhã"]),
    ("Fundamental II", "7º ano", 1580, 32, ["Manhã"]),
    ("Fundamental II", "8º ano", 1620, 32, ["Manhã"]),
    ("Fundamental II", "9º ano", 1620, 32, ["Manhã"]),
    ("Ensino Médio", "1ª série", 1840, 35, ["Manhã"]),
    ("Ensino Médio", "2ª série", 1840, 35, ["Manhã"]),
    ("Ensino Médio", "3ª série", 1890, 35, ["Manhã"]),
]
NOMES_SERIE = [s[1] for s in SERIES]
SEGMENTO_DA_SERIE = {s[1]: s[0] for s in SERIES}
SEGMENTOS = ["Educação Infantil", "Fundamental I", "Fundamental II", "Ensino Médio"]
SIGLA_SEGMENTO = {"Educação Infantil": "EI", "Fundamental I": "F1", "Fundamental II": "F2", "Ensino Médio": "EM"}

# peso de cada série no total de alunos (Baby e Maternal são turmas menores)
PESO_SERIE = [0.6, 0.85, 1.0, 1.05, 1.15, 1.1, 1.15, 1.1, 1.15, 1.3, 1.2, 1.25, 1.2, 1.2, 1.1, 0.95]

REAJUSTE_ANUAL = 0.07


def mensalidade(serie, ano):
    base = next(s[2] for s in SERIES if s[1] == serie)
    return round(base * (1 + REAJUSTE_ANUAL) ** (ano - ANO), 0)


PRIMEIROS = [
    "Alice", "Miguel", "Helena", "Arthur", "Laura", "Gael", "Valentina", "Heitor", "Sophia", "Theo",
    "Isabela", "Davi", "Manuela", "Bernardo", "Júlia", "Gabriel", "Luísa", "Pedro", "Cecília", "Samuel",
    "Lorena", "Lucas", "Lívia", "Benício", "Giovanna", "Matheus", "Maria Clara", "Rafael", "Beatriz", "Enzo",
    "Mariana", "Joaquim", "Antonella", "Nicolas", "Lara", "Lorenzo", "Clara", "Emanuel", "Yasmin", "Henrique",
    "Rebeca", "Murilo", "Elisa", "Bento", "Ana Luiza", "Benjamin", "Melissa", "Daniel", "Catarina", "Vicente",
    "Esther", "Leonardo", "Marina", "Caio", "Heloísa", "Felipe", "Olívia", "Otávio", "Agatha", "Augusto",
]
SOBRENOMES = [
    "Almeida", "Barbosa", "Cardoso", "Carvalho", "Castro", "Correia", "Costa", "Dias", "Duarte", "Fernandes",
    "Ferreira", "Freitas", "Gomes", "Lima", "Lopes", "Machado", "Martins", "Melo", "Mendes", "Monteiro",
    "Moreira", "Nascimento", "Nogueira", "Oliveira", "Pereira", "Pinto", "Ramos", "Reis", "Ribeiro", "Rocha",
    "Rodrigues", "Santos", "Silva", "Soares", "Souza", "Teixeira", "Vieira", "Azevedo", "Batista", "Campos",
]
RESPONSAVEIS = [
    "Adriana", "Bruno", "Camila", "Diego", "Eduarda", "Fábio", "Gisele", "Hugo", "Ingrid", "Jonas",
    "Karina", "Leandro", "Mônica", "Nelson", "Patrícia", "Renato", "Simone", "Tiago", "Vanessa", "Wagner",
]


def nome_aluno():
    return f"{rnd.choice(PRIMEIROS)} {rnd.choice(SOBRENOMES)} {rnd.choice(SOBRENOMES)}"


def nome_responsavel(sobrenome_aluno):
    return f"{rnd.choice(RESPONSAVEIS)} {sobrenome_aluno}"


def celular_mascarado():
    # nunca parece um número real: DDD e prefixo sempre mascarados
    return f"(**) 9****-{rnd.randint(1000, 9999)}"


def data_entre(ini, fim):
    if fim <= ini:
        return ini
    return ini + timedelta(days=rnd.randint(0, (fim - ini).days))


def data_beta(ini, dias, a, b):
    return ini + timedelta(days=int(rnd.betavariate(a, b) * dias))


def sortear(pesos):
    return rnd.choices(list(pesos), weights=list(pesos.values()))[0]


def iso(d):
    return d.isoformat() if d else None


def proximo_dia_util(d):
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d
