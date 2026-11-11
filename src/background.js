/* Service worker: busca/guarda em cache as notícias boas e controla o contador do ícone. */
importScripts('classifier.js', 'settings.js', 'feed.js');

const TTL_MS = 30 * 60 * 1000;
let inflight = null;

async function loadPool(force) {
  const settings = await SNB.loadSettings();
  const key = JSON.stringify(settings.feeds);
  const { pool } = await chrome.storage.local.get('pool');

  const fresh = pool && pool.key === key && Date.now() - pool.at < TTL_MS && pool.items.length;
  if (fresh && !force) return pool.items;

  const items = await SNB.fetchPool(settings.feeds);
  if (items.length) {
    await chrome.storage.local.set({ pool: { key, at: Date.now(), items } });
    return items;
  }
  // Sem rede / feeds fora do ar: usa o que já estava guardado.
  return pool && pool.key === key ? pool.items : [];
}

function getPool(force) {
  if (!inflight || force) {
    inflight = loadPool(force).finally(() => { inflight = null; });
  }
  return inflight;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'getPool' || msg.type === 'refreshPool') {
    getPool(msg.type === 'refreshPool')
      .then((items) => sendResponse({ items }))
      .catch(() => sendResponse({ items: [] }));
    return true; // resposta assíncrona
  }

  if (msg.type === 'removed' && sender.tab) {
    const n = Math.max(0, Number(msg.count) || 0);
    chrome.action.setBadgeBackgroundColor({ color: '#2e9e5b', tabId: sender.tab.id });
    chrome.action.setBadgeText({ text: n ? String(n) : '', tabId: sender.tab.id });
    if (msg.delta > 0) {
      chrome.storage.local.get('total').then(({ total }) =>
        chrome.storage.local.set({ total: (total || 0) + msg.delta })
      );
    }
  }
});

chrome.runtime.onInstalled.addListener(() => { getPool(false).catch(() => {}); });
