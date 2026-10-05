// Aba Farol: base de alunos e faturamento projetado por ciclo, com sub-abas.

const COR_PERFIL = {'Matrícula': '#2563eb', 'Rematrícula': '#7c3aed', 'Egresso': '#f59e0b'};
const PERFIS = ['Matrícula', 'Rematrícula', 'Egresso'];

function renderFarol(el) {
  const FA = D.farol;
  const anos = Object.keys(FA.ciclos).sort();
  const cache = {};
  const linhasDe = a => cache[a] || (cache[a] = expandir(FA.ciclos[a].alunos));
  let ciclo = String(D.meta.ano), taxa = FA.taxa_plataforma, aba = 'panorama';

  el.innerHTML = `
  <div class="farol-topo">
    <label>Ciclo <select class="campo" id="farCiclo">${anos.map(a => `<option ${a === ciclo ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    <label>Taxa da plataforma <input class="campo" id="farTaxa" type="number" step="0.1" min="0" max="20" value="${num(taxa * 100, 1).replace(',', '.')}"> %</label>
    <button class="btn" id="farAplicar">Aplicar</button>
    <button class="btn" onclick="window.print()">Imprimir</button>
    <span class="nota" id="farCorte" style="margin:0"></span>
  </div>
  <nav class="sub" id="farSub"></nav>
  <div id="farCorpo"></div>`;

  // ---------- contas do ciclo
  function resumo(rows) {
    const ativos = rows.filter(r => r.ativo);
    const parcelas = soma(rows, 'parcelas');
    const mb = soma(rows, r => r.mens_bruto * r.parcelas), ml = soma(rows, r => r.mensal * r.parcelas);
    const liquido = soma(rows, 'liquido'), bruto = soma(rows, 'bruto');
    return {
      ativos, total: ativos.length,
      perfil: Object.fromEntries(PERFIS.map(p => [p, ativos.filter(r => r.perfil === p).length])),
      bruto, liquido, descontos: soma(rows, 'descontos'),
      taxa: liquido * taxa, posTaxa: liquido * (1 - taxa),
      faturado: soma(rows, 'faturado'), recebido: soma(rows, 'recebido'), recebidoPos: soma(rows, 'recebido') * (1 - taxa),
      ticketSem: parcelas ? mb / parcelas : 0, ticketCom: parcelas ? ml / parcelas : 0, descMedio: mb ? (mb - ml) / mb : 0,
      formandos: ativos.filter(r => r.serie === '3ª série').length,
      porTipo: {Entrada: soma(rows, 'entrada'), Mensalidade: ml, Contraturno: soma(rows, 'contraturno'), 'Material / extras': soma(rows, 'extra'), Acordos: soma(rows, 'acordo')},
    };
  }

  const SUBS = [
    {id: 'panorama', nome: 'Panorama'}, {id: 'base', nome: 'Base de alunos'}, {id: 'ficha', nome: 'Ficha do aluno'},
    {id: 'turmas', nome: 'Turmas'}, {id: 'faturamento', nome: 'Faturamento'}, {id: 'metas', nome: 'Metas'}, {id: 'comparativo', nome: 'Comparativo de ciclos'},
  ];
  const desenhar = () => {
    $('#farCorte').textContent = `Corte em ${dataBR(FA.ciclos[ciclo].corte)}`;
    ({panorama, base, ficha, turmas, faturamento, metas, comparativo})[aba]($('#farCorpo'), linhasDe(ciclo), resumo(linhasDe(ciclo)));
  };
  subAbas($('#farSub'), SUBS, id => { aba = id; desenhar(); });
  $('#farCiclo').addEventListener('change', e => { ciclo = e.target.value; desenhar(); });
  $('#farAplicar').addEventListener('click', () => { taxa = Math.max(0, +$('#farTaxa').value || 0) / 100; desenhar(); });

  // ---------- 1. panorama
  function panorama(alvo, rows, S) {
    const hist = FA.historico;
    const histAlunos = hist.map(h => h.total), histFat = hist.map(h => h.faturamento);
    alvo.innerHTML = `
      <div class="sec-t">Alunos</div>
      <div class="kpis k5 mt">
        ${kpi({rotulo: 'Total de alunos', valor: num(S.total), sub: `ativos no ciclo ${ciclo}`, cor: COR.cianoEsc})}
        ${kpi({rotulo: 'Matrículas (novos)', valor: num(S.perfil['Matrícula']), sub: pct(S.perfil['Matrícula'] / S.total) + ' da base', cor: COR_PERFIL['Matrícula']})}
        ${kpi({rotulo: 'Rematrículas', valor: num(S.perfil['Rematrícula']), sub: pct(S.perfil['Rematrícula'] / S.total) + ' da base', cor: COR_PERFIL['Rematrícula']})}
        ${kpi({rotulo: 'Egressos', valor: num(S.perfil['Egresso']), sub: 'voltaram depois de 3+ anos fora', cor: COR_PERFIL['Egresso']})}
        ${kpi({rotulo: 'Evasão natural projetada', valor: num(S.formandos), sub: '3ª série que se forma no fim do ano', cor: COR.cinzaEsc})}
      </div>
      <div class="sec-t">Faturamento</div>
      <div class="kpis k5 mt">
        ${kpi({rotulo: 'Faturamento projetado', valor: brl(S.liquido), sub: 'líquido de descontos, inclui inativos', cor: COR.verdeEsc})}
        ${kpi({rotulo: 'Ticket/mês sem desconto', valor: brlInt(S.ticketSem), sub: `${brlInt(S.ticketSem * 12)} por ano`, cor: COR.ink})}
        ${kpi({rotulo: 'Desconto médio', valor: pct(S.descMedio), sub: 'sobre a mensalidade cheia', cor: COR.laranjaEsc})}
        ${kpi({rotulo: 'Ticket/mês com desconto', valor: brlInt(S.ticketCom), sub: `${brlInt(S.ticketCom * 12)} por ano`, cor: COR.roxoEsc})}
        ${kpi({rotulo: 'Recebido até a data', valor: brl(S.recebidoPos), sub: `${pct(S.recebidoPos / S.posTaxa)} do projetado (já sem a taxa)`, cor: COR.cianoEsc})}
      </div>
      <div class="grid g3">
        ${card('Perfil da base', barrasH(PERFIS.map(p => ({nome: p, valor: S.perfil[p], cor: COR_PERFIL[p], extra: pct(S.perfil[p] / S.total)}))), {sub: 'Matrícula = primeiro ano na escola'})}
        ${card('Alunos por ano', grafLinhas({W: LG.terco, rotulos: hist.map(h => String(h.ano)), h: 230, pontos: true, series: [{nome: 'Alunos', cor: COR.ciano, valores: histAlunos, area: true}]}), {sub: 'Cursando no fim de cada ano'})}
        ${card('Faturamento anual', grafLinhas({W: LG.terco, rotulos: hist.map(h => String(h.ano)), h: 230, pontos: true, fmtY: eixoMil, fmtTip: brl, series: [{nome: 'Faturamento', cor: COR.verde, valores: histFat, area: true}]}), {sub: 'Líquido de descontos'})}
      </div>`;
  }

  // ---------- 2. base de alunos
  function base(alvo, rows, S) {
    const ant = String(+ciclo - 1), temAnt = !!FA.ciclos[ant];
    const totAnt = temAnt ? resumo(linhasDe(ant)).total : null;
    const ativos = S.ativos;
    const porSeg = SEGMENTOS.map(s => ({nome: s, valor: ativos.filter(r => r.segmento === s).length, cor: COR_SEG[s]}));
    const meses = [...new Set(ativos.map(r => r.data.slice(0, 7)))].sort();
    const porMes = p => meses.map(m => ativos.filter(r => r.data.slice(0, 7) === m && (p === 'Matrícula' ? r.perfil === p : r.perfil !== 'Matrícula')).length);
    const novos = porMes('Matrícula'), remat = porMes('Rematrícula');
    let a1 = 0, a2 = 0;
    const acNovos = novos.map(v => a1 += v), acRemat = remat.map(v => a2 += v);
    const dias = [...new Set(ativos.map(r => r.data))].sort();
    const ini = dias[0], fim = dias[dias.length - 1], nDias = difDias(ini, fim) + 1;
    const porDia = p => Array.from({length: nDias}, (_, i) => { const d = somarDias(ini, i); return ativos.filter(r => r.data === d && (p === 'Matrícula' ? r.perfil === p : r.perfil !== 'Matrícula')).length; });
    const curvas = Object.entries(FA.curvas).sort().slice(-4);
    const maxLen = Math.max(...curvas.map(([, v]) => v.length));
    const coresCurva = ['#cbd5e1', '#94a3b8', '#0ea5e9', '#db2777'];
    const hist = FA.historico;
    alvo.innerHTML = `
      <div class="ritmo-box" style="--c:${COR.ciano};margin-top:16px"><span>Base do ciclo ${ciclo}</span><strong>${num(S.total)} alunos ativos</strong>
        <span>${temAnt ? `${S.total - totAnt >= 0 ? '+' : ''}${num(S.total - totAnt)} vs ${ant} no mesmo dia (${num(totAnt)})` : 'sem ciclo anterior carregado'}</span></div>
      <div class="grid g3">
        ${card('Perfil', `<div class="rosca-box">${grafRosca(PERFIS.map(p => ({nome: p, valor: S.perfil[p], cor: COR_PERFIL[p]})), {tam: 170, esp: 26, fmt: v => num(v) + ' alunos', centro: num(S.total), sub: 'alunos'})}
          <div class="lista">${PERFIS.map(p => `<div><span><i style="background:${COR_PERFIL[p]}"></i>${p}</span><b>${num(S.perfil[p])}</b></div>`).join('')}</div></div>`)}
        ${card('Segmento', `<div class="rosca-box">${grafRosca(porSeg, {tam: 170, esp: 26, fmt: v => num(v) + ' alunos', centro: num(S.total), sub: 'alunos'})}
          <div class="lista">${porSeg.map(s => `<div><span><i style="background:${s.cor}"></i>${s.nome}</span><b>${num(s.valor)}</b></div>`).join('')}</div></div>`)}
        ${card('Perfil por segmento', legenda(PERFIS.map(p => ({nome: p, cor: COR_PERFIL[p]}))) + grafBarras({W: LG.terco, rotulos: SEGMENTOS.map(s => SIGLA_SEG[s]), empilhado: true, total: true, h: 210,
          rotuloTip: i => SEGMENTOS[i], series: PERFIS.map(p => ({nome: p, cor: COR_PERFIL[p], valores: SEGMENTOS.map(s => ativos.filter(r => r.segmento === s && r.perfil === p).length)}))}))}
      </div>
      <div class="grid g2">
        ${card('Histórico por segmento', legenda(SEGMENTOS.map(s => ({nome: s, cor: COR_SEG[s], tipo: 'linha'}))) +
          grafLinhas({W: LG.metade, rotulos: hist.map(h => String(h.ano)), h: 250, pontos: true, series: SEGMENTOS.map(s => ({nome: s, cor: COR_SEG[s], valores: hist.map(h => h.segmentos[s])}))}))}
        ${card('Curva de matrículas por dia de campanha', legenda(curvas.map(([a], i) => ({nome: 'Ciclo ' + a, cor: coresCurva[i + 4 - curvas.length], tipo: i === curvas.length - 1 ? 'linha' : 'traco'}))) +
          grafLinhas({W: LG.metade, rotulos: Array.from({length: maxLen}, (_, i) => 'dia ' + i), h: 250, series: curvas.map(([a, v], i) => ({nome: 'Ciclo ' + a, cor: coresCurva[i + 4 - curvas.length], valores: v, tracejado: i < curvas.length - 1}))}),
          {sub: 'Acumulado desde a abertura de cada campanha'})}
      </div>
      <div class="grid g2">
        ${card('Matrículas e rematrículas por mês', legenda([{nome: 'Matrícula', cor: COR_PERFIL['Matrícula']}, {nome: 'Rematrícula + egresso', cor: COR_PERFIL['Rematrícula']}]) +
          grafBarras({W: LG.metade, rotulos: meses.map(m => mesCurto(m) + '/' + m.slice(2, 4)), empilhado: true, total: true, h: 240, series: [
            {nome: 'Rematrícula', cor: COR_PERFIL['Rematrícula'], valores: remat}, {nome: 'Matrícula', cor: COR_PERFIL['Matrícula'], valores: novos}]}))}
        ${card('Acumulado por mês', legenda([{nome: 'Matrícula', cor: COR_PERFIL['Matrícula']}, {nome: 'Rematrícula + egresso', cor: COR_PERFIL['Rematrícula']}]) +
          grafBarras({W: LG.metade, rotulos: meses.map(m => mesCurto(m) + '/' + m.slice(2, 4)), empilhado: true, total: true, h: 240, series: [
            {nome: 'Rematrícula', cor: COR_PERFIL['Rematrícula'], valores: acRemat}, {nome: 'Matrícula', cor: COR_PERFIL['Matrícula'], valores: acNovos}]}))}
      </div>
      <div class="mt">${card('Matrículas por dia', legenda([{nome: 'Matrícula', cor: COR_PERFIL['Matrícula']}, {nome: 'Rematrícula + egresso', cor: COR_PERFIL['Rematrícula']}]) +
        grafBarras({rotulos: Array.from({length: nDias}, (_, i) => diaMes(somarDias(ini, i))), empilhado: true, h: 230, rotuloTip: i => dataBR(somarDias(ini, i)), series: [
          {nome: 'Rematrícula', cor: COR_PERFIL['Rematrícula'], valores: porDia('Rematrícula')}, {nome: 'Matrícula', cor: COR_PERFIL['Matrícula'], valores: porDia('Matrícula')}]}))}</div>`;
  }

  // ---------- 3. ficha do aluno
  function ficha(alvo, rows) {
    const turmas = [...new Set(rows.map(r => r.turma))];
    const opt = (lista, rot) => `<option value="">${rot}</option>` + lista.map(v => `<option>${esc(v)}</option>`).join('');
    alvo.innerHTML = `
      <div class="filtros mt">
        <input type="search" class="campo" id="fBusca" placeholder="Nome ou matrícula">
        <select class="campo" id="fSeg">${opt(SEGMENTOS, 'Todos os segmentos')}</select>
        <select class="campo" id="fTurma">${opt(turmas, 'Todas as turmas')}</select>
        <select class="campo" id="fTurno">${opt(['Manhã', 'Tarde'], 'Todos os turnos')}</select>
        <select class="campo" id="fPerfil">${opt(PERFIS, 'Todos os perfis')}</select>
        <select class="campo" id="fStatus"><option value="">Ativos e inativos</option><option value="1">Ativos</option><option value="0">Inativos</option></select>
        <button class="link" id="fLimpar">Limpar</button>
      </div>
      <p class="nota" id="fCont"></p>
      <div class="card tab-alta" id="fTabela"></div>`;
    const din = v => brlCheio(v);
    const t = new Tabela($('#fTabela'), {
      linhas: rows, ordem: {k: 'nome', dir: 1},
      colunas: [
        {k: 'nome', l: 'Aluno', f: v => `<b>${esc(v)}</b>`}, {k: 'id', l: 'Matrícula', n: 1, f: v => v},
        {k: 'turma', l: 'Turma'}, {k: 'turno', l: 'Turno'},
        {k: 'perfil', l: 'Perfil', f: v => `<span class="tag" style="background:${COR_PERFIL[v]}"></span>${v}`},
        {k: 'ativo', l: 'Status', f: v => v ? pill('Ativo', 'bom') : pill('Inativo', 'ruim')},
        {k: 'data', l: 'Data matríc.', f: v => dataBR(v), v: r => r.data},
        {k: 'entrada', l: 'Entrada', n: 1, f: din}, {k: 'bruto', l: 'Proj. bruto', n: 1, f: din},
        {k: '_taxa', l: 'Taxa plataf.', n: 1, f: (v, r) => din(r.liquido * taxa), v: r => r.liquido},
        {k: '_pos', l: 'Líq. pós-taxa', n: 1, f: (v, r) => din(r.liquido * (1 - taxa)), v: r => r.liquido},
        {k: 'descontos', l: 'Desconto', n: 1, f: din},
        {k: '_pd', l: '% desc.', n: 1, f: (v, r) => pct(r.mens_bruto ? 1 - r.mensal / r.mens_bruto : 0, 0), v: r => 1 - r.mensal / r.mens_bruto},
        {k: '_dp', l: 'Desc./parcela', n: 1, f: (v, r) => din(r.mens_bruto - r.mensal), v: r => r.mens_bruto - r.mensal},
        {k: 'mensal', l: 'Parcela c/ desc.', n: 1, f: din},
        {k: '_tp', l: 'Taxa/parcela', n: 1, f: (v, r) => din(r.mensal * taxa), v: r => r.mensal},
        {k: '_pl', l: 'Parcela líq.', n: 1, f: (v, r) => din(r.mensal * (1 - taxa)), v: r => r.mensal},
        {k: 'liquido', l: 'Proj. líquido', n: 1, f: din}, {k: 'faturado', l: 'Faturado', n: 1, f: din},
        {k: 'recebido', l: 'Pago', n: 1, f: din},
        {k: '_falta', l: 'Falta pagar', n: 1, f: (v, r) => din(Math.max(0, r.liquido - r.recebido)), v: r => r.liquido - r.recebido},
      ],
    });
    function filtrar() {
      const b = $('#fBusca').value.trim().toLowerCase();
      const f = {seg: $('#fSeg').value, turma: $('#fTurma').value, turno: $('#fTurno').value, perfil: $('#fPerfil').value, st: $('#fStatus').value};
      const lista = rows.filter(r => (!b || r.nome.toLowerCase().includes(b) || String(r.id).includes(b)) &&
        (!f.seg || r.segmento === f.seg) && (!f.turma || r.turma === f.turma) && (!f.turno || r.turno === f.turno) &&
        (!f.perfil || r.perfil === f.perfil) && (f.st === '' || String(r.ativo) === f.st));
      $('#fCont').innerHTML = `<b>${num(lista.length)}</b> alunos · ${num(lista.filter(r => r.ativo).length)} ativos · projetado líquido <b>${brl(soma(lista, 'liquido'))}</b> · pago <b>${brl(soma(lista, 'recebido'))}</b>`;
      t.atualizar(lista);
    }
    ['#fBusca', '#fSeg', '#fTurma', '#fTurno', '#fPerfil', '#fStatus'].forEach(s => $(s).addEventListener(s === '#fBusca' ? 'input' : 'change', filtrar));
    $('#fLimpar').addEventListener('click', () => { $$('.filtros select', alvo).forEach(s => s.value = ''); $('#fBusca').value = ''; filtrar(); });
    filtrar();
  }

  // ---------- 4. turmas
  function turmas(alvo, rows, S) {
    const porTurma = {};
    rows.forEach(r => {
      const t = porTurma[r.turma] || (porTurma[r.turma] = {turma: r.turma, serie: r.serie, segmento: r.segmento, turno: r.turno, alunos: 0, mat: 0, rem: 0, egr: 0, liquido: 0, recebido: 0});
      if (r.ativo) { t.alunos++; t[{'Matrícula': 'mat', 'Rematrícula': 'rem', 'Egresso': 'egr'}[r.perfil]]++; }
      t.liquido += r.liquido - r.contraturno;
      t.recebido += r.recebido;
    });
    const contra = rows.filter(r => r.contraturno > 0);
    const lista = Object.values(porTurma);
    const turnoAlunos = ['Manhã', 'Tarde'].map((t, i) => ({nome: t, valor: soma(lista.filter(x => x.turno === t), 'alunos'), cor: i ? COR.roxo : COR.ambar}));
    const turnoRec = ['Manhã', 'Tarde'].map((t, i) => ({nome: t, valor: soma(lista.filter(x => x.turno === t), 'liquido'), cor: i ? COR.roxo : COR.ambar}));
    const contraRec = soma(contra, 'contraturno');
    turnoRec.push({nome: 'Contraturno', valor: contraRec, cor: COR.teal});
    const segRec = SEGMENTOS.map(s => ({nome: s, valor: soma(lista.filter(x => x.segmento === s), 'liquido'), cor: COR_SEG[s]}));
    const ordenada = lista.slice().sort((a, b) => D.funil.series.indexOf(a.serie) - D.funil.series.indexOf(b.serie) || a.turma.localeCompare(b.turma));
    const ativasN = lista.filter(t => t.alunos).length;
    alvo.innerHTML = `
      <div class="kpis k4 mt">
        ${kpi({rotulo: 'Turmas ativas', valor: num(ativasN), sub: `${num(S.total)} alunos`, cor: COR.cianoEsc})}
        ${kpi({rotulo: 'Manhã / tarde', valor: `${lista.filter(t => t.turno === 'Manhã').length} / ${lista.filter(t => t.turno === 'Tarde').length}`, sub: `+ contraturno com ${num(contra.filter(r => r.ativo).length)} alunos`, cor: COR.ambar})}
        ${kpi({rotulo: 'Projetado líquido', valor: brl(S.liquido), sub: 'turmas + contraturno', cor: COR.verdeEsc})}
        ${kpi({rotulo: 'Receita média por turma', valor: brl(soma(lista, 'liquido') / ativasN), sub: 'sem contraturno', cor: COR.roxoEsc})}
      </div>
      <div class="grid g3">
        ${card('Alunos por turno', `<div class="rosca-box">${grafRosca(turnoAlunos, {tam: 160, esp: 26, fmt: v => num(v) + ' alunos'})}<div class="lista">${turnoAlunos.map(t => `<div><span><i style="background:${t.cor}"></i>${t.nome}</span><b>${num(t.valor)}</b></div>`).join('')}</div></div>`)}
        ${card('Receita por turno', `<div class="rosca-box">${grafRosca(turnoRec, {tam: 160, esp: 26})}<div class="lista">${turnoRec.map(t => `<div><span><i style="background:${t.cor}"></i>${t.nome}</span><b>${brl(t.valor)}</b></div>`).join('')}</div></div>`)}
        ${card('Receita por segmento', `<div class="rosca-box">${grafRosca(segRec, {tam: 160, esp: 26})}<div class="lista">${segRec.map(t => `<div><span><i style="background:${t.cor}"></i>${SIGLA_SEG[t.nome]}</span><b>${brl(t.valor)}</b></div>`).join('')}</div></div>`)}
      </div>
      <div class="grid g2">
        ${card('Receita projetada por turma', barrasH(ordenada.map(t => ({nome: `${t.turma} <small style="color:var(--mudo)">${t.turno}</small>`, valor: t.liquido, cor: COR_SEG[t.segmento]})), {fmt: brl}))}
        ${card('Alunos por turma', barrasH(ordenada.map(t => ({nome: `${t.turma} <small style="color:var(--mudo)">${t.turno}</small>`, valor: t.alunos, cor: COR_SEG[t.segmento]})), {fmt: v => num(v)}))}
      </div>
      <div class="card mt"><div class="card-h"><h3>Resumo por turma</h3></div><div class="tabela-wrap"><table>
        <thead><tr><th>Turma</th><th>Turno</th><th class="n">Alunos</th><th class="n">Matr.</th><th class="n">Remat.</th><th class="n">Egr.</th><th class="n">Proj. líquido</th><th class="n">Recebido</th></tr></thead>
        <tbody>${SEGMENTOS.map(s => {
          const ts = ordenada.filter(t => t.segmento === s);
          const sub = k => soma(ts, k);
          return ts.map(t => `<tr><td><span class="tag" style="background:${COR_SEG[s]}"></span>${t.turma}</td><td>${t.turno}</td><td class="n">${t.alunos}</td><td class="n">${t.mat}</td><td class="n">${t.rem}</td><td class="n">${t.egr}</td><td class="n">${brlCheio(t.liquido)}</td><td class="n">${brlCheio(t.recebido)}</td></tr>`).join('') +
            `<tr style="background:var(--suave)"><td colspan="2"><b>Subtotal ${s}</b></td><td class="n"><b>${sub('alunos')}</b></td><td class="n">${sub('mat')}</td><td class="n">${sub('rem')}</td><td class="n">${sub('egr')}</td><td class="n"><b>${brlCheio(sub('liquido'))}</b></td><td class="n"><b>${brlCheio(sub('recebido'))}</b></td></tr>`;
        }).join('')}
          <tr><td><span class="tag" style="background:${COR.teal}"></span>Contraturno</td><td>Tarde</td><td class="n">${contra.filter(r => r.ativo).length}</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="n">${brlCheio(contraRec)}</td><td class="n">—</td></tr></tbody>
        <tfoot><tr><td colspan="2">Total</td><td class="n">${num(S.total)}</td><td class="n">${S.perfil['Matrícula']}</td><td class="n">${S.perfil['Rematrícula']}</td><td class="n">${S.perfil['Egresso']}</td><td class="n">${brlCheio(S.liquido)}</td><td class="n">${brlCheio(S.recebido)}</td></tr></tfoot>
      </table></div></div>`;
  }

  // ---------- 5. faturamento
  function faturamento(alvo, rows, S) {
    const proj = FA.ciclos[ciclo].proj_mensal;
    const meses = Object.keys(proj).filter(k => k.startsWith(ciclo));
    const segs = SEGMENTOS.map(s => {
      const g = rows.filter(r => r.segmento === s), ativos = g.filter(r => r.ativo);
      const parc = soma(g, 'parcelas');
      return {nome: s, alunos: ativos.length, bruto: soma(g, 'bruto'), desc: soma(g, 'descontos'), liquido: soma(g, 'liquido'),
        ticket: ativos.length ? soma(g, 'liquido') / ativos.length : 0, dp: parc ? soma(g, r => (r.mens_bruto - r.mensal) * r.parcelas) / parc : 0,
        pc: parc ? soma(g, r => r.mensal * r.parcelas) / parc : 0, faturado: soma(g, 'faturado'), recebido: soma(g, 'recebido')};
    });
    const tipos = Object.entries(S.porTipo).filter(([, v]) => v > 0).map(([nome, valor], i) => ({nome, valor, cor: PALETA[i]}));
    const passos = [['Bruto', S.bruto, COR.ink], ['Descontos', -S.descontos, COR.laranja], ['Líquido', S.liquido, COR.verde], ['Taxa da plataforma', -S.taxa, COR.verm], ['Pós-taxa', S.posTaxa, COR.verdeEsc]];
    const maxP = S.bruto;
    alvo.innerHTML = `
      <div class="kpis k5 mt">
        ${kpi({rotulo: 'Projetado bruto', valor: brl(S.bruto), sub: 'mensalidades cheias + taxas e extras', cor: COR.ink})}
        ${kpi({rotulo: 'Projetado líquido', valor: brl(S.liquido), sub: `${brl(S.descontos)} em descontos`, cor: COR.verdeEsc})}
        ${kpi({rotulo: 'Taxa da plataforma', valor: brl(S.taxa), sub: `${num(taxa * 100, 1)}% sobre o líquido`, cor: COR.vermEsc})}
        ${kpi({rotulo: 'Líquido pós-taxa', valor: brl(S.posTaxa), sub: 'o que de fato entra', cor: COR.verdeEsc})}
        ${kpi({rotulo: 'Recebido pós-taxa', valor: brl(S.recebidoPos), sub: `${pct(S.recebidoPos / S.posTaxa)} do projetado`, cor: COR.cianoEsc})}
      </div>
      <div class="grid g2">
        ${card('Faturamento projetado por mês', grafBarras({W: LG.metade, rotulos: meses.map(mesCurto), h: 250, valores: false, fmtValor: brl, series: [
          {nome: 'Líquido', cor: COR.verde, valores: meses.map(m => proj[m][1])}]}), {sub: 'Líquido de descontos'})}
        ${card('Do bruto ao que entra', `<div class="bh">${passos.map(([n, v, c]) => `<div class="bh-l"><span class="bh-n">${n}</span><span class="bh-v">${v < 0 ? '−' : ''}${brl(Math.abs(v))}</span><div class="bh-t"><div style="width:${Math.abs(v) / maxP * 100}%;background:${c}"></div></div></div>`).join('')}</div>`)}
      </div>
      <div class="grid g2">
        ${card('Bruto x líquido por segmento', legenda([{nome: 'Bruto', cor: COR.cinza}, {nome: 'Líquido', cor: COR.verde}]) +
          grafBarras({W: LG.metade, rotulos: segs.map(s => `${SIGLA_SEG[s.nome]} · ${pct(s.liquido / S.liquido, 0)}`), h: 250, fmtValor: brl, valores: true, rotuloTip: i => segs[i].nome,
            series: [{nome: 'Bruto', cor: COR.cinza, valores: segs.map(s => s.bruto)}, {nome: 'Líquido', cor: COR.verde, valores: segs.map(s => s.liquido)}]}), {sub: 'O percentual é a participação no líquido total'})}
        ${card('Por tipo de receita', `<div class="rosca-box">${grafRosca(tipos, {centro: pct(tipos.find(t => t.nome === 'Mensalidade').valor / soma(tipos, 'valor'), 0), sub: 'mensalidade'})}
          <div class="lista">${tipos.map(t => `<div><span><i style="background:${t.cor}"></i>${t.nome}</span><b>${brl(t.valor)}</b></div>`).join('')}</div></div>`)}
      </div>
      <div class="card mt"><div class="card-h"><h3>Por segmento</h3></div><div class="tabela-wrap"><table>
        <thead><tr><th>Segmento</th><th class="n">Alunos</th><th class="n">Ticket médio</th><th class="n">Proj. bruto</th><th class="n">Descontos</th><th class="n">% desc.</th><th class="n">Desc./parcela</th><th class="n">Parcela c/ desc.</th><th class="n">Proj. líquido</th><th class="n">Taxa</th><th class="n">Líq. pós-taxa</th><th class="n">Faturado</th><th class="n">Recebido</th></tr></thead>
        <tbody>${segs.map(s => `<tr><td><span class="tag" style="background:${COR_SEG[s.nome]}"></span>${s.nome}</td><td class="n">${s.alunos}</td><td class="n">${brlInt(s.ticket)}</td><td class="n">${brlInt(s.bruto)}</td><td class="n">${brlInt(s.desc)}</td>
          <td class="n">${pct(s.desc / s.bruto)}</td><td class="n">${brlCheio(s.dp)}</td><td class="n">${brlCheio(s.pc)}</td><td class="n">${brlInt(s.liquido)}</td><td class="n">${brlInt(s.liquido * taxa)}</td><td class="n">${brlInt(s.liquido * (1 - taxa))}</td><td class="n">${brlInt(s.faturado)}</td><td class="n">${brlInt(s.recebido)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="n">${S.total}</td><td class="n">${brlInt(S.liquido / S.total)}</td><td class="n">${brlInt(S.bruto)}</td><td class="n">${brlInt(S.descontos)}</td><td class="n">${pct(S.descontos / S.bruto)}</td><td></td><td class="n">${brlCheio(S.ticketCom)}</td><td class="n">${brlInt(S.liquido)}</td><td class="n">${brlInt(S.taxa)}</td><td class="n">${brlInt(S.posTaxa)}</td><td class="n">${brlInt(S.faturado)}</td><td class="n">${brlInt(S.recebido)}</td></tr></tfoot>
      </table></div></div>`;
  }

  // ---------- 6. metas (do planejamento do funil)
  function metas(alvo) {
    const P = planejamentoAtual();
    const ciclo27 = String(D.meta.ano_proximo);
    const S = resumo(linhasDe(ciclo27));
    const remEsperada = Math.round(P.alunos_atuais * P.taxa_rematricula / 100);
    const novosMeta = Math.max(0, P.meta_alunos - remEsperada);
    const remFeitas = S.perfil['Rematrícula'] + S.perfil['Egresso'], novosFeitos = S.perfil['Matrícula'];
    const ticket = resumo(linhasDe(String(D.meta.ano))).ticketCom;
    const fatMeta = P.meta_alunos * ticket * 12 * (1 + 0.07);
    const tiers = [['Mínima', 0.9], ['Planejada', 1], ['Desafio', 1.05]];
    const linha = (nome, feito, alvoV, fmt = num) => `<div class="card mt"><div class="card-h"><div><h3>${nome}</h3><p>${fmt(feito)} até agora</p></div></div>${tiers.map(([t, f]) => {
      const meta = alvoV * f, p = meta ? feito / meta : 0;
      return `<div class="meta-tier"><span>${t} <small style="color:var(--mudo)">(${fmt(meta)})</small></span>${barraProgresso([{v: Math.min(p, 1), cor: p >= 1 ? COR.verde : f < 1 ? COR.ambar : f > 1 ? COR.roxo : COR.azul}], 14)}<b>${pct(p, 0)}</b></div>`;
    }).join('')}</div>`;
    alvo.innerHTML = `
      <div class="ritmo-box" style="--c:${COR.ambar};margin-top:16px"><span>Campanha ${ciclo27}</span><span>Base de ${D.meta.ano}: <b>${num(P.alunos_atuais)}</b> · rematrícula esperada <b>${num(remEsperada)}</b> (${P.taxa_rematricula}%) · meta <b>${num(P.meta_alunos)}</b> alunos</span>
        <span class="nota" style="margin:0">Metas vêm do Planejamento da aba Funil</span></div>
      ${linha('Rematrículas (veteranos + egressos)', remFeitas, remEsperada)}
      ${linha('Novas matrículas', novosFeitos, novosMeta)}
      ${linha('Total de alunos', S.total, P.meta_alunos)}
      ${linha('Faturamento projetado', S.liquido, fatMeta, brl)}
      <p class="nota">Três níveis por meta: mínima (90%), planejada (100%) e desafio (105%). O faturamento-meta usa o ticket atual com o reajuste anual.</p>`;
  }

  // ---------- 7. comparativo de ciclos
  function comparativo(alvo) {
    const R = anos.map(a => ({ano: a, S: resumo(linhasDe(a)), rows: linhasDe(a)}));
    const delta = (a, b, fmt) => { const d = a - b; return `<span class="${d >= 0 ? 'delta-pos' : 'delta-neg'}">${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}</span>`; };
    const n = R.length, ult = R[n - 1], pen = R[n - 2];
    const lin = (rot, f, fmt = num) => `<tr><td>${rot}</td>${R.map(r => `<td class="n">${fmt(f(r))}</td>`).join('')}<td class="n">${delta(f(ult), f(pen), fmt)}</td></tr>`;
    const porSeg = s => r => r.S.ativos.filter(x => x.segmento === s).length;
    alvo.innerHTML = `
      <div class="grid g2">
        ${card('Alunos por segmento', `<div class="tabela-wrap"><table><thead><tr><th>Segmento</th>${R.map(r => `<th class="n">${r.ano}</th>`).join('')}<th class="n">Δ ${pen.ano}→${ult.ano}</th></tr></thead>
          <tbody>${SEGMENTOS.map(s => lin(s, porSeg(s))).join('')}</tbody><tfoot>${lin('Total', r => r.S.total)}</tfoot></table></div>`,
          {sub: `Cada ciclo cortado no mesmo dia (${dataBR(HOJE).slice(0, 5)})`})}
        ${card('Financeiro', `<div class="tabela-wrap"><table><thead><tr><th></th>${R.map(r => `<th class="n">${r.ano}</th>`).join('')}<th class="n">Δ ${pen.ano}→${ult.ano}</th></tr></thead>
          <tbody>${lin('Faturamento líquido anual', r => r.S.liquido, brl)}${lin('Ticket médio anual', r => r.S.ticketSem * 12, brlInt)}${lin('Ticket com desconto (ano)', r => r.S.ticketCom * 12, brlInt)}${lin('Desconto médio', r => r.S.descMedio, v => pct(v))}</tbody></table></div>`)}
      </div>
      <div class="mt">${card('Alunos por ciclo e segmento', legenda(SEGMENTOS.map(s => ({nome: s, cor: COR_SEG[s]}))) +
        grafBarras({rotulos: R.map(r => 'Ciclo ' + r.ano), empilhado: true, total: true, h: 260, series: SEGMENTOS.map(s => ({nome: s, cor: COR_SEG[s], valores: R.map(porSeg(s))}))}),
        {sub: `O ciclo ${ult.ano} ainda está em campanha`})}</div>`;
  }
}
