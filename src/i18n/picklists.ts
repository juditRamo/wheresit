export type Lang = 'en' | 'es'

export interface PicklistEntry {
  en: string
  es: string
}

type PicklistMap = Record<string, PicklistEntry>

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
