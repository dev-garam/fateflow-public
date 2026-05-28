export type ImpactLevel = 'low' | 'medium' | 'high';
export type InterpretationBias = 'neutral' | 'supportive' | 'cautious';
export type BalanceTipMode = 'practical' | 'psychological' | 'mixed';
export type NarrativeTone = 'calm' | 'direct' | 'warm';
export type BlockVariantMode = 'stable' | 'diverse';
export type ReadingStyleProfile = 'balanced' | 'seasonal' | 'strength' | 'plain';

export interface ShinsalPolicy {
  enabled: string[];
  priority: Record<string, number>;
  score: Record<string, number>;
  defaultImpactLevel: ImpactLevel;
}

export interface AlgorithmWeights {
  season: number;
  strength: number;
  structure: number;
  event: number;
  relationship: number;
  career: number;
}

export interface InterpretationPolicy {
  primaryAxes: string[];
  secondaryAxes: string[];
  eventSensitivity: ImpactLevel;
  relationshipBias: InterpretationBias;
  careerBias: InterpretationBias;
}

export interface NarrativePolicy {
  summaryBias: string;
  strengthPriority: string[];
  cautionPriority: string[];
  balanceTipMode: BalanceTipMode;
  maxStrengthLines: number;
  maxCautionLines: number;
  maxBalanceTipLines: number;
  tone: NarrativeTone;
}

export interface BlockPolicy {
  preferredBlockSets: string[];
  excludedBlockSets: string[];
  preferredCategories: string[];
  excludedCategories: string[];
  variantMode: BlockVariantMode;
}

export interface ReadingBlock {
  theme: string;
  blockSet: string;
  category: string;
  text: string;
}

export interface AlgorithmContext {
  key: string;
  displayName: string;
  weights: AlgorithmWeights;
  interpretationPolicy: InterpretationPolicy;
  narrativePolicy: NarrativePolicy;
  blockPolicy: BlockPolicy;
  shinsalPolicy: ShinsalPolicy;
  configIssues: string[];
}

export interface AlgorithmProfileConfig {
  weights?: Partial<AlgorithmWeights>;
  interpretationPolicy?: Partial<InterpretationPolicy>;
  narrativePolicy?: Partial<NarrativePolicy>;
  blockPolicy?: Partial<BlockPolicy>;
  shinsalPolicy?: Partial<ShinsalPolicy>;
  notes?: string;
}

export interface NormalizedAlgorithmProfileConfig {
  weights: AlgorithmWeights;
  interpretationPolicy: InterpretationPolicy;
  narrativePolicy: NarrativePolicy;
  blockPolicy: BlockPolicy;
  shinsalPolicy: ShinsalPolicy;
}

export interface AlgorithmConfigValidationResult {
  config: NormalizedAlgorithmProfileConfig;
  issues: string[];
}

export interface WashedReadingText {
  summary: string;
  strengths: string[];
  cautions: string[];
  balanceTips: string[];
  evidence?: ReadingEvidenceItem[];
}

export interface ReadingEvidenceItem {
  section: 'summary' | 'strengths' | 'cautions' | 'balanceTips';
  text: string;
  sourceKind: 'reasonCode' | 'theme' | 'fallback';
  reasonCodes: string[];
}

export interface ReadingSignals {
  summaryTheme: string;
  strengthThemes: string[];
  cautionThemes: string[];
  tipThemes: string[];
  executionLevel: 'low' | 'medium' | 'high';
  recoveryLevel: 'low' | 'medium' | 'high';
  pressureLevel: 'low' | 'medium' | 'high';
  stabilityLevel: 'low' | 'medium' | 'high';
  adaptationLevel: 'low' | 'medium' | 'high';
}

export interface ReadingNarrativePlan {
  summaryTheme: string;
  strengthThemes: string[];
  cautionThemes: string[];
  tipThemes: string[];
  maxStrengthLines: number;
  maxCautionLines: number;
  maxBalanceTipLines: number;
  tone: NarrativePolicy['tone'];
  styleProfile: ReadingStyleProfile;
  variantSeedOffset: number;
}
