import {
  AlgorithmConfigValidationResult,
  AlgorithmProfileConfig,
  AlgorithmWeights,
  BlockPolicy,
  ImpactLevel,
  InterpretationBias,
  InterpretationPolicy,
  NarrativePolicy,
  ShinsalPolicy,
} from './reading-policy.types';

interface AlgorithmConfigDefaults {
  weights: AlgorithmWeights;
  interpretationPolicy: InterpretationPolicy;
  narrativePolicy: NarrativePolicy;
  blockPolicy: BlockPolicy;
  shinsalPolicy: ShinsalPolicy;
}

const IMPACT_LEVELS: ImpactLevel[] = ['low', 'medium', 'high'];
const INTERPRETATION_BIASES: InterpretationBias[] = ['neutral', 'supportive', 'cautious'];
const BALANCE_TIP_MODES: NarrativePolicy['balanceTipMode'][] = [
  'practical',
  'psychological',
  'mixed',
];
const NARRATIVE_TONES: NarrativePolicy['tone'][] = ['calm', 'direct', 'warm'];
const BLOCK_VARIANT_MODES: BlockPolicy['variantMode'][] = ['stable', 'diverse'];
const INTERPRETATION_AXES = ['strength', 'season', 'structure', 'event', 'shinsal'] as const;
const SUMMARY_BIASES = ['structure', 'season', 'strength', 'event'] as const;
const STRENGTH_THEMES = ['quality', 'execution', 'stability', 'adaptation', 'recovery'] as const;
const CAUTION_THEMES = ['pressure', 'resource', 'relationship', 'rigidity', 'pace'] as const;
const WEIGHT_MIN = 0;
const WEIGHT_MAX = 3;
const SHINSAL_SCORE_MIN = 0;
const SHINSAL_SCORE_MAX = 100;
const MIN_SECTION_LINES = 1;
const MAX_SECTION_LINES = 5;

export function normalizeAlgorithmProfileConfig(
  configJson: unknown,
  defaults: AlgorithmConfigDefaults,
): AlgorithmConfigValidationResult {
  const issues: string[] = [];
  const root = toObject(configJson);

  if (configJson !== undefined && configJson !== null && !root) {
    issues.push('config_json must be an object');
  }

  const rawConfig = (root ?? {}) as AlgorithmProfileConfig;
  const weights = toObject(rawConfig.weights);
  const interpretationPolicy = toObject(rawConfig.interpretationPolicy);
  const narrativePolicy = toObject(rawConfig.narrativePolicy);
  const blockPolicy = toObject(rawConfig.blockPolicy);
  const shinsalPolicy = toObject(rawConfig.shinsalPolicy);

  return {
    config: {
      weights: {
        season: parseNumberInRange(
          weights?.season,
          defaults.weights.season,
          'weights.season',
          issues,
          WEIGHT_MIN,
          WEIGHT_MAX,
        ),
        strength: parseNumberInRange(
          weights?.strength,
          defaults.weights.strength,
          'weights.strength',
          issues,
          WEIGHT_MIN,
          WEIGHT_MAX,
        ),
        structure: parseNumberInRange(
          weights?.structure,
          defaults.weights.structure,
          'weights.structure',
          issues,
          WEIGHT_MIN,
          WEIGHT_MAX,
        ),
        event: parseNumberInRange(
          weights?.event,
          defaults.weights.event,
          'weights.event',
          issues,
          WEIGHT_MIN,
          WEIGHT_MAX,
        ),
        relationship: parseNumberInRange(
          weights?.relationship,
          defaults.weights.relationship,
          'weights.relationship',
          issues,
          WEIGHT_MIN,
          WEIGHT_MAX,
        ),
        career: parseNumberInRange(
          weights?.career,
          defaults.weights.career,
          'weights.career',
          issues,
          WEIGHT_MIN,
          WEIGHT_MAX,
        ),
      },
      interpretationPolicy: {
        primaryAxes: parseStringArray(
          interpretationPolicy?.primaryAxes,
          defaults.interpretationPolicy.primaryAxes,
          'interpretationPolicy.primaryAxes',
          issues,
          false,
          INTERPRETATION_AXES,
        ),
        secondaryAxes: parseStringArray(
          interpretationPolicy?.secondaryAxes,
          defaults.interpretationPolicy.secondaryAxes,
          'interpretationPolicy.secondaryAxes',
          issues,
          false,
          INTERPRETATION_AXES,
        ),
        eventSensitivity: parseEnumValue(
          interpretationPolicy?.eventSensitivity,
          IMPACT_LEVELS,
          defaults.interpretationPolicy.eventSensitivity,
          'interpretationPolicy.eventSensitivity',
          issues,
        ),
        relationshipBias: parseEnumValue(
          interpretationPolicy?.relationshipBias,
          INTERPRETATION_BIASES,
          defaults.interpretationPolicy.relationshipBias,
          'interpretationPolicy.relationshipBias',
          issues,
        ),
        careerBias: parseEnumValue(
          interpretationPolicy?.careerBias,
          INTERPRETATION_BIASES,
          defaults.interpretationPolicy.careerBias,
          'interpretationPolicy.careerBias',
          issues,
        ),
      },
      narrativePolicy: {
        summaryBias: parseEnumValue(
          narrativePolicy?.summaryBias,
          SUMMARY_BIASES,
          defaults.narrativePolicy.summaryBias,
          'narrativePolicy.summaryBias',
          issues,
        ),
        strengthPriority: parseStringArray(
          narrativePolicy?.strengthPriority,
          defaults.narrativePolicy.strengthPriority,
          'narrativePolicy.strengthPriority',
          issues,
          false,
          STRENGTH_THEMES,
        ),
        cautionPriority: parseStringArray(
          narrativePolicy?.cautionPriority,
          defaults.narrativePolicy.cautionPriority,
          'narrativePolicy.cautionPriority',
          issues,
          false,
          CAUTION_THEMES,
        ),
        balanceTipMode: parseEnumValue(
          narrativePolicy?.balanceTipMode,
          BALANCE_TIP_MODES,
          defaults.narrativePolicy.balanceTipMode,
          'narrativePolicy.balanceTipMode',
          issues,
        ),
        maxStrengthLines: parseIntegerInRange(
          narrativePolicy?.maxStrengthLines,
          defaults.narrativePolicy.maxStrengthLines,
          'narrativePolicy.maxStrengthLines',
          issues,
          MIN_SECTION_LINES,
          MAX_SECTION_LINES,
        ),
        maxCautionLines: parseIntegerInRange(
          narrativePolicy?.maxCautionLines,
          defaults.narrativePolicy.maxCautionLines,
          'narrativePolicy.maxCautionLines',
          issues,
          MIN_SECTION_LINES,
          MAX_SECTION_LINES,
        ),
        maxBalanceTipLines: parseIntegerInRange(
          narrativePolicy?.maxBalanceTipLines,
          defaults.narrativePolicy.maxBalanceTipLines,
          'narrativePolicy.maxBalanceTipLines',
          issues,
          MIN_SECTION_LINES,
          MAX_SECTION_LINES,
        ),
        tone: parseEnumValue(
          narrativePolicy?.tone,
          NARRATIVE_TONES,
          defaults.narrativePolicy.tone,
          'narrativePolicy.tone',
          issues,
        ),
      },
      blockPolicy: {
        preferredBlockSets: parseStringArray(
          blockPolicy?.preferredBlockSets,
          defaults.blockPolicy.preferredBlockSets,
          'blockPolicy.preferredBlockSets',
          issues,
          true,
        ),
        excludedBlockSets: parseStringArray(
          blockPolicy?.excludedBlockSets,
          defaults.blockPolicy.excludedBlockSets,
          'blockPolicy.excludedBlockSets',
          issues,
          true,
        ),
        preferredCategories: parseStringArray(
          blockPolicy?.preferredCategories,
          defaults.blockPolicy.preferredCategories,
          'blockPolicy.preferredCategories',
          issues,
          true,
        ),
        excludedCategories: parseStringArray(
          blockPolicy?.excludedCategories,
          defaults.blockPolicy.excludedCategories,
          'blockPolicy.excludedCategories',
          issues,
          true,
        ),
        variantMode: parseEnumValue(
          blockPolicy?.variantMode,
          BLOCK_VARIANT_MODES,
          defaults.blockPolicy.variantMode,
          'blockPolicy.variantMode',
          issues,
        ),
      },
      shinsalPolicy: {
        enabled: parseStringArray(
          shinsalPolicy?.enabled,
          defaults.shinsalPolicy.enabled,
          'shinsalPolicy.enabled',
          issues,
        ),
        priority: parseNumberRecord(
          shinsalPolicy?.priority,
          defaults.shinsalPolicy.priority,
          'shinsalPolicy.priority',
          issues,
        ),
        score: parseNumberRecord(
          shinsalPolicy?.score,
          defaults.shinsalPolicy.score,
          'shinsalPolicy.score',
          issues,
          SHINSAL_SCORE_MIN,
          SHINSAL_SCORE_MAX,
        ),
        defaultImpactLevel: parseEnumValue(
          shinsalPolicy?.defaultImpactLevel,
          IMPACT_LEVELS,
          defaults.shinsalPolicy.defaultImpactLevel,
          'shinsalPolicy.defaultImpactLevel',
          issues,
        ),
      },
    },
    issues,
  };
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  path: string,
  issues: string[],
): T {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issues.push(`${path} must be one of: ${allowed.join(', ')}`);
    return fallback;
  }
  return value as T;
}

function parseStringArray(
  value: unknown,
  fallback: string[],
  path: string,
  issues: string[],
  allowEmpty = false,
  allowedValues?: readonly string[],
): string[] {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array of strings`);
    return fallback;
  }

  const parsed = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(
          (item) =>
            item.length > 0 && (!allowedValues || allowedValues.includes(item)),
        ),
    ),
  );

  if (!allowEmpty && parsed.length === 0) {
    issues.push(`${path} must include at least one string`);
    return fallback;
  }

  if (parsed.length !== value.length) {
    issues.push(
      allowedValues
        ? `${path} contains invalid, unsupported, or duplicate values`
        : `${path} contains invalid or duplicate values`,
    );
  }

  return parsed;
}

function parseNumberInRange(
  value: unknown,
  fallback: number,
  path: string,
  issues: string[],
  min: number,
  max: number,
): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push(`${path} must be a finite number`);
    return fallback;
  }
  if (value < min || value > max) {
    issues.push(`${path} must be between ${min} and ${max}`);
    return fallback;
  }
  return value;
}

function parseIntegerInRange(
  value: unknown,
  fallback: number,
  path: string,
  issues: string[],
  min: number,
  max: number,
): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    issues.push(`${path} must be an integer`);
    return fallback;
  }
  if (value < min || value > max) {
    issues.push(`${path} must be between ${min} and ${max}`);
    return fallback;
  }
  return value;
}

function parseNumberRecord(
  value: unknown,
  fallback: Record<string, number>,
  path: string,
  issues: string[],
  min?: number,
  max?: number,
): Record<string, number> {
  if (value === undefined || value === null) {
    return fallback;
  }

  const source = toObject(value);
  if (!source) {
    issues.push(`${path} must be an object of numbers`);
    return fallback;
  }

  const parsed: Record<string, number> = { ...fallback };

  for (const [key, raw] of Object.entries(source)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      issues.push(`${path}.${key} must be a finite number`);
      continue;
    }
    if (min !== undefined && raw < min) {
      issues.push(`${path}.${key} must be >= ${min}`);
      continue;
    }
    if (max !== undefined && raw > max) {
      issues.push(`${path}.${key} must be <= ${max}`);
      continue;
    }
    parsed[key] = raw;
  }

  return parsed;
}
