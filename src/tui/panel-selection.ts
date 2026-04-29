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

export function pruneSelectedIndexes(selected: Set<number>, validIndexes: number[]): Set<number> {
  if (selected.size === 0) {
    return selected
  }
  const valid = new Set(validIndexes)
  let changed = false
  const next = new Set<number>()
  for (const index of selected) {
    if (valid.has(index)) {
      next.add(index)
    } else {
      changed = true
    }
  }
  return changed ? next : selected
}

export function clampCursor(cursor: number, visibleCount: number): number {
  if (visibleCount === 0) {
    return 0
  }
  return Math.min(cursor, visibleCount - 1)
}
