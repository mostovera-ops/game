# 06 — Рецепты и Кухня (Recipe Box / Cookery)

> **Статус:** черновик v0.2 (Фаза B, фиксы применены). **Канон обязателен:** `docs/specs/00-canon.md` (версия 1.1) — при конфликте следовать канону, расхождение — в §8.
> **Источник концепта:** `docs/concept/sunnyside-deck.html`, слайд 06 «Кухня».
> **Скоуп файла:** каталог блюд, станки, mastery, сеты Blue Plate Special, секретные рецепты-эксперименты. Экономика (финальные цены/тайминги) централизуется в `docs/specs/14-economy.md` — все числа здесь помечены `(гипотеза)`.

---

## 1. TL;DR

Кухня превращает сырьё с грядок и от животных в блюда через простую систему **рецепт-карточек**: поставил ингредиенты в очередь станка → подождал таймер → забрал готовое блюдо. Никакого мини-игрового стресса — Overcooked-вайб опционален (активная смена ярмарки), а базовое приготовление — это чистый idle-крафтинг.

Три способа расширять меню: (1) **база** — рецепты открываются по уровню кухни и открытым штатам экспедиций; (2) **секретки** — эксперименты со станком дают шанс найти скрытый рецепт по подсказке-комбинации; (3) **нарратив** — карточки от NPC Nana Opal (`npc_nana_opal`) и награды ивентов/конкурсов.

Каталог этой спеки — **112 сельных блюд** (Recipe Card) в 8 категориях спроса, 5 тирах (T1–T5), на **10 станках** (6 из них явно упомянуты в деке, 4 — новые предложения, см. пометки `(нейминг-кандидат)`). Плюс: **18 полуфабрикатов** (цепочки крафта), **34 сета Blue Plate Special**, **5-уровневая mastery-кривая** (★1–★5) и **22 секретных рецепта-эксперимента**.

Философия чисел: цена и время блюда масштабируются по тиру из канона (§2.2): `$6 / $22 / $75 / $260 / $900` и `5 / 15 / 45 / 120 / 300 мин` — это середина вилки, конкретные блюда отклоняются ±40% в зависимости от сложности цепочки.

---

## 2. Player Experience

**Открытие кухни.** Игрок разблокирует `bld_kitchen` (Kitchen / Кухня) в туториале-«мини-неделе» (см. E8 канона). Bабушка Опал (`npc_nana_opal`) вручает первую карточку — **Farm Scramble (Фермерская яичница)** — и объясняет очередь станка на пальцах: положил `Egg×3` на Grill (Гриль), таймер 5 минут, забрал блюдо. Никакого экрана «неудача».

**Recipe Box (`ui_recipe_box`, Коробка рецептов) как альбом, не таблица.** Каждая карточка — как в деке: иконка блюда, тир, станок, список ингредиентов с количествами, время, mastery-полоска (★☆☆☆☆), счётчик «готовили N раз» и дата первого приготовления («впервые — 12 мая»). Открытые, но ещё не приготовленные рецепты показаны силуэтом с прочерком вместо счётчика — предвкушение, не блок.

**Очередь, а не клик-фестиваль.** Станок держит очередь на 2–4 слота (зависит от уровня станка — детали в спеке построек). Игрок утром «заряжает» кухню на день: ставит 3–5 рецептов в очередь, уходит, вечером собирает урожай блюд на склад (Larder / Кладовая). Ощущение — как утренний обход грядок, только для кухни.

**Mastery — гринд без инфляции.** Чем чаще готовишь Cherry Pie à la Mode, тем быстрее и дороже он выходит (см. §3.3, §4.3): растёт качество и цена, не тираж за клик. Это превращает «любимое блюдо» в осмысленный выбор специализации кухни игрока, а не в необходимость держать 112 рецептов активными одновременно.

**Секретки — топливо для чата.** Раз в день игрок может «поэкспериментировать» на любом разблокированном станке: подсунуть нестандартный ингредиент вместо канонного и с некоторой вероятностью получить намёк или сразу открыть секретный рецепт (см. §3.4, §4.5). Это осознанно копирует дековую фразу «а что если бекон в шейк?» — провала при неудачном эксперименте нет, просто «пока не то» и лёгкая подсказка.

**Blue Plate Special — комбинаторика планирования.** На ярмарку выгоднее нести не отдельные блюда, а собранный сет (главное + гарнир + напиток) — бонус к цене за комбо (см. §4.4). Игрок планирует посевы под конкретный сет недели, это стыкуется с Demand Board (`ui_demand_board`) понедельника.

**Эмоция.** «У меня получился идеальный вишнёвый пай» — это не абстрактная циферка, а карточка на стене с историей, звёздами и цифрой «готовили 214 раз» — коллекция как личность (P4 канона).

---

## 3. Механики — исчерпывающе

### 3.1 Станки (Stations)

Кухня (`bld_kitchen`) даёт слоты под станки; уровень здания открывает новые станки и увеличивает очередь. Шесть станков явно названы в деке; четыре добавлены этой спекой для покрытия южной/морской кухни и сэндвичей — помечены как нейминг-кандидаты, требуют утверждения в канон §3.

| Ключ (черновой) | EN | RU | Очередь (баз., гипотеза) | Категории, которые обслуживает | Статус нейминга |
|---|---|---|---|---|---|
| `st_grill` | Grill | Гриль | 3 слота | Гриль, Завтраки, Сэндвичи (гриль-подвид), Южная кухня (brisket/ribs) | канон (дек) |
| `st_oven` | Bake Oven | Печь | 3 слота | Выпечка, Десерты (выпечные), Южная кухня (cornbread) | канон (дек) |
| `st_churn` | Butter Churn | Маслобойка | 2 слота | полуфабрикаты (масло/сыр/крем), Десерты | канон (дек) |
| `st_soda` | Soda Fountain | Содовый фонтан | 3 слота | Напитки (шейки/содовая/малты) | канон (дек) |
| `st_ice_cream` | Ice Cream Maker | Мороженица | 2 слота | Десерты, полуфабрикат «Пломбир» | канон (дек) |
| `st_coffee` | Coffee Machine | Кофемашина | 2 слота | Напитки (кофе) | канон (дек) |
| `st_fryer` | Fryer | Фритюрница | 2 слота | Южная кухня (fried chicken, hushpuppies), Морская кухня (fried shrimp, fish&chips) | **нейминг-кандидат** |
| `st_smoker` | Smoker | Коптильня | 1 слот, долгий цикл | Южная кухня (brisket, ribs, ham) | **нейминг-кандидат** |
| `st_prep` | Prep Counter | Стол сборки | 4 слота, без нагрева | Сэндвичи (холодная сборка), Морская кухня (lobster roll, crab salad), полуфабрикаты (соленья/коулслоу) | **нейминг-кандидат** |
| `st_stockpot` | Stockpot | Кастрюля | 2 слота, долгий цикл | Южная кухня (gumbo/jambalaya), Морская кухня (chowder/bisque), соусы | **нейминг-кандидат** |

### 3.2 Тиры и цепочки

Тир блюда = максимальный тир среди его ингредиентов (включая полуфабрикаты, которые наследуют тир своего старшего компонента). Цепочки («мука → тесто → корж → пай» из дека) реализованы как **полуфабрикаты (semi-products)** — отдельные крафт-рецепты с собственным станком/временем, которые не выходят на Demand Board как отдельная категория спроса, но занимают слот станка и склад. Полный список — §4.1.

Пять базовых сырых ингредиентов на тир — это «хайлайт» из канона §2.2; для покрытия 112 блюд эта спека **добавляет доп. сырьё** сверх канонных хайлайтов (Лимон, Лук, Огурец, Курица, Пекан, Сом и др.) — помечено `(гипотеза, доп. к канону)`; финальный список сырья закрывает спека фермы/производства.

> **Исключение по времени (T3, зафиксировано):** несколько быстрых T3-блюд (тосты, кофе, малты — №10, №53, №54, №55, №91) физически готовятся быстрее нижней границы полосы ±40% вокруг T3-стандарта (45 мин → пол 27 мин), потому что реальное время заварки кофе/сборки тоста не масштабируется линейно с тиром ингредиента. Решение: время оставлено как есть (не растягивается искусственно), а цена срезана пропорционально для сохранения паритета `$/мин` T3-стандарта (`$75/45мин ≈ $1.67/мин`) — эти пять строк помечены `(искл. по времени)` в таблице §4.2 и не считаются нарушением полосы.

### 3.3 Mastery ★ (`mech_mastery`)

Каждый Recipe Card независимо копит счётчик «готовили N раз». Пороги дают бонусы к **времени** (−) и **цене** (+), без изменения размера партии (тираж не растёт — верно канону «эффективность, не тираж»).

| Уровень | Порог (готовок) | Бонус ко времени | Бонус к цене | Визуальный эффект карточки |
|---|---|---|---|---|
| ★☆☆☆☆ (база) | 0–9 | 0% | 0% | обычная рамка |
| ★★☆☆☆ | 10 | −5% | +5% | бронзовая рамка |
| ★★★☆☆ | 30 | −10% | +10% | серебряная рамка, тег «Local Favorite» |
| ★★★★☆ | 75 | −15% | +18% | золотая рамка |
| ★★★★★ | 150 | −20% | +25% | «Legendary Plate» рамка + подпись «впервые — [дата]», доступна печать на неон-вывеску (см. `ui_neon_builder`) |

> **Источник истины (R18).** Эта таблица — единственный канонический источник шкалы mastery (пороги готовок, %-бонусы ко времени/цене, визуальные тиры ★1–★5). Любой другой док (в т.ч. `10-server-event.md` для расчёта вклада в Appetite Meter) обязан ссылаться сюда, а не заводить собственные числа.

Пример из дека сохранён как канон-иллюстрация, но пересчитан по таблице выше: Cherry Pie à la Mode, ★★★☆☆ (34 готовки — порог ★3 при 30 готовках уже пройден, счётчик копит прогресс к ★4 при 75), база $75, бонус ★3 к цене +10% → фактическая цена **$82.50** (округляется до **$83** для отображения). Прежняя формулировка «$92, между ★2 и ★3» была арифметически неверна (30 < 34, значит ★3 уже достигнут, а +10% от $75 даёт $82.50, не $92) — исправлено во всех местах, включая каталог №21 (§4.2).

### 3.4 Способы открытия рецептов

| Способ | Логика | Доля каталога (гипотеза) |
|---|---|---|
| **Уровень кухни** | Рецепт привязан к уровню здания `bld_kitchen` (1–20, гипотеза); открывается автоматически с нотификацией Nana Opal. | ~45% (50 блюд) |
| **Штат экспедиции** | Рецепт требует ингредиент/тему открытого штата (`st_illinois`…`st_california`); открывается в момент первой доставки хайлайт-продукта штата грузовиком. | ~35% (40 блюд) |
| **Эксперимент (секретка)** | Найден через `mech_experiment` — см. §3.5 и §4.5 (22 рецепта). | 20 (уже посчитаны в 22 секретных, из них 18 входят в основной каталог 112, 4 — эксклюзивно только через эксперимент сверх каталога, см. §4.5 сноску) |
| **Mail Catalog (Каталог почтой)** | Рецепт открывается разовой покупкой редкого набора ингредиентов через `mech_mail_catalog` (см. `08-mail-foraging.md`) — типично премиум-микс сырья нескольких штатов сразу, без ожидания собственной экспедиции. | ~4.5% (5 блюд: #11, #27, #45, #58, #72) |
| **Ивент/конкурс/NPC** | Награда ивента (`ev_*`), приз конкурса (`ct_*`) или подарок Nana Opal за веху менторства. | точечно, отмечено в таблице каталога отдельными строками (не считается отдельным % — пересекается с выше). |

> Покрытие методов открытия сведено ко всем 112 (116 с уникальными секретками) карточкам каталога: Уровень кухни + Штат + Эксперимент + Mail Catalog + точечные ивент/конкурс/NPC-награды в сумме перекрывают 100% Recipe Box.

### 3.5 Эксперименты (`mech_experiment`, нейминг-кандидат)

Раз в игровые сутки (сброс в 00:00 UTC вместе с ролловером дня) игрок открывает вкладку **Experiment (Эксперимент)** внутри `ui_recipe_box` и может:

1. Выбрать станок из разблокированных.
2. Выбрать 2–4 ингредиента из своего склада (можно нестандартные — то, что обычно не входит в рецепты этого станка).
3. Нажать «Попробовать» — станок тратит ингредиенты и время (фиксированное `15 мин (гипотеза)`, независимо от тира — эксперимент всегда быстрый, чтобы не наказывать).

Результат определяется скрытой таблицей соответствий (см. §4.5): если комбинация совпадает (по составу, без строгого порядка) с рецептом секретки — блюдо открывается сразу и добавляется в Recipe Box со спецрамкой «Discovered by [игрок]» (только для первого игрока города — почётный тег, не эксклюзив владения). Если нет — игрок получает **подсказку-рифму** от Nana Opal («что-то сладкое просится к беконному дыму...») и ингредиенты не пропадают зря: неудачный эксперимент производит блюдо-заглушку **Kitchen Sink Special (Что бог послал)** — T1, съедобное, продаётся по базовой T1-цене, чтобы попытка не ощущалась как потеря (принцип «провала нет», P3).

Подсказки постепенно раскрываются в **Rumor Board (Доска слухов, нейминг-кандидат)** — общегородском канале, куда система публикует анонимизированные подсказки по секреткам, ещё не найденным никем в городе (социальный эффект: город коллективно разгадывает рецепт).

### 3.6 Blue Plate Special (`mech_blue_plate`, «Сет дня»)

Сет = Main (главное блюдо) + Side (гарнир) + Drink (напиток), собранные в **Fair Stall (`ui_fair_stall`)** или на Counter Shift (`ui_shift`) как единый лот. Бонус сета: `+18% (гипотеза)` к сумме цен компонентов при подаче как сет, растёт до `+25%` при mastery ★3+ у всех трёх компонентов одновременно («синергия трёх звёзд»). Сеты не обязаны быть одного тира — **единое правило (закрывает конфликт с §4.4): тир сета = тир Main-компонента** (закреплено во всех 34 примерах §4.4), бонус % считается от фактической суммы цен компонентов (с учётом mastery каждого).

Ограничение: чтобы засчитаться сетом на Demand Board (не просто три блюда рядом), все три слота подноса должны быть заполнены строго по рецепту сета (см. таблицу §4.4) — это и есть «комбинаторика планирования» из дека.

### 3.7 Деревья блюд (upgrade-цепочки)

Как в деке: `Toast → Sandwich → Club`, `Burger → Cheeseburger → Deluxe Burger`, `Apple Pie → Cherry Pie → à la Mode`, `Shake → Malt → Banana Split`. Технически дерево — это цепочка рецептов, где рецепт N+1 **обычно** требует готовое блюдо N как один из ингредиентов, так что апгрейд физически «кладёт тост в сэндвич». **Единое правило крафта (закрывает конфликт с R6, §7):** прямой крафт финального блюда дерева из сырых ингредиентов промежуточных стадий **разрешён**, если рецепт уже открыт по уровню/штату — игроку не обязательно иметь на руках готовое блюдо N. Но прямой крафт **не наследует mastery-прогресс** промежуточного блюда: счётчик готовок и ★-бонусы копятся отдельно для промежуточного (N) и финального (N+1) Recipe Card независимо, даже если N+1 приготовлен «в обход» N. Это делает путь «сначала прокачать Toast, потом собирать Club» осмысленным выбором (быстрее и дешевле в перспективе), а не обязательным требованием. Полный список деревьев — см. пометку `[树N]` в таблице §4.2.

### 3.8 Партии и склад

Один запуск станка = 1 порция блюда (партия ×1 baseline); стафф `staff_marty` (Grill Master Marty) даёт +1 к размеру партии гриля (см. канон §3.2) — общее правило: партия растёт только через стафф/know-how, не через сам рецепт. Готовые блюда хранятся в Larder (Кладовая, часть `bld_icehouse`/`bld_silo` в зависимости от скоропортящести — скоропорт (морская кухня, молочка) в Icehouse, сухое/выпечка в Silo).

---

## 4. Данные и формулы

### 4.1 Полуфабрикаты (semi-products) — 18 шт.

| # | EN | RU | Станок | Из чего | Время | Тир |
|---|---|---|---|---|---|---|
| S1 | Dough | Тесто | Bake Oven | Wheat×2, Egg×1 | 5 мин | T1 |
| S2 | Bread | Хлеб | Bake Oven | Dough×1 | 8 мин | T1 |
| S3 | Whipped Cream | Взбитые сливки | Butter Churn | Milk×2 | 10 мин | T2 (ре-тир: молоко — T2 по канону §2.2, было ошибочно T1) |
| S4 | Pickles | Соленья | Prep Counter | Cucumber×3 (доп. ингредиент, гипотеза) | 15 мин | T1 |
| S5 | Coleslaw | Коулслоу | Prep Counter | Lettuce×2, Milk×1 | 10 мин | T2 (ре-тир: молоко — T2, было ошибочно T1) |
| S6 | Cocktail Sauce | Коктейльный соус | Prep Counter | Tomato×2 | 8 мин | T1 |
| S7 | Butter | Масло | Butter Churn | Milk×3 | 10 мин | T2 |
| S8 | Cheese | Сыр | Butter Churn | Milk×4 | 20 мин | T2 |
| S9 | Pie Crust | Корж | Bake Oven | Dough×1, Butter×1 | 10 мин | T2 |
| S10 | Vanilla Custard («Пломбир») | Ванильный пломбир | Ice Cream Maker | Milk×3, Vanilla Essence×1 (ранний заменитель Vanilla Bean, см. сноску) | 15 мин | T2 |
| S11 | Biscuit | Бисквит (южный) | Bake Oven | Wheat×2, Butter×1 | 8 мин | T2 |
| S12 | Cornbread | Кукурузный хлеб | Bake Oven | Corn×2, Egg×1 | 12 мин | T2 |
| S13 | Gravy | Соус гарви | Stockpot | Milk×1, Bacon×1 | 10 мин | T2 |
| S14 | Hushpuppy Batter | Тесто хашпаппи | Prep Counter | Corn×2, Egg×1 | 10 мин | T2 |
| S15 | Pastry Cream | Кондитерский крем | Butter Churn | Milk×3, Egg×2 | 15 мин | T2 |
| S16 | BBQ Sauce | Соус барбекю | Stockpot | Tomato×2, Honey×1 | 15 мин | T3 |
| S17 | Roux | Ру (основа гамбо) | Stockpot | Wheat×1, Butter×1 | 15 мин | T2 (ре-тир: §3.2 — макс. тир ингредиента Butter=T2, было ошибочно T3) |
| S18 | Caramel Sauce | Карамель | Butter Churn | Honey×2, Butter×1 | 12 мин | T3 |

> Доп. сырьё сверх канонных хайлайтов §2.2 (гипотеза, требует утверждения в 00-canon §3): `Lemon/Лимон`, `Onion/Лук`, `Cucumber/Огурец` (T1); `Chicken/Курица` (T2); `Pecan/Пекан`, `Catfish/Сом` (T3, шт. Tennessee); `Cajun Spice/Каджун-специи`, `Crawfish/Раки Луизианы`, `Brisket Cut/Бришкет Техаса` (T4); `California Citrus/Калифорнийский цитрус` (T5).
>
> **Vanilla Essence / Ванильная эссенция** (T1, гипотеза-заменитель, доступна с самого начала — по прецеденту существующих ранних заменителей мёда/кофе/яблок, см. №33/№52/№88): решает критическую проблему достижимости — канонная `Vanilla Bean` (`California`, T5, §2.2) физически недостижима на момент открытия первого рецепта мороженицы (Kitchen ур.2, №61). `S10 Vanilla Custard` и все ~15 зависящих блюд T1–T4 (№21, №26, №61, №63, №66, №67, №69, №70, №72, №73 и др.) готовятся на `Vanilla Essence` без ожидания экспедиции в Калифорнию. После открытия `st_california` игрок может варить премиум-версию `S10` на настоящей `Vanilla Bean` (косметический тег «Real Vanilla», без отдельного экономического бонуса — опционально для флейвора); рецепты №30/№60/№74 остаются полностью привязаны к канонной `Vanilla Bean` (шт:California) как заявлено — это законные T5-блюда позднего доступа, не затронуты фиксом.

### 4.2 Каталог блюд — 112 рецептов

Легенда столбца «Открытие»: `Ур.N` = уровень кухни; `шт:X` = штат экспедиции; `🔒Sec.N` = секретный рецепт-эксперимент (см. §4.5, номер ссылается на таблицу); `ev:X` / `ct:X` = награда ивента/конкурса; `[древоN]` = место в дереве блюд §3.7.

#### Завтраки (Breakfasts) — 12

| # | EN | RU | Тир | Станок | Ингредиенты | Время | Цена $ | Открытие |
|---|---|---|---|---|---|---|---|---|
| 1 | Toast | Тост | T1 | Grill | Bread×1 | 3 мин | 5 | Ур.1 `[древо1: →Sandwich→Club]` |
| 2 | Farm Scramble | Фермерская яичница | T1 | Grill | Egg×3 | 5 мин | 6 | Ур.1, стартовый рецепт Nana Opal |
| 3 | Home Lemonade | Домашний лимонад | T1 | Prep Counter | Lemon×3 | 4 мин | 6 | Ур.1; ностальгия-бонус ×2 к цене на поздней игре (см. канон E9) |
| 4 | Country Ham & Eggs | Ветчина с яйцами | T2 | Grill | Egg×2, Bacon×2 | 10 мин | 18 | Ур.3 |
| 5 | Buttermilk Pancakes | Блинчики на пахте | T2 | Grill | Wheat×2, Milk×1, Egg×1 | 12 мин | 16 | Ур.4 |
| 6 | Strawberry Waffles | Вафли с клубникой | T2 | Grill | Wheat×2, Egg×1, Strawberry×2 | 15 мин | 24 | Ур.5 |
| 7 | Bacon Grilled Cheese | Гриль-сэндвич с беконом и сыром | T2 | Grill | Bread×1, Cheese×1, Bacon×1 | 12 мин | 22 | Ур.5 |
| 8 | Sunrise Skillet | Сковородка на рассвете | T3 | Grill | Potato×2, Egg×2, Bacon×1 | 35 мин | 65 | Ур.7 |
| 9 | Cherry Blintz | Вишнёвый блинчик | T3 | Bake Oven | Cherry×3, Dough×1, Cheese×1 | 40 мин | 70 | Ур.7 |
| 10 | Honey-Pecan Toast | Тост с мёдом и пеканом | T3 (искл. по времени — см. §3.2 сноску о быстрых блюдах) | Grill | Bread×1, Honey×1, Pecan×2 | 15 мин | 25 | шт:Tennessee |
| 11 | Maple Waffles | Вафли с кленовым сиропом | T4 | Grill | Wheat×2, Egg×1, Maple Syrup×1 | 90 мин | 190 | Mail Catalog (Каталог почтой), эпизодически |
| 12 | Peach Morning Cobbler | Утренний персиковый коблер | T4 | Bake Oven | Georgia Peach×3, Dough×1, Butter×1 | 100 мин | 220 | шт:Georgia |

#### Выпечка (Baking) — 18

| # | EN | RU | Тир | Станок | Ингредиенты | Время | Цена $ | Открытие |
|---|---|---|---|---|---|---|---|---|
| 13 | Dinner Roll | Булочка к обеду | T1 | Bake Oven | Dough×1 | 4 мин | 5 | Ур.1 |
| 14 | Sugar Cookie | Сахарное печенье | T1 | Bake Oven | Wheat×2, Egg×1 | 6 мин | 7 | Ур.2 |
| 15 | Corn Muffin | Кукурузный маффин | T1 | Bake Oven | Corn×1, Egg×1 | 5 мин | 6 | Ур.2 |
| 16 | Strawberry Shortcake | Клубничный шорткейк | T2 | Bake Oven | Dough×1, Strawberry×2, Whipped Cream×1 | 18 мин | 26 | Ур.4 |
| 17 | Buttermilk Biscuit Plate | Тарелка бисквитов | T2 | Bake Oven | Biscuit×2, Butter×1 | 12 мин | 20 | Ур.4 |
| 18 | Apple Pie | Яблочный пай | T2 | Bake Oven | Pie Crust×1, Potato×0 (Apple×3, доп. ингредиент, гипотеза) | 22 мин | 28 | Ур.5 `[древо2: →Cherry Pie→à la Mode]` |
| 19 | Corn Bread Loaf | Буханка кукурузного хлеба | T2 | Bake Oven | Cornbread×1, Butter×1 | 15 мин | 21 | Ур.5 |
| 20 | Cherry Pie | Вишнёвый пай | T3 | Bake Oven | Pie Crust×1, Cherry×6 | 45 мин | 75 | Ур.7 `[древо2]` |
| 21 | Cherry Pie à la Mode | Вишнёвый пай а-ля мод | T3 | Bake Oven | Cherry Pie×1, Vanilla Custard×1 | 50 мин | 83 (при ★3, +10%) / база 75 | Ур.8 `[древо2, финал]`, канон-иллюстрация дека (см. §3.3 пересчёт) |
| 22 | Pumpkin Pie | Тыквенный пай | T3 | Bake Oven | Pie Crust×1, Pumpkin×4, Pastry Cream×1 | 48 мин | 82 | Ур.8 |
| 23 | Honey Pecan Pie | Пекановый пай с мёдом | T3 | Bake Oven | Pie Crust×1, Pecan×5, Honey×2 | 55 мин | 88 | шт:Tennessee |
| 24 | Coffee Crumb Cake | Кофейный крамбл-кекс | T3 | Bake Oven | Dough×1, Coffee Bean×2, Butter×1 | 42 мин | 70 | Ур.9 |
| 25 | Georgia Peach Cobbler | Персиковый коблер Джорджии | T4 | Bake Oven | Georgia Peach×5, Pie Crust×1 | 110 мин | 240 | шт:Georgia |
| 26 | Peach Melba Tart | Тарт «Пич Мельба» | T4 | Bake Oven | Georgia Peach×3, Pastry Cream×1, Vanilla Custard×1 | 120 мин | 265 | шт:Georgia, Ур.12 |
| 27 | Maple Pecan Roll | Рулет с кленовым сиропом и пеканом | T4 | Bake Oven | Maple Syrup×2, Pecan×3, Dough×1 | 100 мин | 210 | Mail Catalog |
| 28 | Truffle Butter Croissant | Круассан с трюфельным маслом | T5 | Bake Oven | Dough×2, Butter×1, Truffle×1 | 260 мин | 780 | шт:California, Ур.16 |
| 29 | Lobster Pot Pie | Пай с лобстером | T5 | Bake Oven | Pie Crust×1, Maine Lobster×2, Butter×1 | 280 мин | 850 | шт:Maine |
| 30 | Vanilla Bean Layer Cake | Слоёный торт с ванилью | T5 | Bake Oven | Dough×2, Vanilla Bean×2, Pastry Cream×2 | 240 мин | 720 | шт:California |

#### Гриль (Grill) — 16

| # | EN | RU | Тир | Станок | Ингредиенты | Время | Цена $ | Открытие |
|---|---|---|---|---|---|---|---|---|
| 31 | Grilled Corn | Кукуруза на гриле | T1 | Grill | Corn×2 | 4 мин | 5 | Ур.1 |
| 32 | Veggie Skewer | Овощной шашлык | T1 | Grill | Tomato×2, Onion×1 | 5 мин | 6 | Ур.2 |
| 33 | Classic Burger | Классический бургер | T2 | Grill | Bread×1, Bacon×0 (Beef×1 — доступен с T3, см.№35; здесь фарш свино-говяжий доступен раньше через Bacon×2) | 15 мин | 20 | Ур.4 `[древо3: →Cheeseburger→Deluxe]` |
| 34 | Corn Dog | Кукурузный хот-дог | T2 | Grill | Hushpuppy Batter×1, Bacon×1 | 12 мин | 18 | Ур.4 |
| 35 | Bacon Cheeseburger | Бекон-чизбургер | T2 | Grill | Classic Burger×1, Cheese×1, Bacon×1 | 18 мин | 30 | Ур.5 `[древо3]` |
| 36 | Strawberry Glazed Ham | Ветчина в клубничной глазури | T2 | Grill | Bacon×3, Strawberry×2 | 20 мин | 26 | Ур.5 |
| 37 | County Beef Burger | Бургер из говядины округа | T3 | Grill | Bread×1, Beef×2 | 35 мин | 68 | Ур.7 |
| 38 | Deluxe Burger | Делюкс-бургер | T3 | Grill | Bacon Cheeseburger×1, Beef×1, Pickles×1 | 45 мин | 90 | Ур.8 `[древо3, финал]` |
| 39 | Grilled Beef Steak | Стейк на гриле | T3 | Grill | Beef×3 | 50 мин | 85 | Ур.9 |
| 40 | Honey BBQ Ribs (мини) | Мини-рёбрышки в мёде и барбекю | T3 | Grill | Beef×2, BBQ Sauce×1, Honey×1 | 55 мин | 80 | шт:Tennessee |
| 41 | Chicago Deep-Dish Sausage Melt | Чикагский колбасный мелт | T3 | Grill | Bread×1, Cheese×2, Bacon×2 | 40 мин | 72 | шт:Illinois |
| 42 | Peach-Glazed Pork Chop | Свиная отбивная в персиковой глазури | T4 | Grill | Bacon×3, Georgia Peach×2 | 100 мин | 210 | шт:Georgia |
| 43 | Texas Smoked Brisket Plate | Тарелка техасского бришкета | T4 | Smoker | Brisket Cut×3, BBQ Sauce×1 | 150 мин | 300 | шт:Texas |
| 44 | Cajun Grilled Shrimp Skewer | Каджун-шашлык из креветок | T4 | Grill | Gulf Shrimp×3, Cajun Spice×1 | 90 мин | 230 | шт:Louisiana |
| 45 | Maple Bacon Burger | Бургер с кленовым беконом | T4 | Grill | Deluxe Burger×1, Maple Syrup×1, Bacon×2 | 130 мин | 270 | Mail Catalog, Ур.14 |
| 46 | Legends Lobster Steak | Стейк-лобстер «Легенды» | T5 | Grill | Maine Lobster×2, Truffle×1, Butter×1 | 300 мин | 900 | шт:Maine, Ур.18 |

#### Напитки (Beverages) — 14

| # | EN | RU | Тир | Станок | Ингредиенты | Время | Цена $ | Открытие |
|---|---|---|---|---|---|---|---|---|
| 47 | Sweet Tea | Сладкий чай | T1 | Soda Fountain | Lemon×1, Honey×0 (Wheat×1 как «травяной чай», гипотеза) | 3 мин | 4 | Ур.1 |
| 48 | Cream Soda | Крем-содовая | T2 (ре-тир: молоко — T2, было ошибочно T1) | Soda Fountain | Milk×1 | 10 мин | 14 | Ур.2 |
| 49 | Fresh Lemonade Float | Лимонадный флоат | T2 (ре-тир: Whipped Cream теперь T2 — см. S3) | Soda Fountain | Home Lemonade×1, Whipped Cream×1 | 10 мин | 15 | Ур.2 `[древо4-подветка]` |
| 50 | Classic Milkshake | Классический молочный коктейль | T2 | Soda Fountain | Milk×3, Strawberry×1 | 12 мин | 20 | Ур.4 `[древо4: →Malt→Banana Split]` |
| 51 | Chocolate Soda | Шоколадная содовая | T2 | Soda Fountain | Milk×2, Honey×0 (Cocoa×1, доп. ингредиент, гипотеза T2) | 10 мин | 18 | Ур.4 |
| 52 | Farmhouse Coffee | Домашний кофе | T2 | Coffee Machine | Coffee Bean×0 (доступен позже, здесь цикорий-заменитель — Wheat×2, гипотеза раннего «кофе») | 10 мин | 14 | Ур.3 |
| 53 | Strawberry Malt | Клубничный малт | T3 (искл. по времени — см. §3.2 сноску) | Soda Fountain | Classic Milkshake×1, Strawberry×2 | 25 мин | 42 | Ур.7 `[древо4]` |
| 54 | Southern Coffee | Южный кофе | T3 (искл. по времени — см. §3.2 сноску) | Coffee Machine | Coffee Bean×2 | 20 мин | 33 | Ур.7 |
| 55 | Honey Cream Coffee | Кофе со сливками и мёдом | T3 (искл. по времени — см. §3.2 сноску) | Coffee Machine | Coffee Bean×2, Honey×1, Whipped Cream×1 | 25 мин | 42 | шт:Tennessee |
| 56 | Pumpkin Spice Shake | Тыквенно-пряный шейк | T3 | Soda Fountain | Milk×3, Pumpkin×2 | 30 мин | 60 | Ур.8, сезонный (Harvest Homecoming) |
| 57 | Peach Sweet Tea | Персиковый сладкий чай | T4 | Soda Fountain | Georgia Peach×2, Lemon×2 | 80 мин | 165 | шт:Georgia |
| 58 | Maple Coffee Malt | Кленовый кофейный малт | T4 | Soda Fountain | Strawberry Malt×1, Maple Syrup×1, Coffee Bean×1 | 100 мин | 200 | Mail Catalog |
| 59 | Banana Split (напиток-десерт гибрид, см. также №75) | Банана-сплит | T3 (ре-тир: макс. тир ингредиента Strawberry Malt/Caramel Sauce=T3, было ошибочно T4) | Soda Fountain | Strawberry Malt×1, Vanilla Custard×1, Caramel Sauce×1 | 55 мин | 95 | Ур.10 `[древо4, финал]` |
| 60 | California Citrus Cooler | Калифорнийский цитрусовый кулер | T5 | Soda Fountain | California Citrus×3, Vanilla Bean×1 | 240 мин | 560 | шт:California |

#### Десерты (Desserts) — 14

| # | EN | RU | Тир | Станок | Ингредиенты | Время | Цена $ | Открытие |
|---|---|---|---|---|---|---|---|---|
| 61 | Vanilla Scoop | Шарик пломбира | T2 (ре-тир: §3.2 — тир из Vanilla Custard T2, было ошибочно T1) | Ice Cream Maker | Vanilla Custard×1 | 8 мин | 14 | Ур.2 |
| 62 | Honey Cookie | Медовое печенье | T1 | Bake Oven | Wheat×2, Honey×0 (доступен позже, здесь заменитель Corn×1 сироп, гипотеза) | 6 мин | 6 | Ур.2 |
| 63 | Strawberry Sundae | Клубничный санди | T2 | Ice Cream Maker | Vanilla Custard×1, Strawberry×2, Whipped Cream×1 | 15 мин | 24 | Ур.4 |
| 64 | Buttermilk Pudding | Пудинг на пахте | T2 | Butter Churn | Milk×3, Pastry Cream×1 | 18 мин | 22 | Ур.5 |
| 65 | Caramel Apple | Карамельное яблоко | T2 | Butter Churn | Apple×2 (доп., гипотеза), Caramel Sauce×0 (доступен T3, тут медовая глазурь Honey×1 недоступна — заменить Butter×1) | 12 мин | 19 | Ур.5 |
| 66 | Cherry Cobbler Sundae | Санди с вишнёвым коблером | T3 | Ice Cream Maker | Cherry Pie×1, Vanilla Custard×1 | 40 мин | 78 | Ур.8 |
| 67 | Pumpkin Ice Cream | Тыквенное мороженое | T3 | Ice Cream Maker | Pumpkin×3, Vanilla Custard×1 | 45 мин | 74 | Ур.8, сезонный |
| 68 | Pecan Praline | Пекановая пралине | T3 | Butter Churn | Pecan×4, Caramel Sauce×1 | 35 мин | 68 | шт:Tennessee |
| 69 | Honey Pecan Ice Cream | Мёдово-пекановое мороженое | T3 | Ice Cream Maker | Pecan×3, Honey×2, Vanilla Custard×1 | 48 мин | 80 | шт:Tennessee |
| 70 | Georgia Peach Ice Cream | Персиковое мороженое Джорджии | T4 | Ice Cream Maker | Georgia Peach×4, Vanilla Custard×1 | 95 мин | 200 | шт:Georgia |
| 71 | Praline Bread Pudding | Пекановый брэд-пудинг | T3 (ре-тир: макс. тир ингредиента Pecan/Caramel Sauce=T3, было ошибочно T4) | Bake Oven | Bread×2, Pecan×3, Caramel Sauce×1 | 60 мин | 105 | шт:Tennessee, Ур.9 |
| 72 | Maple Pecan Sundae | Санди с кленовым сиропом и пеканом | T4 | Ice Cream Maker | Vanilla Custard×2, Maple Syrup×1, Pecan×3 | 100 мин | 210 | Mail Catalog |
| 73 | Truffle Honey Gelato | Трюфельно-медовое джелато | T5 | Ice Cream Maker | Truffle×1, Honey×2, Vanilla Custard×2 | 250 мин | 620 | шт:California, Ур.17 |
| 74 | Vanilla Citrus Panna Cotta | Ванильно-цитрусовая панна-котта | T5 | Butter Churn | Vanilla Bean×2, California Citrus×2, Pastry Cream×1 | 230 мин | 590 | шт:California |

> Примечание: №59 (Banana Split) числится в Напитках как гибрид напиток-десерт согласно деку («шейк → малт → банана-сплит») — категория спроса для Demand Board помечена двойным тегом `Напитки/Десерты`, засчитывается в обе (пояснение в Открытых вопросах).

#### Сэндвичи (Sandwiches) — 12

| # | EN | RU | Тир | Станок | Ингредиенты | Время | Цена $ | Открытие |
|---|---|---|---|---|---|---|---|---|
| 75 | Egg Salad Sandwich | Сэндвич с яичным салатом | T1 | Prep Counter | Bread×2, Egg×2 | 6 мин | 7 | Ур.2 |
| 76 | Tomato & Lettuce Sandwich | Сэндвич с томатом и салатом | T1 | Prep Counter | Bread×2, Tomato×1, Lettuce×1 | 5 мин | 6 | Ур.1 |
| 77 | Grilled Cheese | Гриль-сэндвич с сыром | T2 | Grill | Bread×2, Cheese×1 | 10 мин | 16 | Ур.3 |
| 78 | BLT | БЛТ (бекон-салат-томат) | T2 | Prep Counter | Bread×2, Bacon×2, Lettuce×1, Tomato×1 | 12 мин | 22 | Ур.4 |
| 79 | Ham & Cheese Melt | Ветчинно-сырный мелт | T2 | Grill | Bread×2, Bacon×2, Cheese×1 | 15 мин | 24 | Ур.5 |
| 80 | Club Sandwich | Клаб-сэндвич | T2 | Prep Counter | Toast×2, Bacon×1, Egg×1, Tomato×1 | 18 мин | 28 | Ур.5 `[древо1, финал]` |
| 81 | Patty Melt | Пэтти-мелт | T3 | Grill | Bread×2, County Beef Burger×1, Cheese×1 | 40 мин | 72 | Ур.8 |
| 82 | Beef Dip Sandwich | Сэндвич с говяжьим дипом | T3 | Grill | Bread×2, Beef×2, Gravy×1 | 45 мин | 76 | Ур.8 |
| 83 | Southern Pimento Cheese Sandwich | Сэндвич с пимento-сыром | T3 | Prep Counter | Bread×2, Cheese×2, Tomato×1 | 30 мин | 62 | шт:Tennessee |
| 84 | Cajun Chicken Sandwich | Каджун-сэндвич с курицей | T4 | Grill | Bread×2, Chicken×2, Cajun Spice×1 | 90 мин | 195 | шт:Louisiana |
| 85 | Brisket Sandwich | Сэндвич с бришкетом | T4 | Smoker | Bread×2, Brisket Cut×2, BBQ Sauce×1 | 140 мин | 280 | шт:Texas |
| 86 | Lobster Roll | Лобстер-ролл | T5 | Prep Counter | Bread×2, Maine Lobster×2, Butter×1 | 220 мин | 540 | шт:Maine, Ур.16 |

#### Южная кухня (Southern Cuisine) — 14

| # | EN | RU | Тир | Станок | Ингредиенты | Время | Цена $ | Открытие |
|---|---|---|---|---|---|---|---|---|
| 87 | Buttermilk Biscuits & Gravy | Бисквиты с гарви | T2 | Prep Counter | Biscuit×2, Gravy×1 | 10 мин | 19 | Ур.4 |
| 88 | Cornbread & Honey | Кукурузный хлеб с мёдом | T2 | Bake Oven | Cornbread×1, Honey×0 (Corn×1 сироп-заменитель до открытия мёда, гипотеза) | 12 мин | 20 | Ур.4 |
| 89 | Fried Green Tomatoes | Жареные зелёные томаты | T3 | Fryer | Tomato×4, Hushpuppy Batter×1 | 35 мин | 65 | Ур.7 |
| 90 | Southern Fried Chicken | Жареная курица по-южному | T3 | Fryer | Chicken×3 | 45 мин | 78 | Ур.8 |
| 91 | Hushpuppies Basket | Корзинка хашпаппи | T3 (искл. по времени — см. §3.2 сноску) | Fryer | Hushpuppy Batter×3 | 25 мин | 42 | Ур.7 |
| 92 | Catfish Fry Plate | Тарелка жареного сома | T3 | Fryer | Catfish×2, Hushpuppy Batter×1 | 40 мин | 70 | Ур.9 (местный сом округа) |
| 93 | Pecan-Crusted Chicken | Курица в пекановой панировке | T3 | Fryer | Chicken×2, Pecan×2 | 42 мин | 74 | шт:Tennessee |
| 94 | Nashville Hot Chicken | «Нэшвиллская» острая курица | T3 | Fryer | Chicken×3, BBQ Sauce×1 | 48 мин | 82 | шт:Tennessee |
| 95 | Chicago Beef Stew | Чикагское говяжье рагу | T3 | Stockpot | Beef×3, Potato×2 | 55 мин | 85 | шт:Illinois |
| 96 | Cajun Jambalaya | Каджун-джамбалайя | T4 | Stockpot | Chicken×2, Gulf Shrimp×2, Roux×1, Cajun Spice×1 | 110 мин | 250 | шт:Louisiana |
| 97 | Louisiana Gumbo | Гамбо Луизианы | T4 | Stockpot | Roux×1, Crawfish×2, Chicken×1, Cajun Spice×1 | 120 мин | 260 | шт:Louisiana |
| 98 | Texas Chili | Техасский чили | T4 | Stockpot | Brisket Cut×2, Tomato×3 | 100 мин | 220 | шт:Texas |
| 99 | Smoked BBQ Ribs Platter | Тарелка копчёных рёбрышек | T4 | Smoker | Brisket Cut×3, BBQ Sauce×2 | 160 мин | 310 | шт:Texas |
| 100 | Georgia Pecan Pie Plate Special | Тарелка «Джорджия»: курица + пекан + персик | T4 (ре-тир: макс. тир ингредиента Georgia Peach=T4, было ошибочно T5; цена приведена в полосу T4 $156–364) | Fryer | Chicken×2, Pecan×2, Georgia Peach×2 | 140 мин | 340 | шт:Georgia, Ур.13 |

#### Морская кухня (Seafood) — 12

| # | EN | RU | Тир | Станок | Ингредиенты | Время | Цена $ | Открытие |
|---|---|---|---|---|---|---|---|---|
| 101 | Catfish Bites | Кусочки сома в панировке | T2 | Fryer | Catfish×2 | 15 мин | 20 | Ур.5 (местный сом) |
| 102 | Corn & Catfish Chowder | Чаудер из сома с кукурузой | T3 | Stockpot | Catfish×2, Corn×2, Milk×1 | 45 мин | 76 | Ур.9 |
| 103 | County Fish Fry | Тарелка жареной рыбы округа | T3 | Fryer | Catfish×3, Hushpuppy Batter×1 | 40 мин | 72 | Ур.9 |
| 104 | Shrimp Gumbo Bowl | Миска гамбо с креветками | T4 | Stockpot | Gulf Shrimp×3, Roux×1, Cajun Spice×1 | 110 мин | 245 | шт:Louisiana |
| 105 | Fried Gulf Shrimp Basket | Корзинка жареных креветок Галфа | T4 | Fryer | Gulf Shrimp×4 | 90 мин | 210 | шт:Louisiana |
| 106 | Crawfish Boil | Отварные раки по-луизиански | T4 | Stockpot | Crawfish×5, Cajun Spice×1 | 100 мин | 225 | шт:Louisiana |
| 107 | Shrimp Po'Boy | По-бой с креветками | T4 | Prep Counter | Bread×2, Gulf Shrimp×3, Coleslaw×1 | 95 мин | 215 | шт:Louisiana |
| 108 | Crab Cake Duo | Дуэт крабовых котлет | T4 | Grill | Gulf Shrimp×2, Cheese×1, Bread×1 (крабозаменитель до открытия Мэна, гипотеза) | 105 мин | 230 | Ур.14 |
| 109 | Maine Lobster Bisque | Биск из лобстера Мэна | T5 | Stockpot | Maine Lobster×2, Butter×1, Milk×2 | 260 мин | 640 | шт:Maine |
| 110 | Fried Lobster Tail | Жареный хвост лобстера | T5 | Fryer | Maine Lobster×2, Hushpuppy Batter×1 | 240 мин | 610 | шт:Maine |
| 111 | Lobster Roll Deluxe | Лобстер-ролл делюкс | T5 | Prep Counter | Lobster Roll×1, Truffle×1, Butter×1 | 300 мин | 950 | шт:Maine, Ур.19 `[древо5, финал]` |
| 112 | Maine Clam & Truffle Chowder | Чаудер из моллюсков Мэна с трюфелем | T5 | Stockpot | Maine Lobster×1, Truffle×1, Milk×3 | 280 мин | 900 | шт:Maine, Ур.19 |

### 4.3 Категории спроса — сводка

| Категория (EN) | RU | Число блюд | Основные станки |
|---|---|---|---|
| Breakfasts | Завтраки | 12 | Grill, Bake Oven |
| Baking | Выпечка | 18 | Bake Oven |
| Grill | Гриль | 16 | Grill, Smoker |
| Beverages | Напитки | 14 | Soda Fountain, Coffee Machine |
| Desserts | Десерты | 14 | Ice Cream Maker, Butter Churn, Bake Oven |
| Sandwiches | Сэндвичи | 12 | Prep Counter, Grill |
| Southern Cuisine | Южная кухня | 14 | Fryer, Stockpot, Smoker |
| Seafood | Морская кухня | 12 | Fryer, Stockpot, Prep Counter |
| **Итого** | | **112** | |

### 4.4 Сеты Blue Plate Special — 34

Формат: `Main + Side + Drink`. Бонус — над суммой базовых цен компонентов (без учёта текущего mastery, который добавляется поверх отдельно). Тир сета = тир главного блюда.

| # | Название сета (EN) | RU | Тир | Main | Side | Drink | Бонус % |
|---|---|---|---|---|---|---|---|
| 1 | Morning Starter | Утренний старт | T1 | Farm Scramble (#2) | Toast (#1) | Home Lemonade (#3) | +15 |
| 2 | Griddle Classic | Классика с гриля | T2 | Buttermilk Pancakes (#5) | Country Ham & Eggs (#4) | Cream Soda (#48) | +16 |
| 3 | Diner Waffle Combo | Вафельный сет дайнера | T2 | Strawberry Waffles (#6) | Bacon Grilled Cheese (#7) | Classic Milkshake (#50) | +17 |
| 4 | Blue Plate Classic | Классический сет дня | T2 | Classic Burger (#33) | Corn Dog (#34) | Classic Milkshake (#50) | +18, каноничная иллюстрация «мясной сет + кофе» из дека (вариант с кофе — сет №5) |
| 5 | Diner Coffee Plate | Кофейная тарелка дайнера | T2 | Bacon Cheeseburger (#35) | Grilled Cheese (#77) | Farmhouse Coffee (#52) | +18 |
| 6 | County Harvest Plate | Тарелка урожая округа | T3 | County Beef Burger (#37) | Fried Green Tomatoes (#89) | Strawberry Malt (#53) | +19 |
| 7 | Deluxe Diner Set | Делюкс-сет дайнера | T3 | Deluxe Burger (#38) | Hushpuppies Basket (#91) | Southern Coffee (#54) | +20 |
| 8 | Cherry on Top | Вишенка на вершине | T3 | Cherry Pie à la Mode (#21) | Honey-Pecan Toast (#10) | Honey Cream Coffee (#55) | +20 |
| 9 | Pumpkin Harvest Combo | Тыквенный сет урожая | T3 | Pumpkin Pie (#22) | Pumpkin Ice Cream (#67) | Pumpkin Spice Shake (#56) | +22 (моно-тематический сет) |
| 10 | Nashville Sweet & Heat | Нэшвиллская «сладко-остро» | T3 | Nashville Hot Chicken (#94) | Honey Pecan Pie (#23) | Honey Cream Coffee (#55) | +21 |
| 11 | Pecan Praline Plate | Тарелка пекановой пралине | T3 | Pecan-Crusted Chicken (#93) | Pecan Praline (#68) | Southern Coffee (#54) | +20 |
| 12 | Catfish County Plate | Сомовая тарелка округа | T3 | County Fish Fry (#103) | Corn & Catfish Chowder (#102) | Sweet Tea (#47) | +19 |
| 13 | Chicago Stopover | Чикагская остановка | T3 | Chicago Deep-Dish Sausage Melt (#41) | Chicago Beef Stew (#95) | Farmhouse Coffee (#52) | +20 |
| 14 | Grill Master Combo | Комбо гриль-мастера | T3 | Grilled Beef Steak (#39) | Honey BBQ Ribs mini (#40) | Strawberry Malt (#53) | +21 |
| 15 | Patty Melt Plate | Тарелка пэтти-мелт | T3 | Patty Melt (#81) | Fried Green Tomatoes (#89) | Southern Coffee (#54) | +19 |
| 16 | Beef Dip Diner | Дайнер-дип из говядины | T3 | Beef Dip Sandwich (#82) | Sunrise Skillet (#8) | Honey Cream Coffee (#55) | +20 |
| 17 | Pimento Porch Plate | Пимento-тарелка на веранде | T3 | Southern Pimento Cheese Sandwich (#83) | Buttermilk Biscuits & Gravy (#87) | Sweet Tea (#47) | +18 |
| 18 | Georgia Peach Plate | Персиковая тарелка Джорджии | T4 | Peach-Glazed Pork Chop (#42) | Georgia Peach Cobbler (#25) | Peach Sweet Tea (#57) | +23, моно-тематический |
| 19 | Georgia Sunday Special | Джорджийский воскресный сет | T4 | Peach Melba Tart (#26) | Georgia Peach Ice Cream (#70) | Peach Sweet Tea (#57) | +24 |
| 20 | Texas Smokehouse Plate | Тарелка техасской коптильни | T4 | Texas Smoked Brisket Plate (#43) | Texas Chili (#98) | Maple Coffee Malt (#58) | +23 |
| 21 | Texas BBQ Feast | Пир техасского барбекю | T4 | Smoked BBQ Ribs Platter (#99) | Brisket Sandwich (#85) | Peach Sweet Tea (#57) | +24 |
| 22 | Bayou Boil Plate | Тарелка «Кипячение на байю» | T4 | Crawfish Boil (#106) | Louisiana Gumbo (#97) | Peach Sweet Tea (#57) | +25, моно-тематический (Луизиана) |
| 23 | Cajun Fisherman's Plate | Тарелка каджун-рыбака | T4 | Fried Gulf Shrimp Basket (#105) | Cajun Jambalaya (#96) | Maple Coffee Malt (#58) | +24 |
| 24 | Po'Boy Combo | Сет с по-боем | T4 | Shrimp Po'Boy (#107) | Shrimp Gumbo Bowl (#104) | Peach Sweet Tea (#57) | +23 |
| 25 | Cajun Chicken Plate | Тарелка каджун-курицы | T4 | Cajun Chicken Sandwich (#84) | Cajun Grilled Shrimp Skewer (#44) | Maple Coffee Malt (#58) | +22 |
| 26 | Maple Bacon Diner Set | Дайнер-сет с кленовым беконом | T4 | Maple Bacon Burger (#45) | Maple Waffles (#11) | Maple Coffee Malt (#58) | +25, моно-тематический (клён) |
| 27 | Crab & Corn Plate | Тарелка «краб и кукуруза» | T4 | Crab Cake Duo (#108) | Corn & Catfish Chowder (#102) | Peach Sweet Tea (#57) | +21 |
| 28 | Georgia Grand Plate | Большая тарелка Джорджии | T4 (ре-тир вслед за Main #100, см. §4.2) | Georgia Pecan Pie Plate Special (#100) | Praline Bread Pudding (#71) | California Citrus Cooler (#60) | +25 |
| 29 | Maine Lobster Feast | Пир лобстера Мэна | T5 | Legends Lobster Steak (#46) | Maine Lobster Bisque (#109) | California Citrus Cooler (#60) | +26, флагманский сет T5 |
| 30 | Lobster Roll Royale | Лобстер-ролл рояль | T5 | Lobster Roll Deluxe (#111) | Fried Lobster Tail (#110) | California Citrus Cooler (#60) | +26 |
| 31 | California Vanilla Dream | Калифорнийская ванильная мечта | T5 | Vanilla Bean Layer Cake (#30) | Truffle Honey Gelato (#73) | California Citrus Cooler (#60) | +25 |
| 32 | Truffle Indulgence Plate | Тарелка трюфельного наслаждения | T5 | Truffle Butter Croissant (#28) | Vanilla Citrus Panna Cotta (#74) | California Citrus Cooler (#60) | +25 |
| 33 | Chowder & Clam Feast | Пир из чаудера и моллюсков | T5 | Maine Clam & Truffle Chowder (#112) | Maine Lobster Bisque (#109) | California Citrus Cooler (#60) | +26 |
| 34 | Grand County Sampler (кросс-тирный) | Большой сет округа | T3 (микс тиров, гипотеза-исключение) | Deluxe Burger (#38, T3) | Corn Bread Loaf (#19, T2) | Strawberry Malt (#53, T3) | +17 (ниже нормы — штраф за смешение тиров, специально для «использовать остатки склада») |

### 4.5 Секретные рецепты-эксперименты — 22

Логика подбора: игрок кладёт в станок нестандартную комбинацию (см. столбец «Триггер-комбинация»); система сверяет состав без учёта порядка. Столбец «Подсказка Rumor Board» — публичная рифмованная наводка, которая появляется в городе после того, как в ЛЮБОМ городе сети рецепт открыт впервые глобально (все последующие города видят готовую подсказку сразу, первооткрыватели каждого отдельного города всё равно получают тег «Discovered by»).

| # | EN | RU | Тир | Станок | Триггер-комбинация | Итоговое блюдо (эффект) | Подсказка Rumor Board |
|---|---|---|---|---|---|---|---|
| Sec.1 | Bacon Shake | Шейк с беконом | T2 | Soda Fountain | Classic Milkshake база (Milk×3) + Bacon×1 вместо фрукта | Новый рецепт, цена ×1.3 к обычному милкшейку, тег «Weird but Good» | «сейчас хочу солёное в сладком» |
| Sec.2 | Pickle Lemonade | Лимонад с рассолом | T1 | Prep Counter | Home Lemonade база + Pickles×1 | Ностальгия-тег, цена ×1.5 к T1 базе | «что-то хрустит там, где не должно» |
| Sec.3 | Coffee-Glazed Bacon | Бекон в кофейной глазури | T3 | Grill | Bacon×3 + Coffee Bean×1 | Новое блюдо T3, цена как County-тир (#37 уровень) | «утро пахнет и сладко, и дымно» |
| Sec.4 | Cherry Cola Float | Вишнёво-колный флоат | T2 | Soda Fountain | Cream Soda база + Cherry×2 | Открывает сезонный тег «Diner Classic» | «красное в стакане, но не клубника» |
| Sec.5 | Honey Fried Chicken | Курица в медовой панировке | T3 | Fryer | Southern Fried Chicken база (Chicken×3) + Honey×1 | Замена рецепта на премиум-версию (+20% цена) | «сладкое ищет дорогу к жареному» |
| Sec.6 | Peach BBQ Ribs | Рёбрышки в персиковом барбекю | T4 | Smoker | Smoked BBQ Ribs Platter база + Georgia Peach×1 | Кросс-штатный секрет (Tennessee×Georgia) | «дым дружит с фруктовым садом» |
| Sec.7 | Maple Bacon Doughnut (полуфабрикат-дичь) | Пончик с кленовым беконом | T3 | Bake Oven | Dough×1 + Bacon×1 + Maple Syrup×1 | Уникальное блюдо, не входит в 112, доступно только через секретку | «утренняя сладость с хрустящим сюрпризом» |
| Sec.8 | Truffle Fries | Картофель фри с трюфелем | T5 | Fryer | Potato×4 (база фри, доп. рецепт) + Truffle×1 | Уникальное блюдо T5 из T1-сырья + T5-специи — «экономика неожиданности» | «дорогой запах над простой картошкой» |
| Sec.9 | Bacon Maple Ice Cream | Мороженое с беконом и кленовым сиропом | T4 | Ice Cream Maker | Vanilla Custard×2 + Bacon×1 + Maple Syrup×1 | Сеты Blue Plate дают ей бонус «Weird Diner» тег | «хрустит в холодном» |
| Sec.10 | Spicy Honey Lemonade | Острый медовый лимонад | T3 | Prep Counter | Home Lemonade база + Honey×1 + Cajun Spice×1 | Кросс-штатный (Home×Louisiana) | «жжётся там, где ждёшь прохладу» |
| Sec.11 | Cheese-Stuffed Cornbread | Кукурузный хлеб с сыром внутри | T2 | Bake Oven | Cornbread база + Cheese×1 | Улучшенная версия #88 (+15% цена) | «внутри хлеба прячется тягучее» |
| Sec.12 | Lobster Mac Bites | Лобстерные мак-биты | T5 | Fryer | Maine Lobster×1 + Cheese×2 + Bread×1 | Уникальное T5-блюдо | «панцирь встречает макарон» (нейминг «мак» — гипотеза доп. ингредиента макарон, T2) |
| Sec.13 | Crawfish Cornbread | Кукурузный хлеб с раками | T4 | Bake Oven | Cornbread база + Crawfish×2 | Кросс-штатный (Louisiana×Home) | «в тесте что-то шевелится (не буквально)» |
| Sec.14 | Blueberry... (заменено) — Chili Chocolate Soda | Шоколадная содовая с перцем | T3 | Soda Fountain | Chocolate Soda база + Cajun Spice×1 | Тег «Bold Diner», цена ×1.25 | «сладкое жалит на языке» |
| Sec.15 | Smoked Honey Butter | Копчёное медовое масло | T3 | Smoker | Butter×2 + Honey×1 (положено в коптильню вместо гриля/мяса) | Полуфабрикат-секрет, продлевает срок хранения выпечки (гипотеза-эффект) | «масло, побывавшее в дыму» |
| Sec.16 | Sweet Tea Fried Chicken | Курица, жаренная в сладком чае | T3 | Fryer | Southern Fried Chicken база + Sweet Tea×1 (как маринад) | Альтернативная премиум-версия (+18% цена) | «чай уходит не в чашку, а в кастрюлю» |
| Sec.17 | Truffle Grilled Cheese | Гриль-сэндвич с трюфелем | T5 | Grill | Grilled Cheese база (Bread×2, Cheese×1) + Truffle×1 | Экономика неожиданности: T1-блюдо → T5 версия | «простой сэндвич пахнет, как ресторан» |
| Sec.18 | Coffee BBQ Brisket | Бришкет в кофейном барбекю | T4 | Smoker | Texas Smoked Brisket Plate база + Coffee Bean×1 | Кросс-штатный (Texas×Home) | «дым встречает утреннюю чашку» |
| Sec.19 | Cornbread Ice Cream | Мороженое с кукурузным хлебом | T3 | Ice Cream Maker | Vanilla Custard×1 + Cornbread×1 (раскрошенный) | Уникальный текстурный секрет | «хруст там, где обычно гладко» |
| Sec.20 | Pecan Bacon Waffles | Вафли с пеканом и беконом | T3 | Grill | Buttermilk Pancakes база (замена на Wheat×2,Egg×1) + Pecan×2 + Bacon×1 | Улучшенный вариант #6, +22% цена | «хруст ореха там, где ждали только сироп» |
| Sec.21 | Ghost Pepper Gumbo | Гамбо с перцем-призраком | T5 | Stockpot | Louisiana Gumbo база + California Citrus×1 (цедра как контраст-специя) | Кросс-штатный (Louisiana×California), лимитированный ивент-тег | «жар юга встречает свежесть побережья» |
| Sec.22 | Kitchen Sink Special | Что бог послал | T1 | любой | любая неудачная комбинация эксперимента | Гарантированный fallback-результат неудачного эксперимента (не секрет по сути, утешительный рецепт) | не публикуется в Rumor Board — служебный результат |

> Из 22 секреток 18 (Sec.1–Sec.6, Sec.9–Sec.11, Sec.13–Sec.21) являются **улучшенными версиями или кросс-штатными вариациями** блюд из основного каталога §4.2 и не увеличивают число «112» отдельно. Sec.7, Sec.8, Sec.12, Sec.22 — уникальные блюда **сверх** каталога 112 (итого фактических Recipe Card в игре на MVP+v0.2 контент ≈116, что не противоречит вилке 90–130).

---

## 5. UI-точки

| Экран/элемент | Ключ канона | Что показывает |
|---|---|---|
| Коробка рецептов | `ui_recipe_box` | Грид карточек, фильтр по категории/тиру/станку/«не приготовлено», поиск. |
| Карточка рецепта | (часть `ui_recipe_box`) | Иконка блюда, тир-бейдж, станок-иконка, список ингредиентов с количествами (иконка+число), время, mastery-полоска ★, счётчик готовок, дата первой готовки, цена база/текущая. |
| Очередь станка | (экран кухни, `bld_kitchen`) | До 2–4 слотов, таймер обратного отсчёта на каждый, кнопка «повторить последнее». |
| Вкладка «Эксперимент» | (внутри `ui_recipe_box`, нейминг-кандидат `ui_experiment`) | Выбор станка → drag&drop ингредиентов из склада → кнопка «Попробовать» (1/день) → результат-модалка (открытие / подсказка + Kitchen Sink Special). |
| Rumor Board | нейминг-кандидат `ui_rumor_board` | Лента городских подсказок по ещё не найденным секреткам; клик по подсказке подсвечивает совместимый станок в `ui_recipe_box`. |
| Конструктор Blue Plate | нейминг-кандидат `ui_blue_plate_builder`, часть `ui_fair_stall`/`ui_shift` | Три слота (Main/Side/Drink), автоподсказка совместимых сетов из склада, индикатор бонуса % в реальном времени. |
| Плашка mastery на подносе смены | часть `ui_shift` | Показывает, что блюдо ушло гостю с текущим mastery-бонусом (визуальная искра ★ на подносе). |
| Дерево блюд | вкладка внутри `ui_recipe_box` (нейминг-кандидат `ui_recipe_tree`) | Визуальная цепочка апгрейдов (Toast→Sandwich→Club и т.д.) с подсветкой текущего прогресса. |

---

## 6. Зависимости от других систем

| Система | Файл спеки | Что нужно оттуда |
|---|---|---|
| Экономика/баланс | `docs/specs/14-economy.md` | Финальные цены/тайминги (эта спека даёт гипотезы по канон-таблице §2.2); синки Bucks. |
| Ферма/производство (грядки, животные, сырьё) | `docs/specs/02-farm.md`, `docs/specs/05-ingredients.md`, `docs/specs/03-animals.md` | Реальные тайминги роста сырья T1–T5, доп. сырьё сверх канонных хайлайтов (см. §4.1 сноску), лимиты грядок/стойл. |
| Постройки | `docs/specs/13-progression.md` (`bld_kitchen`, `bld_icehouse`, `bld_silo` — рамка уровней 1–10) | Уровни кухни → слоты станков и очередь; лимиты хранения готовых блюд. |
| Стафф | `docs/specs/13-progression.md` (`staff_bruno`, `staff_rosalind`, `staff_marty`) | Модификаторы: −10% время (Bruno), +1★ прирост mastery выпечки (Rosalind), +1 к партии гриля (Marty). |
| Know-How | `docs/specs/13-progression.md`, ветка `kh_cookery` | Разблокировка станков/слотов очереди сверх базовых, ускорение mastery-прироста. |
| Demand Board / рынок спроса | `docs/specs/14-economy.md` (`ui_demand_board`) | ±15–30% к категориям недели; перенасыщение категории — мягкое удешевление (canon E7); категории спроса §4.3 — прямой вход туда. |
| Экспедиции / штаты | `docs/specs/07-expeditions.md` (`st_illinois`…`st_california`) | Разблокировка ингредиентов и рецептов по штатам (столбец «Открытие» в §4.2). |
| Ярмарка / смена / прилавок | `docs/specs/09-fair.md` (`ui_fair_stall`, `ui_shift`) | Использование Blue Plate Special сетов, продажа блюд по спросу. |
| NPC / нарратив | `docs/specs/00-canon.md` §3.1 (`npc_nana_opal`) | Стартовый рецепт, нарративные карточки-награды, менторские подарки (отдельного нарратив-дока в File Map нет — реестр NPC живёт в каноне). |
| Co-op Orders / Potluck | `docs/specs/11-town.md` | Блюда/сеты как валюта заказа («20 пирогов, 40 бургеров»); использует те же Recipe ID. |
| Ивенты | `docs/specs/10-server-event.md` (`ev_glutton`, `ev_big_festival`) | Блюда как единицы «сытости» для Appetite Meter; секретки Sec.21 как лимитированный ивент-тег. |
| Косметика/неон | `docs/specs/19-ui-ux.md` (`ui_neon_builder`) | Разблокировка декора за mastery ★5 карточки (см. §3.3). |

---

## 7. Edge cases

| # | Ситуация | Поведение |
|---|---|---|
| R1 | Игрок начал готовить рецепт, ингредиенты кончились у соседа/на складе одновременно (гонка при кооп-заказе) | Резервирование ингредиентов происходит в момент постановки в очередь станка (клиент-серверная транзакция), а не в момент завершения — конфликтов «съели дважды» не бывает. |
| R2 | Секретный рецепт уже открыт другим игроком города, но не глобально | Тег «Discovered by» присваивается **первому игроку в своём городе**; подсказка Rumor Board появляется в конкретном городе только после локального открытия либо после глобального (в зависимости от того, что раньше — глобальный триггер даёт городу подсказку сразу, не открытие). |
| R3 | Неудачный эксперимент — жалко потраченных редких T5-ингредиентов | Эксперимент **разрешает** использовать сырьё вплоть до тира текущего максимального **открытого** станка **включительно** (не «минус 1») — иначе секретки, требующие T5-сырьё на T5-станках (Sec.8 Truffle Fries/Fryer, Sec.12 Lobster Mac Bites/Fryer, Sec.17 Truffle Grilled Cheese/Grill) были бы физически недостижимы. Защита от случайных потерь — не запрет тира, а: (а) лимит «1 попытка в сутки»; (б) обязательное явное подтверждение в UI при использовании ингредиента тира выше T3 («потратить Truffle×1?»); (в) неудача всегда даёт Kitchen Sink Special взамен, так что даже дорогой провал не ощущается полной потерей (P3). |
| R4 | Blue Plate сет собран, но один из трёх компонентов испортился/просрочен (для скоропорта морской кухни) | Скоропортящиеся компоненты (морская кухня, молочные десерты) в Icehouse не портятся полностью — теряют «свежесть»-бейдж и −10% к цене (гипотеза), но сет всё ещё можно собрать по факту наличия, не по факту свежести. |
| R5 | Игрок пропустил день и не забрал готовые блюда из очереди станка | Очередь не блокируется: готовые блюда копятся в буфере станка (до 2× размера очереди, гипотеза) и ждут; станок не начинает новую партию, пока буфер полон — мягкий саморегулируемый лимит вместо порчи. |
| R6 | Дерево блюд: игрок хочет приготовить Club Sandwich, но у него нет Toast в Recipe Box (не готовил ранее) | Система разрешает готовить финальное блюдо дерева напрямую из сырых ингредиентов промежуточных стадий за то же суммарное время — Toast не обязателен как отдельный шаг, если рецепт уже разблокирован по уровню. Единое правило с §3.7: прямой крафт не даёт mastery-прогресс промежуточного блюда (Toast) — только у самого приготовленного Recipe Card растёт счётчик. |
| R7 | Два игрока экспериментируют одновременно с одинаковой комбинацией на разных фермах | Оба получают результат независимо (эксперимент — не общий ресурс); глобальный «первооткрыватель» определяется по серверному таймстампу завершения эксперимента. |
| R8 | Секретка Sec.22 (Kitchen Sink Special) накапливается на складе бесполезным мусором | Kitchen Sink Special продаётся по базовой T1-цене как обычное блюдо на прилавке — не мусор, а низкоценный, но валидный товар; не занимает отдельный слот выше лимита T1-хранения. |
| R9 | Игрок пытается собрать Blue Plate сет из компонентов разного тира (напр. T1 Main + T5 Side) | Разрешено технически (см. сет #34 «Grand County Sampler» как пример), но бонус % штрафуется за смешение тиров — стимул держать сет однородным, без жёсткого запрета. |

---

## 8. Открытые вопросы

> Фаза B: критические/мажорные баги (Vanilla-достижимость, R3-кап секреток, конфликт §3.7/R6, молоко-тир, тир-правило S17/№71/№59/№100, T3-времена, mastery-пример §3.3, тир Blue Plate §3.6, битые ссылки K1) — **закрыты правками этого прохода**, см. соответствующие разделы. Ниже — вопросы, требующие решения **другой** спеки/канона, которые фиксы этого прохода не закрывают.

1. **Станки `st_fryer`, `st_smoker`, `st_prep`, `st_stockpot`** введены этой спекой сверх шести станков дека — требуют утверждения через PR в `00-canon.md` §3 (сейчас статус «нейминг-кандидат»). Альтернатива: слить Fryer+Smoker в один станок «Grill» с режимами, если бюджет полигонов/UI не тянет 10 отдельных станков.
2. **Доп. сырьё сверх канонных хайлайтов** (Лимон, Лук, Огурец, Курица, Пекан, Сом, Каджун-специи, Раки, Бришкет, Калифорнийский цитрус, теперь и Vanilla Essence — см. §4.1) — необходимо для покрытия 112 блюд, но канон §2.2 даёт только 5 хайлайтов на тир, не исчерпывающий список. Нужно решение: фиксировать этот список в канон или сократить каталог блюд до строго канонных 25 ингредиентов (сильно урезает южную/морскую кухню).
3. **Banana Split (№59) как гибрид категории Напитки/Десерты** — двойной тег для Demand Board технически нетипичен; нужно решение спеки рынка спроса (`14-economy.md`) — считать его отдельной подкатегорией или закрепить только за Напитками (как в дереве блюд дека). (Тир №59 пересчитан на T3 в этом проходе — см. §4.2 — вопрос категоризации это не закрывает.)
4. **Секретки Sec.7/8/12/22 — уникальные блюда сверх 112** — увеличивают итоговый Recipe Box до ~116 карточек; уточнить у экономики, не ломает ли это плановую вилку 90–130 для MVP-контента (без секреток) или лимит уже включает секретки.
5. **Партия крафта = ×1 baseline** — нужно подтверждение у спеки построек/стаффа (`13-progression.md`), что апгрейд партии происходит только через `staff_marty`/know-how, а не через уровень станка напрямую (иначе двойной источник роста тиража).
6. **Цена и время блюд в этой спеке — гипотезы, выведенные вручную** по формуле «баланс вокруг тирового бейзлайна §2.2 ±40%»; финальная калибровка централизуется в `14-economy.md` и может изменить конкретные цифры без изменения структуры каталога. (Явные нарушения полосы, найденные в ревью Фазы B, исправлены в этом проходе — см. §4.1/§4.2; пять T3-строк с быстрым временем оставлены как документированное исключение, см. сноску §3.2.)
7. **Смешанные ингредиенты-заменители до открытия штата** (№33 Classic Burger без говядины, №52/88/62 с временными заменителями мёда/кофе/яблок, теперь и Vanilla Essence в S10/№61 — см. §4.1) — решение введено этой спекой ради ранней доступности рецепта по уровню без ожидания экспедиции; нужно решение нарратив-спеки, не выглядит ли это нелепо («бургер без говядины») — альтернатива: сдвинуть такие рецепты на уровень открытия нужного сырья.
8. **Rumor Board (`ui_rumor_board`)** как отдельный UI-экран не описан ни в деке, ни в каноне — нейминг-кандидат этой спеки; требует решения `19-ui-ux.md`/`11-town.md`, интегрировать ли в существующий городской чат/ленту вместо отдельного экрана.
9. **Apple/Cucumber/Cocoa/Macaroni** как ингредиенты в отдельных рецептах (№18, S4, №51, Sec.12) введены ad hoc для конкретных блюд и не сведены в общий список доп. сырья §4.1 (Vanilla Essence в этом проходе уже добавлена в реестр — см. сноску §4.1, эти четыре — ещё нет) — нужно либо добавить в реестр допов, либо заменить эти рецепты на канонные ингредиенты.
