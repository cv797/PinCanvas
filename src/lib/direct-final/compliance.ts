import type { DirectFinalAsset, DirectFinalProductType } from '@/types/direct-final';

export interface DirectFinalComplianceIssue {
  message: string;
  critical: boolean;
}

const ABSOLUTE_PATTERN = /最有效|最佳|第一|唯一|顶级|根治|包治|100%|百分之百|零风险|无副作用/u;
const FOOD_CLAIM_PATTERN = /保健|养生|降三高|减肥|瘦身|增强免疫|治疗|修复|改善疾病/u;
const BLUE_CAP_RISK_PATTERN = /治疗|治愈|逆转|药效|处方|医学证明/u;
const SPORTS_MEDICAL_PATTERN = /康复|治疗|矫正|修复|消炎|止痛/u;

export function evaluateDirectFinalCompliance(
  productType: DirectFinalProductType,
  asset: DirectFinalAsset,
): DirectFinalComplianceIssue[] {
  const issues = [...evaluateGeneralCompliance(asset)];
  switch (productType) {
    case 'food':
      issues.push(...evaluateFoodCompliance(asset));
      break;
    case 'blue-cap-health':
      issues.push(...evaluateBlueCapCompliance(asset));
      break;
    case 'sports':
      issues.push(...evaluateSportsCompliance(asset));
      break;
    default:
      break;
  }
  return issues;
}

function evaluateGeneralCompliance(asset: DirectFinalAsset): DirectFinalComplianceIssue[] {
  const issues: DirectFinalComplianceIssue[] = [];
  const combinedText = [
    asset.inImageCopy,
    asset.designNotes,
    asset.complianceNotes,
    ...asset.textBlocks.map((block) => block.content),
  ].join(' ');

  if (ABSOLUTE_PATTERN.test(combinedText)) {
    issues.push({ message: '出现绝对化或无法证明的承诺。', critical: true });
  }
  if (!/logo|包装|认证|材质|结构/u.test(asset.negativeConstraints.join(' '))) {
    issues.push({ message: 'negativeConstraints 没有明确写保真约束。', critical: false });
  }
  return issues;
}

function evaluateFoodCompliance(asset: DirectFinalAsset): DirectFinalComplianceIssue[] {
  const combinedText = [
    asset.inImageCopy,
    asset.complianceNotes,
    ...asset.textBlocks.map((block) => block.content),
  ].join(' ');
  return FOOD_CLAIM_PATTERN.test(combinedText)
    ? [{ message: '普通食品脚本里出现了功效或治疗暗示。', critical: true }]
    : [];
}

function evaluateBlueCapCompliance(asset: DirectFinalAsset): DirectFinalComplianceIssue[] {
  const combinedText = [
    asset.inImageCopy,
    asset.complianceNotes,
    ...asset.textBlocks.map((block) => block.content),
  ].join(' ');
  return BLUE_CAP_RISK_PATTERN.test(combinedText)
    ? [{ message: '保健食品脚本里出现了医疗或治疗表述。', critical: true }]
    : [];
}

function evaluateSportsCompliance(asset: DirectFinalAsset): DirectFinalComplianceIssue[] {
  const combinedText = [
    asset.inImageCopy,
    asset.complianceNotes,
    ...asset.textBlocks.map((block) => block.content),
  ].join(' ');
  return SPORTS_MEDICAL_PATTERN.test(combinedText)
    ? [{ message: '运动器材脚本里出现了医疗化表述。', critical: true }]
    : [];
}
