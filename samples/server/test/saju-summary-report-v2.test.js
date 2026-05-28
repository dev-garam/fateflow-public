const test = require('node:test');
const assert = require('node:assert/strict');
const sectionReasonAssets = require('../docs/narrative-assets/saju-summary-section-reason-assets-v1.json');
const { createMyeongriEngine } = require('../test-support/create-myeongri-engine');
const {
  CommonReadingQueryService,
} = require('../dist/myeongri/services/common-reading-query.service');
const { AdvancedReadingService } = require('../dist/myeongri/services/advanced-reading.service');
const {
  SajuSummaryReportService,
} = require('../dist/myeongri/services/saju-summary-report.service');

function createSajuSummaryReportService() {
  const engine = createMyeongriEngine();
  return new SajuSummaryReportService(
    new CommonReadingQueryService(engine),
    new AdvancedReadingService(engine),
  );
}

test('saju summary report v2 exposes section order and result blocks', async () => {
  const service = createSajuSummaryReportService();

  const result = await service.getSajuSummaryReportV2({
    birthDate: '1991-12-06',
    birthTime: '13:51',
    calendarType: 'solar',
    gender: 'male',
  });

  const expectedOrder = [
    'overall',
    'loveMarriage',
    'wealth',
    'family',
    'health',
    'study',
    'career',
  ];

  assert.equal(result.report.version, 'v2');
  assert.deepEqual(result.report.sectionOrder, expectedOrder);
  assert.deepEqual(Object.keys(result.report.result), expectedOrder);
  assert.equal('sectionsByKey' in result.report, false);
  assert.equal('sajuResult' in result.report, false);
  assert.equal(result.report.result.overall.label, '종합');
  assert.equal(result.report.result.loveMarriage.label, '연애/결혼');
  assert.equal(result.report.result.wealth.label, '재물');
  assert.equal(result.report.result.family.label, '가족');
  assert.equal(result.report.result.health.label, '건강');
  assert.equal(result.report.result.study.label, '학업');
  assert.equal(result.report.result.career.label, '직장');
  assert.equal(typeof result.report.result.overall.description, 'string');
  assert.ok(result.report.result.overall.description.length > 0);
  for (const sectionKey of expectedOrder) {
    const reasonAssetTags = result.report.result[sectionKey].evidence.axisTags.filter((tag) =>
      tag.startsWith(`reasonAsset:${sectionKey}-reason-`),
    );

    assert.ok(
      result.report.result[sectionKey].evidence.axisTags.some((tag) =>
        tag.startsWith(`narrativeAsset:${sectionKey}-core-`),
      ),
      `${sectionKey} should include a section narrative asset tag`,
    );
    assert.ok(
      reasonAssetTags.length >= 1,
      `${sectionKey} should include a section reason asset tag`,
    );
    assert.ok(reasonAssetTags.length <= 2, `${sectionKey} should include up to two reason assets`);
  }
  assert.notEqual(
    result.report.result.overall.title,
    result.report.legacy.overall.title,
  );
  assert.ok(Array.isArray(result.report.legacy.sections));
});

test('saju summary report v2 can attach secondary reason context after primary reason', async () => {
  const service = createSajuSummaryReportService();

  const result = await service.getSajuSummaryReportV2({
    birthDate: '1991-12-06',
    birthTime: '13:51',
    calendarType: 'solar',
    gender: 'male',
  });

  const overallReasonTags = result.report.result.overall.evidence.axisTags.filter((tag) =>
    tag.startsWith('reasonAsset:overall-reason-'),
  );

  assert.deepEqual(overallReasonTags, [
    'reasonAsset:overall-reason-pressure-high-v1',
    'reasonAsset:overall-reason-season-output-v1',
  ]);

  const paragraphs = result.report.result.overall.details;
  assert.equal(paragraphs[1], sectionReasonAssets.assets.find(
    (asset) => asset.id === 'overall-reason-pressure-high-v1',
  ).paragraph);
  assert.equal(paragraphs[2], sectionReasonAssets.assets.find(
    (asset) => asset.id === 'overall-reason-season-output-v1',
  ).paragraph);
  assert.ok(
    paragraphs[3].length > 0,
    'secondary reason sections should still keep one legacy detail paragraph',
  );
});

test('saju summary report v2 skips secondary reason when it repeats primary topic', async () => {
  const service = createSajuSummaryReportService();

  const result = await service.getSajuSummaryReportV2({
    birthDate: '2001-01-29',
    birthTime: '23:30',
    calendarType: 'solar',
    gender: 'male',
  });

  const overallReasonTags = result.report.result.overall.evidence.axisTags.filter((tag) =>
    tag.startsWith('reasonAsset:overall-reason-'),
  );

  assert.deepEqual(overallReasonTags, ['reasonAsset:overall-reason-pressure-high-v1']);
});

test('saju summary report v2 has exact STRUCT reason assets before generic fallback', () => {
  const expectedSections = [
    'overall',
    'loveMarriage',
    'wealth',
    'family',
    'health',
    'study',
    'career',
  ];
  const expectedStructureCodes = [
    'STRUCT_FIRE_DEFICIENT',
    'STRUCT_WOOD_DEFICIENT',
    'STRUCT_CIRCULATION_WEAKENED',
    'STRUCT_CIRCULATION_STAGNANT',
    'STRUCT_CONTROL_EXCESSIVE',
    'STRUCT_EARTH_BIASED',
    'STRUCT_METAL_BIASED',
    'STRUCT_WATER_BIASED',
    'STRUCT_BALANCED_SUPPORT',
  ];

  for (const section of expectedSections) {
    const genericStructureAsset = sectionReasonAssets.assets.find(
      (asset) =>
        asset.section === section &&
        asset.id === `${section}-reason-structure-pattern-v1`,
    );

    assert.ok(genericStructureAsset, `${section} should keep generic STRUCT fallback`);
    assert.ok(
      genericStructureAsset.match.prefixesAny.includes('STRUCT_'),
      `${section} generic STRUCT fallback should match STRUCT_ prefix`,
    );

    for (const code of expectedStructureCodes) {
      const exactAsset = sectionReasonAssets.assets.find(
        (asset) =>
          asset.section === section &&
          asset.match.reasonCodesAny?.includes(code) &&
          !asset.match.prefixesAny,
      );

      assert.ok(exactAsset, `${section} should include exact asset for ${code}`);
      assert.ok(
        exactAsset.priority > genericStructureAsset.priority,
        `${section} exact asset for ${code} should outrank generic STRUCT fallback`,
      );
      assert.ok(
        exactAsset.paragraph.length > 0,
        `${section} exact asset for ${code} should have a paragraph`,
      );
    }
  }
});

test('saju summary report v2 has exact relation isolation reason assets', () => {
  const expectedSections = [
    'overall',
    'loveMarriage',
    'wealth',
    'family',
    'health',
    'study',
    'career',
  ];

  for (const section of expectedSections) {
    const exactAsset = sectionReasonAssets.assets.find(
      (asset) =>
        asset.section === section &&
        asset.id === `${section}-reason-relation-isolation-v1`,
    );

    assert.ok(exactAsset, `${section} should include exact relation isolation asset`);
    assert.deepEqual(exactAsset.match.reasonCodesAny, ['REL_ISOLATION_HIGH']);
    assert.ok(
      exactAsset.priority > 90,
      `${section} relation isolation asset should have primary relation priority`,
    );
  }
});
