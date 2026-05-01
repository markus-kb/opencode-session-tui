import type { ChatMessage } from "../lib/opencode-data"

export const MAX_CHAT_PARTS_CACHE_ENTRIES = 100

export function upsertHydratedMessage(
  cache: Map<string, ChatMessage>,
  messageId: string,
  hydrated: ChatMessage,
  maxEntries: number = MAX_CHAT_PARTS_CACHE_ENTRIES,
): Map<string, ChatMessage> {
  const next = new Map(cache)

  if (next.has(messageId)) {
    next.delete(messageId)
  }
  next.set(messageId, hydrated)

  while (next.size > maxEntries) {
    const oldestKey = next.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    next.delete(oldestKey)
  }

  return next
}
