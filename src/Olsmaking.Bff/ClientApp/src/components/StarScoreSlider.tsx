import type { KeyboardEvent } from 'react'
import styles from './StarScoreSlider.module.css'

interface StarScoreSliderProps {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

const SCORE_VALUES = [1, 2, 3, 4, 5, 6]

function getNextScore(currentValue: number, event: KeyboardEvent<HTMLDivElement>): number {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    return Math.max(1, currentValue - 1)
  }

  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    return Math.min(6, currentValue + 1)
  }

  if (event.key === 'Home') {
    return 1
  }

  if (event.key === 'End') {
    return 6
  }

  return currentValue
}

export function StarScoreSlider({ id, label, value, onChange, disabled = false }: StarScoreSliderProps) {
  return (
    <div className={styles.root}>
      <p id={`${id}-label`} className={styles.label}>
        {label}: {value} / 6
      </p>
      <div
        className={styles.track}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        onKeyDown={(event) => {
          const nextValue = getNextScore(value, event)
          if (nextValue !== value) {
            event.preventDefault()
            onChange(nextValue)
          }
        }}
      >
        {SCORE_VALUES.map((score) => {
          const active = score <= value

          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${label} ${score} av 6`}
              className={active ? styles.starButtonActive : styles.starButton}
              onClick={() => {
                onChange(score)
              }}
              disabled={disabled}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.starIcon}>
                <polygon
                  points="12,2.4 15,8.8 22,9.3 16.8,14.1 18.5,21 12,17.2 5.5,21 7.2,14.1 2,9.3 9,8.8"
                  className={active ? styles.starFill : styles.starOutline}
                />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}
