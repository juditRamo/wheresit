import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import type { PendingUpdate, PendingPlaceMatch, PendingDuplicateChoice } from '../../../../types'

export function ConfirmPlaceCard({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingPlaceMatch
  onConfirm: () => void
  onCancel: () => void
}) {
  const { language } = useLanguage()
  return (
    <div className="confirm-card">
      <p className="confirm-card__text">
        {ui('confirm.place_match', language, { place: pending.suggestedPlaceLabel })}
      </p>
      <div className="confirm-card__actions">
        <button className="confirm-card__btn confirm-card__btn--cancel" onClick={onCancel}>
          {ui('confirm.cancel', language)}
        </button>
        <button className="confirm-card__btn confirm-card__btn--confirm" onClick={onConfirm}>
          {ui('confirm.confirm', language)}
        </button>
      </div>
    </div>
  )
}

export function ConfirmCard({ pending, onConfirm, onCancel }: { pending: PendingUpdate; onConfirm: () => void; onCancel: () => void }) {
  const { language } = useLanguage()

  return (
    <div className="confirm-card">
      <p className="confirm-card__text">
        {ui('confirm.move_prompt', language, {
          item: pending.item_name,
          old: pending.oldLocation,
          new: pending.newLocation,
        })}
      </p>
      <div className="confirm-card__actions">
        <button className="confirm-card__btn confirm-card__btn--cancel" onClick={onCancel}>
          {ui('confirm.cancel', language)}
        </button>
        <button className="confirm-card__btn confirm-card__btn--confirm" onClick={onConfirm}>
          {ui('confirm.confirm', language)}
        </button>
      </div>
    </div>
  )
}

export function DuplicateChoiceCard({
  choice,
  onMove,
  onAdd,
  onCancel,
}: {
  choice: PendingDuplicateChoice
  onMove: () => void
  onAdd: () => void
  onCancel: () => void
}) {
  const { language } = useLanguage()
  const locations = choice.entries.map((e) => e.location).join(', ')
  return (
    <div className="confirm-card">
      <p className="confirm-card__text">
        {ui('confirm.duplicate_prompt', language, { item: choice.item_name, locations })}
      </p>
      <div className="confirm-card__actions">
        <button className="confirm-card__btn confirm-card__btn--cancel" onClick={onCancel}>
          {ui('confirm.cancel', language)}
        </button>
        <button className="confirm-card__btn confirm-card__btn--confirm" onClick={onMove}>
          {ui('confirm.move', language)}
        </button>
        <button className="confirm-card__btn confirm-card__btn--confirm" onClick={onAdd}>
          {ui('confirm.add_another', language)}
        </button>
      </div>
    </div>
  )
}
