import { Temporal } from 'temporal-polyfill';

const PERMAVENT_WEEKLY_REPORT_TIME_ZONE = 'Europe/London';

export type PermaventWeeklyReportWindow = {
  generatedAt: Date;
  start: Date;
  timeZone: typeof PERMAVENT_WEEKLY_REPORT_TIME_ZONE;
};

export const getPermaventLondonWeekWindow = (
  generatedAt = new Date(),
): PermaventWeeklyReportWindow => {
  const generatedInstant = Temporal.Instant.fromEpochMilliseconds(
    generatedAt.getTime(),
  );
  const londonNow = generatedInstant.toZonedDateTimeISO(
    PERMAVENT_WEEKLY_REPORT_TIME_ZONE,
  );
  const londonMonday = londonNow
    .subtract({ days: londonNow.dayOfWeek - 1 })
    .startOfDay();

  return {
    generatedAt,
    start: new Date(londonMonday.toInstant().epochMilliseconds),
    timeZone: PERMAVENT_WEEKLY_REPORT_TIME_ZONE,
  };
};
