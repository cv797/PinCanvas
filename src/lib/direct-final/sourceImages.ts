import type { AppEdge } from '@/types/edge';
import type { AppNode, NodeId } from '@/types/node';
import type {
  DirectFinalSourceImage,
  DirectFinalSourceImageRole,
} from '@/types/direct-final';

export const MAX_DIRECT_FINAL_SOURCE_IMAGES = 3;

const PACKAGE_ROLE_KEYWORDS = ['box', 'carton', 'package', 'packaging', 'pack', '包装', '盒', '外盒'];
const CONTENTS_ROLE_KEYWORDS = [
  'content',
  'contents',
  'inside',
  'inner',
  'item',
  'product',
  'bottle',
  'jar',
  'capsule',
  'pod',
  'tube',
  '内容物',
  '内件',
  '瓶身',
  '实物',
  '产品',
];
const DETAIL_ROLE_KEYWORDS = [
  'detail',
  'macro',
  'closeup',
  'close-up',
  'texture',
  'label',
  '细节',
  '特写',
  '局部',
];

export function inferSourceImageRole(filename: string): DirectFinalSourceImageRole {
  const normalized = filename.trim().toLowerCase();
  if (PACKAGE_ROLE_KEYWORDS.some((keyword) => normalized.includes(keyword))) return 'package';
  if (CONTENTS_ROLE_KEYWORDS.some((keyword) => normalized.includes(keyword))) return 'contents';
  if (DETAIL_ROLE_KEYWORDS.some((keyword) => normalized.includes(keyword))) return 'detail';
  return 'general';
}

export function getSourceImageRoleLabel(role: DirectFinalSourceImageRole): string {
  switch (role) {
    case 'package':
      return '包装图';
    case 'contents':
      return '内容物图';
    case 'detail':
      return '细节图';
    default:
      return '主体参考图';
  }
}

export function getSourceImageRoleShortLabel(role: DirectFinalSourceImageRole): string {
  switch (role) {
    case 'package':
      return '包装';
    case 'contents':
      return '内容物';
    case 'detail':
      return '细节';
    default:
      return '主体';
  }
}

export function collectDirectFinalSourceImages(
  nodeId: NodeId,
  nodes: AppNode[],
  edges: AppEdge[],
): DirectFinalSourceImage[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map<string, AppEdge[]>();
  for (const edge of edges) {
    const list = incomingByTarget.get(edge.to) ?? [];
    list.push(edge);
    incomingByTarget.set(edge.to, list);
  }

  const visited = new Set<string>();
  const images: DirectFinalSourceImage[] = [];

  function visit(id: NodeId): void {
    if (visited.has(id)) return;
    visited.add(id);
    const incoming = incomingByTarget.get(id) ?? [];
    for (const edge of incoming) {
      const source = nodeMap.get(edge.from);
      if (!source) continue;
      const image = imageFromNode(source);
      if (image && !images.some((item) => item.nodeId === image.nodeId)) {
        images.push(image);
      }
      visit(source.id);
    }
  }

  visit(nodeId);
  return images.slice(0, MAX_DIRECT_FINAL_SOURCE_IMAGES);
}

export function buildSourceImageFileSummary(sourceImages: DirectFinalSourceImage[]): string {
  return sourceImages
    .map(
      (image, index) =>
        `图${index + 1}：${image.filename}（${image.roleLabel}，${image.width ?? '?'}x${image.height ?? '?'}）`,
    )
    .join('；');
}

export function buildSourceImageCompositionNotes(sourceImages: DirectFinalSourceImage[]): string[] {
  if (sourceImages.length === 0) return [];
  if (sourceImages.length === 1) {
    const image = sourceImages[0];
    return [`当前只有 1 张参考图，按${image.roleLabel}理解即可。`];
  }

  const hasPackage = sourceImages.some((image) => image.role === 'package');
  const hasContents = sourceImages.some((image) => image.role === 'contents');
  const notes = [`当前共有 ${sourceImages.length} 张参考图，后续分析和出图都要组合使用。`];
  if (hasPackage && hasContents) {
    notes.push('包装图负责品牌识别、包装结构和外部主视觉。');
    notes.push('内容物图负责真实主体形态、材质细节和展开关系。');
    notes.push('后续画面要同时保留包装和内容物之间的对应关系。');
    return notes;
  }
  notes.push('多张参考图要综合主体形态、材质、配色和摆放关系，不要只保留其中一张。');
  return notes;
}

export function buildSourceImageRoleLines(sourceImages: DirectFinalSourceImage[]): string[] {
  return sourceImages.map(
    (image, index) =>
      `图${index + 1}：文件名 ${image.filename}，尺寸 ${image.width ?? '?'}x${image.height ?? '?'}，角色 ${image.roleLabel}。`,
  );
}

export function sourceImageSignature(sourceImages: DirectFinalSourceImage[]): string {
  return JSON.stringify(sourceImages.map((image) => image.imageId));
}

function imageFromNode(node: AppNode): DirectFinalSourceImage | null {
  if (node.kind === 'direct-final-upload') {
    if (!node.settings.content) return null;
    return normalizeImage({
      nodeId: node.id,
      imageId: node.id,
      filename: node.settings.filename ?? 'direct-final-source.png',
      roleName: node.settings.roleName,
      width: node.settings.width,
      height: node.settings.height,
      url: node.settings.content,
    });
  }
  if (node.kind === 'input-image') {
    if (!node.settings.content) return null;
    return normalizeImage({
      nodeId: node.id,
      imageId: node.id,
      filename: node.settings.filename ?? 'source-image.png',
      width: node.settings.width,
      height: node.settings.height,
      url: node.settings.content,
    });
  }
  return null;
}

function normalizeImage(input: {
  nodeId: NodeId;
  imageId: string;
  filename: string;
  roleName?: string | null;
  width?: number;
  height?: number;
  url: string;
}): DirectFinalSourceImage {
  const customRoleName = input.roleName?.trim() || null;
  const role = customRoleName
    ? inferSourceImageRole(customRoleName)
    : inferSourceImageRole(input.filename);
  const roleLabel = customRoleName || getSourceImageRoleLabel(role);
  return {
    imageId: input.imageId,
    nodeId: input.nodeId,
    filename: input.filename,
    roleName: customRoleName,
    role,
    roleLabel,
    shortRoleLabel: customRoleName || getSourceImageRoleShortLabel(role),
    width: input.width,
    height: input.height,
    url: input.url,
  };
}
