import styles from './StatusBadge.module.css'

export type StatusTone = 'calm' | 'accent' | 'warning'

const toneClassNames: Record<StatusTone, string> = {
  calm: styles.calm,
  accent: styles.accent,
  warning: styles.warning,
}

type StatusBadgeProps = {
  label: string
  tone: StatusTone
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`${styles.statusBadge} ${toneClassNames[tone]}`} aria-label={label}>
      {label}
    </span>
  )
}
