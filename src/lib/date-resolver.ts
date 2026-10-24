// A line-for-line port of ZenFlow's DateResolver.java (github.com/shadowfax-505/Zenflow, com.zenflow.ai).
// The model copies the day phrase from the user's own words; this turns it into a date, where arithmetic cannot drift.

/** A calendar date with no time or time zone. */
export type Day = { year: number; month: number; day: number };

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const IN_N = /^in (\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten) (day|days|week|weeks)$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MONTH = /^(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+)(?:,? (\d{4}))?$/;
const MONTH_DAY = /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/;

const toUtc = (d: Day) => Date.UTC(d.year, d.month - 1, d.day);
const fromUtc = (ms: number): Day => { const t = new Date(ms); return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }; };
const plusDays = (d: Day, n: number) => fromUtc(toUtc(d) + n * 86_400_000);
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
// Like java.time: an out-of-range day clamps to the month's last day (31 Jan + 1 month = 28/29 Feb).
const plusMonths = (d: Day, n: number): Day => { const index = d.year * 12 + d.month - 1 + n; const year = Math.floor(index / 12), month = index % 12 + 1; return { year, month, day: Math.min(d.day, daysInMonth(year, month)) }; };
/** 0 = Monday … 6 = Sunday, as java.time.DayOfWeek. */
const weekday = (d: Day) => (new Date(toUtc(d)).getUTCDay() + 6) % 7;
/** The next date after `d` that falls on weekday `w` (TemporalAdjusters.next). */
const next = (d: Day, w: number) => plusDays(d, ((w - weekday(d) + 6) % 7) + 1);
const valid = (year: number, month: number, day: number) => month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
const before = (a: Day, b: Day) => toUtc(a) < toUtc(b);

/** The date the phrase means, or null when it is blank or not understood. */
export function resolve(phrase: string | null | undefined, today: Day): Day | null {
  if (phrase == null) return null;
  let p = phrase.toLowerCase().replace(/[.,!]/g, ' ').replace(/\s+/g, ' ').trim();
  p = p.replace(/^(on|by|due|before|for|until) /, '');
  const thisWeek = p.startsWith('this ');
  const nextWeek = p.startsWith('next ');
  if (thisWeek || nextWeek) p = p.slice(5);
  p = p.replace(/ (morning|afternoon|evening|night)$/, '');
  if (!p) return null;

  switch (p) {
    case 'today': case 'tonight': case 'now': case 'morning': case 'afternoon': case 'evening': case 'later': case 'later today': return today;
    case 'tomorrow': case 'tmrw': return plusDays(today, 1);
    case 'day after tomorrow': case 'the day after tomorrow': return plusDays(today, 2);
    case 'week': return nextWeek ? plusDays(today, 7) : null;
    case 'month': return nextWeek ? plusMonths(today, 1) : null;
    case 'weekend': return weekday(today) === 5 && thisWeek ? today : next(today, 5);
  }
  for (let w = 0; w < 7; w++) {
    const name = DAY_NAMES[w];
    // "this Friday" on a Friday is today; otherwise the coming one.
    if (p === name || p === name.slice(0, 3)) return thisWeek && weekday(today) === w ? today : next(today, w);
  }
  let m: RegExpMatchArray | null;
  if (!nextWeek && (m = p.match(IN_N))) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBERS[m[1]];
    return m[2].startsWith('week') ? plusDays(today, 7 * n) : plusDays(today, n);
  }
  if ((m = p.match(ISO))) return valid(+m[1], +m[2], +m[3]) ? { year: +m[1], month: +m[2], day: +m[3] } : null;
  if ((m = p.match(DAY_MONTH))) return dayMonth(m[1], m[2], m[3], today);
  if ((m = p.match(MONTH_DAY))) return dayMonth(m[2], m[1], m[3], today);
  return null;
}

function dayMonth(day: string, monthName: string, year: string | undefined, today: Day): Day | null {
  let month = 0;
  MONTHS.forEach((full, i) => { if (monthName === full || monthName === full.slice(0, 3) || (monthName === 'sept' && i === 8)) month = i + 1; });
  if (!month) return null;
  const y = year === undefined ? today.year : Number(year);
  if (!valid(y, month, Number(day))) return null;
  const d = { year: y, month, day: Number(day) };
  // "3 March" said in October means next March.
  return year === undefined && before(d, today) ? plusMonths(d, 12) : d;
}
