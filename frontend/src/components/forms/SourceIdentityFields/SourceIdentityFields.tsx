import styles from './SourceIdentityFields.module.css'

type SourceIdentityFieldsProps = {
  name: string
  version: string
  onNameChange: (value: string) => void
  onVersionChange: (value: string) => void
}

export function SourceIdentityFields({
  name,
  version,
  onNameChange,
  onVersionChange,
}: SourceIdentityFieldsProps) {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.field}>
        <label htmlFor="source-name">Name</label>
        <input
          id="source-name"
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Library or project name"
          type="text"
          value={name}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="source-version">Version</label>
        <input
          id="source-version"
          onChange={(event) => onVersionChange(event.target.value)}
          required
          type="text"
          value={version}
        />
      </div>
    </div>
  )
}
