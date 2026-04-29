import React from "react"

export const PALETTE = {
  primary: "#a5b4fc",
  accent: "#93c5fd",
  success: "#86efac",
  danger: "#fca5a5",
  info: "#38bdf8",
  key: "#fbbf24",
  muted: "#9ca3af",
} as const

type ChildrenProps = { children: React.ReactNode }

export const Section = ({ title, children }: { title: string } & ChildrenProps) => (
  <box title={title} style={{ border: true, padding: 1, marginBottom: 1, flexDirection: "column" }}>
    {children}
  </box>
)

export const SearchBar = ({
  active,
  context,
  query,
}: {
  active: boolean
  context: string
  query: string
}) => (
  <box style={{ border: true, padding: 1, marginBottom: 1, flexDirection: "row", gap: 1 }}>
    <text fg={PALETTE.accent}>Search</text>
    <text>({context}):</text>
    <text fg={active ? PALETTE.key : PALETTE.muted}>{active ? "/" + query : query || "(none)"}</text>
    <text>—</text>
    <text>Enter apply</text>
    <text>•</text>
    <text>Esc clear</text>
  </box>
)

export const Row = ({ children }: ChildrenProps) => {
  const kids = React.Children.toArray(children).filter((c) => !(typeof c === "string" && c.trim() === ""))
  return <box style={{ flexDirection: "row", alignItems: "baseline" }}>{kids as any}</box>
}

export const Bullet = ({ children }: ChildrenProps) => {
  const kids = React.Children.toArray(children).filter((c) => !(typeof c === "string" && c.trim() === ""))
  return (
    <Row>
      <text fg={PALETTE.muted}>• </text>
      <box style={{ flexDirection: "row", flexWrap: "wrap" }}>{kids as any}</box>
    </Row>
  )
}

export const Columns = ({ children }: ChildrenProps) => {
  const kids = React.Children.toArray(children).filter((c) => !(typeof c === "string" && c.trim() === ""))
  return <box style={{ flexDirection: "row", gap: 2, marginTop: 1, flexGrow: 1 }}>{kids as any}</box>
}

export const KeyChip = ({ k }: { k: string }) => <text fg={PALETTE.key}>[{k}]</text>

export const OverlayFrame = ({
  title,
  borderColor,
  children,
}: {
  title: string
  borderColor: string
} & ChildrenProps) => (
  <box
    title={title}
    style={{
      position: "absolute",
      top: 2,
      left: 2,
      right: 2,
      bottom: 2,
      border: true,
      borderColor,
      flexDirection: "column",
      padding: 1,
      zIndex: 200,
    }}
    backgroundColor="#1a1a2e"
  >
    {children}
  </box>
)
