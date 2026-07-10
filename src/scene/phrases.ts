/**
 * Реплики героя по клику на пропс.
 *
 * Ключ — имя материала, а не пропса: у дома окно и дверь это отдельные меши
 * (в GLB каждый материал лежит своим примитивом), и различить их можно только
 * так. Материал без реплики кликом не перехватывается — событие уходит в землю,
 * и герой просто идёт туда.
 *
 * Один пропс из нескольких материалов даёт одну реплику на все свои части:
 * фудтрак откликается хоть на колесо, хоть на маркизу.
 */

const TRUCK = 'Он поможет мне разбогатеть!'
const TRUCK_NAME = 'Фудтрак'
const LOG = 'Совсем скоро я смогу посидеть тут.'
const LADYBUG = 'Она почему-то зависла и не летит. Может позже починят.'

export const PHRASES: Record<string, string> = {
  // Божья коровка
  LadybugRed: LADYBUG,
  LadybugBlack: LADYBUG,

  // Дом: только окно и дверь. Стена и крыша молчат.
  Window: 'Не хотелось бы его разбить.',
  Door: 'Пока рано отдыхать.',

  // Кусты
  Bush: 'Жаль их нельзя полить.',

  // Брёвна у фудтрака: и лавки, и стол-пенёк.
  WoodLog: LOG,
  TableTop: LOG,

  // Фудтрак целиком, включая кухню за окном раздачи
  TruckBody: TRUCK,
  TruckRoof: TRUCK,
  TruckWindow: TRUCK,
  TruckCounter: TRUCK,
  TruckAwning: TRUCK,
  TruckTrim: TRUCK,
  TruckWheel: TRUCK,
  TruckFloor: TRUCK,
  TruckWall: TRUCK,
  TruckFridge: TRUCK,
  TruckStove: TRUCK,
  TruckPot: TRUCK,
  TruckShelf: TRUCK,
  TruckMenu: TRUCK,
  TruckLamp: TRUCK,

  // Лавка семян реплик не имеет: клик по ней ведёт героя торговать
  // (см. SeedStore в Farm.tsx), а не заставляет рассуждать о товаре.
}

/**
 * Название пропса для подсказки по ховеру. Ключ — тоже имя материала.
 *
 * Реплика и название — разные вещи: реплику герой говорит по клику и она есть
 * не у всего, а имя видно при наведении и должно быть почти у каждого предмета
 * сцены. Поэтому это отдельная таблица, а не поле в PHRASES.
 *
 * Земли здесь нет: клик по траве — это приказ идти, а не разглядывание.
 */
const HOUSE = 'Дом'
const TREE = 'Ель'
const GREENHOUSE = 'Теплица'
const STORE = 'Лавка семян'

export const PROP_NAMES: Record<string, string> = {
  Wall: HOUSE,
  Roof: HOUSE,
  Window: HOUSE,
  Door: HOUSE,

  Trunk: TREE,
  Leaves1: TREE,
  Leaves2: TREE,

  Bush: 'Куст',
  Flower0: 'Цветы',
  Flower1: 'Цветы',
  Flower2: 'Цветы',
  Flower3: 'Цветы',

  Brick: 'Дорожка',
  WoodLog: 'Бревно',
  TableTop: 'Стол-пенёк',

  LadybugRed: 'Божья коровка',
  LadybugBlack: 'Божья коровка',

  GreenhouseFrame: GREENHOUSE,
  GreenhouseGlass: GREENHOUSE,

  StoreWood: STORE,
  StoreCounter: STORE,
  StoreRoof: STORE,
  StoreAwning: STORE,
  StoreSign: STORE,
  SeedSack: STORE,
  SeedCarrot: STORE,
  SeedGreens: STORE,
  SeedTomato: STORE,

  TruckBody: TRUCK_NAME,
  TruckRoof: TRUCK_NAME,
  TruckWindow: TRUCK_NAME,
  TruckCounter: TRUCK_NAME,
  TruckAwning: TRUCK_NAME,
  TruckTrim: TRUCK_NAME,
  TruckWheel: TRUCK_NAME,
  TruckFloor: TRUCK_NAME,
  TruckWall: TRUCK_NAME,
  TruckFridge: TRUCK_NAME,
  TruckStove: TRUCK_NAME,
  TruckPot: TRUCK_NAME,
  TruckShelf: TRUCK_NAME,
  TruckMenu: TRUCK_NAME,
  TruckLamp: TRUCK_NAME,
}
