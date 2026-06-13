import { describe, expect, it } from 'vitest';
import type { AppEdge } from '@/types/edge';
import type { AppNode, NodeId } from '@/types/node';
import { appendReferences, resolveUpstream } from '../useUpstream';

const id = (s: string) => s as NodeId;

function inputImage(idStr: string, content: string): AppNode {
  return {
    id: id(idStr),
    kind: 'input-image',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    settings: { content },
  };
}

function textNode(idStr: string, text: string): AppNode {
  return {
    id: id(idStr),
    kind: 'text-node',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    settings: { text },
  };
}

function genImage(idStr: string, content: string | null = null): AppNode {
  return {
    id: id(idStr),
    kind: 'gen-image',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    content,
    settings: { prompt: '', model: 'nano-banana' },
  };
}

function directFinalUpload(idStr: string, content: string): AppNode {
  return {
    id: id(idStr),
    kind: 'direct-final-upload',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    settings: { content, filename: '包装.png' },
  };
}

function directFinalRender(idStr: string, content: string | null = null): AppNode {
  return {
    id: id(idStr),
    kind: 'direct-final-render',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    content,
    settings: { model: 'nano-banana', copyLanguage: 'zh-CN' },
  };
}

function audioInput(idStr: string, content: string): AppNode {
  return {
    id: id(idStr),
    kind: 'audio-input',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    settings: { content, filename: 'ref.mp3', mimeType: 'audio/mpeg' },
  };
}

function edge(from: string, to: string): AppEdge {
  return { id: `${from}->${to}`, from: id(from), to: id(to) };
}

describe('resolveUpstream', () => {
  it('input-image → referenceImages', () => {
    const nodes = [inputImage('a', 'data:img1'), genImage('b')];
    const edges = [edge('a', 'b')];
    expect(resolveUpstream(id('b'), nodes, edges)).toEqual({
      referenceImages: ['data:img1'],
      prompt: '',
      mask: null,
      videoFrames: [],
      videoUrl: null,
      audioUrls: [],
      shots: [],
    });
  });

  it('text-node → prompt（多个 text 取最后一个）', () => {
    const nodes = [textNode('t1', 'first'), textNode('t2', 'second'), genImage('g')];
    const edges = [edge('t1', 'g'), edge('t2', 'g')];
    expect(resolveUpstream(id('g'), nodes, edges).prompt).toBe('second');
  });

  it('gen-image.content → 作为下游 referenceImages', () => {
    const nodes = [genImage('a', 'data:result'), genImage('b')];
    const edges = [edge('a', 'b')];
    expect(resolveUpstream(id('b'), nodes, edges).referenceImages).toEqual(['data:result']);
  });

  it('direct-final-upload → referenceImages', () => {
    const nodes = [directFinalUpload('u', 'data:source'), directFinalRender('r')];
    expect(resolveUpstream(id('r'), nodes, [edge('u', 'r')]).referenceImages).toEqual([
      'data:source',
    ]);
  });

  it('direct-final-render.content → 作为下游 referenceImages', () => {
    const nodes = [directFinalRender('a', 'data:direct-result'), genImage('b')];
    expect(resolveUpstream(id('b'), nodes, [edge('a', 'b')]).referenceImages).toEqual([
      'data:direct-result',
    ]);
  });

  it('5 张参考图上限：超出截断', () => {
    const upstreams = Array.from({ length: 7 }, (_, i) => inputImage(`u${i}`, `data:${i}`));
    const target = genImage('g');
    const edges = upstreams.map((u) => edge(u.id, 'g'));
    const r = resolveUpstream(id('g'), [...upstreams, target], edges);
    expect(r.referenceImages).toHaveLength(5);
    expect(r.referenceImages).toEqual(['data:0', 'data:1', 'data:2', 'data:3', 'data:4']);
  });

  it('input-image.settings.maskContent → upstream.mask', () => {
    const a = inputImage('a', 'data:img');
    (a as { settings: { maskContent?: string } }).settings.maskContent = 'data:mask-png';
    const nodes = [a, genImage('g')];
    const edges = [edge('a', 'g')];
    expect(resolveUpstream(id('g'), nodes, edges).mask).toBe('data:mask-png');
  });

  it('未连接上游 → 空', () => {
    expect(resolveUpstream(id('lone'), [genImage('lone')], [])).toEqual({
      referenceImages: [],
      prompt: '',
      mask: null,
      videoFrames: [],
      videoUrl: null,
      audioUrls: [],
      shots: [],
    });
  });

  it('video-input.selectedKeyframes → videoFrames + videoUrl + 第一帧 refs', () => {
    const v = {
      id: id('v'),
      kind: 'video-input' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      settings: {
        content: 'blob:vid',
        selectedKeyframes: [
          { time: 1, url: 'data:f1' },
          { time: 2, url: 'data:f2' },
        ],
      },
    };
    const r = resolveUpstream(id('a'), [v, genImage('a')], [edge('v', 'a')]);
    expect(r.videoFrames).toHaveLength(2);
    expect(r.videoUrl).toBe('blob:vid');
    expect(r.referenceImages).toEqual(['data:f1']);
  });

  it('video-analyze.analysisResult → 下游 prompt', () => {
    const va = {
      id: id('va'),
      kind: 'video-analyze' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      settings: { model: 'gpt-4o', analysisResult: 'a girl is dancing' },
    };
    const r = resolveUpstream(id('g'), [va, genImage('g')], [edge('va', 'g')]);
    expect(r.prompt).toBe('a girl is dancing');
  });

  it('audio-input → audioUrls', () => {
    const nodes = [audioInput('aud', 'data:audio'), genImage('g')];
    const edges = [edge('aud', 'g')];
    expect(resolveUpstream(id('g'), nodes, edges).audioUrls).toEqual(['data:audio']);
  });
});

describe('appendReferences', () => {
  it('未满 5 张时直接 push', () => {
    expect(appendReferences(['a', 'b'], ['c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('满 5 张后新添的把最早的挤出', () => {
    expect(appendReferences(['a', 'b', 'c', 'd', 'e'], ['f'])).toEqual([
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
  });

  it('一次添加多张超过上限', () => {
    expect(appendReferences(['a', 'b', 'c', 'd', 'e'], ['f', 'g', 'h'])).toEqual([
      'd',
      'e',
      'f',
      'g',
      'h',
    ]);
  });
});
