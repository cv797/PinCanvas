import type { NodeKind } from '@/types/node';

export const FEATURE_DISABLED_MESSAGE = '正在火速编码，即将上线';

const ENABLED_NODE_KINDS = new Set<NodeKind>([
  'input-image',
  'audio-input',
  'preview',
  'image-compare',
  'text-node',
  'gen-image',
  'gen-video',
  'pending-node-picker',
  'character-card',
  'script-to-storyboard',
  'storyboard-viewer',
  'chat',
  'direct-final-upload',
  'direct-final-analysis',
  'direct-final-gate',
  'direct-final-main-prompt',
  'direct-final-detail-prompt',
  'direct-final-render',
  'direct-final-review',
]);

export function isNodeFeatureEnabled(kind: NodeKind): boolean {
  return ENABLED_NODE_KINDS.has(kind);
}
