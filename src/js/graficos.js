// Gráficos em SVG feitos na mão. Cada função devolve uma string pronta pra innerHTML.
// Todos desenham num viewBox (W x h) e escalam pra largura de onde forem colocados.

const f1 = v => Math.round(v * 10) / 10;

function teto(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// limites do eixo com números redondos
function eixo(max, min = 0, divisoes = 5) {
  const amplitude = (max - min) || Math.abs(max) || 1;
  const passo = teto(amplitude / divisoes);
  const lo = Math.floor(min / passo) * passo;
  const hi = Math.max(lo + passo, Math.ceil(max / passo) * passo);
  return {min: lo, max: hi, passo};
}

function hachuras(cores) {
  return '<defs>' + [...new Set(cores)].map(c =>
    `<pattern id="h${c.slice(1)}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="7" height="7" fill="${c}" opacity=".16"/><rect width="2.6" height="7" fill="${c}"/></pattern>`).join('') + '</defs>';
}
const preenchimento = (cor, hachurado) => hachurado ? `url(#h${cor.slice(1)})` : cor;

function grade(e, y, x1, x2, fmt, padL) {
  let s = '';
  for (let v = e.min; v <= e.max + e.passo / 1000; v += e.passo) {
    s += `<line class="${Math.abs(v) < e.passo / 1000 && e.min < 0 ? 'zero' : 'grade'}" x1="${x1}" x2="${x2}" y1="${f1(y(v))}" y2="${f1(y(v))}"/>` +
      `<text x="${padL - 10}" y="${f1(y(v) + 4)}" text-anchor="end">${fmt(v)}</text>`;
  }
  return s;
}

function rotulosX(rotulos, x, yTexto, cada) {
  const k = cada || Math.max(1, Math.ceil(rotulos.length / 13));
  return rotulos.map((r, i) => i % k === 0 || i === rotulos.length - 1 && rotulos.length - 1 - (rotulos.length - 1) % k > k / 2
    ? `<text class="rot" x="${f1(x(i))}" y="${yTexto}" text-anchor="middle">${r}</text>` : '').join('');
}

function grafLinhas({rotulos, series, W = LG.cheio, h = 300, fmtY = num, fmtTip, yMin = 0, yMax, marcas = [],
                     pontos = false, valores = false, fim = true, cada, padL = 58, padR = 34, padT = 18, padB = 34}) {
  fmtTip = fmtTip || fmtY;
  const n = rotulos.length, iw = W - padL - padR, ih = h - padT - padB;
  const todos = series.flatMap(s => s.valores.filter(v => v != null));
  const e = eixo(yMax ?? Math.max(...todos, 0), Math.min(yMin, ...todos));
  const x = i => padL + (n === 1 ? iw / 2 : iw * i / (n - 1));
  const y = v => padT + ih - ih * (v - e.min) / (e.max - e.min);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${h}" role="img"><defs>` +
    series.filter(se => se.area).map(se => `<linearGradient id="g${se.cor.slice(1)}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${se.cor}" stop-opacity=".22"/><stop offset="1" stop-color="${se.cor}" stop-opacity="0"/></linearGradient>`).join('') + '</defs>';
  s += grade(e, y, padL, W - padR, fmtY, padL) + rotulosX(rotulos, x, h - 10, cada);
  marcas.forEach(m => {
    s += `<line class="sep" x1="${f1(x(m.i))}" x2="${f1(x(m.i))}" y1="${padT}" y2="${padT + ih}"/><text class="forte" x="${f1(x(m.i) + 6)}" y="${padT + 12}">${m.texto}</text>`;
  });
  series.forEach(se => {
    let d = '', aberto = false, area = '', ini = null, ult = null;
    se.valores.forEach((v, i) => {
      if (v == null) { aberto = false; return; }
      d += (aberto ? 'L' : 'M') + f1(x(i)) + ' ' + f1(y(v));
      if (ini === null) ini = i;
      ult = i;
      aberto = true;
    });
    if (se.area && ini !== null) {
      area = `<path d="${d}L${f1(x(ult))} ${f1(y(Math.max(e.min, 0)))}L${f1(x(ini))} ${f1(y(Math.max(e.min, 0)))}Z" fill="url(#g${se.cor.slice(1)})"/>`;
    }
    s += area + `<path d="${d}" fill="none" stroke="${se.cor}" stroke-width="${se.espessura || (se.tracejado ? 2 : 2.6)}" ${se.tracejado ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    if (pontos || se.pontos) se.valores.forEach((v, i) => { if (v != null) s += `<circle cx="${f1(x(i))}" cy="${f1(y(v))}" r="3.4" fill="${se.cor}"/>`; });
    if (valores || se.rotular) se.valores.forEach((v, i) => {
      if (v != null) s += `<text class="valor" x="${f1(x(i))}" y="${f1(y(v) - (se.abaixo ? -16 : 9))}" text-anchor="middle" fill="${se.cor}">${(se.fmtValor || fmtY)(v)}</text>`;
    });
    if (fim && ult !== null && !(valores || se.rotular)) {
      s += `<circle cx="${f1(x(ult))}" cy="${f1(y(se.valores[ult]))}" r="4.5" fill="${se.cor}"/><text class="valor" x="${f1(x(ult) + 8)}" y="${f1(y(se.valores[ult]) + 4)}" fill="${se.cor}">${fmtTip(se.valores[ult])}</text>`;
    }
  });
  // faixas invisíveis pro tooltip mostrar todas as séries do ponto
  const larg = n > 1 ? iw / (n - 1) : iw;
  rotulos.forEach((r, i) => {
    const linhas = series.filter(se => se.valores[i] != null).map(se => `<i style="background:${se.cor}"></i>${se.nome}: <b>${fmtTip(se.valores[i])}</b>`);
    if (linhas.length) s += `<rect class="hover" x="${f1(x(i) - larg / 2)}" y="${padT}" width="${f1(larg)}" height="${ih}" data-tip="${esc(`<b>${r}</b><br>` + linhas.join('<br>'))}"/>`;
  });
  return s + '</svg>';
}

function grafBarras({rotulos, series, empilhado = false, W = LG.cheio, h = 300, fmtValor = num, fmtEixo, hachurarDe = -1,
                     hachurar, valores = false, total = false, linhas = [], fmtEixoDir, rotuloTip, padL = 64, padR, padT = 22, padB = 34, cada}) {
  const temDir = linhas.some(l => l.dir);
  padR = padR ?? (temDir ? 58 : 10);
  fmtEixo = fmtEixo || (Math.max(...series.flatMap(s => s.valores)) >= 1e4 ? eixoMil : num);
  const n = rotulos.length, iw = W - padL - padR, ih = h - padT - padB;
  const somaPilha = i => soma(series, s => Math.max(0, s.valores[i] || 0));
  const maxEsq = Math.max(1, ...(empilhado ? rotulos.map((_, i) => somaPilha(i)) : series.flatMap(s => s.valores)),
    ...linhas.filter(l => !l.dir).flatMap(l => l.valores.filter(v => v != null)));
  const minEsq = Math.min(0, ...series.flatMap(s => s.valores));
  const e = eixo(maxEsq, minEsq);
  const eDir = temDir ? eixo(Math.max(1, ...linhas.filter(l => l.dir).flatMap(l => l.valores.filter(v => v != null)))) : null;
  const y = v => padT + ih - ih * (v - e.min) / (e.max - e.min);
  const yDir = v => padT + ih - ih * (v - eDir.min) / (eDir.max - eDir.min);
  const g = iw / n, gap = 3;
  const bw = empilhado ? Math.min(44, g * 0.62) : Math.min(30, (g * 0.74 - gap * (series.length - 1)) / series.length);
  const x = i => padL + g * i + g / 2;
  let s = `<svg class="graf" viewBox="0 0 ${W} ${h}" role="img">` + hachuras(series.map(se => se.cor)) + grade(e, y, padL, W - padR, fmtEixo, padL);
  if (eDir) for (let v = eDir.min; v <= eDir.max + eDir.passo / 1000; v += eDir.passo)
    s += `<text x="${W - padR + 8}" y="${f1(yDir(v) + 4)}">${(fmtEixoDir || num)(v)}</text>`;
  rotulos.forEach((r, i) => {
    const hach = j => (hachurar ? hachurar(i, j) : hachurarDe >= 0 && i >= hachurarDe);
    if (empilhado) {
      let base = 0;
      series.forEach((se, j) => {
        const v = se.valores[i] || 0;
        if (v <= 0) return;
        const y1 = y(base + v), alt = y(base) - y1;
        s += `<rect x="${f1(x(i) - bw / 2)}" y="${f1(y1)}" width="${f1(bw)}" height="${f1(alt)}" fill="${preenchimento(se.cor, hach(j))}"/>`;
        if (valores && alt > 16) s += `<text class="valor dentro" x="${f1(x(i))}" y="${f1(y1 + alt / 2 + 4)}" text-anchor="middle">${fmtValor(v)}</text>`;
        base += v;
      });
      if (total) s += `<text class="valor" x="${f1(x(i))}" y="${f1(y(base) - 6)}" text-anchor="middle">${fmtValor(base)}</text>`;
    } else {
      let xx = x(i) - (series.length * bw + (series.length - 1) * gap) / 2;
      series.forEach((se, j) => {
        const v = se.valores[i];
        if (v == null) { xx += bw + gap; return; }
        const y0 = y(Math.max(0, v)), alt = Math.abs(y(v) - y(0));
        s += `<rect x="${f1(xx)}" y="${f1(v >= 0 ? y0 : y(0))}" width="${f1(bw)}" height="${f1(Math.max(alt, 0.5))}" rx="3" fill="${preenchimento(se.cor, hach(j))}"/>`;
        if (valores) s += `<text class="valor" x="${f1(xx + bw / 2)}" y="${f1(v >= 0 ? y0 - 6 : y(v) + 14)}" text-anchor="middle" fill="${se.cor}">${fmtValor(v)}</text>`;
        xx += bw + gap;
      });
    }
  });
  s += rotulosX(rotulos, x, h - 10, cada);
  linhas.forEach(l => {
    const yy = l.dir ? yDir : y;
    let d = '';
    l.valores.forEach((v, i) => { if (v != null) d += (d ? 'L' : 'M') + f1(x(i)) + ' ' + f1(yy(v)); });
    s += `<path d="${d}" fill="none" stroke="${l.cor}" stroke-width="2.6" ${l.tracejado ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round"/>`;
    l.valores.forEach((v, i) => { if (v != null && l.pontos !== false) s += `<circle cx="${f1(x(i))}" cy="${f1(yy(v))}" r="3.4" fill="${l.cor}"/>`; });
    if (l.rotular) l.valores.forEach((v, i) => { if (v != null) s += `<text class="valor" x="${f1(x(i))}" y="${f1(yy(v) - 9)}" text-anchor="middle" fill="${l.cor}">${(l.fmt || num)(v)}</text>`; });
  });
  rotulos.forEach((r, i) => {
    const partes = series.map(se => `<i style="background:${se.cor}"></i>${se.nome}: <b>${se.valores[i] == null ? '—' : fmtValor(se.valores[i])}</b>`)
      .concat(linhas.map(l => `<i style="background:${l.cor}"></i>${l.nome}: <b>${l.valores[i] == null ? '—' : (l.fmt || num)(l.valores[i])}</b>`));
    if (empilhado && series.length > 1) partes.push(`Total: <b>${fmtValor(somaPilha(i))}</b>`);
    s += `<rect class="hover" x="${f1(padL + g * i)}" y="${padT}" width="${f1(g)}" height="${ih}" data-tip="${esc(`<b>${rotuloTip ? rotuloTip(i) : r}</b><br>` + partes.join('<br>'))}"/>`;
  });
  return s + '</svg>';
}

function grafCascata({rotulos, valores, acumulado, projetarDe, W = LG.cheio, h = 340, fmtValor, mostrarTotal = false}) {
  fmtValor = fmtValor || (v => (v >= 0 ? '+' : '−') + num(Math.abs(v) / 1e3));
  const padL = 74, padR = 10, padT = 34, pb = 64, iw = W - padL - padR, ih = h - padT - pb;
  const pontos = [0, ...acumulado];
  const e = eixo(Math.max(...pontos) * 1.12, Math.min(...pontos) * 1.12);
  const y = v => padT + (e.max - v) / (e.max - e.min) * ih;
  const n = rotulos.length + (mostrarTotal ? 1 : 0), g = iw / n, bw = Math.min(46, g * 0.6);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${h}" role="img">` + hachuras([COR.verde, COR.verm]) + grade(e, y, padL, W - padR, eixoMil, padL);
  if (projetarDe > 0 && projetarDe < rotulos.length) {
    const xs = padL + g * projetarDe;
    s += `<line class="sep" x1="${xs}" x2="${xs}" y1="${padT - 18}" y2="${padT + ih}"/><text class="forte" x="${xs - 8}" y="${padT - 22}" text-anchor="end">Realizado</text><text class="forte" x="${xs + 8}" y="${padT - 22}">Projetado</text>`;
  }
  valores.forEach((v, i) => {
    const ini = i ? acumulado[i - 1] : 0, fimV = acumulado[i], cor = v >= 0 ? COR.verde : COR.verm;
    const cx = padL + g * i + g / 2, topo = Math.min(y(ini), y(fimV)), alt = Math.max(2, Math.abs(y(ini) - y(fimV)));
    s += `<rect x="${f1(cx - bw / 2)}" y="${f1(topo)}" width="${f1(bw)}" height="${f1(alt)}" rx="3" fill="${preenchimento(cor, i >= projetarDe)}" data-tip="${esc(`<b>${rotulos[i]}</b><br>Resultado do mês: <b>${brlSinal(v)}</b><br>Acumulado: <b>${brlSinal(fimV)}</b>`)}"/>`;
    if (i < valores.length - 1) s += `<line class="sep" x1="${f1(cx + bw / 2)}" x2="${f1(cx + g - bw / 2)}" y1="${f1(y(fimV))}" y2="${f1(y(fimV))}"/>`;
    s += `<text class="valor" x="${f1(cx)}" y="${f1(v >= 0 ? topo - 7 : topo + alt + 15)}" text-anchor="middle" fill="${cor}">${fmtValor(v)}</text>`;
    s += `<text class="rot" x="${f1(cx)}" y="${padT + ih + 22}" text-anchor="middle">${rotulos[i]}</text>`;
    s += `<text class="valor" x="${f1(cx)}" y="${h - 8}" text-anchor="middle" fill="${fimV >= 0 ? COR.verdeEsc : COR.vermEsc}">${(fimV >= 0 ? '+' : '−') + num(Math.abs(fimV) / 1e3)}</text>`;
  });
  if (mostrarTotal) {
    const fimV = acumulado[acumulado.length - 1], cx = padL + g * valores.length + g / 2, cor = fimV >= 0 ? COR.verdeEsc : COR.vermEsc;
    s += `<rect x="${f1(cx - bw / 2)}" y="${f1(Math.min(y(0), y(fimV)))}" width="${f1(bw)}" height="${f1(Math.abs(y(0) - y(fimV)))}" rx="3" fill="${cor}"/>` +
      `<text class="rot" x="${f1(cx)}" y="${padT + ih + 22}" text-anchor="middle">Ano</text>` +
      `<text class="valor" x="${f1(cx)}" y="${f1(Math.min(y(0), y(fimV)) - 7)}" text-anchor="middle" fill="${cor}">${fmtValor(fimV)}</text>`;
  }
  return s + `<text x="${padL - 10}" y="${h - 8}" text-anchor="end" class="forte">Acum.</text></svg>`;
}

function grafRosca(itens, {tam = 210, esp = 32, centro = '', sub = '', fmt = brl} = {}) {
  const r = (tam - esp) / 2, c = 2 * Math.PI * r, tot = soma(itens, 'valor') || 1, m = tam / 2;
  let off = 0, s = `<svg class="rosca" viewBox="0 0 ${tam} ${tam}" width="${tam}" height="${tam}" role="img"><circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--trilho)" stroke-width="${esp}"/><g transform="rotate(-90 ${m} ${m})">`;
  itens.forEach(it => {
    const l = c * it.valor / tot, vis = Math.max(l - 2, 0.5);
    s += `<circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${it.cor}" stroke-width="${esp}" stroke-dasharray="${f1(vis)} ${f1(c - vis)}" stroke-dashoffset="${f1(-off)}" data-tip="${esc(`<b>${it.nome}</b><br>${fmt(it.valor)} · ${pct(it.valor / tot)}`)}"/>`;
    off += l;
  });
  s += '</g>';
  // fonte proporcional ao tamanho, assim a rosca serve tanto no card quanto no palco da apresentação
  const fc = f1(tam * 0.125), fs = f1(tam * 0.055);
  if (centro) s += `<text class="rosca-c" style="font-size:${fc}px" x="${m}" y="${f1(m + (sub ? fc * 0.1 : fc * 0.35))}" text-anchor="middle">${centro}</text>${sub ? `<text class="rosca-s" style="font-size:${fs}px" x="${m}" y="${f1(m + fc * 0.85)}" text-anchor="middle">${sub}</text>` : ''}`;
  return s + '</svg>';
}

// meia-rosca tipo velocímetro, com ponteiro na fronteira entre as duas partes
function grafMeiaRosca(p, {tam = 280, esp = 34, cor = COR.verde, corResto = COR.laranja, tip1 = '', tip2 = ''} = {}) {
  p = Math.max(0, Math.min(1, p));
  const r = (tam - esp) / 2, cx = tam / 2, cy = tam / 2, a = Math.PI * (1 - p);
  const px = cx + r * Math.cos(a), py = cy - r * Math.sin(a);
  const arco = (x1, y1, x2, y2, c, t) => `<path d="M${f1(x1)} ${f1(y1)}A${r} ${r} 0 0 1 ${f1(x2)} ${f1(y2)}" fill="none" stroke="${c}" stroke-width="${esp}" ${t ? `data-tip="${esc(t)}"` : ''}/>`;
  const rp = r - esp / 2 - 6;
  return `<svg class="meia" viewBox="0 0 ${tam} ${tam / 2 + 14}" width="${tam}" role="img">` +
    (p > 0 ? arco(cx - r, cy, px, py, cor, tip1) : '') + (p < 1 ? arco(px, py, cx + r, cy, corResto, tip2) : '') +
    `<line x1="${cx}" y1="${cy}" x2="${f1(cx + rp * Math.cos(a))}" y2="${f1(cy - rp * Math.sin(a))}" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="8" fill="var(--ink)"/></svg>`;
}

function grafAnel(p, {tam = 150, esp = 16, cor = COR.laranja, centro = '', sub = ''} = {}) {
  const r = (tam - esp) / 2, c = 2 * Math.PI * r, m = tam / 2, l = c * Math.max(0, Math.min(1, p));
  return `<svg class="anel" viewBox="0 0 ${tam} ${tam}" width="${tam}" height="${tam}" role="img"><circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--trilho)" stroke-width="${esp}"/>` +
    `<circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${cor}" stroke-width="${esp}" stroke-linecap="round" stroke-dasharray="${f1(l)} ${f1(c)}" transform="rotate(-90 ${m} ${m})"/>` +
    `<text class="anel-c" style="font-size:${f1(tam * 0.16)}px" x="${m}" y="${f1(m + (sub ? tam * 0.02 : tam * 0.055))}" text-anchor="middle" fill="${cor}">${centro}</text>${sub ? `<text class="anel-s" style="font-size:${f1(tam * 0.065)}px" x="${m}" y="${f1(m + tam * 0.14)}" text-anchor="middle">${sub}</text>` : ''}</svg>`;
}

function barrasH(itens, {fmt = num, max, rotuloLarg} = {}) {
  const m = max || Math.max(...itens.map(i => i.valor)) || 1;
  return `<div class="bh" ${rotuloLarg ? `style="--rl:${rotuloLarg}"` : ''}>` + itens.map(i => `
    <div class="bh-l ${i.destaque ? 'destaque' : ''}" ${i.tip ? `data-tip="${esc(i.tip)}"` : ''}><span class="bh-n">${i.nome}</span><span class="bh-v">${fmt(i.valor)}${i.extra ? ` <small>${i.extra}</small>` : ''}</span>
    <div class="bh-t"><div style="width:${Math.max(0, i.valor / m * 100).toFixed(1)}%;background:${i.cor}"></div></div></div>`).join('') + '</div>';
}

// barras horizontais empilhadas (ex.: veteranos + novatos por série)
function barrasHEmp(itens, partes, {fmt = num} = {}) {
  const max = Math.max(1, ...itens.map(i => soma(partes, p => i[p.k] || 0)));
  return '<div class="bhe">' + itens.map(i => {
    const tot = soma(partes, p => i[p.k] || 0);
    return `<div class="bhe-l"><span class="bhe-n">${i.nome}</span><div class="bhe-t">${partes.map(p => i[p.k] ? `<div style="width:${(i[p.k] / max * 100).toFixed(2)}%;background:${p.cor}" data-tip="${esc(`<b>${i.nome}</b><br>${p.nome}: <b>${fmt(i[p.k])}</b>`)}"></div>` : '').join('')}</div><span class="bhe-v">${fmt(tot)}</span></div>`;
  }).join('') + '</div>';
}

// barra divergente centrada no zero (economia à esquerda, estouro à direita)
function divergente(v, max = 1) {
  const w = Math.min(Math.abs(v) / max, 1) * 50;
  return `<div class="div-t"><div class="div-c"></div><div class="div-f ${v > 0 ? 'pos' : 'neg'}" style="${v > 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%"></div></div>`;
}

const ETAPAS_FUNIL = ['Leads', 'Conversas iniciadas', 'Visitas agendadas', 'Visitas realizadas', 'Matrículas'];
const CORES_FUNIL = [['#0ea5e9', '#e0f2fe', '#0369a1'], ['#14b8a6', '#ccfbf1', '#0f766e'], ['#8b5cf6', '#ede9fe', '#6d28d9'], ['#ea580c', '#ffedd5', '#c2410c'], ['#16a34a', '#dcfce7', '#15803d']];

// funil em trapézios (cada faixa termina na largura de onde começa a próxima)
function funilVisual(t, {grande = false, metas = null} = {}) {
  const topo = [100, 86, 72, 58, 44], base = [86, 72, 58, 44, 30];
  return `<div class="funil${grande ? ' grande' : ''}">` + t.map((v, i) => {
    const off = (topo[i] - base[i]) / 2 / topo[i] * 100;
    let dir = i ? `<span class="f-p">${t[i - 1] ? pct(v / t[i - 1]) + ' da anterior' : 'sem conversão'}</span>` : '<span></span>';
    if (metas && metas[i] != null) {
      const falta = metas[i] - v;
      dir = `<span class="f-p ${falta <= 0 ? 'ok' : ''}">${falta <= 0 ? 'meta batida' : `meta ${num(metas[i])} · faltam ${num(falta)}`}</span>`;
    }
    return `<div class="f-l"><span class="f-n"><i style="background:${CORES_FUNIL[i][0]}"></i>${ETAPAS_FUNIL[i]}</span>
      <div class="f-t"><div class="f-b" style="width:${topo[i]}%;background:${CORES_FUNIL[i][1]};clip-path:polygon(0 0,100% 0,${f1(100 - off)}% 100%,${f1(off)}% 100%)"><b style="color:${CORES_FUNIL[i][2]}">${num(v)}</b></div></div>${dir}</div>`;
  }).join('') + '</div>';
}
