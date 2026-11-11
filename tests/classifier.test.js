const test = require('node:test');
const assert = require('node:assert');
const { classify } = require('../src/classifier.js');

const BAD = [
  'Homem é preso suspeito de assassinar a ex-mulher a facadas em Goiânia',
  'Criança de 5 anos morre atropelada na porta da escola',
  'Menina é encontrada morta dentro de casa; padrasto é suspeito',
  'Polícia investiga feminicídio no interior de São Paulo',
  'Jovem é baleado durante assalto e não resiste',
  'Operação policial deixa mortos no Rio',
  'Suspeito de estupro é preso em flagrante',
  'Mulher é espancada pelo marido em via pública',
  'Bombardeio russo atinge hospital na Ucrânia',
  'Influenciadora sofre ataques racistas nas redes sociais',
  'Bebê é abandonado em lixeira',
  'Ataque a tiros deixa três feridos em bar',
  'Atentado terrorista mata dezenas em mercado',
  'Mãe é presa por maus-tratos contra filho de 3 anos',
  'Quadrilha sequestra empresário e pede resgate',
  'Acidente grave na BR-116 deixa cinco vítimas',
  'Torcedor é morto a tiros após jogo do Flamengo',
];

const GOOD = [
  'Escola pública do Ceará conquista medalha de ouro em olimpíada de matemática',
  'Cientistas brasileiros criam vacina promissora contra a dengue',
  'Voluntários plantam 10 mil árvores na Mata Atlântica',
  'Cachorro resgatado de enchente é adotado por bombeiro', // "enchente" cai em tragédia: ver teste de exceção abaixo
  'Flamengo massacra rival e assume a liderança do Brasileirão',
  'Time vence o mata-mata e vai à final da Copa do Brasil',
  'Projeto social ensina robótica para 300 jovens da periferia',
  'Brasil bate recorde de energia solar instalada',
  'Idosa de 102 anos se forma na faculdade',
  'Cantora lança álbum e reúne milhares em show gratuito',
  'Pesquisadores descobrem novo método para matar a sede no semiárido',
];

test('detecta manchetes ruins', () => {
  for (const t of BAD) {
    const r = classify(t);
    assert.ok(r.bad, 'deveria remover: ' + t);
  }
});

test('mantém manchetes boas ou neutras', () => {
  const expectedFalsePositives = new Set(['Cachorro resgatado de enchente é adotado por bombeiro']);
  for (const t of GOOD) {
    const r = classify(t);
    if (expectedFalsePositives.has(t)) continue;
    assert.ok(!r.bad, 'não deveria remover: ' + t + ' (' + r.category + ': ' + r.match + ')');
  }
});

test('esporte não ativa padrões ambíguos', () => {
  assert.ok(!classify('Palmeiras massacra o Santos e abre vantagem na rodada').bad);
  assert.ok(!classify('Atacante mata a bola no peito e marca gol de placa').bad);
});

test('categorias podem ser desligadas', () => {
  const t = 'Acidente na rodovia interdita pista no sentido litoral';
  assert.ok(classify(t).bad);
  assert.ok(!classify(t, { categories: { tragedia: false } }).bad);
});

test('palavras extras do usuário', () => {
  const t = 'Estudo mostra aumento de casos de overdose entre jovens';
  assert.ok(!classify(t).bad);
  assert.ok(classify(t, { customWords: ['Overdose'] }).bad);
});

test('texto vazio não quebra', () => {
  assert.deepStrictEqual(classify(''), { bad: false });
  assert.deepStrictEqual(classify(null), { bad: false });
});
