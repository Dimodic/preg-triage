const TOKEN_REGEX = /[\p{L}\p{N}-]+/gu;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\u0451/gu, "\u0435")
    .replace(/[\u2018\u2019\u201c\u201d"'`]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeToken = (value: string) => normalize(value).replace(/\s+/g, "");

const isMeaningfulToken = (token: string) => /\d/u.test(token) || token.length >= 3;
const hasWeekSignal = (value: string) => /\u043d\u0435\u0434\u0435\u043b|\u0431\u0435\u0440\u0435\u043c/u.test(value);
const extractWeekNumber = (value: string) => value.match(/(?<!\d)(\d{1,2})(?!\d)/u)?.[1] ?? null;

const tokenize = (value: string) => {
  const normalized = normalize(value);
  if (!normalized) return [] as string[];
  return (normalized.match(TOKEN_REGEX) ?? []).map(normalizeToken).filter(Boolean);
};

const tokenRootsMatch = (a: string, b: string) => {
  if (a.length < 5 || b.length < 5) return false;
  return a.slice(0, 3) === b.slice(0, 3);
};

const tokensMatch = (a: string, b: string) =>
  a === b || a.includes(b) || b.includes(a) || tokenRootsMatch(a, b);

export const containsEither = (source: string, target: string) => {
  const a = normalize(source);
  const b = normalize(target);
  if (!a || !b) return false;

  if (hasWeekSignal(a) || hasWeekSignal(b)) {
    const aWeek = extractWeekNumber(a);
    const bWeek = extractWeekNumber(b);
    if (aWeek && bWeek && aWeek === bWeek) return true;
  }

  if (a.includes(b) || b.includes(a)) return true;

  const aTokens = Array.from(new Set(tokenize(a).filter(isMeaningfulToken)));
  const bTokens = Array.from(new Set(tokenize(b).filter(isMeaningfulToken)));
  if (!aTokens.length || !bTokens.length) return false;

  const [smaller, larger] = aTokens.length <= bTokens.length ? [aTokens, bTokens] : [bTokens, aTokens];
  const overlapCount = smaller.reduce(
    (count, token) => count + (larger.some((candidate) => tokensMatch(candidate, token)) ? 1 : 0),
    0,
  );

  const requiredOverlap = smaller.length === 1 ? 1 : Math.min(2, smaller.length);
  return overlapCount >= requiredOverlap;
};

export const extractMeaningfulTokens = (value: string) =>
  Array.from(new Set(tokenize(value).filter(isMeaningfulToken)));

export const normalizeForMatch = normalize;
