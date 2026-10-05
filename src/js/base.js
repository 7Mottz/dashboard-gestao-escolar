// Utilitários usados por todas as abas: formatação, tooltip, tabelas e navegação.

const D = /*DADOS*/null;

if (!D) {
  document.querySelector('main').innerHTML =
    '<div class="card aviso"><h3>Este arquivo é só o template</h3><p>Rode <code>python build.py</code> na raiz do projeto e abra <code>docs/index.html</code>.</p></div>';
  throw new Error('template aberto sem dados');
}

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SEGMENTOS = ['Educação Infantil', 'Fundamental I', 'Fundamental II', 'Ensino Médio'];
const SIGLA_SEG = {'Educação Infantil': 'EI', 'Fundamental I': 'F1', 'Fundamental II': 'F2', 'Ensino Médio': 'EM'};

const COR = {
  verde: '#16a34a', verdeEsc: '#15803d', verm: '#dc2626', vermEsc: '#b91c1c', laranja: '#ea580c', laranjaEsc: '#c2410c',
  roxo: '#7c3aed', roxoEsc: '#6d28d9', azul: '#2563eb', ciano: '#0ea5e9', cianoEsc: '#0369a1', teal: '#0d9488',
  ambar: '#f59e0b', rosa: '#db2777', cinza: '#94a3b8', cinzaEsc: '#64748b', ink: '#0f172a',
};
const COR_SEG = {'Educação Infantil': '#f59e0b', 'Fundamental I': '#ea580c', 'Fundamental II': '#db2777', 'Ensino Médio': '#7c3aed'};
const PALETA = ['#2563eb', '#0ea5e9', '#7c3aed', '#db2777', '#f59e0b', '#0d9488', '#ea580c', '#475569', '#16a34a', '#94a3b8'];

// ---------- formatação
const num = (v, c = 0) => (+v || 0).toLocaleString('pt-BR', {minimumFractionDigits: c, maximumFractionDigits: c});
const pct = (v, c = 1) => isFinite(v) ? num(v * 100, c) + '%' : '—';
function brl(v) {
  const s = v < 0 ? '−' : '', a = Math.abs(v);
  if (a >= 1e6) return `${s}R$ ${num(a / 1e6, 2)} mi`;
  if (a >= 1e3) return `${s}R$ ${num(a / 1e3)} mil`;
  return `${s}R$ ${num(a)}`;
}
const brlSinal = v => (v > 0 ? '+' : '') + brl(v);
const brlCheio = v => (v < 0 ? '−' : '') + 'R$ ' + num(Math.abs(v), 2);
const brlInt = v => (v < 0 ? '−' : '') + 'R$ ' + num(Math.abs(v));
const eixoMil = v => v === 0 ? '0' : Math.abs(v) >= 1e6 ? num(v / 1e6, 1) + ' mi' : num(v / 1e3) + ' mil';
const dataBR = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
const diaMes = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const mesDe = chave => MESES[+chave.slice(5, 7) - 1];
const mesCurto = chave => MES_CURTO[+chave.slice(5, 7) - 1];
const soma = (lista, campo) => lista.reduce((a, x) => a + (campo ? (typeof campo === 'function' ? campo(x) : x[campo]) : x), 0);
const iso = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const somarDias = (s, n) => { const dt = new Date(s + 'T12:00:00'); dt.setDate(dt.getDate() + n); return iso(dt); };
const difDias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

// largura aproximada de cada tipo de card, pra o gráfico desenhar no tamanho em que vai aparecer
// (o SVG escala, mas o texto escala junto: desenhar em 1000 e mostrar em 400 deixa a fonte minúscula)
const LARG = Math.max(640, Math.min(innerWidth, 1360) - 48);
const LG = innerWidth > 1024 ? {
  cheio: LARG - 44,
  metade: Math.round((LARG - 16) / 2 - 44),
  terco: Math.round((LARG - 32) / 3 - 44),
  maior: Math.round((LARG - 16) * 0.6 - 44),
  fin: LARG - 230,
  finMaior: Math.round((LARG - 202) * 0.6 - 44),
  finMetade: Math.round((LARG - 202) / 2 - 44),
  finLado: LARG - 230 - 290,
} : (() => {
  // abaixo de 1024px as grades viram uma coluna (só as de 3 e 4 ficam em duas), ver o CSS
  const w = Math.max(300, innerWidth - (innerWidth <= 640 ? 28 : 48) - 44);
  return {cheio: w, metade: w, maior: w, fin: w, finMaior: w, finMetade: w, finLado: w, terco: Math.max(260, Math.round((w - 60) / 2))};
})();

const HOJE = D.meta.data_ref;
const ONTEM = somarDias(HOJE, -1);

// "descompacta" as tabelas que o pipeline manda como listas + dicionários
function expandir(t) {
  return t.linhas.map(row => {
    const o = {};
    t.campos.forEach((c, i) => {
      const v = row[i];
      o[c] = t.dic[c] && v !== null ? t.dic[c][v] : v;
    });
    return o;
  });
}

// ---------- componentes
const kpi = ({rotulo, valor, sub = '', cor, extra = '', classe = '', tip = ''}) =>
  `<div class="kpi ${classe}" style="--c:${!cor || cor === COR.ink ? 'var(--ink)' : cor}" ${tip ? `data-tip="${esc(tip)}"` : ''}>
    <span class="kpi-r">${rotulo}</span><strong class="kpi-v">${valor}</strong><span class="kpi-s">${sub}</span>${extra}</div>`;

const card = (titulo, corpo, {sub = '', classe = '', acoes = ''} = {}) =>
  `<section class="card ${classe}"><div class="card-h"><div><h3>${titulo}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${acoes}</div>${corpo}</section>`;

const legenda = itens => '<div class="leg">' + itens.map(i =>
  `<span><i class="${i.tipo || ''}" style="--c:${i.cor}"></i>${i.nome}</span>`).join('') + '</div>';

const barraProgresso = (partes, alto = 8) => `<div class="barra" style="height:${alto}px">${partes.map(p =>
  `<div style="width:${(p.v * 100).toFixed(2)}%;background:${p.cor}" ${p.tip ? `data-tip="${esc(p.tip)}"` : ''}></div>`).join('')}</div>`;

const pill = (texto, tipo) => `<span class="pill ${tipo}">${texto}</span>`;
const vazio = texto => `<div class="vazio">${texto}</div>`;

// ---------- tooltip único pra página toda (qualquer elemento com data-tip)
const tip = document.createElement('div');
tip.id = 'tip';
document.body.appendChild(tip);
document.addEventListener('mouseover', e => {
  const alvo = e.target.closest('[data-tip]');
  if (!alvo) { tip.classList.remove('on'); return; }
  tip.innerHTML = alvo.getAttribute('data-tip');
  tip.classList.add('on');
});
document.addEventListener('mousemove', e => {
  if (!tip.classList.contains('on')) return;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y + h > innerHeight - 8) y = e.clientY - h - 14;
  tip.style.transform = `translate(${x}px,${y}px)`;
});

// ---------- tabela com ordenação por coluna
// colunas: [{k, l, n (numérica), f (formatação), v (valor pra ordenar), classe}]
class Tabela {
  constructor(el, {colunas, linhas, ordem, total, limite, vazioTxt = 'Nada encontrado.'}) {
    Object.assign(this, {el, colunas, linhas, ordem: ordem || {k: colunas[0].k, dir: 1}, total, limite, vazioTxt});
    el.addEventListener('click', e => {
      const th = e.target.closest('th[data-k]');
      if (!th) return;
      const k = th.dataset.k;
      this.ordem = {k, dir: this.ordem.k === k ? -this.ordem.dir : (this.colunas.find(c => c.k === k).n ? -1 : 1)};
      this.render();
    });
    this.render();
  }
  atualizar(linhas, total) { this.linhas = linhas; this.total = total; this.render(); }
  render() {
    const col = this.colunas.find(c => c.k === this.ordem.k) || this.colunas[0];
    const val = r => col.v ? col.v(r) : r[col.k];
    const lista = [...this.linhas].sort((a, b) => {
      let x = val(a), y = val(b);
      if (x == null) x = -Infinity;
      if (y == null) y = -Infinity;
      return typeof x === 'string' ? this.ordem.dir * x.localeCompare(y, 'pt-BR') : this.ordem.dir * (x - y);
    });
    const mostrar = this.limite ? lista.slice(0, this.limite) : lista;
    const celula = (c, r) => `<td class="${c.n ? 'n' : ''} ${c.classe || ''}">${c.f ? c.f(r[c.k], r) : esc(r[c.k] ?? '—')}</td>`;
    this.el.innerHTML = `<div class="tabela-wrap"><table>
      <thead><tr>${this.colunas.map(c => `<th data-k="${c.k}" class="${c.n ? 'n' : ''} ${this.ordem.k === c.k ? 'ord' : ''}">${c.l}${this.ordem.k === c.k ? (this.ordem.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>
      <tbody>${mostrar.length ? mostrar.map(r => `<tr>${this.colunas.map(c => celula(c, r)).join('')}</tr>`).join('') : `<tr><td colspan="${this.colunas.length}" class="vazio-td">${this.vazioTxt}</td></tr>`}</tbody>
      ${this.total ? `<tfoot><tr>${this.colunas.map(c => celula(c, this.total)).join('')}</tr></tfoot>` : ''}
    </table></div>${this.limite && lista.length > this.limite ? `<p class="nota">Mostrando ${this.limite} de ${num(lista.length)}.</p>` : ''}`;
  }
}

// ---------- sub-abas (Farol e Funil)
function subAbas(el, abas, aoTrocar, inicial) {
  el.innerHTML = abas.map(a => `<button data-s="${a.id}">${a.nome}</button>`).join('');
  const ir = id => {
    $$('button', el).forEach(b => b.classList.toggle('on', b.dataset.s === id));
    aoTrocar(id);
  };
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ir(b.dataset.s); });
  ir(inicial || abas[0].id);
  return ir;
}

// ---------- tema claro/escuro
const TEMA_KEY = 'painel-tema';
function aplicarTema(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(TEMA_KEY, t); } catch (e) { /* modo privado */ }
}
(function () {
  let t = null;
  try { t = localStorage.getItem(TEMA_KEY); } catch (e) { /* modo privado */ }
  aplicarTema(t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
})();
