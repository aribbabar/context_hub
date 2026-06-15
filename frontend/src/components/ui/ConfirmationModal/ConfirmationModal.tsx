import { useEffect } from 'react'
import styles from './ConfirmationModal.module.css'

type ConfirmationModalProps = {
  cancelLabel?: string
  confirmLabel?: string
  isOpen: boolean
  isPending?: boolean
  message: string
  title: string
  tone?: 'default' | 'danger'
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmationModal({
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  isOpen,
  isPending = false,
  message,
  title,
  tone = 'default',
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isPending, onCancel])

  if (!isOpen) return null

  return (
    <div
      aria-labelledby="confirmation-title"
      aria-modal="true"
      className={styles.backdrop}
      onMouseDown={() => {
        if (!isPending) onCancel()
      }}
      role="dialog"
    >
      <div className={styles.dialog} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.content}>
          <h2 id="confirmation-title">{title}</h2>
          <p>{message}</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondaryButton} disabled={isPending} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button
            className={tone === 'danger' ? styles.dangerButton : styles.primaryButton}
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? 'Deleting' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
