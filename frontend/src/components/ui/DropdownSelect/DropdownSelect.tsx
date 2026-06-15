import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import styles from './DropdownSelect.module.css'

export type DropdownOption<TValue extends string> = {
  value: TValue
  label: string
  description?: string
  tooltip?: string
}

type DropdownSelectProps<TValue extends string> = {
  id: string
  label: string
  options: Array<DropdownOption<TValue>>
  value: TValue
  onChange: (value: TValue) => void
}

export function DropdownSelect<TValue extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: DropdownSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  function selectOption(option: TValue) {
    onChange(option)
    setIsOpen(false)
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLDivElement>, option: TValue) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(option)
    }
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className={styles.select} ref={rootRef}>
      <button
        aria-controls={`${id}-options`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={styles.selectButton}
        id={id}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false)
        }}
        type="button"
      >
        <span>
          <strong>{selectedOption.label}</strong>
          {selectedOption.description ? <span>{selectedOption.description}</span> : null}
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className={styles.menu} id={`${id}-options`} role="listbox" aria-label={label}>
          {options.map((option) => (
            <div
              aria-selected={option.value === value}
              className={option.value === value ? `${styles.option} ${styles.optionSelected}` : styles.option}
              key={option.value}
              onClick={() => selectOption(option.value)}
              onKeyDown={(event) => handleOptionKeyDown(event, option.value)}
              role="option"
              tabIndex={0}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description ? <span>{option.description}</span> : null}
              </span>
              {option.tooltip ? (
                <span className={styles.optionHelp} aria-label={option.tooltip}>
                  ?
                  <span role="tooltip">{option.tooltip}</span>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
