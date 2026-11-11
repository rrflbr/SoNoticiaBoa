# 🌱 Só Notícia Boa

Extensão do Chrome (Manifest V3) que, ao abrir portais como **Globo (g1, ge, O Globo…)** e **UOL**, troca
notícias de violência e tragédia por notícias boas. A troca mantém o layout do portal: mudam o título, o resumo,
a imagem e o link do card. Uma barra verde à esquerda indica o que foi trocado.

## Instalar (modo desenvolvedor)

1. Abra `chrome://extensions` e ligue **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha esta pasta.
3. Abra o g1 ou o UOL. O número no ícone da extensão mostra quantas notícias foram trocadas na aba.

## Como funciona

- **Detecção** (`src/content.js`): não usa seletores específicos de cada portal. Um *card* é o maior elemento que
  contém exatamente uma manchete (um link com texto de manchete). Por isso o mesmo código serve para vários sites
  e também trata conteúdo que carrega depois (rolagem infinita).
- **Classificação** (`src/classifier.js`): roda 100% no navegador, sem enviar nada para a internet. Procura
  padrões em português, por categoria, na manchete e na linha de apoio. Categorias: assassinatos, mortes em
  geral, crianças, violência sexual e assédio, agressões/sequestro, ataques à honra (racismo, difamação,
  humilhação), guerra/terrorismo, crime organizado e acidentes/tragédias. Termos ambíguos (como "massacre")
  são ignorados em textos de esporte, e expressões como "matar a saudade" e "Mata Atlântica" são tratadas.
- **Notícias boas** (`src/feed.js`, `src/background.js`): vêm de feeds RSS, buscados pelo service worker e
  guardados em cache por 30 minutos. As notícias dos feeds passam pelo mesmo classificador, então uma notícia
  ruim que apareça na fonte não é usada como substituta. Se nenhuma fonte responder, o card ruim é
  escondido, e a manchete original não volta.

Tudo é configurável em **Configurações** (clique com o botão direito no ícone → *Opções*): categorias ligadas,
palavras extras e fontes RSS.

## Fontes padrão

`https://www.sonoticiaboa.com.br/feed/` e `https://www.razoesparaacreditar.com/feed/`. Essas URLs foram
configuradas sem teste real: o ambiente de desenvolvimento não tinha acesso a elas. Se alguma não responder,
troque pela URL correta na página de opções (o botão **Atualizar notícias boas** do popup mostra quantas
notícias foram carregadas).

## Limitações conhecidas

- É uma heurística por palavras: pode deixar passar manchetes sem as palavras-chave e, às vezes, trocar notícias
  inofensivas (por exemplo, "enchente" entra em *Acidentes e tragédias*). Desligue a categoria ou ajuste as
  palavras extras se incomodar.
- Só o conteúdo dos cards é trocado. Ao clicar numa notícia ruim que o filtro não pegou, a página de leitura abre normalmente.
- Portais que montam cards de forma muito atípica (um único wrapper para vários links, por exemplo) podem
  precisar de ajuste em `findCard`.
- Sites cobertos estão em `content_scripts.matches` no `manifest.json`: globo.com, uol.com.br, estadao, r7,
  terra, metropoles, cnnbrasil, ig e correiobraziliense. Para incluir outro, adicione o padrão lá.

## Testes

```bash
npm test          # classificador e parser de RSS (node:test, sem dependências)
npm run test:e2e  # carrega a extensão no Chromium e valida a troca numa página simulada (requer playwright)
```
