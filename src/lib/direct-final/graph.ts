import type { AppEdge } from '@/types/edge';
import type {
  AppNode,
  DirectFinalAnalysisNode,
  DirectFinalDetailPromptNode,
  DirectFinalGateNode,
  DirectFinalMainPromptNode,
  DirectFinalRenderNode,
  NodeId,
} from '@/types/node';
import type {
  CommercialBrief,
  DirectFinalAsset,
  DirectFinalRiskSummary,
  DirectFinalSourceImage,
  SellingReasonCard,
} from '@/types/direct-final';
import { collectDirectFinalSourceImages } from './sourceImages';
import { buildRiskSummary } from './validation';

export interface DirectFinalGraphContext {
  sourceImages: DirectFinalSourceImage[];
  sourceNodeIds: NodeId[];
  analysisNode?: DirectFinalAnalysisNode;
  brief?: CommercialBrief;
  risk: DirectFinalRiskSummary;
  gateNodes: DirectFinalGateNode[];
  cards: SellingReasonCard[];
  promptNode?: DirectFinalMainPromptNode | DirectFinalDetailPromptNode;
  asset?: DirectFinalAsset;
  renderNode?: DirectFinalRenderNode;
}

export function collectDirectFinalGraphContext(
  nodeId: NodeId,
  nodes: AppNode[],
  edges: AppEdge[],
): DirectFinalGraphContext {
  const ancestors = collectAncestors(nodeId, nodes, edges);
  const related = [...ancestors, nodes.find((node) => node.id === nodeId)].filter(
    (node): node is AppNode => Boolean(node),
  );
  const sourceImages = collectDirectFinalSourceImages(nodeId, nodes, edges);
  const analysisNode = [...related]
    .reverse()
    .find((node): node is DirectFinalAnalysisNode => node.kind === 'direct-final-analysis');
  const gateNodes = related.filter(
    (node): node is DirectFinalGateNode => node.kind === 'direct-final-gate',
  );
  const promptNode = [...related]
    .reverse()
    .find(
      (node): node is DirectFinalMainPromptNode | DirectFinalDetailPromptNode =>
        node.kind === 'direct-final-main-prompt' || node.kind === 'direct-final-detail-prompt',
    );
  const renderNode = [...related]
    .reverse()
    .find((node): node is DirectFinalRenderNode => node.kind === 'direct-final-render');
  const cards = gateNodes.map((node) => node.settings.card).filter((card): card is SellingReasonCard => Boolean(card));
  const brief = analysisNode?.settings.brief;
  return {
    sourceImages,
    sourceNodeIds: sourceImages.map((image) => image.nodeId),
    analysisNode,
    brief,
    risk: analysisNode?.settings.risk ?? buildRiskSummary(brief, sourceImages),
    gateNodes,
    cards,
    promptNode,
    asset: promptNode?.settings.asset,
    renderNode,
  };
}

export function findDirectFinalSourceNodeIds(
  nodeId: NodeId,
  nodes: AppNode[],
  edges: AppEdge[],
): NodeId[] {
  return collectDirectFinalSourceImages(nodeId, nodes, edges).map((image) => image.nodeId);
}

function collectAncestors(nodeId: NodeId, nodes: AppNode[], edges: AppEdge[]): AppNode[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map<string, AppEdge[]>();
  for (const edge of edges) {
    const incoming = incomingByTarget.get(edge.to) ?? [];
    incoming.push(edge);
    incomingByTarget.set(edge.to, incoming);
  }
  const seen = new Set<string>();
  const result: AppNode[] = [];

  function visit(id: NodeId): void {
    for (const edge of incomingByTarget.get(id) ?? []) {
      if (seen.has(edge.from)) continue;
      seen.add(edge.from);
      const node = nodeMap.get(edge.from);
      if (!node) continue;
      visit(node.id);
      result.push(node);
    }
  }

  visit(nodeId);
  return result;
}
