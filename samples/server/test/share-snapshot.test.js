const test = require('node:test');
const assert = require('node:assert/strict');
const { ShareSnapshotService } = require('../dist/share-snapshot/share-snapshot.service');

const ShareSnapshotType = {
  SAJU_SUMMARY: 'SAJU_SUMMARY',
  TODAY_FORTUNE: 'TODAY_FORTUNE',
  MONTHLY_FORTUNE: 'MONTHLY_FORTUNE',
  YEARLY_FORTUNE: 'YEARLY_FORTUNE',
  DECADE_FORTUNE: 'DECADE_FORTUNE',
};

const ShareSnapshotStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  DELETED: 'DELETED',
};

function createService(overrides = {}) {
  const prismaCalls = {
    created: [],
    findFirst: [],
    update: [],
  };

  const prismaService =
    overrides.prismaService ??
    {
      shareSnapshot: {
        create: async ({ data }) => {
          prismaCalls.created.push(data);
          return {
            id: 'snapshot-id',
            shareId: data.shareId,
            ...data,
            createdAt: new Date('2026-05-21T12:00:00.000Z'),
            updatedAt: new Date('2026-05-21T12:00:00.000Z'),
            deletedAt: null,
            viewCount: 0,
            lastViewedAt: null,
          };
        },
        findFirst: async (query) => {
          prismaCalls.findFirst.push(query);
          return overrides.snapshotRow ?? null;
        },
        update: async ({ where, data }) => {
          prismaCalls.update.push({ where, data });
          return {
            ...(overrides.snapshotRow ?? {}),
            ...data,
            viewCount: overrides.updatedViewCount ?? 1,
          };
        },
      },
    };

  const sajuSummaryReportService =
    overrides.sajuSummaryReportService ??
    {
      getSajuSummaryReport: async (input) => ({
        report: {
          version: 'v1',
          tone: 'balanced',
          overall: {
            key: 'overall',
            title: `공유 제목 ${input.birthDate}`,
            summary: '공유 요약 문장',
            details: [],
            highlights: [],
            evidence: {},
          },
          sections: [],
        },
        meta: {
          birthDate: input.birthDate,
          birthTime: input.birthTime,
          gender: input.gender,
        },
      }),
    };

  const fortuneService =
    overrides.fortuneService ??
    {
      getTodayFortune: async () => ({
        todayFortune: {
          headline: '오늘 제목',
          summary: '오늘 요약',
          luckScore: 72,
        },
        meta: {},
      }),
      getMonthlyFortuneReading: async () => ({
        monthlyReading: {
          headline: '월운 제목',
          summary: '월운 요약',
          luckScore: 64,
        },
        meta: {},
      }),
      getYearlyFortuneReading: async () => ({
        yearlyReading: {
          headline: '세운 제목',
          summary: '세운 요약',
          luckScore: 81,
        },
        meta: {},
      }),
      getDecadeFortuneReading: async () => ({
        decadeReading: {
          headline: '대운 제목',
          summary: '대운 요약',
          luckScore: 59,
        },
        meta: {},
      }),
    };

  return {
    service: new ShareSnapshotService(prismaService, sajuSummaryReportService, fortuneService),
    prismaCalls,
  };
}

test('createSnapshot regenerates a saju summary report on the server and stores the response', async () => {
  const { service, prismaCalls } = createService();

  const result = await service.createSnapshot(
    'user-1',
    {
      type: ShareSnapshotType.SAJU_SUMMARY,
      input: {
        birthDate: '1991-12-06',
        birthTime: '13:51',
        calendarType: 'solar',
        gender: 'male',
      },
      options: {
        includeBirthInfo: false,
        includeManse: false,
      },
      sourceId: 'profile-1',
    },
  );

  assert.equal(result.success, true);
  assert.equal(typeof result.shareId, 'string');
  assert.equal(prismaCalls.created.length, 1);

  const created = prismaCalls.created[0];
  assert.equal(created.type, ShareSnapshotType.SAJU_SUMMARY);
  assert.deepEqual(created.user, { connect: { id: 'user-1' } });
  assert.equal(created.sourceId, 'profile-1');
  assert.equal(created.title, '공유 제목 1991-12-06');
  assert.equal(created.summary, '공유 요약 문장');
  assert.equal(created.inputJson.birthDate, '1991-12-06');
  assert.equal(created.resultJson.report.overall.title, '공유 제목 1991-12-06');
  assert.deepEqual(created.optionsJson, {
    includeBirthInfo: false,
    includeManse: false,
    includeScore: true,
    includeOwnerName: false,
  });
});

test('getSnapshotTypes lists every enum value and separates create support', () => {
  const { service } = createService();

  const result = service.getSnapshotTypes();
  const types = result.types.map((item) => item.type);
  const unsupported = result.types.filter((item) => !item.createSupported).map((item) => item.type);

  assert.equal(result.success, true);
  assert.deepEqual(types, [
    ShareSnapshotType.SAJU_SUMMARY,
    ShareSnapshotType.TODAY_FORTUNE,
    ShareSnapshotType.MONTHLY_FORTUNE,
    ShareSnapshotType.YEARLY_FORTUNE,
    ShareSnapshotType.DECADE_FORTUNE,
  ]);
  assert.deepEqual(unsupported, []);
});

test('createSnapshot supports every existing result API type through one storage pipeline', async () => {
  const { service, prismaCalls } = createService();
  const cases = [
    {
      type: ShareSnapshotType.TODAY_FORTUNE,
      input: { birthDate: '1991-12-06', calendarType: 'solar' },
      expectedTitle: '오늘 제목',
      expectedSummary: '오늘 요약',
      expectedScore: 72,
      expectedResultKey: 'todayFortune',
    },
    {
      type: ShareSnapshotType.MONTHLY_FORTUNE,
      input: {
        birthDate: '1991-12-06',
        calendarType: 'solar',
        algoKey: 'balanced_v1',
        targetYear: 2026,
        targetMonth: 5,
      },
      expectedTitle: '월운 제목',
      expectedSummary: '월운 요약',
      expectedScore: 64,
      expectedResultKey: 'monthlyReading',
    },
    {
      type: ShareSnapshotType.YEARLY_FORTUNE,
      input: {
        birthDate: '1991-12-06',
        calendarType: 'solar',
        algoKey: 'balanced_v1',
        targetYear: 2026,
      },
      expectedTitle: '세운 제목',
      expectedSummary: '세운 요약',
      expectedScore: 81,
      expectedResultKey: 'yearlyReading',
    },
    {
      type: ShareSnapshotType.DECADE_FORTUNE,
      input: {
        birthDate: '1991-12-06',
        calendarType: 'solar',
        gender: 'male',
        algoKey: 'balanced_v1',
        targetDecadeStartYear: 2031,
      },
      expectedTitle: '대운 제목',
      expectedSummary: '대운 요약',
      expectedScore: 59,
      expectedResultKey: 'decadeReading',
    },
  ];

  for (const item of cases) {
    await service.createSnapshot('user-1', {
      type: item.type,
      input: item.input,
      options: {},
    });
  }

  assert.equal(prismaCalls.created.length, cases.length);
  cases.forEach((item, index) => {
    const created = prismaCalls.created[index];
    assert.equal(created.type, item.type);
    assert.equal(created.title, item.expectedTitle);
    assert.equal(created.summary, item.expectedSummary);
    assert.equal(created.score, item.expectedScore);
    assert.ok(created.resultJson[item.expectedResultKey]);
  });
});

test('getPublicSnapshot increments views and masks private birth data by default', async () => {
  const snapshotRow = {
    id: 'snapshot-id',
    shareId: 'share-1',
    type: ShareSnapshotType.SAJU_SUMMARY,
    status: ShareSnapshotStatus.ACTIVE,
    userId: null,
    sourceId: null,
    title: '공유 제목',
    summary: '공유 요약',
    score: 88,
    optionsJson: {
      includeBirthInfo: false,
      includeManse: false,
      includeScore: false,
      includeOwnerName: false,
    },
    inputJson: {
      birthDate: '1991-12-06',
      birthTime: '13:51',
      gender: 'male',
    },
    resultJson: {
      report: {
        overall: {
          title: '공유 제목',
          summary: '공유 요약',
        },
      },
      meta: {
        birthDate: '1991-12-06',
        birthTime: '13:51',
        gender: 'male',
        manse: {
          day: 'sample',
        },
      },
    },
    renderJson: null,
    ogTitle: null,
    ogDescription: null,
    ogImageUrl: null,
    viewCount: 7,
    lastViewedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-05-21T12:00:00.000Z'),
    updatedAt: new Date('2026-05-21T12:00:00.000Z'),
    deletedAt: null,
  };
  const { service, prismaCalls } = createService({
    snapshotRow,
    updatedViewCount: 8,
  });

  const result = await service.getPublicSnapshot('share-1');

  assert.equal(result.success, true);
  assert.equal(result.snapshot.shareId, 'share-1');
  assert.equal(result.snapshot.viewCount, 8);
  assert.equal(result.snapshot.score, undefined);
  assert.equal(result.snapshot.data.input, undefined);
  assert.equal(result.snapshot.data.result.meta.birthDate, undefined);
  assert.equal(result.snapshot.data.result.meta.birthTime, undefined);
  assert.equal(result.snapshot.data.result.meta.gender, undefined);
  assert.equal(result.snapshot.data.result.meta.manse, undefined);
  assert.equal(prismaCalls.findFirst[0].where.shareId, 'share-1');
  assert.deepEqual(prismaCalls.update[0].where, { id: 'snapshot-id' });
});

test('getOgMeta returns stored OG metadata without changing view count', async () => {
  const snapshotRow = {
    id: 'snapshot-id',
    shareId: 'share-1',
    title: '공유 제목',
    summary: '공유 요약',
    ogTitle: 'OG 제목',
    ogDescription: 'OG 설명',
    ogImageUrl: 'https://example.com/og.png',
    status: ShareSnapshotStatus.ACTIVE,
    userId: 'user-1',
    deletedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-05-21T12:00:00.000Z'),
  };
  const { service, prismaCalls } = createService({ snapshotRow });

  const result = await service.getOgMeta('share-1');

  assert.deepEqual(result, {
    shareId: 'share-1',
    title: 'OG 제목',
    description: 'OG 설명',
    imageUrl: 'https://example.com/og.png',
  });
  assert.equal(prismaCalls.update.length, 0);
});

test('owners can disable expire and delete their share snapshots', async () => {
  const snapshotRow = {
    id: 'snapshot-id',
    shareId: 'share-1',
    userId: 'user-1',
    status: ShareSnapshotStatus.ACTIVE,
    deletedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-05-21T12:00:00.000Z'),
  };
  const { service, prismaCalls } = createService({ snapshotRow });

  const disabled = await service.updateStatus(
    'user-1',
    'share-1',
    ShareSnapshotStatus.DISABLED,
  );
  const expiresAt = '2026-12-31T14:59:59.000Z';
  const expiration = await service.updateExpiration('user-1', 'share-1', expiresAt);
  const deleted = await service.softDelete('user-1', 'share-1');

  assert.equal(disabled.status, ShareSnapshotStatus.DISABLED);
  assert.equal(expiration.shareId, 'share-1');
  assert.equal(deleted.shareId, 'share-1');
  assert.equal(prismaCalls.update[0].data.status, ShareSnapshotStatus.DISABLED);
  assert.equal(prismaCalls.update[1].data.expiresAt.toISOString(), expiresAt);
  assert.equal(prismaCalls.update[2].data.status, ShareSnapshotStatus.DELETED);
  assert.ok(prismaCalls.update[2].data.deletedAt instanceof Date);
});
