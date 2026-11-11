/*
 * Teste de ponta a ponta: carrega a extensão de verdade no Chromium, serve uma
 * página simulada em g1.globo.com e um feed RSS simulado, e confere a troca.
 *
 *   node tests/e2e.js            (precisa do `playwright` disponível)
 */
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const portal = fs.readFileSync(path.join(__dirname, 'fixtures/portal.html'), 'utf8');

const item = (n) => `<item><title>Notícia boa número ${n} para animar o dia</title>
  <link>https://www.sonoticiaboa.com.br/boa-${n}/</link>
  <description><![CDATA[<p>Resumo bom da notícia ${n}, com final feliz para todos.</p>]]></description>
  <media:content url="https://www.sonoticiaboa.com.br/img/boa-${n}.jpg" medium="image"/></item>`;
const feed = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <title>Só Notícia Boa</title>${[1, 2, 3, 4, 5].map(item).join('')}</channel></rss>`;

(async () => {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snb-e2e-'));
  const ctx = await chromium.launchPersistentContext(userDir, {
    headless: false, // extensões exigem o modo "new headless" via args abaixo
    args: [
      '--headless=new',
      `--disable-extensions-except=${root}`,
      `--load-extension=${root}`,
      '--no-sandbox',
    ],
  });

  try {
    await ctx.route('https://www.sonoticiaboa.com.br/feed/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/rss+xml', body: feed })
    );
    await ctx.route('https://www.razoesparaacreditar.com/feed/', (r) => r.fulfill({ status: 404, body: '' }));
    await ctx.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }));
    await ctx.route('https://www.sonoticiaboa.com.br/img/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }));
    await ctx.route('https://g1.globo.com/**', (r) =>
      r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: portal })
    );

    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('https://g1.globo.com/');
    await page.waitForFunction(() => document.querySelectorAll('[data-snb="done"]').length >= 4, null, { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(500);

    const snap = await page.evaluate(() => {
      const t = (sel) => document.querySelector(sel);
      const a = (sel) => Array.from(document.querySelectorAll(sel + ' a')).map((x) => [x.textContent.trim().replace(/\s+/g, ' '), x.getAttribute('href')]);
      return {
        done: document.querySelectorAll('[data-snb="done"]').length,
        c1: { text: t('#c1').innerText.replace(/\s+/g, ' ').trim(), links: a('#c1'), img: t('#c1 img').getAttribute('src'), srcset: t('#c1 img').getAttribute('srcset') },
        c2: { text: t('#c2').innerText.replace(/\s+/g, ' ').trim(), marked: t('#c2').hasAttribute('data-snb'), href: t('#c2 a').getAttribute('href') },
        c3: { text: t('#c3').innerText.replace(/\s+/g, ' ').trim(), links: a('#c3'), img: t('#c3 img').getAttribute('src') },
        c4: { text: t('#c4').innerText.replace(/\s+/g, ' ').trim(), marked: t('#c4').hasAttribute('data-snb') },
        list: a('#list'),
        late: { text: t('#late').innerText.replace(/\s+/g, ' ').trim(), marked: t('#late').getAttribute('data-snb') },
        nav: t('nav').innerText,
        footer: t('footer').innerText,
        pending: document.querySelectorAll('[data-snb="pending"]').length,
        hidden: document.querySelectorAll('[data-snb="hidden"]').length,
      };
    });
    console.log(JSON.stringify(snap, null, 2));
    await page.screenshot({ path: process.env.SHOT || path.join(os.tmpdir(), 'snb-e2e.png'), fullPage: true });

    assert.deepStrictEqual(errors, [], 'erros na página: ' + errors);
    assert.strictEqual(snap.pending, 0, 'nenhum card pode ficar escondido aguardando');
    assert.strictEqual(snap.hidden, 0, 'havia notícias boas disponíveis, nada deveria sumir');

    // c1: texto, link e imagem trocados; nada da notícia ruim sobra
    assert.ok(!/tiros|assalto|baleada/i.test(snap.c1.text), 'c1 ainda tem texto ruim: ' + snap.c1.text);
    assert.ok(/Notícia boa número/.test(snap.c1.text));
    assert.ok(!/Crime/.test(snap.c1.text), 'o chapéu "Crime" da notícia antiga deveria ter sido trocado');
    assert.ok(snap.c1.links.every(([, h]) => h.startsWith('https://www.sonoticiaboa.com.br/boa-')));
    assert.ok(snap.c1.img.includes('sonoticiaboa.com.br/img/') && snap.c1.srcset === null);

    // c2 e c4 (boa e esporte) permanecem intactos
    assert.ok(!snap.c2.marked && snap.c2.href.includes('olimpiada'));
    assert.ok(!snap.c4.marked && /Palmeiras massacra/.test(snap.c4.text));

    // c3: imagem e título (âncoras separadas) trocados
    assert.ok(!/crianças|incêndio/i.test(snap.c3.text), 'c3 ainda tem texto ruim: ' + snap.c3.text);
    assert.ok(snap.c3.links.every(([, h]) => h.includes('sonoticiaboa.com.br')));
    assert.ok(snap.c3.img.includes('sonoticiaboa.com.br/img/'));

    // lista: só a ruim é trocada, a economia permanece
    assert.ok(snap.list[0][1].includes('sonoticiaboa.com.br'), 'item ruim da lista deveria ser trocado');
    assert.ok(snap.list[1][1].includes('dolar-fecha-em-queda'), 'item bom da lista deveria permanecer');

    // conteúdo que chega depois também é tratado
    assert.strictEqual(snap.late.marked, 'done');
    assert.ok(!/bombardeio|feridos/i.test(snap.late.text));

    // menu e rodapé nunca são tocados
    assert.ok(/Política/.test(snap.nav) && /Sobre este portal/.test(snap.footer));

    assert.strictEqual(snap.done, 4);
    console.log('\nE2E OK');
  } finally {
    await ctx.close();
    fs.rmSync(userDir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
