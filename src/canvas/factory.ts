import { DEFAULT_IMAGE_MODEL } from '@/api/upstream';
import { nodeId } from '@/utils/id';
import type { AppNode, NodeKind } from '@/types/node';

const DEFAULT_VIDEO_MODEL = 'wan2.6-r2v-flash';
const DEFAULT_CHAT_MODEL = 'gpt-4o';
const DEFAULT_STORYBOARD_LLM = 'MiniMax-M2.5';

interface Pos {
  x: number;
  y: number;
}

const DEFAULTS: Record<NodeKind, { width: number; height: number }> = {
  'input-image': { width: 280, height: 220 },
  'audio-input': { width: 300, height: 170 },
  preview: { width: 280, height: 220 },
  'image-compare': { width: 420, height: 360 },
  'text-node': { width: 280, height: 180 },
  'gen-image': { width: 420, height: 420 },
  'video-input': { width: 300, height: 260 },
  'gen-video': { width: 420, height: 360 },
  'video-analyze': { width: 360, height: 360 },
  'pending-node-picker': { width: 260, height: 180 },
  'create-character': { width: 320, height: 300 },
  'create-scene': { width: 320, height: 300 },
  'generate-character-image': { width: 360, height: 380 },
  'generate-scene-image': { width: 360, height: 380 },
  'extract-characters-scenes': { width: 420, height: 420 },
  'storyboard-node': { width: 480, height: 480 },
  'script-to-storyboard': { width: 400, height: 600 },
  'storyboard-viewer': { width: 500, height: 600 },
  chat: { width: 380, height: 480 },
  'generate-character-video': { width: 360, height: 400 },
  'generate-scene-video': { width: 360, height: 400 },
  'character-card': { width: 420, height: 520 },
  'direct-final-upload': { width: 300, height: 260 },
  'direct-final-analysis': { width: 380, height: 520 },
  'direct-final-gate': { width: 340, height: 420 },
  'direct-final-main-prompt': { width: 390, height: 520 },
  'direct-final-detail-prompt': { width: 390, height: 540 },
  'direct-final-render': { width: 420, height: 420 },
  'direct-final-review': { width: 380, height: 440 },
};

export function createNode(kind: NodeKind, pos: Pos): AppNode {
  const { width, height } = DEFAULTS[kind];
  const id = nodeId();
  const base = { id, x: pos.x, y: pos.y, width, height } as const;

  switch (kind) {
    case 'input-image':
      return { ...base, kind, settings: { content: '' } };
    case 'audio-input':
      return { ...base, kind, settings: {} };
    case 'preview':
      return { ...base, kind, settings: { previewType: 'image' } };
    case 'image-compare':
      return { ...base, kind, settings: { images: [] } };
    case 'text-node':
      return { ...base, kind, settings: { text: '' } };
    case 'gen-image':
      return {
        ...base,
        kind,
        settings: {
          prompt: '',
          model: DEFAULT_IMAGE_MODEL,
          ratio: '1:1',
          resolution: '1024x1024',
          width: 1024,
          height: 1024,
          count: 1,
          referenceImages: [],
        },
      };
    case 'video-input':
      return { ...base, kind, settings: { selectedKeyframes: [] } };
    case 'gen-video':
      return {
        ...base,
        kind,
        settings: {
          videoPrompt: '',
          model: DEFAULT_VIDEO_MODEL,
          videoMode: 'omni-reference',
          duration: '5s',
          ratio: '16:9',
          resolution: '720p',
        },
      };
    case 'video-analyze':
      return {
        ...base,
        kind,
        settings: { model: DEFAULT_CHAT_MODEL, instruction: '' },
      };
    case 'pending-node-picker':
      return { ...base, kind, settings: {} };
    case 'create-character':
      return { ...base, kind, settings: { name: '', description: '' } };
    case 'create-scene':
      return { ...base, kind, settings: { name: '', description: '' } };
    case 'generate-character-image':
      return {
        ...base,
        kind,
        settings: { model: DEFAULT_IMAGE_MODEL, ratio: '1:1', resolution: '1024x1024' },
      };
    case 'generate-scene-image':
      return {
        ...base,
        kind,
        settings: { model: DEFAULT_IMAGE_MODEL, ratio: '16:9', resolution: '1024x1024' },
      };
    case 'extract-characters-scenes':
      return { ...base, kind, settings: { model: DEFAULT_CHAT_MODEL, sourceText: '' } };
    case 'storyboard-node':
      return {
        ...base,
        kind,
        settings: { imageModel: DEFAULT_IMAGE_MODEL, videoModel: DEFAULT_VIDEO_MODEL, shots: [] },
      };
    case 'script-to-storyboard':
      return {
        ...base,
        kind,
        settings: {
          scriptText: '',
          llmModel: DEFAULT_STORYBOARD_LLM,
          imageModel: DEFAULT_IMAGE_MODEL,
          shotCount: 6,
          aspectRatio: '16:9',
          generateEndFrame: true,
          shots: [],
        },
      };
    case 'storyboard-viewer':
      return {
        ...base,
        kind,
        settings: {
          shots: [],
        },
      };
    case 'chat':
      return {
        ...base,
        kind,
        settings: {
          model: DEFAULT_CHAT_MODEL,
          userMessage: '',
          systemPrompt: '',
        },
      };
    case 'generate-character-video':
      return {
        ...base,
        kind,
        settings: {
          model: DEFAULT_VIDEO_MODEL,
          duration: '5s',
          ratio: '16:9',
          resolution: '720p',
        },
      };
    case 'generate-scene-video':
      return {
        ...base,
        kind,
        settings: {
          model: DEFAULT_VIDEO_MODEL,
          duration: '5s',
          ratio: '16:9',
          resolution: '720p',
        },
      };
    case 'character-card':
      return {
        ...base,
        kind,
        settings: {
          textDescription: '',
          viewType: 'three',
          expressions: ['happy', 'sad', 'angry', 'surprised', 'neutral', 'excited'],
          layout: 'classic',
          imageSize: 768,
          spacing: 20,
          addLabels: true,
          model: DEFAULT_IMAGE_MODEL,
        },
      };
    case 'direct-final-upload':
      return { ...base, kind, settings: { content: '', roleName: null } };
    case 'direct-final-analysis':
      return {
        ...base,
        kind,
        settings: {
          model: DEFAULT_CHAT_MODEL,
          copyLanguage: 'zh-CN',
          action: 'brief',
          gateCount: 5,
        },
      };
    case 'direct-final-gate':
      return {
        ...base,
        kind,
        settings: {
          mainPromptCount: 2,
        },
      };
    case 'direct-final-main-prompt':
      return {
        ...base,
        kind,
        settings: { model: DEFAULT_CHAT_MODEL, copyLanguage: 'zh-CN', slot: 1 },
      };
    case 'direct-final-detail-prompt':
      return {
        ...base,
        kind,
        settings: { model: DEFAULT_CHAT_MODEL, copyLanguage: 'zh-CN', moduleCode: 'M1' },
      };
    case 'direct-final-render':
      return {
        ...base,
        kind,
        settings: {
          model: DEFAULT_IMAGE_MODEL,
          copyLanguage: 'zh-CN',
          ratio: '1:1',
          resolution: '1024x1024',
          width: 1024,
          height: 1024,
          quality: 'auto',
          count: 1,
        },
      };
    case 'direct-final-review':
      return {
        ...base,
        kind,
        settings: { model: DEFAULT_CHAT_MODEL, copyLanguage: 'zh-CN' },
      };
  }
}

export function createInputImageFromDataURL(content: string, filename: string, pos: Pos): AppNode {
  const { width, height } = DEFAULTS['input-image'];
  return {
    id: nodeId(),
    kind: 'input-image',
    x: pos.x,
    y: pos.y,
    width,
    height,
    settings: { content, filename },
  };
}

export function createImageCompareNode(images: string[], pos: Pos): AppNode {
  const { width, height } = DEFAULTS['image-compare'];
  return {
    id: nodeId(),
    kind: 'image-compare',
    x: pos.x,
    y: pos.y,
    width,
    height,
    settings: { images },
  };
}

export function createVideoPreviewNode(content: string, pos: Pos): AppNode {
  const { width, height } = DEFAULTS.preview;
  return {
    id: nodeId(),
    kind: 'preview',
    x: pos.x,
    y: pos.y,
    width,
    height,
    settings: { previewType: 'video', content },
  };
}
