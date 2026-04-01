import { isSaturday, isSunday, eachDayOfInterval, format } from "date-fns";

export type PeriodType = 'full_day' | 'partial';

export interface DatePeriod {
  from: Date;
  to: Date;
  periodType: PeriodType;
  startTime?: string; // HH:MM format, e.g. "09:00"
  endTime?: string;   // HH:MM format, e.g. "13:00"
  businessDays?: number; // Pre-calculated for partial periods
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  year: number;
  is_national: boolean;
}

/**
 * Available hours for time selection (hourly intervals)
 */
export const AVAILABLE_HOURS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00"
];

/**
 * Calculate hours between two time strings
 */
export const calculateHoursBetween = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;
  return (endTotalMinutes - startTotalMinutes) / 60;
};

/**
 * Calculate business days from hours (8 hours = 1 day)
 * Rounds to nearest 0.25 (2h=0.25, 4h=0.5, 6h=0.75, 8h=1.0)
 */
export const calculateBusinessDaysFromHours = (hours: number): number => {
  const rawDays = hours / 8;
  return Math.round(rawDays * 4) / 4; // Round to nearest 0.25
};

/**
 * Format time range for display
 */
export const formatTimeRange = (startTime: string, endTime: string): string => {
  return `${startTime}-${endTime}`;
};

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export const isWeekend = (date: Date): boolean => {
  return isSaturday(date) || isSunday(date);
};

/**
 * Check if a date is a holiday
 */
export const isHoliday = (date: Date, holidays: Holiday[]): Holiday | undefined => {
  const dateStr = format(date, "yyyy-MM-dd");
  return holidays.find(h => h.date === dateStr);
};

/**
 * Check if a date is a business day (not weekend and not holiday)
 */
export const isBusinessDay = (date: Date, holidays: Holiday[]): boolean => {
  return !isWeekend(date) && !isHoliday(date, holidays);
};

/**
 * Count business days between two dates (inclusive)
 */
export const countBusinessDays = (
  startDate: Date,
  endDate: Date,
  holidays: Holiday[]
): number => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter(day => isBusinessDay(day, holidays)).length;
};

/**
 * Count total business days for multiple periods
 */
export const countTotalBusinessDays = (
  periods: DatePeriod[],
  holidays: Holiday[]
): number => {
  return periods.reduce((total, period) => {
    return total + countBusinessDays(period.from, period.to, holidays);
  }, 0);
};

/**
 * Get business days breakdown for a period
 */
export const getBusinessDaysBreakdown = (
  startDate: Date,
  endDate: Date,
  holidays: Holiday[]
): { total: number; weekends: number; holidays: number; businessDays: number } => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  let weekends = 0;
  let holidayCount = 0;
  let businessDays = 0;
  
  days.forEach(day => {
    if (isWeekend(day)) {
      weekends++;
    } else if (isHoliday(day, holidays)) {
      holidayCount++;
    } else {
      businessDays++;
    }
  });
  
  return {
    total: days.length,
    weekends,
    holidays: holidayCount,
    businessDays,
  };
};
