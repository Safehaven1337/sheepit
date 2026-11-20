// In-memory handoff of a dropped file from a landing/tool page to /editor
// (client-side navigation keeps this module alive; nothing is persisted).
let pending: File | null = null

export function setPendingFile(f: File) {
  pending = f
}

export function takePendingFile() {
  const f = pending
  pending = null
  return f
}

export const ACCEPT = "image/*,.sheepit"

export const isProjectFile = (f: File) => f.name.toLowerCase().endsWith(".sheepit")
