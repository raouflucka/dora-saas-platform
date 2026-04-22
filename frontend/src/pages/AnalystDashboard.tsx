import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { validationApi, type ValidationResult } from '../api/validation';
import { riskApi } from '../api/risk';
import { contractualArrangementsApi } from '../api/contractualArrangements';
import { useNavigate, Link } from 'react-router-dom';
import ValidationCharts from '../components/ValidationCharts';
import SupplyChainTree from '../components/SupplyChainTree';
import {
  AlertCircle, ArrowRight, CheckCircle2, FileText, Server,
  Shield, Clock, XCircle, Flag, Lightbulb,
  Building2, BarChart3, ShieldCheck, AlertTriangle, GitBranch,
  Zap, TrendingUp, Info, ThumbsUp, ThumbsDown, ClipboardCheck,
  Globe2, Cloud,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function RiskScoreRing({ score }: { score: number | null }) {
  const color = score === null ? 'text-zinc-500 border-zinc-700' : score >= 80 ? 'text-emerald-400 border-emerald-500' : score >= 50 ? 'text-amber-400 border-amber-500' : 'text-red-400 border-red-500';
  const label = score === null ? 'No Run' : score >= 80 ? 'Low Risk' : score >= 50 ? 'Moderate Risk' : 'High Risk';
  return (
    <div className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shrink-0 ${color}`}>
      <span className="text-xl font-bold leading-none">{score === null ? '—' : score}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, color, tooltip, onClick, badge,
}: {
  label: string; value: number | string; icon: any; color: string;
  tooltip?: string; onClick?: () => void; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`group relative bg-zinc-900/60 border rounded-xl p-4 flex items-center gap-4 w-full text-left transition-all duration-200 hover:scale-[1.01] hover:shadow-lg ${onClick ? 'cursor-pointer' : 'cursor-default'} ${color}`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color.includes('red') ? 'bg-red-500/10' : color.includes('amber') ? 'bg-amber-500/10' : color.includes('emerald') ? 'bg-emerald-500/10' : 'bg-indigo-500/10'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-zinc-100 leading-none">{value}</p>
        <p className="text-xs text-zinc-500 mt-1 truncate">{label}</p>
      </div>
      {badge && (
        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
          {badge}
        </span>
      )}
      {onClick && (
        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 shrink-0" />
      )}
    </button>
  );
}

// ── Quick Access Bar ──────────────────────────────────────────────────────────
function QuickAccessBar() {
  const quickLinks = [
    { label: 'Financial Entities', icon: Building2, to: '/entities', color: 'text-indigo-400 hover:bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/40' },
    { label: 'ICT Providers',      icon: Server,    to: '/providers', color: 'text-teal-400 hover:bg-teal-500/10 border-teal-500/20 hover:border-teal-500/40' },
    { label: 'ICT Services',       icon: Cloud,     to: '/ict-services', color: 'text-cyan-400 hover:bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/40' },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-zinc-600 font-medium uppercase tracking-wider mr-1">Quick access:</span>
      {quickLinks.map(({ label, icon: Icon, to, color }) => (
        <Link
          key={to}
          to={to}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${color}`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </Link>
      ))}
    </div>
  );
}

// Inline validation drill-down panel
function ErrorDrillDown({
  runId, onClose, type = 'errors'
}: { runId: string; onClose: () => void; type: 'errors' | 'warnings' | 'flagged' }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: run, isLoading } = useQuery({
    queryKey: ['validation-run', runId],
    queryFn: () => validationApi.getRunById(runId),
  });

  const flagMutation = useMutation({
    mutationFn: ({ ruleId, recordId }: { ruleId: string; recordId: string }) =>
      validationApi.flagIssue(runId, ruleId, recordId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['validation-run', runId] }),
  });

  const results = (run?.results as ValidationResult[] | undefined) ?? [];
  const active = results.filter(r => {
    if (r.status === 'FIXED' || r.status === 'RESOLVED') return false;
    if (type === 'flagged') return r.status === 'FLAGGED';
    if (type === 'warnings') return r.severity === 'WARNING';
    return r.severity === 'ERROR';
  });

  const titles = {
    errors: { text: 'Validation Errors — Drill Down', icon: XCircle, color: 'text-red-400' },
    warnings: { text: 'Validation Warnings', icon: AlertTriangle, color: 'text-amber-400' },
    flagged: { text: 'Flagged Issues', icon: Flag, color: 'text-purple-400' }
  };
  const titleInfo = titles[type];

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/60 border-b border-zinc-700">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          {titleInfo.icon && <titleInfo.icon className={`w-4 h-4 ${titleInfo.color}`} />}
          {titleInfo.text}
        </h3>
        <div className="flex items-center gap-2">
          <Link to="/validation" className="text-xs text-indigo-400 hover:text-indigo-300">Full Report ↗</Link>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
        </div>
      </div>
      {isLoading ? (
        <div className="p-6 text-center text-zinc-500 text-sm">Loading errors…</div>
      ) : active.length === 0 ? (
        <div className="p-6 text-center flex flex-col items-center gap-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <p className="text-sm text-emerald-400 font-medium">No open errors — export ready</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50 max-h-80 overflow-y-auto">
          {active.slice(0, 20).map((item, idx) => (
            <div key={idx} className={`px-4 py-3 ${item.status === 'FLAGGED' ? 'bg-purple-500/5' : 'hover:bg-zinc-800/40'} transition-colors`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {item.status === 'FLAGGED' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold uppercase">Flagged</span>
                    )}
                    {item.entityName && (
                      <span className="text-xs text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 font-medium">{item.entityName}</span>
                    )}
                    <span className="text-xs text-zinc-500 font-mono">{item.fieldName}</span>
                  </div>
                  <p className="text-sm text-zinc-200">{item.message}</p>
                  {item.suggestedAction && (
                    <p className="text-xs text-teal-400 mt-1 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 shrink-0" /> {item.suggestedAction}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {active.length > 20 && (
            <div className="px-4 py-3 text-xs text-zinc-500 text-center">
              +{active.length - 20} more errors — <Link to="/validation" className="text-indigo-400">view full report</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Concentration Risk Block ──────────────────────────────────────────────────
function ConcentrationRiskBlock() {
  const navigate = useNavigate();
  const { data: risk, isLoading } = useQuery({ queryKey: ['concentration-risk'], queryFn: riskApi.getConcentration });

  if (isLoading) return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse h-40" />
  );

  const items = risk?.riskItems ?? [];
  const dominant = risk?.dominantProviders ?? 0;

  return (
    <div className="bg-zinc-900 border border-amber-500/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
          <GitBranch className="w-4 h-4" /> Concentration Risk
          <span className="text-[10px] ml-1 text-zinc-500 font-normal normal-case">(DORA Art. 29)</span>
        </h3>
        {dominant > 0 && (
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
            {dominant} dominant
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-emerald-400 py-3">
          <CheckCircle2 className="w-4 h-4" /> No concentration issues detected.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 5).map((r) => (
            <button key={r.providerId} onClick={() => navigate('/providers')} className="w-full text-left group">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300 font-medium truncate pr-2">{r.providerName}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-zinc-500">{r.percentageShare}%</span>
                  <span className={`font-bold text-[10px] px-1 py-0.5 rounded ${
                    r.riskLevel === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                    r.riskLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-zinc-700 text-zinc-400'
                  }`}>{r.riskLevel}</span>
                </div>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden group-hover:bg-zinc-700 transition-colors">
                <div
                  className={`h-full rounded-full transition-all ${r.riskLevel === 'HIGH' ? 'bg-red-500' : r.riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-zinc-500'}`}
                  style={{ width: `${Math.min(r.percentageShare, 100)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-zinc-500 mt-3 flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          Providers with ≥33% of contracts trigger DORA Art. 29 obligations.
        </p>
      )}
    </div>
  );
}

// ── Geographic Risk Block ─────────────────────────────────────────────────────
function GeographicRiskBlock() {
  const { data: geo, isLoading } = useQuery({ queryKey: ['geographic-risk'], queryFn: riskApi.getGeographic });

  if (isLoading) return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse h-40" />
  );

  const items = (geo?.riskItems ?? []).slice(0, 6);
  const highRisk = geo?.highRiskCountries ?? 0;

  return (
    <div className="bg-zinc-900 border border-indigo-500/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
          <Globe2 className="w-4 h-4" /> Geographic Risk
          <span className="text-[10px] ml-1 text-zinc-500 font-normal normal-case">(DORA Art. 29)</span>
        </h3>
        {highRisk > 0 && (
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
            {highRisk} high-risk
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-emerald-400 py-3">
          <CheckCircle2 className="w-4 h-4" /> Geographic distribution is healthy.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.countryCode} className="flex items-center gap-3">
              <div className="w-8 text-center">
                <span className="text-xs font-mono font-bold text-zinc-400">{item.countryCode}</span>
              </div>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.riskLevel === 'HIGH' ? 'bg-red-500' : item.riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min(item.percentageShare, 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-zinc-500">{item.percentageShare}%</span>
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                  item.riskLevel === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                  item.riskLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>{item.riskLevel}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-zinc-500 mt-3 flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          Countries processing ≥40% of services require supervisory notification (Art. 29§2).
        </p>
      )}
    </div>
  );
}

// ── Flag Management Panel ─────────────────────────────────────────────────────
function FlagManagementPanel({ runId }: { runId: string }) {
  const qc = useQueryClient();
  const { data: run } = useQuery({
    queryKey: ['validation-run', runId],
    queryFn: () => validationApi.getRunById(runId),
  });
  const approveMutation = useMutation({
    mutationFn: ({ ruleId, recordId }: { ruleId: string; recordId: string }) =>
      validationApi.approveIssue(runId, ruleId, recordId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['validation-run', runId] }),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ ruleId, recordId }: { ruleId: string; recordId: string }) =>
      validationApi.rejectIssue(runId, ruleId, recordId, 'Fix rejected by Analyst — please retry.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['validation-run', runId] }),
  });

  const results = (run?.results as ValidationResult[] | undefined) ?? [];
  const openIssues      = results.filter(r => r.status === 'FLAGGED' && r.severity === 'ERROR');
  const pendingApproval = results.filter(r => r.status === 'WAITING_APPROVAL');
  const approved        = results.filter(r => r.status === 'FIXED' || r.status === 'RESOLVED');

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Flag Management</h3>
        <div className="ml-auto flex gap-3 text-xs">
          <span className="text-red-400 font-semibold">{openIssues.length} Open</span>
          <span className="text-amber-400 font-semibold">{pendingApproval.length} Pending</span>
          <span className="text-emerald-400 font-semibold">{approved.length} Resolved</span>
        </div>
      </div>

      {/* Awaiting Analyst Approval */}
      {pendingApproval.length > 0 && (
        <div className="border-b border-zinc-800">
          <div className="px-5 py-2 bg-amber-500/5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Editor Fixed — Awaiting Your Approval ({pendingApproval.length})
          </div>
          <div className="divide-y divide-zinc-800/50 max-h-64 overflow-y-auto">
            {pendingApproval.map((item, idx) => (
              <div key={idx} className="px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap text-xs">
                      {item.entityName && <span className="font-medium text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">{item.entityName}</span>}
                      <span className="font-mono text-zinc-500">{item.fieldName}</span>
                    </div>
                    <p className="text-sm text-zinc-200">{item.message}</p>
                    {item.suggestedAction && (
                      <p className="text-xs text-teal-400 mt-1 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> {item.suggestedAction}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approveMutation.mutate({ ruleId: item.ruleId, recordId: item.recordId || '' })}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-colors"
                    >
                      <ThumbsUp className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate({ ruleId: item.ruleId, recordId: item.recordId || '' })}
                      disabled={rejectMutation.isPending}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white transition-colors"
                    >
                      <ThumbsDown className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open flagged issues */}
      {openIssues.length > 0 && (
        <div>
          <div className="px-5 py-2 bg-red-500/5 text-[10px] font-bold uppercase tracking-wider text-red-400">
            Open — Waiting for Editor ({openIssues.length})
          </div>
          <div className="divide-y divide-zinc-800/50 max-h-48 overflow-y-auto">
            {openIssues.map((item, idx) => (
              <div key={idx} className="px-5 py-2.5 flex items-center gap-3">
                <Flag className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono text-zinc-400 mr-2">{item.fieldName}</span>
                  <span className="text-xs text-zinc-300 truncate">{item.message}</span>
                </div>
                {item.entityName && <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded shrink-0">{item.entityName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {openIssues.length === 0 && pendingApproval.length === 0 && (
        <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-400">All issues resolved</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────

export default function AnalystDashboard() {
  const navigate = useNavigate();
  const [drillDown, setDrillDown] = useState<'errors' | 'warnings' | 'flagged' | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | undefined>(undefined);

  const { data: contracts } = useQuery({ queryKey: ['contractual-arrangements'], queryFn: contractualArrangementsApi.getAll });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60_000,
  });

  const riskScore = stats?.validation?.latestRunId ? (stats?.risk?.score ?? 100) : null;
  const validation = stats?.validation;

  const statCards = [
    {
      label: 'Contracts',
      value: stats?.metrics.contracts ?? '—',
      icon: FileText,
      color: 'border-zinc-800 text-zinc-300',
      tooltip: 'Contractual arrangements registered (DORA Art. 28§2)',
      onClick: () => navigate('/contracts'),
    },
    {
      label: 'Validation Errors',
      value: validation?.totalErrors ?? '—',
      icon: XCircle,
      color: (validation?.totalErrors ?? 0) > 0 ? 'border-red-500/30 text-red-400' : 'border-emerald-500/30 text-emerald-400',
      badge: (validation?.totalErrors ?? 0) > 0 ? 'Blocking' : undefined,
      tooltip: 'Click to drill down into specific validation errors',
      onClick: validation?.latestRunId ? () => setDrillDown(d => d === 'errors' ? null : 'errors') : undefined,
    },
    {
      label: 'Warnings',
      value: validation?.totalWarnings ?? '—',
      icon: AlertTriangle,
      color: (validation?.totalWarnings ?? 0) > 0 ? 'border-amber-500/30 text-amber-400' : 'border-zinc-800 text-zinc-300',
      tooltip: 'Non-blocking warnings that should be reviewed',
      onClick: validation?.latestRunId ? () => setDrillDown(d => d === 'warnings' ? null : 'warnings') : undefined,
    },
    {
      label: 'Flagged Issues',
      value: validation?.flaggedIssues ?? '—',
      icon: Flag,
      color: (validation?.flaggedIssues ?? 0) > 0 ? 'border-purple-500/30 text-purple-400' : 'border-zinc-800 text-zinc-300',
      tooltip: 'Issues flagged for Editor review',
      onClick: validation?.latestRunId ? () => setDrillDown(d => d === 'flagged' ? null : 'flagged') : undefined,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header — with quick access nav on right */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            Analyst Workspace
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Compliance review, validation oversight, and Register of Information (RoI) management.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <QuickAccessBar />
          <Link to="/validation" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0">
            <ShieldCheck className="w-4 h-4" /> Run Validation
          </Link>
        </div>
      </div>

      {/* Risk Header Band */}
      {!isLoading && (
        <div className={`p-4 rounded-xl border flex items-center gap-4 ${
          (riskScore ?? 0) >= 80 ? 'bg-emerald-500/5 border-emerald-500/20' :
          (riskScore ?? 0) >= 50 ? 'bg-amber-500/5 border-amber-500/20' :
          'bg-red-500/5 border-red-500/20'
        }`}>
          <RiskScoreRing score={riskScore ?? 0} />
          <div className="flex-1">
            <h2 className={`text-base font-semibold ${(riskScore ?? 0) >= 80 ? 'text-emerald-300' : (riskScore ?? 0) >= 50 ? 'text-amber-300' : 'text-red-300'}`}>
              DORA Compliance Score: {riskScore ?? 0}/100
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {riskScore === null
                ? 'Run validation to calculate your compliance score.'
                : riskScore >= 80
                ? 'System is in good shape. Minor issues may exist — review warnings.'
                : riskScore >= 50
                ? 'Moderate risk detected. Fix validation errors and LEI gaps.'
                : 'Critical compliance gaps. Address errors before RoI export is possible.'}
            </p>
            {validation?.executedAt && (
              <p className="text-xs text-zinc-600 mt-1">Last validation: {new Date(validation.executedAt).toLocaleString()}</p>
            )}
          </div>
          {validation?.isExportReady ? (
            <Link to="/roi-export" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Export RoI
            </Link>
          ) : (
            <button disabled className="px-4 py-2 bg-zinc-800 text-zinc-600 text-sm font-semibold rounded-lg shrink-0 cursor-not-allowed border border-zinc-700">
              Export Blocked
            </button>
          )}
        </div>
      )}

      {/* Stat Cards Grid — focused 4 KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* Error Drill-Down Panel */}
      {drillDown && validation?.latestRunId && (
        <ErrorDrillDown
          runId={validation.latestRunId}
          type={drillDown}
          onClose={() => setDrillDown(null)}
        />
      )}

      {/* Validation Charts */}
      {validation?.latestRunId && (
        <ValidationCharts results={(stats as any)?.validationResults ?? []} />
      )}

      {/* Two-column lower section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Priority Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Priority Actions
          </h2>
          <div className="space-y-3">
            {/* Missing LEIs */}
            {(stats?.insights.providersMissingLEI ?? 0) > 0 && (
              <div
                className="relative p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start justify-between group cursor-pointer hover:bg-amber-500/15 transition-colors"
                onClick={() => navigate('/providers')}
              >
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-400">{stats!.insights.providersMissingLEI} Providers Missing LEI Code</h3>
                    <p className="text-xs text-zinc-400 mt-1">Legal Entity Identifiers (LEIs) are mandatory for EBA RT.03. Click to fix.</p>
                    {(stats?.insights.missingLEIDetails?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {stats!.insights.missingLEIDetails.slice(0, 4).map(p => (
                          <span key={p.id} className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded">{p.legalName}</span>
                        ))}
                        {stats!.insights.missingLEIDetails.length > 4 && (
                          <span className="text-[10px] text-zinc-500">+{stats!.insights.missingLEIDetails.length - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </div>
            )}

            {/* Expiring Contracts */}
            {(stats?.insights.contractsEndingSoon ?? 0) > 0 && (
              <div
                className="relative p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start justify-between group cursor-pointer hover:bg-orange-500/15 transition-colors"
                onClick={() => navigate('/contracts')}
              >
                <div className="flex gap-3">
                  <Clock className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-orange-400">{stats!.insights.contractsEndingSoon} Contracts Expiring within 90 days</h3>
                    <p className="text-xs text-zinc-400 mt-1">Review renewal strategies. Termination without exit plan violates DORA Art. 28§8.</p>
                    {(stats?.insights.expiringContractsDetails?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {stats!.insights.expiringContractsDetails.slice(0, 3).map(c => (
                          <span key={c.id} className="text-[10px] bg-orange-500/10 text-orange-300 border border-orange-500/20 px-1.5 py-0.5 rounded">{c.contractReference} — {c.provider?.legalName}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </div>
            )}

            {/* Validation errors banner */}
            {(validation?.totalErrors ?? 0) > 0 && (
              <div
                className="relative p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start justify-between group cursor-pointer hover:bg-rose-500/15 transition-colors"
                onClick={() => setDrillDown(d => d === 'errors' ? null : 'errors')}
              >
                <div className="flex gap-3">
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-rose-400">RoI Export Blocked — {validation!.totalErrors} Validation Errors</h3>
                    <p className="text-xs text-zinc-400 mt-1">Click to drill down &amp; flag issues for Editors to resolve.</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </div>
            )}

            {/* All good */}
            {!isLoading &&
              (stats?.insights.providersMissingLEI ?? 0) === 0 &&
              (stats?.insights.contractsEndingSoon ?? 0) === 0 &&
              (validation?.totalErrors ?? 0) === 0 && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-400">All caught up! No critical missing data or validation errors.</p>
              </div>
            )}

            {/* No validation run */}
            {!validation?.latestRunId && (
              <div
                className="relative p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start justify-between group cursor-pointer hover:bg-indigo-500/15 transition-colors"
                onClick={() => navigate('/validation')}
              >
                <div className="flex gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-indigo-400">Run Initial Validation</h3>
                    <p className="text-xs text-zinc-400 mt-1">You haven't run the EBA validation engine yet. Check compliance status now.</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </div>
            )}
          </div>

          {/* Flag Management Panel — full workflow */}
          {validation?.latestRunId && (
            <FlagManagementPanel runId={validation.latestRunId} />
          )}
        </div>

        {/* Right column: RoI Coverage + Risk Blocks */}
        <div className="space-y-4">
          {/* RoI Coverage Progress */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" /> RoI Coverage
            </h2>
            {(() => {
              const entities  = stats?.metrics.entities  ?? 0;
              const providers = stats?.metrics.providers ?? 0;
              const contracts = stats?.metrics.contracts ?? 0;
              const totalErrors = validation?.totalErrors ?? 0;
              const totalItems = entities + providers + contracts;
              const errorPct = totalItems > 0 ? Math.round((totalErrors / Math.max(totalItems, 1)) * 100) : 0;
              const validPct = totalItems > 0 ? Math.max(0, 100 - errorPct) : 0;
              return (
                <div className="space-y-4">
                  {[
                    { label: 'Financial Entities', value: entities, max: Math.max(entities, 1), color: 'bg-indigo-500' },
                    { label: 'ICT Providers',      value: providers, max: Math.max(entities + providers, 1), color: 'bg-teal-500' },
                    { label: 'Contracts',          value: contracts, max: Math.max(contracts, 1), color: 'bg-violet-500' },
                  ].map(({ label, value, max, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">{label}</span>
                        <span className="text-zinc-200 font-semibold">{value}</span>
                      </div>
                      <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 pt-3 border-t border-zinc-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">% with errors</span>
                      <span className={`font-semibold ${errorPct > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{errorPct}%</span>
                    </div>
                    <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-red-500 transition-all duration-700" style={{ width: `${errorPct}%` }} />
                      <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${validPct}%` }} />
                    </div>
                    <div className="flex gap-3 text-[10px] text-zinc-600">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/> Errors</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/> Valid</span>
                    </div>
                  </div>
                  <Link to="/roi-export" className={`block w-full text-center px-4 py-2 text-sm font-medium rounded-lg transition-colors border mt-2 ${
                    validation?.isExportReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700'
                  }`}>
                    {validation?.isExportReady ? '✓ Export to XBRL / Excel' : 'Export to XBRL / Excel'}
                  </Link>
                </div>
              );
            })()}
          </div>

          {/* Concentration Risk */}
          <ConcentrationRiskBlock />

          {/* Geographic Risk */}
          <GeographicRiskBlock />
        </div>
      </div>

      {/* Supply Chain Tree */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-400" /> Contract Supply Chain Explorer
          </h2>
          <select
            value={selectedContractId || ''}
            onChange={(e) => setSelectedContractId(e.target.value || undefined)}
            className="w-full sm:w-auto bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select a contract...</option>
            {contracts?.map(c => (
              <option key={c.id} value={c.id}>{c.contractReference} ({c.provider?.legalName || 'Unknown Provider'})</option>
            ))}
          </select>
        </div>
        <SupplyChainTree contractId={selectedContractId} />
      </div>
    </div>
  );
}
