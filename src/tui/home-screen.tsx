import { Bullet, Columns, KeyChip, PALETTE, Section } from "./components"
import type { HomeDashboardModel } from "./home-dashboard"

export const HomeScreen = ({ model }: { model: HomeDashboardModel }) => (
  <box style={{ flexDirection: "column", flexGrow: 1, padding: 2, border: true }}>
    <text fg={PALETTE.primary}>{model.title}</text>
    <text fg={PALETTE.muted}>{model.subtitle}</text>
    <Columns>
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <Section title="Storage">
          {model.storage.map((item) => (
            <Bullet key={item.label}>
              <text fg={PALETTE.accent}>{item.label}: </text>
              <text>{item.value}</text>
            </Bullet>
          ))}
        </Section>
        <Section title="Library">
          {model.library.map((item) => (
            <Bullet key={item.label}>
              <text fg={PALETTE.accent}>{item.label}: </text>
              <text>{item.value}</text>
            </Bullet>
          ))}
        </Section>
      </box>
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <Section title="Primary Actions">
          {model.actions.map((action) => (
            <Bullet key={action.key}>
              <KeyChip k={action.key} />
              <text> — {action.label}</text>
            </Bullet>
          ))}
        </Section>
        <Section title="Status">
          <Bullet>
            <text>Workspace reads are deferred on this screen.</text>
          </Bullet>
          <Bullet>
            <text>Open the workspace to load project and session metadata.</text>
          </Bullet>
        </Section>
      </box>
    </Columns>
  </box>
)
