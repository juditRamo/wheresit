import './BottomSheet.css'

interface BottomSheetProps {
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function BottomSheet({ onClose, children, className }: BottomSheetProps) {
  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className={`bottom-sheet${className ? ` ${className}` : ''}`}>
        <div className="bottom-sheet__handle">
          <div className="bottom-sheet__handle-bar" />
        </div>
        {children}
      </div>
    </>
  )
}
