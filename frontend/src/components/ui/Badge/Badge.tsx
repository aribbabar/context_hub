import styles from './Badge.module.css'

type BadgeProps = {
  value: string
  variant: string
}

export function Badge({ value, variant }: BadgeProps) {
  const variantClass = styles[`badge${toPascalCase(variant)}`]

  return <span className={`${styles.badge} ${variantClass ?? ''}`}>{value}</span>
}

function toPascalCase(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
