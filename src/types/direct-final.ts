import type { NodeId } from './node';

export type DirectFinalProductType = 'food' | 'blue-cap-health' | 'sports' | 'other';
export type DirectFinalRiskLevel = 'low' | 'medium' | 'high';
export type DirectFinalGenerationSource = 'ai' | 'manual';
export type DirectFinalAssetKind = 'main-image' | 'detail-module';
export type DirectFinalMainImageSlot = 1 | 2 | 3 | 4 | 5;
export type DirectFinalDetailModuleCode = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';
export type DirectFinalCopyLanguage = 'zh-CN' | 'ru-RU';
export type DirectFinalSourceImageRole = 'package' | 'contents' | 'detail' | 'general';

export type DirectFinalStaleSignal = 'source_image_changed';

export interface DirectFinalSourceImage {
  imageId: string;
  nodeId: NodeId;
  filename: string;
  roleName?: string | null;
  role: DirectFinalSourceImageRole;
  roleLabel: string;
  shortRoleLabel: string;
  width?: number;
  height?: number;
  url: string;
}

export interface CommercialBriefSourceSnapshot {
  imageIds: string[];
}

export interface CommercialBrief {
  briefId: string;
  productType: DirectFinalProductType;
  brandName: string;
  companyName: string;
  skuList: string[];
  priceInfo: string;
  copyDraft: string;
  targetAudienceNotes: string;
  competitiveRefs: string[];
  marketNotes: string;
  missingFields: string[];
  source: DirectFinalGenerationSource;
  generatedAt: string | null;
  model: string | null;
  lastError: string | null;
  confirmedAt: string | null;
  hasManualEdits: boolean;
  isStale: boolean;
  staleSignals: DirectFinalStaleSignal[];
  sourceSnapshot: CommercialBriefSourceSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface SellingReasonCard {
  sellingReasonId: string;
  targetAudience: string;
  painPoint: string;
  solution: string;
  benefitTranslation: string;
  trustEvidence: string;
  priority: 1 | 2 | 3 | 4 | 5;
  scenePreference: string;
  applicableModules: string[];
  source: DirectFinalGenerationSource;
  generatedAt: string | null;
  model: string | null;
  lastError: string | null;
  hasManualEdits: boolean;
  confirmedAt: string | null;
  updatedAt: string;
}

export interface DirectFinalTextBlock {
  role: 'headline' | 'subheadline' | 'bullet' | 'cta' | 'compliance' | 'price' | 'annotation';
  content: string;
  maxLines: number;
  optional?: boolean;
}

export interface DirectFinalLayoutHint {
  anchor:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'center'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
  align: 'left' | 'center' | 'right';
  relation?: string | null;
  reservedSpace?: string | null;
}

export interface DirectFinalLayerRole {
  role: 'product' | 'decoration' | 'background' | 'text' | 'badge';
  description: string;
}

export interface DirectFinalAsset {
  assetId: string;
  assetKind: DirectFinalAssetKind;
  mainImageSlot?: DirectFinalMainImageSlot;
  detailModuleCode?: DirectFinalDetailModuleCode;
  goal: string;
  visualContent: string;
  inImageCopy: string;
  textBlocks: DirectFinalTextBlock[];
  layoutHints: DirectFinalLayoutHint[];
  layerPlan: DirectFinalLayerRole[];
  designNotes: string;
  negativeConstraints: string[];
  complianceNotes: string;
  selfReviewScore: number | null;
  originSellingReasonIds: string[];
  generatedAt: string | null;
  model: string | null;
}

export interface DirectFinalRiskSummary {
  riskLevel: DirectFinalRiskLevel;
  signals: string[];
  updatedAt: string;
}

export interface DirectFinalAssetReview {
  assetId: string;
  score: number;
  scoreConciseness: number | null;
  scoreInImageFit: number | null;
  scoreCompliance: number | null;
  scoreStructure: number | null;
  scoreUtility: number | null;
  violations: string[];
  criticalViolations: string[];
  missingSellingReasonLinks: boolean;
  lineCount: number;
}

export interface DirectFinalSelfReviewSummary {
  reviewId: string | null;
  totalScore: number;
  perAsset: DirectFinalAssetReview[];
  passedGate: boolean;
  evaluatedAt: string;
  localGatePassed: boolean;
  model: string | null;
  copyLanguage: DirectFinalCopyLanguage;
  lastError: string | null;
}

export interface DirectFinalReview {
  reviewId: string;
  outputNodeId: NodeId;
  promptNodeId: NodeId;
  assetId: string;
  copyLanguage: DirectFinalCopyLanguage;
  scoreInImageCopyRendered: number;
  scoreCopyReadability: number;
  scoreCopyGoalAlignment: number;
  scoreComplianceRetained: number;
  scoreFinishedLook: number;
  scoreProductFidelity: number;
  aiSummary: string;
  issues: string[];
  reviewStatus: 'draft' | 'confirmed';
  reviewSource: 'manual' | 'ai' | 'ai+manual';
  reviewedAt: string | null;
}

export const DIRECT_FINAL_MAIN_IMAGE_SLOTS: Array<{
  slot: DirectFinalMainImageSlot;
  goal: string;
}> = [
  { slot: 1, goal: '首图点击率核心' },
  { slot: 2, goal: '痛点共鸣' },
  { slot: 3, goal: '差异化优势' },
  { slot: 4, goal: '场景适配' },
  { slot: 5, goal: 'CTA 行动号召' },
];

export const DIRECT_FINAL_DETAIL_MODULES: Array<{
  code: DirectFinalDetailModuleCode;
  goal: string;
  optional: boolean;
}> = [
  { code: 'M1', goal: '首屏痛点共鸣', optional: false },
  { code: 'M2', goal: '核心优势展开', optional: false },
  { code: 'M3', goal: '配方/工艺深度', optional: false },
  { code: 'M4', goal: '使用场景', optional: false },
  { code: 'M5', goal: '品牌/资质信任', optional: true },
  { code: 'M6', goal: '规格参数 + 竞品对比', optional: false },
  { code: 'M7', goal: 'FAQ', optional: false },
  { code: 'M8', goal: '购买引导 + 法律声明', optional: true },
];

export const DIRECT_FINAL_DEFAULT_DETAIL_MODULES: DirectFinalDetailModuleCode[] = [
  'M1',
  'M2',
  'M3',
  'M4',
  'M6',
  'M7',
];
