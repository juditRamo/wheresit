import type { Lang } from './picklists'

const strings: Record<string, { en: string; es: string }> = {
  // Header
  'header.subtitle': { en: 'Your Placement Butler', es: 'Tu Mayordomo de Ubicaciones' },

  // Bottom Nav
  'nav.chat': { en: 'Chat', es: 'Chat' },
  'nav.items': { en: 'Items', es: 'Objetos' },
  'nav.locations': { en: 'Locations', es: 'Ubicaciones' },

  // Chat
  'chat.placeholder': { en: 'Tell WheresIt where you put something\u2026', es: 'Dile a WheresIt d\u00f3nde guardaste algo\u2026' },
  'chat.error_apology': {
    en: "I'm terribly sorry, sir. I couldn't process that. Please try again.",
    es: 'Lo siento mucho. No pude procesar eso. Por favor, int\u00e9ntelo de nuevo.',
  },
  'chat.suggestion_prefix': { en: 'Where is', es: 'D\u00f3nde est\u00e1' },
  'chat.loading': { en: 'Remembering where it is\u2026', es: 'Recordando d\u00f3nde est\u00e1\u2026' },

  // MessageList empty state
  'empty.title': { en: 'Good evening, sir.', es: 'Buenas noches, se\u00f1or.' },
  'empty.hint': {
    en: 'Tell me where you put something, or ask where something is.',
    es: 'D\u00edgame d\u00f3nde guard\u00f3 algo, o pregunte d\u00f3nde est\u00e1.',
  },

  // Location card
  'location.tap': { en: 'Tap to see all items', es: 'Toca para ver todos los objetos' },

  // Tag saving card
  'tags.save_prompt': { en: 'Save as reusable locations?', es: 'Guardar como ubicaciones reutilizables?' },
  'tags.saved': { en: 'Saved', es: 'Guardado' },

  // Inventory
  'inventory.title': { en: 'Your Belongings', es: 'Tus Pertenencias' },
  'inventory.subtitle_one': { en: '1 item catalogued', es: '1 objeto catalogado' },
  'inventory.subtitle_other': { en: '{n} items catalogued', es: '{n} objetos catalogados' },
  'inventory.search': { en: 'Search your items\u2026', es: 'Busca tus objetos\u2026' },
  'inventory.by_room': { en: 'By Place', es: 'Por Lugar' },
  'inventory.recent': { en: 'Recent', es: 'Recientes' },
  'inventory.empty': { en: 'No items found.', es: 'No se encontraron objetos.' },
  'inventory.empty_welcome': { en: 'Your inventory is empty', es: 'Tu inventario est\u00e1 vac\u00edo' },
  'inventory.empty_hint': { en: 'Start by adding the first thing you want to keep track of.', es: 'Empieza a\u00f1adiendo lo primero que quieras recordar d\u00f3nde est\u00e1.' },
  'inventory.item_one': { en: '1 item', es: '1 objeto' },
  'inventory.item_other': { en: '{n} items', es: '{n} objetos' },
  'inventory.clear_filter': { en: 'Clear filter', es: 'Quitar filtro' },
  'inventory.filtered': { en: 'Filtered by: {place}', es: 'Filtrado por: {place}' },
  'inventory.filtered_spot': { en: 'Filtered by: {place} \u203A {spot}', es: 'Filtrado por: {place} \u203A {spot}' },
  'inventory.other_room': { en: 'Other', es: 'Otros' },

  // Edit / Delete (1.1)
  'edit.title': { en: 'Edit item', es: 'Editar objeto' },
  'edit.delete': { en: 'Delete', es: 'Eliminar' },
  'edit.save': { en: 'Save changes', es: 'Guardar cambios' },
  'edit.confirm_delete': { en: 'Are you sure you want to delete this item?', es: '\u00bfEst\u00e1s seguro de que quieres eliminar este objeto?' },
  'edit.deleted': { en: 'Item deleted', es: 'Objeto eliminado' },
  'edit.cancel': { en: 'Cancel', es: 'Cancelar' },

  // Quick-Add (1.2)
  'add.title': { en: 'Add item', es: 'A\u00f1adir objeto' },
  'add.item_name': { en: 'Item name', es: 'Nombre del objeto' },
  'add.room': { en: 'Place', es: 'Lugar' },
  'add.spot': { en: 'Spot', es: 'Lugar' },
  'add.detail': { en: 'Detail', es: 'Detalle' },
  'add.save': { en: 'Add item', es: 'A\u00f1adir objeto' },

  // Multi-result queries (2.1)
  'query.found_matches': { en: 'I found {n} matches:', es: 'Encontr\u00e9 {n} coincidencias:' },

  // Overwrite confirmation (2.2)
  'confirm.move_prompt': { en: '{item} is currently in {old}. Move to {new}?', es: '{item} est\u00e1 actualmente en {old}. \u00bfMover a {new}?' },
  'confirm.confirm': { en: 'Confirm', es: 'Confirmar' },
  'confirm.cancel': { en: 'Cancel', es: 'Cancelar' },

  // Voice input (2.3)
  'voice.listening': { en: 'Listening...', es: 'Escuchando...' },
  'voice.not_supported': { en: 'Voice input not supported in this browser', es: 'Entrada de voz no soportada en este navegador' },

  // Search tab (3.1)
  'search.placeholder': { en: 'Search items & locations...', es: 'Buscar objetos y ubicaciones...' },
  'search.no_results': { en: 'No results', es: 'Sin resultados' },
  'search.filter_room': { en: 'Filter by place', es: 'Filtrar por lugar' },

  // Dashboard (3.2)
  'dash.total_items': { en: 'Total items', es: 'Total objetos' },
  'dash.places_used': { en: 'Places used', es: 'Lugares usados' },
  'dash.with_photos': { en: 'With photos', es: 'Con fotos' },
  'dash.recently_moved': { en: 'Recently moved', es: 'Movidos recientemente' },

  // Activity feed (3.3)
  'activity.title': { en: 'Activity', es: 'Actividad' },
  'activity.moved': { en: '{user} moved {item} to {location}', es: '{user} movi\u00f3 {item} a {location}' },
  'activity.ago': { en: '{time} ago', es: 'hace {time}' },
  'activity.minutes': { en: '{n}m', es: '{n}m' },
  'activity.hours': { en: '{n}h', es: '{n}h' },
  'activity.days': { en: '{n}d', es: '{n}d' },
  'activity.added_object': { en: 'Added {item} at {location}', es: 'A\u00f1adi\u00f3 {item} en {location}' },
  'activity.moved_object': { en: 'Moved {item} to {location}', es: 'Movi\u00f3 {item} a {location}' },
  'activity.edit_object': { en: 'Edited {item}', es: 'Edit\u00f3 {item}' },
  'activity.delete_object': { en: 'Deleted {item}', es: 'Elimin\u00f3 {item}' },
  'activity.add_place': { en: 'Added place {label}', es: 'A\u00f1adi\u00f3 lugar {label}' },
  'activity.moved_place': { en: 'Moved {label} to {location}', es: 'Movi\u00f3 {label} a {location}' },
  'activity.edit_place': { en: 'Edited place {label}', es: 'Edit\u00f3 lugar {label}' },
  'activity.delete_place': { en: 'Deleted place {label}', es: 'Elimin\u00f3 lugar {label}' },

  // Settings (4.1)
  'settings.title': { en: 'Settings', es: 'Ajustes' },
  'settings.account': { en: 'Account', es: 'Cuenta' },
  'settings.profile': { en: 'Profile', es: 'Perfil' },
  'settings.current_household': { en: 'Current Household', es: 'Hogar actual' },
  'settings.household_settings': { en: 'Household Settings', es: 'Ajustes del hogar' },
  'settings.user_settings': { en: 'User Settings', es: 'Ajustes de usuario' },
  'settings.create_household': { en: 'Create household', es: 'Crear hogar' },
  'settings.join_with_code': { en: 'Join with invite code', es: 'Unirse con c\u00f3digo' },
  'settings.add_household_option': { en: 'Add a new household', es: 'A\u00f1adir un nuevo hogar' },
  'settings.household_name': { en: 'Household name', es: 'Nombre del hogar' },
  'settings.invite_code_placeholder': { en: 'Paste invite code', es: 'Pegar c\u00f3digo de invitaci\u00f3n' },
  'settings.edit_household_name': { en: 'Edit household name', es: 'Editar nombre del hogar' },
  'settings.email': { en: 'Email', es: 'Correo' },
  'settings.edit_profile': { en: 'Edit profile', es: 'Editar perfil' },
  'settings.display_name': { en: 'Display name', es: 'Nombre para mostrar' },
  'settings.change_password': { en: 'Change password', es: 'Cambiar contraseña' },
  'settings.current_password': { en: 'Current password', es: 'Contraseña actual' },
  'settings.new_password': { en: 'New password', es: 'Nueva contraseña' },
  'settings.confirm_password': { en: 'Confirm new password', es: 'Confirmar nueva contraseña' },
  'settings.save': { en: 'Save', es: 'Guardar' },
  'settings.you': { en: '(You)', es: '(Tú)' },
  'settings.password_updated': { en: 'Password updated', es: 'Contraseña actualizada' },
  'settings.profile_saved': { en: 'Profile saved', es: 'Perfil guardado' },
  'settings.household': { en: 'Household', es: 'Hogar' },
  'settings.members': { en: 'Members', es: 'Miembros' },
  'settings.invite_code': { en: 'Invite with code', es: 'Invitar con c\u00f3digo' },
  'settings.copy_code': { en: 'Copy code', es: 'Copiar c\u00f3digo' },
  'settings.copied': { en: 'Copied!', es: '\u00a1Copiado!' },
  'settings.sign_out': { en: 'Sign out', es: 'Cerrar sesi\u00f3n' },
  'settings.switch_household': { en: 'Switch household', es: 'Cambiar hogar' },
  'settings.theme': { en: 'Appearance', es: 'Apariencia' },
  'settings.theme_light': { en: 'Light', es: 'Claro' },
  'settings.theme_dark': { en: 'Dark', es: 'Oscuro' },
  'settings.theme_system': { en: 'System', es: 'Sistema' },
  'settings.language': { en: 'Language', es: 'Idioma' },
  'settings.owner': { en: 'Owner', es: 'Propietario' },
  'settings.member': { en: 'Member', es: 'Miembro' },

  // Photo attachments (4.2)
  'photo.add': { en: 'Add photo', es: 'A\u00f1adir foto' },
  'photo.remove': { en: 'Remove photo', es: 'Quitar foto' },
  'photo.take': { en: 'Take photo', es: 'Tomar foto' },
  'photo.choose': { en: 'Choose from gallery', es: 'Elegir de galer\u00eda' },
  'photo.upload_error': { en: 'Photo upload failed. Please try again.', es: 'Error al subir la foto. Int\u00e9ntalo de nuevo.' },
  'photo.uploading': { en: 'Uploading\u2026', es: 'Subiendo\u2026' },

  // Locations editor (4.3)
  'locations.title': { en: 'Manage locations', es: 'Gestionar ubicaciones' },
  'locations.add_room': { en: 'Add room', es: 'A\u00f1adir habitaci\u00f3n' },
  'locations.add_container': { en: 'Add container', es: 'A\u00f1adir contenedor' },
  'locations.standard': { en: 'Standard', es: 'Est\u00e1ndar' },
  'locations.custom': { en: 'Custom', es: 'Personalizado' },
  'locations.general': { en: 'General', es: 'General' },
  'locations.enter_name': { en: 'Enter name...', es: 'Introduce un nombre...' },
  'locations.rooms': { en: 'Rooms', es: 'Habitaciones' },
  'locations.containers': { en: 'Containers', es: 'Contenedores' },
  'locations.delete_confirm': { en: 'Delete this location?', es: '\u00bfEliminar esta ubicaci\u00f3n?' },
  'locations.drag_hint': { en: 'Drag containers between rooms', es: 'Arrastra contenedores entre habitaciones' },
  'settings.manage_locations': { en: 'Manage locations', es: 'Gestionar ubicaciones' },
  'locations.tab_title': { en: 'Places', es: 'Lugares' },
  'locations.empty': { en: 'No places yet. Add places via chat or here.', es: 'Aún no hay lugares. Añade lugares por chat o aquí.' },
  'locations.add_place': { en: 'Add place', es: 'Añadir lugar' },
  'locations.add_child': { en: 'Add place inside', es: 'Añadir lugar dentro' },
  'locations.move_to': { en: 'Move to', es: 'Mover a' },
  'locations.move_to_title': { en: 'Move under', es: 'Mover bajo' },
  'locations.edit': { en: 'Edit', es: 'Editar' },
  'locations.edit_place_title': { en: 'Edit place', es: 'Editar lugar' },
  'locations.duplicate': { en: 'Duplicate place', es: 'Duplicar lugar' },
  'locations.delete': { en: 'Delete', es: 'Eliminar' },

  'locations.icon': { en: 'Icon', es: 'Icono' },
  'locations.choose_icon': { en: 'Choose icon', es: 'Elegir icono' },
  'locations.name_placeholder': { en: 'Name', es: 'Nombre' },
  'locations.add_inside': { en: 'Add place inside {name}', es: 'Añadir lugar dentro de {name}' },
  'locations.no_children': { en: 'No places inside {name}', es: 'No hay lugares dentro de {name}' },
  'locations.add_item_here': { en: 'Add item here', es: 'Añadir objeto aquí' },
  'locations.items_here': { en: 'Items here ({n})', es: 'Objetos aquí ({n})' },
  'locations.view_all_items': { en: 'View all in Items', es: 'Ver todos en Objetos' },
  'locations.section_places': { en: 'Places', es: 'Lugares' },
  'locations.section_items': { en: 'Items', es: 'Objetos' },
  'locations.no_items': { en: 'No items in {name}', es: 'No hay objetos en {name}' },
  'locations.drag_handle': { en: 'Drag to reorder', es: 'Arrastra para reordenar' },
  'icons.rooms': { en: 'Rooms', es: 'Habitaciones' },
  'icons.furniture': { en: 'Furniture', es: 'Muebles' },
  'icons.containers': { en: 'Containers', es: 'Contenedores' },
  'icons.misc': { en: 'Other', es: 'Otros' },

  // Custom fields
  'cf.title': { en: 'Custom Fields', es: 'Campos personalizados' },
  'cf.add': { en: 'Add field', es: 'Añadir campo' },
  'cf.name': { en: 'Field name', es: 'Nombre del campo' },
  'cf.type': { en: 'Type', es: 'Tipo' },
  'cf.type_text': { en: 'Text', es: 'Texto' },
  'cf.type_number': { en: 'Number', es: 'Número' },
  'cf.type_boolean': { en: 'Yes/No', es: 'Sí/No' },
  'cf.type_select': { en: 'Select', es: 'Selección' },
  'cf.type_multiselect': { en: 'Multi-select', es: 'Multi-selección' },
  'cf.type_date': { en: 'Date', es: 'Fecha' },
  'cf.options': { en: 'Options', es: 'Opciones' },
  'cf.add_option': { en: 'Add option', es: 'Añadir opción' },
  'cf.option_placeholder': { en: 'Option value', es: 'Valor de opción' },
  'cf.delete_confirm': { en: "Delete field '{name}'? Values on all items will be removed.", es: "¿Eliminar campo '{name}'? Se eliminarán los valores de todos los objetos." },
  'cf.no_fields': { en: 'No custom fields yet.', es: 'Aún no hay campos personalizados.' },
  'cf.save': { en: 'Save field', es: 'Guardar campo' },
  'cf.yes': { en: 'Yes', es: 'Sí' },
  'cf.no': { en: 'No', es: 'No' },
  'cf.none': { en: 'None', es: 'Ninguno' },
  'cf.filter': { en: 'Filters', es: 'Filtros' },
  'cf.clear_filters': { en: 'Clear all', es: 'Limpiar todo' },
  'cf.min': { en: 'Min', es: 'Mín' },
  'cf.max': { en: 'Max', es: 'Máx' },
  'cf.all': { en: 'All', es: 'Todos' },
  'cf.add_new_option': { en: 'Add new...', es: 'Añadir nuevo...' },
  'cf.filtered_count': { en: '{n} of {total} items', es: '{n} de {total} objetos' },
  'cf.from': { en: 'From', es: 'Desde' },
  'cf.to': { en: 'To', es: 'Hasta' },

  // Place drill-down picker
  'places.move_here': { en: 'Move here', es: 'Mover aquí' },
  'places.use_this_place': { en: 'Use this place', es: 'Usar este lugar' },
  'places.back': { en: 'Back', es: 'Atrás' },
  'places.root': { en: 'Root', es: 'Raíz' },
  'places.no_place': { en: 'No place', es: 'Sin lugar' },
  'places.change': { en: 'Change', es: 'Cambiar' },
  'places.choose_place': { en: 'Choose from places', es: 'Elegir de lugares' },
}

/**
 * Look up a UI string by key and language.
 * Supports simple {n} and {place} interpolation via the `vars` argument.
 */
export function ui(key: string, lang: Lang, vars?: Record<string, string | number>): string {
  const entry = strings[key]
  if (!entry) return key
  let str = entry[lang]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v))
    }
  }
  return str
}
