/*
 * Classificador de manchetes ruins (violência, morte, tragédia...).
 *
 * Funciona 100% local, sem enviar nada para a internet: normaliza o texto
 * (minúsculas, sem acentos) e procura padrões em português por categoria.
 * Padrões "weak" são ambíguos (ex.: "massacre" no futebol) e são ignorados
 * quando o texto parece ser de esporte.
 */
(function (root) {
  'use strict';
  const SNB = (root.SNB = root.SNB || {});

  function normalize(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Limite de palavra que não considera "-" como separador (evita "mata-mata").
  const W = (src) => '(?<![\\w-])(?:' + src + ')(?![\\w-])';

  // A perto de B (em qualquer ordem), com até `gap` palavras no meio.
  function near(a, b, gap) {
    const mid = '(?:\\w+\\W+){0,' + (gap == null ? 8 : gap) + '}';
    return '(?:' + a + ')\\W+' + mid + '(?:' + b + ')|(?:' + b + ')\\W+' + mid + '(?:' + a + ')';
  }

  const CHILD = [
    'crianc\\w*', 'bebes?', 'menin[oa]s?', 'recem-nascid\\w*', 'adolescentes?',
    'filh[oa]s?', 'infantil', 'alun[oa]s?', 'estudantes?', 'garot[oa]s?',
    'entead[oa]s?', 'netos?', 'netas?', 'de (?:[0-9]|1[0-7]) anos',
  ].join('|');

  const HARM = [
    'morr\\w+', 'mort[oa]s?', 'mortes?', 'mata(?:r|m|ndo|do|da|dos|das)?', 'matou', 'mataram',
    'assassin\\w*', 'espanc\\w*', 'abus\\w*', 'estupr\\w*', 'agred\\w*', 'tortur\\w*',
    'sequestr\\w*', 'desaparec\\w*', 'afog\\w*', 'balead\\w*', 'esfaque\\w*',
    'maus-tratos', 'maltrat\\w*', 'abandon\\w*', 'atropel\\w*', 'violenc\\w*',
    'violent\\w*', 'sufoc\\w*', 'intoxic\\w*',
  ].join('|');

  const CATEGORIES = {
    homicidio: {
      label: 'Assassinatos e homicídios',
      strong: [
        "assassin(?!'s)\\w*", 'homicid\\w*', 'feminicid\\w*', 'latrocin\\w*', 'infanticid\\w*',
        'genocid\\w*', 'chacina\\w*', 'balead[oa]s?', 'alvejad[oa]s?', 'a tiros?', 'tiroteio\\w*',
        'troca de tiros', 'esfaque\\w*', 'facada\\w*', 'apunhal\\w*', 'degolad\\w*',
        'decapitad\\w*', 'enforcad\\w*', 'estrangulad\\w*', 'asfixiad\\w*', 'carbonizad\\w*',
        'queimad[oa]s? vivo\\w*', 'esquartejad\\w*', 'emparedad\\w*', 'envenenad\\w*',
        'tentou matar', 'encontrad[oa]s? mort\\w+', 'corpo\\w* (?:encontrad|achad|localizad)\\w*',
        'cadaver\\w*', 'ossada\\w*',
      ],
      weak: [
        'mat(?:ou|aram|ar|ando|ado|ada|ados|adas|am)',
        'mata (?:a|o|as|os|um|uma|seu|sua|dois|duas|tres|quatro|[0-9]+)',
      ],
    },
    morte: {
      label: 'Mortes em geral',
      strong: [
        'mort[oa]s?', 'mortes?', 'morre\\w*', 'morr(?:er|endo|eu|eram)', 'falece\\w*',
        'obito\\w*', 'vitimas? fatais?', 'suicid\\w*',
      ],
      weak: [],
    },
    crianca: {
      label: 'Violência ou morte envolvendo crianças',
      strong: [near(CHILD, HARM, 8)],
      weak: [],
    },
    sexual: {
      label: 'Violência sexual e assédio',
      strong: [
        'estupr\\w*', 'abuso sexual', 'abus(?:ou|ar|ado|ada|ados|adas) sexualmente',
        'abus\\w+ de (?:crianc|menor|vulneravel)\\w*', 'importunacao sexual', 'violencia sexual',
        'pedofil\\w*', 'assedi\\w*', 'molestad[oa]s?', 'molestou', 'pornografia infantil',
        'exploracao sexual', 'aliciament\\w*', 'nudes? vazad\\w*',
      ],
      weak: [],
    },
    agressao: {
      label: 'Agressões, tortura e sequestro',
      strong: [
        'agred\\w*', 'agress(?:ao|oes|or|ora|ores)', 'espanc\\w*', 'tortur\\w*', 'sequestr\\w*',
        'carcere privado', 'cativeiro', 'refens?', 'linch\\w*', 'violencia domestica',
        'violencia contra (?:a )?(?:mulher|crianc\\w*|idos\\w*)', 'maus-tratos', 'maltrat\\w*',
        'ameacas? de morte', 'esmurr\\w*', 'lesao corporal', 'medida protetiva',
        'tentou (?:agredir|esfaquear|estuprar|sequestrar)',
      ],
      weak: ['socos?', 'chutes?', 'armad[oa]s?'],
    },
    honra: {
      label: 'Ataques à honra (racismo, difamação, humilhação)',
      strong: [
        'injuria\\w*', 'racism\\w*', 'racist\\w*', 'homofob\\w*', 'transfob\\w*', 'xenofob\\w*',
        'misogin\\w*', 'machism\\w*', 'calunia\\w*', 'difama\\w*', 'humilha\\w*', 'xingament\\w*',
        'ciber ?bullying', 'bullying', 'discurso de odio', 'crimes? de odio', 'antissemit\\w*',
        'ofensas? (?:racist\\w*|homofob\\w*)', 'ataques? (?:racist\\w*|misogin\\w*)',
        'vazamento de (?:fotos|videos|nudes|conversas)',
      ],
      weak: [],
    },
    guerra: {
      label: 'Guerras, terrorismo e atentados',
      strong: [
        'guerra (?:na|no|em|entre|do|da|de|contra) (?:ucrania|gaza|israel|russia|ira|siria|sudao|afeganistao|palestin\\w*|oriente medio|myanmar|iemen|libano|haiti)',
        'bombardei\\w*', 'bombardead\\w*', 'bombardeou', 'missil', 'misseis',
        'drones? (?:russos?|ucranian\\w*|israelens\\w*|armad\\w*)', 'atentad\\w*',
        '(?:ataques?) (?:aereos?|armados?|terrorista\\w*|a tiros|com faca|com drones?|de drones?|russo|israelense|do hamas|com misseis)',
        'mortos? em (?:ataques?|bombardeio|guerra|conflito|explosao)', 'conflito armado',
        'hamas', 'hezbollah',
      ],
      weak: ['massacr\\w*', 'terror\\w*'],
    },
    crime: {
      label: 'Crimes violentos e crime organizado',
      strong: [
        'assalt\\w*', 'arrastoes?', 'arrastao', 'roubos?', 'roubou', 'roubaram', 'furtos?',
        'faccao', 'faccoes', 'milicia\\w*', 'trafic\\w*', 'traficantes?', 'narcotrafic\\w*',
        'quadrilha\\w*', 'organizacao criminosa', 'crime organizado', 'foragid[oa]s?',
        'fuzis?', 'policia mata', 'morto pela policia', 'confronto com a policia',
        'bala perdida', 'balas perdidas', 'operacao policial (?:deixa|termina)',
      ],
      weak: [],
    },
    tragedia: {
      label: 'Acidentes e tragédias',
      strong: [
        'acidentes?', 'tragedia\\w*', 'desabament\\w*', 'desmoronament\\w*', 'deslizament\\w*',
        'naufrag\\w*', 'afogad[oa]s?', 'queda de (?:aviao|helicoptero)', 'aviao (?:cai|caiu)',
        'atropelad[oa]s?', 'atropelou', 'colisao', 'capotament\\w*', 'inundac\\w*', 'enchentes?',
        'enxurrada', 'soterrad[oa]s?', 'vitimas?', 'feridos?', 'desaparecid[oa]s?', 'intoxicac\\w*',
      ],
      weak: ['explosao', 'explodiu', 'incendi\\w*', 'desaparece\\w*'],
    },
  };

  // Expressões em que a palavra "ruim" não tem nada de violento.
  const IDIOMS = new RegExp(
    [
      'mat\\w+ (?:a |o |as |os )?(?:saudade|sede|fome|charada|aula|tempo|curiosidade|vontade|cobra)',
      'mata (?:atlantica|ciliar|nativa|virgem|fechada)',
      'ponto morto', 'peso morto', 'lingua morta', 'mar morto', 'natureza morta',
      'mort[oa]s? de (?:cansaco|fome|sede|vergonha|medo|saudade|rir|inveja)',
      'morre(?:u|m)? de (?:rir|saudade|inveja|vergonha)', 'morre na praia',
      'dia de finados', 'dia dos mortos',
    ].join('|'),
    'g'
  );

  const SPORTS = new RegExp(
    W(
      [
        'gols?', 'rodada', 'campeonato', 'brasileirao', 'libertadores', 'copa', 'selecao',
        'jogos?', 'placar', 'torcida', 'rebaixamento', 'serie [abcd]', 'nba', 'nfl', 'fifa', 'uefa',
        'flamengo', 'corinthians', 'palmeiras', 'vasco', 'botafogo', 'gremio', 'cruzeiro',
        'fluminense', 'treino', 'tecnico', 'atacante', 'zagueiro', 'goleiro', 'volei', 'basquete',
        'tenis', 'formula 1', 'f1', 'ufc', 'mma', 'olimpiad\\w*', 'rodada',
      ].join('|')
    )
  );

  for (const cat of Object.values(CATEGORIES)) {
    cat.strongRe = cat.strong.length ? new RegExp(cat.strong.map(W).join('|')) : null;
    cat.weakRe = cat.weak.length ? new RegExp(cat.weak.map(W).join('|')) : null;
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * @param {string} text  manchete (+ linha de apoio) a avaliar
   * @param {{categories?: Object<string, boolean>, customWords?: string[]}} [opts]
   *        categories: { homicidio: false } desliga uma categoria (padrão: todas ligadas)
   * @returns {{bad: boolean, category?: string, match?: string}}
   */
  function classify(text, opts) {
    const o = opts || {};
    const enabled = o.categories || {};
    const t = normalize(text).replace(IDIOMS, ' ');
    if (!t) return { bad: false };
    const sports = SPORTS.test(t);

    for (const key of Object.keys(CATEGORIES)) {
      if (enabled[key] === false) continue;
      const cat = CATEGORIES[key];
      let m = cat.strongRe && cat.strongRe.exec(t);
      if (m) return { bad: true, category: key, match: m[0] };
      if (!sports) {
        m = cat.weakRe && cat.weakRe.exec(t);
        if (m) return { bad: true, category: key, match: m[0] };
      }
    }

    for (const word of o.customWords || []) {
      const w = normalize(word);
      if (!w) continue;
      const m = new RegExp(W(escapeRe(w))).exec(t);
      if (m) return { bad: true, category: 'custom', match: m[0] };
    }
    return { bad: false };
  }

  SNB.normalize = normalize;
  SNB.classify = classify;
  SNB.CATEGORIES = Object.fromEntries(
    Object.entries(CATEGORIES).map(([k, v]) => [k, { label: v.label }])
  );

  if (typeof module !== 'undefined' && module.exports) module.exports = SNB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
