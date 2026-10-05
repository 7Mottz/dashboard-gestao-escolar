// Aba Financeiro: uma página longa, com filtro de mês na lateral.

function renderFinanceiro(el) {
  const F = D.financeiro;
  const contas = expandir(F.contas);
  const escola = contas.filter(c => c.centro === 'Escola');
  const mesRef = +HOJE.slice(5, 7);
  const ano = D.meta.ano;
  const chave = m => `${ano}-${String(m).padStart(2, '0')}`;
  const fechados = F.meses.filter(m => m.status === 'fechado');
  const nFech = fechados.length;
  let filtro = 'corrente';

  const mesesDoFiltro = () => filtro === 'ano' ? Array.from({length: mesRef}, (_, i) => chave(i + 1))
    : filtro === 'corrente' ? [chave(mesRef)] : [filtro];
  const nomeFiltro = () => filtro === 'ano' ? `jan a ${MESES[mesRef - 1].slice(0, 3)}/${ano}` : mesDe(mesesDoFiltro()[0]);

  el.innerHTML = `
  <div class="fin-wrap">
    <nav class="meses-lat" id="finMeses"></nav>
    <div>
      <div class="kpis k5" id="finK1"></div>
      <div class="kpis k4 mt" id="finK2"></div>
      <div class="grid g21">
        <div id="finLinha"></div>
        <div id="finGauge"></div>
      </div>
      <div class="grid g2">
        <div id="finRosca"></div>
        <div id="finSeg"></div>
      </div>
      <div class="mt" id="finFluxo"></div>
      <div class="mt" id="finRoDesp"></div>
      <div class="mt" id="finRoRec"></div>
      <div class="mt" id="finDrill"></div>
      <div class="mt" id="finEmp"></div>
      <div class="mt" id="finCal"></div>
      <div class="grid g3" id="finIndicadores"></div>
      <div class="mt" id="finInsights"></div>
    </div>
  </div>`;

  // ---------- filtro lateral
  function menuMeses() {
    const ops = [['ano', 'Total do ano'], ['corrente', 'Mês corrente']]
      .concat(fechados.slice().reverse().map(m => [m.mes, MESES[+m.mes.slice(5) - 1].replace(/^./, c => c.toUpperCase())]));
    $('#finMeses').innerHTML = '<h4>Período</h4>' + ops.map(([k, n]) => `<button data-f="${k}" class="${filtro === k ? 'on' : ''}">${n}</button>`).join('');
  }
  $('#finMeses').addEventListener('click', e => {
    const b = e.target.closest('button[data-f]');
    if (!b) return;
    filtro = b.dataset.f;
    menuMeses();
    atualizarFiltrados();
  });

  // ---------- linha 1 de KPIs + rosca + drill seguem o filtro
  function atualizarFiltrados() {
    const ms = mesesDoFiltro();
    const rec = F.receitas.filter(r => ms.includes(r.mes));
    const receita = soma(rec, 'valor_total_transferir');
    const doFiltro = escola.filter(c => ms.includes(c.vencimento.slice(0, 7)));
    const desp = soma(doFiltro, 'valor');
    const loja = soma(contas.filter(c => c.centro === 'Loja' && ms.includes(c.vencimento.slice(0, 7))), 'valor');
    const cantina = soma(contas.filter(c => c.centro === 'Cantina' && ms.includes(c.vencimento.slice(0, 7))), 'valor');
    const t1 = soma(rec, r => r.transferencias[0].valor), t2 = soma(rec, r => r.transferencias[1].valor);
    const umMes = rec.length === 1;
    const pago = soma(doFiltro.filter(c => c.situacao === 'Paga'), 'valor');
    const pend = doFiltro.filter(c => c.situacao === 'Pendente');
    const atrasado = soma(pend.filter(c => c.vencimento < HOJE), 'valor');
    const aVencer = soma(pend.filter(c => c.vencimento >= HOJE), 'valor');
    const pPago = desp ? pago / desp : 0;

    $('#finK1').innerHTML =
      kpi({rotulo: 'Receita líquida · ' + nomeFiltro(), valor: brl(receita), cor: COR.verdeEsc,
        sub: rec.some(r => r.previsto) ? 'inclui previsão' : `${num(rec.length ? rec[rec.length - 1].alunos : 0)} alunos cobrados`,
        tip: 'Repasses da plataforma de cobrança, já sem a taxa dela.'}) +
      kpi({rotulo: 'Despesas · ' + nomeFiltro(), valor: brl(desp), cor: COR.vermEsc,
        sub: `fora loja ${brl(loja)} e cantina ${brl(cantina)}`, tip: 'Contas da escola pelo vencimento. Loja e cantina têm caixa próprio.'}) +
      kpi({rotulo: umMes ? '1ª transferência' : '1ª transferências (soma)', valor: brl(t1), cor: COR.cianoEsc,
        sub: umMes ? 'dia ' + dataBR(rec[0].transferencias[0].data).slice(0, 5) : `${rec.length} repasses`}) +
      kpi({rotulo: umMes ? '2ª transferência' : '2ª transferências (soma)', valor: brl(t2), cor: COR.cianoEsc,
        sub: umMes ? `dia ${dataBR(rec[0].transferencias[1].data).slice(0, 5)} · mês: ${brl(t1 + t2)}` : `total: ${brl(t1 + t2)}`}) +
      kpi({rotulo: 'Contas a pagar', valor: brl(desp - pago), cor: COR.laranja,
        sub: `pago ${brl(pago)} de ${brl(desp)} (${pct(pPago, 0)}) · ${pend.length} pendentes<br>vencidas <b${atrasado > 0 ? ' style="color:#b91c1c"' : ''}>${brl(atrasado)}</b> · a vencer <b>${brl(aVencer)}</b>`,
        extra: barraProgresso([{v: pPago, cor: COR.verde}, {v: 1 - pPago, cor: '#fdba74'}])});

    roscaCategorias(doFiltro);
    drill.render(doFiltro);
  }

  // ---------- linha 2 (fixa): indicadores de alunos
  const K = F.kpis_alunos;
  $('#finK2').innerHTML =
    kpi({rotulo: 'Alunos matriculados', valor: num(K.matriculados), sub: `segmentos curriculares, ${ano}`, cor: COR.cianoEsc}) +
    kpi({rotulo: 'Alunos novos', valor: num(K.novos), sub: `${pct(K.pct_novos)} dos matriculados`, cor: COR.azul}) +
    kpi({rotulo: 'Ticket médio mensal', valor: brlInt(K.ticket_medio), sub: 'mensalidade média com desconto', cor: COR.roxoEsc}) +
    kpi({rotulo: 'Retenção', valor: pct(K.retencao), sub: `${num(K.retidos)} de ${num(K.elegiveis)} que podiam voltar`, cor: COR.laranjaEsc});

  // ---------- receita x despesa (linha)
  (function () {
    const ms = F.meses.slice(0, mesRef);
    const rec = ms.map(m => m.entradas), desp = ms.map(m => m.despesa_real);
    const saldo = soma(rec) - soma(desp);
    $('#finLinha').innerHTML = card('Receita líquida x despesas', legenda([{nome: 'Receita líquida', cor: COR.verde, tipo: 'linha'}, {nome: 'Despesas', cor: COR.verm, tipo: 'linha'}]) +
      grafLinhas({W: LG.finMaior, rotulos: ms.map(m => m.rotulo), h: 280, fmtY: eixoMil, fmtTip: brl, yMin: 8e5, series: [
        {nome: 'Receita', cor: COR.verde, valores: rec, rotular: true, fmtValor: v => num(v / 1e3), area: true},
        {nome: 'Despesas', cor: COR.verm, valores: desp, rotular: true, abaixo: true, fmtValor: v => num(v / 1e3)}]}) +
      `<div class="saldo-box"><span>Jan a ${MESES[mesRef - 1]} (${MESES[mesRef - 1]} ainda em aberto)</span><b style="color:${saldo >= 0 ? COR.verdeEsc : COR.vermEsc}">${saldo >= 0 ? 'Superávit' : 'Déficit'} de ${brl(Math.abs(saldo))} · ${pct(saldo / soma(rec))} da receita</b></div>`,
      {sub: 'Por competência: cada conta entra no mês do vencimento. Valores em R$ mil.'});
  })();

  // ---------- meia-rosca do mês corrente
  (function () {
    const doMes = escola.filter(c => c.vencimento.slice(0, 7) === chave(mesRef));
    const tot = soma(doMes, 'valor'), pago = soma(doMes.filter(c => c.situacao === 'Paga'), 'valor');
    const p = tot ? pago / tot : 0;
    $('#finGauge').innerHTML = card(`Contas de ${MESES[mesRef - 1]}`,
      `<div style="text-align:center">${grafMeiaRosca(p, {tam: 300, tip1: `Pago: <b>${brl(pago)}</b>`, tip2: `Pendente: <b>${brl(tot - pago)}</b>`})}
        <div style="font-size:34px;font-weight:800;color:${COR.laranjaEsc};margin-top:4px">${pct(1 - p, 0)}</div>
        <div class="nota" style="margin-top:0">ainda pendente</div></div>
      <div class="saldo-box"><span><b style="color:${COR.verdeEsc}">Pago</b> ${brl(pago)}</span><span><b style="color:${COR.laranjaEsc}">Pendente</b> ${brl(tot - pago)}</span><span>Total ${brl(tot)}</span></div>`,
      {sub: `Posição em ${dataBR(HOJE)}`});
  })();

  // ---------- rosca por categoria (segue o filtro)
  function roscaCategorias(doFiltro) {
    const base = doFiltro.filter(c => c.plano !== 'Mercadorias para revenda');
    let usar = base.filter(c => c.situacao === 'Paga'), rotulo = 'pagas';
    if (!usar.length) { usar = base; rotulo = 'lançadas'; }
    const por = {};
    usar.forEach(c => por[c.plano] = (por[c.plano] || 0) + c.valor);
    const ord = Object.entries(por).sort((a, b) => b[1] - a[1]);
    const itens = ord.slice(0, 8).map(([nome, valor], i) => ({nome, valor, cor: PALETA[i]}));
    const resto = soma(ord.slice(8), x => x[1]);
    if (resto) itens.push({nome: 'Outras', valor: resto, cor: '#cbd5e1'});
    const tot = soma(itens, 'valor');
    $('#finRosca').innerHTML = card(`Despesas ${rotulo} por categoria`, itens.length ? `<div class="rosca-box">
      ${grafRosca(itens, {centro: pct(itens[0].valor / tot, 0), sub: itens[0].nome.split(' ')[0].toLowerCase()})}
      <div class="lista">${itens.map(c => `<div><span><i style="background:${c.cor}"></i>${c.nome}</span><b>${brl(c.valor)}<small>${pct(c.valor / tot, 0)}</small></b></div>`).join('')}</div></div>` : vazio('Sem contas no período.'),
      {sub: nomeFiltro()});
  }

  // ---------- receita por segmento (empilhado)
  (function () {
    const ms = F.receitas.filter(r => !r.previsto);
    $('#finSeg').innerHTML = card('Receita líquida por segmento',
      legenda(SEGMENTOS.map(s => ({nome: s, cor: COR_SEG[s]}))) +
      grafBarras({W: LG.finMetade, rotulos: ms.map(r => mesCurto(r.mes)), empilhado: true, total: true, h: 280, fmtValor: v => num(v / 1e3), fmtEixo: eixoMil,
        rotuloTip: i => mesDe(ms[i].mes), series: SEGMENTOS.map(s => ({nome: s, cor: COR_SEG[s], valores: ms.map(r => r.segmentos[s] || 0)}))}),
      {sub: 'Repasse líquido dividido pela participação de cada segmento nas mensalidades. Total em R$ mil.'});
  })();

  // ---------- fluxo de caixa
  (function () {
    const iProj = F.meses.findIndex(m => m.status !== 'fechado');
    const ent = soma(F.meses, 'entradas'), sai = soma(F.meses, 'saidas'), fim = F.meses[11].acumulado;
    $('#finFluxo').innerHTML = card('Fluxo de caixa', `<div class="lado"><div>
        ${legenda([{nome: 'Superávit no mês', cor: COR.verde}, {nome: 'Déficit no mês', cor: COR.verm}, {nome: 'Projeção', cor: COR.cinza, tipo: 'hach'}])}
        ${grafCascata({W: LG.finLado, rotulos: F.meses.map(m => m.rotulo), valores: F.meses.map(m => m.resultado), acumulado: F.meses.map(m => m.acumulado), projetarDe: iProj, mostrarTotal: true})}</div>
      <div class="mini-kpis">
        <div class="mini" style="--c:${COR.verdeEsc}"><span>Entradas no ano</span><strong>${brl(ent)}</strong><small>realizado + previsão</small></div>
        <div class="mini" style="--c:${COR.vermEsc}"><span>Saídas no ano</span><strong>${brl(sai)}</strong><small>do mês atual em diante, orçamento</small></div>
        <div class="mini" style="--c:${fim >= 0 ? COR.verdeEsc : COR.vermEsc}"><span>Saldo projetado em dezembro</span><strong>${brlSinal(fim)}</strong><small>acumulado do ano</small></div>
      </div></div>
      <p class="nota">Nos meses que ainda não fecharam a saída usa o orçamento, que é teto (limite máximo de gasto), não previsão. Novembro e dezembro trazem o 13º.</p>`,
      {sub: 'Resultado de cada mês e saldo acumulado (linha de baixo), em R$ mil', acoes: `<div class="seg-btns"><button class="on">Geral</button><button disabled title="Loja tem caixa próprio, fora do escopo da demo">Loja</button><button disabled title="Cantina tem caixa próprio, fora do escopo da demo">Cantina</button></div>`});
  })();

  // ---------- realizado x orçado (despesas e receitas)
  function blocoRo({id, titulo, real, orc, corReal, inverter, legReal}) {
    const iAnd = F.meses.findIndex(m => m.status === 'andamento');
    const realFech = soma(real.slice(0, nFech)), orcFech = soma(orc.slice(0, nFech)), orcAno = soma(orc);
    const desvio = orcFech ? realFech / orcFech - 1 : 0;
    const bom = inverter ? desvio >= 0 : desvio <= 0;
    const status = Math.abs(desvio) < 0.005 ? ['NO ALVO', 'medio'] : desvio > 0 ? [inverter ? 'ACIMA DO ORÇADO' : 'ACIMA DO ORÇADO', bom ? 'bom' : 'ruim'] : ['ABAIXO DO ORÇADO', bom ? 'bom' : 'ruim'];
    const valoresReal = real.map((v, i) => i <= iAnd ? v : null);
    const rotTip = i => {
      if (valoresReal[i] == null) return F.meses[i].rotulo + ' (futuro)';
      const dv = valoresReal[i] - orc[i];
      return `${F.meses[i].rotulo} · ${dv >= 0 ? '+' : '−'}${brl(Math.abs(dv))} (${pct(dv / orc[i])}) ${inverter ? (dv >= 0 ? 'acima' : 'abaixo') : (dv >= 0 ? 'estouro' : 'economia')}`;
    };
    return card(titulo, `<div class="lado"><div>
        ${legenda([{nome: legReal, cor: corReal}, {nome: 'Orçado', cor: COR.cinza}, {nome: 'Mês em andamento / futuro', cor: COR.cinza, tipo: 'hach'}])}
        ${grafBarras({W: LG.finLado, rotulos: F.meses.map(m => m.rotulo), h: 270, fmtValor: brl, rotuloTip: rotTip,
          hachurar: (i, j) => i === iAnd || (j === 1 && i > iAnd),
          series: [{nome: legReal, cor: corReal, valores: valoresReal}, {nome: 'Orçado', cor: COR.cinza, valores: orc}]})}</div>
      <div class="mini-kpis">
        <div class="mini"><span>Orçado no ano</span><strong>${brl(orcAno)}</strong><small>só referência</small></div>
        <div class="mini"><span>Orçado até ${MESES[nFech - 1]}</span><strong>${brl(orcFech)}</strong><small>${nFech} meses fechados</small></div>
        <div class="mini" style="--c:${corReal}"><span>Realizado até ${MESES[nFech - 1]}</span><strong>${brl(realFech)}</strong><small>${desvio >= 0 ? '+' : ''}${pct(desvio)} vs orçado</small></div>
        <div class="mini"><span>Situação</span><strong>${pill(status[0], status[1])}</strong></div>
      </div></div>`, {sub: inverter ? 'Receita acima do orçado é bom (verde).' : 'O orçamento é teto: gastar acima é estouro (vermelho).'});
  }

  function tabelaContas() {
    const realPorConta = {};
    escola.forEach(c => { if (+c.vencimento.slice(5, 7) <= nFech) realPorConta[c.plano] = (realPorConta[c.plano] || 0) + c.valor; });
    const grupos = ['Pessoal', 'Despesas gerais'].map(g => {
      const linhas = F.orcamento.filter(o => o.grupo === g).map(o => {
        const teto = soma(o.teto.slice(0, nFech)), real = realPorConta[o.conta] || 0;
        return {conta: o.conta, teto, real, var: real - teto, varp: teto ? real / teto - 1 : 0};
      }).sort((a, b) => b.real - a.real);
      const t = {teto: soma(linhas, 'teto'), real: soma(linhas, 'real')};
      return {g, linhas, t};
    });
    const linha = (r, total) => `<tr class="${total ? 'grupo' : ''}"><td>${total ? `<b>${r.conta}</b>` : r.conta}</td><td class="n">${brlInt(r.teto)}</td><td class="n">${brlInt(r.real)}</td>
      <td class="n">${pill((r.var >= 0 ? '+' : '−') + brl(Math.abs(r.var)), r.var > 0 ? 'ruim' : 'bom')}</td><td>${divergente(r.varp, 0.25)}</td><td class="n" style="color:${r.varp > 0 ? COR.vermEsc : COR.verdeEsc}">${r.varp >= 0 ? '+' : ''}${pct(r.varp)}</td></tr>`;
    return `<details class="metodo"><summary>Ver por conta (acumulado de janeiro a ${MESES[nFech - 1]})</summary><div class="tabela-wrap"><table>
      <thead><tr><th>Conta</th><th class="n">Teto</th><th class="n">Realizado</th><th class="n">Variação</th><th>Economia ← | → estouro</th><th class="n">%</th></tr></thead>
      <tbody>${grupos.map(gr => linha({conta: gr.g, teto: gr.t.teto, real: gr.t.real, var: gr.t.real - gr.t.teto, varp: gr.t.real / gr.t.teto - 1}, true) + gr.linhas.map(r => linha(r)).join('')).join('')}</tbody>
    </table></div></details>`;
  }

  $('#finRoDesp').innerHTML = blocoRo({titulo: 'Despesas: realizado x orçado', real: F.meses.map(m => m.despesa_real), orc: F.meses.map(m => m.orcado),
    corReal: COR.verm, legReal: 'Realizado'}).replace('</section>', tabelaContas() + '</section>');
  $('#finRoRec').innerHTML = blocoRo({titulo: 'Receitas: realizado x orçado', real: F.meses.map(m => m.entradas), orc: F.meses.map(m => m.receita_orcada),
    corReal: COR.azul, legReal: 'Realizado', inverter: true});

  // ---------- drill-down das despesas: plano > subclassificação > favorecido > contas
  const drill = (function () {
    let status = 'todas', ordem = 'valor', busca = '', atual = [];
    $('#finDrill').innerHTML = card('Despesas em detalhe', `
      <div class="drill-barra">
        <div class="seg-btns" id="drStatus"><button data-v="todas" class="on">Todas</button><button data-v="Paga">Pagas</button><button data-v="Pendente">Pendentes</button></div>
        <div class="seg-btns" id="drOrdem"><button data-v="valor" class="on">Maior valor</button><button data-v="nome">A → Z</button></div>
        <input type="search" class="campo" id="drBusca" placeholder="Buscar conta, favorecido, documento...">
        <button class="link" id="drAbrir">Expandir tudo</button><button class="link" id="drFechar">Recolher tudo</button>
      </div><div id="drCorpo"></div>`, {sub: 'Clique em cada nível para abrir. Contas da escola; loja e cantina ficam fora.'});
    const grupo = (lista, campo) => {
      const g = {};
      lista.forEach(c => (g[c[campo]] = g[c[campo]] || []).push(c));
      return Object.entries(g).map(([nome, itens]) => ({nome, itens, total: soma(itens, 'valor'), pago: soma(itens.filter(c => c.situacao === 'Paga'), 'valor')}))
        .sort((a, b) => ordem === 'nome' ? a.nome.localeCompare(b.nome, 'pt-BR') : b.total - a.total);
    };
    function linhas(nivel, lista, totalGeral) {
      const campos = ['plano', 'sub', 'favorecido'];
      const grupos = grupo(lista, campos[nivel]);
      const maior = Math.max(...grupos.map(g => g.total), 1);
      return grupos.map((g, i) => {
        const filhos = nivel < 2 ? linhas(nivel + 1, g.itens, totalGeral) : folhas(g.itens);
        return `<div class="dl"><div class="dl-l"><span class="seta">▶</span><span class="dl-n">${nivel === 0 ? `<span style="color:var(--mudo)">${i + 1}.</span> ` : ''}${esc(g.nome)}<small>${g.itens.length} ${g.itens.length === 1 ? 'conta' : 'contas'}</small></span>
          <div class="dl-b" data-tip="${esc(`Pago ${brl(g.pago)} · pendente ${brl(g.total - g.pago)}`)}"><div style="width:${g.pago / maior * 100}%;background:${COR.verde}"></div><div style="width:${(g.total - g.pago) / maior * 100}%;background:#fdba74"></div></div>
          <span class="dl-v">${brlCheio(g.total)}</span><span class="dl-p">${pct(g.total / totalGeral)}</span><span class="dl-p">${pct(g.pago / g.total, 0)} pago</span></div>
          <div class="dl-filhos">${filhos}</div></div>`;
      }).join('');
    }
    function folhas(itens) {
      return `<div class="dl-folhas tabela-wrap"><table><thead><tr><th>Vencimento</th><th>Situação</th><th>Documento</th><th>Baixa</th><th class="n">Valor</th></tr></thead><tbody>${
        itens.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map(c => {
          const atrasada = c.situacao === 'Pendente' && c.vencimento < HOJE;
          return `<tr><td>${dataBR(c.vencimento)}</td><td>${pill(c.situacao, c.situacao === 'Paga' ? 'bom' : 'medio')}${atrasada ? '<span class="tag-tx atr">ATRASADA</span>' : ''}</td>
            <td>${esc(c.documento)}${c.parcela ? `<span class="tag-tx">parcela ${c.parcela}</span>` : ''}<span class="tag-tx" data-tip="Empresa pagadora">${c.empresa.split(' ')[1]}</span></td>
            <td>${dataBR(c.baixa)}</td><td class="n">${brlCheio(c.valor)}</td></tr>`;
        }).join('')}</tbody></table></div>`;
    }
    function desenhar() {
      let lista = atual.filter(c => c.plano !== 'Mercadorias para revenda');
      if (status !== 'todas') lista = lista.filter(c => c.situacao === status);
      if (busca) {
        const b = busca.toLowerCase();
        lista = lista.filter(c => [c.plano, c.sub, c.favorecido, c.documento].some(x => x.toLowerCase().includes(b)));
      }
      const total = soma(lista, 'valor');
      $('#drCorpo').innerHTML = lista.length ? `<div class="drill-total" id="drTot"><span>Total de despesas (filtro atual: ${nomeFiltro()})</span><b>${brlCheio(total)} · ${num(lista.length)} contas</b></div><div id="drArvore">${linhas(0, lista, total)}</div>` : vazio('Nenhuma conta para esse filtro.');
    }
    $('#drStatus').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; status = b.dataset.v; $$('#drStatus button').forEach(x => x.classList.toggle('on', x === b)); desenhar(); });
    $('#drOrdem').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ordem = b.dataset.v; $$('#drOrdem button').forEach(x => x.classList.toggle('on', x === b)); desenhar(); });
    $('#drBusca').addEventListener('input', e => { busca = e.target.value.trim(); desenhar(); });
    $('#drAbrir').addEventListener('click', () => $$('#drCorpo .dl').forEach(x => x.classList.add('aberto')));
    $('#drFechar').addEventListener('click', () => $$('#drCorpo .dl').forEach(x => x.classList.remove('aberto')));
    $('#drCorpo').addEventListener('click', e => {
      if (e.target.closest('#drTot')) { $('#drArvore').hidden = !$('#drArvore').hidden; return; }
      const l = e.target.closest('.dl-l');
      if (l) l.parentElement.classList.toggle('aberto');
    });
    return {render(lista) { atual = lista; desenhar(); }};
  })();

  // ---------- empréstimos
  (function () {
    const ativos = F.emprestimos.filter(e => e.parcelas.some(p => !p.pago));
    let sel = 'todos';
    function desenhar() {
      const lista = sel === 'todos' ? ativos : ativos.filter(e => e.nome === sel);
      const parcelas = lista.flatMap(e => e.parcelas.map(p => ({...p, contrato: e.nome})));
      const pago = soma(parcelas.filter(p => p.pago), 'valor'), pend = soma(parcelas.filter(p => !p.pago), 'valor');
      const prox = parcelas.filter(p => !p.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      const proxData = prox.length ? prox[0].vencimento : null;
      const proxValor = soma(prox.filter(p => p.vencimento === proxData), 'valor');
      const termino = prox.length ? prox[prox.length - 1].vencimento : null;
      const faltam = termino ? Math.max(0, Math.round(difDias(HOJE, termino) / 30.4)) : 0;
      const contratado = soma(lista, 'valor_contratado');
      const ini = lista.map(e => e.parcelas[0].vencimento).sort()[0], fim = lista.map(e => e.parcelas[e.parcelas.length - 1].vencimento).sort().pop();
      const span = difDias(ini, fim) || 1;
      const pos = d => difDias(ini, d) / span * 100;
      $('#empCorpo').innerHTML = `
        <div class="kpis k4">
          ${kpi({rotulo: 'Pago', valor: brl(pago), cor: COR.verdeEsc, sub: `${parcelas.filter(p => p.pago).length} parcelas`})}
          ${kpi({rotulo: 'Pendente', valor: brl(pend), cor: COR.vermEsc, sub: `${prox.length} parcelas`})}
          ${kpi({rotulo: 'Próxima parcela', valor: brl(proxValor), cor: COR.laranja, sub: proxData ? dataBR(proxData) : '—', tip: sel === 'todos' ? prox.filter(p => p.vencimento === proxData).map(p => `${p.contrato}: ${brl(p.valor)}`).join('<br>') : ''})}
          ${kpi({rotulo: 'Previsão de término', valor: termino ? dataBR(termino).slice(3) : '—', cor: COR.ink, sub: `faltam ~${faltam} meses`})}
        </div>
        <div class="grid g12">
          <div class="card" style="text-align:center"><h3 style="text-align:left">Quitado</h3>${grafMeiaRosca(pago / (pago + pend), {tam: 260, tip1: 'Pago ' + brl(pago), tip2: 'Pendente ' + brl(pend), corResto: COR.verm})}
            <div style="font-size:30px;font-weight:800;color:${COR.verdeEsc}">${pct(pago / (pago + pend), 0)}</div><p class="nota" style="margin-top:0">valor contratado ${brl(contratado)}</p></div>
          <div class="card"><h3>Linha do tempo dos contratos</h3><p class="nota" style="margin:2px 0 14px">Verde já pago, vermelho a pagar. Passe o mouse para ver o período.</p>
            <div class="emp-tl">${lista.map(e => {
              const a = e.parcelas[0].vencimento, b = e.parcelas[e.parcelas.length - 1].vencimento;
              const pagas = e.parcelas.filter(p => p.pago), ult = pagas.length ? pagas[pagas.length - 1].vencimento : a;
              return `<div class="emp-l"><span>${esc(e.nome)}</span><div class="emp-t" data-tip="${esc(`<b>${e.nome}</b><br>${dataBR(a)} a ${dataBR(b)}<br>${pagas.length} de ${e.n_parcelas} parcelas pagas<br>Pago ${brl(soma(pagas, 'valor'))} · falta ${brl(soma(e.parcelas.filter(p => !p.pago), 'valor'))}`)}">
                <div style="left:${pos(a)}%;width:${Math.max(0, pos(ult) - pos(a))}%;background:${COR.verde};border-radius:5px 0 0 5px"></div>
                <div style="left:${pos(ult)}%;width:${pos(b) - pos(ult)}%;background:${COR.verm};border-radius:0 5px 5px 0"></div></div></div>`;
            }).join('')}</div>
            <div class="emp-eixo" style="margin-top:8px"><span></span><div><span>${dataBR(ini).slice(3)}</span><span>hoje · ${dataBR(HOJE).slice(3)}</span><span>${dataBR(fim).slice(3)}</span></div></div>
          </div>
        </div>`;
    }
    $('#finEmp').innerHTML = card('Empréstimos e financiamentos', '<div id="empCorpo"></div>', {
      sub: 'Só contratos com parcelas em aberto',
      acoes: `<select class="campo" id="empSel"><option value="todos">Total consolidado</option>${ativos.map(e => `<option>${esc(e.nome)}</option>`).join('')}</select>`});
    $('#empSel').addEventListener('change', e => { sel = e.target.value; desenhar(); });
    desenhar();
  })();

  // ---------- calendário de vencimentos
  (function () {
    let mes = mesRef;
    function desenhar() {
      const doMes = escola.filter(c => +c.vencimento.slice(5, 7) === mes);
      const porDia = {};
      doMes.forEach(c => (porDia[+c.vencimento.slice(8, 10)] = porDia[+c.vencimento.slice(8, 10)] || []).push(c));
      const pulo = (new Date(ano, mes - 1, 1).getDay() + 6) % 7, dias = new Date(ano, mes, 0).getDate();
      let s = '<div class="cal">' + ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(x => `<div class="cal-s">${x}</div>`).join('');
      for (let i = 0; i < pulo; i++) s += '<div class="cal-d vazio"></div>';
      for (let d = 1; d <= dias; d++) {
        const itens = porDia[d] || [], v = soma(itens, 'valor');
        const pend = itens.some(c => c.situacao === 'Pendente');
        const hoje = chave(mes) + '-' + String(d).padStart(2, '0') === HOJE;
        s += `<button class="cal-d ${itens.length ? (pend ? 'pendente' : 'pago') : ''} ${hoje ? 'hoje' : ''}" ${itens.length ? `data-dia="${d}"` : 'disabled'}>
          <span class="n">${d}</span>${itens.length ? `<span><b>${brl(v).replace('R$ ', '')}</b><br><small>${itens.length} ${itens.length > 1 ? 'contas' : 'conta'}</small></span>` : ''}</button>`;
      }
      const tot = soma(doMes, 'valor'), pendM = soma(doMes.filter(c => c.situacao === 'Pendente'), 'valor');
      $('#calCorpo').innerHTML = s + '</div>' + `<div class="saldo-box"><span>${MESES[mes - 1]}: ${num(doMes.length)} contas</span><span>pago ${brl(tot - pendM)}</span><span style="color:${COR.laranjaEsc}">a pagar ${brl(pendM)}</span></div>`;
      $('#calTitulo').textContent = MESES[mes - 1].replace(/^./, c => c.toUpperCase()) + ' de ' + ano;
      $('#calCorpo').onclick = e => {
        const b = e.target.closest('[data-dia]');
        if (!b) return;
        abrirDia(chave(mes) + '-' + String(b.dataset.dia).padStart(2, '0'), porDia[+b.dataset.dia]);
      };
    }
    function abrirDia(dia, itens) {
      let f = 'todas';
      const html = () => {
        const lista = f === 'todas' ? itens : itens.filter(c => c.situacao === f);
        const n = s => itens.filter(c => c.situacao === s).length;
        return `<h3>${dataBR(dia)}</h3><p class="nota">${itens.length} contas · ${brlCheio(soma(itens, 'valor'))}</p>
          <div class="seg-btns" style="margin:12px 0" id="latF"><button data-v="todas" class="${f === 'todas' ? 'on' : ''}">Todas (${itens.length})</button><button data-v="Paga" class="${f === 'Paga' ? 'on' : ''}">Pagas (${n('Paga')})</button><button data-v="Pendente" class="${f === 'Pendente' ? 'on' : ''}">Pendentes (${n('Pendente')})</button></div>
          ${lista.map(c => `<div class="lat-item"><span><b>${esc(c.favorecido)}</b><br><small>${esc(c.plano)} · ${esc(c.sub)}</small></span><span style="text-align:right"><b>${brlCheio(c.valor)}</b><br>${pill(c.situacao, c.situacao === 'Paga' ? 'bom' : (dia < HOJE ? 'ruim' : 'medio'))}</span></div>`).join('')}`;
      };
      abrirLateral(html());
      $('#lateralCorpo').onclick = e => { const b = e.target.closest('#latF button'); if (b) { f = b.dataset.v; $('#lateralCorpo').innerHTML = html(); } };
    }
    $('#finCal').innerHTML = card('Calendário de vencimentos', '<div id="calCorpo"></div>', {
      sub: 'Verde: tudo pago · laranja: tem pendência · contorno: hoje. Clique num dia para ver as contas.',
      acoes: `<div class="cal-nav"><button id="calAnt" aria-label="Mês anterior">‹</button><b id="calTitulo"></b><button id="calProx" aria-label="Próximo mês">›</button></div>`});
    $('#calAnt').addEventListener('click', () => { if (mes > 1) { mes--; desenhar(); } });
    $('#calProx').addEventListener('click', () => { if (mes < 12) { mes++; desenhar(); } });
    desenhar();
  })();

  // ---------- LTV, unit economics e coorte
  (function () {
    const L = F.ltv, U = F.ue, C = F.coorte;
    const maxDist = Math.max(...L.distribuicao.map(d => d.alunos));
    const ltv = card('LTV (valor do aluno)', `<div class="kpis k2" style="grid-template-columns:1fr 1fr">
        ${kpi({rotulo: 'Permanência média', valor: num(L.tempo_medio_anos, 1) + ' anos', cor: COR.roxoEsc})}
        ${kpi({rotulo: 'Ticket anual', valor: brl(L.ticket_anual), cor: COR.cianoEsc})}
        ${kpi({rotulo: 'LTV bruto', valor: brl(L.ltv_bruto), cor: COR.verdeEsc})}
        ${kpi({rotulo: 'LTV líquido', valor: brl(L.ltv_liquido), cor: COR.verdeEsc, sub: 'sem a taxa da plataforma'})}</div>
      <details class="metodo"><summary>Como é calculado</summary><p>Permanência média de quem já saiu da escola (formou, evadiu ou não renovou), multiplicada pelo ticket anual atual. A distribuição abaixo é de quantos anos de casa têm os ${num(L.n_alunos)} alunos ativos.</p>
      ${barrasH(L.distribuicao.map(d => ({nome: d.anos + (d.anos > 1 ? ' anos' : ' ano'), valor: d.alunos, cor: COR.roxo})), {max: maxDist, fmt: v => num(v) + ' alunos'})}</details>`,
      {sub: `${num(L.n_alunos)} alunos ativos`});
    const ratioCor = U.status === 'saudável' ? 'bom' : U.status === 'atenção' ? 'medio' : 'ruim';
    const ue = card('Unit economics', `<div class="kpis" style="grid-template-columns:1fr 1fr">
        ${kpi({rotulo: 'LTV', valor: brl(U.ltv), cor: COR.verdeEsc, sub: `teto ${brl(U.ltv_teto)} (${U.anos_teto} anos)`})}
        ${kpi({rotulo: 'CAC', valor: brlInt(U.cac), cor: COR.vermEsc, sub: `${brl(U.marketing_ano)} / ${U.novos_ano} novos`})}
        ${kpi({rotulo: 'Payback (meses)', valor: num(U.payback_meses, 1), cor: COR.laranjaEsc, sub: 'CAC ÷ ticket mensal'})}
        ${kpi({rotulo: 'LTV / CAC', valor: num(U.ltv_cac, 1) + 'x', cor: COR.ink, sub: pill(U.status, ratioCor) + ' referência: 3x'})}</div>
      <details class="metodo"><summary>Como é calculado</summary><p>CAC é o gasto de marketing do ano (projetado a partir dos meses fechados) dividido pelos alunos novos. Payback é quantos meses de mensalidade pagam esse custo. Acima de 3x LTV/CAC é considerado saudável.</p></details>`);
    const cor = v => `hsl(${Math.round(v * 120)},70%,${88 - v * 30}%)`;
    const max = Math.max(...C.matriz.map(m => m.celulas.length));
    const coorte = card('Retenção por safra', `<div class="kpis" style="grid-template-columns:repeat(${Object.keys(C.baseline).length},1fr)">
        ${Object.entries(C.baseline).map(([k, b]) => kpi({rotulo: `+${k} ${k === '1' ? 'ano' : 'anos'}`, valor: pct(b.media, 0), cor: COR.cianoEsc, sub: `${b.safras} safras${b.safras < 5 ? ' · amostra pequena' : ''}`})).join('')}</div>
      <details class="metodo"><summary>Ver matriz</summary><div class="tabela-wrap"><table class="coorte"><thead><tr><th>Safra</th><th class="n">Alunos</th>${Array.from({length: max}, (_, i) => `<th class="n">+${i + 1}</th>`).join('')}</tr></thead>
      <tbody>${C.matriz.map(m => `<tr><td>${m.safra}</td><td class="n">${m.n}</td>${Array.from({length: max}, (_, i) => m.celulas[i] != null ? `<td class="c" style="background:${cor(m.celulas[i])}">${pct(m.celulas[i], 0)}</td>` : '<td></td>').join('')}</tr>`).join('')}</tbody></table></div></details>`,
      {sub: 'Quanto de cada turma de entrada continua matriculada depois de N anos'});
    $('#finIndicadores').innerHTML = ltv + ue + coorte;
  })();

  // ---------- insights
  (function () {
    const I = F.insights;
    const ico = {alerta: '!', atencao: '⚠', positivo: '✓', neutro: 'i'};
    $('#finInsights').innerHTML = card('Insights', `<div class="grid g2" style="margin-top:0">${I.itens.map((x, i) => `
      <div class="insight"><div class="ic ${x.sinal}">${ico[x.sinal]}</div><div><span class="cat">${i + 1}. ${x.categoria}</span><p>${esc(x.texto)}</p></div></div>`).join('')}</div>`,
      {sub: `${I.disparados} de ${I.regras} análises encontraram algo · gerado em ${dataBR(I.gerado_em)}`});
  })();

  menuMeses();
  atualizarFiltrados();
}
