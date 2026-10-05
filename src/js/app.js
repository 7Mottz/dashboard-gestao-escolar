// Inicialização: cada aba só é montada quando abre pela primeira vez.

const ABAS = {
  financeiro: renderFinanceiro,
  alunado: renderAlunado,
  rematricula: renderRematricula,
  farol: renderFarol,
  funil: renderFunil,
};
const montadas = new Set();
let abaAtual = null;

function abrirAba(nome) {
  if (!ABAS[nome]) nome = 'financeiro';
  abaAtual = nome;
  $$('#abas button').forEach(b => b.classList.toggle('on', b.dataset.aba === nome));
  $$('.aba').forEach(s => s.classList.toggle('on', s.id === 'aba-' + nome));
  if (!montadas.has(nome)) {
    montadas.add(nome);
    ABAS[nome]($('#aba-' + nome));
  }
}

$('#abas').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  abrirAba(b.dataset.aba);
  history.replaceState(null, '', '#tab=' + b.dataset.aba);
});

function rotaInicial() {
  const h = location.hash;
  if (h === '#apresentacao') { abrirAba('financeiro'); abrirApresentacao('tv'); return; }
  const m = /tab=([a-z]+)/.exec(h);
  abrirAba(m ? m[1] : 'financeiro');
}
addEventListener('hashchange', () => { const m = /tab=([a-z]+)/.exec(location.hash); if (m) abrirAba(m[1]); });

$('#btnTema').addEventListener('click', () => aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

// painel lateral (usado pelo calendário de vencimentos)
function abrirLateral(html) {
  $('#lateralCorpo').innerHTML = html;
  $('#lateral').hidden = false;
}
$('#lateral').addEventListener('click', e => { if (e.target.closest('[data-fechar]')) $('#lateral').hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lateral').hidden) $('#lateral').hidden = true; });

// o tooltip dos botões de apresentação diz qual tela foi detectada
function classificarTela(w, h) {
  const maior = Math.max(w, h), menor = Math.min(w, h), r = maior / menor;
  if (maior >= 3840) return 'TV / monitor 4K';
  if (maior >= 2560 && r >= 1.6) return 'Monitor QHD';
  if (maior >= 2048 && r < 1.4) return 'iPad na horizontal';
  if (maior >= 1920 && r >= 1.7) return 'TV / monitor Full HD';
  if (maior >= 1600) return 'Monitor HD+';
  if (maior >= 1366) return 'Notebook HD';
  return 'Tablet / tela pequena';
}
function atualizarDicas() {
  const w = screen.width, h = screen.height;
  const txt = `14 slides · tela ${w}×${h} (${classificarTela(w, h)}) · escala ${Math.round(Math.min(innerWidth / 2048, innerHeight / 1536) * 100)}%`;
  $('#btnCompleta').title = 'Exibição completa: ' + txt;
  $('#btnIpad').title = 'Modo iPad: ' + txt;
}
$('#btnCompleta').addEventListener('click', () => abrirApresentacao('tv'));
$('#btnIpad').addEventListener('click', () => abrirApresentacao('ipad'));
addEventListener('resize', atualizarDicas);

$('#nomeEscola').textContent = D.meta.escola;
$('#dataRef').textContent = dataBR(HOJE);
atualizarDicas();
rotaInicial();
