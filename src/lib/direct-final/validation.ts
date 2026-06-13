import type {
  CommercialBrief,
  DirectFinalAsset,
  DirectFinalAssetKind,
  DirectFinalCopyLanguage,
  DirectFinalDetailModuleCode,
  DirectFinalLayerRole,
  DirectFinalLayoutHint,
  DirectFinalMainImageSlot,
  DirectFinalReview,
  DirectFinalRiskLevel,
  DirectFinalRiskSummary,
  DirectFinalSourceImage,
  DirectFinalTextBlock,
  SellingReasonCard,
} from '@/types/direct-final';
import { DIRECT_FINAL_DETAIL_MODULES } from '@/types/direct-final';
import type { NodeId } from '@/types/node';
import type { JsonSchema } from '@/api/structured';
import { buildSourceImageCompositionNotes, buildSourceImageFileSummary } from './sourceImages';

const TEXT_BLOCK_ROLES: DirectFinalTextBlock['role'][] = [
  'headline',
  'subheadline',
  'bullet',
  'cta',
  'compliance',
  'price',
  'annotation',
];

const DETAIL_CODES = DIRECT_FINAL_DETAIL_MODULES.map((item) => item.code);

const TEXT_BLOCK_SCHEMA = {
  type: 'array',
  minItems: 2,
  maxItems: 8,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['role', 'content', 'maxLines', 'optional'],
    properties: {
      role: { type: 'string', enum: TEXT_BLOCK_ROLES },
      content: { type: 'string' },
      maxLines: { type: 'integer', minimum: 1, maximum: 3 },
      optional: { type: ['boolean', 'null'] },
    },
  },
} as const;

const LAYOUT_HINT_SCHEMA = {
  type: 'array',
  minItems: 2,
  maxItems: 6,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['anchor', 'align', 'relation', 'reservedSpace'],
    properties: {
      anchor: {
        type: 'string',
        enum: [
          'top',
          'bottom',
          'left',
          'right',
          'center',
          'top-left',
          'top-right',
          'bottom-left',
          'bottom-right',
        ],
      },
      align: { type: 'string', enum: ['left', 'center', 'right'] },
      relation: { type: ['string', 'null'] },
      reservedSpace: { type: ['string', 'null'] },
    },
  },
} as const;

const LAYER_PLAN_SCHEMA = {
  type: 'array',
  minItems: 3,
  maxItems: 5,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['role', 'description'],
    properties: {
      role: { type: 'string', enum: ['product', 'decoration', 'background', 'text', 'badge'] },
      description: { type: 'string' },
    },
  },
} as const;

export const COMMERCIAL_BRIEF_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'productType',
    'brandName',
    'companyName',
    'skuList',
    'priceInfo',
    'copyDraft',
    'targetAudienceNotes',
    'competitiveRefs',
    'marketNotes',
    'missingFields',
  ],
  properties: {
    productType: { type: 'string', enum: ['food', 'blue-cap-health', 'sports', 'other'] },
    brandName: { type: 'string' },
    companyName: { type: 'string' },
    skuList: { type: 'array', maxItems: 8, items: { type: 'string' } },
    priceInfo: { type: 'string' },
    copyDraft: { type: 'string' },
    targetAudienceNotes: { type: 'string' },
    competitiveRefs: { type: 'array', maxItems: 6, items: { type: 'string' } },
    marketNotes: { type: 'string' },
    missingFields: { type: 'array', maxItems: 8, items: { type: 'string' } },
  },
};

export const SELLING_REASON_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'targetAudience',
          'painPoint',
          'solution',
          'benefitTranslation',
          'trustEvidence',
          'priority',
          'scenePreference',
          'applicableModules',
        ],
        properties: {
          targetAudience: { type: 'string' },
          painPoint: { type: 'string' },
          solution: { type: 'string' },
          benefitTranslation: { type: 'string' },
          trustEvidence: { type: 'string' },
          priority: { type: 'integer', minimum: 1, maximum: 5 },
          scenePreference: { type: 'string' },
          applicableModules: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: { type: 'string' },
          },
        },
      },
    },
  },
};

export const DIRECT_FINAL_ASSET_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'goal',
    'visualContent',
    'inImageCopy',
    'textBlocks',
    'layoutHints',
    'layerPlan',
    'designNotes',
    'negativeConstraints',
    'complianceNotes',
    'originSellingReasonIds',
  ],
  properties: {
    goal: { type: 'string' },
    visualContent: { type: 'string' },
    inImageCopy: { type: 'string' },
    textBlocks: TEXT_BLOCK_SCHEMA,
    layoutHints: LAYOUT_HINT_SCHEMA,
    layerPlan: LAYER_PLAN_SCHEMA,
    designNotes: { type: 'string' },
    negativeConstraints: {
      type: 'array',
      minItems: 4,
      maxItems: 12,
      items: { type: 'string' },
    },
    complianceNotes: { type: 'string' },
    originSellingReasonIds: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
    },
  },
};

export const DIRECT_FINAL_REVIEW_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'scoreInImageCopyRendered',
    'scoreCopyReadability',
    'scoreCopyGoalAlignment',
    'scoreComplianceRetained',
    'scoreFinishedLook',
    'scoreProductFidelity',
    'aiSummary',
    'issues',
  ],
  properties: {
    scoreInImageCopyRendered: { type: 'number' },
    scoreCopyReadability: { type: 'number' },
    scoreCopyGoalAlignment: { type: 'number' },
    scoreComplianceRetained: { type: 'number' },
    scoreFinishedLook: { type: 'number' },
    scoreProductFidelity: { type: 'number' },
    aiSummary: { type: 'string' },
    issues: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' } },
  },
};

export function directFinalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createCommercialBriefFromPayload(
  value: unknown,
  options: {
    model: string;
    sourceImages: DirectFinalSourceImage[];
    previous?: CommercialBrief;
  },
): CommercialBrief {
  const normalized = normalizeCommercialBriefSeed(value);
  const missingFields = Array.from(
    new Set([...normalized.missingFields, ...computeCommercialBriefMissingFields(normalized)]),
  );
  const now = new Date().toISOString();
  return {
    briefId: options.previous?.briefId ?? directFinalId('brief'),
    productType: normalized.productType,
    brandName: normalized.brandName,
    companyName: normalized.companyName,
    skuList: normalized.skuList,
    priceInfo: normalized.priceInfo,
    copyDraft: normalized.copyDraft,
    targetAudienceNotes: normalized.targetAudienceNotes,
    competitiveRefs: normalized.competitiveRefs,
    marketNotes: normalized.marketNotes,
    missingFields,
    source: 'ai',
    generatedAt: now,
    model: options.model,
    lastError: null,
    confirmedAt: null,
    hasManualEdits: false,
    isStale: false,
    staleSignals: [],
    sourceSnapshot: { imageIds: options.sourceImages.map((image) => image.imageId) },
    createdAt: options.previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export function normalizeCommercialBriefForSave(
  input: CommercialBrief,
  sourceImages: DirectFinalSourceImage[],
): CommercialBrief {
  const normalized = normalizeCommercialBriefSeed(input);
  const now = new Date().toISOString();
  return {
    ...input,
    ...normalized,
    missingFields: computeCommercialBriefMissingFields(normalized),
    source: input.source === 'ai' ? 'ai' : 'manual',
    confirmedAt: now,
    hasManualEdits: true,
    isStale: false,
    staleSignals: [],
    sourceSnapshot: { imageIds: sourceImages.map((image) => image.imageId) },
    updatedAt: now,
  };
}

export function refreshCommercialBriefStale(
  brief: CommercialBrief | undefined,
  sourceImages: DirectFinalSourceImage[],
): CommercialBrief | undefined {
  if (!brief) return undefined;
  const currentIds = sourceImages.map((image) => image.imageId);
  const isStale = JSON.stringify(brief.sourceSnapshot.imageIds) !== JSON.stringify(currentIds);
  if (brief.isStale === isStale) return brief;
  return {
    ...brief,
    isStale,
    staleSignals: isStale ? ['source_image_changed'] : [],
    updatedAt: new Date().toISOString(),
  };
}

export function createSellingReasonCardsFromPayload(
  value: unknown,
  options: { model: string; limit?: number },
): SellingReasonCard[] {
  const candidate = value && typeof value === 'object' ? (value as { cards?: unknown }) : null;
  const rawCards = Array.isArray(candidate?.cards) ? candidate.cards : [];
  const now = new Date().toISOString();
  return rawCards.slice(0, options.limit ?? 5).map((item, index) => {
    const card = normalizeSellingReasonCard(item, index);
    return {
      ...card,
      sellingReasonId: directFinalId('reason'),
      source: 'ai',
      generatedAt: now,
      model: options.model,
      lastError: null,
      hasManualEdits: false,
      confirmedAt: null,
      updatedAt: now,
    };
  });
}

export function normalizeSellingReasonForSave(input: SellingReasonCard): SellingReasonCard {
  const card = normalizeSellingReasonCard(input, 0);
  return {
    ...input,
    ...card,
    source: input.source === 'ai' ? 'ai' : 'manual',
    hasManualEdits: true,
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createAssetFromPayload(
  value: unknown,
  options: {
    assetKind: DirectFinalAssetKind;
    slot?: DirectFinalMainImageSlot;
    moduleCode?: DirectFinalDetailModuleCode;
    model: string;
    matchedCards: SellingReasonCard[];
  },
): DirectFinalAsset {
  const payload = normalizeAssetPayload(value);
  const matchedCardIds = new Set(options.matchedCards.map((card) => card.sellingReasonId));
  const originSellingReasonIds = payload.originSellingReasonIds.filter((id) => matchedCardIds.has(id));
  return {
    assetId: directFinalId('asset'),
    assetKind: options.assetKind,
    mainImageSlot: options.slot,
    detailModuleCode: options.moduleCode,
    goal: payload.goal,
    visualContent: payload.visualContent,
    inImageCopy: payload.inImageCopy,
    textBlocks: payload.textBlocks,
    layoutHints: payload.layoutHints,
    layerPlan: payload.layerPlan,
    designNotes: payload.designNotes,
    negativeConstraints: payload.negativeConstraints,
    complianceNotes: payload.complianceNotes,
    selfReviewScore: null,
    originSellingReasonIds:
      originSellingReasonIds.length > 0
        ? originSellingReasonIds
        : options.matchedCards.map((card) => card.sellingReasonId),
    generatedAt: new Date().toISOString(),
    model: options.model,
  };
}

export function createReviewFromPayload(
  value: unknown,
  options: {
    outputNodeId: NodeId;
    promptNodeId: NodeId;
    assetId: string;
    copyLanguage: DirectFinalCopyLanguage;
  },
): DirectFinalReview {
  const payload = normalizeReviewPayload(value);
  return {
    reviewId: directFinalId('review'),
    outputNodeId: options.outputNodeId,
    promptNodeId: options.promptNodeId,
    assetId: options.assetId,
    copyLanguage: options.copyLanguage,
    scoreInImageCopyRendered: clampScore(payload.scoreInImageCopyRendered),
    scoreCopyReadability: clampScore(payload.scoreCopyReadability),
    scoreCopyGoalAlignment: clampScore(payload.scoreCopyGoalAlignment),
    scoreComplianceRetained: clampScore(payload.scoreComplianceRetained),
    scoreFinishedLook: clampScore(payload.scoreFinishedLook),
    scoreProductFidelity: clampScore(payload.scoreProductFidelity),
    aiSummary: payload.aiSummary,
    issues: payload.issues,
    reviewStatus: 'draft',
    reviewSource: 'ai',
    reviewedAt: null,
  };
}

export function buildRiskSummary(
  brief: CommercialBrief | undefined,
  sourceImages: DirectFinalSourceImage[],
): DirectFinalRiskSummary {
  const signals: string[] = [];
  const sourceNotes = [
    buildSourceImageFileSummary(sourceImages),
    ...buildSourceImageCompositionNotes(sourceImages),
    brief?.copyDraft ?? '',
    brief?.marketNotes ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const skuCount = brief?.skuList.length ?? 0;
  const missingFieldCount = brief?.missingFields.length ?? 0;

  if (/(小字|配料|参数|规格|说明|表格|成分|营养)/u.test(sourceNotes)) {
    signals.push('packagingDenseText');
  }
  if (/(logo|认证|资质|蓝帽|徽章|badge)/iu.test(sourceNotes)) {
    signals.push('multipleLogosOrBadges');
  }
  if (/(竖排|表格|参数区|对比)/u.test(sourceNotes)) {
    signals.push('verticalTextOrComplexTable');
  }
  if (skuCount >= 4 || sourceImages.length >= 3) {
    signals.push('highSkuCount');
  }
  if (/(认证|备案|蓝帽|声明|资质)/u.test(sourceNotes)) {
    signals.push('manyComplianceMarks');
  }
  if (missingFieldCount >= 3) {
    signals.push('manyMissingCommercialFields');
  }

  const highRiskSignals = signals.filter((signal) =>
    ['packagingDenseText', 'multipleLogosOrBadges', 'verticalTextOrComplexTable'].includes(signal),
  ).length;
  const riskLevel: DirectFinalRiskLevel =
    highRiskSignals >= 2 || signals.length >= 4
      ? 'high'
      : signals.length >= 2
        ? 'medium'
        : 'low';

  return { riskLevel, signals, updatedAt: new Date().toISOString() };
}

export function computeCommercialBriefMissingFields(
  brief: Pick<
    CommercialBrief,
    'brandName' | 'companyName' | 'skuList' | 'priceInfo' | 'copyDraft' | 'targetAudienceNotes'
  >,
): string[] {
  const fields: string[] = [];
  if (!brief.brandName) fields.push('brandName');
  if (!brief.companyName) fields.push('companyName');
  if (brief.skuList.length === 0) fields.push('skuList');
  if (!brief.priceInfo) fields.push('priceInfo');
  if (!brief.copyDraft) fields.push('copyDraft');
  if (!brief.targetAudienceNotes) fields.push('targetAudienceNotes');
  return fields;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), 100);
}

function normalizeCommercialBriefSeed(value: unknown) {
  const candidate = value && typeof value === 'object' ? (value as Partial<CommercialBrief>) : null;
  return {
    productType: normalizeProductType(candidate?.productType),
    brandName: normalizeText(candidate?.brandName),
    companyName: normalizeText(candidate?.companyName),
    skuList: normalizeStringList(candidate?.skuList),
    priceInfo: normalizeText(candidate?.priceInfo),
    copyDraft: normalizeText(candidate?.copyDraft),
    targetAudienceNotes: normalizeText(candidate?.targetAudienceNotes),
    competitiveRefs: normalizeStringList(candidate?.competitiveRefs),
    marketNotes: normalizeText(candidate?.marketNotes),
    missingFields: normalizeStringList(candidate?.missingFields),
  };
}

function normalizeSellingReasonCard(value: unknown, index: number): SellingReasonCard {
  const candidate = value && typeof value === 'object' ? (value as Partial<SellingReasonCard>) : null;
  const priorityValue =
    typeof candidate?.priority === 'number' && candidate.priority >= 1 && candidate.priority <= 5
      ? candidate.priority
      : Math.min(index + 1, 5);
  return {
    sellingReasonId:
      typeof candidate?.sellingReasonId === 'string' && candidate.sellingReasonId.trim()
        ? candidate.sellingReasonId.trim()
        : directFinalId('reason'),
    targetAudience: normalizeText(candidate?.targetAudience),
    painPoint: normalizeText(candidate?.painPoint),
    solution: normalizeText(candidate?.solution),
    benefitTranslation: normalizeText(candidate?.benefitTranslation),
    trustEvidence: normalizeText(candidate?.trustEvidence),
    priority: priorityValue as 1 | 2 | 3 | 4 | 5,
    scenePreference: normalizeText(candidate?.scenePreference),
    applicableModules: normalizeStringList(candidate?.applicableModules),
    source: candidate?.source === 'ai' ? 'ai' : 'manual',
    generatedAt: normalizeNullableText(candidate?.generatedAt),
    model: normalizeNullableText(candidate?.model),
    lastError: normalizeNullableText(candidate?.lastError),
    hasManualEdits: candidate?.hasManualEdits === true,
    confirmedAt: normalizeNullableText(candidate?.confirmedAt),
    updatedAt: normalizeNullableText(candidate?.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeAssetPayload(value: unknown): Omit<
  DirectFinalAsset,
  | 'assetId'
  | 'assetKind'
  | 'mainImageSlot'
  | 'detailModuleCode'
  | 'selfReviewScore'
  | 'generatedAt'
  | 'model'
> {
  const candidate = value && typeof value === 'object' ? value : null;
  return {
    goal: normalizeText((candidate as { goal?: unknown } | null)?.goal),
    visualContent: normalizeText((candidate as { visualContent?: unknown } | null)?.visualContent),
    inImageCopy: normalizeText((candidate as { inImageCopy?: unknown } | null)?.inImageCopy),
    textBlocks: normalizeTextBlocks((candidate as { textBlocks?: unknown } | null)?.textBlocks),
    layoutHints: normalizeLayoutHints((candidate as { layoutHints?: unknown } | null)?.layoutHints),
    layerPlan: normalizeLayerPlan((candidate as { layerPlan?: unknown } | null)?.layerPlan),
    designNotes: normalizeText((candidate as { designNotes?: unknown } | null)?.designNotes),
    negativeConstraints: normalizeStringList(
      (candidate as { negativeConstraints?: unknown } | null)?.negativeConstraints,
    ),
    complianceNotes: normalizeText((candidate as { complianceNotes?: unknown } | null)?.complianceNotes),
    originSellingReasonIds: normalizeStringList(
      (candidate as { originSellingReasonIds?: unknown } | null)?.originSellingReasonIds,
    ),
  };
}

function normalizeReviewPayload(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('AI 结果复盘结构无效。');
  const candidate = value as Partial<DirectFinalReview>;
  if (
    typeof candidate.scoreInImageCopyRendered !== 'number' ||
    typeof candidate.scoreCopyReadability !== 'number' ||
    typeof candidate.scoreCopyGoalAlignment !== 'number' ||
    typeof candidate.scoreComplianceRetained !== 'number' ||
    typeof candidate.scoreFinishedLook !== 'number' ||
    typeof candidate.scoreProductFidelity !== 'number' ||
    typeof candidate.aiSummary !== 'string' ||
    !Array.isArray(candidate.issues)
  ) {
    throw new Error('AI 结果复盘字段不完整。');
  }
  return {
    scoreInImageCopyRendered: candidate.scoreInImageCopyRendered,
    scoreCopyReadability: candidate.scoreCopyReadability,
    scoreCopyGoalAlignment: candidate.scoreCopyGoalAlignment,
    scoreComplianceRetained: candidate.scoreComplianceRetained,
    scoreFinishedLook: candidate.scoreFinishedLook,
    scoreProductFidelity: candidate.scoreProductFidelity,
    aiSummary: normalizeText(candidate.aiSummary),
    issues: normalizeStringList(candidate.issues),
  };
}

function normalizeTextBlocks(value: unknown): DirectFinalTextBlock[] {
  if (!Array.isArray(value)) return [];
  const normalized: DirectFinalTextBlock[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<DirectFinalTextBlock>;
    const content = normalizeText(candidate.content);
    if (!content) continue;
    normalized.push({
      role: normalizeTextBlockRole(candidate.role),
      content,
      maxLines:
        typeof candidate.maxLines === 'number'
          ? Math.min(Math.max(Math.round(candidate.maxLines), 1), 3)
          : 1,
      optional: candidate.optional === true ? true : undefined,
    });
  }
  return normalized;
}

function normalizeLayoutHints(value: unknown): DirectFinalLayoutHint[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const candidate = item as Partial<DirectFinalLayoutHint>;
      return {
        anchor: normalizeAnchor(candidate.anchor),
        align: normalizeAlign(candidate.align),
        relation: normalizeNullableText(candidate.relation),
        reservedSpace: normalizeNullableText(candidate.reservedSpace),
      };
    });
}

function normalizeLayerPlan(value: unknown): DirectFinalLayerRole[] {
  if (!Array.isArray(value)) return [];
  const normalized: DirectFinalLayerRole[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<DirectFinalLayerRole>;
    const description = normalizeText(candidate.description);
    if (!description) continue;
    normalized.push({ role: normalizeLayerRole(candidate.role), description });
  }
  return normalized;
}

function normalizeProductType(value: unknown): CommercialBrief['productType'] {
  return value === 'food' || value === 'blue-cap-health' || value === 'sports' || value === 'other'
    ? value
    : 'other';
}

function normalizeTextBlockRole(value: unknown): DirectFinalTextBlock['role'] {
  return TEXT_BLOCK_ROLES.includes(value as DirectFinalTextBlock['role'])
    ? (value as DirectFinalTextBlock['role'])
    : 'headline';
}

function normalizeAnchor(value: unknown): DirectFinalLayoutHint['anchor'] {
  return value === 'top' ||
    value === 'bottom' ||
    value === 'left' ||
    value === 'right' ||
    value === 'center' ||
    value === 'top-left' ||
    value === 'top-right' ||
    value === 'bottom-left' ||
    value === 'bottom-right'
    ? value
    : 'top-left';
}

function normalizeAlign(value: unknown): DirectFinalLayoutHint['align'] {
  return value === 'center' || value === 'right' ? value : 'left';
}

function normalizeLayerRole(value: unknown): DirectFinalLayerRole['role'] {
  return value === 'background' || value === 'decoration' || value === 'text' || value === 'badge'
    ? value
    : 'product';
}

function normalizeNullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeDetailModuleCode(value: unknown): DirectFinalDetailModuleCode {
  return DETAIL_CODES.includes(value as DirectFinalDetailModuleCode)
    ? (value as DirectFinalDetailModuleCode)
    : 'M1';
}
