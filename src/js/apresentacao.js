// Modo apresentação: 14 slides num palco fixo de 2048x1536, escalado pra tela.
// Os gráficos daqui desenham num viewBox menor que o tamanho real (÷1,9) pra o texto sair grande no palco.

const DURACAO_SLIDE = 12000;
const PX = v => Math.round(v / 1.9);
const AP = {i: 0, timer: null, pausado: false, lista: []};

const pCard = (rotulo, cor, corpo, estilo = '') => `<div class="p-card" style="${estilo}"><div class="p-lbl"><i style="background:${cor}"></i>${rotulo}</div>${corpo}</div>`;
const pNum = (valor, cor, tam) => `<div class="p-num" style="color:${cor || '#0f172a'}${tam ? `;font-size:${tam}px` : ''}">${valor}</div>`;
const pNota = t => `<div class="p-nota">${t}</div>`;
const pBarraKV = (rot, valor, p, cor) => `<div class="p-kvb"><div><span>${rot}</span><b>${valor}</b></div>${barraProgresso([{v: Math.min(1, Math.max(0, p)), cor}], 20)}</div>`;

function dadosSlides() {
  const F = D.financeiro, ano = D.meta.ano, mesRef = +HOJE.slice(5, 7);
  const fech = F.meses.filter(m => m.status === 'fechado'), ult = fech[fech.length - 1];
  const contas = expandir(F.contas), escola = contas.filter(c => c.centro === 'Escola');
  const linhas = expandir(D.farol.ciclos[String(ano)].alunos), ativos = linhas.filter(r => r.ativo);
  return {F, ano, mesRef, fech, ult, contas, escola, linhas, ativos,
    recAno: soma(fech, 'entradas'), despAno: soma(fech, 'despesa_real'),
    nomeUlt: MESES[+ult.mes.slice(5) - 1], nomeMes: MESES[mesRef - 1]};
}

function slides() {
  const S = dadosSlides(), F = S.F, K = F.kpis_alunos;
  const fin = {grupo: 'Financeiro', cor: '#0d9488'}, acp = {grupo: 'Acompanhamento', cor: '#7c3aed'};
  const resAno = S.recAno - S.despAno;
  const doMes = S.escola.filter(c => c.vencimento.slice(0, 7) === HOJE.slice(0, 7));
  const totMes = soma(doMes, 'valor'), pagoMes = soma(doMes.filter(c => c.situacao === 'Paga'), 'valor');
  const lista = [];

  // 1. panorama consolidado
  lista.push({...fin, titulo: 'Panorama consolidado', sub: `${D.meta.escola}, ${S.nomeMes} de ${S.ano}`, corpo: () => {
    const ret = K.retidos, nov = K.novos;
    return `<div class="p-g" style="grid-template-rows:auto 1fr auto 1fr;gap:22px">
      <div class="p-grupo">Alunos ${S.ano}</div>
      <div class="p-g" style="grid-template-columns:1.6fr 1fr 1fr">
        ${pCard('Alunos matriculados', COR.ciano, `<div class="p-meio">${pNum(num(K.matriculados), '#0ea5e9', 150)}${pNota('Infantil, fundamental e médio')}
          <div style="margin-top:26px">${barraProgresso([{v: ret / (ret + nov), cor: COR.laranja}, {v: nov / (ret + nov), cor: COR.verde}], 22)}</div>
          <div class="p-nota"><b style="color:#c2410c">${num(ret)}</b> retidos (${pct(ret / (ret + nov))}) &nbsp; <b style="color:#15803d">${num(nov)}</b> novos (${pct(nov / (ret + nov))})</div></div>`)}
        ${pCard('Ticket médio', COR.roxo, `<div class="p-meio">${pNum(brlInt(K.ticket_medio), '#6d28d9', 96)}${pNota('por aluno ao mês')}</div>${pNota(`Equivale no ano a <b>${brlInt(K.ticket_medio * 12)}</b>`)}`)}
        ${pCard('Retenção', COR.laranja, `<div class="p-meio" style="align-items:center">${grafAnel(K.retencao, {tam: 320, esp: 36, cor: COR.laranja, centro: pct(K.retencao), sub: `${num(ret)} alunos retidos`})}</div>`)}
      </div>
      <div class="p-grupo">Resumo financeiro</div>
      <div class="p-g" style="grid-template-columns:1.15fr 1.15fr 1fr">
        ${pCard(`Resultado do ano (jan a ${S.nomeUlt.slice(0, 3)}/${S.ano})`, resAno >= 0 ? COR.verde : COR.verm, `${pNum(brlSinal(resAno), resAno >= 0 ? '#15803d' : '#b91c1c', 84)}${pNota(resAno >= 0 ? 'Receita acima da despesa no acumulado' : 'Despesa acima da receita no acumulado')}
          <div class="p-meio">${pBarraKV('Receita líquida', brl(S.recAno), 1, COR.verde)}${pBarraKV('Despesa (sem loja e cantina)', brl(S.despAno), S.despAno / S.recAno, COR.verm)}</div>`)}
        ${pCard(`Resultado de ${S.nomeUlt}`, S.ult.resultado >= 0 ? COR.verde : COR.verm, `${pNum(brlSinal(S.ult.resultado), S.ult.resultado >= 0 ? '#15803d' : '#b91c1c', 84)}${pNota('Receita menos despesa do mês')}
          <div class="p-meio">${pBarraKV('Receita', brl(S.ult.entradas), 1, COR.teal)}${pBarraKV('Despesa', brl(S.ult.despesa_real), S.ult.despesa_real / S.ult.entradas, COR.verm)}</div>`)}
        ${pCard('Contas a pagar', COR.laranja, `${pNum(brl(totMes - pagoMes), '#c2410c', 84)}${pNota(`saldo pendente de ${S.nomeMes}`)}
          <div class="p-meio" style="justify-content:flex-end">${barraProgresso([{v: pagoMes / totMes, cor: COR.verde}, {v: 1 - pagoMes / totMes, cor: COR.laranja}], 26)}
          <div class="p-nota" style="display:flex;justify-content:space-between"><span><b style="color:#15803d">${pct(pagoMes / totMes)}</b> pago</span><span><b style="color:#c2410c">${pct(1 - pagoMes / totMes)}</b> pendente</span></div></div>`)}
      </div></div>`;
  }});

  // 2. receita x despesas
  lista.push({...fin, titulo: 'Receita líquida x despesas', sub: `Mensal, janeiro a ${S.nomeUlt}`, corpo: () => {
    const ms = S.fech, res = ms.map(m => m.entradas - m.despesa_real);
    const positivos = res.filter(v => v > 0).length;
    const porPlano = {};
    S.escola.filter(c => +c.vencimento.slice(5, 7) <= ms.length).forEach(c => porPlano[c.plano] = (porPlano[c.plano] || 0) + c.valor);
    const maior = Object.entries(porPlano).sort((a, b) => b[1] - a[1])[0];
    return `<div class="p-g" style="grid-template-columns:1.75fr 1fr">
      <div class="p-card">${legenda([{nome: 'Receita líquida', cor: COR.verde, tipo: 'linha'}, {nome: 'Despesas', cor: COR.verm, tipo: 'linha'}])}
        ${grafLinhas({rotulos: ms.map(m => m.rotulo), W: PX(1100), h: PX(560), fmtY: eixoMil, fmtTip: brl, yMin: 8e5, series: [
          {nome: 'Receita', cor: COR.verde, valores: ms.map(m => m.entradas), rotular: true, fmtValor: v => num(v / 1e3)},
          {nome: 'Despesas', cor: COR.verm, valores: ms.map(m => m.despesa_real), rotular: true, abaixo: true, fmtValor: v => num(v / 1e3)}]})}
        <div class="p-lbl" style="margin:18px 0 4px"><i style="background:#94a3b8"></i>Resultado do mês (R$ mil)</div>
        ${grafBarras({rotulos: ms.map(m => m.rotulo), W: PX(1100), h: PX(330), valores: true, fmtValor: v => num(v / 1e3), fmtEixo: eixoMil, series: [
          {nome: 'Superávit', cor: COR.verde, valores: res.map(v => v >= 0 ? v : null)}, {nome: 'Déficit', cor: COR.verm, valores: res.map(v => v < 0 ? v : null)}]})}</div>
      <div class="p-g" style="grid-template-rows:repeat(4,1fr)">
        ${pCard('Receita acumulada', COR.verde, `${pNum(brl(S.recAno), '#15803d', 76)}${pNota(`média de ${brl(S.recAno / ms.length)} por mês`)}`)}
        ${pCard('Despesas acumuladas', COR.verm, `${pNum(brl(S.despAno), '#b91c1c', 76)}${pNota(`média de ${brl(S.despAno / ms.length)} por mês`)}`)}
        ${pCard('Resultado acumulado', resAno >= 0 ? COR.verde : COR.verm, `${pNum(brlSinal(resAno), resAno >= 0 ? '#15803d' : '#b91c1c', 76)}${pNota(`${positivos} de ${ms.length} meses no positivo`)}`)}
        ${pCard('Maior despesa do ano', COR.cinza, `${pNum(brl(maior[1]), '#0f172a', 76)}${pNota(maior[0])}`)}
      </div></div>`;
  }});

  // 3. fluxo de caixa
  lista.push({...fin, titulo: 'Fluxo de caixa', sub: `Resultado mensal e saldo acumulado, ${S.ano}`, corpo: () => {
    const iProj = F.meses.findIndex(m => m.status !== 'fechado');
    const realizado = S.fech[S.fech.length - 1].acumulado, projetado = soma(F.meses.slice(iProj), 'resultado'), fim = F.meses[11].acumulado;
    const pior = S.fech.reduce((a, m) => m.resultado < a.resultado ? m : a);
    const c = v => v >= 0 ? '#15803d' : '#b91c1c';
    return `<div class="p-g" style="grid-template-rows:auto 1fr">
      <div class="p-g" style="grid-template-columns:repeat(4,1fr);height:auto">
        ${pCard(`Realizado jan a ${S.nomeUlt.slice(0, 3)}`, COR.verde, pNum(brlSinal(realizado), c(realizado), 64) + pNota(`${S.fech.length} meses fechados`))}
        ${pCard(`Projetado ${S.nomeMes.slice(0, 3)} a dez`, COR.laranja, pNum(brlSinal(projetado), c(projetado), 64) + pNota('com o orçamento como teto'))}
        ${pCard('Saldo em dezembro', COR.ink, pNum(brlSinal(fim), c(fim), 64) + pNota('acumulado do ano'))}
        ${pCard('Pior mês realizado', COR.cinza, pNum(pior.rotulo, '#0f172a', 64) + pNota(`${brlSinal(pior.resultado)} no mês`))}
      </div>
      <div class="p-card">${legenda([{nome: 'Superávit', cor: COR.verde}, {nome: 'Déficit', cor: COR.verm}, {nome: 'Meses futuros', cor: COR.cinza, tipo: 'hach'}])}
        <div class="p-meio">${grafCascata({rotulos: F.meses.map(m => m.rotulo), valores: F.meses.map(m => m.resultado), acumulado: F.meses.map(m => m.acumulado), projetarDe: iProj, W: PX(1800), h: PX(760)})}</div></div>
    </div>`;
  }});

  // 4. despesas e saldo do mês
  lista.push({...fin, titulo: 'Despesas e saldo do mês', sub: S.nomeMes.replace(/^./, c => c.toUpperCase()) + ' de ' + S.ano, corpo: () => {
    let base = doMes.filter(c => c.situacao === 'Paga' && c.plano !== 'Mercadorias para revenda'), rot = 'pagas';
    if (!base.length) { base = doMes; rot = 'pendentes'; }
    const por = {};
    base.forEach(c => por[c.plano] = (por[c.plano] || 0) + c.valor);
    const ord = Object.entries(por).sort((a, b) => b[1] - a[1]);
    const itens = ord.slice(0, 8).map(([nome, valor], i) => ({nome, valor, cor: PALETA[i]}));
    const resto = soma(ord.slice(8), x => x[1]);
    if (resto) itens.push({nome: 'Outras', valor: resto, cor: '#cbd5e1'});
    const tot = soma(itens, 'valor'), p = pagoMes / totMes;
    return `<div class="p-g" style="grid-template-columns:1.35fr 1fr">
      ${pCard(`Despesas ${rot} por categoria`, COR.cinza, `<div class="p-meio"><div style="display:grid;grid-template-columns:420px 1fr;gap:44px;align-items:center">
        ${grafRosca(itens, {tam: 420, esp: 64, centro: pct(itens[0].valor / tot, 0), sub: 'em ' + itens[0].nome.split(' ')[0].toLowerCase()})}
        <div class="p-lista">${itens.map(c => `<div><div class="t"><span><i style="background:${c.cor}"></i>${c.nome}</span><b>${brl(c.valor)}</b></div>${barraProgresso([{v: c.valor / tot, cor: c.cor}], 8)}<small>${pct(c.valor / tot)}</small></div>`).join('')}</div></div></div>`)}
      ${pCard('Saldo a pagar do mês', COR.cinza, `<div class="p-meio" style="align-items:center">${grafMeiaRosca(p, {tam: 520, esp: 64})}
        <div style="font-size:110px;font-weight:800;color:#15803d;line-height:1;margin-top:10px">${pct(p)}</div><div class="p-nota">do mês já pago</div></div>
        <div class="p-kv"><span><i class="dot" style="background:#16a34a"></i>Pago</span><b style="color:#15803d">${brlCheio(pagoMes)}</b></div>
        <div class="p-kv"><span><i class="dot" style="background:#ea580c"></i>Pendente</span><b style="color:#c2410c">${brlCheio(totMes - pagoMes)}</b></div>
        <div class="p-kv"><span>Total do mês</span><b>${brlCheio(totMes)}</b></div>`)}
    </div>`;
  }});

  // 5. realizado x orçado
  lista.push({...fin, titulo: 'Realizado x orçado, despesas', sub: 'Ano de ' + S.ano, corpo: () => {
    const n = S.fech.length, real = F.meses.map((m, i) => i < n ? m.despesa_real : m.orcado), orc = F.meses.map(m => m.orcado);
    const rY = soma(real.slice(0, n)), oY = soma(orc.slice(0, n)), dif = rY - oY, acima = S.fech.filter(m => m.despesa_real > m.orcado).length;
    const W = PX(1800), padL = 64, padR = 10;
    return `<div class="p-g" style="grid-template-rows:auto 1fr">
      <div class="p-g" style="grid-template-columns:repeat(4,1fr);height:auto">
        ${pCard(`Realizado jan a ${S.nomeUlt.slice(0, 3)}`, COR.verm, pNum(brl(rY), '#b91c1c', 64) + pNota(`${n} meses fechados`))}
        ${pCard(`Orçado jan a ${S.nomeUlt.slice(0, 3)}`, COR.cinza, pNum(brl(oY), '#475569', 64) + pNota('mesmo período'))}
        ${pCard(dif > 0 ? 'Acima do orçado' : 'Abaixo do orçado', dif > 0 ? COR.verm : COR.verde, pNum((dif > 0 ? '+' : '−') + brl(Math.abs(dif)), dif > 0 ? '#b91c1c' : '#15803d', 64) + pNota(`${dif > 0 ? '+' : '−'}${pct(Math.abs(dif / oY))} · <b>${acima} de ${n}</b> meses acima`))}
        ${pCard('Orçamento anual', COR.cinza, pNum(brl(soma(orc)), '#475569', 64) + pNota(`${S.nomeMes.slice(0, 3)} a dez: <b>${brl(soma(orc.slice(n)))}</b>`))}
      </div>
      <div class="p-card">${legenda([{nome: 'Realizado', cor: COR.verm}, {nome: 'Orçado', cor: COR.cinza}, {nome: 'Meses futuros (realizado = orçado)', cor: COR.verm, tipo: 'hach'}])}
        ${grafBarras({rotulos: F.meses.map(m => m.rotulo), W, h: PX(640), valores: true, fmtValor: v => num(v / 1e6, 2), hachurarDe: n, padL, padR,
          series: [{nome: 'Realizado', cor: COR.verm, valores: real}, {nome: 'Orçado', cor: COR.cinza, valores: orc}]})}
        <div class="p-desvio" style="padding-left:${padL / W * 100}%;padding-right:${padR / W * 100}%">${F.meses.map((m, i) => {
          if (i >= n) return '<span></span>';
          const d = real[i] / orc[i] - 1;
          return `<span><i class="p-pill" style="background:${d > 0 ? '#fee2e2' : '#dcfce7'};color:${d > 0 ? '#b91c1c' : '#15803d'}">${d > 0 ? '+' : ''}${pct(d)}</i></span>`;
        }).join('')}</div></div>
    </div>`;
  }});

  // 6. calendário de vencimentos
  lista.push({...acp, titulo: 'Calendário de vencimentos', sub: `Contas a pagar, ${S.nomeMes}`, corpo: () => {
    const [a, m] = HOJE.split('-').map(Number), hojeD = +HOJE.slice(8);
    const porDia = {};
    doMes.forEach(c => (porDia[+c.vencimento.slice(8)] = porDia[+c.vencimento.slice(8)] || []).push(c));
    const maxDia = Math.max(...Object.values(porDia).map(l => soma(l, 'valor')));
    const pulo = (new Date(a, m - 1, 1).getDay() + 6) % 7, dias = new Date(a, m, 0).getDate();
    let cal = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map(x => `<div class="s">${x}</div>`).join('');
    for (let i = 0; i < pulo; i++) cal += '<div class="d v"></div>';
    for (let d = 1; d <= dias; d++) {
      const l = porDia[d] || [], v = soma(l, 'valor'), pend = l.some(c => c.situacao === 'Pendente');
      cal += `<div class="d ${l.length ? (pend ? 'pend' : 'ok') : ''} ${d === hojeD ? 'hoje' : ''}">${d === hojeD ? '<span class="hj">Hoje</span>' : ''}<span class="n">${d}</span>${l.length ? `<span><b>${brl(v).replace('R$ ', '')}</b><br><small style="font-size:18px;color:#64748b">${l.length} ${l.length > 1 ? 'contas' : 'conta'}</small></span><div class="mb" style="color:${pend ? '#b91c1c' : '#15803d'}"><i style="width:${v / maxDia * 100}%"></i></div>` : ''}</div>`;
    }
    const diasCom = Object.keys(porDia).map(Number), quitados = diasCom.filter(d => porDia[d].every(c => c.situacao === 'Paga'));
    const aVencer = doMes.filter(c => c.situacao === 'Pendente' && c.vencimento >= HOJE);
    const top = doMes.slice().sort((x, y) => y.valor - x.valor).slice(0, 4);
    const pendDias = diasCom.length - quitados.length;
    return `<div class="p-g" style="grid-template-columns:1.7fr 1fr">
      <div class="p-card"><div class="p-cal" style="grid-template-rows:auto repeat(${Math.ceil((pulo + dias) / 7)},1fr)">${cal}</div></div>
      <div class="p-g" style="grid-template-rows:auto auto 1fr auto">
        ${pCard('Total a vencer', COR.laranja, pNum(brl(soma(aVencer, 'valor')), '#c2410c', 72) + pNota(`${aVencer.length} contas de hoje até o fim do mês`))}
        ${pCard('Situação dos dias', COR.cinza, `${barraProgresso([{v: quitados.length / diasCom.length, cor: COR.verde}, {v: pendDias / diasCom.length, cor: COR.verm}], 20)}
          <div class="p-nota"><b style="color:#15803d">${quitados.length}</b> dias quitados · <b style="color:#b91c1c">${pendDias}</b> com pendência</div>`)}
        ${pCard('Maiores vencimentos', COR.cinza, top.map(c => `<div class="p-kv" style="font-size:22px;padding:10px 0"><span>dia ${+c.vencimento.slice(8)} · ${esc(c.favorecido.length > 26 ? c.favorecido.slice(0, 25) + '…' : c.favorecido)}</span><b style="font-size:26px">${brl(c.valor)}</b></div>`).join(''))}
        ${pCard('Até o fim do mês', COR.ink, pNota(`Do dia ${hojeD} ao dia ${dias}: <b>${brl(soma(aVencer, 'valor'))}</b> em ${aVencer.length} pagamentos`))}
      </div></div>`;
  }});

  // 7. panorama e ritmo
  lista.push({...acp, titulo: 'Panorama e ritmo', sub: `${D.meta.escola}, ciclo ${S.ano}`, corpo: () => {
    const at = S.ativos, n = at.length;
    const perf = p => at.filter(r => r.perfil === p).length;
    const nov = perf('Matrícula'), rem = perf('Rematrícula'), egr = perf('Egresso');
    const bruto = soma(S.linhas, 'bruto'), liq = soma(S.linhas, 'liquido');
    const R = D.rematricula, cores = ['#94a3b8', '#0ea5e9', '#db2777'], maxF = Math.max(...R.ritmo.map(r => r.total_final));
    const atual = R.ritmo.find(r => r.atual), ant = R.ritmo[R.ritmo.length - 2];
    return `<div class="p-g" style="grid-template-rows:1fr 1fr">
      <div class="p-g" style="grid-template-columns:1.25fr 1fr 1.1fr">
        ${pCard('Total de alunos', COR.ciano, `${pNum(num(n), '#0369a1', 130)}${pNota(`${SEGMENTOS.length} segmentos · ${new Set(at.map(r => r.turma)).size} turmas`)}
          <div class="p-meio" style="justify-content:flex-end">${barraProgresso([{v: rem / n, cor: COR_PERFIL['Rematrícula']}, {v: nov / n, cor: COR_PERFIL['Matrícula']}, {v: egr / n, cor: COR_PERFIL['Egresso']}], 24)}
          ${legenda([{nome: 'Veteranos', cor: COR_PERFIL['Rematrícula']}, {nome: 'Novos', cor: COR_PERFIL['Matrícula']}, {nome: 'Egressos', cor: COR_PERFIL['Egresso']}])}</div>`)}
        ${pCard('Perfil da base', COR.roxo, `<div class="p-meio">${[['Rematrículas', rem, COR_PERFIL['Rematrícula']], ['Novos', nov, COR_PERFIL['Matrícula']], ['Egressos', egr, COR_PERFIL['Egresso']]].map(([r, v, c]) =>
          `<div class="p-kv"><span>${r}</span><b style="color:${c}">${num(v)} <small style="font-size:22px;color:#64748b">${pct(v / n)}</small></b></div>`).join('')}</div>`)}
        ${pCard('Faturamento projetado', COR.verde, `<div class="p-meio">${pBarraKV('Bruto', brl(bruto), 1, COR.cinza)}${pBarraKV('Líquido', brl(liq), liq / bruto, COR.verde)}
          <div class="p-kv"><span>Desconto médio</span><b style="color:#c2410c">${pct(1 - liq / bruto)}</b></div></div>`)}
      </div>
      <div class="p-card"><div class="p-lbl"><i style="background:#db2777"></i>Ritmo da campanha no dia ${R.dia}</div>
        <div class="p-g" style="grid-template-columns:repeat(3,1fr);height:auto;flex:1">${R.ritmo.map((r, i) => {
          const dif = r.no_dia - atual.no_dia, ref = r.atual ? ant.total_final : r.total_final;
          return `<div class="p-ciclo" style="--c:${cores[i]}"><div class="t">Ciclo ${r.ano} ${r.atual ? '<span class="p-pill" style="background:#e0f2fe;color:#0369a1">Hoje</span>' : `<span class="p-pill" style="background:${dif > 0 ? '#fee2e2' : '#dcfce7'};color:${dif > 0 ? '#b91c1c' : '#15803d'}">${dif > 0 ? '+' : ''}${num(dif)}</span>`}</div>
            ${pNum(num(r.no_dia), cores[i], 96)}<div class="p-nota">${r.atual ? `${pct(r.no_dia / ant.total_final, 0)} do total final de ${ant.ano}` : `${pct(r.no_dia / r.total_final, 0)} do total final (${num(r.total_final)})`}</div>
            ${barraProgresso([{v: r.no_dia / maxF, cor: cores[i]}], 18)}</div>`;
        }).join('')}</div></div>
    </div>`;
  }});

  // 8. alunos por segmento
  lista.push({...acp, titulo: 'Alunos por segmento', sub: `Ciclo ${S.ano}, ${num(S.ativos.length)} alunos`, corpo: () => {
    const at = S.ativos, n = at.length, liqTot = soma(S.linhas, 'liquido');
    const seg = SEGMENTOS.map(s => { const g = at.filter(r => r.segmento === s); const l = soma(S.linhas.filter(r => r.segmento === s), 'liquido'); return {s, n: g.length, liq: l}; });
    const contra = S.linhas.filter(r => r.contraturno > 0);
    return `<div class="p-g" style="grid-template-rows:auto 1fr">
      <div class="p-card" style="padding:28px 42px">${legenda(SEGMENTOS.map(s => ({nome: s, cor: COR_SEG[s]})))}${barraProgresso(seg.map(x => ({v: x.n / n, cor: COR_SEG[x.s]})), 34)}</div>
      <div class="p-g" style="grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr">
        ${seg.map(x => pCard(x.s, COR_SEG[x.s], `<div style="position:absolute;top:36px;right:42px"><span class="p-pill" style="background:#f1f5f9;color:#475569">${pct(x.n / n)}</span></div>${pNum(num(x.n), COR_SEG[x.s], 110)}<div class="p-meio">
          <div class="p-kv"><span>Receita líquida</span><b>${brl(x.liq)}</b></div><div class="p-kv"><span>Ticket anual</span><b>${brlInt(x.liq / x.n)}</b></div></div>`, 'position:relative')).join('')}
        ${pCard('Contraturno', COR.teal, `${pNum(num(contra.filter(r => r.ativo).length), '#0d9488', 110)}<div class="p-meio"><div class="p-kv"><span>Receita</span><b>${brl(soma(contra, 'contraturno'))}</b></div><div class="p-kv"><span>Alunos do infantil e F1</span><b>${pct(contra.filter(r => r.ativo).length / (seg[0].n + seg[1].n))}</b></div></div>`)}
        <div class="p-card" style="background:#0f172a;color:#cbd5e1"><div class="p-lbl" style="color:#cbd5e1"><i style="background:#fff"></i>Total geral</div>${pNum(num(n), '#fff', 110)}<div class="p-meio">
          <div class="p-kv" style="border-color:#1e293b"><span>Turmas</span><b style="color:#fff">${new Set(at.map(r => r.turma)).size}</b></div><div class="p-kv" style="border-color:#1e293b"><span>Receita líquida</span><b style="color:#fff">${brl(liqTot)}</b></div>
          <div class="p-kv"><span>Desconto médio</span><b style="color:#fff">${pct(soma(S.linhas, 'descontos') / soma(S.linhas, 'bruto'))}</b></div></div></div>
      </div></div>`;
  }});

  // 9. top 15 turmas
  lista.push({...acp, titulo: 'Top 15 turmas por faturamento', sub: `Ciclo ${S.ano}`, corpo: () => {
    const t = {};
    S.linhas.forEach(r => { const x = t[r.turma] || (t[r.turma] = {turma: r.turma, seg: r.segmento, n: 0, liq: 0}); x.liq += r.liquido; if (r.ativo) x.n++; });
    const todas = Object.values(t).sort((a, b) => b.liq - a.liq), top = todas.slice(0, 15), max = top[0].liq;
    const totLiq = soma(todas, 'liq'), totN = soma(todas, 'n');
    const porAluno = todas.filter(x => x.n).sort((a, b) => b.liq / b.n - a.liq / a.n)[0];
    return `<div class="p-g" style="grid-template-columns:1.75fr 1fr">
      <div class="p-card">${legenda(SEGMENTOS.map(s => ({nome: s, cor: COR_SEG[s]})))}<div class="p-rank">${top.map((x, i) => `<div><span class="r">${i + 1}</span><span class="nm">${x.turma}</span>
        <div class="b"><div style="width:${x.liq / max * 100}%;background:${COR_SEG[x.seg]}"></div></div><span class="v"><b>${brl(x.liq)}</b><small>${x.n} al · ${brlInt(x.liq / x.n)}/al</small></span></div>`).join('')}</div></div>
      <div class="p-g" style="grid-template-rows:1fr 1fr auto 1fr">
        ${pCard('Soma do top 15', COR.verde, pNum(brl(soma(top, 'liq')), '#15803d', 72) + pNota(`${pct(soma(top, 'liq') / totLiq)} do faturamento`))}
        ${pCard('Alunos no top 15', COR.ciano, pNum(num(soma(top, 'n')), '#0369a1', 72) + pNota(`${pct(soma(top, 'n') / totN)} da base`))}
        ${pCard('Turmas por segmento', COR.cinza, SEGMENTOS.map(s => `<div class="p-kv" style="font-size:22px;padding:8px 0"><span><i class="dot" style="background:${COR_SEG[s]}"></i>${s}</span><b style="font-size:28px">${todas.filter(x => x.seg === s).length}</b></div>`).join(''))}
        ${pCard('Maior valor por aluno', COR.roxo, pNum(brlInt(porAluno.liq / porAluno.n), '#6d28d9', 72) + pNota(porAluno.turma))}
      </div></div>`;
  }});

  // 10. ticket e resumo executivo
  lista.push({...acp, titulo: 'Ticket e resumo executivo', sub: `Ciclo ${S.ano}`, corpo: () => {
    const L = S.linhas, at = S.ativos, parc = soma(L, 'parcelas');
    const tb = soma(L, r => r.mens_bruto * r.parcelas) / parc, tl = soma(L, r => r.mensal * r.parcelas) / parc;
    const turmas = new Set(at.map(r => r.turma)).size;
    const perf = p => at.filter(r => r.perfil === p).length;
    const bruto = soma(L, 'bruto'), liq = soma(L, 'liquido');
    return `<div class="p-g" style="grid-template-columns:1fr 1fr">
      ${pCard('Ticket médio mensal', COR.roxo, `<div class="p-meio">${pBarraKV('Mensalidade cheia', brlInt(tb), 1, COR.cinza)}${pBarraKV('Desconto médio', '−' + brlInt(tb - tl), (tb - tl) / tb, COR.laranja)}${pBarraKV('Mensalidade com desconto', brlInt(tl), tl / tb, COR.roxo)}
        <div style="display:grid;grid-template-columns:1fr auto;gap:30px;align-items:center;margin-top:30px"><div>${pNum(brlInt(tl * 12), '#6d28d9', 92)}${pNota('ticket líquido por ano')}</div>
        ${grafAnel((tb - tl) / tb, {tam: 240, esp: 28, cor: COR.laranja, centro: pct((tb - tl) / tb), sub: 'de desconto'})}</div></div>`)}
      ${pCard('Resumo executivo', COR.ink, `<div class="p-meio">
        <div class="p-kv"><span>Matriculados</span><b>${num(at.length)}</b></div>
        <div class="p-kv"><span>Turmas · média por turma</span><b>${turmas} · ${num(at.length / turmas, 1)}</b></div>
        <div style="margin:20px 0 4px" class="p-nota">Novos ${num(perf('Matrícula'))} · veteranos ${num(perf('Rematrícula'))} · egressos ${num(perf('Egresso'))}</div>
        ${barraProgresso([{v: perf('Matrícula') / at.length, cor: COR_PERFIL['Matrícula']}, {v: perf('Rematrícula') / at.length, cor: COR_PERFIL['Rematrícula']}, {v: perf('Egresso') / at.length, cor: COR_PERFIL['Egresso']}], 22)}
        <div style="margin-top:30px">${pBarraKV('Faturamento bruto', brl(bruto), 1, COR.cinza)}${pBarraKV('Faturamento líquido', brl(liq), liq / bruto, COR.verde)}</div></div>`)}
    </div>`;
  }});

  // 11-13. funil diário / semanal / mensal
  const leads = expandir(D.funil.leads).filter(l => l.funil === D.funil.funil_atual);
  const dow = (new Date(HOJE + 'T12:00:00').getDay() + 6) % 7, seg = somarDias(HOJE, -dow);
  const janelas = {
    dia: {titulo: 'Funil diário', sub: `${D.meta.escola}, ${['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][new Date(HOJE + 'T12:00:00').getDay()]}, ${dataBR(HOJE)}`,
      de: HOJE, ate: HOJE, rot: 'hoje', conv: 'Conversão do dia', ctx: 'Nesta semana', ctxDe: seg, ctxAte: HOJE, ctxConv: 'Conversão da semana'},
    semana: {titulo: 'Funil semanal', sub: `${D.meta.escola}, semana de ${diaMes(seg)} a ${diaMes(somarDias(seg, 6))}`,
      de: seg, ate: HOJE, rot: 'nesta semana', conv: 'Conversão da semana', ctx: 'Neste mês', ctxDe: HOJE.slice(0, 8) + '01', ctxAte: HOJE, ctxConv: 'Conversão do mês'},
    mes: {titulo: 'Funil mensal', sub: `${D.meta.escola}, ${MESES[+HOJE.slice(5, 7) - 1]} de ${HOJE.slice(0, 4)}`,
      de: HOJE.slice(0, 8) + '01', ate: HOJE, rot: 'neste mês', conv: 'Conversão do mês', ctx: 'Na campanha', ctxDe: D.meta.campanhas[String(D.meta.ano_proximo)], ctxAte: HOJE, ctxConv: 'Conversão da campanha'},
  };
  Object.values(janelas).forEach(J => lista.push({...acp, titulo: J.titulo, sub: J.sub, corpo: () => {
    const t = contarFunil(leads.filter(l => l.criado >= J.de && l.criado <= J.ate));
    const ctx = leads.filter(l => l.criado >= J.ctxDe && l.criado <= J.ctxAte);
    // mesma régua do funil: leads que entraram no período e quantos deles já matricularam
    const ctxMat = ctx.filter(l => l.matriculou).length;
    const conv = t[0] ? t[4] / t[0] : null;
    return `<div class="p-g" style="grid-template-columns:1fr 500px">
      ${pCard(`Etapas do funil ${J.rot}`, COR.cinza, `<div class="p-meio">${funilVisual(t, {grande: true})}</div>`)}
      <div class="p-g" style="grid-template-rows:repeat(3,1fr)">
        ${pCard(J.conv, COR.verde, `<div class="p-meio">${pNum(conv == null ? '—' : pct(conv), conv == null ? '#94a3b8' : '#15803d', 110)}${pNota(conv == null ? 'Aparece quando houver leads no período' : 'dos leads viraram matrícula')}</div>`)}
        ${pCard(J.ctx, COR.ciano, `<div class="p-kv"><span>Leads</span><b style="color:#0369a1">${num(ctx.length)}</b></div><div class="p-kv"><span>Já matricularam</span><b style="color:#15803d">${num(ctxMat)}</b></div>${pNota(`${J.ctxConv}: <b>${ctx.length ? pct(ctxMat / ctx.length) : '—'}</b>`)}`)}
        ${pCard('Base de dados', COR.laranja, `${pNota('Atualizada em')}${pNum(diaMes(HOJE), '#0f172a', 92)}<div style="margin-top:14px"><span class="p-pill" style="background:#dcfce7;color:#15803d">Em dia</span></div>`)}
      </div></div>`;
  }}));

  // 14. meta da campanha
  lista.push({...acp, titulo: 'Meta da campanha', sub: (() => { const P = planejamentoAtual(); return `${D.meta.escola}, campanha de ${diaMes(P.inicio)} a ${diaMes(P.fim)}`; })(), corpo: () => {
    const P = planejamentoAtual(), C = calcPlano(P), meta = C.novos;
    const mats = leads.filter(l => l.matriculou && l.matriculou >= P.inicio && l.matriculou <= P.fim);
    const feitas = mats.filter(l => l.matriculou <= HOJE).length, falta = Math.max(0, meta - feitas);
    const total = difDias(P.inicio, P.fim) + 1, pass = Math.max(0, Math.min(total, difDias(P.inicio, HOJE) + 1));
    const esperado = Math.round(meta * pass / total), abaixo = esperado - feitas;
    let uteis = 0;
    for (let d = somarDias(HOJE, 1); d <= P.fim; d = somarDias(d, 1)) { const w = new Date(d + 'T12:00:00').getDay(); if (w > 0 && w < 6) uteis++; }
    const corridos = Math.max(0, difDias(HOJE, P.fim)), semanas = Math.max(1, Math.ceil(corridos / 7));
    const meses = Math.max(1, (+P.fim.slice(0, 4) - +HOJE.slice(0, 4)) * 12 + (+P.fim.slice(5, 7) - +HOJE.slice(5, 7)) + 1);
    const conta = (de, ate) => mats.filter(l => l.matriculou >= de && l.matriculou <= ate).length;
    const ritmo = (r, v, nota) => `<div class="p-card" style="flex-direction:row;align-items:center;justify-content:space-between"><div><div class="p-lbl" style="margin:0"><i style="background:#8b5cf6"></i>${r}</div><div class="p-nota" style="margin-top:12px">${nota}</div></div><div class="p-num" style="font-size:150px;color:#6d28d9">${num(v)}</div></div>`;
    return `<div class="p-g" style="grid-template-columns:1.2fr 1fr">
      <div style="display:flex;flex-direction:column;justify-content:space-between;padding:8px 24px 8px 0">
        <div class="p-lbl"><i style="background:#ea580c"></i>Faltam para a meta</div>
        <div style="display:flex;align-items:baseline;gap:28px"><div class="p-num" style="font-size:300px;color:#ea580c;letter-spacing:-6px;line-height:.9">${num(falta)}</div><span style="font-size:36px;color:#64748b">matrículas</span></div>
        <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;font-size:34px"><span><b style="color:#15803d">${num(feitas)}</b> de <b>${num(meta)}</b> novas matrículas feitas</span>
          <span class="p-pill" style="font-size:26px;background:${abaixo > 0 ? '#fee2e2' : '#dcfce7'};color:${abaixo > 0 ? '#b91c1c' : '#15803d'}">${abaixo > 0 ? `${num(abaixo)} abaixo do ritmo esperado` : 'no ritmo ou acima'}</span></div>
        <div><div class="progresso"><span class="marca-t" style="left:${Math.min(1, esperado / meta) * 100}%">Esperado hoje: <b>${num(esperado)}</b></span>
          <div class="trilho"><div class="cheio" style="width:${Math.max(2, Math.min(100, feitas / meta * 100))}%"></div><div class="marca-p" style="left:${Math.min(1, esperado / meta) * 100}%"></div></div></div>
          <div class="eixo-p"><span>0</span><span>${pct(feitas / meta)} da meta</span><span>${num(meta)}</span></div></div>
        <div style="height:2px;background:#d6dde6"></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${[['Hoje', conta(HOJE, HOJE)], ['Nesta semana', conta(seg, HOJE)], ['Neste mês', conta(HOJE.slice(0, 8) + '01', HOJE)]].map(([r, v]) =>
          `<div><div style="font-size:24px;color:#64748b">${r}</div><div style="font-size:80px;font-weight:800;color:#0f172a;line-height:1">${num(v)}</div></div>`).join('')}</div>
      </div>
      <div class="p-g" style="grid-template-rows:auto 1fr 1fr 1fr">
        <div class="p-grupo">Ritmo necessário até ${diaMes(P.fim)}</div>
        ${ritmo('Por dia útil', Math.round(falta / Math.max(1, uteis)), `${num(uteis)} dias úteis restantes`)}
        ${ritmo('Por semana', Math.round(falta / semanas), `${num(semanas)} semanas restantes`)}
        ${ritmo('Por mês', Math.round(falta / meses), `${num(meses)} meses restantes`)}
      </div></div>`;
  }});

  return lista;
}

function escalarPalco() {
  const k = Math.min(innerWidth / 2048, innerHeight / 1536), p = $('#palco');
  p.style.transform = `scale(${k})`;
  p.style.left = (innerWidth - 2048 * k) / 2 + 'px';
  p.style.top = (innerHeight - 1536 * k) / 2 + 'px';
}

function mostrarSlide() {
  const n = AP.lista.length, s = AP.lista[AP.i], prox = AP.lista[(AP.i + 1) % n];
  let corpo;
  try { corpo = s.corpo(); } catch (e) { console.error(e); corpo = `<div class="carregando">Não foi possível montar este slide</div>`; }
  $('#palco').innerHTML = `
    <div class="p-h"><div><h1>${s.titulo}</h1><p>${s.sub}</p></div>
      <div class="p-hr"><span class="p-chip"><i style="background:${s.cor}"></i>${s.grupo}</span><span class="p-cont"><b>${String(AP.i + 1).padStart(2, '0')}</b> / ${String(n).padStart(2, '0')}</span></div></div>
    <div class="p-c">${corpo}</div>
    <div class="p-r" style="--dur:${DURACAO_SLIDE}ms"><div class="p-prog">${AP.lista.map((_, j) => `<button class="${j < AP.i ? 'feito' : j === AP.i ? 'atual' : ''}" data-i="${j}" aria-label="Ir para o slide ${j + 1}"></button>`).join('')}</div>
      <div class="p-prox">A seguir: <b>${prox.titulo}</b></div></div>`;
  escalarPalco();
  clearTimeout(AP.timer);
  if (!AP.pausado) AP.timer = setTimeout(() => irPara(AP.i + 1), DURACAO_SLIDE);
}

function irPara(i) {
  AP.i = (i + AP.lista.length) % AP.lista.length;
  mostrarSlide();
}

function pausar() {
  AP.pausado = !AP.pausado;
  $('#apres').classList.toggle('pausado', AP.pausado);
  if (AP.pausado) clearTimeout(AP.timer);
  else mostrarSlide();  // recomeça o slide pra barra e timer andarem juntos
}

function abrirApresentacao(modo) {
  AP.lista = slides();
  AP.i = 0;
  AP.pausado = false;
  const ap = $('#apres');
  ap.classList.remove('pausado');
  // na exibição completa, se o monitor é 16:9 o fundo some (fica da cor do palco) e não aparecem faixas laterais
  const r = screen.width / screen.height;
  ap.classList.toggle('sem-faixa', modo === 'tv' && r >= 1.55 && r <= 1.95);
  ap.hidden = false;
  document.body.classList.add('sem-scroll');
  mostrarSlide();
}

function fecharApresentacao() {
  clearTimeout(AP.timer);
  $('#apres').hidden = true;
  document.body.classList.remove('sem-scroll');
  if (location.hash === '#apresentacao') history.replaceState(null, '', '#tab=' + (abaAtual || 'financeiro'));
}

$('#apFechar').addEventListener('click', fecharApresentacao);
$('#apPausa').addEventListener('click', pausar);
$('#palco').addEventListener('click', e => { const b = e.target.closest('.p-prog button'); if (b) irPara(+b.dataset.i); });
addEventListener('resize', () => { if (!$('#apres').hidden) escalarPalco(); });
addEventListener('keydown', e => {
  if ($('#apres').hidden) return;
  if (e.key === 'Escape') fecharApresentacao();
  else if (e.key === 'ArrowRight') irPara(AP.i + 1);
  else if (e.key === 'ArrowLeft') irPara(AP.i - 1);
  else if (e.key === ' ') { e.preventDefault(); pausar(); }
});
