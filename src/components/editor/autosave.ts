"use client"

// Crash/refresh protection: the open project is saved as a .sheepit blob in
// IndexedDB (on this device only) a moment after every change.
import * as React from "react"
import { useEditor } from "@/lib/editor/store"
import { saveProject } from "@/lib/editor/project"

const DB = "sheepit"
const STORE = "autosave"
const KEY = "last"

export interface AutosaveEntry {
  blob: Blob
  name: string
  time: number
  thumb: string | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export async function readAutosave(): Promise<AutosaveEntry | null> {
  try {
    return ((await tx("readonly", (s) => s.get(KEY))) as AutosaveEntry | undefined) ?? null
  } catch {
    return null
  }
}

export async function clearAutosave() {
  try {
    await tx("readwrite", (s) => s.delete(KEY))
  } catch {
    /* private mode etc. */
  }
}

function thumbnail(): string | null {
  const c = document.querySelector<HTMLCanvasElement>("[data-viewport] canvas")
  if (!c || !c.width) return null
  const k = Math.min(1, 240 / Math.max(c.width, c.height))
  const t = document.createElement("canvas")
  t.width = Math.round(c.width * k)
  t.height = Math.round(c.height * k)
  const x = t.getContext("2d")!
  x.fillStyle = "#222"
  x.fillRect(0, 0, t.width, t.height)
  x.drawImage(c, 0, 0, t.width, t.height)
  return t.toDataURL("image/jpeg", 0.7)
}

/** Saves the document ~2 s after the last change. */
export function useAutosave() {
  const doc = useEditor((s) => s.doc)
  const ready = useEditor((s) => s.ready)
  const dirty = useEditor((s) => s.dirty)
  React.useEffect(() => {
    if (!ready || !dirty) return
    const t = setTimeout(async () => {
      try {
        const s = useEditor.getState()
        const blob = await saveProject(s.doc, s.assets, { preview: false })
        const entry: AutosaveEntry = { blob, name: s.doc.name, time: Date.now(), thumb: thumbnail() }
        await tx("readwrite", (st) => st.put(entry, KEY))
      } catch {
        /* storage full or unavailable – autosave is best effort */
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [doc, ready, dirty])
}
