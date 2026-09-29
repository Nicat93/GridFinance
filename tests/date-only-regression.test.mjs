import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filePath) => {
  const source = readFileSync(filePath, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  module._compile(outputText, filePath);
};

const loadTypeScript = (relativePath) => {
  const filePath = path.resolve(relativePath);
  const loaded = new Module(filePath);
  loaded.filename = filePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(filePath));
  const source = readFileSync(filePath, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  loaded._compile(outputText, filePath);
  return loaded.exports;
};

const { Frequency } = loadTypeScript('types.ts');
const dates = loadTypeScript('services/dateOnly.ts');
const clamp = (year, month, day) => new Date(year, month, 0).getDate() < day ? new Date(year, month, 0).getDate() : day;
const dateString = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

test('billing periods clamp days 1, 28, 29, 30, and 31 across month boundaries', () => {
  const transitions = [
    [2025, 1, 2], [2024, 1, 2], // January to February, non-leap and leap
    [2025, 2, 3], [2024, 2, 3], // February to March
    [2026, 4, 5],               // April to May
    [2025, 12, 1],              // December to January
  ];
  for (const [year, month, nextMonth] of transitions) {
    for (const cycleDay of [1, 28, 29, 30, 31]) {
      const startDay = clamp(year, month, cycleDay);
      const start = dates.dateOnlyToLocalDate(dateString(year, month, startDay));
      const period = dates.calculateBillingPeriod(start, cycleDay);
      assert.equal(dates.formatDateOnly(period.start), dateString(year, month, startDay), `${year}-${month}, day ${cycleDay} start`);

      const nextYear = month === 12 ? year + 1 : year;
      const nextStartDay = clamp(nextYear, nextMonth, cycleDay);
      const nextStart = new Date(nextYear, nextMonth - 1, nextStartDay);
      nextStart.setDate(nextStart.getDate() - 1);
      assert.equal(dates.formatDateOnly(period.end), dates.formatDateOnly(nextStart), `${year}-${month}, day ${cycleDay} end`);

      const nextPeriod = dates.calculateBillingPeriod(new Date(nextYear, nextMonth - 1, nextStartDay), cycleDay);
      assert.equal(dates.formatDateOnly(nextPeriod.start), dateString(nextYear, nextMonth, nextStartDay));
    }
  }
});

test('monthly recurrences remain anchored to days 29, 30, and 31', () => {
  for (const [anchor, february, march] of [
    ['2025-01-29', '2025-02-28', '2025-03-29'],
    ['2025-01-30', '2025-02-28', '2025-03-30'],
    ['2025-01-31', '2025-02-28', '2025-03-31'],
    ['2024-01-31', '2024-02-29', '2024-03-31'],
  ]) {
    assert.equal(dates.addDateOnly(anchor, Frequency.MONTHLY, 1), february);
    assert.equal(dates.addDateOnly(anchor, Frequency.MONTHLY, 2), march);
  }
});

test('February 29 yearly recurrence clamps in common years and returns in leap years', () => {
  assert.equal(dates.addDateOnly('2024-02-29', Frequency.YEARLY, 1), '2025-02-28');
  assert.equal(dates.addDateOnly('2024-02-29', Frequency.YEARLY, 4), '2028-02-29');
});

test('plan end date includes its calendar day and excludes the following day', () => {
  assert.equal(dates.isDateOnlyAfter('2025-02-28', '2025-02-28'), false);
  assert.equal(dates.isDateOnlyAfter('2025-03-01', '2025-02-28'), true);
});

test('date-only parsing and default dates use local calendar fields, not UTC serialization', () => {
  const oldTz = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const local = dates.dateOnlyToLocalDate('2026-01-01');
    assert.equal(dates.formatDateOnly(local), '2026-01-01');
    assert.equal(dates.todayDateOnly(new Date(2026, 0, 1, 0, 15)), '2026-01-01');
  } finally {
    if (oldTz === undefined) delete process.env.TZ;
    else process.env.TZ = oldTz;
  }
});
