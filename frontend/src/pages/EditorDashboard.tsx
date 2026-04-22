import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { validationApi, type ValidationResult } from '../api/validation';
import { dashboardApi } from '../api/dashboard';
import {
  ShieldCheck, FileSearch, CheckCircle2, Flag,
  ExternalLink, Check, ArrowRight, ClipboardCheck, Info
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// ── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cfg: Record<string, { cls: string; label: string }> = {
    FLAGGED:          { cls: 'bg-red-500/15 text-red-400 border-red-500/30',       label: 'ACTION REQUIRED' },
    WAITING_APPROVAL: { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'AWAITING ANALYST' },
    FIXED:            { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'FIX SUBMITTED' },
    RESOLVED:         { cls: 'bg-zinc-700 text-zinc-400 border-zinc-600',          label: 'RESOLVED' },
  };
  const { cls, label } = cfg[status] ?? { cls: 'bg-zinc-700 text-zinc-400', label: status };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

// ── Fix Workflow Note Modal ────────────────────────────────────────────────────
function FixSubmitModal({
  item, onClose, onSubmit,
}: {
  item: ValidationResult;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-teal-400" /> Submit Fix for Analyst Approval
        </h2>
        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-400 space-y-1">
          <p><span className="text-zinc-500">Field:</span> <span className="text-zinc-200 font-mono">{item.fieldName}</span></p>
          <p><span className="text-zinc-500">Issue:</span> {item.message}</p>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Resolution note (optional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Describe what you changed and why..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500 resize-none"
          />
        </div>
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-2 text-xs text-amber-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          Status will change to <strong>WAITING ANALYST APPROVAL</strong>. The Analyst must approve before the issue is marked resolved.
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
          <button
            onClick={() => onSubmit(note)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> Submit Fix
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Editor Dashboard ──────────────────────────────────────────────────────
export default function EditorDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fixingItem, setFixingItem] = useState<ValidationResult | null>(null);


  const { data: runs } = useQuery({ queryKey: ['validationRuns'], queryFn: validationApi.getRunHistory });
  const latestRun = runs?.[0];

  const { data: latestRunDetails } = useQuery({
    queryKey: ['validation-run', latestRun?.id],
    queryFn: () => validationApi.getRunById(latestRun!.id),
    enabled: !!latestRun?.id,
  });

  const allResults = (latestRunDetails?.results as ValidationResult[] | undefined) ?? [];
  // Editor only sees FLAGGED or WAITING_APPROVAL items
  const myItems = allResults.filter(r =>
    r.status === 'FLAGGED' || r.status === 'WAITING_APPROVAL'
  );

  const resolveMutation = useMutation({
    mutationFn: ({ ruleId, recordId, note }: { ruleId: string; recordId: string; note: string }) =>
      validationApi.resolveIssue(latestRun!.id, ruleId, recordId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-run', latestRun?.id] });
      setFixingItem(null);
    }
  });

  const handleSubmitFix = (note: string) => {
    if (!fixingItem || !latestRun) return;
    resolveMutation.mutate({
      ruleId: fixingItem.ruleId,
      recordId: fixingItem.recordId || '',
      note
    });
  };

  const flaggedCount   = myItems.filter(r => r.status === 'FLAGGED').length;
  const pendingCount   = myItems.filter(r => r.status === 'WAITING_APPROVAL').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" /> Editor Workspace
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Data entry and flagged issue resolution — {user?.tenantId || 'DORA tenant'}.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={() => document.getElementById('issues-to-fix-panel')?.scrollIntoView({ behavior: 'smooth' })}
          className={`text-left bg-zinc-900 border rounded-xl p-5 transition-all hover:scale-[1.02] cursor-pointer ${flaggedCount > 0 ? 'border-red-500/30 hover:border-red-500/50' : 'border-zinc-800 hover:border-zinc-700'}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/10 rounded-lg"><Flag className="w-5 h-5 text-red-400" /></div>
            <span className="text-xs font-medium text-zinc-400">Issues to Fix</span>
          </div>
          <p className={`text-3xl font-bold ${flaggedCount > 0 ? 'text-red-400' : 'text-zinc-100'}`}>{flaggedCount}</p>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">Flagged by Analyst — action required <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" /></p>
        </button>
        <button 
          onClick={() => document.getElementById('waiting-approval-panel')?.scrollIntoView({ behavior: 'smooth' })}
          className={`text-left bg-zinc-900 border rounded-xl p-5 transition-all hover:scale-[1.02] cursor-pointer ${pendingCount > 0 ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-zinc-800 hover:border-zinc-700'}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 rounded-lg"><ClipboardCheck className="w-5 h-5 text-amber-400" /></div>
            <span className="text-xs font-medium text-zinc-400">Awaiting Approval</span>
          </div>
          <p className={`text-3xl font-bold ${pendingCount > 0 ? 'text-amber-400' : 'text-zinc-100'}`}>{pendingCount}</p>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">Fix submitted — Analyst reviewing <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" /></p>
        </button>
      </div>

      {/* Quick Links — only pages Editor is allowed to use */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-purple-400" /> Your Workspaces
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { to: '/providers',    label: 'ICT Providers',       sub: 'DORA Art. 28§1' },
            { to: '/contracts',    label: 'Contracts',           sub: 'DORA Art. 28§2' },
            { to: '/ict-services', label: 'ICT Services',        sub: 'DORA Art. 28§4' },
          ].map(({ to, label, sub }) => (
            <Link key={to} to={to} className="flex flex-col gap-0.5 p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-purple-500/40 transition-colors group">
              <span className="text-xs font-medium text-zinc-200 group-hover:text-white">{label}</span>
              <span className="text-[10px] text-zinc-600">{sub}</span>
            </Link>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 mt-3 flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          You can view validation results but cannot run the validation engine. Contact your Analyst to trigger a new validation.
        </p>
      </div>

      {/* Flagged Issues Panels Segregated */}
      
      {/* 1. Issues to Fix Panel */}
      <div id="issues-to-fix-panel" className="bg-zinc-900 border border-purple-500/20 rounded-xl overflow-hidden scroll-mt-20">
        <div className="flex items-center justify-between px-5 py-3 bg-purple-500/5 border-b border-purple-500/15">
          <h2 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
            <Flag className="w-4 h-4" />
            Issues to Fix
          </h2>
          <span className="text-xs text-zinc-500">Action Required</span>
        </div>
        {myItems.filter(i => i.status === 'FLAGGED').length > 0 ? (
          <div className="divide-y divide-zinc-800/50 max-h-[400px] overflow-y-auto">
            {myItems.filter(i => i.status === 'FLAGGED').map((item, idx) => (
              <div key={idx} className="px-5 py-4 transition-colors hover:bg-zinc-800/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <StatusBadge status={item.status} />
                      {item.entityName && <span className="text-xs font-medium text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">{item.entityName}</span>}
                      <span className="text-xs text-zinc-500 font-mono">{item.fieldName}</span>
                      {item.templateName && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{item.templateName}</span>}
                    </div>
                    <p className="text-sm text-zinc-200">{item.message}</p>
                    {item.invalidValue && (
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="text-zinc-500">Current value:</span>
                        <span className="font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">{item.invalidValue}</span>
                      </div>
                    )}
                    {item.flagComment && (
                      <div className="mt-2 flex items-start gap-2 bg-purple-500/10 border border-purple-500/20 rounded px-2.5 py-1.5">
                        <Flag className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-purple-400 tracking-wide">Analyst says:</p>
                          <p className="text-xs text-purple-200">{item.flagComment}</p>
                        </div>
                      </div>
                    )}
                    {item.suggestedAction && <p className="text-xs text-teal-400 flex items-center gap-1 mt-2 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20">✦ {item.suggestedAction}</p>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 items-end min-w-[110px]">
                    {item.frontendRoute && (
                      <button
                        onClick={() => {
                          const base = item.frontendRoute!;
                          const sep = base.includes('?') ? '&' : '?';
                          navigate(`${base}${sep}runId=${encodeURIComponent(latestRun!.id)}&ruleId=${encodeURIComponent(item.ruleId)}&recordId=${encodeURIComponent(item.recordId || '')}`);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded bg-teal-600/20 text-teal-400 border border-teal-500/30 hover:bg-teal-600 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Go to Record
                      </button>
                    )}
                    <button onClick={() => setFixingItem(item)} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600 hover:text-white transition-colors">
                      <Check className="w-3 h-3" /> Mark as Fixed
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-sm font-medium text-emerald-400">No errors or issues to fix.</p>
          </div>
        )}
      </div>

      {/* 2. Awaiting Approval Panel */}
      <div id="waiting-approval-panel" className="bg-zinc-900 border border-amber-500/20 rounded-xl overflow-hidden scroll-mt-20">
        <div className="flex items-center justify-between px-5 py-3 bg-amber-500/5 border-b border-amber-500/15">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Waiting on Approval
          </h2>
          <span className="text-xs text-zinc-500">Under Review</span>
        </div>
        {myItems.filter(i => i.status === 'WAITING_APPROVAL').length > 0 ? (
          <div className="divide-y divide-zinc-800/50 max-h-[400px] overflow-y-auto">
            {myItems.filter(i => i.status === 'WAITING_APPROVAL').map((item, idx) => (
              <div key={idx} className="px-5 py-4 transition-colors hover:bg-zinc-800/20 opacity-70">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <StatusBadge status={item.status} />
                      {item.entityName && <span className="text-xs font-medium text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">{item.entityName}</span>}
                      <span className="text-xs text-zinc-500 font-mono">{item.fieldName}</span>
                    </div>
                    <p className="text-sm text-zinc-200">{item.message}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 items-end min-w-[110px]">
                    <div className="w-full text-center text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
                      Awaiting analyst review
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 flex items-center gap-3">
            <Info className="w-5 h-5 text-zinc-500 shrink-0" />
            <p className="text-sm font-medium text-zinc-400">No items waiting on approval.</p>
          </div>
        )}
      </div>



      {/* Fix Submit Modal */}
      {fixingItem && latestRun && (
        <FixSubmitModal
          item={fixingItem}
          onClose={() => setFixingItem(null)}
          onSubmit={handleSubmitFix}
        />
      )}

    </div>
  );
}
