import { useMemo } from 'react';
import { useCanvas } from '@/store/canvas';
import type { AppEdge } from '@/types/edge';
import type { AppNode, NodeId, Shot } from '@/types/node';

export interface Upstream {
  /** 按入边顺序聚合，最多 5 张 */
  referenceImages: string[];
  /** 上游 text-node / video-analyze 提供的 prompt（多源时取最后一个） */
  prompt: string;
  mask: string | null;
  /** 上游 video-input 的关键帧（供 video-analyze 用） */
  videoFrames: Array<{ time: number; url: string }>;
  /** 上游 video-input.content（原始视频 url） */
  videoUrl: string | null;
  /** 上游 audio-input.content（原始音频 url） */
  audioUrls: string[];
  /** 上游 script-to-storyboard 提供的分镜数据 */
  shots: Shot[];
}

/**
 * 上游反查（docs/architecture.md §6）。纯函数，可单测。
 *
 * 端口语义：
 * - input-image / preview / image-compare / gen-image.content → referenceImages
 * - text-node → prompt
 * - 顺序：edges 顺序 + 同节点单值
 * - 上限：5 张参考图，超出截断
 */
export function resolveUpstream(
  nodeId: NodeId,
  nodes: AppNode[],
  edges: AppEdge[],
): Upstream {
  const incoming = edges.filter((e) => e.to === nodeId);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const refs: string[] = [];
  let prompt = '';
  let mask: string | null = null;
  const videoFrames: Array<{ time: number; url: string }> = [];
  let videoUrl: string | null = null;
  const audioUrls: string[] = [];
  let shots: Shot[] = [];

  for (const e of incoming) {
    const up = nodeMap.get(e.from);
    if (!up) continue;
    if (e.referenceImageUrls?.length) {
      refs.push(...e.referenceImageUrls);
      continue;
    }
    switch (up.kind) {
      case 'input-image':
        if (up.settings.content) refs.push(up.settings.content);
        if (up.settings.maskContent) mask = up.settings.maskContent;
        break;
      case 'direct-final-upload':
        if (up.settings.content) refs.push(up.settings.content);
        break;
      case 'preview':
        if (up.settings.content) refs.push(up.settings.content);
        else if (up.content) refs.push(up.content);
        break;
      case 'image-compare':
        refs.push(...up.settings.images);
        break;
      case 'gen-image':
        if (up.content) refs.push(up.content);
        break;
      case 'direct-final-render':
        if (up.content) refs.push(up.content);
        break;
      case 'gen-video':
        if (up.content) refs.push(up.content);
        break;
      case 'video-input': {
        const frames = up.settings.selectedKeyframes ?? up.settings.frames ?? [];
        videoFrames.push(...frames);
        if (up.settings.content) videoUrl = up.settings.content;
        if (frames[0]?.url) refs.push(frames[0].url);
        break;
      }
      case 'audio-input':
        if (up.settings.content) audioUrls.push(up.settings.content);
        break;
      case 'video-analyze':
        if (up.settings.analysisResult) prompt = up.settings.analysisResult;
        break;
      case 'text-node':
        if (up.settings.text) prompt = up.settings.text;
        break;
      case 'script-to-storyboard':
        if (up.settings.shots?.length) shots = up.settings.shots;
        break;
    }
  }

  return {
    referenceImages: refs.slice(0, 5),
    prompt,
    mask,
    videoFrames,
    videoUrl,
    audioUrls,
    shots,
  };
}

export function useUpstream(nodeId: NodeId): Upstream {
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  return useMemo(() => resolveUpstream(nodeId, nodes, edges), [nodeId, nodes, edges]);
}

/**
 * 添加参考图时的「满 5 替换第 1（最早的一张）」规则。
 * 实际行为：FIFO 队列，最多 5 张。
 */
export function appendReferences(existing: string[], add: string[]): string[] {
  const out = [...existing];
  for (const url of add) {
    if (out.length < 5) out.push(url);
    else {
      out.shift();
      out.push(url);
    }
  }
  return out;
}
