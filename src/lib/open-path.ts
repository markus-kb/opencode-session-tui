import { execFile } from "node:child_process"

export function resolveOpenCommand(platform: string): string {
  if (platform === "darwin") return "open"
  if (platform === "win32") return "explorer.exe"
  return "xdg-open"
}

export function openPath(dirPath: string): Promise<void> {
  const cmd = resolveOpenCommand(process.platform)
  return new Promise((resolve, reject) => {
    execFile(cmd, [dirPath], (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}
