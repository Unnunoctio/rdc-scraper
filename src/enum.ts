export enum TimeUnit {
  SEC = 1000,
  MIN = 60000,
  HOUR = 3600000,
}

export enum ScheduleHour {
  AM_8 = '0 12 * * *',
  AM_10 = '0 14 * * *',
  PM_12 = '0 16 * * *',
  PM_2 = '0 18 * * *',
  PM_4 = '0 20 * * *',
  PM_6 = '0 22 * * *',
  PM_8 = '0 24 * * *',
}

export enum TimeHour {
  AM_8 = '08 AM',
  AM_10 = '10 AM',
  PM_12 = '12 PM',
  PM_2 = '02 PM',
  PM_4 = '04 PM',
  PM_6 = '06 PM',
  PM_8 = '08 PM',
}
