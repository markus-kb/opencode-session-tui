export function buildDeletionConfirmTitle(
  selectedCount: number,
  singularLabel: string,
): string {
  const plural = singularLabel.endsWith("y")
    ? `${singularLabel.slice(0, -1)}ies`
    : `${singularLabel}s`
  const label = selectedCount === 1 ? singularLabel : plural
  return `Delete ${selectedCount} ${label}?`
}

export function buildDeletionConfirmDetails<T>(
  selected: T[],
  options: {
    maxPreview: number
    describe: (item: T) => string
  },
): string[] {
  return selected.slice(0, options.maxPreview).map(options.describe)
}
