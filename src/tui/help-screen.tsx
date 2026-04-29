import React from "react"
import { Bullet, Columns, KeyChip, PALETTE, Section } from "./components"
import type { ScopedKeySection, TuiCommandSet } from "./command-definitions"

const SCOPE_SECTION_TITLES: Record<string, string> = {
  home: "Home",
  global: "Global",
  projects: "Projects",
  sessions: "Sessions",
  chat: "Chat Viewer",
  search: "Chat Search",
  confirm: "Confirm",
}

export const HelpScreen = ({ cmdSet }: { cmdSet: TuiCommandSet }) => {
  const sections = cmdSet.getScopedKeyReference()
  const leftSections = sections.filter(s => s.scope === "home" || s.scope === "global" || s.scope === "projects")
  const rightSections = sections.filter(s => s.scope === "sessions" || s.scope === "chat" || s.scope === "search" || s.scope === "confirm")

  const renderSection = (section: ScopedKeySection) => (
    <Section title={SCOPE_SECTION_TITLES[section.scope] ?? section.scope}>
      {section.commands.map((cmd) => (
        <Bullet key={cmd.id}>
          {cmd.keys.map((k, i) => (
            <React.Fragment key={k}>
              {i > 0 && <text> / </text>}
              <KeyChip k={k} />
            </React.Fragment>
          ))}
          <text> — {cmd.label}</text>
        </Bullet>
      ))}
    </Section>
  )

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, padding: 2, border: true }}>
      <text fg={PALETTE.primary}>OpenCode Metadata Manager (fork) — Help</text>
      <text fg={PALETTE.muted}>Quick reference for keys and actions</text>
      <Columns>
        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          {leftSections.map(renderSection)}
          <Section title="Tips">
            <Bullet>
              <text>Use </text> <KeyChip k="M" /> <text> to quickly isolate missing projects.</text>
            </Bullet>
            <Bullet>
              <text>Press </text> <KeyChip k="R" /> <text> to refresh after cleanup.</text>
            </Bullet>
            <Bullet>
              <text>Dismiss help with </text> <KeyChip k="Enter" /> <text> or </text> <KeyChip k="Esc" />
            </Bullet>
          </Section>
        </box>
        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          {rightSections.map(renderSection)}
        </box>
      </Columns>
      <text fg={PALETTE.info}>Press Enter or Esc to dismiss this screen.</text>
    </box>
  )
}
