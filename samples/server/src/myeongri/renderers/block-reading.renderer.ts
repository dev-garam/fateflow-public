import { Injectable } from '@nestjs/common';
import { washSentence, washSentenceList } from '../../common/text-washing';
import { ReadingRenderer } from './reading-renderer.interface';
import { ReadingRenderInput, ReadingRenderOutput } from './reading-render.types';

@Injectable()
export class BlockReadingRenderer implements ReadingRenderer {
  render(input: ReadingRenderInput): ReadingRenderOutput {
    return {
      summary: this.washSentence(this.composeSummary(input.summaryBase, input.summarySuffix)),
      strengths: this.washSentenceList(
        input.strengthLines,
        3,
        '강점은 상황 적응력과 실행 의지에서 형성됩니다.',
      ),
      cautions: this.washSentenceList(
        input.cautionLines,
        3,
        '주의점은 페이스 관리와 우선순위 유지에서 주로 나타납니다.',
      ),
      balanceTips: this.washSentenceList(
        input.balanceTipLines,
        3,
        '균형을 위해 생활 리듬과 실행 루틴을 먼저 고정해 보세요.',
      ),
    };
  }

  protected composeSummary(base: string, suffix: string | null): string {
    if (!suffix) {
      return base;
    }
    return `${base} ${suffix}`;
  }

  protected washSentenceList(list: string[], maxCount: number, fallback: string): string[] {
    return washSentenceList(list, { maxCount, fallback });
  }

  protected washSentence(text: string): string {
    return washSentence(text);
  }
}
