(async function () {
  const $ = (id) => document.getElementById(id);
  const settings = await SNB.loadSettings();
  $('enabled').checked = settings.enabled;

  const { total } = await chrome.storage.local.get('total');
  $('total').textContent = total || 0;

  $('enabled').addEventListener('change', async (e) => {
    settings.enabled = e.target.checked;
    await SNB.saveSettings(settings);
    $('msg').textContent = 'Recarregue a página para aplicar.';
  });

  $('refresh').addEventListener('click', async () => {
    $('msg').textContent = 'Buscando notícias boas...';
    const res = await chrome.runtime.sendMessage({ type: 'refreshPool' });
    const n = (res && res.items && res.items.length) || 0;
    $('msg').textContent = n
      ? n + ' notícias boas disponíveis.'
      : 'Não consegui buscar notícias. Confira as fontes em Configurações.';
  });

  $('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
})();
