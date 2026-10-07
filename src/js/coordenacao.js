// Página da Coordenação: Geral, Alunos, Fundamental I/II, Ensino Médio e Resultados (simulados).
// Notas na escala 0-10. Clique em qualquer aluno (card, ponto, linha) abre a ficha dele.

const CO = D.coordenacao;
const CO_AL = expandir(CO.alunos);
const CO_ID = Object.fromEntries(CO_AL.map(a => [a.id, a]));
const CO_DOC = Object.fromEntries(CO.docentes.map(d => [d.id, d]));
const RADAR = D.radar || {};   // selo do radar de evasão na ficha: [chance, faixa, sinais]
const COR_SEG_C = {'Educação Infantil': '#ec4899', 'Fundamental I': '#3b82f6', 'Fundamental II': '#14b8a6', 'Ensino Médio': '#f97316'};
const SUB_SEG = {fund1: 'Anos iniciais (1º ao 5º ano)', fund2: 'Anos finais (6º ao 9º ano)', em: '1ª, 2ª e 3ª séries'};
const SEG_KEY = {fund1: 'Fundamental I', fund2: 'Fundamental II', em: 'Ensino Médio'};
const CLASSES = ['Ótimo', 'Bom', 'Atenção', 'Risco', 'Alto risco', 'Sem dados'];
const COR_CLASSE = {'Ótimo': '#15803d', 'Bom': '#22c55e', 'Atenção': '#f59e0b', 'Risco': '#f87171', 'Alto risco': '#b91c1c', 'Sem dados': '#94a3b8'};
const QUAD = {
  engajado: ['Engajado', '#16a34a', 'presença ≥ 75% e média ≥ 7'],
  ausente_bom: ['Ausente mas ok', '#f59e0b', 'presença < 75% e média ≥ 7'],
  presente_baixo: ['Presente mas baixo', '#ea580c', 'presença ≥ 75% e média < 7'],
  critico: ['Risco duplo', '#b91c1c', 'presença < 75% e média < 7'],
};
const RISCO_TXT = {nota: 'Nota baixa', falta: 'Faltas altas', combinado: 'Nota + falta'};
const NIVEIS_FORM = [['doutorado', 'Doutorado', '#dc2626'], ['mestrado', 'Mestrado', '#f59e0b'], ['especializacao', 'Especialização', '#2563eb'],
  ['pos_graduacao', 'Pós-graduação', '#7c3aed'], ['graduacao', 'Graduação', '#94a3b8']];

const nota1 = v => v == null ? '—' : num(v, 1);
// eixos da dispersão presença x nota ajustados à maior parte dos alunos (99,5% dos alunos no eixo X), sempre com a
// linha dos 75% da LDB visível; os poucos casos extremos ficam presos na borda como bolinha vazada
const percentil = (vs, q) => { const o = [...vs].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor(q * o.length))]; };
function ajustarDisp(pts) {
  const xMin = Math.max(40, Math.min(70, Math.floor((percentil(pts.map(p => p.x), 0.005) - 2) / 5) * 5));
  const yMin = Math.max(0, Math.min(6, Math.floor(percentil(pts.map(p => p.y), 0.01) - 0.5)));
  const pontos = pts.map(p => p.x < xMin || p.y < yMin ? {...p, x: Math.max(p.x, xMin + 0.3), y: Math.max(p.y, yMin + 0.08), vazado: true} : p);
  return {pontos, xMin, xMax: 100, yMin, yMax: 10};
}
const corNota = v => v == null ? 'var(--mudo)' : v >= 8.5 ? COR.verdeEsc : v >= 7 ? 'var(--ink)' : COR.vermEsc;
const TXT_CLASSE = {'Ótimo': '#15803d', 'Bom': '#15803d', 'Atenção': '#b45309', 'Risco': '#b91c1c', 'Alto risco': '#991b1b', 'Sem dados': '#64748b'};
const pillClasse = c => `<span class="pill" style="background:${COR_CLASSE[c]}26;color:${TXT_CLASSE[c]}">${c}</span>`;
const nivelMax = d => NIVEIS_FORM.find(n => d[n[0]]) || NIVEIS_FORM[4];
const corSerie = t => ['#3b82f6', '#14b8a6', '#f97316', '#ef4444', '#a855f7'][(parseInt(t) - 1) % 5] || COR.cinza;

// notas mais recentes de cada disciplina (a fechada do último trimestre fechado ou a parcial)
function ultimasNotas(id) {
  const det = CO.detalhe[id];
  if (!det) return [];
  return det.n.map(([di, ts]) => {
    for (let i = ts.length - 1; i >= 0; i--) { const v = ts[i][2] ?? ts[i][0]; if (v != null) return [CO.disciplinas[di], v]; }
    return [CO.disciplinas[di], null];
  });
}

// ---------------------------------------------------------------- janela (modal)
function janela(html, largura = 1000) {
  let f = $('#janela');
  if (!f) {
    f = document.createElement('div');
    f.id = 'janela';
    f.className = 'jan-fundo';
    document.body.appendChild(f);
    f.addEventListener('click', e => {
      if (e.target === f || e.target.closest('[data-fechar-jan]')) return fecharJanela();
      const al = e.target.closest('[data-aluno]');
      if (al) abrirAluno(+al.dataset.aluno);
    });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !f.hidden) fecharJanela(); });
  }
  f.innerHTML = `<div class="jan" style="max-width:${largura}px"><button class="jan-x" data-fechar-jan aria-label="Fechar">×</button>${html}</div>`;
  f.hidden = false;
  f.scrollTop = 0;
  document.body.classList.add('sem-scroll');
  return f.firstElementChild;
}
function fecharJanela() {
  const f = $('#janela');
  if (f) { f.hidden = true; f.innerHTML = ''; }
  document.body.classList.remove('sem-scroll');
}

// ---------------------------------------------------------------- ficha do aluno
function abrirAluno(id) {
  const a = CO_ID[id];
  if (!a) return;
  const det = CO.detalhe[id] || {n: [], o: [], p: [], c: []};
  const ev = RADAR[id] && {prob: RADAR[id][0], faixa: RADAR[id][1], motivos: RADAR[id][2]};
  const abas = [];
  if (det.n.length) abas.push({id: 'notas', nome: 'Notas'});
  if (det.p.length) abas.push({id: 'par', nome: 'Pareceres'});
  abas.push({id: 'oc', nome: `Ocorrências (${det.o.length})`});
  if (det.c.length) abas.push({id: 'clubes', nome: `Clubes (${det.c.length})`});
  const radar = ev ? `<span class="pill ${ev.faixa === 'alto' ? 'ruim' : ev.faixa === 'medio' ? 'medio' : 'bom'}" data-tip="${esc('Radar de evasão: ' + (ev.motivos.join(' · ') || 'sem sinais relevantes'))}">Radar de evasão: ${ev.faixa === 'medio' ? 'médio' : ev.faixa} (${pct(ev.prob, 0)})</span>` : '';
  const j = janela(`<div class="jan-h"><h2>${esc(a.nome)}</h2>
    <p>${a.turma} · ${a.segmento} · Média <b style="color:${corNota(a.media)}">${nota1(a.media)}</b> · Frequência <b>${a.freq == null ? '—' : pct(a.freq)}</b> · ${pillClasse(a.classif)} ${radar}</p></div>
    <div class="sub" id="jSub"></div><div id="jCorpo"></div>`, 1100);
  subAbas($('#jSub', j), abas, aba => {
    const c = $('#jCorpo', j);
    if (aba === 'notas') tabNotas(det, c);
    else if (aba === 'oc') tabOcorrencias(det, c);
    else if (aba === 'par') tabPareceres(det, c);
    else c.innerHTML = `<div class="lista">${det.c.map(x => `<div class="lat-item"><b>${esc(x)}</b><span class="mudo">clube / atividade extracurricular</span></div>`).join('')}</div>`;
  });
}

function tabNotas(det, cont) {
  const tris = CO.trimestres.filter(t => det.n.some(([, ts]) => ts.length >= t.num));
  const aberto = new Set();
  const cel = x => `<td class="n" style="color:${corNota(x)}">${nota1(x)}</td>`;
  const desenhar = () => {
    let h = '<div class="tabela-wrap"><table class="t-notas"><thead><tr><th>Disciplina</th>';
    tris.forEach(t => {
      h += aberto.has(t.num)
        ? `<th class="n tri on" data-tri="${t.num}" colspan="3">${t.num}º trimestre ▾</th>`
        : `<th class="n tri" data-tri="${t.num}" data-tip="Clique pra ver nota, recuperação e nota fechada">${t.num}º tri${t.fechado ? '' : ' (parcial)'} ▸</th>`;
    });
    h += '<th class="n">Média final</th></tr>';
    if (aberto.size) h += '<tr class="sub-h"><th></th>' + tris.map(t => aberto.has(t.num) ? '<th class="n">Nota</th><th class="n">Recup.</th><th class="n">Fechada</th>' : '<th></th>').join('') + '<th></th></tr>';
    h += '</thead><tbody>';
    det.n.forEach(([di, ts]) => {
      h += `<tr><td>${CO.disciplinas[di]}</td>`;
      tris.forEach(t => {
        const v = ts[t.num - 1];
        if (aberto.has(t.num)) h += v ? cel(v[0]) + cel(v[1]) + cel(v[2]) : '<td></td><td></td><td></td>';
        else h += cel(v ? v[2] ?? v[0] : null);
      });
      const fech = ts.map(v => v[2]).filter(v => v != null);
      const mf = fech.length ? fech.reduce((s, v) => s + v, 0) / fech.length : null;
      h += `<td class="n forte" style="color:${corNota(mf)}">${nota1(mf)}</td></tr>`;
    });
    cont.innerHTML = h + '</tbody></table></div><p class="nota">Média final = média das notas fechadas dos trimestres encerrados. Verde ≥ 8,5 · vermelho &lt; 7. Recuperação vale até 7,0.</p>';
  };
  cont.onclick = e => {
    const th = e.target.closest('th[data-tri]');
    if (!th) return;
    const t = +th.dataset.tri;
    aberto.has(t) ? aberto.delete(t) : aberto.add(t);
    desenhar();
  };
  desenhar();
}

function tabOcorrencias(det, cont) {
  if (!det.o.length) { cont.innerHTML = vazio('Nenhuma ocorrência registrada neste ano.'); return; }
  const meses = [...new Set(det.o.map(o => o[0].slice(0, 7)))];
  let filtro = '';
  const desenhar = () => {
    const lista = det.o.filter(o => !filtro || o[0].startsWith(filtro));
    cont.innerHTML = `<div class="filtros"><select id="ocMes"><option value="">Todos os meses (${det.o.length})</option>${meses.map(m => `<option value="${m}" ${m === filtro ? 'selected' : ''}>${mesCurto(m)}/${m.slice(0, 4)}</option>`).join('')}</select><span class="mudo">${lista.length} exibidas</span></div>
      <div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Observação</th><th>Registrado por</th><th>Anexo</th></tr></thead><tbody>
      ${lista.map(o => {
        const tipo = CO.textos.tipo[o[1]];
        return `<tr><td>${dataBR(o[0])}</td><td><span class="pill ${tipo === 'Elogio' ? 'bom' : 'neutro'}">${tipo}</span>${o[3] ? ' <span class="pill ruim" data-tip="Impedido de assistir à aula">IMPED</span>' : ''}${o[5] ? '' : ' <span class="mudo" data-tip="Não visível para o responsável">🔒</span>'}</td>
          <td>${esc(CO.textos.obs[o[2]])}</td><td>${esc(CO_DOC[o[4]]?.nome || '—')}</td><td>${o[6] ? `<span class="anexo ${o[6]}">${o[6] === 'pdf' ? 'PDF' : 'IMG'}</span>` : '—'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    $('#ocMes', cont).onchange = e => { filtro = e.target.value; desenhar(); };
  };
  desenhar();
}

function tabPareceres(det, cont) {
  const porTri = {};
  det.p.forEach(p => (porTri[p[0]] = porTri[p[0]] || []).push(p));
  cont.innerHTML = Object.entries(porTri).map(([tri, lista]) => `<h4 class="sec-t">${tri}º trimestre</h4>` + lista.map(p => {
    const area = CO.textos.area[p[1]];
    const texto = p[3].map(i => CO.fragmentos[area][p[2]][i]).join(' ') + ' ' + CO.fechamentos[p[4]];
    return `<details class="parecer"><summary><b>${area}</b><span class="mudo">Prof. ${esc(CO_DOC[p[5]]?.nome || '—')}</span>${p[6] ? pill('Confirmado', 'bom') : pill('Rascunho', 'medio')}</summary><p>${esc(texto)}</p></details>`;
  }).join('')).join('') + '<p class="nota">Educação Infantil e 1º ano são avaliados por parecer descritivo, sem nota. Textos montados a partir de um banco de frases fictícias.</p>';
}

// ---------------------------------------------------------------- listas em janela
function cardRisco(a) {
  const baixas = ultimasNotas(a.id).filter(([, v]) => v != null && v < 7).sort((x, y) => x[1] - y[1]);
  const pf = a.aulas ? a.faltas / a.aulas : 0;
  return `<div class="risco-card" data-aluno="${a.id}">
    <div class="rc-h"><span class="pill ${a.risco === 'combinado' ? 'ruim' : 'medio'}">${RISCO_TXT[a.risco] || 'Risco'}</span><b>${esc(a.nome)}</b><span class="mudo">${a.turma}</span>${a.n_oc ? `<span class="pill neutro">${a.n_oc} ocorrência${a.n_oc > 1 ? 's' : ''}</span>` : ''}</div>
    <div class="rc-m"><span>Média <b style="color:${corNota(a.media)}">${nota1(a.media)}</b></span><span>Freq <b>${a.freq == null ? '—' : pct(a.freq)}</b></span><span>Faltas <b>${pct(pf)}</b> (${num(a.faltas)}/${num(a.aulas)})</span><span>${pillClasse(a.classif)}</span></div>
    ${baixas.length ? `<div class="rc-d">${baixas.map(([d, v]) => `<span class="chip-r">${d}: ${nota1(v)}</span>`).join('')}</div>` : ''}</div>`;
}

function janelaRisco(titulo, alunos, agruparSeg) {
  const grupos = {};
  alunos.forEach(a => {
    const k = agruparSeg ? a.segmento : '';
    ((grupos[k] = grupos[k] || {})[a.turma] = grupos[k][a.turma] || []).push(a);
  });
  const corpo = Object.entries(grupos).map(([seg, turmas]) => (seg ? `<h4 class="sec-t">${seg} · ${num(Object.values(turmas).flat().length)} alunos em ${Object.keys(turmas).length} turmas</h4>` : '') +
    Object.entries(turmas).sort().map(([t, l]) => `<details class="grupo" ${agruparSeg ? '' : 'open'}><summary>${t} <span class="mudo">${l.length} aluno${l.length > 1 ? 's' : ''}</span></summary>${l.map(cardRisco).join('')}</details>`).join('')).join('');
  janela(`<div class="jan-h"><h2>${titulo}</h2><p>Risco por nota: abaixo de 6 em 2 ou mais disciplinas · por falta: 25% ou mais de faltas. Clique no aluno pra abrir a ficha.</p></div>${corpo || vazio('Nenhum aluno em risco.')}`, 900);
}

function janelaDocente(d) {
  const campos = [['Função', d.funcao], ['Segmento(s)', d.segmentos.join(', ')], ['Graduação', d.graduacao], ['Pós-graduação', d.pos_graduacao],
    ['Especialização', d.especializacao], ['Mestrado', d.mestrado], ['Doutorado', d.doutorado], ['Outros cursos', d.outros]];
  const n = campos.slice(2).filter(c => c[1]).length;
  janela(`<div class="jan-h"><h2>${esc(d.nome)}</h2><p>${pill(nivelMax(d)[1], 'azul')} · ${n} formação${n > 1 ? 'ões' : ''}</p></div>
    <div class="lista">${campos.map(([k, v]) => `<div class="lat-item"><span class="mudo">${k}</span><b>${esc(v || '—')}</b></div>`).join('')}</div>`, 560);
}

function blocoDocentes(segs) {
  const nomes = {'Educação Infantil': 'Ed. Infantil', 'Fundamental I': 'Anos iniciais', 'Fundamental II': 'Anos finais', 'Ensino Médio': 'Ensino Médio'};
  const itens = segs.map(s => {
    const o = {nome: nomes[s]};
    CO.docentes.filter(d => d.segmentos.includes(s)).forEach(d => { const n = nivelMax(d)[0]; o[n] = (o[n] || 0) + 1; });
    return o;
  });
  const listas = segs.map(s => `<div><h4 class="sec-t">${nomes[s]}</h4>${CO.docentes.filter(d => d.segmentos.includes(s)).sort((a, b) => a.nome.localeCompare(b.nome)).map(d =>
    `<div class="doc-l" data-doc="${d.id}"><span>${esc(d.nome)}<small>${esc(d.funcao)}</small></span>${pill(nivelMax(d)[1], 'neutro')}</div>`).join('')}</div>`).join('');
  return card('Corpo docente', legenda(NIVEIS_FORM.slice().reverse().map(n => ({nome: n[1], cor: n[2]}))) +
    barrasHEmp(itens, NIVEIS_FORM.slice().reverse().map(n => ({k: n[0], nome: n[1], cor: n[2]}))) +
    `<details class="mt"><summary class="link">Ver a lista completa (${CO.docentes.filter(d => d.segmentos.some(s => segs.includes(s))).length} professores)</summary><div class="grid g${Math.min(segs.length, 4)} docs">${listas}</div></details>`,
  {sub: 'Maior titulação de cada professor. Clique num nome pra ver as formações.'});
}

// ---------------------------------------------------------------- Geral
function coGeral(el) {
  const G = CO.geral, k = G.kpis, segs = G.segmentos;
  const top = G.top10.map(id => CO_ID[id]);
  const emRisco = CO_AL.filter(a => a.risco && a.segmento !== 'Educação Infantil');
  el.innerHTML = `
    <div class="kpis k6">
      ${kpi({rotulo: 'Total de alunos', valor: num(k.alunos), sub: `${k.segmentos} segmentos · ${k.turmas} turmas (sem a Ed. Infantil)`, cor: COR.azul})}
      ${kpi({rotulo: 'Média geral ponderada', valor: nota1(k.media), sub: 'escala 0-10', cor: COR.roxo})}
      ${kpi({rotulo: '% aprovação', valor: pct(k.aprov), sub: `${num(k.n_aprov)} de ${num(k.n_nota)} com nota ≥ 7`, cor: COR.verde})}
      ${kpi({rotulo: '% presença', valor: pct(k.presenca), sub: 'faltas oficiais / aulas dadas', cor: COR.laranja})}
      ${kpi({rotulo: 'Alunos em risco', valor: num(k.risco), sub: `${pct(k.risco / k.alunos)} do total · clique`, cor: COR.verm, classe: 'clicavel', extra: '<span data-acao="risco"></span>'})}
      ${kpi({rotulo: 'Top 10 Fund II + EM', valor: '10', sub: `1º lugar com média ${nota1(top[0]?.media)} · clique`, cor: COR.ambar, classe: 'clicavel', extra: '<span data-acao="top"></span>'})}
    </div>
    ${card('Comparativo entre segmentos', `<div class="tabela-wrap"><table class="cmp-seg"><thead><tr><th>Segmento</th><th class="n">Alunos</th><th class="n">Média</th><th class="n">% aprov.</th><th class="n">% presença</th><th class="n">Em risco</th><th>Recuperação no 1º tri</th></tr></thead><tbody>
      ${segs.map(s => `<tr><td><i class="dot" style="background:${COR_SEG_C[s.nome]}"></i><b>${s.nome}</b></td><td class="n">${num(s.alunos)}<small class="mudo"> · ${s.turmas} turmas</small></td>
        <td class="n" style="color:${corNota(s.media)}"><b>${nota1(s.media)}</b></td><td class="n">${pct(s.aprov)}</td><td class="n">${pct(s.presenca)}</td>
        <td class="n"><a class="link" data-risco-seg="${s.nome}">${num(s.risco)}</a></td>
        <td><div class="bar-rec"><div style="width:${(s.rec_t1 / s.alunos * 100).toFixed(1)}%;background:${COR.laranja}"></div></div><small class="mudo">${num(s.rec_t1)} alunos (${pct(s.rec_t1 / s.alunos, 0)}) com nota abaixo de 7</small></td></tr>`).join('')}
    </tbody></table></div>`, {classe: 'mt'})}
    <div class="grid g2">
      ${card('Alunos por segmento', grafBarras({rotulos: segs.map(s => s.nome), series: [{nome: 'Alunos', valores: segs.map(s => s.alunos), cor: COR.azul}], valores: true, W: LG.metade, h: 230}))}
      ${card('Média geral por segmento', grafBarras({rotulos: segs.map(s => s.nome), series: [{nome: 'Média', valores: segs.map(s => s.media), cor: COR.roxo}], valores: true, fmtValor: v => num(v, 1), fmtEixo: v => num(v, 0),
        linhas: [{nome: 'Aprovação (7,0)', valores: segs.map(() => 7), cor: COR.verm, tracejado: true, pontos: false}], W: LG.metade, h: 230}))}
      ${card('Alunos em risco por segmento', grafBarras({rotulos: segs.map(s => s.nome), series: [{nome: 'Em risco', valores: segs.map(s => s.risco), cor: COR.verm}], valores: true, W: LG.metade, h: 230}))}
      ${card('Alunos em recuperação por trimestre', `<div id="geRecTri"></div>`, {acoes: '<div class="seg-btns" id="geRecBtns"></div>'})}
    </div>
    ${card('Disciplinas com mais alunos em recuperação', '<div id="geDisc"></div>', {sub: 'Alunos únicos com nota abaixo de 7 na disciplina, no trimestre.', acoes: '<div class="ctrl-g"><div class="seg-btns" id="geDiscTri"></div><div class="seg-btns" id="geDiscSeg"></div></div>', classe: 'mt'})}
    ${card('Correlação presença × nota (escola toda)', '<div id="geDisp"></div><div class="quad" id="geQuad"></div>', {sub: 'Cada ponto é um aluno. Clique pra abrir a ficha. Linhas: 75% de presença (LDB) e média 7. Bolinha vazada = caso extremo, preso na borda (o valor real aparece ao passar o mouse).', acoes: '<div class="seg-btns" id="geSegs"></div>', classe: 'mt'})}
    <div class="mt">${blocoDocentes(SEGMENTOS)}</div>`;

  $$('[data-acao]', el).forEach(s => s.closest('.kpi').addEventListener('click', () => s.dataset.acao === 'risco'
    ? janelaRisco(`Alunos em risco · ${num(emRisco.length)}`, emRisco, true)
    : janela(`<div class="jan-h"><h2>Top 10 · Fundamental II + Ensino Médio</h2><p>Maior média; empate decidido pela frequência.</p></div>
        <div class="tabela-wrap"><table><thead><tr><th>#</th><th>Aluno</th><th>Série</th><th>Turma</th><th class="n">Média</th><th class="n">Frequência</th></tr></thead><tbody>
        ${top.map((a, i) => `<tr data-aluno="${a.id}" class="clicavel"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td><b>${esc(a.nome)}</b></td><td>${a.serie}</td><td>${a.turma}</td><td class="n" style="color:${corNota(a.media)}"><b>${nota1(a.media)}</b></td><td class="n">${pct(a.freq)}</td></tr>`).join('')}</tbody></table></div>`, 760)));
  el.addEventListener('click', e => { const r = e.target.closest('[data-risco-seg]'); if (r) janelaRisco(`${r.dataset.riscoSeg} · alunos em risco`, emRisco.filter(a => a.segmento === r.dataset.riscoSeg), false); });

  // recuperação por trimestre (barras por segmento)
  const trisRec = CO.trimestres.filter(t => segs.some(s => s.rec[t.num] != null));
  subAbas($('#geRecBtns', el), trisRec.map(t => ({id: String(t.num), nome: `${t.num}º tri`})), t => {
    $('#geRecTri', el).innerHTML = grafBarras({rotulos: segs.map(s => s.nome), series: [{nome: 'Alunos com nota < 7', valores: segs.map(s => s.rec[t] || 0), cor: COR.laranja}], valores: true, W: LG.metade, h: 230});
  }, '1');

  // ranking de disciplinas
  let tri = String(trisRec[trisRec.length - 1].num), seg = '__TODAS__';
  const desenharDisc = () => {
    const r = (CO.geral.ranking_recuperacao[tri] || {})[seg] || [];
    $('#geDisc', el).innerHTML = r.length ? barrasH(r.map(([d, n]) => ({nome: d, valor: n, cor: seg === '__TODAS__' ? COR.laranja : COR_SEG_C[seg]})), {fmt: v => num(v) + ' alunos'}) : vazio('Sem notas lançadas.');
  };
  subAbas($('#geDiscTri', el), Object.keys(CO.geral.ranking_recuperacao).map(t => ({id: t, nome: `${t}º tri`})), t => { tri = t; desenharDisc(); }, tri);
  subAbas($('#geDiscSeg', el), [{id: '__TODAS__', nome: 'Escola toda'}, ...segs.map(s => ({id: s.nome, nome: SIGLA_SEG[s.nome]}))], s => { seg = s; desenharDisc(); });

  // dispersão consolidada
  const ativos = new Set(segs.map(s => s.nome));
  const pontos = Object.values(CO.segmentos).flatMap(s => s.correlacao.pontos.map(p => ({seg: s.nome, p})));
  const desenharDisp = () => {
    const vis = pontos.filter(x => ativos.has(x.seg));
    const ptsG = vis.map(({p}) => ({x: p[2] * 100, y: p[3], cor: QUAD[p[6]][1], id: p[0], r: 3.4,
      tip: `<b>${esc(CO_ID[p[0]].nome)}</b><br>${p[1]}<br>Presença: <b>${pct(p[2])}</b> · Média: <b>${nota1(p[3])}</b><br>Faltas: ${num(p[4])} de ${num(p[5])} aulas`}));
    $('#geDisp', el).innerHTML = grafDispersao({
      ...ajustarDisp(ptsG), fmtX: v => num(v) + '%', fmtY: v => num(v), rotX: 'Presença (%)', rotY: 'Média',
      cortesX: [{v: 75, rot: '75% LDB'}], cortesY: [{v: 7, rot: 'Nota 7,0'}], h: 380});
    const q = {};
    vis.forEach(({p}) => q[p[6]] = (q[p[6]] || 0) + 1);
    $('#geQuad', el).innerHTML = Object.entries(QUAD).map(([k, [n, c, d]]) => `<div class="quad-c" style="--c:${c}"><b>${num(q[k] || 0)}</b><span>${n}</span><small>${d}</small></div>`).join('');
  };
  $('#geSegs', el).innerHTML = segs.map(s => `<button class="on" data-s="${s.nome}"><i class="dot" style="background:${COR_SEG_C[s.nome]}"></i>${SIGLA_SEG[s.nome]}</button>`).join('');
  $('#geSegs', el).onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    ativos.has(b.dataset.s) && ativos.size > 1 ? ativos.delete(b.dataset.s) : ativos.add(b.dataset.s);
    b.classList.toggle('on', ativos.has(b.dataset.s));
    desenharDisp();
  };
  desenharDisp();
}

// ---------------------------------------------------------------- Alunos
function coAlunos(el) {
  const series = SEGMENTOS.flatMap(s => [...new Set(CO_AL.filter(a => a.segmento === s).map(a => a.serie))]);
  const st = {classe: '', busca: '', serie: '', turma: '', media: '', freq: '', clube: '', ordem: 'nome', limite: 120};
  const cont = Object.fromEntries(CLASSES.map(c => [c, CO_AL.filter(a => a.classif === c).length]));
  el.innerHTML = `
    <div class="cls-cards">${CLASSES.map(c => `<button class="cls" data-c="${c}" style="--c:${COR_CLASSE[c]}"><b>${num(cont[c])}</b><span>${c}</span><small>${pct(cont[c] / CO_AL.length, 0)} do total</small></button>`).join('')}</div>
    <details class="regras"><summary class="link">Como a classificação é calculada</summary><p>Ótimo: média ≥ 9 e frequência ≥ 95% · Bom: média ≥ 8 e frequência ≥ 90% · Atenção: média ≥ 7 e frequência ≥ 75% ·
      Risco: só uma das duas abaixo do mínimo (média &lt; 7 ou frequência &lt; 75%) · Alto risco: as duas · Sem dados: Ed. Infantil e 1º ano (parecer descritivo, sem nota).</p></details>
    <div class="filtros wrap">
      <input id="alBusca" placeholder="Buscar nome, série ou turma" type="search">
      <select id="alSerie"><option value="">Todas as séries</option>${series.map(s => `<option>${s}</option>`).join('')}</select>
      <select id="alTurma"><option value="">Todas as turmas</option>${['A', 'B', 'C', 'D'].map(t => `<option value="${t}">Turma ${t}</option>`).join('')}</select>
      <select id="alMedia"><option value="">Média: todas</option><option value="9">≥ 9</option><option value="8">8 a 9</option><option value="7">7 a 8</option><option value="0">&lt; 7</option><option value="-">Sem nota</option></select>
      <select id="alFreq"><option value="">Frequência: todas</option><option value="95">≥ 95%</option><option value="90">90 a 95%</option><option value="75">75 a 90%</option><option value="0">&lt; 75%</option></select>
      <select id="alClube"><option value="">Clubes: todos</option><option value="s">Participa de clube</option><option value="n">Não participa</option></select>
      <select id="alOrdem"><option value="nome">A → Z</option><option value="classe">Classificação (melhor primeiro)</option><option value="-classe">Classificação (pior primeiro)</option>
        <option value="-media">Maior média</option><option value="media">Menor média</option><option value="-freq">Maior frequência</option><option value="freq">Menor frequência</option>
        <option value="-n_oc">Mais ocorrências</option><option value="-ult_oc">Ocorrência mais recente</option><option value="turma">Turma (Baby → 3ª série)</option></select>
      <button class="btn" id="alLimpar">Limpar filtros</button><span class="mudo" id="alConta"></span>
    </div>
    <div class="al-grid" id="alGrid"></div><div id="alMais"></div>`;
  const ordemSerie = s => series.indexOf(s);
  const filtrar = () => CO_AL.filter(a => {
    if (st.classe && a.classif !== st.classe) return false;
    if (st.busca && !`${a.nome} ${a.serie} ${a.turma}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(st.busca)) return false;
    if (st.serie && a.serie !== st.serie) return false;
    if (st.turma && !a.turma.endsWith(' ' + st.turma)) return false;
    if (st.media === '-' ? a.media != null : st.media && (a.media == null || (st.media === '0' ? a.media >= 7 : a.media < +st.media || (st.media !== '9' && a.media >= +st.media + 1)))) return false;
    const f = (a.freq ?? 0) * 100;
    if (st.freq && (st.freq === '0' ? f >= 75 : f < +st.freq || ({95: 101, 90: 95, 75: 90}[st.freq] <= f))) return false;
    if (st.clube && (st.clube === 's') !== !!a.clubes) return false;
    return true;
  });
  const chave = {nome: a => a.nome, classe: a => CLASSES.indexOf(a.classif), media: a => a.media ?? -1, freq: a => a.freq ?? -1, n_oc: a => a.n_oc,
    ult_oc: a => a.ult_oc || '', turma: a => ordemSerie(a.serie) * 10 + 'ABCD'.indexOf(a.turma.slice(-1))};
  const desenhar = () => {
    const desc = st.ordem.startsWith('-'), k = chave[st.ordem.replace('-', '')];
    const lista = filtrar().sort((a, b) => { const x = k(a), y = k(b); return (typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y) * (desc ? -1 : 1); });
    $$('.cls', el).forEach(b => b.classList.toggle('on', b.dataset.c === st.classe));
    $('#alLimpar', el).classList.toggle('ativo', Object.entries(st).some(([k2, v]) => !['ordem', 'limite'].includes(k2) && v));
    $('#alConta', el).textContent = `${num(lista.length)} de ${num(CO_AL.length)} alunos`;
    $('#alGrid', el).innerHTML = lista.slice(0, st.limite).map(a => `<div class="al-card" data-aluno="${a.id}">
      ${pillClasse(a.classif)}<b>${esc(a.nome)}</b>${a.n_oc ? `<span class="oc ${a.n_oc >= 3 ? 'forte' : ''}" data-tip="Ocorrências no ano">Oc: ${a.n_oc}</span>` : ''}
      <small>${a.turma} · ${SIGLA_SEG[a.segmento]}</small>
      <div class="al-m"><span>Média<b style="color:${corNota(a.media)}">${nota1(a.media)}</b></span><span>Frequência<b>${a.freq == null ? '—' : pct(a.freq, 0)}</b></span></div></div>`).join('') || vazio('Nenhum aluno com esses filtros.');
    $('#alMais', el).innerHTML = lista.length > st.limite ? `<button class="btn mt" id="alVerMais">Mostrar mais ${num(Math.min(120, lista.length - st.limite))}</button>` : '';
  };
  const liga = (id, k, fn = v => v) => { $(id, el).addEventListener('input', e => { st[k] = fn(e.target.value); st.limite = 120; desenhar(); }); };
  liga('#alBusca', 'busca', v => v.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  liga('#alSerie', 'serie'); liga('#alTurma', 'turma'); liga('#alMedia', 'media'); liga('#alFreq', 'freq'); liga('#alClube', 'clube'); liga('#alOrdem', 'ordem');
  el.addEventListener('click', e => {
    const c = e.target.closest('.cls');
    if (c) { st.classe = st.classe === c.dataset.c ? '' : c.dataset.c; desenhar(); }
    if (e.target.id === 'alVerMais') { st.limite += 120; desenhar(); }
    if (e.target.id === 'alLimpar') {
      Object.assign(st, {classe: '', busca: '', serie: '', turma: '', media: '', freq: '', clube: '', limite: 120});
      $$('input, select', el).forEach(i => { if (i.id !== 'alOrdem') i.value = ''; });
      desenhar();
    }
  });
  desenhar();
}

// ---------------------------------------------------------------- Fundamental I / II / Ensino Médio
function coSegmento(el, key) {
  const S = CO.segmentos[key], k = S.kpis, nome = SEG_KEY[key];
  const risco = S.risco.map(id => CO_ID[id]);
  const turmasNota = S.por_turma.filter(t => t.media != null);
  const rotT = t => key === 'fund1' ? t.replace('º ano ', 'º') : t;
  el.innerHTML = `
    <div class="seg-banner"><h2>Coordenação – ${nome}</h2><p>${SUB_SEG[key]} · ${S.turmas.length} turmas · ${num(k.alunos)} alunos</p></div>
    ${S.info_parecer ? `<div class="aviso-info">O ${S.info_parecer.series.join(', ')} (${S.info_parecer.alunos} alunos, ${S.info_parecer.turmas} turmas) é avaliado por parecer descritivo e fica fora das estatísticas de nota.</div>` : ''}
    <div class="kpis k5">
      ${kpi({rotulo: 'Total de alunos', valor: num(k.alunos), sub: `cursando o ${nome}`, cor: COR_SEG_C[nome]})}
      ${kpi({rotulo: 'Média geral', valor: nota1(k.media), sub: `escala 0-10 · ${k.media >= 7 ? 'acima' : 'abaixo'} de 7`, cor: COR.roxo})}
      ${kpi({rotulo: 'Em rota de aprovação', valor: pct(k.aprov), sub: `${num(k.n_aprov)} de ${num(k.n_nota)} com nota lançada`, cor: COR.verde})}
      ${kpi({rotulo: '% presença', valor: pct(k.presenca), sub: `${num(k.faltas)} faltas em ${num(k.aulas)} aulas`, cor: COR.laranja})}
      ${kpi({rotulo: 'Alunos em risco', valor: num(k.risco), sub: Object.entries(k.risco_tipos).map(([t, n]) => `${n} ${RISCO_TXT[t].toLowerCase()}`).join(' · ') + ' · clique', cor: COR.verm, classe: 'clicavel', extra: '<span data-acao="risco"></span>'})}
    </div>
    <div class="grid g2">
      ${card('Alunos por turma', grafBarras({rotulos: S.por_turma.map(t => rotT(t.turma)), series: [{nome: 'Alunos', valores: S.por_turma.map(t => t.n), cor: COR_SEG_C[nome]}], valores: true, W: LG.metade, h: 250,
        hachurar: i => S.por_turma[i].media == null, rotuloTip: i => S.por_turma[i].turma}), {sub: S.info_parecer ? 'Hachurado: turmas com parecer descritivo (sem nota).' : ''})}
      ${card('Média geral por turma', grafBarras({rotulos: turmasNota.map(t => rotT(t.turma)), series: [{nome: 'Média', valores: turmasNota.map(t => t.media), cor: COR.roxo}], valores: true,
        fmtValor: v => num(v, 1), fmtEixo: v => num(v, 0), linhas: [{nome: 'Aprovação (7,0)', valores: turmasNota.map(() => 7), cor: COR.verm, tracejado: true, pontos: false}], W: LG.metade, h: 250,
        rotuloTip: i => `${turmasNota[i].turma} · ${turmasNota[i].n_nota} alunos · mediana ${nota1(turmasNota[i].mediana)} · min ${nota1(turmasNota[i].min)} / max ${nota1(turmasNota[i].max)} · ${turmasNota[i].abaixo_7} abaixo de 7`}))}
      ${card('Médias por disciplina', '<div id="sgDisc"></div>', {acoes: `<select id="sgDiscT"><option value="__TODAS__">Todas as turmas</option>${turmasNota.map(t => `<option>${t.turma}</option>`).join('')}</select>`})}
      ${card('Alunos em recuperação por turma', '<div id="sgRec"></div><div class="rec-chips" id="sgRecChips"></div>', {sub: 'Pelo menos uma disciplina abaixo de 7 na nota do trimestre. Clique na turma pra ver os alunos.', acoes: '<div class="seg-btns" id="sgRecTri"></div>'})}
    </div>
    ${card('Correlação presença × nota', '<div id="sgDisp"></div><div class="quad" id="sgQuad"></div>', {sub: `Pearson r = ${S.correlacao.pearson == null ? '—' : num(S.correlacao.pearson, 2)} (${Math.abs(S.correlacao.pearson) < 0.1 ? 'sem correlação' : Math.abs(S.correlacao.pearson) < 0.3 ? 'fraca' : Math.abs(S.correlacao.pearson) < 0.5 ? 'moderada' : 'forte'}). Clique num ponto pra abrir o aluno. Bolinha vazada = caso extremo, preso na borda (o valor real aparece no mouse).`, classe: 'mt'})}
    ${card('Calendário de presença diária', '<div id="sgCal"></div>', {sub: 'Presença pela catraca. Clique no dia pra ver quem faltou em cada turma.', acoes: '<div class="cal-nav"><button id="calAnt">◀</button><b id="calMes"></b><button id="calProx">▶</button></div>', classe: 'mt'})}
    ${card('Heatmap turma × disciplina', '<div id="sgHeat"></div>', {sub: 'Média da nota mais recente. Disciplinas da pior para a melhor.', classe: 'mt'})}
    <div class="mt">${blocoDocentes([nome])}</div>
    <p class="nota">Aprovação: média ≥ 7 · risco: nota abaixo de 6 em 2 ou mais disciplinas, ou 25% ou mais de faltas.</p>`;

  $('[data-acao]', el).closest('.kpi').addEventListener('click', () => janelaRisco(`${nome} · alunos em risco`, risco, false));

  const desenharDisc = t => {
    const linhas = S.heatmap[t] || [];
    $('#sgDisc', el).innerHTML = barrasH(linhas.slice().sort((a, b) => a.media - b.media).map(l => ({nome: l.disciplina, valor: l.media, cor: l.media < 7 ? COR.verm : COR.roxo,
      tip: `<b>${l.disciplina}</b><br>Média: <b>${nota1(l.media)}</b><br>${l.n} alunos · ${l.abaixo_7} abaixo de 7<br>min ${nota1(l.min)} / max ${nota1(l.max)}`})), {fmt: v => num(v, 1), max: 10});
  };
  $('#sgDiscT', el).onchange = e => desenharDisc(e.target.value);
  desenharDisc('__TODAS__');

  // recuperação por turma
  const tris = Object.keys(S.recuperacao);
  subAbas($('#sgRecTri', el), CO.trimestres.map(t => ({id: String(t.num), nome: `${t.num}º tri`})), t => {
    const R = S.recuperacao[t];
    if (!R) { $('#sgRec', el).innerHTML = vazio('Trimestre ainda sem notas.'); $('#sgRecChips', el).innerHTML = ''; return; }
    const corP = p => p >= 0.30 ? '#b91c1c' : p >= 0.15 ? '#ea580c' : p > 0 ? '#eab308' : COR.cinza;
    $('#sgRec', el).innerHTML = (R.fechado ? '' : `<p class="nota">Trimestre em andamento: ${num(R.lancadas)} notas lançadas até agora.</p>`) +
      grafBarras({rotulos: R.por_turma.map(x => rotT(x.turma)), series: [{nome: 'Em recuperação', valores: R.por_turma.map(x => x.n), cor: COR.laranja}], valores: true, W: LG.metade, h: 230,
        rotuloTip: i => `${R.por_turma[i].turma} · ${pct(R.por_turma[i].n / R.por_turma[i].total, 0)} da turma · ${R.por_turma[i].top.map(([d, q]) => `${d} (${q})`).join(', ')}`});
    $('#sgRecChips', el).innerHTML = R.por_turma.map((x, i) => `<button class="chip" data-rec="${i}" style="--c:${corP(x.n / x.total)}">${rotT(x.turma)} · ${x.n}</button>`).join('');
    $('#sgRecChips', el).onclick = e => {
      const b = e.target.closest('[data-rec]');
      if (!b) return;
      const x = R.por_turma[+b.dataset.rec];
      janela(`<div class="jan-h"><h2>${x.turma} · recuperação no ${t}º trimestre</h2><p>${x.n} de ${x.total} alunos com pelo menos uma disciplina abaixo de 7.</p></div>
        ${x.alunos.map(a => `<div class="risco-card" data-aluno="${a.id}"><div class="rc-h"><b>${esc(CO_ID[a.id].nome)}</b><span class="mudo">${a.disc.length} disciplina${a.disc.length > 1 ? 's' : ''} em recuperação · média do tri ${nota1(a.media)}</span></div>
          <div class="rc-d">${a.disc.map(([d, n]) => `<span class="chip-r">${CO.disciplinas[d]}: ${nota1(n)}</span>`).join('')}</div></div>`).join('') || vazio('Nenhum aluno.')}`, 820);
    };
  }, tris[tris.length - 1]);

  // dispersão
  const pts = S.correlacao.pontos;
  const ptsS = pts.map(p => ({x: p[2] * 100, y: p[3], cor: QUAD[p[6]][1], id: p[0],
    tip: `<b>${esc(CO_ID[p[0]].nome)}</b><br>${p[1]}<br>Presença: <b>${pct(p[2])}</b> · Média: <b>${nota1(p[3])}</b><br>Faltas: ${num(p[4])} de ${num(p[5])} aulas`}));
  $('#sgDisp', el).innerHTML = grafDispersao({
    ...ajustarDisp(ptsS), fmtX: v => num(v) + '%', rotX: 'Presença (%)', rotY: 'Média', cortesX: [{v: 75, rot: 'LDB 75%'}], cortesY: [{v: 7, rot: 'Aprovação 7,0'}], h: 360});
  $('#sgQuad', el).innerHTML = Object.entries(QUAD).map(([q, [n, c, d]]) => `<div class="quad-c" style="--c:${c}"><b>${num(S.correlacao.quadrantes[q] || 0)}</b><span>${n}</span><small>${d}</small></div>`).join('');

  // calendário de presença
  const diasCal = Object.keys(S.calendario).sort();
  const meses = [...new Set(diasCal.map(d => d.slice(0, 7)))];
  let mi = meses.length - 1;
  const desenharCal = () => {
    const m = meses[mi], dias = diasCal.filter(d => d.startsWith(m));
    const pcts = dias.map(d => 1 - S.calendario[d].faltas / S.calendario[d].esp);
    $('#calMes', el).textContent = `${MESES[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
    const primeiro = new Date(m + '-01T12:00:00'), off = (primeiro.getDay() + 6) % 7;
    let h = `<p class="nota">${dias.length} dias com aula · média de ${pct(pcts.reduce((a, b) => a + b, 0) / (pcts.length || 1))} de presença</p><div class="calp">` +
      ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map(d => `<div class="cal-s">${d}</div>`).join('');
    const ultimo = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();
    for (let d = 1; d <= ultimo; d++) {
      const dt = new Date(+m.slice(0, 4), +m.slice(5) - 1, d), dw = dt.getDay();
      if (dw === 0 || dw === 6) continue;
      if (d <= 7 && d === 1) for (let i = 0; i < Math.min(off, 5); i++) h += '<div class="cal-d vazio"></div>';
      const iso_ = `${m}-${String(d).padStart(2, '0')}`, c = S.calendario[iso_];
      if (!c) { h += `<div class="cal-d sem"><span class="n">${d}</span><small>${iso_ > HOJE ? '' : 'sem aula'}</small></div>`; continue; }
      const p = 1 - c.faltas / c.esp;
      h += `<button class="cal-d ${p >= 0.9 ? 'bom' : p >= 0.75 ? 'medio' : 'ruim'} ${iso_ === HOJE ? 'hoje' : ''}" data-dia="${iso_}"><span class="n">${d}</span><b>${pct(p, 0)}</b><small>${c.faltas} faltas</small></button>`;
    }
    $('#sgCal', el).innerHTML = h + '</div>';
    $('#calAnt', el).disabled = mi === 0;
    $('#calProx', el).disabled = mi === meses.length - 1;
  };
  $('#calAnt', el).onclick = () => { if (mi > 0) { mi--; desenharCal(); } };
  $('#calProx', el).onclick = () => { if (mi < meses.length - 1) { mi++; desenharCal(); } };
  $('#sgCal', el).onclick = e => {
    const b = e.target.closest('[data-dia]');
    if (!b) return;
    const c = S.calendario[b.dataset.dia];
    janela(`<div class="jan-h"><h2>Presença em ${dataBR(b.dataset.dia)}</h2><p>${num(c.esp - c.faltas)} alunos vieram, ${num(c.faltas)} faltaram.</p></div>
      ${c.turmas.map(([t, n, aus]) => `<details class="grupo"><summary>${t}${pill(pct(1 - aus.length / n, 0), 1 - aus.length / n >= 0.9 ? 'bom' : 1 - aus.length / n >= 0.75 ? 'medio' : 'ruim')}<span class="mudo">${aus.length} falta${aus.length === 1 ? '' : 's'}</span></summary>
        ${aus.length ? aus.map(id => `<div class="doc-l" data-aluno="${id}"><span>${esc(CO_ID[id].nome)}</span><small class="mudo">matrícula ${id}</small></div>`).join('') : '<p class="nota">Turma completa.</p>'}</details>`).join('')}`, 680);
  };
  desenharCal();

  // heatmap
  const disc = (S.heatmap.__TODAS__ || []).slice().sort((a, b) => a.media - b.media).map(l => l.disciplina);
  const corH = v => `hsl(${Math.round(Math.max(0, Math.min(1, (v - 5) / 4)) * 120)},70%,${v < 7 ? 88 : 90}%)`;
  $('#sgHeat', el).innerHTML = `<div class="tabela-wrap"><div class="heat" style="grid-template-columns:150px repeat(${turmasNota.length},minmax(58px,1fr))">
    <div></div>${turmasNota.map(t => `<div class="heat-h">${rotT(t.turma)}</div>`).join('')}
    ${disc.map(d => `<div class="heat-r">${d}</div>` + turmasNota.map(t => {
      const l = (S.heatmap[t.turma] || []).find(x => x.disciplina === d);
      return l ? `<div class="heat-c" style="background:${corH(l.media)}" data-tip="${esc(`<b>${t.turma} · ${d}</b><br>Média: <b>${nota1(l.media)}</b><br>min ${nota1(l.min)} / max ${nota1(l.max)}<br>${l.n} alunos · ${l.abaixo_7} abaixo de 7`)}">${nota1(l.media)}</div>` : '<div class="heat-c vazio">—</div>';
    }).join('')).join('')}</div></div>`;
}

// ---------------------------------------------------------------- Simulados
function coSimulados(el) {
  const P = CO.simulados;
  const AREAS = [['linguagens', 'Linguagens'], ['matematica', 'Matemática'], ['ciencias_humanas', 'C. Humanas'], ['ciencias_natureza', 'C. Natureza']];
  const COR_CAT = {'Simulado ENEM': COR.verm, 'Simulado da Rede': COR.laranja, 'Avaliação Nacional': COR.azul};
  const avaliados = new Set(P.flatMap(p => p.alunos.map(a => a.id))).size;
  const enem = P.filter(p => p.tri), outras = P.filter(p => !p.tri);
  let cat = '';
  el.innerHTML = `
    <div class="kpis k4">
      ${kpi({rotulo: 'Provas aplicadas', valor: num(P.length), sub: `${enem.length} simulados ENEM · ${outras.length} avaliações`, cor: COR.roxo})}
      ${kpi({rotulo: 'Alunos avaliados', valor: num(avaliados), sub: '9º ano ao 3º médio', cor: COR.azul})}
      ${kpi({rotulo: 'Média TRI no último ENEM', valor: num(enem[enem.length - 1].media, 0), sub: `${enem[enem.length - 1].nome} · ${dataBR(enem[enem.length - 1].data)}`, cor: COR.verm})}
      ${kpi({rotulo: 'Melhor posição na rede', valor: `${Math.min(...P.map(p => p.ranking))}º`, sub: `de ${P[0].escolas_rede} escolas da rede fictícia`, cor: COR.verde})}
    </div>
    <div class="grid g2">
      ${card('Evolução nos simulados ENEM', grafLinhas({rotulos: enem.map(p => p.nome.replace('Simulado ', '')), series: AREAS.map(([k, n], i) => ({nome: n, valores: enem.map(p => p.areas[k]), cor: PALETA[i]}))
        .concat([{nome: 'Média TRI', valores: enem.map(p => p.media), cor: COR.ink, espessura: 3.4}]), W: LG.metade, h: 250, fmtY: v => num(v), pontos: true, fim: false, yMin: 450}) +
        legenda(AREAS.map(([, n], i) => ({nome: n, cor: PALETA[i]})).concat([{nome: 'Média TRI', cor: COR.ink}])), {sub: 'Média TRI da escola por área, 2ª e 3ª série. Passe o mouse para ver os valores.'})}
      ${card('Evolução nas avaliações (acertos)', grafLinhas({rotulos: outras.map(p => p.nome.replace('Avaliação ', 'Aval. ').replace('Simulado da ', '')), series: [{nome: '% de acertos', valores: outras.map(p => p.media), cor: COR.azul, area: true}],
        W: LG.metade, h: 250, fmtY: v => num(v) + '%', pontos: true, valores: true, fim: false, yMin: 40}), {sub: '9º ano e 1ª série, em ordem de aplicação.'})}
    </div>
    <div class="filtros mt"><div class="seg-btns" id="smCat"></div></div>
    <div class="prova-grid" id="smGrid"></div>`;
  const desenhar = () => {
    $('#smGrid', el).innerHTML = P.filter(p => !cat || p.categoria === cat).map(p => `<button class="prova" data-prova="${p.id}" style="--c:${COR_CAT[p.categoria]}">
      <small>${p.categoria}${p.redacao ? ' · + Redação' : ''}</small><b>${p.nome}</b><span class="mudo">${p.series.join(', ')} · ${dataBR(p.data)}</span>
      <div class="prova-m"><span>${p.tri ? 'Média TRI' : 'Acertos'}<b>${p.tri ? num(p.media, 0) : num(p.media, 1) + '%'}</b></span><span>Participação<b>${pct(p.participacao, 0)}</b></span><span>Rede<b>${p.ranking}º</b></span></div></button>`).join('');
  };
  subAbas($('#smCat', el), [{id: '', nome: 'Todas'}, ...Object.keys(COR_CAT).map(c => ({id: c, nome: c}))], c => { cat = c; desenhar(); });
  $('#smGrid', el).onclick = e => { const b = e.target.closest('[data-prova]'); if (b) janelaProva(P.find(p => p.id === +b.dataset.prova), AREAS); };
}

function janelaProva(p, AREAS) {
  const fmt = v => p.tri ? num(v, 0) : num(v, 1) + '%';
  const faixas = p.tri ? [[0, 400], [400, 500], [500, 600], [600, 700], [700, 1000]] : [[0, 40], [40, 55], [55, 70], [70, 85], [85, 101]];
  const nomesF = faixas.map(([a, b]) => p.tri ? (b === 1000 ? '700+' : `${a}-${b}`) : (b === 101 ? '85%+' : `${a}-${b}%`));
  const hist = faixas.map(([a, b]) => p.alunos.filter(x => x.nota >= a && x.nota < b).length);
  const rec = ['Desafiar', 'Consolidar', 'Orientar', 'Intervir'];
  const corRec = {Desafiar: COR.verde, Consolidar: COR.azul, Orientar: COR.ambar, Intervir: COR.verm};
  const j = janela(`<div class="jan-h"><h2>${p.nome}</h2><p>${p.categoria} · ${p.series.join(', ')} · aplicada em ${dataBR(p.data)}</p></div>
    <div class="kpis k5">
      ${kpi({rotulo: p.tri ? 'Média TRI da escola' : 'Acertos da escola', valor: fmt(p.media), cor: COR.roxo})}
      ${kpi({rotulo: 'Posição na rede', valor: `${p.ranking}º`, sub: `de ${p.escolas_rede} escolas`, cor: COR.verde})}
      ${kpi({rotulo: 'Participação', valor: pct(p.participacao, 0), sub: `${p.participantes} de ${p.inscritos}`, cor: COR.azul})}
      ${kpi({rotulo: 'Desvio padrão', valor: p.tri ? num(p.dp, 0) : num(p.dp, 1), sub: 'dispersão entre os alunos', cor: COR.cinzaEsc})}
      ${kpi({rotulo: 'Alunos na rede', valor: num(p.alunos_rede), sub: 'base do ranking individual', cor: COR.cinzaEsc})}
    </div>
    <div class="grid g2">
      ${card('Comparativo com a rede', `<div class="tabela-wrap"><table><thead><tr><th></th>${AREAS.map(a => `<th class="n">${a[1]}</th>`).join('')}</tr></thead><tbody>
        <tr><td><b>Nossa escola</b></td>${AREAS.map(a => `<td class="n"><b>${fmt(p.areas[a[0]])}</b></td>`).join('')}</tr>
        ${[['media', 'Média da rede'], ['maxima', 'Máxima'], ['minima', 'Mínima']].map(([k, n]) => `<tr><td>${n}</td>${AREAS.map(a => `<td class="n">${fmt(p.rede[k][a[0]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` +
        grafBarras({rotulos: AREAS.map(a => a[1]), series: [{nome: 'Escola', valores: AREAS.map(a => p.areas[a[0]]), cor: COR.roxo}, {nome: 'Rede', valores: AREAS.map(a => p.rede.media[a[0]]), cor: COR.cinza}], W: LG.metade, h: 210, fmtValor: fmt}))}
      ${card('Distribuição das notas', grafBarras({rotulos: nomesF, series: [{nome: 'Alunos', valores: hist, cor: COR.azul}], valores: true, W: LG.metade, h: 210}) +
        `<div class="rosca-box">${grafRosca(rec.map(r => ({nome: r, valor: p.alunos.filter(a => a.recomendacao === r).length, cor: corRec[r]})), {tam: 150, esp: 24, centro: num(p.participantes), sub: 'alunos', fmt: v => num(v) + ' alunos'})}
         ${legenda(rec.map(r => ({nome: `${r} (${p.alunos.filter(a => a.recomendacao === r).length})`, cor: corRec[r]})))}</div><p class="nota">Recomendação pedagógica pela posição na escola: 20% melhores desafiar, 20% piores intervir.</p>`)}
    </div>
    ${card('Desempenho por turma', `<div class="tabela-wrap"><table><thead><tr><th>Turma</th><th class="n">Alunos</th><th class="n">${p.tri ? 'Média TRI' : 'Acertos'}</th>${AREAS.map(a => `<th class="n">${a[1]}</th>`).join('')}</tr></thead><tbody>
      ${p.por_turma.map(t => `<tr><td><b>${t.turma}</b></td><td class="n">${t.n}</td><td class="n"><b>${fmt(t.media)}</b></td>${AREAS.map(a => `<td class="n">${fmt(t.areas[a[0]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`, {classe: 'mt'})}
    ${p.redacao ? card('Redação · média por competência', grafBarras({rotulos: ['C1', 'C2', 'C3', 'C4', 'C5'], series: [{nome: 'Média (0-200)', valores: ['C1', 'C2', 'C3', 'C4', 'C5'].map(c => p.redacao[c]), cor: COR.rosa}], valores: true, W: LG.cheio, h: 200, fmtValor: v => num(v, 0)}),
      {sub: `Nota média da redação: ${num(p.redacao.total, 0)} de 1000. C1 norma culta · C2 tema · C3 argumentação · C4 coesão · C5 proposta de intervenção.`, classe: 'mt'}) : ''}
    ${card('Desempenho individual', `<div class="filtros"><input id="pvBusca" type="search" placeholder="Buscar aluno"><select id="pvTurma"><option value="">Todas as turmas</option>${p.por_turma.map(t => `<option>${t.turma}</option>`).join('')}</select></div><div id="pvTab"></div>`, {classe: 'mt'})}`, 1180);
  const cols = [{k: 'rank_esc', l: '#', n: 1}, {k: 'nome', l: 'Aluno', f: (v, r) => `<a class="link" data-aluno="${r.id}">${esc(v)}</a>`}, {k: 'turma', l: 'Turma'},
    {k: 'nota', l: p.tri ? 'TRI' : 'Acertos', n: 1, f: v => `<b>${fmt(v)}</b>`},
    ...AREAS.map(a => ({k: a[0], l: a[1], n: 1, f: v => fmt(v)})),
    ...(p.redacao ? [{k: 'red', l: 'Redação', n: 1, f: v => num(v)}] : []),
    {k: 'rank_rede', l: 'Rank rede', n: 1, f: v => num(v) + 'º'}, {k: 'recomendacao', l: 'Recomendação', f: v => `<span class="pill" style="background:${corRec[v]}22;color:${corRec[v]}">${v}</span>`}];
  const linhas = p.alunos.map(a => ({...a, nome: CO_ID[a.id]?.nome || '—', red: a.redacao?.total, ...(p.tri ? a.por_area : a.acertos_por_area)}));
  const tab = new Tabela($('#pvTab', j), {colunas: cols, linhas, ordem: {k: 'rank_esc', dir: 1}, limite: 60});
  const filtrar = () => {
    const b = $('#pvBusca', j).value.trim().toLowerCase(), t = $('#pvTurma', j).value;
    tab.atualizar(linhas.filter(r => (!b || r.nome.toLowerCase().includes(b)) && (!t || r.turma === t)));
  };
  $('#pvBusca', j).oninput = filtrar;
  $('#pvTurma', j).onchange = filtrar;
}
