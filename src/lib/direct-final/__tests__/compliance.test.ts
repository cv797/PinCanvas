import { describe, expect, it } from 'vitest';
import type { DirectFinalAsset } from '@/types/direct-final';
import { evaluateDirectFinalCompliance } from '../compliance';

function asset(patch: Partial<DirectFinalAsset> = {}): DirectFinalAsset {
  return {
    assetId: 'asset_1',
    assetKind: 'main-image',
    mainImageSlot: 1,
    goal: '首图点击率核心',
    visualContent: '商品和包装同屏',
    inImageCopy: '早餐轻负担',
    textBlocks: [{ role: 'headline', content: '早餐轻负担', maxLines: 1 }],
    layoutHints: [{ anchor: 'top-left', align: 'left', relation: null, reservedSpace: '20%' }],
    layerPlan: [{ role: 'product', description: '保留包装和主体结构' }],
    designNotes: '干净背景',
    negativeConstraints: ['不得改变 logo', '不得改变包装结构', '不得虚构认证', '不得改变材质'],
    complianceNotes: '不做医疗承诺',
    selfReviewScore: null,
    originSellingReasonIds: ['reason_1'],
    generatedAt: null,
    model: null,
    ...patch,
  };
}

describe('evaluateDirectFinalCompliance', () => {
  it('flags absolute claims', () => {
    const issues = evaluateDirectFinalCompliance('other', asset({ inImageCopy: '全网最佳选择' }));
    expect(issues.some((issue) => issue.critical)).toBe(true);
  });

  it('flags food health claims', () => {
    const issues = evaluateDirectFinalCompliance('food', asset({ inImageCopy: '增强免疫好选择' }));
    expect(issues.map((issue) => issue.message)).toContain('普通食品脚本里出现了功效或治疗暗示。');
  });

  it('flags missing fidelity constraints', () => {
    const issues = evaluateDirectFinalCompliance('other', asset({ negativeConstraints: ['不要过度修饰'] }));
    expect(issues.map((issue) => issue.message)).toContain('negativeConstraints 没有明确写保真约束。');
  });
});
