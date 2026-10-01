import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup) // not automatic while vitest globals are off, and tests would see each other's DOM

// jsdom has no layout engine, so these browser APIs Leaflet relies on need stand-ins.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom has no canvas either, and complains loudly every time one is asked for. The map asks for WebGL
// to decide whether it can draw tiles at all, and "no" is the right answer here — it just says so quietly.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
