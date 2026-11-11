(async function () {
  const $ = (id) => document.getElementById(id);
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const settings = await SNB.loadSettings();

  const cats = $('cats');
  for (const [key, cat] of Object.entries(SNB.CATEGORIES)) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.dataset.cat = key;
    box.checked = settings.categories[key] !== false;
    label.append(box, ' ' + cat.label);
    cats.append(label);
  }
  $('words').value = settings.customWords.join('\n');
  $('feeds').value = settings.feeds.join('\n');

  $('save').addEventListener('click', async () => {
    const status = $('status');
    const feeds = lines($('feeds').value).filter((u) => /^https?:\/\//i.test(u));

    // Fontes novas precisam de permissão de acesso ao site.
    const origins = [...new Set(feeds.map((u) => new URL(u).origin + '/*'))];
    const granted = origins.length
      ? await chrome.permissions.request({ origins }).catch(() => false)
      : true;

    const next = {
      enabled: settings.enabled,
      categories: {},
      customWords: lines($('words').value),
      feeds: feeds.length ? feeds : SNB.DEFAULT_FEEDS.slice(),
    };
    for (const box of cats.querySelectorAll('input[data-cat]')) {
      if (!box.checked) next.categories[box.dataset.cat] = false;
    }
    await SNB.saveSettings(next);
    await chrome.runtime.sendMessage({ type: 'refreshPool' });
    status.textContent = granted
      ? 'Salvo! Recarregue as páginas abertas.'
      : 'Salvo, mas sem permissão para algumas fontes (elas serão ignoradas).';
  });
})();
