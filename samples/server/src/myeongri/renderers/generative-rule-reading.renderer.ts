import { Injectable } from '@nestjs/common';
import {
  prefixNarrativeLead,
  washNarrativeSentence,
  washNarrativeSentenceList,
  washNarrativeSummary,
} from '../../common/narrative/narrative-voice';
import {
  resolveCommonReadingSectionFollowup,
  resolveCommonReadingSectionLead,
  resolveCommonReadingSummaryInsight,
  resolveCommonReadingSummaryLead,
} from '../../common/narrative/narrative-template-assets';
import { BlockReadingRenderer } from './block-reading.renderer';
import { ReadingRenderInput, ReadingRenderOutput } from './reading-render.types';

@Injectable()
export class GenerativeRuleReadingRenderer extends BlockReadingRenderer {
  override render(input: ReadingRenderInput): ReadingRenderOutput {
    const base = super.render(input);

    return {
      summary: this.rewriteSummary(base.summary, input),
      strengths: this.rewriteSection(base.strengths, input, 'strength'),
      cautions: this.rewriteSection(base.cautions, input, 'caution'),
      balanceTips: this.rewriteSection(base.balanceTips, input, 'tip'),
    };
  }

  private rewriteSummary(summary: string, input: ReadingRenderInput): string {
    const cleanSummary = summary.trim();
    const segments = cleanSummary
      .split(/(?<=[.!?])\s+/)
      .map((segment) => segment.replace(/[.!?]+$/g, '').trim())
      .filter((segment) => segment.length > 0);

    const primary = segments[0] ?? cleanSummary.replace(/[.!?]+$/g, '').trim();
    const secondary = segments[1] ?? null;
    const summaryLead = resolveCommonReadingSummaryLead(input);

    const leadSentence = summaryLead
      ? this.prefixLine(summaryLead, primary)
      : washNarrativeSummary(primary);

    if (!secondary) {
      return leadSentence;
    }

    return `${leadSentence} ${washNarrativeSummary(
      this.composeSummaryFollowup(input, secondary),
    )}`.trim();
  }

  private rewriteSection(
    lines: string[],
    input: ReadingRenderInput,
    section: 'strength' | 'caution' | 'tip',
  ): string[] {
    if (lines.length === 0) {
      return lines;
    }

    const normalizedLines = lines.map((line) => line.replace(/[.!?]+$/g, '').trim());

    if (section === 'strength') {
      return this.buildStrengthParagraph(normalizedLines, input);
    }
    if (section === 'caution') {
      return this.buildCautionParagraph(normalizedLines, input);
    }
    return this.buildTipParagraph(normalizedLines, input);
  }

  private prefixLine(lead: string, line: string): string {
    if (!lead.trim()) {
      return washNarrativeSentence(line);
    }
    return washNarrativeSentence(prefixNarrativeLead(lead, line));
  }

  private buildStrengthParagraph(lines: string[], input: ReadingRenderInput): string[] {
    const lead = resolveCommonReadingSectionLead(input, 'strength');
    const primary = lines[0];
    const secondary = lines[1];
    const result = [this.prefixLine(lead, primary)];

    const followup = resolveCommonReadingSectionFollowup(input, 'strength') ?? secondary;
    if (followup) {
      result.push(
        washNarrativeSentence(
          this.composeFollowup(
            this.resolveFollowupOpener(input.tone, 'strength', input.styleProfile),
            followup,
            input.tone,
            'strength',
          ),
        ),
      );
    }

    return result.slice(0, 2);
  }

  private buildCautionParagraph(lines: string[], input: ReadingRenderInput): string[] {
    const lead = resolveCommonReadingSectionLead(input, 'caution');
    const primary = lines[0];
    const secondary = lines[1];
    const result = [this.prefixLine(lead, primary)];

    const followup = resolveCommonReadingSectionFollowup(input, 'caution') ?? secondary;
    if (followup) {
      result.push(
        washNarrativeSentence(
          this.composeFollowup(
            this.resolveFollowupOpener(input.tone, 'caution', input.styleProfile),
            followup,
            input.tone,
            'caution',
          ),
        ),
      );
    }

    return result.slice(0, 2);
  }

  private buildTipParagraph(lines: string[], input: ReadingRenderInput): string[] {
    const lead = resolveCommonReadingSectionLead(input, 'tip');
    const primary = lines[0];
    const secondary = lines[1];
    const result = [this.prefixLine(lead, primary)];

    const followup = resolveCommonReadingSectionFollowup(input, 'tip') ?? secondary;
    if (followup) {
      result.push(
        washNarrativeSentence(
          this.composeFollowup(
            this.resolveFollowupOpener(input.tone, 'tip', input.styleProfile),
            followup,
            input.tone,
            'tip',
          ),
        ),
      );
    }

    if (input.styleProfile === 'plain') {
      return result.slice(0, 1);
    }

    return result.slice(0, 2);
  }

  protected override washSentence(text: string): string {
    return washNarrativeSentence(text);
  }

  protected override washSentenceList(list: string[], maxCount: number, fallback: string): string[] {
    return washNarrativeSentenceList(list, { maxCount, fallback });
  }

  private composeFollowup(
    opener: string,
    line: string,
    tone: ReadingRenderInput['tone'],
    section: 'strength' | 'caution' | 'tip',
  ): string {
    void tone;
    void section;
    if (!opener.trim()) {
      return line;
    }
    return `${opener} ${line}`;
  }

  private resolveFollowupOpener(
    tone: ReadingRenderInput['tone'],
    section: 'strength' | 'caution' | 'tip',
    styleProfile: ReadingRenderInput['styleProfile'],
  ): string {
    void tone;
    void section;
    void styleProfile;
    return '';
  }

  private composeSummaryFollowup(input: ReadingRenderInput, line: string): string {
    const interpreted = resolveCommonReadingSummaryInsight(input);
    if (interpreted) {
      return interpreted;
    }

    if (input.pressureLevel === 'high') {
      return input.tone === 'warm'
        ? `이럴수록 ${line}`
        : input.tone === 'direct'
          ? `그래서 ${line}`
          : `다만 ${line}`;
    }

    if (input.recoveryLevel === 'low') {
      return input.tone === 'warm'
        ? `이 기반을 살리려면 ${line}`
        : input.tone === 'direct'
          ? `${line}`
          : `이를 안정적으로 쓰려면 ${line}`;
    }

    return input.tone === 'warm'
      ? `이 흐름에서는 ${line}`
      : input.tone === 'direct'
        ? `결국 ${line}`
        : `전체적으로는 ${line}`;
  }
}
