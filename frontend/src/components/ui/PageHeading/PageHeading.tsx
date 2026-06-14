import styles from './PageHeading.module.css'

type PageHeadingProps = {
  title: string
  text: string
}

export function PageHeading({ title, text }: PageHeadingProps) {
  return (
    <div className={styles.pageHeading}>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  )
}
