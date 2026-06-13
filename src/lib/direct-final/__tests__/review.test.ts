import { describe, expect, it } from 'vitest';
import type { CommercialBrief, DirectFinalAsset, SellingReasonCard } from '@/types/direct-final';
import { evaluateDirectFinalAsset } from '../review';

const brief: CommercialBrief = {
  briefId: 'brief_1',
  productType: 'food',
  brandName: 'Pin',
  companyName: 'Pin Co',
  skuList: ['A'],
  priceInfo: '',
  copyDraft: '轻松早餐',
  targetAudienceNotes: '早餐人群',
  competitiveRefs: [],
  marketNotes: '',
  missingFields: [],
  source: 'ai',
  generatedAt: null,
  model: null,
  lastError: null,
  confirmedAt: new Date().toISOString(),
  hasManualEdits: false,
  isStale: false,
  staleSignals: [],
  sourceSnapshot: { imageIds: ['img_1'] },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const card: SellingReasonCard = {
  sellingReasonId: 'reason_1',
  targetAudience: '早餐人群',
  painPoint: '准备麻烦',
  solution: '即食搭配',
  benefitTranslation: '省时间',
  trustEvidence: '包装可见信息',
  priority: 1,
  scenePreference: '厨房台面',
  applicableModules: ['main-image'],
  source: 'ai',
  generatedAt: null,
  model: null,
  lastError: null,
  hasManualEdits: false,
  confirmedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function asset(patch: Partial<DirectFinalAsset> = {}): DirectFinalAsset {
  return {
    assetId: 'asset_1',
    assetKind: 'main-image',
    mainImageSlot: 1,
    goal: '首图点击率核心',
    visualContent: '包装和内容物同屏',
    inImageCopy: '轻松早餐',
    textBlocks: [
      { role: 'headline', content: '轻松早餐', maxLines: 1 },
      { role: 'subheadline', content: '开袋即享', maxLines: 1 },
    ],
    layoutHints: [
      { anchor: 'top-left', align: 'left', relation: null, reservedSpace: '25%' },
      { anchor: 'bottom-right', align: 'right', relation: null, reservedSpace: '20%' },
    ],
    layerPlan: [
      { role: 'background', description: '干净浅色背景' },
      { role: 'product', description: '商品主体' },
      { role: 'text', description: '短文案' },
    ],
    designNotes: '清爽电商主图',
    negativeConstraints: ['保留 logo', '保留包装结构', '不虚构认证', '不改变材质'],
    complianceNotes: '不写功效承诺',
    selfReviewScore: null,
    originSellingReasonIds: ['reason_1'],
    generatedAt: null,
    model: null,
    ...patch,
  };
}

describe('evaluateDirectFinalAsset', () => {
  it('passes a concise asset linked to a confirmed selling reason', () => {
    const review = evaluateDirectFinalAsset(brief, [card], asset());
    expect(review.score).toBe(100);
    expect(review.missingSellingReasonLinks).toBe(false);
  });

  it('penalizes too many main-image text lines and missing card links', () => {
    const review = evaluateDirectFinalAsset(
      brief,
      [card],
      asset({
        textBlocks: [
          { role: 'headline', content: 'A', maxLines: 3 },
          { role: 'subheadline', content: 'B', maxLines: 3 },
        ],
        originSellingReasonIds: ['unknown'],
      }),
    );
    expect(review.lineCount).toBe(6);
    expect(review.violations.some((item) => item.includes('超过 5 行上限'))).toBe(true);
    expect(review.missingSellingReasonLinks).toBe(true);
  });
});
