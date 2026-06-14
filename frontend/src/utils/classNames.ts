export function classNames(...names: Array<false | null | string | undefined>) {
  return names.filter(Boolean).join(' ')
}
