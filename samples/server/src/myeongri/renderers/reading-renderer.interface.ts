import { ReadingRenderInput, ReadingRenderOutput } from './reading-render.types';

export interface ReadingRenderer {
  render(input: ReadingRenderInput): ReadingRenderOutput;
}
