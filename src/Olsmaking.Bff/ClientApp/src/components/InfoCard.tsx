import styles from './InfoCard.module.css'

type InfoCardProps = {
  title: string
  subtitle: string
  footer: string
}

export function InfoCard({ title, subtitle, footer }: InfoCardProps) {
  return (
    <article className={styles.infoCard}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <small>{footer}</small>
    </article>
  )
}
