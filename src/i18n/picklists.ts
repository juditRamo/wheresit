export type Lang = 'en' | 'es'

export interface PicklistEntry {
  en: string
  es: string
}

type PicklistMap = Record<string, PicklistEntry>

// ── Rooms ──────────────────────────────────────────────
export const ROOMS: PicklistMap = {
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

// ── Spots ──────────────────────────────────────────────
export const SPOTS: PicklistMap = {
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

// ── Spot Details ───────────────────────────────────────
export const SPOT_DETAILS: PicklistMap = {
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

// ── Categories ─────────────────────────────────────────
export const CATEGORIES: PicklistMap = {
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

/**
 * Translate a picklist key. If the key exists in the map, return the
 * label for the given language. Otherwise return the raw string as-is
 * (custom value).
 */
export function t(map: PicklistMap, key: string | null | undefined, lang: Lang): string {
  if (!key) return ''
  const entry = map[key]
  if (entry) return entry[lang]
  return key // custom value — displayed as-is
}
