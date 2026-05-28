const test = require('node:test');
const assert = require('node:assert/strict');
const { createMyeongriEngine } = require('../test-support/create-myeongri-engine');

const svc = createMyeongriEngine();

test('timezone can shift birth date across KST boundary when birthTime is present', async () => {
  const withoutTimezone = await svc.getManse({
    birthDate: '2026-02-03',
    birthTime: '12:30',
    calendarType: 'solar',
  });
  const withTimezone = await svc.getManse({
    birthDate: '2026-02-03',
    birthTime: '12:30',
    calendarType: 'solar',
    timezone: 'America/Los_Angeles',
  });

  assert.equal(withoutTimezone.manse.month.branch.hanja, '丑');
  assert.equal(withTimezone.manse.month.branch.hanja, '寅');
});

test('timezone does not change birth date when birthTime is omitted', async () => {
  const out = await svc.getManse({
    birthDate: '1991-12-06',
    calendarType: 'solar',
    timezone: 'America/Los_Angeles',
  });

  assert.equal(out.manse.month.branch.hanja, '亥');
});
