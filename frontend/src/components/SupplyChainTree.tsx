import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Network, Server, Loader2, AlertTriangle, ChevronRight, ChevronDown, Info } from 'lucide-react';
import { ictSupplyChainApi } from '../api/ictSupplyChain';

interface SupplyChainNode {
  id: string;
  providerId: string;
  providerName: string;
  serviceTypeName: string;
  supplyRank: number;
  contractCount?: number;
  subcontractors: SupplyChainNode[];
}

function riskColor(node: SupplyChainNode): { card: string; dot: string; badge: string } {
  const isHigh = (node.contractCount ?? 0) > 2 || node.supplyRank >= 3;
  const isWarn = (node.contractCount ?? 0) > 1 || node.supplyRank === 2;
  if (isHigh) return { card: 'border-red-500/40 bg-red-500/5', dot: 'bg-red-500', badge: 'text-red-400 bg-red-500/10 border-red-500/20' };
  if (isWarn) return { card: 'border-amber-500/40 bg-amber-500/5', dot: 'bg-amber-400', badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  return { card: 'border-zinc-700 bg-zinc-900', dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
}

function TreeNode({ node, isRoot = false, depth = 0 }: {
  node: SupplyChainNode;
  isRoot?: boolean;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const colors = riskColor(node);
  const hasChildren = node.subcontractors?.length > 0;

  return (
    <div className={`flex flex-col relative ${!isRoot ? 'ml-8 mt-3' : ''}`}>
      {/* Connector lines */}
      {!isRoot && (
        <>
          <div className="absolute -left-6 top-6 w-6 h-px bg-zinc-700" />
          <div className="absolute -left-6 -top-3 w-px h-9 bg-zinc-700" />
        </>
      )}

      {/* Node card */}
      <div className={`border rounded-lg p-3 w-64 shrink-0 z-10 shadow-sm transition-all duration-200 hover:shadow-md ${colors.card}`}>
        <div className="flex items-start gap-2.5 mb-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ring-2 ring-zinc-900 ${colors.dot}`} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-zinc-200 truncate" title={node.providerName}>
              {node.providerName}
            </h4>
            <p className="text-xs text-zinc-500">
              {node.supplyRank === 0 ? 'Primary Provider (Contract)' : `Tier ${node.supplyRank} Subcontractor`}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colors.badge}`}>
            {node.serviceTypeName}
          </span>
          {hasChildren && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Network className="w-3 h-3" />
              {node.subcontractors.length}
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>
        {node.contractCount && node.contractCount > 1 && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400">
            <AlertTriangle className="w-2.5 h-2.5" /> {node.contractCount} contracts — concentration risk
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="flex flex-col relative">
          {node.subcontractors.map((sub, idx) => (
            <div key={sub.id} className="relative">
              {idx < node.subcontractors.length - 1 && (
                <div className="absolute left-2 top-0 w-px h-full bg-zinc-700 -z-10" />
              )}
              <TreeNode node={sub} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function fetchSupplyChainTree(contractId: string): Promise<SupplyChainNode | null> {
  try {
    return await ictSupplyChainApi.getTree(contractId);
  } catch {
    return null;
  }
}

/** Single source-of-truth component used by BOTH Analyst and Editor views.
 *  Always fetches from real DB — no mock/demo data. */
export default function SupplyChainTree({ contractId }: {
  contractId?: string;
}) {
  const { data: tree, isLoading } = useQuery({
    queryKey: ['supplyChainTree', contractId],
    queryFn: () => contractId ? fetchSupplyChainTree(contractId) : Promise.resolve(null),
    enabled: !!contractId,
  });

  return (
    <div className="p-6 bg-zinc-950 rounded-xl border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            ICT Supply Chain Hierarchy
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5 mb-3">DORA Art. 28§3 — N-tier subcontractor concentration view</p>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-200 flex items-start gap-2 max-w-2xl">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p>
              <strong>Why manually map this?</strong> The system cannot automatically calculate downstream subcontractors.
              Under DORA, you must trace and record the full hierarchical supply chain for critical contracts,
              specifying exactly which entity relies on whom, to ensure EBA Template RT.07 compliance.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Low risk</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Moderate</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> High risk</span>
        </div>
      </div>

      {!contractId ? (
        <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
          <Server className="w-8 h-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">Select a contract to view its supply chain.</p>
          <p className="text-xs text-zinc-600">The supply chain hierarchy will appear here once a contract is selected.</p>
        </div>
      ) : isLoading ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : !tree ? (
        <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
          <Server className="w-8 h-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">No supply chain data for this contract.</p>
          <p className="text-xs text-zinc-600">Add ICT supply chain entries for this contract to visualise the hierarchy.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-max py-2 pl-2">
            <TreeNode node={tree} isRoot />
          </div>
        </div>
      )}
    </div>
  );
}
