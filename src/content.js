/*
 * Content script: acha os "cards" de notícia da página, classifica cada um e
 * troca os ruins por uma notícia boa (título, resumo, imagem e link).
 *
 * Não depende de seletores específicos de cada portal: um card é o maior
 * elemento que contém exatamente uma manchete (link com texto de manchete).
 */
(function () {
  'use strict';
  const SNB = globalThis.SNB;
  if (!SNB || !SNB.classify || window.__snbLoaded) return;
  window.__snbLoaded = true;

  const MIN_HEADLINE_CHARS = 25;
  const MIN_HEADLINE_WORDS = 4;
  const MAX_CARD_CHARS = 600;
  const PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#e6f4ea"/>' +
        '<text x="80" y="58" font-size="40" text-anchor="middle">🌱</text></svg>'
    );

  let settings = null;
  let pool = [];
  let poolReady = false;
  let cursor = 0;
  let removedOnPage = 0;
  let scanTimer = null;
  let busy = false;

  const headlineCache = new WeakMap(); // <a> -> {sig, ok}
  const handled = new WeakMap(); // <a> -> texto que nós colocamos
  const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent =
      '[data-snb="pending"]{visibility:hidden!important}' +
      '[data-snb="done"]{box-shadow:inset 3px 0 0 #2e9e5b}';
    (document.head || document.documentElement).appendChild(style);
  }

  // ---------- detecção de manchetes e cards ----------

  function hrefKey(a) {
    try {
      const u = new URL(a.href, location.href);
      u.hash = '';
      return u.href;
    } catch (_) {
      return '';
    }
  }

  function isHeadlineLink(a) {
    const text = textOf(a);
    const sig = text + '|' + a.getAttribute('href');
    const cached = headlineCache.get(a);
    if (cached && cached.sig === sig) return cached.ok;

    let ok =
      text.length >= MIN_HEADLINE_CHARS &&
      text.split(' ').length >= MIN_HEADLINE_WORDS &&
      /^https?:/i.test(a.href) &&
      !a.closest('nav, footer, [role="navigation"]');
    if (ok && hrefKey(a) === hrefKey({ href: location.href })) ok = false;
    headlineCache.set(a, { sig, ok });
    return ok;
  }

  function findCard(anchor) {
    const key = hrefKey(anchor);
    let card = anchor;
    while (card.parentElement && card.parentElement !== document.body && card.parentElement !== document.documentElement) {
      const parent = card.parentElement;
      if (textOf(parent).length > MAX_CARD_CHARS) break;
      const hasOther = Array.from(parent.querySelectorAll('a[href]')).some(
        (x) => x !== anchor && isHeadlineLink(x) && hrefKey(x) !== key
      );
      if (hasOther) break;
      card = parent;
    }
    return card;
  }

  // ---------- substituição ----------

  function nextItem() {
    if (!pool.length) return null;
    const item = pool[cursor % pool.length];
    cursor++;
    return item;
  }

  // Elementos que têm texto próprio (nós de texto diretos).
  function textElements(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const parent = n.parentElement;
      if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue;
      if (!n.nodeValue.trim()) continue;
      if (!out.includes(parent)) out.push(parent);
    }
    return out;
  }

  function ownText(el) {
    return Array.from(el.childNodes)
      .filter((c) => c.nodeType === Node.TEXT_NODE)
      .map((c) => c.nodeValue)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setOwnText(el, text) {
    let done = false;
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType !== Node.TEXT_NODE || !c.nodeValue.trim()) continue;
      c.nodeValue = done ? '' : text;
      done = true;
    }
  }

  // Rótulo curto sem número (horários, "há 2 horas" e botões "Leia mais" ficam como estão).
  function isKicker(text) {
    return (
      text.length >= 3 &&
      text.length < 40 &&
      !/\d/.test(text) &&
      !/^(leia|ler|saiba|veja|assista|ou[cç]a|mais|ao vivo)\b/i.test(text)
    );
  }

  function hide(el) {
    el.style.setProperty('display', 'none', 'important');
  }

  function swapImages(card, item) {
    const src = item.image || PLACEHOLDER;
    for (const img of card.querySelectorAll('img')) {
      for (const a of ['srcset', 'data-src', 'data-srcset', 'data-lazy-src', 'data-original', 'sizes']) {
        img.removeAttribute(a);
      }
      img.alt = item.title;
      img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER; };
      img.src = src;
    }
    for (const source of card.querySelectorAll('picture source')) source.remove();
    const bgs = [card, ...card.querySelectorAll('[style*="background"], [data-bg], [data-background]')];
    for (const el of bgs) {
      if (/background(-image)?\s*:[^;]*url\(/i.test(el.getAttribute('style') || '')) {
        el.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")';
      }
    }
  }

  function replaceCard(card, item) {
    if (!item) {
      card.setAttribute('data-snb', 'hidden');
      hide(card);
      return;
    }

    const anchors = Array.from(card.querySelectorAll('a[href]'));
    if (card.tagName === 'A') anchors.push(card);

    // 1) manchete: o texto mais longo dentro da âncora principal da manchete
    const headlineAnchor = anchors.filter(isHeadlineLink).sort((a, b) => textOf(b).length - textOf(a).length)[0];
    let headlineEl = null;
    if (headlineAnchor) {
      headlineEl = textElements(headlineAnchor).sort((a, b) => ownText(b).length - ownText(a).length)[0] || headlineAnchor;
    }

    // 2) demais textos do card
    let summaryUsed = false;
    for (const el of textElements(card)) {
      if (el === headlineEl) continue;
      const own = ownText(el);
      if (own.length >= 40) {
        if (!summaryUsed && item.summary) {
          setOwnText(el, item.summary);
          summaryUsed = true;
        } else {
          hide(el);
        }
      } else if (isKicker(own)) {
        // "Chapéu"/rótulo da notícia antiga (ex.: "Crime", "Polícia"): vira o nome da fonte.
        if (item.source) setOwnText(el, item.source);
        else hide(el);
      }
    }
    if (headlineEl) setOwnText(headlineEl, item.title);

    // 3) links, rótulos e imagens
    for (const a of anchors) {
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      for (const attr of ['title', 'aria-label']) {
        if (a.hasAttribute(attr)) a.setAttribute(attr, item.title);
      }
      handled.set(a, textOf(a));
    }
    swapImages(card, item);

    card.setAttribute('data-snb', 'done');
    card.title = '🌱 Notícia ruim trocada por uma boa' + (item.source ? ' — fonte: ' + item.source : '');
  }

  // ---------- varredura ----------

  function scan() {
    if (!settings || busy) return;
    busy = true;
    observer.disconnect();
    try {
      const seen = new Set();
      const bad = [];
      for (const a of document.querySelectorAll('a[href]')) {
        if (!isHeadlineLink(a)) continue;
        if (handled.has(a) && handled.get(a) === textOf(a)) continue;
        const card = findCard(a);
        if (seen.has(card) || card.hasAttribute('data-snb')) continue;
        seen.add(card);
        const verdict = SNB.classify(textOf(card), settings);
        if (verdict.bad) bad.push(card);
      }

      for (const card of bad) card.setAttribute('data-snb', 'pending');
      if (bad.length) {
        removedOnPage += bad.length;
        whenPoolReady(() => {
          for (const card of bad) replaceCard(card, nextItem());
          report(bad.length);
        });
      }
    } finally {
      busy = false;
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }
  }

  function report(delta) {
    try {
      chrome.runtime.sendMessage({ type: 'removed', count: removedOnPage, delta });
    } catch (_) { /* extensão recarregada: ignora */ }
  }

  const waiting = [];
  function whenPoolReady(fn) {
    if (poolReady) return fn();
    waiting.push(fn);
  }

  async function loadPool() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'getPool' });
      pool = (res && res.items) || [];
    } catch (_) {
      pool = [];
    }
    poolReady = true;
    // Mantém o paralelo: sem notícias boas disponíveis, o card some (nunca volta a ser a ruim).
    waiting.splice(0).forEach((fn) => fn());
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 150);
  }

  const observer = new MutationObserver(scheduleScan);

  async function start() {
    settings = await SNB.loadSettings();
    if (!settings.enabled) return;
    injectStyle();
    loadPool();
    scan();
    document.addEventListener('DOMContentLoaded', scan);
    window.addEventListener('load', scan);
  }

  start();
})();
