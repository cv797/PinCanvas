import { describe, expect, it } from 'vitest';
import type { AppEdge } from '@/types/edge';
import type { AppNode, NodeId } from '@/types/node';
import { collectDirectFinalSourceImages, inferSourceImageRole } from '../sourceImages';

const id = (value: string) => value as NodeId;

function upload(value: string, filename: string, roleName?: string): AppNode {
  return {
    id: id(value),
    kind: 'direct-final-upload',
    x: 0,
    y: 0,
    width: 120,
    height: 120,
    settings: {
      content: `data:${value}`,
      filename,
      roleName,
      width: 800,
      height: 800,
    },
  };
}

function analysis(value: string): AppNode {
  return {
    id: id(value),
    kind: 'direct-final-analysis',
    x: 0,
    y: 0,
    width: 300,
    height: 320,
    settings: { model: 'gpt-4o', copyLanguage: 'zh-CN' },
  };
}

function edge(from: string, to: string): AppEdge {
  return { id: `${from}->${to}`, from: id(from), to: id(to) };
}

describe('direct-final source images', () => {
  it('infers package, contents, detail, and general roles from names', () => {
    expect(inferSourceImageRole('brand-package-front.png')).toBe('package');
    expect(inferSourceImageRole('产品内容物.jpg')).toBe('contents');
    expect(inferSourceImageRole('macro-detail.webp')).toBe('detail');
    expect(inferSourceImageRole('hero.png')).toBe('general');
  });

  it('collects upstream images and keeps at most three', () => {
    const nodes = [
      upload('u1', '包装.png'),
      upload('u2', 'contents.png'),
      upload('u3', 'detail.png'),
      upload('u4', 'extra.png'),
      analysis('a'),
    ];
    const result = collectDirectFinalSourceImages(id('a'), nodes, [
      edge('u1', 'a'),
      edge('u2', 'a'),
      edge('u3', 'a'),
      edge('u4', 'a'),
    ]);
    expect(result.map((image) => image.nodeId)).toEqual([id('u1'), id('u2'), id('u3')]);
    expect(result.map((image) => image.role)).toEqual(['package', 'contents', 'detail']);
  });

  it('uses custom role labels while still normalizing role type', () => {
    const [image] = collectDirectFinalSourceImages(id('a'), [upload('u', 'plain.png', '包装正面'), analysis('a')], [
      edge('u', 'a'),
    ]);
    expect(image.role).toBe('package');
    expect(image.roleLabel).toBe('包装正面');
  });
});
