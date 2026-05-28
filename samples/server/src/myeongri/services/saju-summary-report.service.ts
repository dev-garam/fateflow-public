import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { AdvancedRequestDto } from '../dto/advanced-request.dto';
import { ManseRequestDto } from '../dto/manse-request.dto';
import { AdvancedReadingService } from './advanced-reading.service';
import { CommonReadingQueryService } from './common-reading-query.service';

type CommonReadingResult = Awaited<ReturnType<CommonReadingQueryService['getCommonReading']>>;
type AdvancedResult = Awaited<ReturnType<AdvancedReadingService['getAdvanced']>>;

type ElementCode = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

type CommonReadingPayload = CommonReadingResult['commonReading'];
type AdvancedPayload = AdvancedResult['advanced'];
type RelationPair = {
  left: string;
  right: string;
  type: '합' | '충' | '형' | '파' | '해';
  target: '천간' | '지지';
};

type ReportEvidence = {
  reasonCodes: string[];
  axisTags: string[];
};

type ReportSection = {
  key: 'overall' | 'loveMarriage' | 'wealth' | 'family' | 'health' | 'study' | 'career';
  title: string;
  summary: string;
  details: string[];
  highlights?: string[];
  strengthPoints?: string[];
  cautionPoints?: string[];
  carePoints?: string[];
  actionGuide?: string[];
  evidence: ReportEvidence;
};

type ReportSectionKey = ReportSection['key'];

type SajuResultSection = {
  key: ReportSectionKey;
  label: string;
  title: string;
  summary: string;
  description: string;
  details: string[];
  points: {
    highlights: string[];
    strengths: string[];
    cautions: string[];
    care: string[];
    actions: string[];
  };
  evidence: ReportEvidence;
};

type SectionCoreAsset = {
  id: string;
  section: ReportSectionKey;
  role: 'sectionCore';
  tone: 'balanced';
  conditions: {
    dayMasterElement: ElementCode;
    dominantElement: ElementCode;
    weakElement: ElementCode;
  };
  title: string;
  summary: string;
  paragraph: string;
};

type SectionCoreAssetDocument = {
  assets: SectionCoreAsset[];
};

type SectionReasonAsset = {
  id: string;
  section: ReportSectionKey;
  role: 'sectionReason';
  tone: 'balanced';
  priority: number;
  match: {
    reasonCodesAny?: string[];
    prefixesAny?: string[];
    fallback?: boolean;
  };
  paragraph: string;
};

type SectionReasonAssetGroupRole = 'primary' | 'secondary' | 'fallback';

type SectionReasonAssetDocument = {
  assets: SectionReasonAsset[];
};

const ELEMENT_KOREAN: Record<ElementCode, string> = {
  wood: '목',
  fire: '화',
  earth: '토',
  metal: '금',
  water: '수',
};

const SECTION_LABELS: Record<ReportSectionKey, string> = {
  overall: '종합',
  loveMarriage: '연애/결혼',
  wealth: '재물',
  family: '가족',
  health: '건강',
  study: '학업',
  career: '직장',
};

const SECTION_ORDER: ReportSectionKey[] = [
  'overall',
  'loveMarriage',
  'wealth',
  'family',
  'health',
  'study',
  'career',
];

@Injectable()
export class SajuSummaryReportService {
  private static sectionCoreAssets: SectionCoreAsset[] | null = null;
  private static sectionCoreAssetsMtimeMs: number | null = null;
  private static sectionReasonAssets: SectionReasonAsset[] | null = null;
  private static sectionReasonAssetsMtimeMs: number | null = null;

  constructor(
    private readonly commonReadingQueryService: CommonReadingQueryService,
    private readonly advancedReadingService: AdvancedReadingService,
  ) {}

  async getSajuSummaryReport(input: ManseRequestDto) {
    const { report, meta } = await this.buildSajuSummaryReportPayload(input);

    return {
      report,
      meta,
    };
  }

  async getSajuSummaryReportV2(input: ManseRequestDto) {
    const v1 = await this.buildSajuSummaryReportPayload(input);
    const allSections = [v1.report.overall, ...v1.report.sections].map((section) =>
      this.applySectionNarrativeAssets(section, v1.commonReading),
    );
    const sectionMap = this.buildOrderedSectionMap(allSections);
    const result = this.buildSajuResult(sectionMap);

    return {
      report: {
        version: 'v2',
        tone: v1.report.tone,
        sectionOrder: SECTION_ORDER,
        result,
        legacy: {
          overall: v1.report.overall,
          sections: v1.report.sections,
        },
      },
      meta: v1.meta,
    };
  }

  private async buildSajuSummaryReportPayload(input: ManseRequestDto) {
    const commonResult = await this.commonReadingQueryService.getCommonReading(input);
    const advancedResult = await this.advancedReadingService.getAdvanced(this.toAdvancedRequest(input));
    const commonReading = commonResult.commonReading;
    const advanced = advancedResult.advanced;

    const overall = this.buildOverallSection(commonReading);
    const sections: ReportSection[] = [
      this.buildLoveMarriageSection(commonReading, advanced),
      this.buildWealthSection(commonReading),
      this.buildFamilySection(commonReading, advanced),
      this.buildHealthSection(commonReading),
      this.buildStudySection(commonReading),
      this.buildCareerSection(commonReading),
    ];

    return {
      report: {
        version: 'v1',
        tone: 'balanced',
        overall,
        sections,
      },
      meta: commonResult.meta,
      commonReading,
    };
  }

  private buildOrderedSectionMap(
    sections: ReportSection[],
  ): Record<ReportSectionKey, ReportSection> {
    return SECTION_ORDER.reduce(
      (acc, key) => {
        const section = sections.find((item) => item.key === key);
        if (section) {
          acc[key] = section;
        }
        return acc;
      },
      {} as Record<ReportSectionKey, ReportSection>,
    );
  }

  private buildSajuResult(
    sectionMap: Record<ReportSectionKey, ReportSection>,
  ): Record<ReportSectionKey, SajuResultSection> {
    return SECTION_ORDER.reduce(
      (acc, key) => {
        acc[key] = this.toSajuResultSection(sectionMap[key]);
        return acc;
      },
      {} as Record<ReportSectionKey, SajuResultSection>,
    );
  }

  private toSajuResultSection(section: ReportSection): SajuResultSection {
    return {
      key: section.key,
      label: SECTION_LABELS[section.key],
      title: section.title,
      summary: section.summary,
      description: section.details.join('\n\n'),
      details: section.details,
      points: {
        highlights: section.highlights ?? [],
        strengths: section.strengthPoints ?? [],
        cautions: section.cautionPoints ?? [],
        care: section.carePoints ?? [],
        actions: section.actionGuide ?? [],
      },
      evidence: section.evidence,
    };
  }

  private applySectionNarrativeAssets(
    section: ReportSection,
    commonReading: CommonReadingPayload,
  ): ReportSection {
    const coreAsset = this.findSectionCoreAsset(section.key, commonReading);
    const reasonCodes =
      section.evidence.reasonCodes.length > 0
        ? section.evidence.reasonCodes
        : commonReading.reasonCodes;
    const reasonAssets = this.findSectionReasonAssets(section.key, reasonCodes);

    if (!coreAsset && reasonAssets.length === 0) {
      return section;
    }

    return {
      ...section,
      title: coreAsset?.title ?? section.title,
      summary: coreAsset?.summary ?? section.summary,
      details: this.composeDetails([
        coreAsset?.paragraph,
        ...reasonAssets.map((asset) => asset.paragraph),
        ...section.details,
      ], 4),
      evidence: {
        ...section.evidence,
        axisTags: [
          ...section.evidence.axisTags,
          ...(coreAsset ? [`narrativeAsset:${coreAsset.id}`] : []),
          ...reasonAssets.map((asset) => `reasonAsset:${asset.id}`),
        ],
      },
    };
  }

  private findSectionCoreAsset(
    section: ReportSectionKey,
    commonReading: CommonReadingPayload,
  ): SectionCoreAsset | undefined {
    const dayMasterElement = commonReading.dayMaster.element;
    const { dominantElement, weakElement } = commonReading;

    return this.getSectionCoreAssets().find(
      (asset) =>
        asset.section === section &&
        asset.conditions.dayMasterElement === dayMasterElement &&
        asset.conditions.dominantElement === dominantElement &&
        asset.conditions.weakElement === weakElement,
    );
  }

  private getSectionCoreAssets(): SectionCoreAsset[] {
    const assetPath = join(
      process.cwd(),
      'docs',
      'narrative-assets',
      'saju-summary-section-core-assets-v1.json',
    );

    if (!existsSync(assetPath)) {
      SajuSummaryReportService.sectionCoreAssets = [];
      SajuSummaryReportService.sectionCoreAssetsMtimeMs = null;
      return SajuSummaryReportService.sectionCoreAssets;
    }

    const { mtimeMs } = statSync(assetPath);

    if (
      SajuSummaryReportService.sectionCoreAssets &&
      SajuSummaryReportService.sectionCoreAssetsMtimeMs === mtimeMs
    ) {
      return SajuSummaryReportService.sectionCoreAssets;
    }

    const document = JSON.parse(readFileSync(assetPath, 'utf8')) as SectionCoreAssetDocument;
    SajuSummaryReportService.sectionCoreAssets = Array.isArray(document.assets) ? document.assets : [];
    SajuSummaryReportService.sectionCoreAssetsMtimeMs = mtimeMs;
    return SajuSummaryReportService.sectionCoreAssets;
  }

  private findSectionReasonAssets(
    section: ReportSectionKey,
    reasonCodes: string[],
  ): SectionReasonAsset[] {
    const uniqueReasonCodes = [...new Set(reasonCodes)];
    const candidates = this.getSectionReasonAssets()
      .filter((asset) => asset.section === section)
      .filter((asset) => this.matchesSectionReasonAsset(asset, uniqueReasonCodes))
      .sort((left, right) => right.priority - left.priority);

    const primary = this.findPrimarySectionReasonAsset(candidates);
    if (!primary) {
      return [];
    }

    const secondary = this.findSecondarySectionReasonAsset(candidates, primary);
    return secondary ? [primary, secondary] : [primary];
  }

  private findPrimarySectionReasonAsset(
    candidates: SectionReasonAsset[],
  ): SectionReasonAsset | undefined {
    return (
      candidates.find((asset) => this.getSectionReasonAssetGroupRole(asset) === 'primary') ??
      candidates.find((asset) => this.getSectionReasonAssetGroupRole(asset) === 'secondary') ??
      candidates.find((asset) => this.getSectionReasonAssetGroupRole(asset) === 'fallback')
    );
  }

  private findSecondarySectionReasonAsset(
    candidates: SectionReasonAsset[],
    primary: SectionReasonAsset,
  ): SectionReasonAsset | undefined {
    if (this.getSectionReasonAssetGroupRole(primary) === 'fallback') {
      return undefined;
    }

    const primaryFamily = this.getSectionReasonAssetFamily(primary);
    return candidates.find(
      (asset) =>
        asset.id !== primary.id &&
        this.getSectionReasonAssetGroupRole(asset) === 'secondary' &&
        this.getSectionReasonAssetFamily(asset) !== primaryFamily &&
        this.getSectionReasonAssetTopic(asset) !== this.getSectionReasonAssetTopic(primary) &&
        !this.hasSimilarSectionReasonParagraph(primary, asset),
    );
  }

  private getSectionReasonAssetGroupRole(
    asset: SectionReasonAsset,
  ): SectionReasonAssetGroupRole {
    const group = this.getSectionReasonAssetGroup(asset);

    if (group === 'section-fallback') {
      return 'fallback';
    }

    if (
      group.startsWith('season-') ||
      group.startsWith('environment-') ||
      group.startsWith('timing-') ||
      group.startsWith('element-') ||
      group.startsWith('shinsal-') ||
      group.startsWith('geo-') ||
      group.startsWith('bong-')
    ) {
      return 'secondary';
    }

    return 'primary';
  }

  private getSectionReasonAssetFamily(asset: SectionReasonAsset): string {
    return this.getSectionReasonAssetGroup(asset).split('-')[0];
  }

  private getSectionReasonAssetTopic(asset: SectionReasonAsset): string {
    const group = this.getSectionReasonAssetGroup(asset);

    if (
      group.startsWith('season-') ||
      group.startsWith('environment-') ||
      group.startsWith('timing-') ||
      group.startsWith('element-')
    ) {
      return group.split('-')[1] ?? group;
    }

    return group.split('-')[0];
  }

  private getSectionReasonAssetGroup(asset: SectionReasonAsset): string {
    return asset.id.replace(/^[^-]+-reason-/, '').replace(/-v\d+$/, '');
  }

  private hasSimilarSectionReasonParagraph(
    primary: SectionReasonAsset,
    secondary: SectionReasonAsset,
  ): boolean {
    const primaryWords = new Set(this.toSectionReasonParagraphWords(primary.paragraph));
    const secondaryWords = this.toSectionReasonParagraphWords(secondary.paragraph);

    if (primaryWords.size === 0 || secondaryWords.length === 0) {
      return false;
    }

    const overlap = secondaryWords.filter((word) => primaryWords.has(word)).length;
    return overlap / Math.max(primaryWords.size, secondaryWords.length) >= 0.55;
  }

  private toSectionReasonParagraphWords(paragraph: string): string[] {
    return paragraph
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3);
  }

  private matchesSectionReasonAsset(
    asset: SectionReasonAsset,
    reasonCodes: string[],
  ): boolean {
    if (asset.match.reasonCodesAny?.some((code) => reasonCodes.includes(code))) {
      return true;
    }

    if (
      asset.match.prefixesAny?.some((prefix) =>
        reasonCodes.some((code) => code.startsWith(prefix)),
      )
    ) {
      return true;
    }

    return asset.match.fallback === true;
  }

  private getSectionReasonAssets(): SectionReasonAsset[] {
    const assetPath = join(
      process.cwd(),
      'docs',
      'narrative-assets',
      'saju-summary-section-reason-assets-v1.json',
    );

    if (!existsSync(assetPath)) {
      SajuSummaryReportService.sectionReasonAssets = [];
      SajuSummaryReportService.sectionReasonAssetsMtimeMs = null;
      return SajuSummaryReportService.sectionReasonAssets;
    }

    const { mtimeMs } = statSync(assetPath);

    if (
      SajuSummaryReportService.sectionReasonAssets &&
      SajuSummaryReportService.sectionReasonAssetsMtimeMs === mtimeMs
    ) {
      return SajuSummaryReportService.sectionReasonAssets;
    }

    const document = JSON.parse(readFileSync(assetPath, 'utf8')) as SectionReasonAssetDocument;
    SajuSummaryReportService.sectionReasonAssets = Array.isArray(document.assets) ? document.assets : [];
    SajuSummaryReportService.sectionReasonAssetsMtimeMs = mtimeMs;
    return SajuSummaryReportService.sectionReasonAssets;
  }

  private toAdvancedRequest(input: ManseRequestDto): AdvancedRequestDto {
    return {
      ...input,
      includeShinsalExtended: true,
      directionPolicy: 'gender_year_stem',
    };
  }

  private buildOverallSection(commonReading: CommonReadingPayload): ReportSection {
    const dominant = ELEMENT_KOREAN[commonReading.dominantElement];
    const weak = ELEMENT_KOREAN[commonReading.weakElement];
    const details = this.composeDetails([
      commonReading.summary,
      `${dominant} 기운이 강하고 ${weak} 기운이 약해, 장점은 분명하지만 답답함을 느끼기 쉬운 편입니다.`,
      this.toAdviceSentence(commonReading.balanceTips[0], '삶 전반에서는'),
    ]);

    return {
      key: 'overall',
      title: `${dominant} 기운이 강해 막힌 곳을 풀어 주는 힘이 필요한 사주`,
      summary: commonReading.summary,
      details,
      highlights: this.takePoints(commonReading.strengths, 2),
      evidence: {
        reasonCodes: this.takeReasonCodes(commonReading.reasonCodes, 3),
        axisTags: ['commonReading', 'structureAxis'],
      },
    };
  }

  private buildLoveMarriageSection(
    commonReading: CommonReadingPayload,
    advanced: AdvancedPayload,
  ): ReportSection {
    const relationPairs = this.getRelationPairs(advanced);
    const conflictCount = relationPairs.filter(
      (pair) => pair.type === '충' || pair.type === '형' || pair.type === '파' || pair.type === '해',
    ).length;
    const harmonyCount = relationPairs.filter((pair) => pair.type === '합').length;
    const summary =
      conflictCount > harmonyCount
        ? '가까운 관계에서는 마음이 깊은 만큼 기준도 높아져, 신뢰가 흔들리면 거리감이 빠르게 커질 수 있습니다.'
        : '친밀한 관계에서는 가볍게 스쳐 지나가기보다 천천히 신뢰를 쌓아가는 방식이 잘 맞습니다.';

    const details = this.composeDetails([
      summary,
      conflictCount > 0
        ? '관계 안에서 기대가 높아지면 서운함도 오래 남기 쉬우니, 속마음을 너무 오래 쌓아두지 않는 것이 중요합니다.'
        : '관계의 속도를 조절하더라도 표현까지 줄이면 마음이 멀어질 수 있어, 필요한 말은 제때 꺼내는 편이 좋습니다.',
      this.toAdviceSentence(commonReading.cautions[0], '연애와 결혼에서는'),
    ]);

    return {
      key: 'loveMarriage',
      title: conflictCount > harmonyCount ? '가까울수록 표현과 거리 조절이 중요합니다' : '천천히 쌓는 신뢰가 관계의 힘이 됩니다',
      summary,
      details,
      strengthPoints: this.takePoints(commonReading.strengths, 2),
      cautionPoints: this.takePoints(commonReading.cautions, 2),
      actionGuide: [
        '가까운 관계일수록 혼자 짐작하기보다 바로 묻고 확인하는 습관이 도움이 됩니다.',
      ],
      evidence: {
        reasonCodes: this.filterReasonCodes(commonReading.reasonCodes, ['REL_', 'DAY_AXIS_']),
        axisTags: ['relationAxis', 'advanced.relations'],
      },
    };
  }

  private buildWealthSection(commonReading: CommonReadingPayload): ReportSection {
    const useful = commonReading.usefulElements[0];
    const summary = useful
      ? '약한 부분을 채워 갈수록 돈 관리가 한결 수월해집니다.'
      : '재물은 한 번에 크게 흔들기보다 관리 기준을 세워 꾸준히 챙길수록 안정감이 커집니다.';

    const details = this.composeDetails([
      summary,
      commonReading.favorableElements[0]
        ? `${ELEMENT_KOREAN[commonReading.favorableElements[0].element]} 쪽 환경이나 습관을 더하면 들어오고 나가는 돈을 살피는 감각을 다듬는 데 도움이 됩니다.`
        : '돈을 벌고 쓰는 과정 모두에서 기준을 단순하게 잡을수록 불필요한 지출을 줄이기 쉽습니다.',
      '재물은 크게 벌리기보다 들어오고 나가는 돈부터 먼저 정리할수록 안정감이 커집니다.',
    ]);

    return {
      key: 'wealth',
      title: '약한 부분을 채워 갈수록 돈 관리가 수월해집니다',
      summary,
      details,
      strengthPoints: this.takePoints(commonReading.strengths, 2),
      cautionPoints: this.takePoints(commonReading.cautions, 2),
      actionGuide: [
        '수입과 지출을 한눈에 볼 수 있게 정리해 두면 흐름이 훨씬 단순해집니다.',
        '돈 문제는 감으로 넘기기보다 숫자로 확인하는 습관이 도움이 됩니다.',
      ],
      evidence: {
        reasonCodes: this.filterReasonCodes(commonReading.reasonCodes, ['TEN_WEALTH_', 'STRUCT_', 'ELEM_']),
        axisTags: ['commonReading', 'resourceAxis'],
      },
    };
  }

  private buildFamilySection(
    commonReading: CommonReadingPayload,
    advanced: AdvancedPayload,
  ): ReportSection {
    const relationPairs = this.getRelationPairs(advanced);
    const dayConflicts = relationPairs.filter(
      (pair) =>
        (pair.left.startsWith('day.') || pair.right.startsWith('day.')) &&
        (pair.type === '충' || pair.type === '형' || pair.type === '파' || pair.type === '해'),
    ).length;
    const summary =
      dayConflicts > 0
        ? '가족 안에서는 책임을 쉽게 내려놓지 못해, 가까운 사이일수록 기준과 감정이 부딪힐 수 있습니다.'
        : '가족 안에서는 묵묵히 자기 역할을 챙기려는 성향이 강해, 신뢰를 쌓는 힘이 안정적으로 드러납니다.';

    const details = this.composeDetails([
      summary,
      '원가족과의 관계에서는 정서적 거리와 책임감의 균형을 잡는 것이 중요하며, 돌봄과 간섭을 같은 것으로 느끼지 않도록 경계를 세우는 연습이 필요할 수 있습니다.',
      '가족 안에서는 챙김과 간섭의 경계가 흐려지지 않도록 역할을 분명히 하는 편이 좋습니다.',
    ]);

    return {
      key: 'family',
      title: dayConflicts > 0 ? '가족 안에서는 경계와 역할 조절이 필요합니다' : '가족 안에서 안정감을 만드는 힘이 있습니다',
      summary,
      details,
      strengthPoints: this.takePoints(commonReading.strengths, 2),
      cautionPoints: this.takePoints(commonReading.cautions, 2),
      actionGuide: [
        '가족 사이일수록 말하지 않아도 알겠지 하고 넘기기보다 필요한 선을 먼저 말해 두는 편이 좋습니다.',
      ],
      evidence: {
        reasonCodes: this.filterReasonCodes(commonReading.reasonCodes, ['REL_', 'TEN_RESOURCE_', 'DAY_AXIS_']),
        axisTags: ['relationAxis', 'advanced.relations'],
      },
    };
  }

  private buildHealthSection(commonReading: CommonReadingPayload): ReportSection {
    const summary = `${ELEMENT_KOREAN[commonReading.dominantElement]} 기운이 강한 편이라, 생활 리듬이 들쑥날쑥해지지 않게 챙기는 일이 중요합니다.`;
    const details = this.composeDetails([
      summary,
      `${ELEMENT_KOREAN[commonReading.weakElement]} 기운이 약한 편이면 회복이 더디게 느껴질 수 있으니, 무리한 패턴을 오래 끌지 않는 편이 좋습니다.`,
      '건강은 한 번 무너지면 회복에 시간이 걸릴 수 있어, 생활 리듬을 먼저 지키는 편이 중요합니다.',
    ]);

    return {
      key: 'health',
      title: '생활 리듬을 일정하게 지키는 일이 건강 관리의 핵심입니다',
      summary,
      details,
      carePoints: this.takePoints(commonReading.cautions, 2),
      actionGuide: [
        '수면과 식사 시간을 일정하게 맞추는 것만으로도 전체 컨디션이 훨씬 안정됩니다.',
        '버티기보다 쉬는 시간을 먼저 잡아 두는 편이 건강 관리에 더 잘 맞습니다.',
      ],
      evidence: {
        reasonCodes: this.filterReasonCodes(commonReading.reasonCodes, ['ELEM_', 'STRUCT_']),
        axisTags: ['commonReading', 'structureAxis'],
      },
    };
  }

  private buildStudySection(commonReading: CommonReadingPayload): ReportSection {
    const summary =
      commonReading.strengthLevel === 'strong'
        ? '배우고 익히는 과정에서는 자기 기준을 세워 깊게 파고드는 힘이 강한 편입니다.'
        : commonReading.strengthLevel === 'weak'
          ? '학습에서는 초반 몰입을 붙이는 장치가 중요하고, 흐름이 잡히면 점점 안정적으로 쌓아가는 편입니다.'
          : '학습에서는 이해한 내용을 자기 식으로 정리할 때 성과가 가장 안정적으로 쌓입니다.';
    const details = this.composeDetails([
      summary,
      commonReading.strengths[0]
        ? `강점으로 보이는 ${commonReading.strengths[0]} 같은 성향은 반복 암기보다 이해 중심 학습에서 더 잘 살아날 수 있습니다.`
        : '익히는 속도보다 익힌 내용을 자기 방식으로 정리하는 과정이 더 중요합니다.',
      '공부는 많이 보는 것보다 이해한 걸 자기 말로 다시 정리할 때 더 오래 남습니다.',
    ]);

    return {
      key: 'study',
      title: '이해한 걸 자기 식으로 정리하는 공부가 잘 맞습니다',
      summary,
      details,
      strengthPoints: this.takePoints(commonReading.strengths, 2),
      cautionPoints: this.takePoints(commonReading.cautions, 2),
      actionGuide: [
        '배운 내용을 짧게라도 다시 써 보거나 설명해 보면 이해가 훨씬 단단해집니다.',
        '오래 붙드는 공부보다 짧게 끊어 반복하는 방식이 더 잘 맞을 수 있습니다.',
      ],
      evidence: {
        reasonCodes: this.filterReasonCodes(commonReading.reasonCodes, ['TEN_RESOURCE_', 'TEN_OUTPUT_', 'STRUCT_']),
        axisTags: ['commonReading', 'resourceAxis'],
      },
    };
  }

  private buildCareerSection(commonReading: CommonReadingPayload): ReportSection {
    const summary =
      commonReading.strengthLevel === 'strong'
        ? '일에서는 주도적으로 기준을 세우고 밀어붙일 힘이 있지만, 압박이 누적되면 유연성이 떨어질 수 있습니다.'
        : commonReading.strengthLevel === 'weak'
          ? '직장에서는 초반에 속도를 맞추는 부담이 있을 수 있지만, 구조를 익히면 꾸준히 버티는 힘이 살아납니다.'
          : '직장에서는 할 일과 책임의 선을 분명히 할 때 안정적으로 역량을 보여주기 좋습니다.';
    const details = this.composeDetails([
      summary,
      commonReading.cautions[0]
        ? `특히 ${commonReading.cautions[0]} 같은 패턴이 일에서 반복되면 성과보다 피로가 먼저 커질 수 있습니다.`
        : '일의 기준이 분명할수록 강점이 살아나지만, 환경 변화가 잦으면 피로를 느끼기 쉬울 수 있습니다.',
      '직장에서는 모든 책임을 다 떠안기보다, 어디까지 맡을지 선을 먼저 긋는 편이 중요합니다.',
    ]);

    return {
      key: 'career',
      title: '할 일과 책임의 선이 분명한 환경에서 강점이 살아납니다',
      summary,
      details,
      strengthPoints: this.takePoints(commonReading.strengths, 2),
      cautionPoints: this.takePoints(commonReading.cautions, 2),
      actionGuide: [
        '일의 범위와 기대치를 먼저 맞춰 두면 불필요한 소모를 줄이기 쉽습니다.',
        '성과를 내는 것과 책임을 다 떠안는 것은 다르다는 점을 의식하는 편이 좋습니다.',
      ],
      evidence: {
        reasonCodes: this.filterReasonCodes(commonReading.reasonCodes, ['TEN_PRESSURE_', 'TEN_OUTPUT_', 'STRUCT_']),
        axisTags: ['commonReading', 'resourceAxis', 'structureAxis'],
      },
    };
  }

  private composeDetails(items: Array<string | undefined>, maxItems = 3): string[] {
    return items
      .filter((item): item is string => Boolean(item && item.trim()))
      .slice(0, maxItems)
      .map((item) => item.trim());
  }

  private toAdviceSentence(line: string | undefined, prefix: string): string | undefined {
    if (!line) {
      return undefined;
    }
    return `${prefix} ${line}`;
  }

  private takePoints(lines: string[], max: number): string[] {
    return lines.map((line) => line.trim()).filter(Boolean).slice(0, max);
  }

  private takeActionGuide(commonReading: CommonReadingPayload): string[] {
    return this.takePoints(commonReading.balanceTips, 2);
  }

  private takeReasonCodes(reasonCodes: string[], max: number): string[] {
    return [...reasonCodes].slice(0, max);
  }

  private filterReasonCodes(reasonCodes: string[], prefixes: string[]): string[] {
    const filtered = reasonCodes.filter((code) => prefixes.some((prefix) => code.startsWith(prefix)));
    return filtered.length > 0 ? filtered.slice(0, 4) : this.takeReasonCodes(reasonCodes, 2);
  }

  private getRelationPairs(advanced: AdvancedPayload): RelationPair[] {
    const pairs = (
      advanced as {
        relations?: {
          pairs?: RelationPair[];
        };
      }
    ).relations?.pairs;

    return Array.isArray(pairs) ? pairs : [];
  }
}
