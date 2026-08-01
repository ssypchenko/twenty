import { getPermaventLondonWeekWindow } from 'src/modules/permavent-weekly-sales-report/utils/get-permavent-london-week-window.util';

describe('getPermaventLondonWeekWindow', () => {
  it('starts the week at London Monday midnight during BST', () => {
    const generatedAt = new Date('2026-08-01T10:30:00.000Z');

    expect(getPermaventLondonWeekWindow(generatedAt)).toEqual({
      generatedAt,
      start: new Date('2026-07-26T23:00:00.000Z'),
      timeZone: 'Europe/London',
    });
  });

  it('starts the week at London Monday midnight during GMT', () => {
    const generatedAt = new Date('2026-01-07T10:30:00.000Z');

    expect(getPermaventLondonWeekWindow(generatedAt)).toEqual({
      generatedAt,
      start: new Date('2026-01-05T00:00:00.000Z'),
      timeZone: 'Europe/London',
    });
  });
});
