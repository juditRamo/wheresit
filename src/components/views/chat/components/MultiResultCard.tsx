import type { LocationRef, QueryResult } from '../../../../types'
import { buildResultLocation } from '../helpers'

interface MultiResultCardProps {
  results: QueryResult[]
  onLocationClick: (filter: LocationRef) => void
}

export function MultiResultCard({ results, onLocationClick }: MultiResultCardProps) {
  return (
    <div className="multi-result-card">
      {results.map((r, i) => (
        <button
          key={i}
          className="multi-result-card__item"
          onClick={() => {
            if (r.place_id) {
              onLocationClick({ place_id: r.place_id })
            } else {
              onLocationClick({ location_description: r.location_description })
            }
          }}
        >
          <span className="multi-result-card__name">{r.item_name}</span>
          <span className="multi-result-card__loc">{buildResultLocation(r)}</span>
        </button>
      ))}
    </div>
  )
}
