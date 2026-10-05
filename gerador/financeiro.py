"""
Financeiro do ano: repasses da plataforma de cobrança, contas a pagar com plano de
contas, orçamento (teto) e empréstimos. A receita sai dos alunos matriculados,
então mexer na base de alunos mexe no caixa.
"""
from datetime import date, timedelta

from .comum import ANO, DATA_REF, SEGMENTO_DA_SERIE, iso, mensalidade, rnd

CONTRATURNO = 450       # mensal, só infantil e fundamental I
TAXA_PLATAFORMA = 0.065
EMPRESAS = ["Horizonte Ensino Ltda", "Horizonte Infantil Ltda"]

# plano, grupo do orçamento, subclassificação, favorecido, peso sobre a receita, dia de vencimento
PLANO = [
    ("Salários e ordenados", "Pessoal", "Folha docente", "Folha de pagamento - docentes", 0.120, 5),
    ("Salários e ordenados", "Pessoal", "Folha docente", "Adiantamento - docentes", 0.080, 20),
    ("Salários e ordenados", "Pessoal", "Folha administrativa", "Folha de pagamento - administrativo", 0.050, 5),
    ("Salários e ordenados", "Pessoal", "Folha administrativa", "Adiantamento - administrativo", 0.033, 20),
    ("Salários e ordenados", "Pessoal", "Coordenação e direção", "Folha de pagamento - gestão", 0.042, 5),
    ("Encargos sociais", "Pessoal", "INSS", "INSS (guia mensal)", 0.066, 20),
    ("Encargos sociais", "Pessoal", "FGTS", "FGTS (guia mensal)", 0.026, 7),
    ("Benefícios", "Pessoal", "Plano de saúde", "Operadora Vida Plena", 0.028, 10),
    ("Benefícios", "Pessoal", "Vale-refeição", "Cartão Refeição Bom Prato", 0.016, 3),
    ("Benefícios", "Pessoal", "Vale-transporte", "Cartão Transporte Urbano", 0.010, 3),
    ("Pró-labore", "Pessoal", "Sócios", "Sócio A", 0.020, 5),
    ("Pró-labore", "Pessoal", "Sócios", "Sócio B", 0.016, 5),
    ("Autônomos", "Pessoal", "Atividades extracurriculares", "Professor de judô (RPA)", 0.004, 10),
    ("Autônomos", "Pessoal", "Atividades extracurriculares", "Professora de balé (RPA)", 0.004, 10),
    ("Autônomos", "Pessoal", "Atividades extracurriculares", "Professor de robótica (RPA)", 0.005, 10),
    ("Impostos e taxas", "Despesas gerais", "Tributos federais", "PIS/COFINS", 0.030, 25),
    ("Impostos e taxas", "Despesas gerais", "Tributos federais", "IRPJ/CSLL", 0.012, 28),
    ("Impostos e taxas", "Despesas gerais", "Tributos municipais", "ISS", 0.024, 15),
    ("Impostos e taxas", "Despesas gerais", "Tributos municipais", "Taxas e licenças", 0.002, 10),
    ("Serviços de terceiros", "Despesas gerais", "Limpeza", "Limpa Bem Serviços", 0.021, 10),
    ("Serviços de terceiros", "Despesas gerais", "Portaria e segurança", "Guarda Forte Segurança", 0.019, 10),
    ("Serviços de terceiros", "Despesas gerais", "Contabilidade", "Exata Contabilidade", 0.008, 28),
    ("Serviços de terceiros", "Despesas gerais", "Tecnologia", "Rede Total TI", 0.006, 15),
    ("Material didático e sistemas", "Despesas gerais", "Plataforma de ensino", "Plataforma Saber+", 0.028, 12),
    ("Material didático e sistemas", "Despesas gerais", "Sistema de gestão", "SisEscola Gestão", 0.006, 12),
    ("Material didático e sistemas", "Despesas gerais", "Papelaria", "Papelaria Central", 0.004, 9),
    ("Manutenção predial", "Despesas gerais", "Climatização", "Clima Frio Refrigeração", 0.006, 14),
    ("Manutenção predial", "Despesas gerais", "Reparos e obras", "Reforma Já Construções", 0.011, 21),
    ("Manutenção predial", "Despesas gerais", "Jardinagem", "Verde Vivo Paisagismo", 0.003, 18),
    ("Energia, água e internet", "Despesas gerais", "Energia elétrica", "Companhia de Energia", 0.017, 18),
    ("Energia, água e internet", "Despesas gerais", "Água e esgoto", "Companhia de Saneamento", 0.006, 22),
    ("Energia, água e internet", "Despesas gerais", "Telefonia e internet", "Conecta Telecom", 0.005, 8),
    ("Aluguel", "Despesas gerais", "Imóvel anexo", "Imobiliária Ponto Certo", 0.030, 10),
    ("Marketing", "Despesas gerais", "Mídia online", "Anúncios online", 0.011, 3),
    ("Marketing", "Despesas gerais", "Eventos de captação", "Feira de matrículas", 0.004, 16),
    ("Marketing", "Despesas gerais", "Gráfica", "Gráfica Expressa", 0.004, 16),
    ("Despesas financeiras", "Despesas gerais", "Tarifas", "Tarifas bancárias", 0.002, 1),
    ("Despesas financeiras", "Despesas gerais", "Juros", "Juros e multas", 0.001, 28),
]
# loja e cantina têm caixa próprio: aparecem no detalhe, mas ficam fora do resultado da escola
OUTROS_CENTROS = [
    ("Mercadorias para revenda", "Uniformes", "Malharia Uniforte", 0.018, 12, "Loja"),
    ("Mercadorias para revenda", "Livros paradidáticos", "Distribuidora Leitura", 0.010, 15, "Loja"),
    ("Cantina", "Insumos", "Atacadão Sabor", 0.012, 6, "Cantina"),
]
# quanto cada plano tende a gastar em relação ao orçado
VIES = {
    "Salários e ordenados": 0.985, "Encargos sociais": 1.0, "Benefícios": 1.04, "Pró-labore": 1.0,
    "Autônomos": 0.9, "Impostos e taxas": 1.01, "Serviços de terceiros": 0.95,
    "Material didático e sistemas": 0.88, "Manutenção predial": 1.09, "Energia, água e internet": 1.05,
    "Aluguel": 1.0, "Marketing": 1.12, "Despesas financeiras": 0.97, "Empréstimos": 1.0,
}
EMPRESTIMOS = [
    # contrato, valor, parcelas, primeira parcela, juros totais
    ("Ampliação do prédio - Banco Alfa", 650000, 48, date(2023, 3, 25), 0.32),
    ("Capital de giro - Banco Alfa", 420000, 36, date(2024, 5, 25), 0.24),
    ("Reforma da quadra - Banco Beta", 240000, 24, date(2025, 7, 25), 0.18),
    ("Equipamentos de TI - Banco Gama", 96000, 12, date(2026, 2, 25), 0.12),
]


def sazonalidade(plano, fav, mes):
    f = 1.0
    if plano in ("Salários e ordenados", "Encargos sociais"):
        if mes >= 3:
            f *= 1.055                      # dissídio
        if mes in (11, 12):
            f *= 1.5                        # 13º
    elif plano == "Material didático e sistemas" and fav != "SisEscola Gestão":
        f *= {1: 1.8, 2: 2.2}.get(mes, 1.0)
    elif fav == "Reforma Já Construções":
        f *= {1: 2.4, 7: 1.9}.get(mes, 1.0)  # obras nas férias
    elif plano == "Marketing":
        f *= {8: 1.8, 9: 2.0, 10: 2.0, 11: 1.5}.get(mes, 1.0)
    elif fav == "Companhia de Energia":
        f *= {2: 1.15, 3: 1.15, 7: 0.85}.get(mes, 1.0)
    elif fav == "IRPJ/CSLL":
        f *= 3.0 if mes in (1, 4, 7, 10) else 0.0   # trimestral
    elif fav == "Malharia Uniforte":
        f *= {1: 3.0, 2: 2.0, 7: 1.5}.get(mes, 1.0)
    elif fav == "Distribuidora Leitura":
        f *= {1: 5.0, 2: 2.0}.get(mes, 0.2)
    return f


def fim_do_mes(ano, mes):
    return (date(ano + mes // 12, mes % 12 + 1, 1) - timedelta(days=1))


def gerar_receitas(alunos):
    """Repasse mensal: mensalidades dos ativos + taxas de matrícula do mês."""
    meses = {m: {"mensalidades": 0.0, "novo_contrato": 0.0, "alunos": 0, "segmentos": {}} for m in range(1, 13)}
    ano = str(ANO)
    for a in alunos:
        # taxa de matrícula só pra quem entra; veterano renova sem taxa
        primeiro = min(a["anos"], key=int)
        r0 = a["anos"][primeiro]
        dm = date.fromisoformat(r0["data_matricula"])
        if dm.year == ANO:
            meses[dm.month]["novo_contrato"] += mensalidade(r0["serie"], int(primeiro)) * 0.5
        r = a["anos"].get(ano)
        if not r:
            continue
        seg = SEGMENTO_DA_SERIE[r["serie"]]
        valor = mensalidade(r["serie"], ANO) * (1 - a["desconto"])
        if a["contraturno"] and seg in ("Educação Infantil", "Fundamental I") and r["turno"] == "Manhã":
            valor += CONTRATURNO
        dm = date.fromisoformat(r["data_matricula"])
        ini = dm.month if dm.year == ANO else 1
        fim = date.fromisoformat(r["data_inativo"]).month if r["data_inativo"] else 12
        for m in range(ini, fim + 1):
            meses[m]["mensalidades"] += valor
            meses[m]["alunos"] += 1
            meses[m]["segmentos"][seg] = meses[m]["segmentos"].get(seg, 0) + valor

    receitas = []
    for m in range(1, 13):
        info = meses[m]
        previsto = m > DATA_REF.month
        ruido = 0 if previsto else 1
        bruto = info["mensalidades"]
        descontos = {
            "taxa_plataforma": -round(TAXA_PLATAFORMA * (bruto + info["novo_contrato"]), 2),
            "cancelado": -round(bruto * rnd.uniform(0.004, 0.012) * ruido, 2),
            "edicao_desconto": -round(bruto * rnd.uniform(0, 0.002) * ruido, 2),
            "recebido_escola": -round(bruto * rnd.uniform(0, 0.002) * ruido, 2),
            "renegociacao": -round(bruto * rnd.uniform(0.0, 0.01) * ruido, 2),
        }
        total = round(bruto + info["novo_contrato"] + sum(descontos.values()), 2)
        t1 = round(total * 0.6, 2)
        receitas.append({
            "mes": f"{ANO}-{m:02d}",
            "previsto": previsto,
            "mensalidades": round(bruto, 2),
            "novo_contrato": round(info["novo_contrato"], 2),
            "descontos": descontos,
            "valor_total_transferir": total,
            "transferencias": [{"data": iso(date(ANO, m, 5)), "valor": t1},
                               {"data": iso(date(ANO, m, 20)), "valor": round(total - t1, 2)}],
            "alunos": info["alunos"],
            "cobrancas": round(info["alunos"] * 1.08),
            "segmentos": {k: round(v * total / bruto, 2) for k, v in info["segmentos"].items()} if bruto else {},
        })
    return receitas


def gerar_emprestimos():
    contratos = []
    for nome, valor, n, primeira, juros in EMPRESTIMOS:
        parcela = round(valor * (1 + juros) / n, 2)
        parcelas = []
        for k in range(n):
            y, m = primeira.year + (primeira.month - 1 + k) // 12, (primeira.month - 1 + k) % 12 + 1
            venc = date(y, m, 25)
            parcelas.append({"numero": k + 1, "vencimento": iso(venc), "valor": parcela,
                             "pago": venc < DATA_REF, "pagamento": iso(venc) if venc < DATA_REF else None})
        contratos.append({"nome": nome, "valor_contratado": valor, "n_parcelas": n, "parcelas": parcelas})
    return contratos


def nova_conta(contas, plano, sub, fav, valor, venc, centro, parcela=None):
    if valor <= 0:
        return
    pago = venc < DATA_REF
    # umas poucas atrasadas nos últimos dois meses, pra calendário e alertas terem o que mostrar
    if pago and venc.month >= DATA_REF.month - 1 and rnd.random() < 0.03:
        pago = False
    baixa = None
    if pago:
        baixa = min(venc + timedelta(days=rnd.choice([-3, -2, -1, 0, 0, 0, 1, 2])), DATA_REF - timedelta(days=1))
    tipo = "RPA" if "(RPA)" in fav else "Guia" if plano in ("Encargos sociais", "Impostos e taxas") else \
        "Folha" if plano in ("Salários e ordenados", "Pró-labore") else rnd.choice(["NF-e", "Boleto", "Fatura"])
    contas.append({
        "id": len(contas) + 1,
        "plano": plano,
        "sub": sub,
        "favorecido": fav,
        "valor": round(valor, 2),
        "vencimento": iso(venc),
        "situacao": "Paga" if pago else "Pendente",
        "baixa": iso(baixa),
        "documento": f"{tipo} {rnd.randint(1000, 99999)}",
        "parcela": parcela,
        "empresa": EMPRESAS[1] if rnd.random() < 0.22 else EMPRESAS[0],
        "centro": centro,
    })


def gerar_financeiro(alunos):
    receitas = gerar_receitas(alunos)
    fechados = [r["valor_total_transferir"] for r in receitas if not r["previsto"]]
    base = sum(fechados) / len(fechados) * 1.08  # calibra pra margem ficar perto de 8%

    contas, orcamento = [], {}
    for mes in range(1, 13):
        ultimo = fim_do_mes(ANO, mes).day
        for plano, grupo, sub, fav, peso, dia in PLANO:
            saz = sazonalidade(plano, fav, mes)
            chave = (plano, grupo)
            orcamento.setdefault(chave, [0.0] * 12)[mes - 1] += base * peso * saz * 1.02
            valor = base * peso * saz * VIES[plano] * rnd.uniform(0.95, 1.05)
            nova_conta(contas, plano, sub, fav, valor, date(ANO, mes, min(dia, ultimo)), "Escola")
        for plano, sub, fav, peso, dia, centro in OUTROS_CENTROS:
            valor = base * peso * sazonalidade(plano, fav, mes) * rnd.uniform(0.9, 1.1)
            nova_conta(contas, plano, sub, fav, valor, date(ANO, mes, min(dia, ultimo)), centro)

    emprestimos = gerar_emprestimos()
    for e in emprestimos:
        for p in e["parcelas"]:
            venc = date.fromisoformat(p["vencimento"])
            if venc.year != ANO:
                continue
            orcamento.setdefault(("Empréstimos", "Despesas gerais"), [0.0] * 12)[venc.month - 1] += p["valor"]
            nova_conta(contas, "Empréstimos", "Parcelas de financiamento", e["nome"], p["valor"], venc, "Escola",
                       parcela=f"{p['numero']}/{e['n_parcelas']}")

    receita_orcada = []
    for r in receitas:
        fator = 1.0 if r["previsto"] else rnd.uniform(0.97, 1.045)
        receita_orcada.append(round(r["valor_total_transferir"] * fator, -2))

    contas.sort(key=lambda c: (c["vencimento"], c["plano"]))
    for i, c in enumerate(contas, 1):
        c["id"] = i

    return {
        "receitas": receitas,
        "receita_orcada": receita_orcada,
        "contas": contas,
        "orcamento": [{"conta": plano, "grupo": grupo, "teto": [round(v, -2) for v in valores]}
                      for (plano, grupo), valores in orcamento.items()],
        "emprestimos": emprestimos,
        "centros": ["Escola", "Loja", "Cantina"],
    }
