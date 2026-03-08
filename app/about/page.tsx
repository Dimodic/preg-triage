import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FolderClock,
  PhoneCall,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const productValue = [
  "Структурирует тревожное обращение и выделяет ключевые факты без потери контекста.",
  "Принимает домашние показатели пациентки и отдельно оценивает объективные сигналы риска.",
  "Помогает увидеть срочность, красные флаги и точки доуточнения до маршрутизации.",
  "Показывает match/mismatch/not enough data между жалобами и показателями.",
  "Показывает подтверждения через цитаты разговора, домашние показатели и фрагменты базы знаний.",
  "Сохраняет рабочий результат для оператора: сводка, вопросы, скрипт и журнал шагов.",
];

const responsibilityBoundary = [
  "Система не ставит диагноз и не назначает лечение.",
  "Система не заменяет оператора, врача и локальный клинический протокол.",
  "Финальное решение о маршрутизации всегда остается за человеком.",
];

const pipeline = [
  {
    title: "Валидация контекста",
    description: "Проверяет полноту входа и переводит слабый сигнал в безопасный режим доуточнения.",
  },
  {
    title: "Извлечение фактов",
    description: "Преобразует свободную речь в структурированные поля для проверки и повторного использования.",
  },
  {
    title: "Объективные сигналы",
    description: "Отдельно анализирует домашние показатели, аномалии и согласованность с жалобами пациентки.",
  },
  {
    title: "Поиск по базе знаний",
    description: "Подбирает подтверждающие фрагменты и привязку к источнику для каждого значимого сигнала.",
  },
  {
    title: "Сборка решения",
    description: "Формирует срочность, маршрут, набор уточняющих вопросов и рабочий скрипт оператора.",
  },
  {
    title: "Карточка оператора",
    description: "Собирает короткую сводку и ключевые факты, чтобы решение читалось за секунды.",
  },
  {
    title: "Контроль качества",
    description: "Ловит пробелы в подтверждениях и повышает прозрачность результата перед выдачей.",
  },
];

const trackCriteria = [
  "Есть прямое соответствие между проблемой и решением: первичная сортировка акушерских обращений в свободной речи.",
  "Архитектура многошаговая и проверяемая: вход, факты, поиск, решение, контроль качества.",
  "Интерфейс построен под рабочий сценарий оператора, а не под демонстрацию технологии.",
  "Прототип демонстрируем и измерим: история запусков, метрики качества, прозрачные источники и объяснимость.",
];

const limitations = [
  "Качество результата зависит от качества входного текста и точности распознавания речи.",
  "Нужна отдельная оценка на реальных или тщательно смоделированных обращениях.",
  "Локальные KPI в демо-режиме не заменяют клиническую валидацию в боевом контуре.",
];

const roadmap = [
  "Усиление речевого слоя: более надежный потоковый захват и нормализация входа.",
  "Развитие поиска по базе знаний: точнее ранжирование, привязка к документу и фрагменту.",
  "Эксплуатационная зрелость: журналирование, мониторинг и обратная связь оператора.",
  "Полноценная система оценки: полнота срочных случаев, ложные пропуски, согласованность слоев.",
  "Расширение доменного охвата после стабилизации акушерского сценария.",
];

const explainability = [
  "Каждая оценка подтверждается цитатами разговора, структурированными домашними показателями и ссылками на релевантные источники.",
  "Оператор работает в одном экране: срочность, сигналы риска, уточняющие вопросы, рабочий скрипт и журнал шагов.",
  "Система отдельно показывает риск, аномалии, согласованность жалоб с показателями и черновик для врача.",
  "При неполном контексте система не повышает уверенность, а переводит сценарий в режим доуточнения.",
];

const sources: Array<{ title: string; href?: string }> = [
  { title: "WHO: Ethics and governance of AI for health (2021)", href: "https://www.who.int/publications/i/item/9789240029200" },
  { title: "WHO: Guidance on large multi-modal models (2024)", href: "https://www.who.int/publications/i/item/9789240084759" },
  { title: "Минздрав РФ: рубрикатор клинических рекомендаций", href: "https://cr.minzdrav.gov.ru/clin-rec" },
  { title: "Приказ Минздрава РФ №1130н", href: "https://publication.pravo.gov.ru/Document/View/0001202011130037" },
  { title: "ДЗМ: распоряжение №1830-р по клиентским путям (13.06.2024)" },
  { title: "СП Навигатор: Нормальная беременность", href: "https://spnavigator.ru/document/8392a837-93af-4933-a3c0-da202b9460e1" },
  { title: "СП Навигатор: Артериальная гипертония у беременных", href: "https://spnavigator.ru/document/bb06714e-1e15-4433-9c91-ae5b6413206a" },
  { title: "СП Навигатор: Послеродовое кровотечение", href: "https://spnavigator.ru/document/96bf8ce3-5541-4840-b2d7-c8472aae67cf" },
  { title: "СП Навигатор: Преждевременные роды", href: "https://spnavigator.ru/document/b56b2b25-f7dd-4ce2-b0cb-e10a4a899a00" },
  { title: "СП Навигатор: Медицинская эвакуация беременных", href: "https://spnavigator.ru/document/ffad7f8c-191f-4f4a-a7bc-4f8b326b9443" },
  { title: "Минздрав РФ: стратегия цифровой трансформации отрасли", href: "https://static-0.minzdrav.gov.ru/system/attachments/attaches/000/057/382/original/%D0%A1%D1%82%D1%80%D0%B0%D1%82%D0%B5%D0%B3%D0%B8%D1%8F_%D1%86%D0%B8%D1%84%D1%80%D0%BE%D0%B2%D0%BE%D0%B9_%D1%82%D1%80%D0%B0%D0%BD%D1%81%D1%84%D0%BE%D1%80%D0%BC%D0%B0%D1%86%D0%B8%D0%B8_%D0%BE%D1%82%D1%80%D0%B0%D1%81%D0%BB%D0%B8_%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D0%BE%D0%BE%D1%85%D1%80%D0%B0%D0%BD%D0%B5%D0%BD%D0%B8%D0%B5.pdf" },
  { title: "Минздрав РФ: снижение бумажной нагрузки", href: "https://minzdrav.gov.ru/news/2015/08/28/2510-minzdrav-rossii-prodolzhaet-sistematicheskuyu-rabotu-po-snizheniyu-bumazhnoy-nagruzki-na-vrachey" },
  { title: "Минздрав РФ: федеральный реестр электронных меддокументов", href: "https://minzdrav.gov.ru/ministry/web-site/informatsionnye-sistemy-minzdrava-rossii/katalog-podsistem-egisz/federalnyy-reestr-elektronnyh-meditsinskih-dokumentov" },
  { title: "Rashidi et al. Obstetric Telephone Triage Guideline (2024)", href: "https://link.springer.com/article/10.1186/s12905-024-03076-1" },
  { title: "Минздрав РФ: стандарты СМП (класс XV)", href: "https://minzdrav.gov.ru/ministry/61/22/stranitsa-979/stranitsa-983/3-standarty-skoroy-meditsinskoy-pomoschi/klass-xv-beremennost-rodi-i-poslerodovoi-period-o00-o99" },
  { title: "WHO: Maternal mortality", href: "https://www.who.int/news-room/fact-sheets/detail/maternal-mortality" },
  { title: "Sadeghi et al. Explainable AI in healthcare (2024)", href: "https://www.sciencedirect.com/science/article/pii/S0045790624002982" },
  { title: "Edmonds. Uncertainty in Maternity Care (2024)", href: "https://www.jognn.org/article/S0884-2175(24)00226-0/fulltext" },
];

const screens = [
  { title: "Рабочий экран", href: "/triage", icon: PhoneCall },
  { title: "Обращения", href: "/cases", icon: FolderClock },
  { title: "Качество", href: "/quality", icon: BarChart3 },
  { title: "База знаний", href: "/kb", icon: BookOpen },
  { title: "Настройки", href: "/settings", icon: Settings2 },
];

export default function AboutPage() {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-[1.55fr_1fr]">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/15 via-surface-2 to-surface-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl tracking-tight">
              <Activity className="h-5 w-5" />
              О системе
            </CardTitle>
            <CardDescription className="max-w-4xl text-muted-foreground">
              ИИ-помощник для первичной сортировки акушерских обращений: от тревожной свободной речи к
              структурированному, объяснимому и безопасному следующему действию.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {productValue.map((item) => (
              <div key={item} className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Рамка ответственности
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {responsibilityBoundary.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Архитектурный конвейер
          </CardTitle>
          <CardDescription>Логика системы: валидация, факты, поиск, решение, карточка и контроль качества.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {pipeline.map((item, index) => (
            <article key={item.title} className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5 text-sm">
              <p className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </p>
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Объяснимость и операторский контур
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {explainability.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-3 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              Соответствие критериям трека
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {trackCriteria.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Ограничения и риски
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {limitations.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">План развития (5 направлений)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {roadmap.map((item, index) => (
            <div key={item} className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5">
              <span className="mr-2 font-medium text-foreground">{index + 1}.</span>
              {item}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Рабочие разделы интерфейса</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {screens.map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.href} asChild size="sm" variant="outline" className="gap-2">
                <Link href={item.href}>
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Источники
          </CardTitle>
          <CardDescription>Перечень из проектного документа.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          {sources.map((item) => (
            <article key={item.title} className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5">
              {item.href ? (
                <Link href={item.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {item.title}
                </Link>
              ) : (
                <p className="text-muted-foreground">{item.title}</p>
              )}
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
