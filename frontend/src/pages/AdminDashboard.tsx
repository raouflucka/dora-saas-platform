import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi } from '../api/admin';
import { riskApi } from '../api/risk';
import { dashboardApi } from '../api/dashboard';
import { notificationsApi } from '../api/notifications';
import { financialEntitiesApi } from '../api/financialEntities';
import {
  ShieldAlert, Users, Server, TrendingUp, AlertTriangle,
  Globe2, AlertCircle, FileText, CheckCircle2,
  Bell, Loader2, ChevronRight, BarChart3, Building2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// ── DORA Score Ring ────────────────────────────────────────────────────────────
function DoraScoreRing({ score, onClick }: { score: number | null; onClick: () => void }) {
  const color =
    score === null ? 'border-zinc-700 text-zinc-500' :
    score >= 80 ? 'border-emerald-500 text-emerald-400' :
    score >= 50 ? 'border-amber-500 text-amber-400' :
                  'border-red-500 text-red-400';
  const label =
    score === null ? 'No Run' :
    score >= 80 ? 'Low Risk' : score >= 50 ? 'Moderate' : 'High Risk';
  return (
    <button
      onClick={onClick}
      title="Click to see compliance breakdown"
      className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center shrink-0 transition-all hover:scale-105 cursor-pointer ${color}`}
    >
      <span className="text-2xl font-bold leading-none">{score === null ? '—' : `${score}%`}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70 mt-1">{label}</span>
    </button>
  );
}

// ── Clickable KPI Card ─────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon: Icon, color, to, badge,
}: {
  label: string; value: string | number; icon: any; color: string; to?: string; badge?: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => to && navigate(to)}
      className={`bg-zinc-900 border rounded-xl p-5 shadow-sm w-full text-left transition-all hover:scale-[1.02] hover:shadow-lg group ${to ? 'cursor-pointer' : 'cursor-default'} ${color}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color.includes('indigo') ? 'bg-indigo-500/10' : color.includes('teal') ? 'bg-teal-500/10' : color.includes('amber') ? 'bg-amber-500/10' : color.includes('red') ? 'bg-red-500/10' : color.includes('emerald') ? 'bg-emerald-500/10' : 'bg-zinc-800'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-xs font-medium text-zinc-400">{label}</h3>
        {badge && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
            {badge}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {to && (
        <p className="text-xs text-zinc-600 mt-1 flex items-center gap-1 group-hover:text-zinc-400 transition-colors">
          View details <ChevronRight className="w-3 h-3" />
        </p>
      )}
    </button>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  const { data: usersData } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.getUsers });
  const { data: riskData } = useQuery({ queryKey: ['concentration-risk'], queryFn: riskApi.getConcentration });
  const { data: geoRisk } = useQuery({ queryKey: ['geographic-risk'], queryFn: riskApi.getGeographic });
  const { data: stats } = useQuery({ queryKey: ['dashboardStats'], queryFn: dashboardApi.getStats });
  const { data: financialEntities } = useQuery({ queryKey: ['financial-entities'], queryFn: financialEntitiesApi.getAll });

  const riskScore = stats?.validation?.latestRunId ? Math.min(stats?.risk?.score ?? 100, 100) : null;
  const validation = stats?.validation;

  // Compute score breakdown categories
  const missingData    = stats?.insights?.providersMissingLEI ?? 0;
  const validationErrs = validation?.totalErrors ?? 0;
  const riskIssues     = (riskData?.dominantProviders ?? 0) + (geoRisk?.highRiskCountries ?? 0);
  const complianceGaps = stats?.insights?.contractsEndingSoon ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-teal-400" /> Admin Overview
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            System health, tenant oversight, and compliance status. <span className="text-zinc-600 text-xs">Read-only.</span>
          </p>
        </div>
      </div>

      {/* DORA Score + Risk Banner */}
      <div className={`p-5 rounded-xl border flex items-center gap-5 ${(riskScore ?? 0) >= 80 ? 'bg-emerald-500/5 border-emerald-500/20' : (riskScore ?? 0) >= 50 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <div className="relative w-24 h-24 shrink-0">
          <DoraScoreRing score={riskScore} onClick={() => {}} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className={`text-lg font-semibold ${(riskScore ?? 0) >= 80 ? 'text-emerald-300' : (riskScore ?? 0) >= 50 ? 'text-amber-300' : 'text-red-300'}`}>
            DORA Compliance Score
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {riskScore === null
              ? 'Run validation to calculate your compliance score.'
              : riskScore >= 80
              ? 'All systems healthy. Routine review recommended.'
              : riskScore >= 50
              ? 'Moderate risk — validation errors and data gaps need resolution.'
              : 'Critical compliance gaps — RoI export is blocked until errors are resolved.'}
          </p>
          {validation?.executedAt && (
            <p className="text-[10px] text-zinc-600 mt-1">Last validated: {new Date(validation.executedAt).toLocaleString()}</p>
          )}
        </div>
        <button
          onClick={() => setShowScoreBreakdown(v => !v)}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg border border-zinc-700 transition-colors"
        >
          {showScoreBreakdown ? 'Hide' : 'See Breakdown'}
        </button>
      </div>

      {/* Score Breakdown Panel */}
      {showScoreBreakdown && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white mb-3">Compliance Score Breakdown</h3>
          {[
            { label: 'Missing Data', count: missingData, color: 'bg-amber-500', max: 20 },
            { label: 'Validation Errors', count: validationErrs, color: 'bg-red-500', max: 50 },
            { label: 'Provider / Geographic Risk Issues', count: riskIssues, color: 'bg-orange-500', max: 15 },
            { label: 'Compliance Gaps (Expiring Contracts)', count: complianceGaps, color: 'bg-purple-500', max: 10 },
          ].map(({ label, count, color, max }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400">{label}</span>
                <span className={`font-semibold ${count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {count > 0 ? `${count} issue(s)` : '✓ No issues'}
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${count > 0 ? color : 'bg-emerald-500'}`}
                  style={{ width: count > 0 ? `${Math.min((count / max) * 100, 100)}%` : '100%' }}
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => navigate('/admin')}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            View detailed risk report <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Financial Entities" value={financialEntities?.length ?? 0} icon={Building2} color="border-indigo-800/40 text-indigo-400" to="/entities" />
        <KpiCard label="Total Users" value={usersData?.length ?? 0} icon={Users} color="border-indigo-800/40 text-indigo-400" />
        <KpiCard
          label="Active Contracts"
          value={riskData?.totalContracts ?? 0}
          icon={Server}
          color="border-teal-800/40 text-teal-400"
          to="/contracts"
        />
        <KpiCard
          label="Concentration Risks"
          value={riskData?.dominantProviders ?? 0}
          icon={AlertTriangle}
          color={(riskData?.dominantProviders ?? 0) > 0 ? 'border-red-800/40 text-red-400' : 'border-zinc-800 text-zinc-400'}
          to="/admin?tab=risk"
          badge={(riskData?.dominantProviders ?? 0) > 0 ? 'HIGH' : undefined}
        />
        <KpiCard
          label="Validation Errors"
          value={validationErrs}
          icon={AlertCircle}
          color={validationErrs > 0 ? 'border-red-800/40 text-red-400' : 'border-emerald-800/40 text-emerald-400'}
          to="/validation"
          badge={validationErrs > 0 ? 'BLOCKING' : undefined}
        />
      </div>

      {/* Two-column: Quick Actions + Geographic Exposure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dashboard Statistics — Dashboard Cleanup */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-400" /> Platform Overview
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
              <span className="text-sm text-zinc-400">Total Contractual Arrangements</span>
              <span className="text-sm font-semibold text-zinc-200">{riskData?.totalContracts ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
              <span className="text-sm text-zinc-400">Active Supply Chain Risks</span>
              <span className="text-sm font-semibold text-zinc-200">{riskIssues} critical items</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
              <span className="text-sm text-zinc-400">Validation Status</span>
              <span className={`text-sm font-semibold ${validationErrs > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {validationErrs > 0 ? `${validationErrs} blocking errors` : 'All checks passed'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-zinc-400">Export Readiness (RoI)</span>
              <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${validationErrs === 0 && riskScore !== null ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {validationErrs === 0 && riskScore !== null ? 'READY' : 'BLOCKED'}
              </span>
            </div>
          </div>
        </div>

        {/* Geographic Exposure */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-teal-400" /> Geographic Exposure
          </h2>
          {(geoRisk?.highRiskCountries ?? 0) > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                {geoRisk!.highRiskCountries} countr(ies) process ≥40% of services (DORA Art. 29)
              </p>
            </div>
          )}
          {(geoRisk?.riskItems?.length ?? 0) === 0 ? (
            <div className="flex items-center gap-2 text-zinc-400 text-sm py-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Geographic distribution is healthy.
            </div>
          ) : (
            <div className="space-y-2">
              {geoRisk?.riskItems?.map(item => (
                <div key={item.countryCode} className="flex justify-between items-center p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{item.countryName} ({item.countryCode})</p>
                    <p className="text-xs text-zinc-500">{item.contractCount} contract(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white mb-1">{item.percentageShare}%</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      item.riskLevel === 'HIGH' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      item.riskLevel === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {item.riskLevel} RISK
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate('/risk-geographic')}
            className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            Full risk analysis <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Provider Concentration Summary */}
      {(riskData?.dominantProviders ?? 0) > 0 && (
        <button
          onClick={() => navigate('/providers')}
          className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-left hover:bg-amber-500/15 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-400">High Concentration Detected</p>
            <p className="text-xs text-zinc-400 mt-1">
              {riskData!.dominantProviders} provider(s) hold ≥33% of contracts — review DORA Art. 28§5 obligations.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
        </button>
      )}

    </div>
  );
}
