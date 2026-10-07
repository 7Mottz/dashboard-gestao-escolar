// Página do Radar de evasão. O modelo é treinado no pipeline (pipeline/evasao.py, scikit-learn);
// aqui a página conta a história: problema, dados, separação no tempo, modelos, métricas e resultado.

const E = D.evasao;
const AL = D.alunos;   // id -> [nome, turma, segmento]
const FAIXA_TXT = {alto: ['Alto', 'ruim'], medio: ['Médio', 'medio'], baixo: ['Baixo', 'bom']};
const REMAT_TXT = {rematriculado: ['Rematriculado', 'bom'], pendente: ['Pendente', 'medio'], nao_renova: ['Não vai renovar', 'ruim'], formando: ['Formando', 'neutro']};
const COR_MOD = {'Regressão logística': COR.roxo, 'Random forest': COR.verde, 'Gradient boosting': COR.ciano, 'Regra por pontos (0-8)': COR.cinza};
const NOMES_SERIE = ['Baby', 'Maternal', 'Jardim I', 'Jardim II', '1º ano', '2º ano', '3º ano', '4º ano', '5º ano', '6º ano', '7º ano', '8º ano', '9º ano', '1ª série', '2ª série', '3ª série'];
const NOME_VAR = Object.fromEntries(E.variaveis.map(v => [v.k, v.nome]).concat([['sem_nota', 'Sem nota (EI/1º ano)']]));

function fmtVar(k, v) {
  if (v == null) return '—';
  if (k === 'nota_media') return num(v, 1);
  if (k === 'pct_notas_baixas' || k === 'pct_faltas' || k === 'bolsa_pct') return pct(v, 0);
  if (k === 'fin_dias_max' || k === 'fin_dias_medio') return num(v) + ' dias';
  if (k === 'anos_escola') return num(v, k === 'anos_escola' && v % 1 ? 1 : 0) + (v === 1 ? ' ano' : ' anos');
  if (k === 'serie_idx') return NOMES_SERIE[Math.round(v)] || '—';
  if (k === 'sem_nota') return v ? 'sim' : 'não';
  return num(v, v % 1 ? 1 : 0);
}

const MODELOS_TXT = {
  'Regressão logística': ['Soma ponderada dos sinais, passada por uma curva em S que transforma o resultado numa chance entre 0 e 100%. Cada variável ganha um peso, e por isso dá pra explicar o risco de cada aluno.',
    'Variáveis padronizadas (média 0, desvio 1) antes do ajuste.'],
  'Random forest': ['Centenas de árvores de decisão, cada uma treinada numa amostra diferente de alunos e olhando só uma parte das variáveis em cada divisão. A previsão é a média das árvores. Pega combinações (ex.: atraso de mensalidade junto com faltas) sem precisar dizer isso ao modelo.',
    '400 árvores · profundidade máxima 7 · pelo menos 8 alunos por folha · √n variáveis por divisão.'],
  'Gradient boosting': ['Árvores pequenas treinadas em sequência: cada nova árvore tenta corrigir o erro que as anteriores ainda cometem. Costuma ser o mais preciso em dados de tabela, mas é o mais difícil de explicar.',
    '160 árvores · profundidade 2 · taxa de aprendizado 0,05 · 80% dos alunos por rodada.'],
  'Regra por pontos (0-8)': ['A regra que o painel original usava: soma pontos por mensalidade atrasada, dias de atraso, média baixa e faltas. Entra aqui como linha de base: um modelo só vale a pena se for melhor que ela.',
    '+1 ou +2 pontos por sinal; 5 ou mais = alto.'],
};

function janelaEv(html) {
  let f = $('#janEv');
  if (!f) {
    f = document.createElement('div');
    f.id = 'janEv';
    f.className = 'jan-fundo';
    document.body.appendChild(f);
    f.addEventListener('click', e => { if (e.target === f || e.target.closest('[data-fechar-jan]')) fechar(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !f.hidden) fechar(); });
  }
  function fechar() { f.hidden = true; document.body.classList.remove('sem-scroll'); }
  f.innerHTML = `<div class="jan" style="max-width:720px"><button class="jan-x" data-fechar-jan aria-label="Fechar">×</button>${html}</div>`;
  f.hidden = false;
  document.body.classList.add('sem-scroll');
}

function porQue(a) {
  const [nome, turma, seg] = AL[a.id] || ['—', '—', '—'];
  const max = Math.max(...a.porque.map(p => Math.abs(p[2])), 0.01);
  janelaEv(`<div class="jan-h"><h2>${esc(nome)}</h2><p>${turma} · ${seg} · ${pill(FAIXA_TXT[a.faixa][0] + ' risco', FAIXA_TXT[a.faixa][1])} · chance estimada de sair: <b>${pct(a.prob, 0)}</b>
      ${a.rematricula ? ' · rematrícula ' + D.meta.ano_proximo + ': ' + pill(REMAT_TXT[a.rematricula][0], REMAT_TXT[a.rematricula][1]) : ''}</p></div>
    <h4 class="sec-t">Por que esse risco</h4>
    <p class="nota">As variáveis que mais empurraram a chance pra cima (vermelho) ou pra baixo (verde) em relação a um aluno médio, pela regressão logística.</p>
    <div class="coef">${a.porque.map(([k, v, c]) => `<div class="coef-l"><span>${NOME_VAR[k]}<small class="mudo"> · ${fmtVar(k, v)}</small></span>${divergente(c, max)}<b style="color:${c > 0 ? COR.vermEsc : COR.verdeEsc}">${c > 0 ? '↑' : '↓'}</b></div>`).join('')}</div>
    <h4 class="sec-t">Sinais de alerta</h4>
    ${a.motivos.length ? a.motivos.map(m => `<span class="chip-r">${m}</span>`).join('') : '<p class="nota">Nenhum sinal acima dos limites de alerta.</p>'}
    <p class="nota mt">Regra por pontos do painel original: ${a.regra} de 8.</p>`);
}

// realce simples de sintaxe pro trecho de Python (comentário, texto, número e palavra-chave)
function realcarPython(codigo) {
  return codigo.split('\n').map(linha => {
    const i = linha.indexOf('#');
    const corpo = i >= 0 ? linha.slice(0, i) : linha, com = i >= 0 ? linha.slice(i) : '';
    const html = esc(corpo)
      .replace(/(&quot;[^&]*?&quot;)/g, '<span class="s">$1</span>')
      .replace(/\b(from|import|for|in|def|return)\b/g, '<span class="k">$1</span>')
      .replace(/(?<![\w.])(\d+(?:\.\d+)?)\b/g, '<span class="n">$1</span>');
    return html + (com ? `<span class="c">${esc(com)}</span>` : '');
  }).join('\n');
}

function secao(id, num_, titulo, intro, corpo) {
  return `<section class="ev-sec" id="${id}">${num_ ? `<div class="ev-num">${num_}</div>` : ''}<h2>${titulo}</h2>${intro ? `<p class="ev-intro">${intro}</p>` : ''}${corpo}</section>`;
}

function renderEvasaoPagina(el) {
  const res = E.resultados, escolhido = E.modelo, mod = res[escolhido].metricas, regra = res['Regra por pontos (0-8)'].metricas;
  const at = E.atuais, n = at.length;
  const alto = at.filter(a => a.faixa === 'alto'), medio = at.filter(a => a.faixa === 'medio');
  const ck = E.checagem;
  const anos = Object.keys(E.por_ano);
  const fmtGrupo = v => fmtVar(v.k, v.evadiu) + ' × ' + fmtVar(v.k, v.continuou);

  el.innerHTML = `
  ${secao('s-resumo', '', 'Quem pode sair da escola no ano que vem?',
    `Um modelo de <b>machine learning</b> treinado no histórico de ${anos[0]} a ${anos[anos.length - 1]} estima, pra cada aluno ativo, a chance de evadir. A ideia é a coordenação conversar com a família <b>antes</b> da rematrícula, e não depois que a vaga já foi perdida.`,
    `<div class="kpis k5">
      ${kpi({rotulo: 'Alunos avaliados', valor: num(n), sub: `taxa histórica de evasão ${pct(E.taxa_base, 1)}`, cor: COR.azul})}
      ${kpi({rotulo: 'Risco alto', valor: num(alto.length), sub: `${pct(alto.length / n)} dos ativos · chance ≥ ${pct(E.faixas.alto, 0)}`, cor: COR.verm})}
      ${kpi({rotulo: 'Risco médio', valor: num(medio.length), sub: `chance entre ${pct(E.faixas.medio, 0)} e ${pct(E.faixas.alto, 0)}`, cor: COR.ambar})}
      ${kpi({rotulo: `AUC · ${escolhido.toLowerCase()}`, valor: num(mod.auc, 2), sub: `regra antiga: ${num(regra.auc, 2)} · acaso = 0,50`, cor: COR.roxo})}
      ${kpi({rotulo: 'Top 10% do ranking', valor: pct(mod.captura_top10, 0), sub: `dos evadidos de ${E.validacao.ano} (${num(mod.lift_top10, 1)}x o acaso)`, cor: COR.verde})}
    </div>
    ${card('Funciona no ano corrente?', `<p class="nota">Ainda não dá pra saber quem vai evadir em ${D.meta.ano}, mas a rematrícula pra ${D.meta.ano_proximo} já começou. Se o radar aponta as pessoas certas, quem está em risco alto deveria estar atrasando a renovação (formandos fora).</p>` +
      barrasH(['alto', 'medio', 'baixo', 'todos'].map(f => ({nome: f === 'todos' ? 'Todos os ativos' : `Risco ${FAIXA_TXT[f][0].toLowerCase()} (${ck[f].n} alunos)`, valor: ck[f].sem_rematricula,
        cor: f === 'alto' ? COR.verm : f === 'medio' ? COR.ambar : f === 'baixo' ? COR.verde : COR.cinza})), {fmt: v => pct(v, 0) + ' ainda sem rematrícula', max: 1}) +
      `<p class="destaque-txt">Entre os alunos em risco alto, <b>${pct(ck.alto.sem_rematricula, 0)}</b> ainda não garantiram a vaga, contra <b>${pct(ck.todos.sem_rematricula, 0)}</b> no geral.</p>`, {classe: 'mt'})}`)}

  ${secao('s-problema', '1', 'O problema',
    'Aqui <b>evadir</b> é sair no meio do ano (transferência ou desistência) ou terminar o ano e não renovar a matrícula. Quem se forma no 3º ano do médio fica fora da conta. A maior parte das saídas é silenciosa: o aluno termina o ano e simplesmente não volta.',
    `<div class="grid g21">
      ${card('Como terminou cada ano', grafBarras({rotulos: Object.keys(E.historico.por_ano), empilhado: true, total: true,
        series: [['continuou', 'Continuou', COR.verde], ['formou', 'Formou', COR.azul], ['evadiu_fim', 'Não renovou', COR.ambar], ['evadiu_meio', 'Saiu no meio do ano', COR.verm]]
          .map(([k, nome, cor]) => ({nome, cor, valores: Object.values(E.historico.por_ano).map(a => a[k] || 0)})), W: LG.maior, h: 260}) +
        legenda([['Continuou', COR.verde], ['Formou', COR.azul], ['Não renovou', COR.ambar], ['Saiu no meio do ano', COR.verm]].map(([nome, cor]) => ({nome, cor}))))}
      ${card('Motivos declarados (saídas no meio do ano)', `<div class="rosca-box">${grafRosca(E.historico.motivos.map(([m, q], i) => ({nome: m, valor: q, cor: PALETA[i % PALETA.length]})), {tam: 170, esp: 26, fmt: v => num(v) + ' alunos'})}
        ${legenda(E.historico.motivos.map(([m, q], i) => ({nome: `${m} (${q})`, cor: PALETA[i % PALETA.length]})))}</div>`)}
    </div>
    ${card('Em que mês saem os que saem no meio do ano', grafBarras({rotulos: MES_CURTO, series: [{nome: 'Saídas', valores: E.historico.mes_saida, cor: COR.verm}], valores: true, h: 200}), {classe: 'mt'})}`)}

  ${secao('s-dados', '2', 'Os dados',
    'Cada linha da base é um aluno em um ano, com os sinais daquele ano e como o ano terminou. São só indicadores que a escola já acompanha pra outras coisas. Nada de dado de saúde, cor, renda ou endereço: além da LGPD, entrar com esse tipo de variável faria o modelo aprender preconceito.',
    `${card('Variáveis usadas pelo modelo', `<div class="tabela-wrap"><table><thead><tr><th>Variável</th><th>O que é</th><th class="n">Média entre quem saiu</th><th class="n">Média entre quem ficou</th></tr></thead><tbody>
      ${E.variaveis.filter(v => v.evadiu != null).map(v => `<tr><td><b>${v.nome}</b></td><td class="mudo">${v.desc}</td><td class="n">${fmtVar(v.k, v.evadiu)}</td><td class="n">${fmtVar(v.k, v.continuou)}</td></tr>`).join('')}
      </tbody></table></div><p class="nota">Base de treino e validação: ${num(soma(Object.values(E.por_ano), 'n'))} alunos-ano, dos quais ${num(soma(Object.values(E.por_ano), 'evadiram'))} evadiram.</p>`)}
    ${card('Sinais simples e evasão', '<div id="evSinais"></div>', {sub: 'Quanto cada sinal aparece entre quem saiu e entre quem ficou. Útil pra intuição, mas um sinal sozinho erra muito: é por isso que existe o modelo.', classe: 'mt'})}`)}

  ${secao('s-tempo', '3', 'Treino e teste: separando no tempo',
    'O erro mais comum nesse tipo de projeto é sortear alunos aleatoriamente pra treino e teste. Como o mesmo aluno aparece em vários anos, o modelo "veria" o futuro e pareceria melhor do que é. Aqui o corte é por ano: o modelo aprende com o passado e é avaliado num ano que nunca viu, exatamente como vai ser usado.',
    `<div class="linha-tempo">${anos.map(a => `<div class="lt ${+a === E.validacao.ano ? 'val' : 'tre'}"><b>${a}</b><span>${+a === E.validacao.ano ? 'Validação' : 'Treino'}</span><small>${num(E.por_ano[a].n)} alunos · ${num(E.por_ano[a].evadiram)} evadiram</small></div>`).join('')}
      <div class="lt prev"><b>${D.meta.ano}</b><span>Previsão</span><small>${num(n)} alunos ativos · modelo refeito com ${anos[0]}-${anos[anos.length - 1]}</small></div></div>`)}

  ${secao('s-modelos', '4', 'Os modelos',
    `Testei três algoritmos do scikit-learn e comparei com a regra antiga. Todos aprendem com ${E.treino.anos} e são medidos em ${E.validacao.ano}.`,
    `<div class="mod-grid">${Object.keys(MODELOS_TXT).map(k => {
      const m = res[k].metricas;
      return `<div class="mod-card ${k === escolhido ? 'esc' : ''}" style="--c:${COR_MOD[k]}"><div class="mod-h"><b>${k}</b>${k === escolhido ? pill('escolhido', 'bom') : ''}</div>
        <p>${MODELOS_TXT[k][0]}</p><small class="mudo">${MODELOS_TXT[k][1]}</small>
        <div class="mod-m"><span>AUC<b>${num(m.auc, 3)}</b></span><span>Top 10%<b>${pct(m.captura_top10, 0)}</b></span><span>Precisão média<b>${num(m.ap, 2)}</b></span></div></div>`;
    }).join('')}</div>
    <div class="grid g2 mt">
      ${card('Curva ROC (validação em ' + E.validacao.ano + ')', grafDispersao({linhas: [{pontos: [[0, 0], [1, 1]], cor: COR.cinza, tracejado: true, espessura: 1.4}, ...Object.entries(res).map(([k, v]) => ({pontos: v.metricas.roc, cor: COR_MOD[k]}))],
        xMin: 0, xMax: 1, yMin: 0, yMax: 1, fmtX: v => pct(v, 0), fmtY: v => pct(v, 0), rotX: 'Alunos que ficaram marcados como risco', rotY: 'Evadidos encontrados', W: LG.metade, h: 300}) +
        legenda(Object.keys(res).map(k => ({nome: k, cor: COR_MOD[k]}))) +
        '<p class="nota">Quanto mais a curva sobe rápido, mais evadidos o modelo encontra antes de começar a errar. A diagonal é o acaso.</p>')}
      ${card('Por que este modelo', `<p>${escolhido === 'Regressão logística'
        ? `A regressão logística ficou praticamente empatada com os modelos de árvore (diferença de AUC abaixo de 0,01). Em empate, fico com o modelo mais simples: a coordenação precisa entender <b>por que</b> um aluno aparece na lista, e na logística cada variável tem um peso que dá pra mostrar.`
        : `O ${escolhido.toLowerCase()} teve AUC melhor que a logística por mais de 0,01, então foi escolhido. A explicação por aluno continua vindo da logística, que é mais fácil de ler.`}</p>
        ${escolhido === 'Regressão logística'
          ? '<p>Os modelos de árvore não ganharam porque, nessa base, o efeito de cada sinal é quase aditivo: mais faltas e mais atrasos aumentam o risco de forma parecida em qualquer aluno. Árvores brilham quando há interações fortes, e aqui elas são fracas.</p>'
          : `<p>As árvores ganharam porque pegam o que a logística não vê: limites (um atraso pequeno quase não pesa, a partir de um mês pesa muito) e combinações de sinais (atraso de mensalidade <b>junto</b> com faltas). A logística soma os sinais em linha reta. O preço é a explicação: uma floresta com centenas de árvores não tem um peso por variável, por isso o "por que esse risco" de cada aluno continua vindo da logística, que fica perto (AUC ${num(res['Regressão logística'].metricas.auc, 2)}).</p>`}
        <p>${mod.auc - regra.auc >= 0.05
          ? `A regra antiga fica bem atrás na AUC (${num(regra.auc, 2)} contra ${num(mod.auc, 2)})`
          : `Na AUC a regra antiga fica só um pouco atrás (${num(regra.auc, 2)} contra ${num(mod.auc, 2)}): os sinais dela (atraso, nota, faltas) já carregam boa parte da informação`}${mod.captura_top10 - regra.captura_top10 >= 0.02
          ? `. A diferença aparece onde importa pra coordenação, no topo da lista: o modelo põe ${pct(mod.captura_top10, 0)} dos evadidos nos 10% de maior risco, a regra ${pct(regra.captura_top10, 0)}`
          : regra.captura_top10 - mod.captura_top10 >= 0.02
            ? `. No topo da lista a regra chega a ir um pouco melhor (${pct(regra.captura_top10, 0)} dos evadidos no top 10%, contra ${pct(mod.captura_top10, 0)}): ela acerta bem os casos óbvios, com vários sinais juntos. O modelo ganha no resto da lista, que a regra mal consegue ordenar (muitos alunos empatam com 0 ou 1 ponto), e entrega uma chance calibrada em vez de uma pontuação`
            : `, e no topo do ranking empatam (${pct(regra.captura_top10, 0)} no top 10%): a regra acha bem os casos óbvios, mas ordena mal o resto`}. A regra usa limites fixos (ex.: 2 parcelas atrasadas) e ignora ocorrências e o tamanho do atraso.</p>`)}
    </div>`)}

  ${secao('s-metricas', '5', 'Como medir',
    '',
    `<div class="grid g3">
      ${card('AUC', `<p class="ev-big">${num(mod.auc, 2)}</p><p>Se eu pegar um aluno que saiu e um que ficou, a AUC é a chance de o modelo dar risco maior pro que saiu. 0,5 é chute; 1,0 é perfeito. Pra evasão, acima de 0,75 já é útil.</p>`)}
      ${card('Top 10% do ranking', `<p class="ev-big">${pct(mod.captura_top10, 0)}</p><p>Se a coordenação só tiver tempo de ligar pra 10% das famílias, escolhendo pelo modelo ela alcança essa fração de todos os que iam sair. Sorteando, alcançaria 10%.</p>`)}
      ${card('Calibração', grafDispersao({linhas: [{pontos: [[0, 0], [0.8, 0.8]], cor: COR.cinza, tracejado: true, espessura: 1.4},
          {pontos: res[escolhido].calibracao.map(c => [c[0], c[1], `Previsto ${pct(c[0], 1)} · real ${pct(c[1], 1)} · ${c[2]} alunos`]), cor: COR.roxo, marcar: true}],
        xMin: 0, xMax: 0.8, yMin: 0, yMax: 0.8, fmtX: v => pct(v, 0), fmtY: v => pct(v, 0), rotX: 'Chance prevista', rotY: 'Evasão real', W: LG.terco, h: 230}) +
        '<p class="nota">Quando o modelo diz 30%, uns 3 em cada 10 saem mesmo? Pontos perto da diagonal = sim. Isso importa porque a coordenação lê o número como chance.</p>')}
    </div>`)}

  ${secao('s-aprendeu', '6', 'O que o modelo aprendeu',
    'Três jeitos de olhar a importância das variáveis. Quando eles concordam, dá pra confiar mais na leitura.',
    `<div class="grid g3">
      ${card('Importância por permutação', barrasH(E.importancia.filter(i => i[1] > 0).map(([k, v]) => ({nome: k, valor: v, cor: COR.roxo})), {fmt: v => '−' + num(v * 100, 1) + ' pts'}) +
        '<p class="nota">Quanto a AUC cai quando a variável é embaralhada. Vale pra qualquer modelo.</p>')}
      ${card('Importância na random forest', barrasH(E.importancia_rf.slice(0, 8).map(([k, v]) => ({nome: k, valor: v, cor: COR.verde})), {fmt: v => pct(v, 0)}) +
        '<p class="nota">Quanto cada variável ajudou a separar os grupos dentro das árvores.</p>')}
      ${card('Direção de cada sinal', `<div class="coef">${E.coeficientes.map(([k, c]) => `<div class="coef-l"><span>${k}</span>${divergente(c, Math.max(...E.coeficientes.map(x => Math.abs(x[1]))))}<b style="color:${c > 0 ? COR.vermEsc : COR.verdeEsc}">${c > 0 ? '+' : '−'}${num(Math.abs(c), 2)}</b></div>`).join('')}</div>
        <p class="nota">Pesos da regressão logística (variáveis padronizadas). À direita aumenta o risco, à esquerda diminui.</p>`)}
    </div>`)}

  ${secao('s-alunos', '7', 'Alunos em risco hoje',
    'O modelo final é refeito com todo o histórico e aplicado aos alunos ativos. Clique no nome pra ver o que puxou o risco de cada um.',
    card('', `<div class="filtros wrap"><div class="seg-btns" id="evFaixa"></div>
        <select id="evSeg"><option value="">Todos os segmentos</option>${SEGMENTOS.map(s => `<option>${s}</option>`).join('')}</select>
        <input id="evBusca" type="search" placeholder="Buscar aluno ou turma"><span class="mudo" id="evConta"></span></div><div id="evTab"></div>`))}

  ${secao('s-codigo', '8', 'O código, resumido',
    'O pipeline completo está em <code>pipeline/evasao.py</code>. O essencial é isto:',
    `<pre class="codigo"><code>${realcarPython(`from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

treino, teste = anos <= 2024, anos == 2025          # corte no tempo, não aleatório

modelos = {
    "Regressão logística": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
    "Random forest": RandomForestClassifier(n_estimators=400, max_depth=7, min_samples_leaf=8),
    "Gradient boosting": GradientBoostingClassifier(n_estimators=160, max_depth=2, learning_rate=0.05),
}
for nome, m in modelos.items():
    m.fit(X[treino], y[treino])
    auc = roc_auc_score(y[teste], m.predict_proba(X[teste])[:, 1])

final = modelos[melhor].fit(X, y)                    # refeito com todo o histórico
chance = final.predict_proba(X_alunos_ativos)[:, 1]`)}</code></pre>`)}

  ${secao('s-limites', '9', 'Limites e cuidados',
    '',
    `<ul class="ev-lista">
      <li><b>Os dados são sintéticos.</b> O gerador esconde um "risco" em cada aluno que piora um pouco nota, frequência, ocorrências e pagamento, e o modelo precisa achar esse sinal sozinho. Os números servem pra mostrar o processo, não pra afirmar quanto um modelo desses acerta numa escola real.</li>
      <li><b>Correlação não é causa.</b> Faltas altas não fazem o aluno sair; elas costumam aparecer junto com o que faz. O radar aponta onde olhar, quem decide o que fazer é a coordenação.</li>
      <li><b>Usar com cuidado.</b> A lista serve pra oferecer ajuda (conversa com a família, plano de estudos, negociação), nunca pra rotular aluno. Por isso a explicação de cada risco fica visível.</li>
      <li><b>Refazer todo ano.</b> O comportamento muda (mensalidade, concorrência, pandemia). O modelo deve ser retreinado a cada ciclo e comparado de novo com a regra simples.</li>
      <li><b>Privacidade.</b> Só entram indicadores que a escola já usa; nada de saúde, origem ou renda. O modelo roda no servidor da escola e a lista só aparece pra quem tem acesso ao painel.</li>
    </ul>`)}`;

  new Tabela($('#evSinais', el), {
    colunas: [{k: 'sinal', l: 'Sinal'}, {k: 'evadiram', l: 'Entre quem saiu', n: 1, f: v => pct(v, 0)}, {k: 'continuaram', l: 'Entre quem ficou', n: 1, f: v => pct(v, 0)},
      {k: 'lift_pp', l: 'Diferença', n: 1, f: v => `<b style="color:${v > 0 ? COR.vermEsc : COR.verdeEsc}">${v > 0 ? '+' : ''}${num(v, 1)} p.p.</b>`},
      {k: 'n', l: 'Alunos com o sinal', n: 1, f: v => num(v)}, {k: 'taxa_evasao', l: 'Evasão de quem tem o sinal', n: 1, f: v => `<b>${pct(v, 0)}</b>`}],
    linhas: E.sinais, ordem: {k: 'lift_pp', dir: -1}});

  const linhas = at.map(a => ({...a, nome: AL[a.id]?.[0] || '—', turma: AL[a.id]?.[1] || '—', segmento: AL[a.id]?.[2]}));
  const porId = Object.fromEntries(linhas.map(l => [l.id, l]));
  const tab = new Tabela($('#evTab', el), {
    colunas: [{k: 'nome', l: 'Aluno', f: (v, r) => `<a class="link" data-porque="${r.id}">${esc(v)}</a>`}, {k: 'turma', l: 'Turma'},
      {k: 'prob', l: 'Chance de sair', n: 1, f: v => `<div class="prob"><div style="width:${(v * 100).toFixed(1)}%;background:${v >= E.faixas.alto ? COR.verm : v >= E.faixas.medio ? COR.ambar : COR.verde}"></div><b>${pct(v, 0)}</b></div>`},
      {k: 'faixa', l: 'Faixa', v: r => r.prob, f: v => pill(FAIXA_TXT[v][0], FAIXA_TXT[v][1])}, {k: 'regra', l: 'Regra antiga (0-8)', n: 1},
      {k: 'motivos', l: 'Sinais', v: r => r.motivos.length, f: v => v.length ? v.map(m => `<span class="chip-r">${m}</span>`).join('') : '<span class="mudo">—</span>'},
      {k: 'rematricula', l: `Rematrícula ${D.meta.ano_proximo}`, f: v => v ? pill(REMAT_TXT[v][0], REMAT_TXT[v][1]) : '—'}],
    linhas, ordem: {k: 'prob', dir: -1}, limite: 60, vazioTxt: 'Nenhum aluno com esses filtros.'});
  let faixa = 'alto';
  const filtrar = () => {
    const s = $('#evSeg', el).value, b = $('#evBusca', el).value.trim().toLowerCase();
    const l = linhas.filter(r => (faixa === 'todos' || r.faixa === faixa) && (!s || r.segmento === s) && (!b || `${r.nome} ${r.turma}`.toLowerCase().includes(b)));
    tab.atualizar(l);
    $('#evConta', el).textContent = `${num(l.length)} alunos`;
  };
  subAbas($('#evFaixa', el), [{id: 'alto', nome: `Alto (${alto.length})`}, {id: 'medio', nome: `Médio (${medio.length})`}, {id: 'baixo', nome: 'Baixo'}, {id: 'todos', nome: 'Todos'}], f => { faixa = f; filtrar(); });
  $('#evSeg', el).onchange = filtrar;
  $('#evBusca', el).oninput = filtrar;
  el.addEventListener('click', e => { const a = e.target.closest('[data-porque]'); if (a) porQue(porId[+a.dataset.porque]); });

  // destaca na barra a seção que está na tela
  const links = $$('#evNav a');
  const obs = new IntersectionObserver(ents => ents.forEach(en => {
    if (en.isIntersecting) links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + en.target.id));
  }), {rootMargin: '-40% 0px -55% 0px'});
  $$('.ev-sec', el).forEach(s => obs.observe(s));
}

$('#btnTema').addEventListener('click', () => aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('#nomeEscola').textContent = D.meta.escola;
$('#dataRef').textContent = dataBR(HOJE);
renderEvasaoPagina($('#pg'));
