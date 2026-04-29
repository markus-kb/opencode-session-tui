export type ConfirmState = {
  title: string
  details?: string[]
  actionLabel?: string
  onConfirm: () => Promise<void> | void
}

export const ConfirmBar = ({ state, busy }: { state: ConfirmState; busy: boolean }) => (
  <box
    style={{
      border: true,
      borderColor: "#f97316",
      flexDirection: "column",
      marginTop: 1,
      padding: 1,
    }}
  >
    <text fg="#f97316">{state.title}</text>
    {state.details?.map((detail, idx) => (
      <text key={idx}>{detail}</text>
    ))}
    <text>{busy ? "Working..." : "Press Y/Enter to confirm, N/Esc to cancel"}</text>
  </box>
)
