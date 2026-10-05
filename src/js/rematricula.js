// Aba Rematrícula: campanha de matrícula do ano que vem, comparada com os ciclos anteriores.

function renderRematricula(el) {
  const R = D.rematricula, K = R.kpis;
  const diasCampanha = R.diario.map((_, i) => somarDias(R.inicio, i));

  // matrículas de ontem; se ontem não teve nada, mostra o último dia com movimento
  let iOntem = diasCampanha.indexOf(ONTEM), rotuloOntem = 'Matrículas de ontem';
  if (iOntem < 0 || soma(R.diario[iOntem]) === 0) {
    for (let i = R.diario.length - 1; i >= 0; i--) {
      if (diasCampanha[i] < HOJE && soma(R.diario[i])) { iOntem = i; rotuloOntem = `Último dia com matrícula (${diaMes(diasCampanha[i])})`; break; }
    }
  }
  const ontem = iOntem >= 0 ? R.diario[iOntem] : [0, 0];
  const coresCiclo = ['#94a3b8', '#0ea5e9', '#db2777'];
  const atual = R.ritmo.find(r => r.atual);
  const dec = R.decisoes, base = K.total_ano_atual;

  el.innerHTML = `
  <div class="card-h" style="margin-bottom:14px"><div><h2 style="font-size:20px">Rematrícula ${R.anterior} → ${R.foco}</h2>
    <p class="nota" style="margin-top:4px">Campanha aberta em ${dataBR(R.inicio)} · dia ${R.dia} · atualizado em ${dataBR(HOJE)}</p></div></div>
  <div class="kpis k4">
    ${kpi({rotulo: `Matriculados para ${R.foco}`, valor: num(K.total), sub: `${pct(K.total / base)} da base atual de ${num(base)}`, cor: COR.rosa})}
    ${kpi({rotulo: rotuloOntem, valor: num(soma(ontem)), sub: `${ontem[0]} veteranos · ${ontem[1]} novos`, cor: COR.ink})}
    ${kpi({rotulo: 'Veteranos (rematrícula)', valor: num(K.veteranos), sub: `${pct(K.veteranos / K.total)} das matrículas`, cor: COR.verdeEsc})}
    ${kpi({rotulo: 'Novos', valor: num(K.novatos), sub: `${pct(K.novatos / K.total)} das matrículas`, cor: COR.azul})}
  </div>
  <div class="sec-t">Ritmo da campanha no dia ${R.dia}</div>
  <div class="ciclos">${R.ritmo.map((r, i) => {
    const dif = r.no_dia - atual.no_dia;
    return `<div class="ciclo" style="--c:${coresCiclo[i]}"><span class="ano">Ciclo ${r.ano} ${r.atual ? pill('HOJE', 'azul') : ''}</span>
      <strong>${num(r.no_dia)}</strong><span class="nota">${r.atual ? `matrículas até hoje · ${pct(r.no_dia / R.ritmo[1].total_final)} do total final de ${R.ritmo[1].ano}` : `no mesmo dia · fechou com ${num(r.total_final)} (${pct(r.no_dia / r.total_final, 0)} no dia ${R.dia})`}</span>
      ${r.atual ? '' : `<div style="margin-top:6px">${pill(`${dif > 0 ? '+' : ''}${num(dif)} vs ${atual.ano}`, dif > 0 ? 'ruim' : 'bom')}</div>`}
      ${barraProgresso([{v: Math.min(1, r.no_dia / Math.max(...R.ritmo.map(x => x.total_final))), cor: coresCiclo[i]}], 6)}</div>`;
  }).join('')}</div>
  <div class="sec-t">Quem ainda está em ${R.anterior}</div>
  <div class="grid g12" style="margin-top:12px">
    ${card('Decisão da base atual', `<div class="kpis" style="grid-template-columns:1fr 1fr">
      ${kpi({rotulo: 'Já rematricularam', valor: num(dec.rematriculado), sub: pct(dec.rematriculado / (base - dec.formando)) + ' de quem pode renovar', cor: COR.verdeEsc})}
      ${kpi({rotulo: 'Ainda não decidiram', valor: num(dec.pendente), sub: 'foco da secretaria', cor: COR.laranja})}
      ${kpi({rotulo: 'Não vão renovar', valor: num(dec.nao_renova), sub: pct(dec.nao_renova / (base - dec.formando)) + ' de quem pode renovar', cor: COR.vermEsc})}
      ${kpi({rotulo: 'Formandos', valor: num(dec.formando), sub: '3ª série, fora da conta', cor: COR.cinzaEsc})}</div>`)}
    ${card('Decisão por segmento', legenda([{nome: 'Rematriculou', cor: COR.verde}, {nome: 'Pendente', cor: '#fdba74'}, {nome: 'Não renova', cor: COR.verm}, {nome: 'Formando', cor: '#cbd5e1'}]) +
      barrasHEmp(R.decisoes_segmento.map(s => ({nome: s.segmento, ...s})), [
        {k: 'rematriculado', nome: 'Rematriculou', cor: COR.verde}, {k: 'pendente', nome: 'Pendente', cor: '#fdba74'},
        {k: 'nao_renova', nome: 'Não renova', cor: COR.verm}, {k: 'formando', nome: 'Formando', cor: '#cbd5e1'}]),
      {sub: 'Alunos cursando hoje, por segmento atual'})}
  </div>
  <div class="grid g2" id="remG1"></div>
  <div class="grid g2" id="remG2"></div>
  <div class="mt" id="remDia"></div>
  <div class="grid g12" id="remG3"></div>
  <p class="nota">Conta como matrícula quem já está com a matrícula de ${R.foco} efetivada; reserva de vaga não entra. Veterano é quem está matriculado nos dois anos.</p>`;

  const C = R.ciclo;
  const rotCiclo = C.anterior.map((_, i) => `dia ${i}`);
  const atualLongo = C.atual.concat(Array(C.anterior.length - C.atual.length).fill(null));
  let acc = 0;
  const acumulado = R.diario.map(d => acc += soma(d));
  $('#remG1').innerHTML =
    card(`Matrículas para ${R.foco} (acumulado)`, grafLinhas({W: LG.metade, rotulos: diasCampanha.map(diaMes), h: 270, series: [
      {nome: String(R.foco), cor: COR.roxo, valores: acumulado, area: true}]}), {sub: 'Desde a abertura da campanha'}) +
    card('Comparação por dia de campanha', legenda([{nome: String(R.foco), cor: COR.rosa, tipo: 'linha'}, {nome: String(R.anterior), cor: COR.cinza, tipo: 'traco'}]) +
      grafLinhas({W: LG.metade, rotulos: rotCiclo, h: 270, marcas: [{i: R.dia, texto: 'hoje'}], series: [
        {nome: String(R.anterior), cor: COR.cinza, valores: C.anterior, tracejado: true},
        {nome: String(R.foco), cor: COR.rosa, valores: atualLongo}]}), {sub: 'Dia 0 é a abertura de cada campanha'});

  const baseCal = `${R.foco - 1}-08-01`;
  $('#remG2').innerHTML =
    card('Mesmo dia do calendário', legenda([{nome: String(R.foco), cor: COR.rosa, tipo: 'linha'}, {nome: String(R.anterior), cor: COR.cinza, tipo: 'traco'}]) +
      grafLinhas({W: LG.metade, rotulos: R.calendario.atual.map((_, i) => diaMes(somarDias(baseCal, i))), h: 270, series: [
        {nome: String(R.anterior), cor: COR.cinza, valores: R.calendario.anterior, tracejado: true},
        {nome: String(R.foco), cor: COR.rosa, valores: R.calendario.atual}]}), {sub: 'De 1º de agosto em diante'}) +
    card('Matrículas x evasões (acumulado)', legenda([{nome: `Matrículas ${R.foco}`, cor: COR.rosa, tipo: 'linha'}, {nome: `Matrículas ${R.anterior}`, cor: COR.cinza, tipo: 'traco'},
      {nome: `Evasões (${R.anterior})`, cor: COR.verm, tipo: 'linha'}, {nome: `Evasões (${R.anterior - 1})`, cor: '#fca5a5', tipo: 'traco'}]) +
      grafLinhas({W: LG.metade, rotulos: C.atual.map((_, i) => `dia ${i}`), h: 270, series: [
        {nome: `Matrículas ${R.anterior}`, cor: COR.cinza, valores: C.anterior.slice(0, C.atual.length), tracejado: true},
        {nome: `Matrículas ${R.foco}`, cor: COR.rosa, valores: C.atual},
        {nome: `Evasões (${R.anterior - 1})`, cor: '#fca5a5', valores: C.evasoes_anterior, tracejado: true},
        {nome: `Evasões (${R.anterior})`, cor: COR.verm, valores: C.evasoes_atual}]}),
      {sub: 'Saídas durante o ano letivo no mesmo período da campanha'});

  $('#remDia').innerHTML = card('Matrículas por dia', legenda([{nome: 'Veteranos', cor: COR.verde}, {nome: 'Novos', cor: COR.azul}, {nome: 'Acumulado (eixo da direita)', cor: COR.roxo, tipo: 'linha'}]) +
    grafBarras({rotulos: diasCampanha.map(diaMes), empilhado: true, h: 260, rotuloTip: i => dataBR(diasCampanha[i]),
      series: [{nome: 'Veteranos', cor: COR.verde, valores: R.diario.map(d => d[0])}, {nome: 'Novos', cor: COR.azul, valores: R.diario.map(d => d[1])}],
      linhas: [{nome: 'Acumulado', cor: COR.roxo, valores: acumulado, dir: true, pontos: false}]}));

  const partes = [{k: 'veteranos', nome: 'Veteranos', cor: COR.verde}, {k: 'novatos', nome: 'Novos', cor: COR.azul}];
  $('#remG3').innerHTML =
    card('Por segmento', legenda(partes) + barrasHEmp(R.segmentos.map(s => ({nome: s.segmento, ...s})), partes)) +
    card('Por série', legenda(partes) + barrasHEmp(R.series.map(s => ({nome: `${s.serie} · ${SIGLA_SEG[s.segmento]}`, ...s})), partes), {sub: 'Série em que o aluno vai estudar em ' + R.foco});
}
