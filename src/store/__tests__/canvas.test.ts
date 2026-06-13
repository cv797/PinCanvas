import { afterEach, describe, expect, it } from 'vitest';
import type { AppNode, NodeId } from '@/types/node';
import { useCanvas } from '../canvas';

const id = (value: string) => value as NodeId;

function node(value: string): AppNode {
  return {
    id: id(value),
    kind: 'text-node',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    settings: { text: '' },
  };
}

describe('canvas store', () => {
  afterEach(() => {
    useCanvas.getState().clear();
  });

  it('dedupes identical edges', () => {
    const state = useCanvas.getState();
    state.addNode(node('a'));
    state.addNode(node('b'));

    state.addEdge({ id: 'edge-1', from: id('a'), to: id('b') });
    state.addEdge({ id: 'edge-2', from: id('a'), to: id('b') });

    expect(useCanvas.getState().edges).toEqual([{ id: 'edge-1', from: id('a'), to: id('b') }]);
  });

  it('keeps distinct target edges', () => {
    const state = useCanvas.getState();
    state.addEdge({ id: 'edge-1', from: id('a'), to: id('b') });
    state.addEdge({ id: 'edge-2', from: id('a'), to: id('c') });

    expect(useCanvas.getState().edges).toHaveLength(2);
  });

  it('removes connected edges when deleting a node', () => {
    const state = useCanvas.getState();
    state.addNode(node('a'));
    state.addNode(node('b'));
    state.addNode(node('c'));
    state.addEdge({ id: 'edge-1', from: id('a'), to: id('b') });
    state.addEdge({ id: 'edge-2', from: id('b'), to: id('c') });

    state.removeNode(id('b'));

    expect(useCanvas.getState().edges).toEqual([]);
  });
});
