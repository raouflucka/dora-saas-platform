import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ictSupplyChainApi, type SupplyChainEntry } from '../api/ictSupplyChain';
import { contractualArrangementsApi } from '../api/contractualArrangements';
import { ictProvidersApi } from '../api/ictProviders';
import { referenceApi } from '../api/reference';
import { useToast } from '../components/ToastProvider';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useAuthStore } from '../store/authStore';
import {
  GitBranch, Plus, Trash2, ChevronRight, AlertCircle,
  Loader2, RefreshCw, Info, X,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    2: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    3: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  };
  const cls = colors[rank] ?? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${cls}`}>
      Tier {rank}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Add Entry Form
// ─────────────────────────────────────────────────────────────

function AddEntryForm({
  contracts, providers, serviceTypes, existingEntries,
  onClose,
}: {
  contracts: any[];
  providers: any[];
  serviceTypes: any[];
  existingEntries: SupplyChainEntry[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [contractId, setContractId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [parentChainId, setParentChainId] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [supplyRank, setSupplyRank] = useState('1');

  // Entries that belong to the selected contract — for "hired by" selection
  const parentOptions = existingEntries.filter(e => e.contractId === contractId);

  const createMutation = useMutation({
    mutationFn: () => ictSupplyChainApi.create({
      contractId,
      providerId,
      parentChainId: parentChainId || undefined,
      serviceTypeId: serviceTypeId ? Number(serviceTypeId) : undefined,
      supplyRank: supplyRank ? Number(supplyRank) : 1,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-chain-all'] });
      qc.invalidateQueries({ queryKey: ['supply-chain-hierarchy'] });
      qc.invalidateQueries({ queryKey: ['supplyChainTree'] });
      toast.success('Supply chain entry added.');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add entry.'),
  });

  const canSubmit = !!contractId && !!providerId;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-zinc-200">Add Supply Chain Entry</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300 flex gap-2 items-start">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          A supply chain entry records a subcontractor (Tier 2+) or direct provider (Tier 1) underneath a contract.
          "Hired by" links this entry to its parent in the chain (who engaged this subcontractor).
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-400">Contract *</label>
          <select
            value={contractId}
            onChange={e => { setContractId(e.target.value); setParentChainId(''); }}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select contract...</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.contractReference}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-400">Subcontractor / Provider *</label>
          <select
            value={providerId}
            onChange={e => setProviderId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select provider...</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.legalName || p.providerCode}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-400">
            Hired By (Parent in Chain)
            <span className="text-zinc-600 font-normal ml-1">— leave empty if direct contractor</span>
          </label>
          <select
            value={parentChainId}
            onChange={e => setParentChainId(e.target.value)}
            disabled={!contractId}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40"
          >
            <option value="">— Direct (hired by contract holder) —</option>
            {parentOptions.map(e => (
              <option key={e.id} value={e.id}>
                {e.provider?.legalName || e.provider?.providerCode} (Tier {e.supplyRank})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-400">ICT Service Type</label>
          <select
            value={serviceTypeId}
            onChange={e => setServiceTypeId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select type (optional)...</option>
            {serviceTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-400">
            Tier / Supply Rank
            <span className="text-zinc-600 font-normal ml-1">— 1=Direct, 2=Subcontractor, 3+=Nth-party</span>
          </label>
          <select
            value={supplyRank}
            onChange={e => setSupplyRank(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="1">Tier 1 — Direct Provider</option>
            <option value="2">Tier 2 — Subcontractor</option>
            <option value="3">Tier 3 — Nth-party</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
        <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!canSubmit || createMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Entry
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export default function IctSupplyChain() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'ANALYST';

  const [selectedContractId, setSelectedContractId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contractual-arrangements'],
    queryFn: contractualArrangementsApi.getAll,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['ict-providers'],
    queryFn: ictProvidersApi.getAll,
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ['reference-ict-service-types'],
    queryFn: referenceApi.getIctServiceTypes,
  });

  const { data: allEntries = [], isLoading: loadingEntries, refetch } = useQuery({
    queryKey: ['supply-chain-all'],
    queryFn: () => ictSupplyChainApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ictSupplyChainApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-chain-all'] });
      qc.invalidateQueries({ queryKey: ['supply-chain-hierarchy'] });
      qc.invalidateQueries({ queryKey: ['supplyChainTree'] });
      toast.success('Supply chain entry removed.');
      setConfirmDelete(null);
    },
    onError: () => toast.error('Failed to remove entry.'),
  });

  // Filter by selected contract
  const displayed = selectedContractId
    ? allEntries.filter(e => e.contractId === selectedContractId)
    : allEntries;

  // Group by contract for display
  const byContract: Record<string, SupplyChainEntry[]> = {};
  displayed.forEach(e => {
    const key = e.contractId;
    if (!byContract[key]) byContract[key] = [];
    byContract[key].push(e);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-blue-400" />
            ICT Supply Chain
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Multi-level subcontractor mapping — DORA Art. 28§3 / EBA RT.07
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {showAddForm ? 'Close Form' : 'Add Entry'}
            </button>
          )}
        </div>
      </div>

      {/* Context banner */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3 items-start">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-indigo-400">What is this?</p>
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
            Under DORA, you must map the full chain of providers behind each contract — not just the primary vendor,
            but also their subcontractors (Tier 2, 3…). Each entry here records <strong className="text-zinc-200">who provides what</strong> and
            <strong className="text-zinc-200"> who hired them</strong>. Only Admins can create or remove entries.
          </p>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && isAdmin && (
        <AddEntryForm
          contracts={contracts}
          providers={providers}
          serviceTypes={serviceTypes}
          existingEntries={allEntries}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Filter */}
      <div className="flex items-center gap-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
        <label className="text-sm text-zinc-400 shrink-0">Filter by contract:</label>
        <select
          value={selectedContractId}
          onChange={(e) => setSelectedContractId(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 max-w-sm"
        >
          <option value="">All contracts</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>{c.contractReference}</option>
          ))}
        </select>
        <span className="text-xs text-zinc-500 ml-auto">{displayed.length} entr{displayed.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {/* Loading */}
      {(loadingContracts || loadingEntries) && (
        <div className="flex items-center gap-2 text-zinc-500 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading supply chain data…</span>
        </div>
      )}

      {/* Empty state */}
      {!loadingContracts && !loadingEntries && displayed.length === 0 && (
        <div className="text-center py-16 text-zinc-500 border border-dashed border-zinc-700 rounded-xl">
          <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm">No supply chain entries yet.</p>
          {isAdmin
            ? <p className="text-xs mt-1">Click "Add Entry" above to map your first subcontractor.</p>
            : <p className="text-xs mt-1">Contact your Admin to add supply chain data.</p>
          }
        </div>
      )}

      {/* Data grouped by contract */}
      <div className="space-y-4">
        {Object.entries(byContract).map(([cId, entries]) => {
          const contract = contracts.find(c => c.id === cId);
          return (
            <div key={cId} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Contract header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <GitBranch className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-zinc-200">
                  {contract?.contractReference ?? cId}
                </span>
                <span className="text-xs text-zinc-500 ml-auto">
                  {entries.length} provider{entries.length !== 1 ? 's' : ''} in chain
                </span>
              </div>

              {/* Entries table */}
              <div className="divide-y divide-zinc-800/50">
                {entries
                  .slice()
                  .sort((a, b) => a.supplyRank - b.supplyRank)
                  .map(entry => (
                    <div
                      key={entry.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-zinc-900/30 transition-colors group"
                      style={{ paddingLeft: `${(entry.supplyRank - 1) * 24 + 16}px` }}
                    >
                      {/* Provider */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {entry.supplyRank > 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">
                            {entry.provider?.legalName || entry.provider?.providerCode}
                          </p>
                          {entry.parentLink && (
                            <p className="text-xs text-zinc-500 mt-0.5">
                              hired by{' '}
                              <span className="text-zinc-400">
                                {entry.parentLink.provider?.legalName || entry.parentLink.provider?.providerCode}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.serviceType && (
                          <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                            {entry.serviceType.name}
                          </span>
                        )}
                        <RankBadge rank={entry.supplyRank} />
                        {entry.supplyRank >= 2 && (
                          <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Nth-Party Risk
                          </span>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmDelete({
                              id: entry.id,
                              label: entry.provider?.legalName || entry.provider?.providerCode || 'this entry',
                            })}
                            className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            title="Remove entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmModal
          title="Remove Supply Chain Entry"
          message={
            <span>
              Remove <strong className="text-zinc-200">"{confirmDelete.label}"</strong> from the supply chain?
              This updates the DORA Register of Information (EBA RT.07).
            </span>
          }
          confirmLabel="Remove Entry"
          danger
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
