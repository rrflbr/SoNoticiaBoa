/*
 * Leitura de feeds RSS/Atom de notícias boas.
 * Parser por regex (o service worker do MV3 não tem DOMParser).
 */
(function (root) {
  'use strict';
  const SNB = (root.SNB = root.SNB || {});

  const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
    ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  };

  // Vogais/consoantes acentuadas do português: &aacute; &ecirc; &atilde; &ccedil;...
  const ACCENTS = {
    a: 'áàâãä', e: 'éèêë', i: 'íìîï', o: 'óòôõö', u: 'úùûü', c: 'ç', n: 'ñ',
  };
  const ACCENT_SUFFIX = ['acute', 'grave', 'circ', 'tilde', 'uml'];
  for (const [base, chars] of Object.entries(ACCENTS)) {
    [...chars].forEach((ch, i) => {
      const suffix = base === 'c' ? 'cedil' : base === 'n' ? 'tilde' : ACCENT_SUFFIX[i];
      ENTITIES[base + suffix] = ch;
      ENTITIES[base.toUpperCase() + suffix] = ch.toUpperCase();
    });
  }

  function decode(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return String.fromCodePoint(code); } catch (_) { return m; }
      }
      const v = ENTITIES[e] !== undefined ? ENTITIES[e] : ENTITIES[e.toLowerCase()];
      return v === undefined ? m : v;
    });
  }

  function tagText(block, tag) {
    const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i');
    const m = re.exec(block);
    if (!m) return '';
    const raw = m[1].trim();
    const cd = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(raw);
    return cd ? cd[1] : decode(raw);
  }

  function attr(block, tag, name, filter) {
    const re = new RegExp('<' + tag + '\\b([^>]*)>', 'gi');
    let m;
    while ((m = re.exec(block))) {
      if (filter && !filter.test(m[1])) continue;
      const a = new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']+)["\']', 'i').exec(m[1]);
      if (a) return decode(a[1]);
    }
    return '';
  }

  function stripHtml(html) {
    return decode(
      String(html)
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safeUrl(u, upgrade) {
    try {
      const url = new URL(u);
      if (url.protocol === 'http:' && upgrade) url.protocol = 'https:';
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function summarize(html) {
    let t = stripHtml(html)
      .replace(/The post .* appeared first on .*$/i, '')
      .replace(/O post .* apareceu primeiro em .*$/i, '')
      .replace(/\[(?:…|\.\.\.)\]\s*$/, '')
      .trim();
    if (t.length > 170) t = t.slice(0, 170).replace(/\s+\S*$/, '') + '…';
    return t;
  }

  function hostLabel(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  }

  /** @returns {Array<{title:string,url:string,summary:string,image:string,source:string}>} */
  function parseFeed(xml, feedUrl) {
    const text = String(xml || '');
    const blocks = text.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
    const head = text.slice(0, Math.max(0, text.search(/<(item|entry)[\s>]/i)) || 2000);
    const source = stripHtml(tagText(head, 'title')) || hostLabel(feedUrl);

    const items = [];
    for (const b of blocks) {
      const title = stripHtml(tagText(b, 'title'));
      let link = stripHtml(tagText(b, 'link'));
      if (!link) link = attr(b, 'link', 'href', /rel\s*=\s*["']alternate["']|^(?:(?!rel=).)*$/i);
      const url = safeUrl(link, false);
      if (!title || !url) continue;

      const html = tagText(b, 'content:encoded') || tagText(b, 'content') || tagText(b, 'description') || tagText(b, 'summary');
      const summary = summarize(tagText(b, 'description') || tagText(b, 'summary') || html);

      let image =
        attr(b, 'media:content', 'url', /medium\s*=\s*["']image["']|\.(?:jpe?g|png|webp|gif)/i) ||
        attr(b, 'media:thumbnail', 'url') ||
        attr(b, 'enclosure', 'url', /type\s*=\s*["']image\//i);
      if (!image) {
        const img = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(html);
        if (img) image = decode(img[1]);
      }
      items.push({ title, url, summary, image: safeUrl(image, true), source });
    }
    return items;
  }

  /**
   * Busca vários feeds, descarta itens "ruins" pelo classificador e
   * intercala as fontes para variar as notícias.
   */
  async function fetchPool(feeds, opts) {
    const o = opts || {};
    const doFetch = o.fetch || root.fetch.bind(root);
    const perFeed = o.perFeed || 20;

    const lists = await Promise.all(
      feeds.map(async (feedUrl) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), o.timeout || 10000);
        try {
          const res = await doFetch(feedUrl, { signal: ctrl.signal, cache: 'no-store' });
          if (!res.ok) return [];
          return parseFeed(await res.text(), feedUrl).slice(0, perFeed);
        } catch (_) {
          return [];
        } finally {
          clearTimeout(timer);
        }
      })
    );

    const seen = new Set();
    const pool = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) {
      for (const l of lists) {
        const it = l[i];
        if (!it || seen.has(it.url)) continue;
        if (SNB.classify && SNB.classify(it.title + ' ' + it.summary).bad) continue;
        seen.add(it.url);
        pool.push(it);
      }
    }
    return pool;
  }

  SNB.parseFeed = parseFeed;
  SNB.fetchPool = fetchPool;

  if (typeof module !== 'undefined' && module.exports) module.exports = SNB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
