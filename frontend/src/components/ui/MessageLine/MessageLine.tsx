import { classNames } from '../../../utils/classNames'
import type { Message } from '../../../types'
import styles from './MessageLine.module.css'

type MessageLineProps = {
  message: Message
}

export function MessageLine({ message }: MessageLineProps) {
  if (!message) return null

  return (
    <p className={classNames(styles.message, message.tone === 'success' && styles.success, message.tone === 'error' && styles.error)}>
      {message.text}
    </p>
  )
}
