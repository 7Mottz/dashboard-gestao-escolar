// Aba Funil: leads do CRM, do primeiro contato até a matrícula.

const PLANO_KEY = 'painel-planejamento';
const CAM_PCT = 0.2;  // custo de aquisição por matrícula = 20% da mensalidade

function planejamentoAtual() {
  try {
    const salvo = JSON.parse(localStorage.getItem(PLANO_KEY) || 'null');
    if (salvo && salvo.meta_alunos) return salvo;
  } catch (e) { /* sem acesso ao localStorage */ }
  return {...D.meta.planejamento};
}

function calcPlano(P) {
  const rem = Math.round(P.alunos_atuais * P.taxa_rematricula / 100);
  const novos = Math.max(0, P.meta_alunos - rem);
  const cam = P.mensalidade * CAM_PCT;
  return {rem, novos, saem: P.alunos_atuais - rem, crescimento: P.meta_alunos / P.alunos_atuais - 1, cam, investimento: novos * cam};
}

const contarFunil = ls => [ls.length, ls.filter(l => l.conversa).length, ls.filter(l => l.agendou).length, ls.filter(l => l.visitou).length, ls.filter(l => l.matriculou).length];
const div0 = (a, b) => b ? a / b : NaN;
function taxasFunil(ls) {
  const t = contarFunil(ls);
  return {t, contato: div0(t[1], t[0]), ag: div0(t[2], t[1]), re: div0(t[3], t[2]), fe: div0(t[4], t[3]), total: div0(t[4], t[0])};
}
function statusRef(v, ref) {
  if (!isFinite(v)) return ['sem dados', 'neutro'];
  const d = v - ref;
  return d > 0.03 ? ['acima do mercado', 'bom'] : d < -0.03 ? ['abaixo do mercado', 'ruim'] : ['na média do mercado', 'medio'];
}

function renderFunil(el) {
  const FU = D.funil, REF = FU.referencia;
  const todos = expandir(FU.leads);
  const filtro = {funil: FU.funil_atual, origem: '', de: '', ate: ''};
  const origens = [...new Set(todos.map(l => l.origem))];
  let aba = 'geral';

  el.innerHTML = `
  <div class="filtros">
    <label>Funil <select id="fuFunil"><option value="">Todos</option>${FU.funis.map(f => `<option ${f === filtro.funil ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
    <label>Leads criados de <input type="date" id="fuDe"></label>
    <label>até <input type="date" id="fuAte"></label>
    <label>Origem <select id="fuOrigem"><option value="">Todas</option>${origens.map(o => `<option>${o}</option>`).join('')}</select></label>
    <button class="link" id="fuLimpar">Limpar filtros</button>
    <button class="btn" id="fuPlano">Planejamento</button>
  </div>
  <nav class="sub" id="fuSub"></nav>
  <div id="fuCorpo"></div>
  <div class="modal-fundo" id="fuModal" hidden></div>`;

  const doFunil = () => todos.filter(l => (!filtro.funil || l.funil === filtro.funil) && (!filtro.origem || l.origem === filtro.origem));
  const filtrados = () => doFunil().filter(l => (!filtro.de || l.criado >= filtro.de) && (!filtro.ate || l.criado <= filtro.ate));

  const SUBS = [
    {id: 'geral', nome: 'Visão geral'}, {id: 'meta', nome: 'Meta'}, {id: 'mudou', nome: 'O que mudou'}, {id: 'mercado', nome: 'Escola × mercado'},
    {id: 'origem', nome: 'Origem dos leads'}, {id: 'perdas', nome: 'Motivos de perda'}, {id: 'parados', nome: 'Leads parados'},
  ];
  const desenhar = () => ({geral, meta, mudou, mercado, origem, perdas, parados})[aba]($('#fuCorpo'));
  subAbas($('#fuSub'), SUBS, id => { aba = id; desenhar(); });
  const ler = () => {
    filtro.funil = $('#fuFunil').value; filtro.origem = $('#fuOrigem').value;
    filtro.de = $('#fuDe').value; filtro.ate = $('#fuAte').value;
    desenhar();
  };
  ['#fuFunil', '#fuOrigem', '#fuDe', '#fuAte'].forEach(s => $(s).addEventListener('change', ler));
  $('#fuLimpar').addEventListener('click', () => { $('#fuFunil').value = FU.funil_atual; $('#fuOrigem').value = ''; $('#fuDe').value = ''; $('#fuAte').value = ''; ler(); });
  $('#fuPlano').addEventListener('click', abrirPlanejamento);

  // ---------- 1. visão geral
  function geral(alvo) {
    const ls = filtrados(), T = taxasFunil(ls), t = T.t;
    const porMes = {};
    ls.forEach(l => { const m = l.criado.slice(0, 7); (porMes[m] = porMes[m] || {leads: 0, mat: 0}).leads++; });
    ls.forEach(l => { if (l.matriculou) { const m = l.matriculou.slice(0, 7); (porMes[m] = porMes[m] || {leads: 0, mat: 0}).mat++; } });
    const meses = Object.keys(porMes).sort().slice(-24);
    const tours = {};
    ls.filter(l => l.visitou).forEach(l => { const k = l.tour || 'Sem registro de tour'; const x = tours[k] || (tours[k] = {nome: k, vis: 0, mat: 0}); x.vis++; if (l.matriculou) x.mat++; });
    const regua = (nome, v, ref, sub) => {
      const [txt, cls] = ref == null ? ['sem referência', 'neutro'] : statusRef(v, ref);
      return `<div class="taxa"><span>${nome}</span><strong>${pct(v, 0)}</strong><div class="ref-t"><div style="width:${Math.min(v || 0, 1) * 100}%;background:${cls === 'bom' ? COR.verde : cls === 'ruim' ? COR.verm : cls === 'medio' ? COR.ambar : COR.roxo}"></div>${ref != null ? `<i style="left:${ref * 100}%" data-tip="Referência de mercado: ${pct(ref, 0)}"></i>` : ''}</div>
        <span>${sub}${ref != null ? ` · mercado ${pct(ref, 0)}` : ''}</span><br>${pill(txt, cls)}</div>`;
    };
    alvo.innerHTML = `
      <div class="kpis k6 mt">
        ${ETAPAS_FUNIL.map((e, i) => kpi({rotulo: e, valor: num(t[i]), cor: CORES_FUNIL[i][2],
          sub: i === 0 ? 'no filtro selecionado' : `${pct(t[i] / t[i - 1], 0)} ${['', 'dos leads', 'das conversas', 'dos agendamentos', 'das visitas'][i]}`})).join('')}
        ${kpi({rotulo: 'Conversão total', valor: pct(T.total), sub: 'de lead para matrícula', classe: 'escuro'})}
      </div>
      <div class="card mt"><div class="card-h"><div><h3>Funil do período</h3><p>Cada lead conta em todas as etapas que alcançou, inclusive os que foram perdidos depois. O traço preto nas réguas é a referência de mercado.</p></div></div>
        ${funilVisual(t)}
        <div class="taxas">${regua('Lead → conversa', T.contato, null, 'contato')}${regua('Conversa → agendamento', T.ag, REF.agendou, 'agendamento')}${regua('Agendamento → visita', T.re, REF.visitou, 'comparecimento')}${regua('Visita → matrícula', T.fe, REF.matriculou, 'fechamento')}</div>
        <p class="nota">Como cada etapa é contada: conversa é o lead que saiu de "sem contato"; visita agendada inclui quem já passou dela; visita realizada inclui quem fez tour ou está em pré-matrícula; matrícula é o status matriculado.</p></div>
      <div class="grid g21">
        ${card('Leads e matrículas por mês', legenda([{nome: 'Leads (pela criação)', cor: COR.ciano}, {nome: 'Matrículas (eixo da direita)', cor: COR.verde, tipo: 'linha'}]) +
          grafBarras({W: LG.maior, rotulos: meses.map(m => mesCurto(m) + '/' + m.slice(2, 4)), h: 270, series: [{nome: 'Leads', cor: COR.ciano, valores: meses.map(m => porMes[m].leads)}],
            linhas: [{nome: 'Matrículas', cor: COR.verde, valores: meses.map(m => porMes[m].mat), dir: true, rotular: true}]}), {sub: 'Últimos 24 meses do filtro'})}
        ${card('Visitas por quem conduziu o tour', '<div id="fuTours"></div>', {sub: 'Visitas realizadas no filtro e quantas viraram matrícula'})}
      </div>`;
    new Tabela($('#fuTours'), {linhas: Object.values(tours), ordem: {k: 'vis', dir: -1}, colunas: [
      {k: 'nome', l: 'Responsável'}, {k: 'vis', l: 'Visitas', n: 1, f: v => num(v)}, {k: 'mat', l: 'Matrículas', n: 1, f: v => num(v)},
      {k: 'conv', l: 'Fechamento', n: 1, f: (v, r) => pct(r.mat / r.vis), v: r => r.mat / r.vis}]});
  }

  // ---------- 2. meta
  let usarMercado = false, visaoMeta = 'semana';
  function meta(alvo) {
    const P = planejamentoAtual(), C = calcPlano(P);
    const ini = P.inicio, fim = P.fim, metaN = C.novos;
    const ls = doFunil();
    const T = taxasFunil(ls);
    const tx = usarMercado ? {contato: T.contato, ag: REF.agendou, re: REF.visitou, fe: REF.matriculou} : T;
    const mats = ls.filter(l => l.matriculou && l.matriculou >= ini && l.matriculou <= fim);
    const feitasAte = d => mats.filter(l => l.matriculou <= d).length;
    const feitas = feitasAte(HOJE);
    const totalDias = difDias(ini, fim) + 1, passados = Math.max(0, Math.min(totalDias, difDias(ini, HOJE) + 1));
    const esperado = Math.round(metaN * passados / totalDias);
    const gap = feitas - esperado;
    const ritmoOk = gap >= 0 ? ['no ritmo', 'bom'] : gap >= -Math.max(2, metaN * 0.05) ? ['um pouco abaixo', 'medio'] : ['abaixo do ritmo', 'ruim'];

    // semanas de 7 dias a partir do início; semana passada mantém a meta que tinha
    const semanas = [];
    for (let s = ini; s <= fim; s = somarDias(s, 7)) semanas.push({ini: s, fim: [somarDias(s, 6), fim].sort()[0]});
    let restante = metaN;
    const iAtual = semanas.findIndex(w => HOJE >= w.ini && HOJE <= w.fim);
    semanas.forEach((w, i) => {
      w.feitas = mats.filter(l => l.matriculou >= w.ini && l.matriculou <= w.fim).length;
      w.leads = ls.filter(l => l.criado >= w.ini && l.criado <= w.fim).length;
      if (iAtual === -1 || i < iAtual) {
        const antes = feitasAte(somarDias(w.ini, -1));
        w.meta = Math.max(0, Math.ceil((metaN - antes) / (semanas.length - i)));
      }
    });
    if (iAtual >= 0) {
      const antes = feitasAte(somarDias(semanas[iAtual].ini, -1));
      restante = Math.max(0, metaN - antes);
      const n = semanas.length - iAtual, base = Math.floor(restante / n), sobra = restante % n;
      for (let i = iAtual; i < semanas.length; i++) semanas[i].meta = base + (i - iAtual < sobra ? 1 : 0);
    }
    const necessario = m => {
      const vis = Math.ceil(m / tx.fe), ag = Math.ceil(vis / tx.re), conv = Math.ceil(ag / tx.ag), leads = Math.ceil(conv / tx.contato);
      return {vis, ag, conv, leads};
    };
    // mês de cada semana = mês do dia do meio
    const meses = {};
    semanas.forEach(w => {
      const k = somarDias(w.ini, 3).slice(0, 7);
      const m = meses[k] || (meses[k] = {k, ini: w.ini, fim: w.fim, meta: 0, feitas: 0, leads: 0});
      m.meta += w.meta; m.feitas += w.feitas; m.leads += w.leads; m.fim = w.fim;
    });
    const periodos = visaoMeta === 'semana' ? semanas.map((w, i) => ({...w, rot: `Semana ${i + 1}`, atual: i === iAtual}))
      : Object.values(meses).map(m => ({...m, rot: mesDe(m.k + '-01').replace(/^./, c => c.toUpperCase()), atual: HOJE >= m.ini && HOJE <= m.fim}));
    let acc = 0;
    periodos.forEach(p => { acc += p.feitas; p.acum = acc; p.passado = p.fim < HOJE; });
    const sem = iAtual >= 0 ? semanas[iAtual] : null;
    const nec = sem ? necessario(sem.meta) : null;
    const corBarra = p => p.atual ? COR.azul : p.passado ? (p.feitas >= p.meta ? COR.verde : COR.verm) : '#cbd5e1';

    alvo.innerHTML = `
      <div class="ritmo-box" style="--c:${COR.ambar};margin-top:16px">
        <span>Alunos atuais <b>${num(P.alunos_atuais)}</b> · rematrícula esperada <b>${num(C.rem)}</b> (${P.taxa_rematricula}%) · meta <b>${num(P.meta_alunos)}</b> · novas matrículas <b>${num(metaN)}</b></span>
        <span>${dataBR(ini)} a ${dataBR(fim)} · mensalidade ${brlInt(P.mensalidade)} · CAM ${brlInt(C.cam)}</span>
        <div class="seg-btns" id="fuTx"><button data-v="0" class="${usarMercado ? '' : 'on'}">Taxas da escola</button><button data-v="1" class="${usarMercado ? 'on' : ''}">Taxas de mercado</button></div>
      </div>
      <div class="hero-meta mt">
        <div class="card">${sem ? `<h3>Matrículas necessárias nesta semana</h3><p class="nota" style="margin:2px 0 10px">${dataBR(sem.ini)} a ${dataBR(sem.fim)}</p>
          <div class="grande">${num(sem.meta)}</div>
          <div class="kpis k4 mt">${kpi({rotulo: 'Leads', valor: num(nec.leads), cor: CORES_FUNIL[0][2]})}${kpi({rotulo: 'Conversas', valor: num(nec.conv), cor: CORES_FUNIL[1][2]})}${kpi({rotulo: 'Agendamentos', valor: num(nec.ag), cor: CORES_FUNIL[2][2]})}${kpi({rotulo: 'Visitas', valor: num(nec.vis), cor: CORES_FUNIL[3][2]})}</div>
          <p class="nota">Investimento da semana: <b>${brl(sem.meta * C.cam)}</b> · do mês: <b>${brl((meses[somarDias(sem.ini, 3).slice(0, 7)] || {meta: 0}).meta * C.cam)}</b></p>`
          : `<h3>${HOJE < ini ? 'A campanha ainda não começou' : 'Campanha encerrada'}</h3>`}</div>
        <div class="card"><h3>Andamento da campanha ${pill(ritmoOk[0], ritmoOk[1])}</h3>
          <div class="progresso"><span class="marca-t" style="left:${Math.min(esperado / metaN, 1) * 100}%">esperado hoje: <b>${num(esperado)}</b></span>
            <div class="trilho"><div class="cheio" style="width:${Math.min(feitas / metaN, 1) * 100}%"></div><div class="marca-p" style="left:${Math.min(esperado / metaN, 1) * 100}%"></div></div></div>
          <div class="eixo-p"><span>0</span><span>${pct(feitas / metaN)} da meta</span><span>${num(metaN)}</span></div>
          <div class="kpis mt" style="grid-template-columns:1fr 1fr">
            ${kpi({rotulo: 'Realizadas', valor: num(feitas), cor: COR.verdeEsc})}${kpi({rotulo: 'Faltam', valor: num(Math.max(0, metaN - feitas)), cor: COR.laranjaEsc})}
            ${kpi({rotulo: 'Diferença p/ o esperado', valor: (gap >= 0 ? '+' : '') + num(gap), cor: gap >= 0 ? COR.verdeEsc : COR.vermEsc})}
            ${kpi({rotulo: 'Investimento da campanha', valor: brl(C.investimento), sub: `saldo: ${brl(Math.max(0, metaN - feitas) * C.cam)}`, cor: COR.ink})}</div></div>
      </div>
      <div class="card mt"><div class="card-h"><div><h3>Meta x realizado</h3><p>Barras: matrículas feitas (verde bateu, vermelho não bateu, azul é o período atual). Linha: meta.</p></div>
        <div class="seg-btns" id="fuVisao"><button data-v="semana" class="${visaoMeta === 'semana' ? 'on' : ''}">Por semana</button><button data-v="mes" class="${visaoMeta === 'mes' ? 'on' : ''}">Por mês</button></div></div>
        ${grafBarras({rotulos: periodos.map(p => visaoMeta === 'semana' ? diaMes(p.ini) : p.rot.slice(0, 3)), h: 260, rotuloTip: i => periodos[i].rot,
          series: [{nome: 'Feitas', cor: COR.verde, valores: periodos.map(p => p.passado || p.atual ? p.feitas : null)}],
          linhas: [{nome: 'Meta', cor: COR.ink, valores: periodos.map(p => p.meta), tracejado: true}]})}
        <div id="fuMetaTab" class="mt"></div></div>`;
    // recolore as barras conforme bateu ou não a meta
    const rects = $$('#fuCorpo .card:last-child svg rect[rx="3"]');
    periodos.filter(p => p.passado || p.atual).forEach((p, i) => { if (rects[i]) rects[i].setAttribute('fill', corBarra(p)); });
    new Tabela($('#fuMetaTab'), {linhas: periodos.map(p => ({...p, nec: necessario(p.meta)})), ordem: {k: 'ini', dir: 1}, colunas: [
      {k: 'rot', l: visaoMeta === 'semana' ? 'Semana' : 'Mês', v: r => r.ini}, {k: 'ini', l: 'Período', f: (v, r) => `${diaMes(r.ini)} a ${diaMes(r.fim)}`},
      {k: 'meta', l: 'Meta', n: 1}, {k: 'inv', l: 'Investimento', n: 1, f: (v, r) => brl(r.meta * C.cam), v: r => r.meta},
      {k: 'feitas', l: 'Feitas', n: 1, f: (v, r) => r.passado || r.atual ? num(v) : '—'},
      {k: 'res', l: 'Resultado', f: (v, r) => r.passado ? pill(r.feitas >= r.meta ? 'bateu' : `faltaram ${r.meta - r.feitas}`, r.feitas >= r.meta ? 'bom' : 'ruim') : r.atual ? pill('em andamento', 'azul') : '', v: r => r.feitas - r.meta},
      {k: 'acum', l: 'Acumulado', n: 1, f: (v, r) => r.passado || r.atual ? num(v) : '—'},
      {k: 'leads', l: 'Leads recebidos', n: 1, f: (v, r) => r.passado || r.atual ? num(v) : '—'},
      {k: 'nl', l: 'Leads necess.', n: 1, f: (v, r) => num(r.nec.leads), v: r => r.nec.leads}, {k: 'nc', l: 'Conversas', n: 1, f: (v, r) => num(r.nec.conv), v: r => r.nec.conv},
      {k: 'na', l: 'Agendam.', n: 1, f: (v, r) => num(r.nec.ag), v: r => r.nec.ag}, {k: 'nv', l: 'Visitas', n: 1, f: (v, r) => num(r.nec.vis), v: r => r.nec.vis}]});
    $('#fuTx').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { usarMercado = b.dataset.v === '1'; desenhar(); } });
    $('#fuVisao').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { visaoMeta = b.dataset.v; desenhar(); } });
  }

  // ---------- 3. o que mudou
  let periodoMudou = 'semana', mudouDe = '', mudouAte = '';
  function intervalo() {
    const dt = new Date(HOJE + 'T12:00:00'), dow = (dt.getDay() + 6) % 7, seg = somarDias(HOJE, -dow);
    switch (periodoMudou) {
      case 'hoje': return [HOJE, HOJE];
      case 'ontem': return [ONTEM, ONTEM];
      case 'semana': return [seg, HOJE];
      case 'semanaant': return [somarDias(seg, -7), somarDias(seg, -1)];
      case 'mes': return [HOJE.slice(0, 8) + '01', HOJE];
      default: return [mudouDe || somarDias(HOJE, -6), mudouAte || HOJE];
    }
  }
  function mudou(alvo) {
    const [de, ate] = intervalo(), n = difDias(de, ate) + 1;
    const pde = somarDias(de, -n), pate = somarDias(de, -1);
    const ls = doFunil();
    const em = (campo, a, b) => ls.filter(l => l[campo] && l[campo] >= a && l[campo] <= b);
    const campos = [['criado', 'Novos leads'], ['conversa', 'Conversas iniciadas'], ['agendou', 'Visitas agendadas'], ['visitou', 'Visitas realizadas'], ['matriculou', 'Matrículas'], ['perdido', 'Perdas']];
    const atual = campos.map(([c]) => em(c, de, ate).length), ant = campos.map(([c]) => em(c, pde, pate).length);
    const variacao = (a, b, inv) => { const d = a - b; return d === 0 ? 'igual ao período anterior' : `<b style="color:${(d > 0) !== !!inv ? COR.verdeEsc : COR.vermEsc}">${d > 0 ? '+' : ''}${num(d)}</b> vs período anterior (${num(b)})`; };
    const novosPorOrigem = origens.map(o => ({origem: o, periodo: em('criado', de, ate).filter(l => l.origem === o).length, anterior: em('criado', pde, pate).filter(l => l.origem === o).length}))
      .filter(x => x.periodo || x.anterior).map(x => ({...x, var: x.periodo - x.anterior}));
    const eventos = [];
    const nomeEv = {conversa: 'Iniciou conversa', agendou: 'Agendou visita', visitou: 'Fez a visita', matriculou: 'Matriculou'};
    Object.keys(nomeEv).forEach(c => em(c, de, ate).forEach(l => eventos.push({data: l[c], aluno: l.aluno, serie: l.serie, origem: l.origem, mov: nomeEv[c], etapa: l.etapa, termo: l.termometro})));
    const perdasMotivo = {};
    em('perdido', de, ate).forEach(l => perdasMotivo[l.motivo] = (perdasMotivo[l.motivo] || 0) + 1);
    const nDias = Array.from({length: n}, (_, i) => somarDias(de, i));
    const frase = `Entre ${dataBR(de)} e ${dataBR(ate)} chegaram <b>${num(atual[0])}</b> leads novos, <b>${num(atual[3])}</b> famílias visitaram a escola e <b>${num(atual[4])}</b> ${atual[4] === 1 ? 'aluno matriculou' : 'alunos matricularam'}. ${atual[5] ? `<b>${num(atual[5])}</b> leads foram marcados como perdidos.` : ''}`;
    alvo.innerHTML = `
      <div class="filtros mt" id="fuPer">
        ${[['hoje', 'Hoje'], ['ontem', 'Ontem'], ['semana', 'Esta semana'], ['semanaant', 'Semana passada'], ['mes', 'Este mês'], ['custom', 'Escolher datas']].map(([k, n2]) => `<button class="btn ${periodoMudou === k ? 'prim' : ''}" data-p="${k}">${n2}</button>`).join('')}
        ${periodoMudou === 'custom' ? `<label>de <input type="date" id="muDe" value="${de}"></label><label>até <input type="date" id="muAte" value="${ate}"></label>` : ''}
      </div>
      <div class="card mt"><p style="margin:0;font-size:14px">${frase}</p></div>
      <div class="kpis k6 mt">${campos.map(([c, nome], i) => kpi({rotulo: nome, valor: num(atual[i]), sub: variacao(atual[i], ant[i], c === 'perdido'), cor: i < 5 ? CORES_FUNIL[Math.min(i, 4)][2] : COR.vermEsc})).join('')}</div>
      <div class="grid g2">
        ${card('Matrículas do período', '<div id="muMat"></div>')}
        ${card('Novos leads por origem', '<div id="muOrig"></div>', {sub: 'Comparado com o período anterior de mesmo tamanho'})}
      </div>
      <div class="mt">${card('Quem avançou no funil', '<div id="muMov" class="tab-alta"></div>', {sub: 'Cada mudança de etapa registrada no período'})}</div>
      <div class="grid g2">
        ${card('Perdas por motivo', Object.keys(perdasMotivo).length ? barrasH(Object.entries(perdasMotivo).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({nome: k, valor: v, cor: '#f87171'}))) : vazio('Nenhuma perda no período.'))}
        ${card('Novos leads e matrículas por dia', legenda([{nome: 'Novos leads', cor: COR.ciano}, {nome: 'Matrículas', cor: COR.verde}]) +
          grafBarras({W: LG.metade, rotulos: nDias.map(diaMes), h: 230, rotuloTip: i => dataBR(nDias[i]), series: [
            {nome: 'Novos leads', cor: COR.ciano, valores: nDias.map(d => ls.filter(l => l.criado === d).length)},
            {nome: 'Matrículas', cor: COR.verde, valores: nDias.map(d => ls.filter(l => l.matriculou === d).length)}]}))}
      </div>`;
    new Tabela($('#muMat'), {linhas: em('matriculou', de, ate), ordem: {k: 'matriculou', dir: -1}, vazioTxt: 'Nenhuma matrícula no período.', colunas: [
      {k: 'matriculou', l: 'Data', f: v => dataBR(v)}, {k: 'aluno', l: 'Aluno'}, {k: 'serie', l: 'Série'}, {k: 'origem', l: 'Origem'}]});
    new Tabela($('#muOrig'), {linhas: novosPorOrigem, ordem: {k: 'periodo', dir: -1}, vazioTxt: 'Sem leads novos.', colunas: [
      {k: 'origem', l: 'Origem'}, {k: 'periodo', l: 'Período', n: 1}, {k: 'anterior', l: 'Anterior', n: 1},
      {k: 'var', l: 'Variação', n: 1, f: v => `<span class="${v >= 0 ? 'delta-pos' : 'delta-neg'}">${v > 0 ? '+' : ''}${v}</span>`}]});
    new Tabela($('#muMov'), {linhas: eventos, ordem: {k: 'data', dir: -1}, vazioTxt: 'Ninguém mudou de etapa no período.', colunas: [
      {k: 'data', l: 'Detectado em', f: v => dataBR(v)}, {k: 'aluno', l: 'Aluno'}, {k: 'serie', l: 'Série'}, {k: 'origem', l: 'Origem'},
      {k: 'mov', l: 'Movimento', f: v => pill(v, v === 'Matriculou' ? 'bom' : 'azul')}, {k: 'etapa', l: 'Etapa atual'},
      {k: 'termo', l: 'Termômetro', f: v => pill(v.toLowerCase(), v === 'QUENTE' ? 'ruim' : v === 'MORNO' ? 'medio' : 'azul')}]});
    $('#fuPer').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) { periodoMudou = b.dataset.p; desenhar(); } });
    if (periodoMudou === 'custom') ['#muDe', '#muAte'].forEach(s => $(s).addEventListener('change', () => { mudouDe = $('#muDe').value; mudouAte = $('#muAte').value; desenhar(); }));
  }

  // ---------- 4. escola x mercado
  function mercado(alvo) {
    const ls = filtrados(), T = taxasFunil(ls), t = T.t;
    const dicas = {
      ag: ['Responder todo lead novo em até 5 minutos no horário comercial; depois de 1 hora a chance de agendar cai muito.', 'Cadência de retorno definida: 5 tentativas em 7 dias alternando WhatsApp, ligação e áudio.', 'Oferecer dois horários fechados de visita já na primeira conversa.'],
      re: ['Confirmar a visita 24 horas antes e mandar lembrete com a localização no dia.', 'Agendar para no máximo 3 a 5 dias à frente; quanto mais longe, mais falta.', 'Quem faltou recebe contato no mesmo dia com nova data.'],
      fe: ['Roteiro de visita padronizado, com a coordenação da série apresentando a proposta pedagógica.', 'Apresentar valores e condições durante a visita e entregar a proposta por escrito.', 'Retorno em 24 e 72 horas após a visita, com prazo para a condição especial.'],
    };
    // quantas matrículas a mais viriam se só aquela etapa estivesse na referência
    const impacto = k => {
      const r = {ag: T.ag, re: T.re, fe: T.fe};
      r[k] = {ag: REF.agendou, re: REF.visitou, fe: REF.matriculou}[k];
      return Math.round(t[1] * r.ag * r.re * r.fe) - t[4];
    };
    const diag = [['ag', 'Agendamento', T.ag, REF.agendou, 'das conversas viram visita agendada'], ['re', 'Comparecimento', T.re, REF.visitou, 'dos agendamentos comparecem'], ['fe', 'Fechamento', T.fe, REF.matriculou, 'das visitas viram matrícula']];
    const porSerie = FU.series.map(s => { const x = taxasFunil(ls.filter(l => l.serie === s)); return {serie: s, leads: x.t[0], ag: x.t[2], vis: x.t[3], mat: x.t[4], tag: x.ag, tre: x.re, tfe: x.fe, total: x.total}; }).filter(x => x.leads);
    const pillTx = (v, ref) => { const [, cls] = statusRef(v, ref); return pill(pct(v, 0), cls); };
    const semContato = ls.filter(l => !l.conversa).length;
    alvo.innerHTML = `
      <div class="diag mt">${diag.map(([k, nome, v, ref, desc]) => {
        const [txt, cls] = statusRef(v, ref), d = (v - ref) * 100, imp = impacto(k);
        return `<div class="card"><h3>${nome} ${pill(txt, cls)}</h3><p class="nota" style="margin:4px 0 8px">${pct(v, 0)} ${desc}</p>
          <div class="cmp"><span>Escola</span><div class="t"><div style="width:${Math.min(v, 1) * 100}%;background:${cls === 'bom' ? COR.verde : cls === 'ruim' ? COR.verm : COR.ambar}"></div></div><b>${pct(v, 0)}</b></div>
          <div class="cmp"><span>Mercado</span><div class="t"><div style="width:${ref * 100}%;background:${COR.cinza}"></div></div><b>${pct(ref, 0)}</b></div>
          <p class="nota">${d >= 0 ? '+' : ''}${num(d, 1)} p.p. em relação ao mercado.${imp > 0 ? ` Se essa etapa estivesse na média, seriam <b>${num(imp)}</b> matrículas a mais.` : ''}</p>
          ${cls !== 'bom' ? `<p class="nota" style="font-weight:700;color:var(--texto)">O que fazer</p><ul class="checklist">${dicas[k].map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>`;
      }).join('')}</div>
      <div class="grid g21">
        ${card('Escola x mercado por etapa', legenda([{nome: 'Escola', cor: COR.azul}, {nome: 'Mercado', cor: COR.cinza}]) +
          grafBarras({W: LG.maior, rotulos: ['Agendamento', 'Comparecimento', 'Fechamento'], h: 240, valores: true, fmtValor: v => pct(v, 0), fmtEixo: v => pct(v, 0),
            series: [{nome: 'Escola', cor: COR.azul, valores: [T.ag, T.re, T.fe]}, {nome: 'Mercado', cor: COR.cinza, valores: [REF.agendou, REF.visitou, REF.matriculou]}]}))}
        ${card('Contato inicial', `<div style="font-size:40px;font-weight:800;color:${COR.cianoEsc}">${pct(T.contato, 0)}</div><p class="nota" style="margin-top:2px">dos leads tiveram pelo menos uma conversa</p>
          <div class="mini mt" style="--c:${COR.vermEsc}"><span>Nunca foram contatados</span><strong>${num(semContato)}</strong><small>${pct(semContato / t[0], 0)} dos leads do filtro</small></div>
          <p class="nota">Não há referência de mercado para essa etapa, mas é onde costuma estar o maior desperdício.</p>`)}
      </div>
      <div class="mt">${card('Por série de interesse', '<div id="mkSerie"></div>')}</div>`;
    new Tabela($('#mkSerie'), {linhas: porSerie, ordem: {k: 'leads', dir: -1}, colunas: [
      {k: 'serie', l: 'Série'}, {k: 'leads', l: 'Leads', n: 1}, {k: 'ag', l: 'Agend.', n: 1}, {k: 'vis', l: 'Visitas', n: 1}, {k: 'mat', l: 'Matrículas', n: 1},
      {k: 'tag', l: 'Agendamento', n: 1, f: v => pillTx(v, REF.agendou)}, {k: 'tre', l: 'Comparecimento', n: 1, f: v => pillTx(v, REF.visitou)},
      {k: 'tfe', l: 'Fechamento', n: 1, f: v => pillTx(v, REF.matriculou)}, {k: 'total', l: 'Lead → matrícula', n: 1, f: v => pct(v)}],
      total: {serie: 'Total', leads: t[0], ag: t[2], vis: t[3], mat: t[4], tag: T.ag, tre: T.re, tfe: T.fe, total: T.total}});
  }

  // ---------- 5. origem dos leads
  function origem(alvo) {
    const ls = filtrados(), total = ls.length;
    const linhas = origens.map((o, i) => { const x = taxasFunil(ls.filter(l => l.origem === o)); return {origem: o, cor: PALETA[i], leads: x.t[0], share: x.t[0] / total, contato: x.contato, ag: x.ag, re: x.re, fe: x.fe, mat: x.t[4], total: x.total}; })
      .filter(x => x.leads).sort((a, b) => b.leads - a.leads);
    const conv = linhas.filter(x => x.leads >= 10).sort((a, b) => b.total - a.total);
    alvo.innerHTML = `
      <div class="grid g2">
        ${card('Leads e matrículas por origem', legenda([{nome: 'Leads', cor: '#93c5fd'}, {nome: 'Matrículas', cor: COR.verde}]) +
          grafBarras({W: LG.metade, rotulos: linhas.map(x => x.origem.split(' ')[0]), h: 270, valores: true, rotuloTip: i => linhas[i].origem,
            series: [{nome: 'Leads', cor: '#93c5fd', valores: linhas.map(x => x.leads)}, {nome: 'Matrículas', cor: COR.verde, valores: linhas.map(x => x.mat)}]}))}
        ${card('Conversão total por origem', barrasH(conv.map((x, i) => ({nome: x.origem, valor: x.total, cor: i === 0 ? COR.verde : x.cor, destaque: i === 0, extra: `${x.mat} de ${x.leads}`})), {fmt: v => pct(v)}), {sub: 'Matrículas sobre leads, só origens com 10 leads ou mais'})}
      </div>
      <div class="mt">${card('Detalhe por origem', '<div id="orTab"></div>')}</div>`;
    const maxL = Math.max(...linhas.map(x => x.leads));
    new Tabela($('#orTab'), {linhas, ordem: {k: 'leads', dir: -1}, colunas: [
      {k: 'origem', l: 'Origem', f: (v, r) => `${v}<span class="mini-barra"><i style="width:${r.leads / maxL * 100}%;background:${r.cor}"></i></span>`},
      {k: 'leads', l: 'Leads', n: 1}, {k: 'share', l: '% dos leads', n: 1, f: v => pct(v)}, {k: 'contato', l: 'Contato', n: 1, f: v => pct(v, 0)},
      {k: 'ag', l: 'Agendamento', n: 1, f: v => pct(v, 0)}, {k: 're', l: 'Comparecimento', n: 1, f: v => pct(v, 0)}, {k: 'fe', l: 'Fechamento', n: 1, f: v => pct(v, 0)},
      {k: 'mat', l: 'Matrículas', n: 1}, {k: 'total', l: 'Lead → matrícula', n: 1, f: v => pct(v)}]});
  }

  // ---------- 6. motivos de perda
  function perdas(alvo) {
    const ls = filtrados(), perd = ls.filter(l => l.status === 'PERDIDO');
    const cont = lista => { const c = {}; lista.forEach(l => c[l.motivo] = (c[l.motivo] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
    const todos = cont(perd), posVisita = cont(perd.filter(l => l.visitou));
    const visitas = ls.filter(l => l.visitou).length, semContato = perd.filter(l => !l.conversa).length;
    const fase = l => !l.conversa ? 0 : !l.agendou ? 1 : !l.visitou ? 2 : 3;
    const fases = ['Sem contato', 'Conversou e não agendou', 'Agendou e não veio', 'Visitou e não matriculou'];
    const matriz = todos.map(([m]) => { const g = perd.filter(l => l.motivo === m); const o = {motivo: m, total: g.length}; fases.forEach((f, i) => o['f' + i] = g.filter(l => fase(l) === i).length); return o; });
    alvo.innerHTML = perd.length ? `
      <div class="kpis k4 mt">
        ${kpi({rotulo: 'Leads perdidos', valor: num(perd.length), sub: pct(perd.length / ls.length) + ' dos leads', cor: COR.vermEsc})}
        ${kpi({rotulo: 'Principal motivo', valor: todos[0][0], sub: pct(todos[0][1] / perd.length) + ' das perdas', cor: COR.ink})}
        ${kpi({rotulo: 'Perdidos depois da visita', valor: num(perd.filter(l => l.visitou).length), sub: pct(div0(perd.filter(l => l.visitou).length, visitas)) + ' das visitas', cor: COR.laranjaEsc})}
        ${kpi({rotulo: 'Perdidos sem nenhum contato', valor: num(semContato), sub: pct(semContato / perd.length) + ' das perdas', cor: COR.cinzaEsc})}
      </div>
      <div class="grid g2">
        ${card('Motivos de perda', barrasH(todos.slice(0, 12).map(([k, v]) => ({nome: k, valor: v, cor: '#f87171', extra: pct(v / perd.length, 0)}))))}
        ${card('Motivos depois da visita', posVisita.length ? barrasH(posVisita.slice(0, 10).map(([k, v]) => ({nome: k, valor: v, cor: '#fb923c', extra: pct(v / soma(posVisita, x => x[1]), 0)}))) : vazio('Nenhuma perda depois de visita.'),
          {sub: 'Quem chegou a conhecer a escola e não fechou'})}
      </div>
      <div class="mt">${card('Motivo x até onde o lead chegou', '<div id="peTab"></div>')}</div>` : vazio('Nenhum lead perdido nesse filtro.');
    if (perd.length) new Tabela($('#peTab'), {linhas: matriz, ordem: {k: 'total', dir: -1}, colunas: [{k: 'motivo', l: 'Motivo'}, {k: 'total', l: 'Total', n: 1}].concat(fases.map((f, i) => ({k: 'f' + i, l: f, n: 1})))});
  }

  // ---------- 7. leads parados
  let diasParado = 7, etapaParado = '', termoParado = '';
  function parados(alvo) {
    const abertos = doFunil().filter(l => l.status === 'EM_ANDAMENTO' || l.status === 'PAUSADO');
    const ultimo = l => [l.criado, l.conversa, l.agendou, l.visitou].filter(Boolean).sort().pop();
    const comDias = abertos.map(l => ({...l, ultimo: ultimo(l), dias: difDias(ultimo(l), HOJE)}));
    const lista = comDias.filter(l => l.dias >= diasParado && (!etapaParado || l.etapa === etapaParado) && (!termoParado || l.termometro === termoParado));
    const etapas = [...new Set(abertos.map(l => l.etapa))];
    const faixas = [[diasParado, 15], [16, 30], [31, 60], [61, 90], [91, 9999]].filter(([a, b]) => b >= diasParado);
    alvo.innerHTML = `
      <div class="filtros mt">
        <label>Parados há pelo menos <input type="number" id="paDias" min="1" value="${diasParado}" style="width:70px"> dias</label>
        <label>Etapa <select id="paEtapa"><option value="">Todas</option>${etapas.map(e => `<option ${e === etapaParado ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label>Termômetro <select id="paTermo"><option value="">Todos</option>${['QUENTE', 'MORNO', 'FRIO'].map(t => `<option value="${t}" ${t === termoParado ? 'selected' : ''}>${t.toLowerCase()}</option>`).join('')}</select></label>
        <span class="nota" style="margin:0">Ignora o filtro de datas: olha todos os leads em aberto do funil.</span>
      </div>
      <div class="kpis k4 mt">
        ${kpi({rotulo: 'Leads parados', valor: num(lista.length), sub: `de ${num(abertos.length)} em aberto`, cor: COR.vermEsc})}
        ${kpi({rotulo: 'Parados antes de agendar', valor: num(lista.filter(l => !l.agendou).length), sub: 'ainda sem visita marcada', cor: COR.laranjaEsc})}
        ${kpi({rotulo: 'Parados depois da visita', valor: num(lista.filter(l => l.visitou).length), sub: 'conheceram a escola', cor: COR.roxoEsc})}
        ${kpi({rotulo: 'Quentes ou mornos', valor: num(lista.filter(l => l.termometro !== 'FRIO').length), sub: 'prioridade de retorno', cor: COR.ink})}
      </div>
      <div class="grid g2">
        ${card('Por etapa', barrasH(etapas.map(e => ({nome: e, valor: lista.filter(l => l.etapa === e).length, cor: COR.laranja})).sort((a, b) => b.valor - a.valor)))}
        ${card('Há quanto tempo', barrasH(faixas.map(([a, b]) => ({nome: b > 900 ? `mais de ${a - 1} dias` : `${a} a ${b} dias`, valor: lista.filter(l => l.dias >= a && l.dias <= b).length, cor: COR.verm}))), {sub: 'Dias desde o último movimento'})}
      </div>
      <div class="mt">${card('Lista para retorno', '<div id="paTab" class="tab-alta"></div>', {sub: 'Contatos mascarados: os dados da demo são fictícios'})}</div>`;
    new Tabela($('#paTab'), {linhas: lista, ordem: {k: 'dias', dir: -1}, vazioTxt: 'Nenhum lead parado com esses filtros.', colunas: [
      {k: 'aluno', l: 'Aluno'}, {k: 'responsavel', l: 'Responsável'}, {k: 'celular', l: 'Celular'}, {k: 'serie', l: 'Série'}, {k: 'etapa', l: 'Etapa'},
      {k: 'termometro', l: 'Termômetro', f: v => pill(v.toLowerCase(), v === 'QUENTE' ? 'ruim' : v === 'MORNO' ? 'medio' : 'azul')},
      {k: 'origem', l: 'Origem'}, {k: 'criado', l: 'Criado em', f: v => dataBR(v)}, {k: 'dias', l: 'Dias parado', n: 1}]});
    $('#paDias').addEventListener('change', e => { diasParado = Math.max(1, +e.target.value || 7); desenhar(); });
    $('#paEtapa').addEventListener('change', e => { etapaParado = e.target.value; desenhar(); });
    $('#paTermo').addEventListener('change', e => { termoParado = e.target.value; desenhar(); });
  }

  // ---------- planejamento
  function abrirPlanejamento() {
    const P = planejamentoAtual();
    const m = $('#fuModal');
    m.hidden = false;
    document.body.classList.add('sem-scroll');
    m.innerHTML = `<div class="plano">
      <div class="card" style="padding:28px 30px">
        <h2>Planejamento da campanha de matrículas</h2>
        <p class="nota" style="font-size:13px">Com esses números o painel calcula quantos alunos novos a campanha precisa trazer e passa a acompanhar o ritmo semana a semana.</p>
        <div class="passo"><div class="n">1</div><div><h4>Onde a escola está hoje</h4><div class="campos">
          <label>Número de alunos atual<input id="plAtual" type="number" min="0" value="${P.alunos_atuais}"><small>Matriculados no ano letivo atual.</small></label>
          <label>Taxa de rematrícula (%)<input id="plRem" type="number" min="0" max="100" step="0.1" value="${P.taxa_rematricula}"><small>Quantos dos atuais devem renovar.</small></label>
          <label>Meta de alunos para ${D.meta.ano_proximo}<input id="plMeta" type="number" min="0" value="${P.meta_alunos}"><small>Total que a escola quer ter.</small></label></div></div></div>
        <div class="passo"><div class="n">2</div><div><h4>Período de matrículas</h4><div class="campos">
          <label>Início<input id="plIni" type="date" value="${P.inicio}"></label><label>Fim<input id="plFim" type="date" value="${P.fim}"></label></div></div></div>
        <div class="passo"><div class="n">3</div><div><h4>Investimento em captação</h4><div class="campos">
          <label>Mensalidade média (R$)<input id="plMens" type="number" min="0" step="10" value="${P.mensalidade}"><small>Valor médio cobrado hoje.</small></label>
          <label>CAM (custo por matrícula)<input id="plCam" type="text" readonly><small>20% da mensalidade média.</small></label></div></div></div>
        <p class="nota">Na demo o plano fica salvo só neste navegador. Na versão em produção ele vai para o servidor e vale para toda a equipe.</p>
      </div>
      <div class="calc"><h3>Cálculo da meta de novos alunos</h3><div id="plCalc"></div>
        <button class="btn" id="plSalvar">Salvar e abrir o painel</button><button class="btn ghost" id="plVoltar">Voltar sem salvar</button>
        <div class="kpi-plano"><span>Leads na base</span><strong>${num(todos.length)}</strong><small>posição de ${dataBR(HOJE)}</small></div></div>
    </div>`;
    const ler = () => ({alunos_atuais: +$('#plAtual').value || 0, taxa_rematricula: +$('#plRem').value || 0, meta_alunos: +$('#plMeta').value || 0,
      inicio: $('#plIni').value, fim: $('#plFim').value, mensalidade: +$('#plMens').value || 0});
    const calcular = () => {
      const Q = ler(), C = calcPlano(Q);
      $('#plCam').value = brlCheio(C.cam);
      const avisos = [];
      if (Q.meta_alunos <= C.rem) avisos.push('A meta é menor que a rematrícula esperada: não precisaria de alunos novos.');
      if (Q.fim <= Q.inicio) avisos.push('O fim do período precisa ser depois do início.');
      if (!Q.mensalidade) avisos.push('Preencha a mensalidade para calcular o investimento.');
      $('#plCalc').innerHTML = `<div class="ln">Alunos atuais<b>${num(Q.alunos_atuais)}</b></div><div class="ln">× taxa de rematrícula<b>${num(Q.taxa_rematricula, 1)}%</b></div>
        <div class="ln">= alunos que rematriculam<b>${num(C.rem)}</b></div><div class="sep"></div>
        <div class="ln">Meta de alunos<b>${num(Q.meta_alunos)}</b></div><div class="ln">− alunos que rematriculam<b>${num(C.rem)}</b></div><div class="sep"></div>
        <div class="ln res">Novos alunos necessários<b>${num(C.novos)}</b></div>
        <div class="ln">Investimento projetado (× CAM)<b>${brl(C.investimento)}</b></div>
        <p style="font-size:12px;color:#d6cfe3;margin:6px 0 0">A escola deve perder ${num(C.saem)} alunos na virada do ano e precisa trazer ${num(C.novos)} novos para chegar a ${num(Q.meta_alunos)}, ${C.crescimento >= 0 ? 'um crescimento' : 'uma redução'} de ${pct(Math.abs(C.crescimento))} sobre a base atual.</p>
        ${avisos.map(a => `<div class="aviso-c">${a}</div>`).join('')}`;
      $('#plSalvar').disabled = avisos.length > 0 && Q.fim <= Q.inicio;
    };
    $$('#fuModal input').forEach(i => i.addEventListener('input', calcular));
    const fechar = () => { m.hidden = true; document.body.classList.remove('sem-scroll'); desenhar(); };
    $('#plSalvar').addEventListener('click', () => { try { localStorage.setItem(PLANO_KEY, JSON.stringify(ler())); } catch (e) { /* modo privado */ } fechar(); });
    $('#plVoltar').addEventListener('click', fechar);
    calcular();
  }
}
