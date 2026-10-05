"""
Insights automáticos: uma bateria de regras simples sobre os agregados. Cada
regra que encontra algo vira um card com sinal (alerta, atenção, positivo ou
neutro) e uma pontuação pra ordenar o que aparece primeiro.
"""
from collections import defaultdict

from util import d


def brl(v):
    s = "-" if v < 0 else ""
    v = abs(v)
    if v >= 1e6:
        return f"{s}R$ {v / 1e6:.2f} mi".replace(".", ",")
    if v >= 1e3:
        return f"{s}R$ {v / 1e3:.0f} mil"
    return f"{s}R$ {v:.0f}"


def pct(v, casas=1):
    return f"{v * 100:.{casas}f}%".replace(".", ",")


def gerar_insights(painel, contas_brutas, cfg):
    fin, rem, funil, alunado = painel["financeiro"], painel["rematricula"], painel["funil"], painel["alunado"]
    ref = cfg.data_ref
    fechados = [m for m in fin["meses"] if m["status"] == "fechado"]
    n_fech = len(fechados)
    achados = []

    def add(sinal, categoria, texto, score):
        achados.append({"sinal": sinal, "categoria": categoria, "texto": texto, "score": score})

    # orçamento por plano no acumulado dos meses fechados
    real = defaultdict(float)
    for c in contas_brutas:
        if c["centro"] == "Escola" and int(c["vencimento"][5:7]) <= n_fech:
            real[c["plano"]] += c["valor"]
    desvios = []
    for o in fin["orcamento"]:
        teto = sum(o["teto"][:n_fech])
        if teto:
            desvios.append((real[o["conta"]] / teto - 1, real[o["conta"]] - teto, o["conta"]))
    desvios.sort()
    pior, melhor = desvios[-1], desvios[0]
    if pior[0] > 0.03:
        add("atencao", "Orçamento", f"{pior[2]} está {pct(pior[0])} acima do orçado no ano ({brl(pior[1])} a mais).", 72)
    if melhor[0] < -0.05:
        add("positivo", "Orçamento", f"{melhor[2]} gastou {pct(-melhor[0])} abaixo do teto ({brl(-melhor[1])} de folga).", 38)

    vencidas = [c for c in contas_brutas if c["situacao"] == "Pendente" and d(c["vencimento"]) < ref]
    if vencidas:
        total = brl(sum(c["valor"] for c in vencidas))
        texto = (f"1 conta vencida e não paga ({vencidas[0]['favorecido']}) soma {total}." if len(vencidas) == 1
                 else f"{len(vencidas)} contas vencidas e não pagas somam {total}.")
        add("alerta", "Contas a pagar", texto, 92)

    meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
             "outubro", "novembro", "dezembro"]
    res = sum(m["resultado"] for m in fechados)
    add("positivo" if res >= 0 else "alerta", "Resultado",
        f"Resultado acumulado de janeiro a {meses[n_fech - 1]}: {brl(res)}.", 60)

    final = fin["meses"][-1]["acumulado"]
    if final < res:
        add("atencao", "Projeção",
            f"Com o 13º, a projeção de dezembro consome {brl(res - final)} do resultado e fecha o ano em {brl(final)}.", 76)

    receita_real = sum(m["entradas"] for m in fechados)
    receita_orc = sum(m["receita_orcada"] for m in fechados)
    gap = receita_real / receita_orc - 1
    add("positivo" if gap >= 0 else "atencao", "Receita",
        f"Receita {pct(abs(gap))} {'acima' if gap >= 0 else 'abaixo'} do orçado no ano.", 50)

    saldos = []
    for e in fin["emprestimos"]:
        saldo = sum(p["valor"] for p in e["parcelas"] if not p["pago"])
        if saldo:
            saldos.append((saldo, e["nome"]))
    if saldos:
        total = sum(s for s, _ in saldos)
        maior = max(saldos)
        add("atencao", "Empréstimos",
            f"{maior[1]} concentra {pct(maior[0] / total, 0)} do saldo devedor ({brl(maior[0])} de {brl(total)}).", 55)

    atual = next(r for r in rem["ritmo"] if r["atual"])
    anterior = rem["ritmo"][-2]
    dif = atual["no_dia"] - anterior["no_dia"]
    add("positivo" if dif >= 0 else "atencao", "Rematrícula",
        f"No dia {rem['dia']} da campanha são {atual['no_dia']} matrículas para {rem['foco']}, "
        f"{abs(dif)} {'a mais' if dif >= 0 else 'a menos'} que o ciclo anterior no mesmo dia.", 66)

    pendentes = rem["decisoes"]["pendente"]
    if pendentes:
        add("atencao", "Rematrícula", f"{pendentes} alunos ainda não decidiram a rematrícula.", 58)

    taxa_alu = alunado["evasao_mensal"]["atual"]
    add("neutro", "Evasão", f"{sum(taxa_alu)} alunos saíram ao longo de {cfg.ano} "
                            f"({pct(sum(taxa_alu) / alunado['kpis']['total'])} da base).", 30)

    add("neutro", "Alunos", f"Retenção de {pct(alunado['kpis']['retencao'])} dos alunos que podiam voltar.", 28)

    achados.sort(key=lambda x: -x["score"])
    return {"gerado_em": ref.isoformat(), "regras": 11, "disparados": len(achados), "itens": achados}
