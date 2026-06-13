import type {
  CommercialBrief,
  DirectFinalAsset,
  DirectFinalAssetReview,
  DirectFinalSelfReviewSummary,
  SellingReasonCard,
} from '@/types/direct-final';
import { evaluateDirectFinalCompliance } from './compliance';
import { clampScore, directFinalId } from './validation';

export function evaluateDirectFinalAsset(
  brief: CommercialBrief,
  cards: SellingReasonCard[],
  asset: DirectFinalAsset,
): DirectFinalAssetReview {
  const issues = evaluateDirectFinalCompliance(brief.productType, asset);
  const populatedTextBlocks = asset.textBlocks.filter((block) => block.content.trim());
  const lineCount = populatedTextBlocks.reduce((sum, block) => sum + block.maxLines, 0);
  const lineLimit = asset.assetKind === 'detail-module' ? 6 : 5;
  const assetLabel =
    asset.assetKind === 'detail-module'
      ? `详情模块 ${asset.detailModuleCode ?? asset.assetId}`
      : `主图 ${asset.mainImageSlot ?? asset.assetId}`;
  const missingSellingReasonLinks =
    asset.originSellingReasonIds.length === 0 ||
    asset.originSellingReasonIds.some(
      (sellingReasonId) => !cards.some((card) => card.sellingReasonId === sellingReasonId),
    );

  let scoreConciseness = 100;
  let scoreInImageFit = 100;
  let scoreCompliance = 100;
  let scoreStructure = 100;
  let scoreUtility = 100;
  const violationSet = new Set<string>();
  const criticalViolationSet = new Set<string>();

  if (lineCount === 0) {
    scoreConciseness -= 20;
    scoreUtility -= 20;
    violationSet.add(`${assetLabel} 还没有有效的图内文案。`);
  }
  if (lineCount > lineLimit) {
    scoreConciseness -= 45;
    scoreInImageFit -= 20;
    violationSet.add(`${assetLabel} 图内文字总行数 ${lineCount}，超过 ${lineLimit} 行上限。`);
  }
  if (!asset.visualContent.trim()) {
    scoreInImageFit -= 25;
    scoreStructure -= 15;
    violationSet.add('visualContent 为空。');
  }
  if (!asset.inImageCopy.trim()) {
    scoreInImageFit -= 15;
    scoreUtility -= 15;
    violationSet.add('inImageCopy 为空。');
  }
  if (asset.layoutHints.length < 2) {
    scoreInImageFit -= 20;
    scoreStructure -= 15;
    violationSet.add('layoutHints 少于 2 条。');
  }
  if (asset.layerPlan.length < 3) {
    scoreInImageFit -= 15;
    scoreStructure -= 25;
    violationSet.add('layerPlan 少于 3 层。');
  }
  if (!asset.designNotes.trim()) {
    scoreStructure -= 25;
    violationSet.add('designNotes 为空。');
  }
  if (!asset.goal.trim()) {
    scoreUtility -= 20;
    violationSet.add('goal 为空。');
  }
  if (missingSellingReasonLinks) {
    scoreUtility -= 35;
    violationSet.add('originSellingReasonIds 没有完整指回已确认卖点卡。');
  }

  for (const issue of issues) {
    scoreCompliance -= issue.critical ? 50 : 15;
    violationSet.add(issue.message);
    if (issue.critical) criticalViolationSet.add(issue.message);
  }

  scoreConciseness = clampScore(scoreConciseness);
  scoreInImageFit = clampScore(scoreInImageFit);
  scoreCompliance = clampScore(scoreCompliance);
  scoreStructure = clampScore(scoreStructure);
  scoreUtility = clampScore(scoreUtility);

  return {
    assetId: asset.assetId,
    score: clampScore(
      Math.round(
        (scoreConciseness + scoreInImageFit + scoreCompliance + scoreStructure + scoreUtility) /
          5,
      ),
    ),
    scoreConciseness,
    scoreInImageFit,
    scoreCompliance,
    scoreStructure,
    scoreUtility,
    violations: [...violationSet],
    criticalViolations: [...criticalViolationSet],
    missingSellingReasonLinks,
    lineCount,
  };
}

export function buildSelfReviewSummary(
  brief: CommercialBrief,
  cards: SellingReasonCard[],
  assets: DirectFinalAsset[],
): DirectFinalSelfReviewSummary {
  const perAsset = assets.map((asset) => evaluateDirectFinalAsset(brief, cards, asset));
  const totalScore =
    perAsset.length > 0
      ? clampScore(Math.round(perAsset.reduce((sum, review) => sum + review.score, 0) / perAsset.length))
      : 0;
  const passedGate = perAsset.every(
    (review) =>
      review.criticalViolations.length === 0 &&
      !review.missingSellingReasonLinks &&
      review.score >= 80,
  );
  return {
    reviewId: directFinalId('self_review'),
    totalScore,
    perAsset,
    passedGate,
    evaluatedAt: new Date().toISOString(),
    localGatePassed: passedGate,
    model: null,
    copyLanguage: 'zh-CN',
    lastError: null,
  };
}
