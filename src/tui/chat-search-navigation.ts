import type { ChatMessage, ChatSearchResult, SessionRecord } from "../lib/opencode-data"

export function findSessionForChatSearchResult(
  sessions: SessionRecord[],
  result: ChatSearchResult,
): SessionRecord | null {
  return sessions.find((session) => session.sessionId === result.sessionId) ?? null
}

export function findMessageCursorById(
  messages: ChatMessage[],
  messageId: string,
): number | null {
  const index = messages.findIndex((message) => message.messageId === messageId)
  return index === -1 ? null : index
}
