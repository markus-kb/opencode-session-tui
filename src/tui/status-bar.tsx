export type NotificationLevel = "info" | "error"

export const StatusBar = ({ status, level }: { status: string; level: NotificationLevel }) => (
  <box
    style={{
      border: true,
      borderColor: level === "error" ? "#ef4444" : "#3b82f6",
      paddingLeft: 1,
      paddingRight: 1,
      height: 3,
      marginTop: 1,
    }}
  >
    <text fg={level === "error" ? "#ef4444" : "#38bdf8"}>{status}</text>
  </box>
)
