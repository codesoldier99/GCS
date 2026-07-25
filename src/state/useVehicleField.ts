import { useVehicle } from './vehicleStore'
import type { TelemetryFrame } from '@shared/telemetry'

/**
 * 从遥测帧中取一个字段并订阅。返回基本类型时 zustand 用 Object.is 比较，
 * 值不变则不触发重渲染 —— 天然降频，适合高频遥测。
 */
export function useVehicleField<T>(selector: (f: TelemetryFrame) => T): T {
  return useVehicle((s) => selector(s.frame))
}
