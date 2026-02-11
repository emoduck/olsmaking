import './StatusBadge.css'

export type StatusTone = 'calm' | 'accent' | 'warning'

type StatusBadgeProps = {
  label: string
  tone: StatusTone
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${tone}`} aria-label={label}>
      {label}
    </span>
  )
}
