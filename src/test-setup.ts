import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

/** The Storage API over a Map, standing in for the browser's localStorage */
class MemoryStorage {
  private entries = new Map<string, string>()

  get length() {
    return this.entries.size
  }
  clear() {
    this.entries.clear()
  }
  getItem(key: string) {
    return this.entries.get(key) ?? null
  }
  key(index: number) {
    return [...this.entries.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.entries.delete(key)
  }
  setItem(key: string, value: string) {
    this.entries.set(key, String(value))
  }
}

// Every test starts with an empty, working localStorage. jsdom provides one,
// but Node 25 shadows it with its own unconfigured global that has no methods,
// and in any case a workspace saved by one test must not show up in the next.
beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
})
