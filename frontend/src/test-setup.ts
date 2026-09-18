import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup) // not automatic while vitest globals are off, and tests would see each other's DOM

// jsdom has no layout engine, so these browser APIs Leaflet relies on need stand-ins.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
