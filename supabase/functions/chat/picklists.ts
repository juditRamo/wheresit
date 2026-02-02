// Mirror of picklist keys for the edge function (Deno)
// Minimal EN/ES labels for building reply strings

type Lang = 'en' | 'es'

interface Labels { en: string; es: string }

type LabelMap = Record<string, Labels>

const ROOMS: LabelMap = {
  bedroom: { en: 'Bedroom', es: 'Dormitorio' },
  master_bedroom: { en: 'Master Bedroom', es: 'Dormitorio Principal' },
  kids_room: { en: "Kids' Room", es: 'Habitación de Niños' },
  guest_room: { en: 'Guest Room', es: 'Habitación de Invitados' },
  kitchen: { en: 'Kitchen', es: 'Cocina' },
  bathroom: { en: 'Bathroom', es: 'Baño' },
  living_room: { en: 'Living Room', es: 'Sala' },
  dining_room: { en: 'Dining Room', es: 'Comedor' },
  garage: { en: 'Garage', es: 'Garaje' },
  office: { en: 'Office', es: 'Oficina' },
  laundry: { en: 'Laundry Room', es: 'Lavandería' },
  closet: { en: 'Closet', es: 'Clóset' },
  pantry: { en: 'Pantry', es: 'Despensa' },
  attic: { en: 'Attic', es: 'Ático' },
  basement: { en: 'Basement', es: 'Sótano' },
  hallway: { en: 'Hallway', es: 'Pasillo' },
  entryway: { en: 'Entryway', es: 'Entrada' },
  patio: { en: 'Patio', es: 'Patio' },
  balcony: { en: 'Balcony', es: 'Balcón' },
  storage_room: { en: 'Storage Room', es: 'Trastero' },
}

const SPOTS: LabelMap = {
  dresser: { en: 'Dresser', es: 'Cómoda' },
  nightstand: { en: 'Nightstand', es: 'Mesita de Noche' },
  closet: { en: 'Closet', es: 'Clóset' },
  shelf: { en: 'Shelf', es: 'Estante' },
  drawer: { en: 'Drawer', es: 'Cajón' },
  cabinet: { en: 'Cabinet', es: 'Gabinete' },
  fridge: { en: 'Fridge', es: 'Refrigerador' },
  freezer: { en: 'Freezer', es: 'Congelador' },
  desk: { en: 'Desk', es: 'Escritorio' },
  table: { en: 'Table', es: 'Mesa' },
  couch: { en: 'Couch', es: 'Sofá' },
  bed: { en: 'Bed', es: 'Cama' },
  bookcase: { en: 'Bookcase', es: 'Librero' },
  wardrobe: { en: 'Wardrobe', es: 'Armario' },
  counter: { en: 'Counter', es: 'Encimera' },
  hook: { en: 'Hook', es: 'Gancho' },
  rack: { en: 'Rack', es: 'Perchero' },
  bin: { en: 'Bin', es: 'Caja' },
  box: { en: 'Box', es: 'Caja' },
  safe: { en: 'Safe', es: 'Caja Fuerte' },
  medicine_cabinet: { en: 'Medicine Cabinet', es: 'Botiquín' },
  tv_stand: { en: 'TV Stand', es: 'Mueble de TV' },
  shoe_rack: { en: 'Shoe Rack', es: 'Zapatero' },
  toolbox: { en: 'Toolbox', es: 'Caja de Herramientas' },
  workbench: { en: 'Workbench', es: 'Banco de Trabajo' },
  suitcase: { en: 'Suitcase', es: 'Maleta' },
  backpack: { en: 'Backpack', es: 'Mochila' },
  bag: { en: 'Bag', es: 'Bolsa' },
  basket: { en: 'Basket', es: 'Canasta' },
  tray: { en: 'Tray', es: 'Bandeja' },
}

const SPOT_DETAILS: LabelMap = {
  top_drawer: { en: 'Top Drawer', es: 'Cajón Superior' },
  bottom_drawer: { en: 'Bottom Drawer', es: 'Cajón Inferior' },
  middle_drawer: { en: 'Middle Drawer', es: 'Cajón del Medio' },
  top_shelf: { en: 'Top Shelf', es: 'Estante Superior' },
  bottom_shelf: { en: 'Bottom Shelf', es: 'Estante Inferior' },
  inside: { en: 'Inside', es: 'Dentro' },
  behind: { en: 'Behind', es: 'Detrás' },
  under: { en: 'Under', es: 'Debajo' },
  on_top: { en: 'On Top', es: 'Encima' },
  left_side: { en: 'Left Side', es: 'Lado Izquierdo' },
  right_side: { en: 'Right Side', es: 'Lado Derecho' },
  back: { en: 'Back', es: 'Fondo' },
  front: { en: 'Front', es: 'Frente' },
  hanging: { en: 'Hanging', es: 'Colgado' },
  door_pocket: { en: 'Door Pocket', es: 'Bolsillo de la Puerta' },
}

const CATEGORIES: LabelMap = {
  travel: { en: 'Travel', es: 'Viaje' },
  valuables: { en: 'Valuables', es: 'Objetos de Valor' },
  essentials: { en: 'Essentials', es: 'Esenciales' },
  documents: { en: 'Documents', es: 'Documentos' },
  electronics: { en: 'Electronics', es: 'Electrónica' },
  clothing: { en: 'Clothing', es: 'Ropa' },
  tools: { en: 'Tools', es: 'Herramientas' },
  sports: { en: 'Sports', es: 'Deportes' },
  kitchen_items: { en: 'Kitchen Items', es: 'Utensilios de Cocina' },
  health: { en: 'Health', es: 'Salud' },
  toys: { en: 'Toys', es: 'Juguetes' },
  seasonal: { en: 'Seasonal', es: 'De Temporada' },
  office_supplies: { en: 'Office Supplies', es: 'Material de Oficina' },
  cleaning: { en: 'Cleaning', es: 'Limpieza' },
  pets: { en: 'Pets', es: 'Mascotas' },
  misc: { en: 'Miscellaneous', es: 'Varios' },
}

export function label(map: LabelMap, key: string | null | undefined, lang: Lang): string {
  if (!key) return ''
  const entry = map[key]
  if (entry) return entry[lang]
  return key
}

export function isCustomRoom(key: string | undefined): boolean {
  if (!key) return false
  return !(key in ROOMS)
}

export function isCustomSpot(key: string | undefined): boolean {
  if (!key) return false
  return !(key in SPOTS)
}

export function isCustomDetail(key: string | undefined): boolean {
  if (!key) return false
  return !(key in SPOT_DETAILS)
}

export function roomLabel(key: string | null | undefined, lang: Lang): string {
  return label(ROOMS, key, lang)
}

export function spotLabel(key: string | null | undefined, lang: Lang): string {
  return label(SPOTS, key, lang)
}

export function spotDetailLabel(key: string | null | undefined, lang: Lang): string {
  return label(SPOT_DETAILS, key, lang)
}

export function categoryLabel(key: string | null | undefined, lang: Lang): string {
  return label(CATEGORIES, key, lang)
}

/** Build a human-readable location string from structured keys */
export function buildLocationString(
  room_key: string | null | undefined,
  spot_key: string | null | undefined,
  spot_detail: string | null | undefined,
  lang: Lang
): string {
  const parts: string[] = []
  const room = roomLabel(room_key, lang)
  if (room) parts.push(room)
  const spot = spotLabel(spot_key, lang)
  if (spot) parts.push(spot)
  const detail = spotDetailLabel(spot_detail, lang)
  if (detail) parts.push(detail)
  return parts.join(' \u203A ') // " › "
}

/** All room keys for use in the system prompt */
export const ROOM_KEYS = Object.keys(ROOMS)
export const SPOT_KEYS = Object.keys(SPOTS)
export const SPOT_DETAIL_KEYS = Object.keys(SPOT_DETAILS)
export const CATEGORY_KEYS = Object.keys(CATEGORIES)
