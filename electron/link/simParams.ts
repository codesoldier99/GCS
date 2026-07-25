// 仿真飞控参数默认值（ArduCopter 风格子集，供调参页与装机向导演示）。
// 单位遵循 ArduPilot：RTL_ALT/FENCE_* 为 cm/…，电压为 V，速度为 cm/s 等。

export const DEFAULT_PARAMS: Record<string, number> = {
  // 机架
  FRAME_CLASS: 2, // 1=四轴 2=六轴 3=八轴 4=八轴四臂
  FRAME_TYPE: 1, // 0=+ 1=X

  // 返航 / 航点速度
  RTL_ALT: 6000, // cm
  RTL_SPEED: 1000, // cm/s
  RTL_LOIT_TIME: 5000,
  WPNAV_SPEED: 800,
  WPNAV_SPEED_UP: 250,
  WPNAV_SPEED_DN: 150,
  WPNAV_RADIUS: 200,
  LAND_SPEED: 50,

  // 电压保护
  BATT_LOW_VOLT: 21.6,
  BATT_CRT_VOLT: 20.4,
  BATT_LOW_TIMER: 10,
  BATT_FS_LOW_ACT: 2, // 0=无 1=降落 2=返航
  BATT_FS_CRT_ACT: 1,
  BATT_CAPACITY: 10000,

  // 电子围栏
  FENCE_ENABLE: 0,
  FENCE_TYPE: 7,
  FENCE_RADIUS: 300,
  FENCE_ALT_MAX: 120,
  FENCE_ACTION: 1, // 1=返航或降落

  // 失控保护
  FS_THR_ENABLE: 1, // 0=禁用 1=返航 2=继续任务 3=降落
  FS_THR_VALUE: 975,
  FS_GCS_ENABLE: 1,
  FS_EKF_ACTION: 1,

  // 飞行模式（通道5 六段）
  FLTMODE_CH: 5,
  FLTMODE1: 0, // 姿态
  FLTMODE2: 2, // 定高
  FLTMODE3: 5, // GPS(Loiter)
  FLTMODE4: 16, // 定点
  FLTMODE5: 6, // 返航
  FLTMODE6: 3, // 自动

  // 安装方向 / 位置偏移
  AHRS_ORIENTATION: 0,
  INS_POS1_X: 0,
  INS_POS1_Y: 0,
  INS_POS1_Z: 0,
  GPS_POS1_X: 0,
  GPS_POS1_Y: 0,
  GPS_POS1_Z: -0.2,
  GPS_POS2_X: 0,
  GPS_POS2_Y: 0,
  GPS_POS2_Z: -0.2,

  // 罗盘
  COMPASS_USE: 1,
  COMPASS_USE2: 1,
  COMPASS_OFS_X: 12,
  COMPASS_OFS_Y: -8,
  COMPASS_OFS_Z: 5,

  // 姿态控制（常见调参项）
  ANGLE_MAX: 3000,
  PILOT_SPEED_UP: 250,
  PILOT_SPEED_DN: 150,
  ATC_ANG_RLL_P: 4.5,
  ATC_ANG_PIT_P: 4.5,
  ATC_ANG_YAW_P: 4.5,
  ATC_RAT_RLL_P: 0.135,
  ATC_RAT_RLL_I: 0.135,
  ATC_RAT_RLL_D: 0.0036,
  ATC_RAT_PIT_P: 0.135,
  ATC_RAT_PIT_I: 0.135,
  ATC_RAT_PIT_D: 0.0036,
  ATC_RAT_YAW_P: 0.18,
  MOT_SPIN_ARM: 0.1,
  MOT_SPIN_MIN: 0.15,
  MOT_SPIN_MAX: 0.95,
  MOT_THST_EXPO: 0.65,
  MOT_PWM_TYPE: 0,

  // 遥控行程（前 4 通道）
  RC1_MIN: 1000,
  RC1_MAX: 2000,
  RC1_TRIM: 1500,
  RC2_MIN: 1000,
  RC2_MAX: 2000,
  RC2_TRIM: 1500,
  RC3_MIN: 1000,
  RC3_MAX: 2000,
  RC3_TRIM: 1500,
  RC3_DZ: 30,
  RC4_MIN: 1000,
  RC4_MAX: 2000,
  RC4_TRIM: 1500,

  // 其他
  INS_ACCEL_FILTER: 20,
  AHRS_EKF_TYPE: 3,
  GPS_TYPE: 1,
  SERIAL1_BAUD: 115,
  SR1_EXTRA1: 10,
  LOG_BITMASK: 176126
}
