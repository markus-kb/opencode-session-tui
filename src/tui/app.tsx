import type { KeyEvent } from "@opentui/core"
import { useKeyboard, useRenderer } from "@opentui/react"
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { copyToClipboardSync } from "../lib/clipboard"
import {
  ProjectRecord,
  SessionRecord,
  formatDisplayPath,
  AggregateTokenSummary,
  clearTokenCache,
  ChatMessage,
  ChatPart,
  ChatSearchResult,
} from "../lib/opencode-data"
import { DEFAULT_SQLITE_PATH } from "../lib/opencode-data-sqlite"
import { createProvider, type DataProvider, type StorageBackend } from "../lib/opencode-data-provider"
import {
  createInitialTuiState,
  getGlobalTokenDisplayState,

  applyNavigationEvent,
  switchWorkspaceTab,
  type TuiTab,
} from "./app-state"
import { formatTokenCount } from "./format"
import { getResourcePolicy, isProjectMetadataEnabled, isSessionMetadataEnabled, isTokenSummaryEnabled, toWorkspaceDataLoadState, type ResourcePolicy } from "./resource-policy"
import { loadGlobalTokensFromSessionIndex, loadSessionIndex } from "./session-resource"
import { loadProjectIndex } from "./project-resource"
import { getFailedHydrationMessage, hydrateChatSessionMessage, loadChatSessionMessages } from "./chat-session-resource"
import { getChatSearchSessions, searchChatSessions } from "./chat-search-resource"
import { buildTuiCommands, type TuiCommandSet } from "./command-definitions"
import { toCommandKey, toCommandScope, resolveCommand, type KeyRouteContext } from "./key-router"
import { getInputLayer } from "./input-precedence"
import { getHomeDashboardModel } from "./home-dashboard"
import { detectStorageSources } from "./backend-resolver"
import { PALETTE, SearchBar } from "./components"
import { nextWorkspaceRefreshKey } from "./workspace-refresh"
import { getProjectSessionsNavigation } from "./workspace-navigation"
import { closeChatSearchState, closeChatViewerState, openChatSearchState, openChatViewerState } from "./chat-overlay-lifecycle"
import { ConfirmBar, type ConfirmState } from "./confirm-bar"
import { cancelConfirmation, finishConfirmation, requestConfirmation, startConfirmation } from "./confirm-lifecycle"
import { StatusBar, type NotificationLevel } from "./status-bar"
import { HomeScreen } from "./home-screen"
import { ProjectsPanel, type PanelHandle } from "./projects-panel"
import { SessionsPanel } from "./sessions-panel"
import { ChatViewer } from "./chat-viewer"
import { ChatSearchOverlay } from "./chat-search-overlay"

type TabKey = TuiTab

// Clipboard functionality moved to ../lib/clipboard.ts
// Use copyToClipboardSyncSync for fire-and-forget clipboard operations

export const App = ({
  root,
  backend,
  dbPath,
  sqliteStrict,
  forceWrite,
}: {
  root: string
  backend: StorageBackend
  dbPath?: string
  sqliteStrict: boolean
  forceWrite: boolean
}) => {
  const renderer = useRenderer()
  const projectsRef = useRef<PanelHandle>(null)
  const sessionsRef = useRef<PanelHandle>(null)

  const [tuiState, setTuiState] = useState(createInitialTuiState)
  const activeTab: TabKey = tuiState.screen.name === "workspace" ? tuiState.screen.activeTab : "projects"
  const isHome = tuiState.screen.name === "home"
  const [sessionFilter, setSessionFilter] = useState<string | null>(null)
  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [status, setStatus] = useState("Ready")
  const [statusLevel, setStatusLevel] = useState<NotificationLevel>("info")
  const [sqliteWarning, setSqliteWarning] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  // Global token state
  const [globalTokens, setGlobalTokens] = useState<AggregateTokenSummary | null>(null)
  const [tokenRefreshKey, setTokenRefreshKey] = useState(0)

  // Chat viewer state
  const chatViewerOpen = tuiState.overlay?.name === "chatViewer"
  const [chatSession, setChatSession] = useState<SessionRecord | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatCursor, setChatCursor] = useState(0)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatPartsCache, setChatPartsCache] = useState<Map<string, ChatMessage>>(new Map())

  // Chat search overlay state
  const chatSearchOpen = tuiState.overlay?.name === "chatSearch"
  const [chatSearchQuery, setChatSearchQuery] = useState("")
  const [chatSearchResults, setChatSearchResults] = useState<ChatSearchResult[]>([])
  const [chatSearchCursor, setChatSearchCursor] = useState(0)
  const [chatSearching, setChatSearching] = useState(false)
  const [allProjects, setAllProjects] = useState<ProjectRecord[]>([])
  const [projectIndexLoaded, setProjectIndexLoaded] = useState(false)
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([])
  const [sessionIndexLoaded, setSessionIndexLoaded] = useState(false)

  const resolvedDbPath = useMemo(() => {
    if (backend !== "sqlite") {
      return undefined
    }
    return dbPath ?? DEFAULT_SQLITE_PATH
  }, [backend, dbPath])

  const notify = useCallback((message: string, level: NotificationLevel = "info") => {
    setStatus(message)
    setStatusLevel(level)
  }, [])

  const provider = useMemo(() => {
    return createProvider({
      backend,
      root,
      dbPath: resolvedDbPath,
      sqliteStrict,
      forceWrite,
      onWarning: (message) => {
        setSqliteWarning(message)
        notify(message, "error")
      },
    })
  }, [backend, root, resolvedDbPath, sqliteStrict, forceWrite, notify, setSqliteWarning])

  const resourcePolicy = useMemo(() => getResourcePolicy(tuiState), [tuiState])
  const workspaceDataLoadState = useMemo(() => toWorkspaceDataLoadState(resourcePolicy), [resourcePolicy])
  const cmdSet = useMemo(() => buildTuiCommands(), [])
  const refreshWorkspaceResources = useCallback(() => {
    setTokenRefreshKey(nextWorkspaceRefreshKey)
  }, [])

  const globalTokenDisplay = useMemo(
    () => getGlobalTokenDisplayState(globalTokens, workspaceDataLoadState),
    [globalTokens, workspaceDataLoadState],
  )

  const storageSources = useMemo(
    () => detectStorageSources({ defaultSqlitePath: resolvedDbPath ?? DEFAULT_SQLITE_PATH, root }),
    [resolvedDbPath, root],
  )

  const homeDashboard = useMemo(
    () => getHomeDashboardModel({
      backend,
      root,
      dbPath: resolvedDbPath,
      tokenLabel: globalTokenDisplay.kind === "known"
        ? formatTokenCount(globalTokenDisplay.summary.total.tokens.total)
        : globalTokenDisplay.label,
      sqliteAvailable: storageSources.sqliteAvailable,
      legacyJsonAvailable: storageSources.legacyJsonAvailable,
    }),
    [backend, root, resolvedDbPath, globalTokenDisplay, storageSources],
  )

  useEffect(() => {
    return () => {
      provider.dispose?.()
    }
  }, [provider])

  // Load project index once for shared consumers (session move/copy selectors, etc.).
  useEffect(() => {
    if (!isProjectMetadataEnabled(resourcePolicy)) {
      setAllProjects([])
      setProjectIndexLoaded(false)
      return
    }
    let cancelled = false
    setProjectIndexLoaded(false)
    loadProjectIndex(provider, resourcePolicy).then((result) => {
      if (!cancelled) {
        setAllProjects(result.records)
        setProjectIndexLoaded(result.kind === "loaded")
      }
    })
    return () => { cancelled = true }
  }, [provider, resourcePolicy, tokenRefreshKey])

  // Load all sessions once for root-level token summaries and chat search.
  useEffect(() => {
    if (!isSessionMetadataEnabled(resourcePolicy)) {
      setAllSessions([])
      setSessionIndexLoaded(false)
      return
    }
    let cancelled = false
    setSessionIndexLoaded(false)
    loadSessionIndex(provider, resourcePolicy).then((result) => {
      if (!cancelled) {
        setAllSessions(result.records)
        setSessionIndexLoaded(result.kind === "loaded")
      }
    })
    return () => { cancelled = true }
  }, [provider, resourcePolicy, tokenRefreshKey])

  // Compute global tokens from the shared session index instead of reloading metadata.
  useEffect(() => {
    if (!isTokenSummaryEnabled(resourcePolicy) || !sessionIndexLoaded) {
      setGlobalTokens(null)
      return
    }
    let cancelled = false
    loadGlobalTokensFromSessionIndex(provider, resourcePolicy, allSessions).then((summary) => {
      if (!cancelled && summary) {
        setGlobalTokens(summary)
      }
    })
    return () => { cancelled = true }
  }, [allSessions, provider, resourcePolicy, sessionIndexLoaded])

  const requestConfirm = useCallback((state: ConfirmState) => {
    const snapshot = requestConfirmation(state)
    setConfirmState(snapshot.state)
    setConfirmBusy(snapshot.busy)
  }, [])

  const cancelConfirm = useCallback(() => {
    const snapshot = cancelConfirmation()
    setConfirmState(snapshot.state)
    setConfirmBusy(snapshot.busy)
  }, [])

  const executeConfirm = useCallback(async () => {
    const started = startConfirmation(confirmState, confirmBusy)
    if (!started.canExecute) {
      return
    }
    try {
      setConfirmState(started.snapshot.state)
      setConfirmBusy(started.snapshot.busy)
      await started.snapshot.state?.onConfirm()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      notify(`Action failed: ${message}`, "error")
    } finally {
      const snapshot = finishConfirmation()
      setConfirmState(snapshot.state)
      setConfirmBusy(snapshot.busy)
    }
  }, [confirmState, confirmBusy, notify])

  const switchTab = useCallback((direction: "next" | "prev" | TabKey) => {
    setTuiState((prev) => switchWorkspaceTab(prev, direction))
  }, [])

  // Chat viewer controls
  const openChatViewer = useCallback(async (session: SessionRecord) => {
    setTuiState((prev) => applyNavigationEvent(prev, { type: "openChat", sessionId: session.sessionId }))
    setChatSession(session)
    const initial = openChatViewerState()
    setChatMessages(initial.chatMessages)
    setChatCursor(initial.chatCursor)
    setChatLoading(initial.chatLoading)
    setChatError(initial.chatError)
    setChatPartsCache(initial.chatPartsCache)

    try {
      const result = await loadChatSessionMessages(provider, resourcePolicy, session.sessionId)
      setChatMessages(result.messages)
      if (result.messages.length > 0) {
        setChatCursor(0)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setChatError(msg)
    } finally {
      setChatLoading(false)
    }
  }, [provider, resourcePolicy])

  const closeChatViewer = useCallback(() => {
    setTuiState((prev) => applyNavigationEvent(prev, { type: "closeOverlay" }))
    const cleared = closeChatViewerState()
    setChatSession(cleared.chatSession)
    setChatMessages(cleared.chatMessages)
    setChatCursor(cleared.chatCursor)
    setChatLoading(cleared.chatLoading)
    setChatError(cleared.chatError)
    setChatPartsCache(cleared.chatPartsCache)
  }, [])

  const hydrateMessage = useCallback(async (message: ChatMessage) => {
    // Check cache first
    const cached = chatPartsCache.get(message.messageId)
    if (cached) {
      setChatMessages(prev => prev.map(m =>
        m.messageId === message.messageId ? cached : m
      ))
      return
    }

    try {
      const hydrated = await hydrateChatSessionMessage(provider, resourcePolicy, message)
      if (!hydrated) {
        return
      }
      setChatPartsCache(prev => new Map(prev).set(message.messageId, hydrated))
      setChatMessages(prev => prev.map(m =>
        m.messageId === message.messageId ? hydrated : m
      ))
    } catch (err) {
      const errorMsg = getFailedHydrationMessage(message)
      setChatMessages(prev => prev.map(m =>
        m.messageId === message.messageId ? errorMsg : m
      ))
    }
  }, [provider, resourcePolicy, chatPartsCache])

  const copyChatMessage = useCallback((message: ChatMessage) => {
    if (!message.parts || message.parts.length === 0) {
      notify("No content to copy", "error")
      return
    }
    const text = message.parts.map(p => p.text).join('\n\n')
    copyToClipboardSync(text)
    notify(`Copied ${text.length} chars to clipboard`)
  }, [notify])

  // Chat search controls
  const openChatSearch = useCallback(() => {
    setTuiState((prev) => applyNavigationEvent(prev, { type: "openChatSearch" }))
    const initial = openChatSearchState()
    setChatSearchQuery(initial.chatSearchQuery)
    setChatSearchResults(initial.chatSearchResults)
    setChatSearchCursor(initial.chatSearchCursor)
    setChatSearching(initial.chatSearching)
  }, [])

  const closeChatSearch = useCallback(() => {
    setTuiState((prev) => applyNavigationEvent(prev, { type: "closeOverlay" }))
    const cleared = closeChatSearchState()
    setChatSearchQuery(cleared.chatSearchQuery)
    setChatSearchResults(cleared.chatSearchResults)
    setChatSearchCursor(cleared.chatSearchCursor)
    setChatSearching(cleared.chatSearching)
  }, [])

  const executeChatSearch = useCallback(async () => {
    if (!chatSearchQuery.trim()) {
      setChatSearchResults([])
      return
    }

    setChatSearching(true)

    try {
      const sessionsToSearch = getChatSearchSessions(allSessions, sessionFilter)
      const result = await searchChatSessions(provider, resourcePolicy, sessionsToSearch, chatSearchQuery)
      setChatSearchResults(result.results)
      setChatSearchCursor(0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      notify(`Search failed: ${msg}`, "error")
      setChatSearchResults([])
    } finally {
      setChatSearching(false)
    }
  }, [chatSearchQuery, sessionFilter, allSessions, provider, resourcePolicy, notify])

  const handleChatSearchResult = useCallback(async (result: ChatSearchResult) => {
    // Find the session and open chat viewer at the matching message
    const session = allSessions.find(s => s.sessionId === result.sessionId)
    if (!session) {
      notify("Session not found", "error")
      return
    }

    closeChatSearch()
    await openChatViewer(session)

    // Find the message index in the chat viewer
    // Wait a bit for the chat viewer to load
    setTimeout(() => {
      setChatMessages(prev => {
        const idx = prev.findIndex(m => m.messageId === result.messageId)
        if (idx !== -1) {
          setChatCursor(idx)
        }
        return prev
      })
    }, 100)
  }, [allSessions, closeChatSearch, openChatViewer, notify])

  const handleGlobalKey = useCallback(
    (key: KeyEvent) => {
      const inputLayer = getInputLayer({ screen: isHome ? "home" : activeTab, overlay: tuiState.overlay, searchActive, confirmActive: Boolean(confirmState) })

      if (inputLayer === "searchInput") {
        if (key.name === "escape") {
          setSearchActive(false)
          setSearchQuery("")
          return
        }
        if (key.name === "return" || key.name === "enter") {
          setSearchActive(false)
          return
        }
        if (key.name === "backspace") {
          setSearchQuery((prev) => prev.slice(0, -1))
          return
        }
        const ch = key.sequence
        if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
          setSearchQuery((prev) => prev + ch)
          return
        }
        return
      }
      if (inputLayer === "confirm") {
        const cmdKey = toCommandKey(key)
        const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: activeTab, overlay: null, searchActive, confirmActive: true })
        if (cmdId === "confirm:cancel") {
          cancelConfirm()
          return
        }
        if (cmdId === "confirm:ok") {
          void executeConfirm()
          return
        }
        return
      }

      if (inputLayer === "chatViewer") {
        const cmdKey = toCommandKey(key)
        const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: activeTab, overlay: tuiState.overlay, searchActive: false, confirmActive: false })
        if (cmdId === "chat:close") {
          closeChatViewer()
          return
        }
        if (cmdId === "chat:prev") {
          setChatCursor(prev => Math.max(0, prev - 1))
          return
        }
        if (cmdId === "chat:next") {
          setChatCursor(prev => Math.min(chatMessages.length - 1, prev + 1))
          return
        }
        if (cmdId === "chat:pageUp") {
          setChatCursor(prev => Math.max(0, prev - 10))
          return
        }
        if (cmdId === "chat:pageDown") {
          setChatCursor(prev => Math.min(chatMessages.length - 1, prev + 10))
          return
        }
        if (cmdId === "chat:home") {
          setChatCursor(0)
          return
        }
        if (cmdId === "chat:end") {
          setChatCursor(chatMessages.length - 1)
          return
        }
        if (cmdId === "chat:copy") {
          const msg = chatMessages[chatCursor]
          if (msg) {
            copyChatMessage(msg)
          }
          return
        }
        return
      }

      if (inputLayer === "chatSearch") {
        const cmdKey = toCommandKey(key)
        const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: activeTab, overlay: tuiState.overlay, searchActive: false, confirmActive: false })
        if (cmdId === "search:close") {
          closeChatSearch()
          return
        }
        if (cmdId === "search:action") {
          if (chatSearchResults.length > 0) {
            const result = chatSearchResults[chatSearchCursor]
            if (result) {
              void handleChatSearchResult(result)
            }
          } else {
            void executeChatSearch()
          }
          return
        }
        if (cmdId === "search:prev") {
          setChatSearchCursor(prev => Math.max(0, prev - 1))
          return
        }
        if (cmdId === "search:next") {
          setChatSearchCursor(prev => Math.min(chatSearchResults.length - 1, prev + 1))
          return
        }
        if (key.name === "backspace") {
          setChatSearchQuery(prev => prev.slice(0, -1))
          return
        }
        const ch = key.sequence
        if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
          setChatSearchQuery(prev => prev + ch)
          return
        }
        return
      }

      if (inputLayer === "home") {
        const cmdKey = toCommandKey(key)
        const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: "home", overlay: null, searchActive: false, confirmActive: false })
        if (cmdId === "quit") {
          renderer.destroy()
          return
        }
        if (cmdId === "homeDismiss") {
          setTuiState((prev) => applyNavigationEvent(prev, { type: "openWorkspace" }))
          return
        }
        return
      }

      const cmdKey = toCommandKey(key)
      const scope = toCommandScope({ screen: activeTab, overlay: tuiState.overlay, searchActive, confirmActive: Boolean(confirmState) })
      const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: activeTab, overlay: tuiState.overlay, searchActive, confirmActive: Boolean(confirmState) })

      if (cmdId === "quit") {
        renderer.destroy()
        return
      }

      if (cmdId === "help") {
        setTuiState((prev) => applyNavigationEvent(prev, { type: "openHome" }))
        return
      }

      if (cmdId === "search") {
        setSearchActive(true)
        setSearchQuery("")
        return
      }

      if (cmdId === "clearSearch" && searchQuery) {
        setSearchQuery("")
        return
      }

      if (cmdId === "nextTab") {
        switchTab("next")
        return
      }

      if (cmdId === "tab1") {
        switchTab("projects")
        return
      }

      if (cmdId === "tab2") {
        switchTab("sessions")
        return
      }

      if (cmdId === "reload") {
        clearTokenCache()
        refreshWorkspaceResources()
        if (activeTab === "projects") {
          projectsRef.current?.refresh()
        } else {
          sessionsRef.current?.refresh()
        }
        notify("Reload requested...")
        return
      }

      if (cmdId === "chatSearch") {
        openChatSearch()
        return
      }

      const handler = activeTab === "projects" ? projectsRef.current : sessionsRef.current
      handler?.handleKey(key)
    },
    [activeTab, cancelConfirm, cmdSet, confirmState, executeConfirm, notify, renderer, searchActive, searchQuery, isHome, switchTab, chatViewerOpen, chatMessages, chatCursor, closeChatViewer, copyChatMessage, chatSearchOpen, chatSearchResults, chatSearchCursor, closeChatSearch, executeChatSearch, handleChatSearchResult, openChatSearch, tuiState.overlay, refreshWorkspaceResources],
  )

  useKeyboard(handleGlobalKey)

  const handleNavigateToSessions = useCallback(
    (projectId: string) => {
      const navigation = getProjectSessionsNavigation(projectId)
      setSessionFilter(navigation.sessionFilter)
      setTuiState((prev) => applyNavigationEvent(prev, { type: "openWorkspace", activeTab: navigation.activeTab }))
      notify(navigation.status)
    },
    [notify],
  )

  const clearSessionFilter = useCallback(() => {
    setSessionFilter(null)
    notify("Cleared session filter")
  }, [notify])

  return (
    <box style={{ flexDirection: "column", padding: 1, flexGrow: 1 }}>
      <box flexDirection="column" marginBottom={1}>
        <box style={{ flexDirection: "row", gap: 2 }}>
          <text fg="#a5b4fc">OpenCode Metadata Manager (fork)</text>
          <text fg={PALETTE.muted}>|</text>
          <text fg={PALETTE.accent}>Global Tokens: </text>
          {globalTokenDisplay.kind === "known" ? (
            <>
              <text fg={PALETTE.success}>{formatTokenCount(globalTokenDisplay.summary.total.tokens.total)}</text>
              {globalTokenDisplay.summary.unknownSessions && globalTokenDisplay.summary.unknownSessions > 0 ? (
                <text fg={PALETTE.muted}> (+{globalTokenDisplay.summary.unknownSessions} unknown)</text>
              ) : null}
            </>
          ) : (
            <text fg={PALETTE.muted}>{globalTokenDisplay.label}</text>
          )}
        </box>
        <box style={{ flexDirection: "row", gap: 1 }}>
          <text fg={PALETTE.accent}>Storage:</text>
          <text fg={backend === "sqlite" || backend === "hybrid" ? PALETTE.info : PALETTE.muted}>
            {backend === "hybrid" ? "Hybrid" : backend === "sqlite" ? "SQLite" : "JSONL"}
          </text>
          <text fg={PALETTE.muted}>|</text>
          <text>
            {backend === "sqlite" || backend === "hybrid"
              ? `DB: ${formatDisplayPath(resolvedDbPath ?? "(default)")}`
              : `Root: ${formatDisplayPath(root)}`}
          </text>
        </box>
        <text>
          Tabs: [1] Projects [2] Sessions | Active: {activeTab} | Global: Tab switch, / search, X clear, R reload, Q quit, ? help
        </text>
        {sessionFilter ? <text fg="#a3e635">Session filter: {sessionFilter}</text> : null}
        {(backend === "sqlite" || backend === "hybrid") && sqliteWarning ? (
          <text fg={PALETTE.danger}>SQLite warning: {sqliteWarning}</text>
        ) : null}
      </box>

      {isHome
        ? null
        : searchActive || searchQuery
        ? <SearchBar active={searchActive} context={activeTab} query={searchQuery} />
        : null}

      {isHome ? (
        <HomeScreen model={homeDashboard} />
      ) : (
        <box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
          <ProjectsPanel
            ref={projectsRef}
            provider={provider}
            active={activeTab === "projects"}
            locked={Boolean(confirmState) || isHome}
            searchQuery={activeTab === "projects" ? searchQuery : ""}
            allProjects={allProjects}
            projectIndexLoaded={projectIndexLoaded}
            allSessions={allSessions}
            resourcePolicy={resourcePolicy}
            cmdSet={cmdSet}
            onRefresh={refreshWorkspaceResources}
            onNotify={notify}
            requestConfirm={requestConfirm}
            onNavigateToSessions={handleNavigateToSessions}
          />
          <SessionsPanel
            ref={sessionsRef}
            provider={provider}
            active={activeTab === "sessions"}
            locked={Boolean(confirmState) || isHome || chatViewerOpen || chatSearchOpen}
            projectFilter={sessionFilter}
            searchQuery={activeTab === "sessions" ? searchQuery : ""}
            globalTokenSummary={globalTokens}
            allProjects={allProjects}
            allSessions={allSessions}
            resourcePolicy={resourcePolicy}
            cmdSet={cmdSet}
            onRefresh={refreshWorkspaceResources}
            onNotify={notify}
            requestConfirm={requestConfirm}
            onClearFilter={clearSessionFilter}
            onOpenChatViewer={openChatViewer}
          />
        </box>
      )}

      {/* Chat Viewer Overlay */}
      {chatViewerOpen && chatSession ? (
        <ChatViewer
          session={chatSession}
          messages={chatMessages}
          cursor={chatCursor}
          onCursorChange={setChatCursor}
          loading={chatLoading}
          error={chatError}
          onClose={closeChatViewer}
          onHydrateMessage={hydrateMessage}
          onCopyMessage={copyChatMessage}
        />
      ) : null}

      {/* Chat Search Overlay */}
      {chatSearchOpen ? (
        <ChatSearchOverlay
          sessionFilter={sessionFilter}
          allSessions={allSessions}
          query={chatSearchQuery}
          searching={chatSearching}
          results={chatSearchResults}
          cursor={chatSearchCursor}
          onCursorChange={setChatSearchCursor}
        />
      ) : null}

      <StatusBar status={status} level={statusLevel} />
      {confirmState ? <ConfirmBar state={confirmState} busy={confirmBusy} /> : null}
    </box>
  )
}
