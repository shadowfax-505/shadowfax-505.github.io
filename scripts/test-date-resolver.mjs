// The cases from ZenFlow's DateResolverTest.java, run against the browser port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from '../src/lib/date-resolver.ts';

const SAT = { year: 2026, month: 10, day: 24 }; // a Saturday
const r = phrase => { const d = resolve(phrase, SAT); return d && `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`; };

test('relative days', () => {
  assert.equal(r('today'), '2026-10-24');
  assert.equal(r('tonight'), '2026-10-24');
  assert.equal(r('tomorrow'), '2026-10-25');
  assert.equal(r('tomorrow morning'), '2026-10-25');
  assert.equal(r('the day after tomorrow'), '2026-10-26');
  assert.equal(r('in 3 days'), '2026-10-27');
  assert.equal(r('in three days'), '2026-10-27');
  assert.equal(r('in two weeks'), '2026-11-07');
  assert.equal(r('next week'), '2026-10-31');
});
test('weekdays are the coming one', () => {
  assert.equal(r('on Friday'), '2026-10-30');
  assert.equal(r('Fri'), '2026-10-30');
  assert.equal(r('next Monday'), '2026-10-26');
  assert.equal(r('this Saturday'), '2026-10-24');
  assert.equal(r('Saturday'), '2026-10-31');
  assert.equal(r('this weekend'), '2026-10-24');
});
test('calendar dates', () => {
  assert.equal(r('15 November'), '2026-11-15');
  assert.equal(r('November 15th'), '2026-11-15');
  assert.equal(r('3rd of March'), '2027-03-03', 'a past month means next year');
  assert.equal(r('2026-12-01'), '2026-12-01');
  assert.equal(r('Jan 5, 2027'), '2027-01-05');
});
test('unknown or blank is empty', () => {
  assert.equal(r(''), null);
  assert.equal(r('someday'), null);
  assert.equal(r('31 February'), null);
});
