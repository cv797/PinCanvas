import type {
  CommercialBrief,
  DirectFinalAsset,
  DirectFinalCopyLanguage,
  DirectFinalDetailModuleCode,
  DirectFinalMainImageSlot,
  DirectFinalReview,
  DirectFinalRiskSummary,
  SellingReasonCard,
} from './direct-final';

export type NodeKind =
  | 'input-image'
  | 'audio-input'
  | 'preview'
  | 'image-compare'
  | 'text-node'
  | 'gen-image'
  | 'video-input'
  | 'gen-video'
  | 'video-analyze'
  | 'pending-node-picker'
  | 'create-character'
  | 'create-scene'
  | 'generate-character-image'
  | 'generate-scene-image'
  | 'extract-characters-scenes'
  | 'storyboard-node'
  | 'script-to-storyboard'
  | 'storyboard-viewer'
  | 'chat'
  | 'generate-character-video'
  | 'generate-scene-video'
  | 'character-card'
  | 'direct-final-upload'
  | 'direct-final-analysis'
  | 'direct-final-gate'
  | 'direct-final-main-prompt'
  | 'direct-final-detail-prompt'
  | 'direct-final-render'
  | 'direct-final-review';

export type NodeId = string & { readonly __brand: 'NodeId' };
export type VideoGenerationMode = 'first-last-frame' | 'omni-reference';

export interface NodeBase {
  id: NodeId;
  kind: NodeKind;
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string | null;
  lastSaved?: number;
  /** Midjourney 4 张切图（左上 / 右上 / 左下 / 右下） */
  mjImages?: string[];
  mjOriginalUrl?: string;
  mjNeedsSplit?: boolean;
  /** 当前节点最近一次图片生成的全部候选结果。 */
  generatedImages?: string[];
}

export interface InputImageNode extends NodeBase {
  kind: 'input-image';
  settings: {
    content: string;
    filename?: string;
    width?: number;
    height?: number;
    /** Inpainting 蒙版（白色 = 要编辑的区域；dataURL PNG） */
    maskContent?: string | null;
  };
}

export interface DirectFinalUploadNode extends NodeBase {
  kind: 'direct-final-upload';
  settings: {
    content: string;
    filename?: string;
    width?: number;
    height?: number;
    roleName?: string | null;
  };
}

export interface AudioInputNode extends NodeBase {
  kind: 'audio-input';
  settings: {
    content?: string;
    filename?: string;
    mimeType?: string;
  };
}

export interface PreviewNode extends NodeBase {
  kind: 'preview';
  settings: {
    previewType?: 'image' | 'video';
    content?: string;
  };
}

export interface ImageCompareNode extends NodeBase {
  kind: 'image-compare';
  settings: {
    images: string[];
  };
}

export interface TextNodeNode extends NodeBase {
  kind: 'text-node';
  settings: { text: string };
}

export interface GenImageNode extends NodeBase {
  kind: 'gen-image';
  settings: {
    prompt: string;
    promptHtml?: string;
    model: string;
    ratio?: string;
    resolution?: string;
    width?: number | '';
    height?: number | '';
    quality?: string;
    /** 一次生成 N 张图片。 */
    count?: number;
    referenceImages?: string[];
    isGenerating?: boolean;
    progress?: number;
    error?: string | null;
  };
}

export interface VideoInputNode extends NodeBase {
  kind: 'video-input';
  settings: {
    content?: string;
    videoFileName?: string;
    videoMeta?: { duration?: number; width?: number; height?: number };
    frames?: Array<{ time: number; url: string }>;
    selectedKeyframes?: Array<{ time: number; url: string }>;
  };
}

export interface GenVideoNode extends NodeBase {
  kind: 'gen-video';
  settings: {
    videoPrompt: string;
    videoPromptHtml?: string;
    model: string;
    videoMode?: VideoGenerationMode;
    duration?: string | number;
    ratio?: string;
    resolution?: string;
    referenceImages?: string[];
    isGenerating?: boolean;
    progress?: number;
    error?: string | null;
  };
}

export interface VideoAnalyzeNode extends NodeBase {
  kind: 'video-analyze';
  settings: {
    model: string;
    isAnalyzing?: boolean;
    progress?: number;
    error?: string | null;
    analysisResult?: string;
    /** 自定义分析指令；空则用默认"按时间顺序描述视频内容" */
    instruction?: string;
    startSecond?: number;
    endSecond?: number;
  };
}

export interface PendingNodePickerNode extends NodeBase {
  kind: 'pending-node-picker';
  settings: Record<string, never>;
}

export interface CreateCharacterNode extends NodeBase {
  kind: 'create-character';
  settings: {
    characterId?: string;
    name: string;
    description: string;
    prompt?: string;
  };
}

export interface CreateSceneNode extends NodeBase {
  kind: 'create-scene';
  settings: {
    sceneId?: string;
    name: string;
    description: string;
    prompt?: string;
  };
}

export interface GenerateCharacterImageNode extends NodeBase {
  kind: 'generate-character-image';
  settings: {
    characterId?: string;
    model: string;
    ratio?: string;
    resolution?: string;
    prompt?: string;
    error?: string | null;
  };
}

export interface GenerateSceneImageNode extends NodeBase {
  kind: 'generate-scene-image';
  settings: {
    sceneId?: string;
    model: string;
    ratio?: string;
    resolution?: string;
    prompt?: string;
    error?: string | null;
  };
}

export interface ExtractCharactersScenesNode extends NodeBase {
  kind: 'extract-characters-scenes';
  settings: {
    sourceText?: string;
    model: string;
    error?: string | null;
    characters?: Array<{ name: string; description: string }>;
    scenes?: Array<{ name: string; description: string }>;
  };
}

export interface Shot {
  id: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number | string;

  // 首尾帧支持
  startFrameUrl?: string;      // 首帧图片
  endFrameUrl?: string;        // 尾帧图片
  startFramePrompt?: string;   // 首帧提示词
  endFramePrompt?: string;     // 尾帧提示词
  action?: string;             // 动作描述(首帧到尾帧的变化)
  scene?: string;              // 场景描述

  imageUrl?: string;           // 兼容旧版(可作为首帧)
  videoUrl?: string;
  status?: 'idle' | 'generating' | 'generating-start' | 'generating-end' | 'done' | 'failed';
  errorMsg?: string;
}

export interface GenerateCharacterVideoNode extends NodeBase {
  kind: 'generate-character-video';
  settings: {
    characterId?: string;
    model: string;
    duration?: string | number;
    ratio?: string;
    resolution?: string;
    videoPrompt?: string;
    error?: string | null;
  };
}

export interface GenerateSceneVideoNode extends NodeBase {
  kind: 'generate-scene-video';
  settings: {
    sceneId?: string;
    model: string;
    duration?: string | number;
    ratio?: string;
    resolution?: string;
    videoPrompt?: string;
    error?: string | null;
  };
}

export interface StoryboardNodeT extends NodeBase {
  kind: 'storyboard-node';
  settings: {
    imageModel: string;
    videoModel: string;
    shots: Shot[];
  };
}

export type ExpressionType =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'neutral'
  | 'excited'
  | 'worried'
  | 'shy';

export interface CharacterCardNode extends NodeBase {
  kind: 'character-card';
  settings: {
    /** 输入模式：文字描述或图片上传 */
    inputMode?: 'text' | 'image';
    /** 角色文字描述 */
    textDescription?: string;
    /** 参考图片 */
    referenceImage?: string;
    /** 视图类型：三视图或四视图 */
    viewType: 'three' | 'four';
    /** 要生成的表情列表 */
    expressions: ExpressionType[];
    /** 布局模板 */
    layout: 'classic' | 'compact';
    /** 单个图片尺寸 */
    imageSize: number;
    /** 图片间距 */
    spacing: number;
    /** 是否添加文字标注 */
    addLabels: boolean;
    /** 生成模型 */
    model: string;
    /** 生成状态 */
    isGenerating?: boolean;
    progress?: number;
    error?: string | null;
    /** 生成的多视图图片 */
    multiViewImage?: string;
    /** 生成的表情图片 */
    expressionImages?: Record<ExpressionType, string>;
    /** 最终合成的角色卡图片 */
    finalCardImage?: string;
  };
}

export interface ScriptToStoryboardNode extends NodeBase {
  kind: 'script-to-storyboard';
  settings: {
    // 输入
    scriptText: string;              // 用户输入的剧本
    llmModel: string;                // 用于生成分镜的 LLM 模型
    imageModel: string;              // 用于生成图片的模型

    // 生成配置
    shotCount?: number;              // 期望生成的分镜数量
    aspectRatio?: string;            // 统一画幅比例
    generateEndFrame: boolean;       // 是否生成尾帧

    // 输出
    shots: Shot[];                   // 生成的分镜列表

    // 状态
    isGenerating?: boolean;
    progress?: number;
    error?: string | null;
  };
}

export interface StoryboardViewerNode extends NodeBase {
  kind: 'storyboard-viewer';
  settings: {
    shots: Shot[];  // 从上游接收的分镜数据
  };
}

export interface ChatNode extends NodeBase {
  kind: 'chat';
  settings: {
    model: string;                   // LLM 模型
    userMessage: string;             // 用户输入
    systemPrompt?: string;           // 系统提示词
    response?: string;               // AI 响应
    isGenerating?: boolean;
    error?: string | null;
  };
}

export interface DirectFinalAnalysisNode extends NodeBase {
  kind: 'direct-final-analysis';
  settings: {
    model: string;
    copyLanguage: DirectFinalCopyLanguage;
    brief?: CommercialBrief;
    risk?: DirectFinalRiskSummary;
    action?: 'brief' | 'gates';
    gateCount?: number;
    isGenerating?: boolean;
    error?: string | null;
  };
}

export interface DirectFinalGateNode extends NodeBase {
  kind: 'direct-final-gate';
  settings: {
    card?: SellingReasonCard;
    mainPromptCount?: number;
    detailModules?: DirectFinalDetailModuleCode[];
    isGenerating?: boolean;
    error?: string | null;
  };
}

export interface DirectFinalMainPromptNode extends NodeBase {
  kind: 'direct-final-main-prompt';
  settings: {
    model: string;
    copyLanguage: DirectFinalCopyLanguage;
    slot: DirectFinalMainImageSlot;
    asset?: DirectFinalAsset;
    isGenerating?: boolean;
    error?: string | null;
  };
}

export interface DirectFinalDetailPromptNode extends NodeBase {
  kind: 'direct-final-detail-prompt';
  settings: {
    model: string;
    copyLanguage: DirectFinalCopyLanguage;
    moduleCode: DirectFinalDetailModuleCode;
    asset?: DirectFinalAsset;
    isGenerating?: boolean;
    error?: string | null;
  };
}

export interface DirectFinalRenderNode extends NodeBase {
  kind: 'direct-final-render';
  settings: {
    model: string;
    copyLanguage: DirectFinalCopyLanguage;
    ratio?: string;
    resolution?: string;
    width?: number | '';
    height?: number | '';
    quality?: string;
    count?: number;
    prompt?: string;
    isGenerating?: boolean;
    error?: string | null;
  };
}

export interface DirectFinalReviewNode extends NodeBase {
  kind: 'direct-final-review';
  settings: {
    model: string;
    copyLanguage: DirectFinalCopyLanguage;
    review?: DirectFinalReview;
    isGenerating?: boolean;
    error?: string | null;
  };
}

export type AppNode =
  | InputImageNode
  | DirectFinalUploadNode
  | AudioInputNode
  | PreviewNode
  | ImageCompareNode
  | TextNodeNode
  | GenImageNode
  | VideoInputNode
  | GenVideoNode
  | VideoAnalyzeNode
  | PendingNodePickerNode
  | CreateCharacterNode
  | CreateSceneNode
  | GenerateCharacterImageNode
  | GenerateSceneImageNode
  | ExtractCharactersScenesNode
  | StoryboardNodeT
  | ScriptToStoryboardNode
  | StoryboardViewerNode
  | ChatNode
  | GenerateCharacterVideoNode
  | GenerateSceneVideoNode
  | CharacterCardNode
  | DirectFinalAnalysisNode
  | DirectFinalGateNode
  | DirectFinalMainPromptNode
  | DirectFinalDetailPromptNode
  | DirectFinalRenderNode
  | DirectFinalReviewNode;

export type SettingsOf<K extends NodeKind> = Extract<AppNode, { kind: K }>['settings'];
