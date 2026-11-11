/* Configurações compartilhadas (content script, popup, opções e background). */
(function (root) {
  'use strict';
  const SNB = (root.SNB = root.SNB || {});

  // Fontes padrão de notícias boas (RSS). Podem ser trocadas na página de opções.
  SNB.DEFAULT_FEEDS = [
    'https://www.sonoticiaboa.com.br/feed/',
    'https://www.razoesparaacreditar.com/feed/',
  ];

  SNB.DEFAULT_SETTINGS = {
    enabled: true,
    categories: {}, // chave ausente = categoria ligada
    customWords: [],
    feeds: SNB.DEFAULT_FEEDS.slice(),
  };

  SNB.mergeSettings = function (saved) {
    const s = saved || {};
    const feeds = Array.isArray(s.feeds) && s.feeds.length ? s.feeds : SNB.DEFAULT_FEEDS.slice();
    return {
      enabled: s.enabled !== false,
      categories: Object.assign({}, s.categories),
      customWords: Array.isArray(s.customWords) ? s.customWords : [],
      feeds,
    };
  };

  SNB.loadSettings = async function () {
    const r = await chrome.storage.sync.get('settings');
    return SNB.mergeSettings(r.settings);
  };

  SNB.saveSettings = function (settings) {
    return chrome.storage.sync.set({ settings });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SNB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
