import crypto from 'crypto';

function decodeEntities(value) {
  const named = new Map([
    ['amp', '&'],
    ['lt', '<'],
    ['gt', '>'],
    ['quot', '"'],
    ['apos', "'"],
    ['copy', '©'],
    ['trade', '™'],
    ['reg', '®'],
    ['Uuml', 'Ü'],
    ['uuml', 'ü'],
  ]);

  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]+);/g, (match, entity) => {
    if (entity.startsWith('#x')) {
      const cp = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    if (entity.startsWith('#')) {
      const cp = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    return named.get(entity) ?? match;
  });
}

export function normalizeCardText(input) {
  if (typeof input !== 'string') return '';
  return decodeEntities(input).normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function createDuplicateDiagnostics(cards, type) {
  const byText = new Map();
  for (const card of cards) {
    const key = `${type}:${card.text}`;
    const existing = byText.get(key) ?? [];
    existing.push({ sourceId: card.sourceId, pack: card.pack });
    byText.set(key, existing);
  }
  return [...byText.entries()]
    .filter(([, refs]) => refs.length > 1)
    .map(([key, refs]) => ({ key, refs }));
}

export function parseAndNormalizeCahCards(rawCards, { datasetVersion }) {
  if (!Array.isArray(rawCards)) {
    throw new Error('cards.json root is not an array');
  }

  const counters = {
    parsed: rawCards.length,
    black: 0,
    white: 0,
    skippedInvalid: 0,
    invalidReasons: {},
  };

  const blackCards = [];
  const whiteCards = [];

  for (const row of rawCards) {
    const sourceId = row?.id;
    const cardType = row?.cardType;
    const rawText = row?.text;
    const numAnswers = row?.numAnswers;
    const pack = row?.expansion;

    const invalid = [];
    if (!Number.isInteger(sourceId)) invalid.push('invalid_source_id');
    if (cardType !== 'Q' && cardType !== 'A') invalid.push('invalid_card_type');
    if (typeof rawText !== 'string') invalid.push('invalid_text');
    if (!Number.isInteger(numAnswers)) invalid.push('invalid_num_answers');
    if (typeof pack !== 'string' || !pack.trim()) invalid.push('invalid_pack');

    const text = normalizeCardText(rawText ?? '');
    if (!text) invalid.push('empty_normalized_text');

    if (invalid.length > 0) {
      counters.skippedInvalid += 1;
      for (const reason of invalid) {
        counters.invalidReasons[reason] = (counters.invalidReasons[reason] ?? 0) + 1;
      }
      continue;
    }

    if (cardType === 'Q' && numAnswers <= 0) {
      counters.skippedInvalid += 1;
      counters.invalidReasons.invalid_pick = (counters.invalidReasons.invalid_pick ?? 0) + 1;
      continue;
    }
    if (cardType === 'A' && numAnswers !== 0) {
      counters.skippedInvalid += 1;
      counters.invalidReasons.invalid_white_num_answers =
        (counters.invalidReasons.invalid_white_num_answers ?? 0) + 1;
      continue;
    }

    const common = {
      sourceId,
      text,
      rawText,
      pack: pack.trim(),
      datasetVersion,
      textHash: hashText(text),
    };

    if (cardType === 'Q') {
      blackCards.push({ ...common, pick: numAnswers });
      counters.black += 1;
    } else {
      whiteCards.push(common);
      counters.white += 1;
    }
  }

  return {
    blackCards,
    whiteCards,
    counters,
    duplicateDiagnostics: {
      black: createDuplicateDiagnostics(blackCards, 'black'),
      white: createDuplicateDiagnostics(whiteCards, 'white'),
    },
  };
}
