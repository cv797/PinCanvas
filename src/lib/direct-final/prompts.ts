import type {
  CommercialBrief,
  DirectFinalAsset,
  DirectFinalCopyLanguage,
  DirectFinalDetailModuleCode,
  DirectFinalMainImageSlot,
  DirectFinalRiskSummary,
  DirectFinalSourceImage,
  SellingReasonCard,
} from '@/types/direct-final';
import { DIRECT_FINAL_DETAIL_MODULES, DIRECT_FINAL_MAIN_IMAGE_SLOTS } from '@/types/direct-final';
import {
  buildSourceImageCompositionNotes,
  buildSourceImageFileSummary,
  buildSourceImageRoleLines,
} from './sourceImages';

export function buildCommercialBriefInstructions(): string {
  return [
    '你是电商视觉策略编辑，要只根据源图和项目上下文生成 direct-final 商业输入草稿。',
    '品牌名、公司名、SKU、价格、包装主文案，只能写源图里真实能辨认或高度确定的信息。',
    '如果看不清或无法确认，字段留空，并把字段名加入 missingFields。',
    'copyDraft 输出中文主图短文案草稿，控制在 2 到 4 行，每行简短、可上图、不要空话。',
    'competitiveRefs 和 marketNotes 只能来自源图可推断的定位线索；没有依据就留空。',
    '不要编造品牌故事、公司全称、SKU 参数、价格、认证、口味或夸大卖点。',
    '只输出符合 schema 的 JSON。',
  ].join('\n');
}

export function buildCommercialBriefInputText(sourceImages: DirectFinalSourceImage[]): string {
  return [
    '请基于源图生成 direct-final 商业输入草稿。',
    `源图摘要：${buildSourceImageFileSummary(sourceImages)}`,
    ...buildSourceImageRoleLines(sourceImages),
    ...buildSourceImageCompositionNotes(sourceImages),
    '请特别关注：',
    '1. 产品类型要在普通食品 / 蓝帽保健食品 / 运动器材 / 其他中选一个。',
    '2. 品牌名、公司名、SKU、价格不清楚就留空，并标记 missingFields。',
    '3. 主图文案初稿必须是贴近商品身份的短句，不要空泛励志口号。',
    '4. 目标人群、市场备注、竞品参考只能写源图或包装可支撑的方向判断。',
  ].join('\n');
}

export function buildSellingReasonInstructions(): string {
  return [
    '你是电商转化文案策划，要基于已确认 commercial brief 和源图，为 direct-final 生成 3 到 5 张必卖理由卡。',
    '每张卡必须包含：目标人群、痛点、解决方案、利益翻译、信任证据、优先级、场景偏好、适用模块。',
    '所有内容必须基于可验证事实或已确认 brief，不要猜测源图里看不清的事实。',
    '如果信任证据不足，可以明确写成“待补充证据”，不要编造认证、专利、机构背书。',
    '场景偏好要写成可直接指导画面的短句，例如厨房早餐台面、健身房器械区、高级静物台面。',
    '适用模块优先使用：main-image、M1、M2、M3、M4、M5、M6、M7、M8。',
    '语气要适合电商页面，不要写成长段教学说明。',
    '只输出符合 schema 的 JSON。',
  ].join('\n');
}

export function buildSellingReasonInputText(
  brief: CommercialBrief,
  sourceImages: DirectFinalSourceImage[],
): string {
  return [
    '请生成 direct-final 必卖理由卡片。',
    `源图摘要：${buildSourceImageFileSummary(sourceImages)}`,
    ...buildSourceImageRoleLines(sourceImages),
    ...buildSourceImageCompositionNotes(sourceImages),
    `已确认 commercial brief：${JSON.stringify(
      {
        productType: brief.productType,
        brandName: brief.brandName,
        companyName: brief.companyName,
        skuList: brief.skuList,
        priceInfo: brief.priceInfo,
        copyDraft: brief.copyDraft,
        targetAudienceNotes: brief.targetAudienceNotes,
        competitiveRefs: brief.competitiveRefs,
        marketNotes: brief.marketNotes,
        missingFields: brief.missingFields,
      },
      null,
      2,
    )}`,
    '要求：',
    '1. 输出 3 到 5 张卡，优先级从 1 到 5。',
    '2. 痛点、方案、利益翻译之间要能串成完整说服链。',
    '3. 每张卡都要给出明确场景偏好，方便后续主图或详情模块换场景。',
    '4. 信任证据必须来自已确认信息或明确标成待补充。',
    '5. 适用模块要覆盖主图和详情模块，不要只写一种。',
    '6. 普通食品不写功效；保健类不写疾病治疗；运动器材不医疗化。',
  ].join('\n');
}

export function buildAssetInstructions(input: {
  copyLanguage: DirectFinalCopyLanguage;
  slot?: DirectFinalMainImageSlot;
  moduleCode?: DirectFinalDetailModuleCode;
}): string {
  const languageLine =
    input.copyLanguage === 'ru-RU'
      ? '最终执行语言是俄语，但当前输出仍然是中文编辑稿。中文稿要更短、更紧，主动为俄语长度膨胀留余量。'
      : '最终执行语言是中文，当前输出就是中文编辑稿。';
  const targetLine = input.slot
    ? `这次只输出主图 ${input.slot}，职责是：${getMainSlotGoal(input.slot)}。`
    : `这次只输出详情模块 ${input.moduleCode ?? 'M1'}，职责是：${getDetailModuleGoal(input.moduleCode ?? 'M1')}。`;
  const layoutLine = input.moduleCode
    ? '详情模块要能适配 3:4 竖版详情页：使用上中下信息层级和满高画面组织，不要写成 1:1 方形卡片居中套版。'
    : '主图要服务对应卡位目标，并保持可直接上架的电商成品感。';

  return [
    '你是电商视觉创意总监，要把 confirmed commercial brief、已确认卖点卡和参考图，写成 direct-final 单张成图脚本。',
    '输出的是最终成图脚本，不是无字底图 prompt，也不是普通 prompt list。',
    languageLine,
    targetLine,
    '每张脚本都要同时写清：画面内容、图内文案、布局提示、层级规划、合规边界和禁止项。',
    'textBlocks 不能只是卖点卡复述，必须先锚定源图里看得见的商品身份、包装表达和品牌线索，再做精简改写。',
    '如果卖点卡给了 scenePreference，它是硬输入：必须转成具体场景、道具、氛围和镜头组织，并在 designNotes 里写明采用了哪个偏好。',
    layoutLine,
    '看不清的文字不要编造；宁可少写，也不要写出和源图无关的标题、副标题、参数或信任表达。',
    '图内文字要少而准，主图最多 5 行，详情模块最多 6 行。',
    'layoutHints 必须是真实可执行的布局提示，layerPlan 至少覆盖 background、product、text 三层。',
    'originSellingReasonIds 必须指向输入里的已确认卖点卡，至少 1 个，最好 1 到 2 个。',
    '普通食品不能写功效；保健类不能写疾病或治疗；运动器材不能医疗化；所有品类都不要绝对化。',
    '只输出符合 schema 的 JSON，不要输出 markdown 或解释。',
  ].join('\n');
}

export function buildAssetInputText(input: {
  brief: CommercialBrief;
  cards: SellingReasonCard[];
  risk: DirectFinalRiskSummary;
  sourceImages: DirectFinalSourceImage[];
  copyLanguage: DirectFinalCopyLanguage;
  slot?: DirectFinalMainImageSlot;
  moduleCode?: DirectFinalDetailModuleCode;
}): string {
  return [
    '请基于下面输入生成 direct-final 单张成图脚本。',
    `目标执行语言：${input.copyLanguage}`,
    input.slot
      ? `当前主图 slot：${input.slot} / ${getMainSlotGoal(input.slot)}`
      : `当前详情模块：${input.moduleCode ?? 'M1'} / ${getDetailModuleGoal(input.moduleCode ?? 'M1')}`,
    `风险等级：${input.risk.riskLevel}`,
    `风险信号：${input.risk.signals.join(' / ') || '无'}`,
    `参考图摘要：${buildSourceImageFileSummary(input.sourceImages)}`,
    ...buildSourceImageRoleLines(input.sourceImages),
    ...buildSourceImageCompositionNotes(input.sourceImages),
    `commercial brief：${JSON.stringify(
      {
        productType: input.brief.productType,
        brandName: input.brief.brandName,
        companyName: input.brief.companyName,
        skuList: input.brief.skuList,
        priceInfo: input.brief.priceInfo,
        copyDraft: input.brief.copyDraft,
        targetAudienceNotes: input.brief.targetAudienceNotes,
        competitiveRefs: input.brief.competitiveRefs,
        marketNotes: input.brief.marketNotes,
        missingFields: input.brief.missingFields,
      },
      null,
      2,
    )}`,
    `已确认卖点卡：${JSON.stringify(
      input.cards.map((card) => ({
        sellingReasonId: card.sellingReasonId,
        targetAudience: card.targetAudience,
        painPoint: card.painPoint,
        solution: card.solution,
        benefitTranslation: card.benefitTranslation,
        trustEvidence: card.trustEvidence,
        priority: card.priority,
        scenePreference: card.scenePreference,
        applicableModules: card.applicableModules,
      })),
      null,
      2,
    )}`,
    '要求：',
    '1. 先识别包装图、内容物图、场景图各自的角色，再抽取可见品牌、包装主文案、规格、认证和标签文字。',
    '2. textBlocks 文字优先级固定为：源图真实可见的包装/品牌/规格表达 > brief.copyDraft > 已确认卖点卡。',
    '3. 画面和文案必须服务同一商品身份，不能写和源图无关的标题、参数或信任表达。',
    '4. 如果参考图同时有包装图和内容物图，要让包装图负责品牌与包装文案锚点，内容物图负责主体形态、材质和结构细节。',
    '5. 当源图已有可用短语时，优先做精简改写，不要另起一套脱离源图的标题。',
    input.copyLanguage === 'ru-RU'
      ? '6. 当前是俄文执行分支，所以中文编辑稿必须更短、更紧，避免后续翻译成俄语后在图里塞不下。'
      : '6. 当前是中文执行分支，中文编辑稿可以直接服务最终成图。',
    '7. visualContent 和 designNotes 要能直接指导 GPT Image 生成最终成图。',
    '8. negativeConstraints 要覆盖 logo、包装、认证、结构、材质和文字复杂度限制。',
    '9. 如果风险等级高，要主动降低文字复杂度和版式复杂度。',
  ].join('\n');
}

export function buildDirectFinalExecutionPrompt(input: {
  brief: Pick<CommercialBrief, 'brandName' | 'companyName' | 'productType'>;
  asset: DirectFinalAsset;
  copyLanguage: DirectFinalCopyLanguage;
  aspectRatio: string;
}): string {
  const textBlockLines = input.asset.textBlocks
    .map((block) => `- ${block.role}: ${block.content} (max ${block.maxLines} lines)`)
    .join('\n');
  const layoutLines = input.asset.layoutHints
    .map(
      (hint) =>
        `- anchor=${hint.anchor}, align=${hint.align}, relation=${hint.relation ?? 'none'}, reservedSpace=${hint.reservedSpace ?? 'none'}`,
    )
    .join('\n');
  const layerLines = input.asset.layerPlan
    .map((layer) => `- ${layer.role}: ${layer.description}`)
    .join('\n');
  const assetLabel =
    input.asset.assetKind === 'detail-module'
      ? `detail module ${input.asset.detailModuleCode ?? 'unknown'}`
      : `hero image ${input.asset.mainImageSlot ?? 'unknown'}`;
  const copyLanguageLabel = input.copyLanguage === 'ru-RU' ? 'Russian' : 'Chinese';

  return [
    `Create a finished ${copyLanguageLabel} e-commerce ${assetLabel}, not a clean background plate.`,
    `Output aspect ratio: ${input.aspectRatio}.`,
    `Primary goal: ${input.asset.goal}.`,
    `Brand context: ${input.brief.brandName || 'keep the existing product brand'} / ${input.brief.companyName || 'preserve package manufacturer text'}.`,
    `Product type: ${input.brief.productType}.`,
    `Visual direction: ${input.asset.visualContent}.`,
    `Design notes: ${input.asset.designNotes}.`,
    'Preserve the original product shape, logo, package text, certification marks, materials, and structural details from the reference image.',
    'Do not stretch, squeeze, widen, flatten, elongate, warp, or perspective-distort the product to fill the canvas.',
    ...buildLayoutProfile(input.asset, input.aspectRatio),
    `Render the following ${copyLanguageLabel} text inside the image as real readable text, with concise finished-layout quality:`,
    textBlockLines,
    'Layout instructions:',
    layoutLines,
    'Layer plan:',
    layerLines,
    `Readable copy summary: ${input.asset.inImageCopy}.`,
    `Compliance notes: ${input.asset.complianceNotes}.`,
    'Never convert the product into a different package or remove small but important package details.',
    'Negative constraints:',
    ...input.asset.negativeConstraints.map((line) => `- ${line}`),
  ].join('\n');
}

export function buildReviewInstructions(copyLanguage: DirectFinalCopyLanguage): string {
  return [
    '你是电商最终成图复盘助手。',
    '你会同时看到源图和一张 direct-final 最终成图，还会拿到这张图对应的成图脚本。',
    '请重点判断：图内文字是不是真的被正确渲染、是否好读、是否和这张图的目标一致、合规提醒有没有被保住、成品感够不够、商品保真有没有丢。',
    '商品保真必须覆盖：包装主文案、品牌 logo、认证或资质标识、商品轮廓、材质和关键结构细节。',
    '如果输出是详情模块，不要按主图 CTR 标准打，按详情页信息表达、可读性和说服力来评。',
    copyLanguage === 'ru-RU'
      ? '本次执行语言是俄语，要按俄语真实成图的可读性、断行和落字密度打分。'
      : '本次执行语言是中文，要按中文真实成图的可读性、断行和落字密度打分。',
    '只输出中文，不要 markdown，不要解释，不要输出 schema 以外字段。',
    'aiSummary 要能直接指导下一轮修改，不要写空话。',
    'issues 要写具体问题，不要泛泛而谈。',
  ].join('\n');
}

export function buildReviewInputText(input: {
  brief: CommercialBrief;
  asset: DirectFinalAsset;
  sourceImages: DirectFinalSourceImage[];
  copyLanguage: DirectFinalCopyLanguage;
  risk: DirectFinalRiskSummary;
}): string {
  const assetLabel =
    input.asset.assetKind === 'detail-module'
      ? `详情模块 ${input.asset.detailModuleCode ?? '未知'}`
      : `主图 ${input.asset.mainImageSlot ?? '未知'}`;
  return [
    '请对这张 direct-final 最终成图做复盘。',
    `前 ${input.sourceImages.length} 张图是源图，最后 1 张图是当前输出。`,
    `资产类型：${assetLabel}`,
    `资产目标：${input.asset.goal}`,
    `执行语言：${input.copyLanguage === 'ru-RU' ? '俄语' : '中文'}`,
    `风险等级：${input.risk.riskLevel}`,
    `风险信号：${input.risk.signals.join(' / ') || '无'}`,
    `源图摘要：${buildSourceImageFileSummary(input.sourceImages)}`,
    ...buildSourceImageCompositionNotes(input.sourceImages),
    `商业输入 productType：${input.brief.productType}`,
    `商业输入品牌：${input.brief.brandName || '未填'}`,
    `成图画面说明：${input.asset.visualContent}`,
    `图内文案摘要：${input.asset.inImageCopy}`,
    `textBlocks：${JSON.stringify(input.asset.textBlocks, null, 2)}`,
    `layoutHints：${JSON.stringify(input.asset.layoutHints, null, 2)}`,
    `layerPlan：${JSON.stringify(input.asset.layerPlan, null, 2)}`,
    `designNotes：${input.asset.designNotes}`,
    `complianceNotes：${input.asset.complianceNotes}`,
    `negativeConstraints：${JSON.stringify(input.asset.negativeConstraints, null, 2)}`,
    '打分标准：',
    '1. 图内文字渲染：文字有没有真的出现，信息有没有漏。',
    '2. 文案可读性：字号、对比、排布、断行和密度是否可读。',
    '3. 目标对齐：画面和文案是否真在服务这张资产的目标。',
    '4. 合规保留：限制条件、声明和敏感边界是否保住。',
    '5. 成品感：是否像可直接上架的电商成品，而不是临时拼的概念图。',
    '6. 商品保真：包装、logo、认证、材质、结构和关键细节是否被保住。',
  ].join('\n');
}

export function getMainSlotGoal(slot: DirectFinalMainImageSlot): string {
  return DIRECT_FINAL_MAIN_IMAGE_SLOTS.find((item) => item.slot === slot)?.goal ?? '主图';
}

export function getDetailModuleGoal(code: DirectFinalDetailModuleCode): string {
  return DIRECT_FINAL_DETAIL_MODULES.find((item) => item.code === code)?.goal ?? '详情模块';
}

function buildLayoutProfile(asset: DirectFinalAsset, aspectRatio: string): string[] {
  if (asset.assetKind === 'detail-module' && aspectRatio === '3:4') {
    return [
      '3:4 vertical-detail layout requirement: use the full portrait frame with top / middle / bottom information hierarchy.',
      '3:4 vertical-detail layout requirement: avoid placing a centered 1:1 square card inside the 3:4 canvas.',
      '3:4 vertical-detail layout requirement: fill vertical space with background extension, vertical scene depth, modular copy areas, detail close-ups, props, or section dividers.',
      '3:4 vertical-detail layout requirement: keep the product natural aspect ratio; use padding, cropping, background extension, or supporting elements instead of product deformation.',
      'No-stretch product fidelity: do not stretch, squeeze, widen, flatten, elongate, or warp the source product.',
    ];
  }
  if (asset.assetKind === 'detail-module') {
    return [
      'Detail module layout requirement: organize the image like an e-commerce detail-page module, not a generic hero image.',
      'Product fidelity: keep the source product natural proportions; never deform it to fill the frame.',
    ];
  }
  return [
    'Hero image layout requirement: preserve the product natural proportions and keep the composition suited to the selected output aspect ratio.',
  ];
}
