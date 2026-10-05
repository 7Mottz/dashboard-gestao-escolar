# Painel de gestão escolar

Fiz esse painel pra escola onde trabalho. A ideia era parar de montar planilha toda semana pra reunião da direção e ter um lugar só com financeiro, matrículas, rematrícula e funil de captação. Hoje ele roda todo dia de madrugada num servidor e fica aberto numa TV na sala da direção.

Essa é a versão pública. Os dados reais ficaram de fora, então tudo aqui (alunos, valores, fornecedores, bancos) é inventado por um script com seed fixa. As telas e os cálculos são os mesmos da versão que uso no trabalho.

Demo: https://7mottz.github.io/dashboard-gestao-escolar/

![Financeiro](docs/img/financeiro.png)

## O que tem

São cinco abas:

- **Financeiro**: receita x despesa, fluxo de caixa com projeção até dezembro, realizado x orçado com drill-down até a conta, empréstimos e calendário de vencimentos.
- **Alunado**: ritmo de matrícula comparado com o ano anterior, novos x veteranos, ocupação das turmas e um mapa de calor de onde os alunos moram.
- **Rematrícula**: quanto da base já renovou e quem ainda não decidiu.
- **Farol**: faturamento projetado x realizado aluno por aluno.
- **Funil**: do lead até a matrícula, com as taxas de cada etapa comparadas com uma referência de mercado e um planejamento que transforma a meta da campanha em metas semanais.

E tem o modo apresentação: 14 slides que ficam girando sozinhos na TV (ou no iPad, nas reuniões).

![Funil](docs/img/funil.png)

![Apresentação](docs/img/apresentacao-meta.png)

## Como roda

Só precisa de Python 3.9+, sem instalar nada.

```
python build.py
```

Depois é só abrir `docs/index.html`. Com `#apresentacao` no fim do endereço ele já abre nos slides.

O build tem três passos: `gerar_dados.py` cria a base fictícia (no trabalho isso é a extração do ERP e do CRM), `pipeline/agregar.py` calcula os números e `pipeline/gerar_html.py` junta tudo num HTML só dentro de `docs/`. O front fica em `src/`, um arquivo JS por aba.

## Umas escolhas que fiz

Não usei biblioteca de gráfico. Começou porque eu queria as barras hachuradas nos meses projetados e não achei um jeito simples de fazer isso, aí acabei fazendo tudo em SVG na mão. Deu mais trabalho, mas o arquivo final abre offline e eu controlo cada detalhe.

A apresentação é desenhada num tamanho fixo (2048x1536) e escalada pra tela. Tentei fazer responsivo antes e cada TV quebrava as linhas de um jeito diferente.

Nos meses que ainda não fecharam, a despesa usa o orçamento, que lá na escola é um teto de gasto e não uma previsão. Por isso novembro e dezembro parecem pessimistas: é de propósito.

## Limitações

- O mapa de calor puxa o Leaflet de um CDN, então precisa de internet. O resto funciona offline.
- O planejamento do funil fica salvo no navegador. Na versão do trabalho ele é compartilhado por um backend simples, que não entrou aqui.
- No celular dá pra usar, mas o painel foi pensado pra tela grande.
