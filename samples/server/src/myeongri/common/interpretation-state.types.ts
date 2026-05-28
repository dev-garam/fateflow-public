import { FiveElement } from '../constants/ganzhi.constants';
import { Pillar, TenGod } from '../myeongri.types';

export type TenGodFamily = 'resource' | 'peer' | 'output' | 'wealth' | 'pressure';
export type AxisLevel = 'low' | 'medium' | 'high';
export type SemanticBucket = 'base' | 'modifier' | 'conflict' | 'amplified';
export type ThemeTopic = 'career' | 'finance' | 'relationship' | 'personality' | 'timing';
export type ThemeDirection = 'positive' | 'negative' | 'mixed' | 'neutral';
export type PresenceState = 'absent' | 'hidden_only' | 'visible';
export type ActivationState = 'inactive' | 'weak' | 'active' | 'strong';
export type DistortionState = 'normal' | 'suppressed' | 'excessive' | 'stagnant' | 'trapped';
export type StructurePatternKey =
  | 'fire_deficient'
  | 'wood_deficient'
  | 'earth_biased'
  | 'metal_biased'
  | 'water_biased'
  | 'circulation_weakened'
  | 'circulation_stagnant'
  | 'control_excessive'
  | 'balanced_support';

export interface NormalizedScore {
  rawScore: number;
  normalizedScore: number;
}

export interface TenGodActivationEntry extends NormalizedScore {
  family: TenGodFamily;
  level: AxisLevel;
  presenceState: PresenceState;
  activationState: ActivationState;
  distortionState: DistortionState;
  visibleCount: number;
  hiddenCount: number;
  rootedCount: number;
  seasonalSupport: number;
}

export interface ResourceAxis extends NormalizedScore {
  entries: Record<TenGodFamily, TenGodActivationEntry>;
  dominantFamily: TenGodFamily;
  weakestFamily: TenGodFamily;
}

export interface EnvironmentAxis extends NormalizedScore {
  seasonRelation: TenGodFamily;
  seasonSupportScore: number;
  monthBranchInfluenceScore: number;
  rootSupportScore: number;
  hiddenStemForceScore: number;
  bongStateBias: AxisLevel;
  geoStateBias: AxisLevel;
}

export interface StructurePatternFinding extends NormalizedScore {
  key: StructurePatternKey;
  dominance: number;
}

export interface StructureAxis extends NormalizedScore {
  primaryPattern: StructurePatternKey | null;
  secondaryPatterns: StructurePatternKey[];
  findings: StructurePatternFinding[];
}

export interface RelationAxis extends NormalizedScore {
  relationScore: number;
  supportScore: number;
  conflictScore: number;
  isolationScore: number;
  nobilityScore: number;
  innerSensitivityScore: number;
  volatilityScore: number;
}

export interface TimingAxis extends NormalizedScore {
  baseTimingState: AxisLevel;
  daeunInfluence: number;
  seunInfluence: number;
  wolunInfluence: number;
  activationWeight: number;
  suppressionWeight: number;
  currentTimingThemes: string[];
}

export interface SemanticThemeTrace extends NormalizedScore {
  tag: string;
  label: string;
  bucket: SemanticBucket;
  direction: ThemeDirection;
  topics: ThemeTopic[];
  priority: number;
  sources: string[];
  axes: string[];
  confidence: number;
}

export interface SemanticState {
  pillars: Record<'year' | 'month' | 'day' | 'hour', Pillar | null>;
  dayMasterElement: FiveElement;
  dayMasterTenGod: TenGod | null;
  resourceAxis: ResourceAxis;
  environmentAxis: EnvironmentAxis;
  structureAxis: StructureAxis;
  relationAxis: RelationAxis;
  timingAxis: TimingAxis;
  themes: SemanticThemeTrace[];
  baseThemes: SemanticThemeTrace[];
  modifierThemes: SemanticThemeTrace[];
  conflictThemes: SemanticThemeTrace[];
  amplifiedThemes: SemanticThemeTrace[];
  narrativeHints: string[];
  reasonCodes: string[];
}
