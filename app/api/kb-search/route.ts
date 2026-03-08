import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  query: z.string().trim().min(2),
});

type KBRecord = {
  source: string;
  quote: string;
  why: string;
  file_id: string;
};

const KB_DATA: KBRecord[] = [
  {
    source: "Протокол акушерской диспетчеризации v2.4",
    quote: "Сначала оцените кровотечение, интервал схваток, шевеления плода и состояние матери.",
    why: "Базовая последовательность первичной сортировки для экстренных акушерских вызовов.",
    file_id: "OB-DISP-2.4",
  },
  {
    source: "Экстренная карта телефонной сортировки при беременности",
    quote: "Подозрение на разрыв плодных оболочек при регулярных схватках требует срочной оценки.",
    why: "Правило эскалации при возможном прогрессировании родовой деятельности.",
    file_id: "EPTC-17",
  },
  {
    source: "Памятка по критическим материнским флагам",
    quote: "Кровотечение со снижением шевелений плода требует немедленного высокоприоритетного выезда.",
    why: "Соответствует критериям эскалации URG3.",
    file_id: "MCF-RED",
  },
  {
    source: "Догоспитальный акушерский чек-лист",
    quote: "Подтвердите адрес, срок беременности, тайминг схваток и наличие сопровождающего.",
    why: "Повышает готовность бригады к выезду.",
    file_id: "PREHOSP-OB-CHK",
  },
  {
    source: "Маршрутизация при подозрении на преждевременные роды",
    quote: "Регулярные болезненные схватки до срока и/или подтекание вод требуют ускоренной маршрутизации.",
    why: "Фокус на сценарии высокой неопределенности и риск пропуска осложнений.",
    file_id: "ROUTE-PRETERM-01",
  },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string) =>
  Array.from(new Set(normalize(value).split(" ").filter((token) => token.length >= 2)));

const scoreRecord = (record: KBRecord, query: string, tokens: string[]) => {
  const haystack = normalize(`${record.source} ${record.quote} ${record.why} ${record.file_id}`);

  if (!tokens.length) return 0;

  const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
  let score = matchedTokens / tokens.length;

  const normalizedQuery = normalize(query);
  if (normalizedQuery && haystack.includes(normalizedQuery)) {
    score += 0.35;
  }

  if (normalize(record.quote).includes(normalizedQuery)) {
    score += 0.15;
  }

  return Math.min(1, score);
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const query = parsed.data.query;
    const tokens = tokenize(query);

    const ranked = KB_DATA
      .map((item) => {
        const score = scoreRecord(item, query, tokens);
        return {
          ...item,
          score: Number(score.toFixed(2)),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source, "ru"));

    const items = ranked.length
      ? ranked
      : KB_DATA.slice(0, 3).map((item) => ({
          ...item,
          score: 0.1,
        }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Ошибка поиска по базе знаний" }, { status: 500 });
  }
}
