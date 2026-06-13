import { describe, expect, it } from 'vitest';
import type { DirectFinalSourceImage, SellingReasonCard } from '@/types/direct-final';
import {
  buildRiskSummary,
  clampScore,
  computeCommercialBriefMissingFields,
  createAssetFromPayload,
  createCommercialBriefFromPayload,
  createSellingReasonCardsFromPayload,
  normalizeDetailModuleCode,
} from '../validation';

const sourceImage: DirectFinalSourceImage = {
  imageId: 'img_1',
  nodeId: 'node_img' as DirectFinalSourceImage['nodeId'],
  filename: '包装参数表.png',
  role: 'package',
  roleLabel: '包装图',
  shortRoleLabel: '包装',
  width: 800,
  height: 800,
  url: 'data:image/png;base64,abc',
};

function card(id: string): SellingReasonCard {
  return {
    sellingReasonId: id,
    targetAudience: '早餐人群',
    painPoint: '没时间准备',
    solution: '即食搭配',
    benefitTranslation: '更省事',
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
}

describe('direct-final validation', () => {
  it('normalizes commercial brief and computes missing fields', () => {
    const brief = createCommercialBriefFromPayload(
      { productType: 'food', brandName: '  Pin  ', skuList: [], copyDraft: '短文案' },
      { model: 'gpt-4o', sourceImages: [sourceImage] },
    );
    expect(brief.brandName).toBe('Pin');
    expect(brief.productType).toBe('food');
    expect(brief.missingFields).toEqual([
      'companyName',
      'skuList',
      'priceInfo',
      'targetAudienceNotes',
    ]);
    expect(computeCommercialBriefMissingFields(brief)).toContain('priceInfo');
  });

  it('normalizes selling reason cards and clamps priority fallback', () => {
    const cards = createSellingReasonCardsFromPayload(
      { cards: [{ targetAudience: 'A', priority: 9 }, { targetAudience: 'B' }] },
      { model: 'gpt-4o' },
    );
    expect(cards).toHaveLength(2);
    expect(cards.map((item) => item.priority)).toEqual([1, 2]);
  });

  it('keeps matched selling reason ids when creating assets', () => {
    const asset = createAssetFromPayload(
      {
        goal: '点击率',
        visualContent: '包装和内容物同屏',
        inImageCopy: '轻松早餐',
        textBlocks: [{ role: 'headline', content: '轻松早餐', maxLines: 2 }],
        layoutHints: [{ anchor: 'top', align: 'center', relation: 'above product' }],
        layerPlan: [{ role: 'product', description: '主商品' }],
        designNotes: '简洁',
        negativeConstraints: ['保留 logo'],
        complianceNotes: '普通食品不写功效',
        originSellingReasonIds: ['reason_a', 'unknown'],
      },
      { assetKind: 'main-image', slot: 1, model: 'gpt-4o', matchedCards: [card('reason_a')] },
    );
    expect(asset.originSellingReasonIds).toEqual(['reason_a']);
    expect(asset.mainImageSlot).toBe(1);
  });

  it('detects risk signals and clamps review scores', () => {
    const brief = createCommercialBriefFromPayload(
      { skuList: ['a', 'b', 'c', 'd'], missingFields: ['a', 'b', 'c'], copyDraft: '认证徽章' },
      { model: 'gpt-4o', sourceImages: [sourceImage, { ...sourceImage, imageId: 'img_2' }, { ...sourceImage, imageId: 'img_3' }] },
    );
    const risk = buildRiskSummary(brief, [sourceImage]);
    expect(risk.signals).toContain('highSkuCount');
    expect(clampScore(105.9)).toBe(100);
    expect(clampScore(-1)).toBe(0);
    expect(normalizeDetailModuleCode('M7')).toBe('M7');
    expect(normalizeDetailModuleCode('bad')).toBe('M1');
  });
});
