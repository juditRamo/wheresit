import { X } from 'lucide-react'

interface SheetHeaderProps {
  title: string
  onClose: () => void
}

export function SheetHeader({ title, onClose }: SheetHeaderProps) {
  return (
    <div className="edit-sheet__header">
      <h2 className="edit-sheet__title">{title}</h2>
      <button className="edit-sheet__close" onClick={onClose}>
        <X size={18} />
      </button>
    </div>
  )
}
