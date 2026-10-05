"""Funil de matrículas: os leads vão linha a linha porque o painel filtra por data, origem e funil."""
from util import compactar

CAMPOS = ["id", "funil", "criado", "conversa", "agendou", "visitou", "matriculou", "perdido", "status", "etapa",
          "origem", "serie", "termometro", "motivo", "tour", "aluno", "responsavel", "celular"]
CATEGORICOS = ["funil", "status", "etapa", "origem", "serie", "termometro", "motivo", "tour"]

# taxas de passagem usadas como referência de mercado em captação escolar
REFERENCIA = {"agendou": 0.27, "visitou": 0.83, "matriculou": 0.50}


def agregar_funil(leads, cfg):
    return {
        "leads": compactar(leads, CAMPOS, CATEGORICOS),
        "funis": sorted({l["funil"] for l in leads}),
        "funil_atual": f"Funil {cfg.ano_prox}",
        "referencia": REFERENCIA,
        "series": cfg.series,
    }
