export function toggleSelectedIndex(selected: Set<number>, index: number | undefined): Set<number> {
  if (index === undefined) {
    return selected
  }
  const next = new Set(selected)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  return next
}

export function toggleAllVisibleIndexes(selected: Set<number>, visibleIndexes: number[]): Set<number> {
  if (visibleIndexes.length === 0) {
    return selected
  }
  const next = new Set(selected)
  const allVisibleSelected = visibleIndexes.every((index) => next.has(index))
  for (const index of visibleIndexes) {
    if (allVisibleSelected) {
      next.delete(index)
    } else {
      next.add(index)
    }
  }
  return next
}

export function clearSelection(): Set<number> {
  return new Set()
}
