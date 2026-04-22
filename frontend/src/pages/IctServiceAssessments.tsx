import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  riskAssessmentApi, TRIGGER_REASONS, ASSESSMENT_STATUSES,
  type IctServiceAssessment,
} from '../api/riskAssessment';
import { contractualArrangementsApi } from '../api/contractualArrangements';
import { ictProvidersApi } from '../api/ictProviders';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import RoleGuard from '../components/RoleGuard';
import { useAuthStore } from '../store/authStore';
import {
  Plus, Search, Pencil, Trash2, Loader2, ShieldAlert, AlertTriangle,
  Info, Filter, ChevronDown, ChevronRight, Eye, Calendar, Clock,
  CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBSTITUTABILITY_OPTIONS = [
  { value: '', label: 'Select substitutability level...' },
  { value: 'fully', label: 'Fully substitutable' },
  { value: 'partially', label: 'Partially substitutable' },
  { value: 'not_substitutable', label: 'Not substitutable' },
] as const;

// Days until "review due soon" warning
const REVIEW_DUE_WARN_DAYS = 30;

// ─── Schema ───────────────────────────────────────────────────────────────────
const assessmentSchema = z.object({
  contractId:                  z.string().min(1, 'Contract is required'),
  providerId:                  z.string().min(1, 'Provider is required'),
  triggerReason:               z.string().min(1, 'Trigger reason is required'),
  substitutabilityLevel:       z.string().optional().or(z.literal('')),
  substitutionReason:          z.string().optional().or(z.literal('')),
  exitStrategyRequired:        z.enum(['yes', 'no', '']).optional(),
  exitPlanExists:              z.boolean().optional(),
  hasAlternativeProvider:      z.enum(['yes', 'no', '']).optional(),
  alternativeProviderReference:z.string().optional().or(z.literal('')),
  discontinuationImpact:       z.string().optional().or(z.literal('')),
  reintegrationPossible:       z.boolean().optional(),
  lastAuditDate:               z.string().optional().or(z.literal('')),
  nextReviewDate:              z.string().optional().or(z.literal('')),
  assessmentStatus:            z.string().optional(),
});

type AssessmentFormValues = z.infer<typeof assessmentSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deriveRiskLevel(item: IctServiceAssessment): { label: string; cls: string; dot: string } {
  let score = 0;
  if (item.isSubstitutable === false)         score += 2;
  else if (item.isSubstitutable === undefined || item.isSubstitutable === null) score += 1;
  if (!item.exitPlanExists)                   score += 2;
  if (!item.alternativeProvidersExist)        score += 1;
  if (score >= 4) return { label: 'High Risk',   cls: 'bg-red-500/10 text-red-400 border-red-500/20',     dot: 'bg-red-500' };
  if (score >= 2) return { label: 'Medium Risk',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-500' };
  return                { label: 'Low Risk',     cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' };
}

function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function reviewStatus(nextReviewDate?: string | null, lastAuditDate?: string | null): {
  label: string; cls: string; icon: any; urgent: boolean;
} {
  if (!nextReviewDate && !lastAuditDate) return { label: 'Not set', cls: 'text-zinc-600', icon: Clock, urgent: false };

  if (nextReviewDate) {
    const diff = Math.ceil((new Date(nextReviewDate).getTime() - Date.now()) / 86400000);
    if (diff < 0)                          return { label: 'Overdue',         cls: 'text-red-400',    icon: AlertCircle, urgent: true };
    if (diff <= REVIEW_DUE_WARN_DAYS)      return { label: `Due in ${diff}d`,  cls: 'text-amber-400',  icon: AlertTriangle, urgent: true };
    return                                        { label: `Due ${formatDate(nextReviewDate)}`, cls: 'text-zinc-400', icon: Calendar, urgent: false };
  }

  // Fallback: estimate from lastAuditDate + 1 year
  const oneYearAfter = new Date(lastAuditDate!);
  oneYearAfter.setFullYear(oneYearAfter.getFullYear() + 1);
  const diff = Math.ceil((oneYearAfter.getTime() - Date.now()) / 86400000);
  if (diff < 0)                            return { label: 'Likely overdue',  cls: 'text-red-400',    icon: AlertCircle, urgent: true };
  if (diff <= REVIEW_DUE_WARN_DAYS)        return { label: `Due ~${diff}d`,   cls: 'text-amber-400',  icon: AlertTriangle, urgent: true };
  return                                          { label: `Est. ${formatDate(oneYearAfter.toISOString())}`, cls: 'text-zinc-500', icon: Calendar, urgent: false };
}

function getTriggerLabel(reason?: string | null): string {
  if (!reason) return '—';
  return TRIGGER_REASONS.find(r => r.value === reason)?.label ?? reason;
}

function getTriggerIcon(reason?: string | null): string {
  return TRIGGER_REASONS.find(r => r.value === reason)?.icon ?? '📄';
}

function getStatusBadge(status?: string | null) {
  const s = ASSESSMENT_STATUSES.find(a => a.value === status) ?? ASSESSMENT_STATUSES[0];
  return s;
}

// ─── Small sub-components ─────────────────────────────────────────────────────
function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md mt-2">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-300">{children}</p>
    </div>
  );
}

function InfoHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-2 mt-1">
      <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
      <p className="text-xs text-zinc-500">{children}</p>
    </div>
  );
}

function ReviewDueBadge({ nextReview, lastAudit }: { nextReview?: string; lastAudit?: string }) {
  const rs = reviewStatus(nextReview, lastAudit);
  const Icon = rs.icon;
  return (
    <span className={`flex items-center gap-1 text-xs ${rs.cls}`}>
      <Icon className="w-3 h-3" /> {rs.label}
    </span>
  );
}

// ─── Risk Summary Bar ─────────────────────────────────────────────────────────
function RiskSummaryBar({ assessments }: { assessments: IctServiceAssessment[] }) {
  const active    = assessments.filter(a => (a.assessmentStatus ?? 'ACTIVE') === 'ACTIVE');
  const high      = active.filter(a => deriveRiskLevel(a).label === 'High Risk').length;
  const medium    = active.filter(a => deriveRiskLevel(a).label === 'Medium Risk').length;
  const low       = active.filter(a => deriveRiskLevel(a).label === 'Low Risk').length;
  const overdue   = active.filter(a => reviewStatus(a.nextReviewDate, a.lastAuditDate).label.startsWith('Overdue') || reviewStatus(a.nextReviewDate, a.lastAuditDate).label.startsWith('Likely')).length;
  const noExit    = active.filter(a => !a.exitPlanExists).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: 'High Risk (Active)',    value: high,    color: 'border-red-500/30 bg-red-500/5 text-red-400' },
        { label: 'Medium Risk (Active)',  value: medium,  color: 'border-amber-500/30 bg-amber-500/5 text-amber-400' },
        { label: 'Low Risk (Active)',     value: low,     color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' },
        { label: 'Review Overdue',        value: overdue, color: 'border-red-500/30 bg-red-500/5 text-red-400' },
        { label: 'Missing Exit Plan',     value: noExit,  color: 'border-amber-500/30 bg-amber-500/5 text-amber-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-[10px] uppercase font-medium tracking-wide opacity-70 mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function IctServiceAssessments() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAnalyst = user?.role === 'ANALYST';
  const isEditor  = user?.role === 'EDITOR';
  const isAdmin   = user?.role === 'ADMIN';
  // Analyst can create + update. Editor and Admin can only view.
  const canWrite  = isAnalyst || isAdmin;

  const [search,                setSearch]                = useState('');
  const [filterSubstitutability,setFilterSubstitutability]= useState('all');
  const [filterExitPlan,        setFilterExitPlan]        = useState('all');
  const [filterRisk,            setFilterRisk]            = useState('all');
  const [filterStatus,          setFilterStatus]          = useState('ACTIVE');
  const [filterTrigger,         setFilterTrigger]         = useState('all');
  const [collapsedContracts,    setCollapsedContracts]    = useState<Set<string>>(new Set());

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [viewOnly,     setViewOnly]     = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      contractId: '', providerId: '', triggerReason: '',
      substitutabilityLevel: '', substitutionReason: '',
      exitStrategyRequired: '', exitPlanExists: false,
      hasAlternativeProvider: '', alternativeProviderReference: '',
      discontinuationImpact: '', reintegrationPossible: false,
      lastAuditDate: '', nextReviewDate: '', assessmentStatus: 'ACTIVE',
    },
  });

  const watchSubstitutability = watch('substitutabilityLevel');
  const watchExitRequired     = watch('exitStrategyRequired');
  const watchHasAlternative   = watch('hasAlternativeProvider');
  const watchLastAudit        = watch('lastAuditDate');

  // Auto-suggest nextReviewDate as +1 year from lastAuditDate
  const suggestNextReview = () => {
    if (watchLastAudit) {
      const d = new Date(watchLastAudit);
      d.setFullYear(d.getFullYear() + 1);
      setValue('nextReviewDate', d.toISOString().split('T')[0]);
    }
  };

  const { data: assessments, isLoading: loadingAssessments } = useQuery({
    queryKey: ['risk-assessments'],
    queryFn: riskAssessmentApi.getAll,
  });

  const { data: contracts } = useQuery({
    queryKey: ['contractual-arrangements'],
    queryFn: contractualArrangementsApi.getAll,
  });

  const { data: providers } = useQuery({
    queryKey: ['ict-providers'],
    queryFn: ictProvidersApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: riskAssessmentApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['risk-assessments'] }); setIsDialogOpen(false); reset(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IctServiceAssessment> }) =>
      riskAssessmentApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['risk-assessments'] }); setIsDialogOpen(false); setEditingId(null); reset(); },
  });

  const deleteMutation = useMutation({
    mutationFn: riskAssessmentApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk-assessments'] }),
  });

  const onSubmit = (data: AssessmentFormValues) => {
    const isSubstitutable =
      data.substitutabilityLevel === 'fully' ? true :
      data.substitutabilityLevel === 'not_substitutable' ? false :
      data.substitutabilityLevel === 'partially' ? true : undefined;

    const exitPlanExists = data.exitStrategyRequired === 'yes' ? true : data.exitStrategyRequired === 'no' ? false : undefined;
    const alternativeProvidersExist = data.hasAlternativeProvider === 'yes' ? true : data.hasAlternativeProvider === 'no' ? false : undefined;

    const payload: Partial<IctServiceAssessment> = {
      contractId: data.contractId,
      providerId: data.providerId,
      triggerReason:               data.triggerReason as any,
      assessmentStatus:            data.assessmentStatus,
      isSubstitutable,
      substitutionReason:          data.substitutionReason || undefined,
      alternativeProvidersExist,
      alternativeProviderReference:data.alternativeProviderReference || undefined,
      discontinuationImpact:       data.discontinuationImpact || undefined,
      exitPlanExists,
      reintegrationPossible:       data.reintegrationPossible,
      lastAuditDate:               data.lastAuditDate || undefined,
      nextReviewDate:              data.nextReviewDate || undefined,
    };

    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setViewOnly(false);
    reset({ contractId: '', providerId: '', triggerReason: '', substitutabilityLevel: '',
      substitutionReason: '', exitStrategyRequired: '', exitPlanExists: false,
      hasAlternativeProvider: '', alternativeProviderReference: '',
      discontinuationImpact: '', reintegrationPossible: false,
      lastAuditDate: '', nextReviewDate: '', assessmentStatus: 'ACTIVE',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (assessment: IctServiceAssessment, readOnly = false) => {
    let substitutabilityLevel = '';
    if (assessment.isSubstitutable === true)  substitutabilityLevel = 'fully';
    else if (assessment.isSubstitutable === false) substitutabilityLevel = 'not_substitutable';
    const exitStrategyRequired     = assessment.exitPlanExists === true ? 'yes' : assessment.exitPlanExists === false ? 'no' : '';
    const hasAlternativeProvider   = assessment.alternativeProvidersExist === true ? 'yes' : assessment.alternativeProvidersExist === false ? 'no' : '';

    setEditingId(assessment.id);
    setViewOnly(readOnly);
    reset({
      contractId:                   assessment.contractId,
      providerId:                   assessment.providerId,
      triggerReason:                assessment.triggerReason as any ?? 'MANUAL_REVIEW',
      assessmentStatus:             assessment.assessmentStatus ?? 'ACTIVE',
      substitutabilityLevel:        substitutabilityLevel as any,
      substitutionReason:           assessment.substitutionReason ?? '',
      exitStrategyRequired:         exitStrategyRequired as any,
      exitPlanExists:               assessment.exitPlanExists ?? false,
      hasAlternativeProvider:       hasAlternativeProvider as any,
      alternativeProviderReference: assessment.alternativeProviderReference ?? '',
      discontinuationImpact:        assessment.discontinuationImpact ?? '',
      reintegrationPossible:        assessment.reintegrationPossible ?? false,
      lastAuditDate:                assessment.lastAuditDate ? assessment.lastAuditDate.split('T')[0] : '',
      nextReviewDate:               assessment.nextReviewDate ? assessment.nextReviewDate.split('T')[0] : '',
    });
    setIsDialogOpen(true);
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return (assessments ?? []).filter(a => {
      const searchMatch =
        a.contract?.contractReference?.toLowerCase().includes(search.toLowerCase()) ||
        a.provider?.legalName?.toLowerCase().includes(search.toLowerCase()) ||
        a.provider?.providerCode?.toLowerCase().includes(search.toLowerCase());

      if (!searchMatch) return false;

      if (filterSubstitutability !== 'all') {
        if (filterSubstitutability === 'substitutable'     && a.isSubstitutable !== true)  return false;
        if (filterSubstitutability === 'not_substitutable' && a.isSubstitutable !== false) return false;
        if (filterSubstitutability === 'unassessed'        && (a.isSubstitutable !== undefined && a.isSubstitutable !== null)) return false;
      }

      if (filterExitPlan !== 'all') {
        if (filterExitPlan === 'defined' && !a.exitPlanExists)  return false;
        if (filterExitPlan === 'missing' && a.exitPlanExists)   return false;
      }

      if (filterRisk !== 'all' && deriveRiskLevel(a).label.toLowerCase() !== filterRisk) return false;

      if (filterStatus !== 'all' && (a.assessmentStatus ?? 'ACTIVE') !== filterStatus) return false;

      if (filterTrigger !== 'all' && a.triggerReason !== filterTrigger) return false;

      return true;
    });
  }, [assessments, search, filterSubstitutability, filterExitPlan, filterRisk, filterStatus, filterTrigger]);

  // Group by contract → sort so ACTIVE assessments appear at the top within each group
  const grouped = useMemo(() => {
    const map = new Map<string, { contractRef: string; items: IctServiceAssessment[] }>();
    for (const item of filtered) {
      const key = item.contractId;
      const ref = item.contract?.contractReference ?? item.contractId;
      if (!map.has(key)) map.set(key, { contractRef: ref, items: [] });
      map.get(key)!.items.push(item);
    }
    // Sort items within each group: ACTIVE first, then by createdAt desc
    for (const [, group] of map) {
      group.items.sort((a, b) => {
        const aActive = (a.assessmentStatus ?? 'ACTIVE') === 'ACTIVE' ? 0 : 1;
        const bActive = (b.assessmentStatus ?? 'ACTIVE') === 'ACTIVE' ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      });
    }
    return Array.from(map.entries()).sort(([, a], [, b]) => a.contractRef.localeCompare(b.contractRef));
  }, [filtered]);

  const toggleContract = (contractId: string) => {
    setCollapsedContracts(prev => {
      const next = new Set(prev);
      if (next.has(contractId)) next.delete(contractId);
      else next.add(contractId);
      return next;
    });
  };

  const getSubstitutabilityBadge = (item: IctServiceAssessment) => {
    if (item.isSubstitutable === true)  return { text: 'Substitutable',     cls: 'bg-green-500/10 text-green-400 border-green-500/20' };
    if (item.isSubstitutable === false) return { text: 'Not Substitutable', cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
    return { text: 'Not assessed', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
  };

  const hasActiveFilters = filterSubstitutability !== 'all' || filterExitPlan !== 'all' ||
    filterRisk !== 'all' || filterStatus !== 'ACTIVE' || filterTrigger !== 'all' || search !== '';

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            Risk &amp; Service Assessments
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            DORA Art. 28§5 — Assess substitutability, exit strategies, and concentration risk for critical ICT services (EBA RT.06).
          </p>
        </div>

        {/* Only Analyst (+ Admin) can create */}
        {canWrite && (
          <button
            onClick={openCreateDialog}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> New Assessment
          </button>
        )}
      </div>

      {/* Risk Summary Bar */}
      {(assessments?.length ?? 0) > 0 && (
        <RiskSummaryBar assessments={assessments ?? []} />
      )}

      {/* DORA Context */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 items-start">
        <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-red-400">DORA Context: Risk &amp; Service Assessments</h3>
          <p className="text-xs text-zinc-400 mt-1">
            DORA Art. 28§5 requires the Analyst to formally assess the substitutability of each critical ICT service.
            Assessments must be triggered by onboarding events, material changes, or periodic reviews.
            Missing exit strategies or high concentration risks generate EBA RT.06/07 validation findings.
          </p>
          {isEditor && (
            <p className="text-xs text-indigo-400 mt-1.5">
              ℹ️ Editors have read-only access to assessments. Contact your Analyst to initiate or update a risk assessment.
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Filters</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by contract ref or provider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-300 focus:ring-1 focus:ring-red-500 min-w-[120px]">
            <option value="all">All Statuses</option>
            {ASSESSMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <select value={filterTrigger} onChange={e => setFilterTrigger(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-300 focus:ring-1 focus:ring-red-500 min-w-[180px]">
            <option value="all">All Triggers</option>
            {TRIGGER_REASONS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>

          <select value={filterSubstitutability} onChange={e => setFilterSubstitutability(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-300 focus:ring-1 focus:ring-red-500 min-w-[160px]">
            <option value="all">All Substitutability</option>
            <option value="substitutable">Substitutable</option>
            <option value="not_substitutable">Not Substitutable</option>
            <option value="unassessed">Unassessed</option>
          </select>

          <select value={filterExitPlan} onChange={e => setFilterExitPlan(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-300 focus:ring-1 focus:ring-red-500 min-w-[150px]">
            <option value="all">All Exit Plans</option>
            <option value="defined">Exit Plan Defined</option>
            <option value="missing">Exit Plan Missing</option>
          </select>

          <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-300 focus:ring-1 focus:ring-red-500 min-w-[130px]">
            <option value="all">All Risk Levels</option>
            <option value="high risk">High Risk</option>
            <option value="medium risk">Medium Risk</option>
            <option value="low risk">Low Risk</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => { setFilterSubstitutability('all'); setFilterExitPlan('all'); setFilterRisk('all'); setFilterStatus('ACTIVE'); setFilterTrigger('all'); setSearch(''); }}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded-md border border-zinc-800 hover:bg-zinc-800 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        {filtered.length !== (assessments?.length ?? 0) && (
          <p className="text-xs text-zinc-500">Showing {filtered.length} of {assessments?.length ?? 0} assessments</p>
        )}
      </div>

      {/* Table — grouped by contract */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        {loadingAssessments ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
            <p className="text-zinc-500 text-sm">Loading assessments...</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm space-y-2">
            <ShieldAlert className="w-8 h-8 mx-auto text-zinc-700" />
            <p>No assessments match your filters.</p>
            {canWrite && <p className="text-xs text-zinc-600">Click "New Assessment" to start documenting risk for an ICT service arrangement.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {grouped.map(([contractId, { contractRef, items }]) => {
              const isCollapsed     = collapsedContracts.has(contractId);
              const activeCount     = items.filter(i => (i.assessmentStatus ?? 'ACTIVE') === 'ACTIVE').length;
              const historicalCount = items.length - activeCount;
              const hasHighRisk     = items.some(i => (i.assessmentStatus ?? 'ACTIVE') === 'ACTIVE' && deriveRiskLevel(i).label === 'High Risk');
              const hasOverdue      = items.some(i => reviewStatus(i.nextReviewDate, i.lastAuditDate).urgent);

              return (
                <div key={contractId}>
                  {/* Contract group header */}
                  <button
                    onClick={() => toggleContract(contractId)}
                    className="w-full flex items-center gap-3 px-5 py-3 bg-zinc-900/80 border-b border-zinc-800 text-left hover:bg-zinc-900 transition-colors"
                  >
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                      : <ChevronDown  className="w-4 h-4 text-zinc-500 shrink-0" />
                    }
                    <span className="text-sm font-semibold text-zinc-200">{contractRef}</span>
                    <span className="text-xs text-zinc-500">{activeCount} active</span>
                    {historicalCount > 0 && (
                      <span className="text-xs text-zinc-600">{historicalCount} historical</span>
                    )}
                    {items.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {items.length} assessments
                      </span>
                    )}
                    <div className="ml-auto flex gap-1.5">
                      {hasOverdue  && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">REVIEW DUE</span>}
                      {hasHighRisk && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">HIGH RISK</span>}
                    </div>
                  </button>

                  {/* Assessment rows */}
                  {!isCollapsed && (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-900/40 text-zinc-500 border-b border-zinc-800/60">
                        <tr>
                          <th className="px-5 py-2.5 font-medium text-xs">Provider</th>
                          <th className="px-4 py-2.5 font-medium text-xs">Trigger</th>
                          <th className="px-4 py-2.5 font-medium text-xs text-center">Status</th>
                          <th className="px-4 py-2.5 font-medium text-xs text-center">Risk</th>
                          <th className="px-4 py-2.5 font-medium text-xs text-center">Substitutability</th>
                          <th className="px-4 py-2.5 font-medium text-xs text-center">Exit Plan</th>
                          <th className="px-4 py-2.5 font-medium text-xs">Last Audit</th>
                          <th className="px-4 py-2.5 font-medium text-xs">Next Review</th>
                          <th className="px-4 py-2.5 font-medium text-xs text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {items.map((item) => {
                          const subBadge   = getSubstitutabilityBadge(item);
                          const riskLevel  = deriveRiskLevel(item);
                          const statusBadge= getStatusBadge(item.assessmentStatus);
                          const rs         = reviewStatus(item.nextReviewDate, item.lastAuditDate);
                          const isSuperseded = (item.assessmentStatus ?? 'ACTIVE') !== 'ACTIVE';

                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-zinc-900/40 transition-colors group ${isSuperseded ? 'opacity-50' : ''}`}
                            >
                              <td className="px-5 py-3.5 font-medium text-zinc-300">
                                {item.provider?.legalName || item.provider?.providerCode}
                                {item.createdAt && (
                                  <p className="text-[10px] text-zinc-600 mt-0.5">Created {formatDate(item.createdAt)}</p>
                                )}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                  <span className="text-base leading-none">{getTriggerIcon(item.triggerReason)}</span>
                                  <span className="truncate max-w-[120px]" title={getTriggerLabel(item.triggerReason)}>
                                    {getTriggerLabel(item.triggerReason)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${statusBadge.cls}`}>
                                  {statusBadge.label}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${riskLevel.cls}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${riskLevel.dot}`} />
                                  {riskLevel.label}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${subBadge.cls}`}>
                                  {subBadge.text}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${
                                  item.exitPlanExists
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                  {item.exitPlanExists ? 'Defined' : 'Missing'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-zinc-500 text-sm">
                                {formatDate(item.lastAuditDate)}
                              </td>
                              <td className="px-4 py-3.5">
                                <ReviewDueBadge nextReview={item.nextReviewDate} lastAudit={item.lastAuditDate} />
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {/* Editor: View only */}
                                  {isEditor && (
                                    <button onClick={() => openEditDialog(item, true)} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-md transition-colors" title="View details">
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  )}
                                  {/* Analyst: View + Edit */}
                                  {isAnalyst && (
                                    <>
                                      <button onClick={() => openEditDialog(item, true)} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-md transition-colors" title="View details">
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => openEditDialog(item, false)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors" title="Edit assessment">
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                  {/* Admin: Edit + Delete */}
                                  {isAdmin && (
                                    <>
                                      <button onClick={() => openEditDialog(item, false)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors" title="Edit assessment">
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => { if (confirm('Delete this assessment?')) deleteMutation.mutate(item.id); }} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog — create/edit/view */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) { setViewOnly(false); setEditingId(null); reset(); }
      }}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewOnly ? <Eye className="w-5 h-5 text-indigo-400" /> : <ShieldAlert className="w-5 h-5 text-red-500" />}
              {viewOnly ? 'View Assessment' : editingId ? 'Edit Assessment' : 'New Risk Assessment'}
            </DialogTitle>
            {viewOnly && (
              <p className="text-xs text-zinc-500">Read-only view.</p>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <fieldset disabled={viewOnly} className="contents">

              {/* 0. Workflow Context */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-indigo-400 border-b border-zinc-800 pb-2 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Assessment Trigger &amp; Status
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">
                      Reason for this assessment <span className="text-red-500">*</span>
                    </label>
                    <select {...register('triggerReason')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-indigo-500">
                      <option value="">Select trigger reason...</option>
                      {TRIGGER_REASONS.map(t => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                    {errors.triggerReason && <p className="text-red-400 text-xs">{errors.triggerReason.message}</p>}
                    <InfoHint>
                      Recording why this assessment was initiated creates an auditable history and satisfies DORA Art. 28§5 documentation requirements.
                    </InfoHint>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Assessment Status</label>
                    <select {...register('assessmentStatus')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-indigo-500">
                      {ASSESSMENT_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <InfoHint>
                      Mark older assessments as "Superseded" when a newer one replaces them for the same contract.
                    </InfoHint>
                  </div>
                </div>
              </div>

              {/* 1. Service Overview */}
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-3 border-b border-zinc-800 pb-2">1. Service Overview</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Contractual Arrangement <span className="text-red-500">*</span></label>
                    <select {...register('contractId')} disabled={!!editingId || viewOnly}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-red-500 disabled:opacity-50">
                      <option value="">Select contract...</option>
                      {contracts?.map(c => (
                        <option key={c.id} value={c.id}>{c.contractReference} — {c.provider?.legalName || c.provider?.providerCode}</option>
                      ))}
                    </select>
                    {errors.contractId && <p className="text-red-400 text-xs">{errors.contractId.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">ICT Provider <span className="text-red-500">*</span></label>
                    <select {...register('providerId')} disabled={!!editingId || viewOnly}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-red-500 disabled:opacity-50">
                      <option value="">Select provider...</option>
                      {providers?.map(p => (
                        <option key={p.id} value={p.id}>{p.providerCode} — {p.legalName}</option>
                      ))}
                    </select>
                    {errors.providerId && <p className="text-red-400 text-xs">{errors.providerId.message}</p>}
                  </div>
                </div>
              </div>

              {/* 2. Audit Dates */}
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-3 border-b border-zinc-800 pb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> 2. Audit &amp; Review Schedule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Last Audit Date</label>
                    <input type="date" {...register('lastAuditDate')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-red-500"
                    />
                    {watchLastAudit && !viewOnly && (
                      <button type="button" onClick={suggestNextReview}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Auto-set next review (+1 year)
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Next Review Date</label>
                    <input type="date" {...register('nextReviewDate')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-red-500"
                    />
                    <InfoHint>
                      DORA recommends annual reassessment for critical ICT services. Overdue reviews will surface in the dashboard.
                    </InfoHint>
                  </div>
                </div>
              </div>

              {/* 3. Substitutability */}
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-3 border-b border-zinc-800 pb-2">
                  3. Substitutability Assessment
                  <span className="text-xs text-zinc-500 font-normal ml-2">DORA Art. 28§5(a)</span>
                </h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Can this ICT service be substituted?</label>
                  <select {...register('substitutabilityLevel')}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-red-500">
                    {SUBSTITUTABILITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {watchSubstitutability === 'not_substitutable' && (
                  <div className="space-y-2 mt-3">
                    <label className="text-sm font-medium text-zinc-300">Justification <span className="text-red-500">*</span></label>
                    <textarea {...register('substitutionReason')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm min-h-[80px] focus:ring-1 focus:ring-red-500"
                      placeholder="Explain why this service cannot be substituted..." />
                    <WarningBanner>DORA Art. 28§5 requires documented justification when an ICT service is not substitutable.</WarningBanner>
                  </div>
                )}
                {watchSubstitutability === 'partially' && (
                  <div className="space-y-2 mt-3">
                    <label className="text-sm font-medium text-zinc-300">Partial Substitution Details</label>
                    <textarea {...register('substitutionReason')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm min-h-[60px] focus:ring-1 focus:ring-red-500"
                      placeholder="Describe which parts can be substituted and which cannot..." />
                  </div>
                )}
              </div>

              {/* 4. Exit Strategy */}
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-3 border-b border-zinc-800 pb-2">
                  4. Exit Strategy <span className="text-xs text-zinc-500 font-normal ml-2">DORA Art. 28§8</span>
                </h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Is an exit strategy defined?</label>
                  <select {...register('exitStrategyRequired')}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-red-500">
                    <option value="">Select...</option>
                    <option value="yes">Yes — exit strategy exists</option>
                    <option value="no">No — no exit strategy defined</option>
                  </select>
                </div>
                {watchExitRequired === 'no' && (
                  <WarningBanner>DORA Art. 28§8 requires exit strategies for critical ICT services. Missing plans will be flagged during validation.</WarningBanner>
                )}
                {watchExitRequired === 'yes' && (
                  <div className="mt-3 flex items-center gap-3">
                    <input type="checkbox" {...register('reintegrationPossible')} className="w-4 h-4 rounded bg-zinc-900 border-zinc-800 text-red-600 focus:ring-red-500" />
                    <label className="text-sm text-zinc-300">Reintegration of the service is possible after exit</label>
                  </div>
                )}
              </div>

              {/* 5. Alternative Providers */}
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-3 border-b border-zinc-800 pb-2">
                  5. Alternative Providers <span className="text-xs text-zinc-500 font-normal ml-2">DORA Art. 28§5(b)</span>
                </h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Is an alternative ICT provider available?</label>
                  <select {...register('hasAlternativeProvider')}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-red-500">
                    <option value="">Select...</option>
                    <option value="yes">Yes — alternative provider identified</option>
                    <option value="no">No — single provider dependency</option>
                  </select>
                </div>
                {watchHasAlternative === 'yes' && (
                  <div className="space-y-2 mt-3">
                    <label className="text-sm font-medium text-zinc-300">Alternative Provider</label>
                    <select {...register('alternativeProviderReference')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:ring-1 focus:ring-red-500">
                      <option value="">Select alternative provider...</option>
                      {providers?.map(p => (
                        <option key={p.id} value={`${p.providerCode} - ${p.legalName}`}>{p.providerCode} — {p.legalName}</option>
                      ))}
                    </select>
                  </div>
                )}
                {watchHasAlternative === 'no' && (
                  <WarningBanner>Single provider dependency detected. DORA Art. 29 requires supervisory notification.</WarningBanner>
                )}
              </div>

              {/* 6. Risk Impact */}
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-3 border-b border-zinc-800 pb-2">6. Risk Impact Assessment</h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Impact of Discontinuation</label>
                  <textarea {...register('discontinuationImpact')}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm min-h-[80px] focus:ring-1 focus:ring-red-500"
                    placeholder="Describe the operational impact if this ICT service were to be suddenly discontinued..." />
                  <InfoHint>Consider impact on business functions, data availability, regulatory obligations, and customer service.</InfoHint>
                </div>
              </div>

            </fieldset>

            <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-zinc-950/90 py-4 backdrop-blur-sm border-t border-zinc-800">
              <button type="button" onClick={() => { setIsDialogOpen(false); setViewOnly(false); setEditingId(null); reset(); }}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
                {viewOnly ? 'Close' : 'Cancel'}
              </button>
              {!viewOnly && (
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2">
                  {createMutation.isPending || updateMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : editingId ? 'Save Changes' : 'Create Assessment'}
                </button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
