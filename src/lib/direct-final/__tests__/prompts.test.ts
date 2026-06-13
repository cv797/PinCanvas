import { describe, expect, it } from 'vitest';
import type { DirectFinalAsset } from '@/types/direct-final';
import { buildDirectFinalExecutionPrompt } from '../prompts';

const asset: DirectFinalAsset = {
  assetId: 'asset_1',
  assetKind: 'main-image',
  mainImageSlot: 1,
  goal: '首图点击率核心',
  visualContent: '包装和内容物同屏',
  inImageCopy: '轻松早餐',
  textBlocks: [{ role: 'headline', content: '轻松早餐', maxLines: 1 }],
  layoutHints: [{ anchor: 'top-left', align: 'left', relation: 'above product', reservedSpace: '25%' }],
  layerPlan: [
    { role: 'background', description: '浅色厨房台面' },
    { role: 'product', description: '保留包装和内容物' },
    { role: 'text', description: '左上短标题' },
  ],
  designNotes: '清爽、真实电商成品',
  negativeConstraints: ['Do not alter logo', 'Do not invent certification marks'],
  complianceNotes: '普通食品不写功效承诺',
  selfReviewScore: 95,
  originSellingReasonIds: ['reason_1'],
  generatedAt: null,
  model: null,
};

describe('buildDirectFinalExecutionPrompt', () => {
  it('includes fidelity, text, layout, layer, and negative constraints', () => {
    const prompt = buildDirectFinalExecutionPrompt({
      brief: { brandName: 'Pin', companyName: 'Pin Co', productType: 'food' },
      asset,
      copyLanguage: 'zh-CN',
      aspectRatio: '1:1',
    });

    expect(prompt).toContain('Preserve the original product shape, logo, package text');
    expect(prompt).toContain('- headline: 轻松早餐 (max 1 lines)');
    expect(prompt).toContain('anchor=top-left');
    expect(prompt).toContain('- product: 保留包装和内容物');
    expect(prompt).toContain('- Do not alter logo');
  });
});
