import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { DecadeFortuneReadingRequestDto } from '../fortune/dto/decade-fortune-reading-request.dto';
import { MonthlyFortuneReadingRequestDto } from '../fortune/dto/monthly-fortune-reading-request.dto';
import { TodayFortuneRequestDto } from '../fortune/dto/today-fortune-request.dto';
import { YearlyFortuneReadingRequestDto } from '../fortune/dto/yearly-fortune-reading-request.dto';
import { FortuneService } from '../fortune/fortune.service';
import { ManseRequestDto } from '../myeongri/dto/manse-request.dto';
import { SajuSummaryReportService } from '../myeongri/services/saju-summary-report.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShareSnapshotDto } from './dto/create-share-snapshot.dto';
import { ShareSnapshotOptionsDto } from './dto/share-snapshot-options.dto';
import {
  ShareSnapshotStatusCode,
  ShareSnapshotStatusValue,
  ShareSnapshotTypeCode,
  ShareSnapshotTypeValue,
} from './share-snapshot.constants';

type JsonRecord = Record<string, unknown>;

type NormalizedShareOptions = {
  includeBirthInfo: boolean;
  includeManse: boolean;
  includeScore: boolean;
  includeOwnerName: boolean;
};

type SnapshotPayload = {
  result: unknown;
  title: string;
  summary?: string;
  score: number | null;
};

type PublicSnapshotData = {
  result: unknown;
  input?: unknown;
};

type ShareSnapshotRow = {
  id: string;
  shareId: string;
  type: ShareSnapshotTypeCode;
  status: ShareSnapshotStatusCode;
  userId: string | null;
  sourceId: string | null;
  title: string;
  summary: string | null;
  score: number | null;
  optionsJson: Prisma.JsonValue;
  inputJson: Prisma.JsonValue | null;
  resultJson: Prisma.JsonValue;
  renderJson: Prisma.JsonValue | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  viewCount: number;
  lastViewedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type ShareSnapshotCreateData = {
  type: ShareSnapshotTypeCode;
  user: {
    connect: { id: string };
  };
  sourceId?: string;
  title: string;
  summary?: string;
  score: number | null;
  optionsJson: Prisma.InputJsonValue;
  inputJson: Prisma.InputJsonValue;
  resultJson: Prisma.InputJsonValue;
  ogTitle: string;
  ogDescription?: string;
  expiresAt: Date | null;
};

type ShareSnapshotDelegate = {
  create(args: {
    data: ShareSnapshotCreateData & { shareId: string };
  }): Promise<ShareSnapshotRow>;
  findFirst(args: unknown): Promise<ShareSnapshotRow | null>;
  update(args: unknown): Promise<ShareSnapshotRow>;
};

type PrismaServiceWithShareSnapshot = PrismaService & {
  shareSnapshot: ShareSnapshotDelegate;
};

const SHARE_SNAPSHOT_TYPE_ITEMS = [
  {
    type: ShareSnapshotTypeValue.SAJU_SUMMARY,
    label: '사주팔자 서머리',
    description: '원국 기반 사주팔자 서머리 리포트',
    createSupported: true,
  },
  {
    type: ShareSnapshotTypeValue.TODAY_FORTUNE,
    label: '오늘의 운세',
    description: '개인화된 오늘의 운세 결과',
    createSupported: true,
  },
  {
    type: ShareSnapshotTypeValue.MONTHLY_FORTUNE,
    label: '월운',
    description: '특정 연월의 월별 운세 풀이',
    createSupported: true,
  },
  {
    type: ShareSnapshotTypeValue.YEARLY_FORTUNE,
    label: '세운',
    description: '특정 연도의 연별 운세 풀이',
    createSupported: true,
  },
  {
    type: ShareSnapshotTypeValue.DECADE_FORTUNE,
    label: '대운',
    description: '특정 10년 구간의 운세 풀이',
    createSupported: true,
  },
] as const;

@Injectable()
export class ShareSnapshotService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sajuSummaryReportService: SajuSummaryReportService,
    private readonly fortuneService: FortuneService,
  ) {}

  private get prisma(): PrismaServiceWithShareSnapshot {
    return this.prismaService as PrismaServiceWithShareSnapshot;
  }

  getSnapshotTypes() {
    return {
      success: true as const,
      types: SHARE_SNAPSHOT_TYPE_ITEMS.map((item) => ({ ...item })),
    };
  }

  async createSnapshot(
    userId: string,
    input: CreateShareSnapshotDto,
  ): Promise<{ success: true; shareId: string }> {
    const options = this.normalizeOptions(input.options);
    const expiresAt = this.parseExpiresAt(input.expiresAt);
    const payload = await this.buildSnapshotPayload(input.type, input.input);

    const row = await this.createWithUniqueShareId({
      type: input.type,
      user: {
        connect: { id: userId },
      },
      sourceId: input.sourceId,
      title: payload.title,
      summary: payload.summary,
      score: payload.score,
      optionsJson: options as Prisma.InputJsonValue,
      inputJson: input.input as unknown as Prisma.InputJsonValue,
      resultJson: payload.result as Prisma.InputJsonValue,
      ogTitle: payload.title,
      ogDescription: payload.summary,
      expiresAt,
    });

    return {
      success: true,
      shareId: row.shareId,
    };
  }

  private async buildSnapshotPayload(
    type: ShareSnapshotTypeCode,
    input: Record<string, unknown>,
  ): Promise<SnapshotPayload> {
    switch (type) {
      case ShareSnapshotTypeValue.SAJU_SUMMARY: {
        const result = await this.sajuSummaryReportService.getSajuSummaryReport(input as unknown as ManseRequestDto);
        return this.extractSajuSummaryPayload(result);
      }
      case ShareSnapshotTypeValue.TODAY_FORTUNE: {
        const result = await this.fortuneService.getTodayFortune(input as unknown as TodayFortuneRequestDto);
        return this.extractTodayFortunePayload(result);
      }
      case ShareSnapshotTypeValue.MONTHLY_FORTUNE: {
        const result = await this.fortuneService.getMonthlyFortuneReading(input as unknown as MonthlyFortuneReadingRequestDto);
        return this.extractStructuredFortunePayload(result, 'monthlyReading', '월운');
      }
      case ShareSnapshotTypeValue.YEARLY_FORTUNE: {
        const result = await this.fortuneService.getYearlyFortuneReading(input as unknown as YearlyFortuneReadingRequestDto);
        return this.extractStructuredFortunePayload(result, 'yearlyReading', '세운');
      }
      case ShareSnapshotTypeValue.DECADE_FORTUNE: {
        const result = await this.fortuneService.getDecadeFortuneReading(input as unknown as DecadeFortuneReadingRequestDto);
        return this.extractStructuredFortunePayload(result, 'decadeReading', '대운');
      }
      case ShareSnapshotTypeValue.GOONGHAP:
        throw new BadRequestException('GOONGHAP 공유 생성은 현재 지원하지 않습니다.');
      default:
        throw new BadRequestException('지원하지 않는 공유 타입입니다.');
    }
  }

  async getPublicSnapshot(shareId: string) {
    const now = new Date();
    const row = await this.findPublicSnapshotRow(shareId, now);

    const viewed = await this.prisma.shareSnapshot.update({
      where: { id: row.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: now,
      },
    });
    const options = this.normalizeOptions(row.optionsJson as ShareSnapshotOptionsDto);

    return {
      success: true as const,
      snapshot: {
        shareId: row.shareId,
        type: row.type,
        title: row.title,
        summary: row.summary ?? undefined,
        score: options.includeScore ? (row.score ?? undefined) : undefined,
        options,
        data: this.buildPublicData({
          resultJson: row.resultJson,
          inputJson: row.inputJson,
          options,
        }),
        createdAt: row.createdAt.toISOString(),
        viewCount: viewed.viewCount,
      },
    };
  }

  async getOgMeta(shareId: string) {
    const row = await this.findPublicSnapshotRow(shareId);

    return {
      shareId: row.shareId,
      title: row.ogTitle ?? row.title,
      description: row.ogDescription ?? row.summary ?? undefined,
      imageUrl: row.ogImageUrl ?? undefined,
    };
  }

  async updateStatus(userId: string, shareId: string, status: ShareSnapshotStatusCode) {
    if (status === ShareSnapshotStatusValue.DELETED) {
      throw new BadRequestException('DELETED 상태는 삭제 API를 사용해 주세요.');
    }

    const row = await this.findOwnedSnapshotRow(userId, shareId);
    const updated = await this.prisma.shareSnapshot.update({
      where: { id: row.id },
      data: { status },
    });

    return {
      success: true as const,
      shareId: updated.shareId,
      status: updated.status,
    };
  }

  async updateExpiration(userId: string, shareId: string, expiresAtInput: string | null | undefined) {
    const row = await this.findOwnedSnapshotRow(userId, shareId);
    const expiresAt = this.parseOptionalFutureDate(expiresAtInput);
    const updated = await this.prisma.shareSnapshot.update({
      where: { id: row.id },
      data: { expiresAt },
    });

    return {
      success: true as const,
      shareId: updated.shareId,
      expiresAt: updated.expiresAt?.toISOString(),
    };
  }

  async softDelete(userId: string, shareId: string) {
    const row = await this.findOwnedSnapshotRow(userId, shareId);
    const updated = await this.prisma.shareSnapshot.update({
      where: { id: row.id },
      data: {
        status: ShareSnapshotStatusValue.DELETED,
        deletedAt: new Date(),
      },
    });

    return {
      success: true as const,
      shareId: updated.shareId,
    };
  }

  private async createWithUniqueShareId(
    data: ShareSnapshotCreateData,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.shareSnapshot.create({
          data: {
            ...data,
            shareId: this.generateShareId(),
          },
        });
      } catch (error) {
        if (!this.isShareIdConflict(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestException('공유 식별자 생성에 실패했습니다.');
  }

  private normalizeOptions(options: ShareSnapshotOptionsDto | null | undefined): NormalizedShareOptions {
    return {
      includeBirthInfo: options?.includeBirthInfo ?? false,
      includeManse: options?.includeManse ?? false,
      includeScore: options?.includeScore ?? true,
      includeOwnerName: options?.includeOwnerName ?? false,
    };
  }

  private parseExpiresAt(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const expiresAt = new Date(value);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException('expiresAt은 현재 시각 이후여야 합니다.');
    }

    return expiresAt;
  }

  private parseOptionalFutureDate(value: string | null | undefined): Date | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.parseExpiresAt(value);
  }

  private async findPublicSnapshotRow(shareId: string, now = new Date()) {
    const row = await this.prisma.shareSnapshot.findFirst({
      where: {
        shareId,
        status: ShareSnapshotStatusValue.ACTIVE,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    if (!row) {
      throw new NotFoundException('공유 스냅샷을 찾을 수 없습니다.');
    }

    return row;
  }

  private async findOwnedSnapshotRow(userId: string, shareId: string) {
    const row = await this.prisma.shareSnapshot.findFirst({
      where: {
        shareId,
        userId,
        deletedAt: null,
      },
    });

    if (!row) {
      throw new NotFoundException('공유 스냅샷을 찾을 수 없습니다.');
    }

    return row;
  }

  private extractSajuSummaryPayload(result: unknown): SnapshotPayload {
    const root = this.toRecord(result);
    const report = this.toRecord(root?.report);
    const overall = this.toRecord(report?.overall);
    const title = typeof overall?.title === 'string' ? overall.title : '사주팔자 서머리';
    const summary = typeof overall?.summary === 'string' ? overall.summary : undefined;

    return {
      result,
      title: title.slice(0, 240),
      summary: summary?.slice(0, 500),
      score: null,
    };
  }

  private extractTodayFortunePayload(result: unknown): SnapshotPayload {
    const root = this.toRecord(result);
    const todayFortune = this.toRecord(root?.todayFortune);
    const title =
      typeof todayFortune?.headline === 'string' ? todayFortune.headline : '오늘의 운세';
    const summary =
      typeof todayFortune?.summary === 'string' ? todayFortune.summary : undefined;
    const score = typeof todayFortune?.luckScore === 'number' ? todayFortune.luckScore : null;

    return {
      result,
      title: title.slice(0, 240),
      summary: summary?.slice(0, 500),
      score,
    };
  }

  private extractStructuredFortunePayload(
    result: unknown,
    key: 'monthlyReading' | 'yearlyReading' | 'decadeReading',
    fallbackTitle: string,
  ): SnapshotPayload {
    const root = this.toRecord(result);
    const reading = this.toRecord(root?.[key]);
    const title =
      typeof reading?.headline === 'string' ? reading.headline : `${fallbackTitle} 풀이`;
    const summary = typeof reading?.summary === 'string' ? reading.summary : undefined;
    const score = typeof reading?.luckScore === 'number' ? reading.luckScore : null;

    return {
      result,
      title: title.slice(0, 240),
      summary: summary?.slice(0, 500),
      score,
    };
  }

  private buildPublicData(input: {
    resultJson: Prisma.JsonValue;
    inputJson: Prisma.JsonValue | null;
    options: NormalizedShareOptions;
  }): PublicSnapshotData {
    const result = this.cloneJson(input.resultJson);
    const data: PublicSnapshotData = {
      result: this.maskResult(result, input.options),
    };

    if (input.options.includeBirthInfo && input.inputJson) {
      data.input = this.cloneJson(input.inputJson);
    }

    return data;
  }

  private maskResult(value: unknown, options: NormalizedShareOptions): unknown {
    const result = this.cloneJson(value);

    if (!options.includeBirthInfo) {
      this.deleteDeepKeys(result, ['birthDate', 'birthTime', 'gender', 'ownerName', 'displayName']);
    }

    if (!options.includeManse) {
      this.deleteDeepKeys(result, ['manse', 'palja', 'pillars']);
    }

    return result;
  }

  private deleteDeepKeys(value: unknown, keys: string[]): void {
    if (Array.isArray(value)) {
      value.forEach((item) => this.deleteDeepKeys(item, keys));
      return;
    }

    const record = this.toRecord(value);
    if (!record) {
      return;
    }

    keys.forEach((key) => {
      delete record[key];
    });

    Object.values(record).forEach((child) => this.deleteDeepKeys(child, keys));
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private toRecord(value: unknown): JsonRecord | undefined {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonRecord;
    }

    return undefined;
  }

  private generateShareId(): string {
    return randomBytes(16).toString('base64url');
  }

  private isShareIdConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes('share_id')
    );
  }
}
