import type { ChatMessage } from "../lib/opencode-data"

export function findPrevUserMessage(messages: ChatMessage[], cursor: number): number {
  for (let i = cursor - 1; i >= 0; i--) {
    if (messages[i].role === "user") return i
  }
  return cursor
}

export function findNextUserMessage(messages: ChatMessage[], cursor: number): number {
  for (let i = cursor + 1; i < messages.length; i++) {
    if (messages[i].role === "user") return i
  }
  return cursor
}
