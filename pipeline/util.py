import json
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"
ROTULOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
SEGMENTOS = ["Educação Infantil", "Fundamental I", "Fundamental II", "Ensino Médio"]


def ler(nome):
    return json.loads((DATA / nome).read_text(encoding="utf-8"))


def d(s):
    return date.fromisoformat(s) if s else None


def dias(ini, fim):
    """Lista de datas de ini até fim, inclusive."""
    return [ini + timedelta(days=i) for i in range((fim - ini).days + 1)]


def compactar(linhas, campos, categoricos):
    """
    Transforma uma lista de dicts em lista de listas, trocando textos que se
    repetem por índices. Corta bem o tamanho do JSON que vai pro navegador.
    """
    dic = {c: [] for c in categoricos}
    pos = {c: {} for c in categoricos}
    saida = []
    for l in linhas:
        row = []
        for c in campos:
            v = l.get(c)
            if c in dic and v is not None:
                if v not in pos[c]:
                    pos[c][v] = len(dic[c])
                    dic[c].append(v)
                v = pos[c][v]
            row.append(v)
        saida.append(row)
    return {"campos": campos, "dic": dic, "linhas": saida}


class Config:
    def __init__(self, meta):
        self.meta = meta
        self.ano = meta["ano"]
        self.ano_prox = meta["ano_proximo"]
        self.data_ref = d(meta["data_ref"])
        self.series = [s["serie"] for s in meta["series"]]
        self.segmento = {s["serie"]: s["segmento"] for s in meta["series"]}
        self.vagas = {s["serie"]: s["vagas"] for s in meta["series"]}
        self._mens = {s["serie"]: s["mensalidade"] for s in meta["series"]}
        self.campanhas = {int(k): d(v) for k, v in meta["campanhas"].items()}

    def mensalidade(self, serie, ano):
        fator = (1 + self.meta["reajuste_anual"]) ** (ano - self.meta["ano_base_mensalidade"])
        return round(self._mens[serie] * fator, 0)

    def ordem_serie(self, serie):
        return self.series.index(serie)


def registros(alunos, ano):
    chave = str(ano)
    return [(a, a["anos"][chave]) for a in alunos if chave in a["anos"]]


def veterano_vs_anterior(a, ano):
    return str(ano - 1) in a["anos"]


def primeiro_ano(a):
    return min(int(k) for k in a["anos"])
