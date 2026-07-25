import type { GcsBridge } from '@shared/protocol'

declare global {
  interface Window {
    gcs: GcsBridge
  }
}

export {}
