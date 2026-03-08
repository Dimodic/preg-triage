# Диспетчер вызовов (демо)

ИИ-помощник для первичной сортировки акушерских обращений: от свободной тревожной речи к структурированному и объяснимому следующему действию.

## Что делает система

- Оценивает срочность (`urgency 0-3`) и признак немедленной маршрутизации (`dispatch_now`).
- Принимает не только транскрипт, но и структурированные домашние показатели пациентки (`patient_input`).
- Выявляет объективные аномалии (`anomalies`) и определяет статус согласованности `match / mismatch / not_enough_data`.
- Выставляет дополнительный уровень риска (`risk_level`) и рекомендуемый маршрут (`recommended_route`).
- Формирует черновик объективного вывода для врача (`doctor_draft`) и хранит статус врачебной верификации (`doctor_review`).
- Выделяет красные флаги, формирует уточняющие вопросы и рабочий скрипт оператора.
- Показывает причину выбранной оценки (`primary_reason`) и ограничения текущего вывода (`limitations`).
- Показывает подтверждения через цитаты разговора и фрагменты базы знаний.
- Сохраняет обращение и журнал шагов для повторного разбора.

## Что система не делает

- Не ставит диагноз.
- Не назначает лечение.
- Не заменяет оператора, врача и локальный клинический протокол.

## Архитектурный конвейер

1. Валидация контекста и проверка полноты входа.
2. Извлечение фактов в структурированный объект `extracted`.
3. Rule-based анализ домашних показателей и сбор объективных сигналов.
4. Поиск подтверждений в курируемой базе знаний `rag`.
5. Сборка решения о срочности и карточки оператора (`triage`, `operator_card`).
6. Построение explainable decision-support блока (`anomalies`, `consistency_status`, `risk_level`, `doctor_draft`).
7. Контроль качества результата (`qc`) и безопасная корректировка.
8. Единый итоговый JSON с трассировкой шагов.

## Новый входной контракт

`/api/run-triage` принимает:

- `transcript`
- `patient_input.complaint_text`
- `patient_input.gestation_weeks`
- `patient_input.systolic_bp`, `patient_input.diastolic_bp`
- `patient_input.pulse`, `patient_input.temperature`, `patient_input.spo2`
- `patient_input.bleeding`, `patient_input.pain`, `patient_input.fetal_movement`
- `patient_input.measurement_time`, `patient_input.measurement_source`, `patient_input.missing_fields`

Если полного транскрипта нет, можно отправить короткое `complaint_text`: сервер использует его как fallback-вход.

## Эксплуатационный контур и метрики

Локальный аудит запусков хранится в `localStorage`:
- ключ: `pregtriage.runAudit.v1`
- лимит: `500` событий
- пишутся успешные и ошибочные запуски (режим, срочность, уверенность, сигналы качества, ошибка)

Экран `/quality` показывает:
- долю срочных запусков (`urgency >= 2`)
- долю небезопасных результатов (`qc.is_safe = false`)
- долю дефицита подтверждений (`missing_evidence > 0`)
- среднюю нагрузку доуточнений (`needs_clarification`)
- среднюю уверенность
- повторяющиеся красные флаги и пункты доуточнения
- последние риск-ситуации

На рабочем экране есть индикатор неполного контекста:
- включается при `needs_clarification > 0` и одновременно низкой уверенности или дефиците подтверждений

## Поиск по базе знаний

Маршрут `/api/kb-search` использует ранжирование по релевантности и возвращает:
- `source`, `quote`, `why`
- `file_id`, `score` (обратно-совместимо)

Экран `/kb` отображает:
- релевантность результата
- идентификатор источника
- пояснение попадания в выдачу
- покрытие источников по текущему запросу

## Маршруты

- `/triage` — рабочий экран
- `/cases` — история обращений
- `/cases/[id]` — карточка обращения
- `/quality` — качество и аудит запусков
- `/kb` — поиск по базе знаний
- `/settings` — режимы и подключение внешнего сервиса
- `/about` — архитектура, критерии, риски, план развития и источники

## Соответствие проектному документу

Проект отражает ключевые блоки из `Проект.pdf`:
- практическая задача первичной сортировки акушерских обращений
- многошаговая архитектура с объяснимыми слоями
- операторский сценарий и прозрачность оснований
- ограничения и рамка ответственности
- реалистичный план развития из пяти направлений
- источники и доказательная база

## План развития (5 направлений)

1. Усиление речевого слоя.
2. Развитие поиска и ранжирования базы знаний.
3. Эксплуатационная зрелость (журналирование, мониторинг, обратная связь).
4. Полноценная система оценки качества на сценариях.
5. Расширение доменного охвата после стабилизации текущего контура.

## Запуск

```bash
npm i
npm run dev
```

Откройте: [http://localhost:3000/triage](http://localhost:3000/triage)

## Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните при необходимости:

```env
WORKFLOW_RUN_ENDPOINT=
WORKFLOW_ALLOWED_HOSTS=
WORKFLOW_FETCH_TIMEOUT_MS=30000
WORKFLOW_ID=
YANDEX_IAM_TOKEN=
WORKFLOW_API_BASE=https://serverless-workflows.api.cloud.yandex.net/workflows/v1
```

Приоритет вызова в `/api/run-triage`:
1. `endpoint` из тела запроса
2. `WORKFLOW_RUN_ENDPOINT` из окружения
3. Прямой вызов Workflows API (`WORKFLOW_ID` + `YANDEX_IAM_TOKEN`)
4. Локальный демонстрационный сценарий

## Основные источники

- [WHO: Ethics and governance of AI for health (2021)](https://www.who.int/publications/i/item/9789240029200)
- [WHO: Guidance on large multi-modal models (2024)](https://www.who.int/publications/i/item/9789240084759)
- [Минздрав РФ: рубрикатор клинических рекомендаций](https://cr.minzdrav.gov.ru/clin-rec)
- [Приказ Минздрава РФ №1130н](https://publication.pravo.gov.ru/Document/View/0001202011130037)
- [СП Навигатор: Нормальная беременность](https://spnavigator.ru/document/8392a837-93af-4933-a3c0-da202b9460e1)
- [СП Навигатор: Артериальная гипертония у беременных](https://spnavigator.ru/document/bb06714e-1e15-4433-9c91-ae5b6413206a)
- [СП Навигатор: Послеродовое кровотечение](https://spnavigator.ru/document/96bf8ce3-5541-4840-b2d7-c8472aae67cf)
- [СП Навигатор: Преждевременные роды](https://spnavigator.ru/document/b56b2b25-f7dd-4ce2-b0cb-e10a4a899a00)
- [СП Навигатор: Медицинская эвакуация беременных](https://spnavigator.ru/document/ffad7f8c-191f-4f4a-a7bc-4f8b326b9443)
- [Rashidi et al. OTTG (2024)](https://link.springer.com/article/10.1186/s12905-024-03076-1)
- [WHO: Maternal mortality](https://www.who.int/news-room/fact-sheets/detail/maternal-mortality)
- [Sadeghi et al. Explainable AI in healthcare (2024)](https://www.sciencedirect.com/science/article/pii/S0045790624002982)
- [Edmonds. Uncertainty in Maternity Care (2024)](https://www.jognn.org/article/S0884-2175(24)00226-0/fulltext)
