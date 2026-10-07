// Inicialização da página da Coordenação: cada aba só é montada quando abre pela primeira vez.

const ABAS = {
  geral: coGeral,
  alunos: coAlunos,
  fund1: el => coSegmento(el, 'fund1'),
  fund2: el => coSegmento(el, 'fund2'),
  em: el => coSegmento(el, 'em'),
  resultados: coSimulados,
};
const montadas = new Set();

function abrirAba(nome) {
  if (!ABAS[nome]) nome = 'geral';
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
addEventListener('hashchange', () => { const m = /tab=([a-z0-9]+)/.exec(location.hash); if (m) abrirAba(m[1]); });

// clique em qualquer aluno (card, ponto da dispersão, linha de tabela) abre a ficha; em professor, a formação
$('main').addEventListener('click', e => {
  const al = e.target.closest('[data-aluno]');
  if (al) return abrirAluno(+al.dataset.aluno);
  const dc = e.target.closest('[data-doc]');
  if (dc) janelaDocente(CO_DOC[+dc.dataset.doc]);
});

$('#btnTema').addEventListener('click', () => aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('#nomeEscola').textContent = D.meta.escola;
$('#dataRef').textContent = dataBR(HOJE);
const m0 = /tab=([a-z0-9]+)/.exec(location.hash);
abrirAba(m0 ? m0[1] : 'geral');
