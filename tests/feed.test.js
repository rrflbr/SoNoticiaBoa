const test = require('node:test');
const assert = require('node:assert');
require('../src/classifier.js');
const SNB = require('../src/feed.js');

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Só Notícia Boa</title>
  <item>
    <title><![CDATA[Escola constr&oacute;i horta &amp; distribui alimentos]]></title>
    <link>https://exemplo.com/horta/</link>
    <description><![CDATA[<p>Alunos plantaram verduras e doaram para o bairro.</p> The post Escola appeared first on Só Notícia Boa.]]></description>
    <media:content url="http://exemplo.com/img/horta.jpg" medium="image"/>
  </item>
  <item>
    <title>Cientistas criam &#8220;vacina&#8221; promissora</title>
    <link>https://exemplo.com/vacina/</link>
    <description>Resumo curto</description>
    <content:encoded><![CDATA[<img src="https://exemplo.com/img/vacina.png" alt=""><p>Texto</p>]]></content:encoded>
  </item>
  <item>
    <title>Homem é preso por assassinato</title>
    <link>https://exemplo.com/ruim/</link>
    <description>Notícia ruim que deve ser filtrada</description>
  </item>
  <item>
    <title>Link perigoso</title>
    <link>javascript:alert(1)</link>
  </item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Razões</title>
  <entry>
    <title>Hospital zera fila de cirurgias</title>
    <link rel="alternate" href="https://atom.example/fila"/>
    <summary>Mutirão reduziu a espera.</summary>
  </entry>
</feed>`;

test('parseFeed lê RSS 2.0 (CDATA, entidades, imagem)', () => {
  const items = SNB.parseFeed(RSS, 'https://exemplo.com/feed');
  assert.strictEqual(items.length, 3); // javascript: descartado
  assert.strictEqual(items[0].title, 'Escola constrói horta & distribui alimentos');
  assert.strictEqual(items[0].url, 'https://exemplo.com/horta/');
  assert.strictEqual(items[0].image, 'https://exemplo.com/img/horta.jpg'); // http -> https
  assert.strictEqual(items[0].summary, 'Alunos plantaram verduras e doaram para o bairro.');
  assert.strictEqual(items[0].source, 'Só Notícia Boa');
  assert.strictEqual(items[1].title, 'Cientistas criam “vacina” promissora');
  assert.strictEqual(items[1].image, 'https://exemplo.com/img/vacina.png');
});

test('parseFeed lê Atom', () => {
  const items = SNB.parseFeed(ATOM, 'https://atom.example/feed');
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].url, 'https://atom.example/fila');
  assert.strictEqual(items[0].source, 'Razões');
});

test('fetchPool filtra notícias ruins, deduplica e intercala fontes', async () => {
  const bodies = { 'https://a/feed': RSS, 'https://b/feed': ATOM, 'https://c/feed': 'fora do ar' };
  const fakeFetch = async (url) => {
    if (url === 'https://down/feed') throw new Error('rede');
    return { ok: true, text: async () => bodies[url] };
  };
  const pool = await SNB.fetchPool(['https://a/feed', 'https://b/feed', 'https://down/feed', 'https://c/feed'], { fetch: fakeFetch });
  const urls = pool.map((i) => i.url);
  assert.deepStrictEqual(urls, ['https://exemplo.com/horta/', 'https://atom.example/fila', 'https://exemplo.com/vacina/']);
});
