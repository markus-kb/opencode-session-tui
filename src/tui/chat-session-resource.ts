import type { ChatMessage } from "../lib/opencode-data"
import type { DataProvider } from "../lib/opencode-data-provider"
import { isChatIndexEnabled, type ResourcePolicy } from "./resource-policy"

export type ChatSessionMessagesResult =
  | { kind: "deferred"; messages: [] }
  | { kind: "loaded"; messages: ChatMessage[] }

export async function loadChatSessionMessages(
  provider: DataProvider,
  policy: ResourcePolicy,
  sessionId: string,
): Promise<ChatSessionMessagesResult> {
  if (!isChatIndexEnabled(policy)) {
    return { kind: "deferred", messages: [] }
  }

  return { kind: "loaded", messages: await provider.loadSessionChatIndex(sessionId) }
}

export async function hydrateChatSessionMessage(
  provider: DataProvider,
  policy: ResourcePolicy,
  message: ChatMessage,
): Promise<ChatMessage | null> {
  if (!isChatIndexEnabled(policy)) {
    return null
  }

  return provider.hydrateChatMessageParts(message)
}

export function getFailedHydrationMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    parts: [],
    previewText: "[failed to load]",
    totalChars: 0,
  }
}
