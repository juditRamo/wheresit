import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'

interface ItemNameFieldProps {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function ItemNameField({ value, onChange, autoFocus }: ItemNameFieldProps) {
  const { language } = useLanguage()

  return (
    <div className="edit-sheet__field">
      <label className="edit-sheet__label">{ui('add.item_name', language)}</label>
      <input
        className="input-field edit-sheet__input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ui('add.item_name', language)}
        autoFocus={autoFocus}
      />
    </div>
  )
}
