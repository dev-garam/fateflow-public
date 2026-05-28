import {
  NarrativePolicy,
  ReadingStyleProfile,
  WashedReadingText,
} from '../common/reading-policy.types';

export interface ReadingRenderInput {
  tone: NarrativePolicy['tone'];
  styleProfile: ReadingStyleProfile;
  reasonCodes: string[];
  narrativeHints: string[];
  semanticTags: string[];
  topSemanticTags: string[];
  topConflictSemanticTags: string[];
  summaryBase: string;
  summarySuffix: string | null;
  summaryTheme: string;
  strengthThemes: string[];
  cautionThemes: string[];
  balanceTipThemes: string[];
  executionLevel: 'low' | 'medium' | 'high';
  recoveryLevel: 'low' | 'medium' | 'high';
  pressureLevel: 'low' | 'medium' | 'high';
  stabilityLevel: 'low' | 'medium' | 'high';
  adaptationLevel: 'low' | 'medium' | 'high';
  strengthLines: string[];
  cautionLines: string[];
  balanceTipLines: string[];
}

export type ReadingRenderOutput = WashedReadingText;
