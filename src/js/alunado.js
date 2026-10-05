// Aba Alunado: ano letivo em curso comparado com o anterior.

const COR_VET = '#7c3aed', COR_NOV = '#2563eb';

function faixaOcupacao(p) {
  if (p > 1) return ['#dc2626', 'acima da capacidade'];
  if (p >= 0.95) return ['#15803d', '95 a 100%'];
  if (p >= 0.75) return ['#22c55e', '75 a 94%'];
  if (p >= 0.5) return ['#eab308', '50 a 74%'];
  if (p >= 0.25) return ['#f97316', '25 a 49%'];
  return ['#94a3b8', 'abaixo de 25%'];
}

function tabelaSeries(el, series) {
  new Tabela(el, {
    linhas: series.map(s => ({...s, nome: s.serie})),
    ordem: {k: 'total', dir: -1},
    colunas: [
      {k: 'serie', l: 'Série'},
      {k: 'segmento', l: 'Segmento', f: v => `<span class="tag" style="background:${COR_SEG[v]}"></span>${v}`},
      {k: 'total', l: 'Total', n: 1},
      {k: 'novatos', l: 'Novatos', n: 1},
      {k: 'veteranos', l: 'Veteranos', n: 1},
      {k: 'ocupacao', l: 'Ocupação', n: 1, f: (v, r) => `${pct(v, 0)}<span class="mini-barra"><i style="width:${Math.min(v, 1) * 100}%;background:${v >= 0.95 ? COR.verde : v >= 0.8 ? COR.ambar : COR.cinza}"></i></span>`,
        v: r => r.ocupacao},
    ],
    total: {serie: 'Total', segmento: '', total: soma(series, 'total'), novatos: soma(series, 'novatos'), veteranos: soma(series, 'veteranos'),
      ocupacao: soma(series, 'total') / soma(series, 'vagas')},
  });
}

function mapaCalor(el, pontos, titulo) {
  if (!window.L) { el.innerHTML = vazio('O mapa precisa de internet para carregar (Leaflet via CDN).'); return; }
  const sede = D.meta.sede;
  const mapa = L.map(el, {scrollWheelZoom: false}).setView(sede, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 18, attribution: '© OpenStreetMap'}).addTo(mapa);
  if (L.heatLayer) L.heatLayer(pontos.map(p => [p[0], p[1], 0.6]), {radius: 22, blur: 18, maxZoom: 15}).addTo(mapa);
  L.circle(sede, {radius: 5000, color: '#2563eb', weight: 1.5, fillOpacity: 0.04, dashArray: '6 6'}).addTo(mapa);
  L.circleMarker(sede, {radius: 9, color: '#fff', weight: 3, fillColor: '#0f172a', fillOpacity: 1}).addTo(mapa).bindTooltip(titulo);
  return mapa;
}

function renderAlunado(el) {
  const A = D.alunado, K = A.kpis;
  const delta = A.ritmo.atual - A.ritmo.anterior, deltaP = A.ritmo.anterior ? delta / A.ritmo.anterior : 0;
  const corRitmo = deltaP > 0.01 ? COR.verde : deltaP < -0.01 ? COR.verm : COR.cinza;

  el.innerHTML = `
  <div class="hero">
    <div><h2>Ano letivo ${A.foco}</h2><p>Matrículas efetivadas de ${dataBR(A.periodo.primeira)} a ${dataBR(A.periodo.ultima)} · comparação com ${A.anterior}</p></div>
    <div class="num"><strong>${num(K.total)}</strong><span>alunos cursando</span></div>
    <div class="num"><strong>${pct(K.retencao)}</strong><span>retenção</span></div>
  </div>
  <div class="ritmo-box" style="--c:${corRitmo}">
    <span>Ritmo do ciclo · <b>dia ${A.ritmo.dia}</b> desde a primeira matrícula</span>
    <span><strong>${num(A.ritmo.atual)}</strong> em ${A.foco} · ${num(A.ritmo.anterior)} em ${A.anterior} no mesmo dia</span>
    <span style="color:${corRitmo};font-weight:800">${delta >= 0 ? '+' : ''}${num(delta)} (${delta >= 0 ? '+' : ''}${pct(deltaP)})</span>
  </div>
  <div class="kpis k6 mt">
    ${kpi({rotulo: 'Total de matrículas', valor: num(K.total), sub: `${num(K.registros)} registros (com quem saiu)`, cor: COR.cianoEsc})}
    ${kpi({rotulo: 'Retenção', valor: pct(K.retencao), sub: `${num(K.retidos)} de ${num(K.elegiveis_ant)} que podiam voltar`, cor: COR.laranjaEsc})}
    ${kpi({rotulo: `Novatos vs ${A.anterior}`, valor: num(K.novatos_ant), sub: `${pct(K.novatos_ant / K.total)} · não estavam em ${A.anterior}`, cor: COR_NOV})}
    ${kpi({rotulo: `Veteranos vs ${A.anterior}`, valor: num(K.veteranos_ant), sub: `${pct(K.veteranos_ant / K.total)} · já estavam em ${A.anterior}`, cor: COR_VET})}
    ${kpi({rotulo: 'Novatos (captação)', valor: num(K.novatos_captacao), sub: `${pct(K.novatos_captacao / K.total)} · primeira matrícula na escola`, cor: COR_NOV})}
    ${kpi({rotulo: 'Veteranos (captação)', valor: num(K.veteranos_captacao), sub: `${pct(K.veteranos_captacao / K.total)} · inclui ex-alunos que voltaram`, cor: COR_VET})}
  </div>
  <div class="grid g2" id="aluG1"></div>
  <div class="mt" id="aluCal"></div>
  <div class="grid g2" id="aluG2"></div>
  <div class="grid g12" id="aluG3"></div>
  <div class="sec-t">Evasão</div>
  <div class="grid g12" id="aluEva"></div>
  <div class="sec-t">Ocupação das turmas</div>
  <div class="mt" id="aluOcup"></div>
  <div class="mt" id="aluMapa"></div>
  <p class="nota">Contam como matrícula os alunos cursando em série curricular (infantil, fundamental e médio). Retenção é veteranos sobre a base do ano anterior, sem os formandos.</p>`;

  // mensal empilhado + acumulado por dia do ciclo
  const C = A.ciclo;
  const rotCiclo = C.atual.map((_, i) => diaMes(somarDias(C.inicio_atual, i)));
  $('#aluG1').innerHTML =
    card('Matrículas por mês', legenda([{nome: 'Veteranos', cor: COR_VET}, {nome: 'Novatos', cor: COR_NOV}]) +
      grafBarras({W: LG.metade, rotulos: A.mensal.map(m => mesCurto(m.mes) + '/' + m.mes.slice(2, 4)), empilhado: true, total: true, h: 270,
        series: [{nome: 'Veteranos', cor: COR_VET, valores: A.mensal.map(m => m.veteranos)}, {nome: 'Novatos', cor: COR_NOV, valores: A.mensal.map(m => m.novatos)}]}),
      {sub: 'Pela data em que a matrícula foi efetivada'}) +
    card('Acumulado por dia do ciclo', legenda([{nome: String(A.foco), cor: COR_NOV, tipo: 'linha'}, {nome: String(A.anterior), cor: COR.cinza, tipo: 'traco'}]) +
      grafLinhas({W: LG.metade, rotulos: rotCiclo, h: 270, series: [
        {nome: String(A.anterior), cor: COR.cinza, valores: C.anterior, tracejado: true},
        {nome: String(A.foco), cor: COR_NOV, valores: C.atual, area: true}]}),
      {sub: `Dia 0 é a primeira matrícula de cada ciclo. Eixo com as datas de ${A.foco}.`});

  // mesmo dia do calendário
  const baseCal = `${A.foco - 1}-08-01`;
  $('#aluCal').innerHTML = card('Acumulado no mesmo dia do calendário', legenda([{nome: String(A.foco), cor: COR_NOV, tipo: 'linha'}, {nome: String(A.anterior), cor: COR.cinza, tipo: 'traco'}]) +
    grafLinhas({rotulos: A.calendario.atual.map((_, i) => diaMes(somarDias(baseCal, i))), h: 260, series: [
      {nome: String(A.anterior), cor: COR.cinza, valores: A.calendario.anterior, tracejado: true},
      {nome: String(A.foco), cor: COR_NOV, valores: A.calendario.atual}]}),
    {sub: 'De 1º de agosto a 31 de julho: compara as duas campanhas na mesma data, sem alinhar pelo início'});

  // matrículas x evasões + diário
  const diario = A.diario.qtd;
  let acc = 0;
  const acumulado = diario.map(v => acc += v);
  $('#aluG2').innerHTML =
    card('Matrículas x evasões (acumulado)', legenda([{nome: `Matrículas ${A.foco}`, cor: COR_NOV, tipo: 'linha'}, {nome: `Matrículas ${A.anterior}`, cor: COR.cinza, tipo: 'traco'},
      {nome: `Evasões ${A.foco}`, cor: COR.verm, tipo: 'linha'}, {nome: `Evasões ${A.anterior}`, cor: '#fca5a5', tipo: 'traco'}]) +
      grafLinhas({W: LG.metade, rotulos: rotCiclo, h: 270, series: [
        {nome: `Matrículas ${A.anterior}`, cor: COR.cinza, valores: C.anterior, tracejado: true},
        {nome: `Matrículas ${A.foco}`, cor: COR_NOV, valores: C.atual},
        {nome: `Evasões ${A.anterior}`, cor: '#fca5a5', valores: C.evasoes_anterior, tracejado: true},
        {nome: `Evasões ${A.foco}`, cor: COR.verm, valores: C.evasoes_atual}]}),
      {sub: 'Evasão: aluno que saiu durante o ano (desistência, abandono ou transferência)'}) +
    card('Matrículas por dia', legenda([{nome: 'No dia', cor: COR_NOV}, {nome: 'Acumulado (eixo da direita)', cor: COR_VET, tipo: 'linha'}]) +
      grafBarras({W: LG.metade, rotulos: diario.map((_, i) => diaMes(somarDias(A.diario.inicio, i))), h: 270, rotuloTip: i => dataBR(somarDias(A.diario.inicio, i)),
        series: [{nome: 'No dia', cor: COR_NOV, valores: diario}],
        linhas: [{nome: 'Acumulado', cor: COR_VET, valores: acumulado, dir: true, pontos: false}]}));

  // segmento + tabela de séries
  $('#aluG3').innerHTML = card('Por segmento', legenda([{nome: 'Veteranos', cor: COR_VET}, {nome: 'Novatos', cor: COR_NOV}]) +
    barrasHEmp(A.segmentos.map(s => ({nome: s.segmento, ...s})), [{k: 'veteranos', nome: 'Veteranos', cor: COR_VET}, {k: 'novatos', nome: 'Novatos', cor: COR_NOV}])) +
    card('Por série', '<div id="aluSeries"></div>', {sub: 'Clique no título da coluna para ordenar'});
  tabelaSeries($('#aluSeries'), A.series);

  // evasão
  const E = A.evasao, EM = A.evasao_mensal;
  const mesAtual = +HOJE.slice(5, 7);
  $('#aluEva').innerHTML =
    card(`De ${A.anterior} para ${A.foco}`, `<div class="kpis" style="grid-template-columns:1fr 1fr">
      ${kpi({rotulo: 'Não voltaram', valor: num(E.evadidos), cor: COR.vermEsc, sub: 'saíram entre um ano e outro'})}
      ${kpi({rotulo: '% de evasão', valor: pct(E.pct), cor: COR.vermEsc, sub: 'sobre quem podia voltar'})}
      ${kpi({rotulo: 'Podiam voltar', valor: num(E.elegiveis), cor: COR.ink, sub: `alunos de ${A.anterior}`})}
      ${kpi({rotulo: 'Formandos', valor: num(E.formandos), cor: COR.cinzaEsc, sub: 'fora da conta'})}</div>
      <div class="mt">${barrasH(E.por_serie.map(s => ({nome: `${s.serie} <small style="color:var(--mudo)">${SIGLA_SEG[s.segmento]}</small>`, valor: s.qtd, cor: COR_SEG[s.segmento]})), {fmt: v => num(v) + (v === 1 ? ' aluno' : ' alunos')})}</div>`,
      {sub: 'Série de origem de quem não renovou'}) +
    card('Saídas durante o ano, por mês', legenda([{nome: String(A.anterior), cor: COR.roxo}, {nome: String(A.foco), cor: COR.azul}]) +
      grafBarras({W: LG.maior, rotulos: MES_CURTO, h: 300, valores: true, series: [
        {nome: String(A.anterior), cor: COR.roxo, valores: EM.anterior},
        {nome: String(A.foco), cor: COR.azul, valores: EM.atual.map((v, i) => i < mesAtual ? v : null)}]}),
      {sub: 'Pela data em que o aluno ficou inativo'});

  // ocupação das turmas
  const faixas = [['#94a3b8', '< 25%'], ['#f97316', '25–49%'], ['#eab308', '50–74%'], ['#22c55e', '75–94%'], ['#15803d', '95–100%'], ['#dc2626', '> 100%']];
  $('#aluOcup').innerHTML = card('Mapa de ocupação', legenda(faixas.map(([c, n]) => ({nome: n, cor: c}))) + SEGMENTOS.map(seg => {
    const ts = A.turmas.filter(t => t.segmento === seg);
    return `<h4 style="margin:14px 0 8px;font-size:12.5px;color:var(--mudo)">${seg} · ${ts.length} turmas · ${num(soma(ts, 'matriculados'))} alunos</h4><div class="ocup">${ts.map(t => {
      const [c] = faixaOcupacao(t.pct);
      return `<div class="ocup-c" style="--c:${c}"><div class="t">${t.turma}<span class="turno">${t.turno}</span></div><strong>${pct(t.pct, 0)}</strong><small>${t.matriculados} de ${t.vagas} vagas</small>${barraProgresso([{v: Math.min(t.pct, 1), cor: c}], 6)}</div>`;
    }).join('')}</div>`;
  }).join(''), {sub: 'Alunos cursando sobre as vagas de cada turma'});

  // mapa
  $('#aluMapa').innerHTML = card('Onde moram os alunos', '<div class="mapa" id="aluMapaEl"></div>', {
    sub: `${num(A.mapa.length)} endereços (fictícios) · círculo de 5 km ao redor da escola`,
    acoes: '<button class="btn" id="aluMapaCheia">Tela cheia</button>'});
  const mapa = mapaCalor($('#aluMapaEl'), A.mapa, D.meta.escola);
  const alternar = forcar => {
    const m = $('#aluMapaEl');
    m.classList.toggle('cheia', forcar);
    $('#aluMapaCheia').textContent = m.classList.contains('cheia') ? 'Sair da tela cheia (Esc)' : 'Tela cheia';
    if (mapa) setTimeout(() => mapa.invalidateSize(), 50);
  };
  $('#aluMapaCheia').addEventListener('click', () => alternar());
  addEventListener('keydown', e => { if (e.key === 'Escape' && $('#aluMapaEl').classList.contains('cheia')) alternar(false); });
}
