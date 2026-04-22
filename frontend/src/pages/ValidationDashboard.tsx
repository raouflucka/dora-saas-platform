import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { validationApi, type ValidationRunSummary, type ValidationResult } from '../api/validation';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Play,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Clock,
  ChevronDown,
  ChevronRight,
  XCircle,
  BookOpen,
  ExternalLink,
  Lightbulb,
  Flag,
  X,
  Activity,
  Eye,
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

// Template labels removed, handled through error categories natively
// — Module ownership helper — determines whether a frontendRoute belongs to an Analyst or Editor module
function isAnalystOwnedRoute(route?: string | null): boolean {
  if (!route) return false;
  return route.includes('/assessments') || route.includes('/supply-chain');
}

const SEVERITY_CONFIG = {
  ERROR: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Error' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Warning' },
  INFO: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Info' },
};

/** All 11 EBA ITS templates covered by the 108-rule seeder (as at Session 12) */
const EBA_TEMPLATES = [
  { code: 'RT.01.01', label: 'Entity Maintaining Register',      description: 'LEI, name, country, type, integration date',            rules: 11, doraArticle: 'Art.28(1)' },
  { code: 'RT.01.02', label: 'Entities in Scope of Register',   description: 'All financial entities required to report',              rules: 7,  doraArticle: 'Art.28(1)' },
  { code: 'RT.01.03', label: 'Branches',                        description: 'Branch code, country, parent entity linkage',            rules: 6,  doraArticle: 'Art.28(1)' },
  { code: 'RT.02.01', label: 'Contracts — General',             description: 'Contract reference, type, dates, cost, currency',       rules: 9,  doraArticle: 'Art.30(1)' },
  { code: 'RT.02.02', label: 'Contracts — Service Details',     description: 'Criticality, reliance, storage, subcontractor linkage',  rules: 18, doraArticle: 'Art.30(2)' },
  { code: 'RT.05',    label: 'ICT Services Catalogue',          description: 'Service type, provider link, business function coverage', rules: 9,  doraArticle: 'Art.28(3)' },
  { code: 'RT.05.01', label: 'ICT Third-Party Providers',       description: 'Provider LEI, legal name, headquarters, NACE code',     rules: 13, doraArticle: 'Art.28(1)' },
  { code: 'RT.05.02', label: 'ICT Supply Chain',                description: 'Subcontractor chain, supply rank, parent linkage',       rules: 5,  doraArticle: 'Art.28(3)' },
  { code: 'RT.06.01', label: 'Business Functions',              description: 'Function identifier, criticality, RTO/RPO targets',      rules: 12, doraArticle: 'Art.28(5)' },
  { code: 'RT.07.01', label: 'ICT Service Assessments',         description: 'Substitutability, exit plan, discontinuation impact',   rules: 12, doraArticle: 'Art.28(5)' },
  { code: 'RT.08',    label: 'Exit Strategies',                 description: 'Exit trigger, strategy, fallback provider, feasibility', rules: 6,  doraArticle: 'Art.28(8)' },
] as const;

const VALIDATION_CATEGORIES = [
  { name: 'Completeness Errors', description: 'Checking for missing mandatory fields required by EBA Templates.' },
  { name: 'Format Errors', description: 'Checking data formats — LEI codes must be exactly 20 characters; dates use YYYY-MM-DD.' },
  { name: 'Consistency Errors', description: 'Checking that values match standardized EBA codelists (e.g., ISO countries).' },
  { name: 'Referential Integrity', description: 'Checking that referenced entities (e.g. Subcontractors) actually exist in the Register.' },
  { name: 'Uniqueness Errors', description: 'Checking for duplicate identifiers (LEI, Contract Refs) to ensure uniqueness.' },
];


function SeverityBadge({ severity }: { severity: 'ERROR' | 'WARNING' | 'INFO' }) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function ScoreCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-100">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: 'OPEN' | 'FLAGGED' | 'FIXED' | 'WAITING_APPROVAL' | 'RESOLVED' | 'REJECTED' }) {
  if (status === 'FIXED')    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-green-500/10 text-green-400 border border-green-500/20"><CheckCircle2 className="w-3 h-3" /> Fixed</span>;
  if (status === 'RESOLVED') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20"><CheckCircle2 className="w-3 h-3" /> Resolved</span>;
  if (status === 'WAITING_APPROVAL') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Clock className="w-3 h-3" /> Awaiting Analyst</span>;
  if (status === 'FLAGGED') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20"><Flag className="w-3 h-3" /> Flagged</span>;
  if (status === 'REJECTED') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3 h-3" /> Rejected</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"><Clock className="w-3 h-3" /> Open</span>;
}


// — Inline Flag Modal —
function FlagModal({ item, onSubmit, onCancel }: {
  item: ValidationResult;
  onSubmit: (ruleId: string, recordId: string, comment: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Flag className="w-4 h-4 text-indigo-400" /> Flag Issue for Editor</h3>
            <p className="text-xs text-zinc-400 mt-1">Add an instruction for the Editor who will fix this.</p>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>

        {/* Issue summary */}
        <div className="bg-zinc-800/60 rounded-lg p-3 mb-4 space-y-1 text-xs">
          <p><span className="text-zinc-500">Field:</span> <span className="text-zinc-200 font-mono">{item.fieldName}</span></p>
          {item.entityName && <p><span className="text-zinc-500">Record:</span> <span className="text-zinc-200">{item.entityName}</span></p>}
          <p><span className="text-zinc-500">Issue:</span> <span className="text-zinc-300">{item.message}</span></p>
        </div>

        <label className="block text-xs font-medium text-zinc-400 mb-1">Instructions for Editor <span className="text-zinc-600">(optional)</span></label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          placeholder="e.g. Get the LEI code from Legal team, should be in contract folder."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={() => onSubmit(item.ruleId, item.recordId || '', comment)}
            className="text-xs px-4 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 font-semibold transition-colors flex items-center gap-1.5"
          >
            <Flag className="w-3 h-3" /> Flag Issue
          </button>
        </div>
      </div>
    </div>
  );
}

// — Inline Resolve Modal (Editor) —
function ResolveModal({ item, onSubmit, onCancel }: {
  item: ValidationResult;
  onSubmit: (ruleId: string, recordId: string, note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Submit Fix for Review</h3>
            <p className="text-xs text-zinc-400 mt-1">Briefly explain how you fixed this issue.</p>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-zinc-800/60 rounded-lg p-3 mb-4 space-y-1 text-xs">
          <p><span className="text-zinc-500">Field:</span> <span className="text-zinc-200 font-mono">{item.fieldName}</span></p>
          {item.entityName && <p><span className="text-zinc-500">Record:</span> <span className="text-zinc-200">{item.entityName}</span></p>}
        </div>

        <label className="block text-xs font-medium text-zinc-400 mb-1">Resolution Note <span className="text-zinc-600">(optional)</span></label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Updated LEI code to new 20-character format."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={() => onSubmit(item.ruleId, item.recordId || '', note)}
            className="text-xs px-4 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-semibold transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3 h-3" /> Submit Fix
          </button>
        </div>
      </div>
    </div>
  );
}

// — Inline Reject Modal (Analyst) —
function RejectModal({ item, onSubmit, onCancel }: {
  item: ValidationResult;
  onSubmit: (ruleId: string, recordId: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><XCircle className="w-4 h-4 text-rose-400" /> Reject Editor Fix</h3>
            <p className="text-xs text-zinc-400 mt-1">Explain why this fix is insufficient.</p>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-zinc-800/60 rounded-lg p-3 mb-4 space-y-1 text-xs">
          <p><span className="text-zinc-500">Field:</span> <span className="text-zinc-200 font-mono">{item.fieldName}</span></p>
          {item.entityName && <p><span className="text-zinc-500">Record:</span> <span className="text-zinc-200">{item.entityName}</span></p>}
        </div>

        <label className="block text-xs font-medium text-zinc-400 mb-1">Rejection Reason <span className="text-rose-400">*</span></label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. This still fails VR_45. Cost cannot be empty."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500 resize-none"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={() => onSubmit(item.ruleId, item.recordId || '', reason)}
            disabled={!reason.trim()}
            className="text-xs px-4 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-500 font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <XCircle className="w-3 h-3" /> Reject Fix
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultsTable({ results, isAnalyst, isEditor, onFlag, onResolve, onApprove, onReject, latestRunId }: {
  results: ValidationResult[];
  isAnalyst: boolean;
  isEditor: boolean;
  latestRunId?: string;
  onFlag: (ruleId: string, recordId: string, comment: string) => void;
  onResolve: (ruleId: string, recordId: string, note: string) => void;
  onApprove: (ruleId: string, recordId: string) => void;
  onReject: (ruleId: string, recordId: string, reason: string) => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [flagging, setFlagging] = useState<ValidationResult | null>(null);
  const [resolving, setResolving] = useState<ValidationResult | null>(null);
  const [rejecting, setRejecting] = useState<ValidationResult | null>(null);

  // Group by Error Category
  const grouped: Record<string, ValidationResult[]> = {};
  results.forEach(r => {
    const key = r.errorCategory || 'Other Errors';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  // Initialize expanded state once, expanding groups with errors
  const groupKeys = Object.keys(grouped);
  const [initialized, setInitialized] = useState(false);
  if (!initialized && groupKeys.length > 0) {
    const init: Record<string, boolean> = {};
    groupKeys.forEach(k => { init[k] = grouped[k].some(i => i.severity === 'ERROR'); });
    setExpanded(init);
    setInitialized(true);
  }

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (results.length === 0) {
    const totalRules = EBA_TEMPLATES.reduce((s, t) => s + t.rules, 0);
    return (
      <div className="space-y-5">
        {/* All-clear banner */}
        <div className="flex items-center gap-4 p-5 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-green-300">All Validations Passed</p>
            <p className="text-sm text-green-500 mt-0.5">
              {totalRules} EBA rules checked across {EBA_TEMPLATES.length} templates — zero errors or warnings detected.
            </p>
          </div>
        </div>

        {/* Per-template breakdown */}
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Templates Validated</h3>
          {EBA_TEMPLATES.map(t => (
            <div key={t.code} className="flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors group">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-indigo-400">{t.code}</span>
                    <span className="text-sm font-medium text-zinc-200">{t.label}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] text-zinc-600 hidden group-hover:inline">{t.doraArticle}</span>
                <span className="text-xs text-zinc-600">{t.rules} rules</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 whitespace-nowrap">
                  ✓ No issues
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Per-Category breakdown */}
        <div className="space-y-1 mt-6">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Validation Categories Checked</h3>
          {VALIDATION_CATEGORIES.map(c => (
            <div key={c.name} className="flex items-center justify-between px-4 py-3 rounded-lg bg-green-500/5 border border-green-500/10 hover:border-green-500/20 transition-colors">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-zinc-300">{c.name}</div>
                  <p className="text-xs text-zinc-500 mt-0.5">{c.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 whitespace-nowrap">
                  ✓ No issues found
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-zinc-600 text-center pt-1">
          Data meets all mandatory EBA ITS requirements and is ready for Register of Information export.
        </p>
      </div>
    );
  }

  return (
    <>
      {flagging && (
        <FlagModal
          item={flagging}
          onSubmit={(ruleId, recordId, comment) => { onFlag(ruleId, recordId, comment); setFlagging(null); }}
          onCancel={() => setFlagging(null)}
        />
      )}
      {resolving && (
        <ResolveModal
          item={resolving}
          onSubmit={(ruleId, recordId, note) => { onResolve(ruleId, recordId, note); setResolving(null); }}
          onCancel={() => setResolving(null)}
        />
      )}
      {rejecting && (
        <RejectModal
          item={rejecting}
          onSubmit={(ruleId, recordId, reason) => { onReject(ruleId, recordId, reason); setRejecting(null); }}
          onCancel={() => setRejecting(null)}
        />
      )}
      <div className="space-y-3">
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => {
          const errorCount = items.filter(i => i.severity === 'ERROR').length;
          const warnCount = items.filter(i => i.severity === 'WARNING').length;
          return (
            <div key={category} className="border border-zinc-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggle(category)}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/80 hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expanded[category] ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                  <span className="text-sm font-semibold text-zinc-200">{category}</span>
                  {errorCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                      {errorCount} errors
                    </span>
                  )}
                  {warnCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {warnCount} warnings
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-600">{items.length} issues</span>
              </button>

              {expanded[category] && (
                <div className="divide-y divide-zinc-800/50">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`px-4 py-3 transition-colors ${
                        item.status === 'FIXED' ? 'bg-green-500/5' :
                        item.status === 'FLAGGED' ? 'bg-purple-500/5' :
                        item.severity === 'ERROR' ? 'hover:bg-red-500/5' : 'hover:bg-zinc-900/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={item.status} />
                          <SeverityBadge severity={item.severity} />
                          {item.entityName && (
                            <span className="text-xs font-medium text-zinc-300 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700">
                              {item.entityName}
                            </span>
                          )}
                          <span className="text-xs text-zinc-500 font-mono">{item.templateName}</span>
                          <span className="text-xs text-zinc-400">&mdash; Field: <span className="font-mono text-zinc-300">{item.fieldName}</span></span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Go to Record — deep-link opens the exact record and the edit dialog */}
                          {item.frontendRoute && item.status !== 'FIXED' && (
                            <button
                              onClick={() => navigate(item.frontendRoute!)}
                              className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                              title="Open the exact record and auto-open the edit form"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open Record
                            </button>
                          )}
                          {/* Smart Analyst Action: Flag to Editor OR Go and Fix */}
                          {isAnalyst && (item.status === 'OPEN' || item.status === 'FLAGGED' || item.status === 'REJECTED') && (
                            isAnalystOwnedRoute(item.frontendRoute) ? (
                              // Analyst-owned module: navigate directly to fix it
                              <button
                                onClick={() => {
                                  const base = item.frontendRoute!;
                                  const sep = base.includes('?') ? '&' : '?';
                                  navigate(`${base}${sep}runId=${encodeURIComponent(latestRunId || '')}&ruleId=${encodeURIComponent(item.ruleId)}&recordId=${encodeURIComponent(item.recordId || '')}`);
                                }}
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded transition-colors bg-teal-600/20 text-teal-400 border border-teal-500/30 hover:bg-teal-600 hover:text-white"
                                title="This module is Analyst-owned — navigate to fix it directly"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Go and Fix
                              </button>
                            ) : (
                              // Editor-owned module: flag for Editor to fix
                              <button
                                onClick={() => item.status === 'FLAGGED'
                                  ? onFlag(item.ruleId, item.recordId || '', '')
                                  : setFlagging(item)
                                }
                                className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                                  item.status === 'FLAGGED'
                                    ? 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                                    : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white'
                                }`}
                              >
                                <Flag className="w-3 h-3" />
                                {item.status === 'FLAGGED' ? 'Unflag' : 'Flag to Editor'}
                              </button>
                            )
                          )}

                          {/* Submit Fix (Editor) */}
                          {isEditor && (item.status === 'OPEN' || item.status === 'FLAGGED' || item.status === 'REJECTED') && (
                            <button
                              onClick={() => setResolving(item)}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded transition-colors bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Mark as Fixed
                            </button>
                          )}

                          {/* Approve / Reject (Analyst) */}
                          {isAnalyst && item.status === 'WAITING_APPROVAL' && (
                            <>
                              <button
                                onClick={() => onApprove(item.ruleId, item.recordId || '')}
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded transition-colors bg-teal-600/20 text-teal-400 border border-teal-500/30 hover:bg-teal-600 hover:text-white"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Approve Fix
                              </button>
                              <button
                                onClick={() => setRejecting(item)}
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded transition-colors bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white"
                              >
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Error message and Invalid Value */}
                      <div className="mt-2 text-sm text-zinc-200">
                        {item.message}
                        {item.invalidValue && (
                          <div className="mt-1.5 text-xs">
                            <span className="text-zinc-500">Invalid Value Detected: </span>
                            <span className="font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                              {item.invalidValue}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Analyst flag comment — visible to Editors */}
                      {item.flagComment && (
                        <div className="mt-2 flex items-start gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                          <Flag className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-purple-400 tracking-wide mb-0.5">Analyst Instruction / Context</p>
                            <p className="text-xs text-purple-200">{item.flagComment}</p>
                          </div>
                        </div>
                      )}

                      {/* Audit Diff for Analyst Review */}
                      {item.status === 'WAITING_APPROVAL' && isAnalyst && (
                        <div className="mt-3 bg-zinc-900 border border-zinc-700/50 rounded-lg p-3">
                          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wide mb-2 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Audit Diff
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
                              <p className="text-[10px] text-zinc-500 mb-0.5">Previous Value (Violating)</p>
                              <p className="text-xs font-mono text-red-400 break-all">{item.invalidValue || '—'}</p>
                            </div>
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2">
                              <p className="text-[10px] text-zinc-500 mb-0.5">Updated Value (Current DB)</p>
                              <p className="text-xs font-mono text-emerald-400 break-all">{item.newValue || '—'}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Editor Resolution Note */}
                      {item.editorNote && (
                        <div className="mt-2 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wide mb-0.5">Editor Note</p>
                            <p className="text-xs text-emerald-200">{item.editorNote}</p>
                          </div>
                        </div>
                      )}

                      {/* Suggested action + DORA context */}
                      {(item.status === 'OPEN' || item.status === 'FLAGGED' || item.status === 'REJECTED') && (
                        <div className="mt-2 flex flex-col sm:flex-row gap-2">
                          {item.suggestedAction && (
                            <div className="flex items-start gap-1.5 text-xs text-teal-400 bg-teal-500/10 px-2.5 py-1.5 rounded border border-teal-500/20 flex-1">
                              <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                              <span><strong>Fix:</strong> {item.suggestedAction}</span>
                            </div>
                          )}
                          {item.doraArticle && (
                            <div className="flex items-start gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1.5 rounded border border-indigo-500/20 flex-1">
                              <BookOpen className="w-3 h-3 mt-0.5 shrink-0" />
                              <span><strong>Regulatory Mapping:</strong> Required by <strong>{item.doraArticle}</strong>.</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* FIXED confirmation */}
                      {item.status === 'FIXED' && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Issue resolved — detected in the latest validation run.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </>
  );
}


export default function ValidationDashboard() {
  const { user } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [lastRun, setLastRun] = useState<ValidationRunSummary | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const canRun = user?.role === 'ANALYST'; // Admin must be strictly read-only

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['validation-runs'],
    queryFn: validationApi.getRunHistory,
  });

  const { data: selectedRun } = useQuery({
    queryKey: ['validation-run', selectedRunId],
    queryFn: () => validationApi.getRunById(selectedRunId!),
    enabled: !!selectedRunId,
  });

  useEffect(() => {
    if (user?.role === 'ADMIN' && !selectedRunId && !lastRun && history && history.length > 0) {
      setSelectedRunId(history[0].id);
    }
  }, [user?.role, selectedRunId, lastRun, history]);

  const [globalError, setGlobalError] = useState<string | null>(null);

  const runMutation = useMutation({
    mutationFn: validationApi.runValidation,
    onSuccess: (data) => {
      setLastRun(data);
      setSelectedRunId(null);
      setGlobalError(null);
      queryClient.invalidateQueries({ queryKey: ['validation-runs'] });
    },
    onError: (error: any) => {
      setGlobalError(error.response?.data?.message || error.message || 'Internal error during validation run.');
    }
  });

  const flagMutation = useMutation({
    mutationFn: ({ runId, ruleId, recordId, comment }: { runId: string, ruleId: string, recordId: string, comment?: string }) =>
      validationApi.flagIssue(runId, ruleId, recordId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-runs'] });
      if (selectedRunId) queryClient.invalidateQueries({ queryKey: ['validation-run', selectedRunId] });
      else runMutation.mutate();
      toast.success('Issue flagged for Editor.');
    }
  });

  const resolveMutation = useMutation({
    mutationFn: ({ runId, ruleId, recordId, note }: { runId: string, ruleId: string, recordId: string, note?: string }) =>
      validationApi.resolveIssue(runId, ruleId, recordId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-runs'] });
      if (selectedRunId) queryClient.invalidateQueries({ queryKey: ['validation-run', selectedRunId] });
      else runMutation.mutate();
      toast.success('Fix submitted for Analyst approval.');
    }
  });

  const approveMutation = useMutation({
    mutationFn: ({ runId, ruleId, recordId }: { runId: string, ruleId: string, recordId: string }) =>
      validationApi.approveIssue(runId, ruleId, recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-runs'] });
      if (selectedRunId) queryClient.invalidateQueries({ queryKey: ['validation-run', selectedRunId] });
      else runMutation.mutate();
      toast.success('Fix approved and marked as resolved.');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ runId, ruleId, recordId, reason }: { runId: string, ruleId: string, recordId: string, reason?: string }) =>
      validationApi.rejectIssue(runId, ruleId, recordId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-runs'] });
      if (selectedRunId) queryClient.invalidateQueries({ queryKey: ['validation-run', selectedRunId] });
      else runMutation.mutate();
      toast.warning('Fix rejected and sent back to Editor.');
    }
  });

  const handleFlag = (ruleId: string, recordId: string, comment?: string) => {
    const rId = lastRun?.runId || selectedRun?.id;
    if (rId) flagMutation.mutate({ runId: rId, ruleId, recordId, comment });
  };

  const handleResolve = (ruleId: string, recordId: string, note: string) => {
    const rId = lastRun?.runId || selectedRun?.id;
    if (rId) resolveMutation.mutate({ runId: rId, ruleId, recordId, note });
  };

  const handleApprove = (ruleId: string, recordId: string) => {
    const rId = lastRun?.runId || selectedRun?.id;
    if (rId) approveMutation.mutate({ runId: rId, ruleId, recordId });
  };

  const handleReject = (ruleId: string, recordId: string, reason: string) => {
    const rId = lastRun?.runId || selectedRun?.id;
    if (rId) rejectMutation.mutate({ runId: rId, ruleId, recordId, reason });
  };

  const activeResults = lastRun?.results || (selectedRun?.results as ValidationResult[]) || [];
  const activeErrors = lastRun?.totalErrors ?? selectedRun?.totalErrors ?? 0;
  const activeWarnings = lastRun?.totalWarnings ?? selectedRun?.totalWarnings ?? 0;
  const activeInfo = lastRun?.totalInfo ?? selectedRun?.totalInfo ?? 0;
  const hasActiveRun = !!lastRun || !!selectedRun;

  // Derived counts for workflow state
  const pendingReviewCount = activeResults.filter(r => r.status === 'WAITING_APPROVAL').length;
  const _flaggedCount = activeResults.filter(r => r.status === 'FLAGGED').length;
  const waitingApprovalItems = activeResults.filter(r => r.status === 'WAITING_APPROVAL');
  const [approvalPanelOpen, setApprovalPanelOpen] = useState(true);
  const [rejectingItem, setRejectingItem] = useState<{ruleId: string; recordId: string} | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            Validation Engine
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            EBA ITS validation rules — verify data quality before RoI export (DORA Art. 28§14).
          </p>
        </div>

        {canRun && (
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-md font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {runMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running validation...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Validation
              </>
            )}
          </button>
        )}
      </div>

      {/* Admin read-only preflight notice */}
      {user?.role === 'ADMIN' && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Eye className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-300">Preflight Read-Only View</p>
            <p className="text-xs text-blue-400/80 mt-1">
              As Admin, you can view validation results and error counts for oversight purposes.
              Flagging issues, editing records, and approving fixes are performed by Analysts and Editors.
            </p>
          </div>
        </div>
      )}

      {/* Latest Run Status Strip — visible at a glance without selecting a run */}
      {!hasActiveRun && history && history.length > 0 && (() => {
        const latest = history[0];
        const isClean = latest.totalErrors === 0;
        return (
          <div
            className={`rounded-xl border px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 cursor-pointer transition-colors ${
              isClean
                ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
            }`}
            onClick={() => { setSelectedRunId(latest.id); setLastRun(null); }}
            title="Click to load this run"
          >
            <div className="flex items-center gap-2">
              {isClean
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : <XCircle className="w-4 h-4 text-red-400" />
              }
              <span className={`text-sm font-semibold ${isClean ? 'text-emerald-300' : 'text-red-300'}`}>
                {isClean ? 'Latest Run: All Clear' : `Latest Run: ${latest.totalErrors} Error${latest.totalErrors !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              {latest.totalWarnings > 0 && (
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="w-3 h-3" /> {latest.totalWarnings} warnings
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(latest.executedAt).toLocaleString()}
              </span>
              <span className={`font-medium ${isClean ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {isClean ? '✓ Export Ready' : '✗ Export Blocked'}
              </span>
            </div>
            <span className="ml-auto text-xs text-zinc-600 hidden sm:block">Click to view details →</span>
          </div>
        );
      })()}

      {/* Global Error Banner */}
      {globalError && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">Validation Run Failed</p>
            <p className="text-xs text-red-400 mt-1">{globalError}</p>
          </div>
        </div>
      )}

      {/* Score Cards */}
      {hasActiveRun && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <ScoreCard
            label="Total Issues"
            value={activeErrors + activeWarnings + activeInfo}
            icon={AlertCircle}
            color="bg-zinc-800 text-zinc-300"
          />
          <ScoreCard label="Errors" value={activeErrors} icon={XCircle} color="bg-red-500/10 text-red-400" />
          <ScoreCard label="Warnings" value={activeWarnings} icon={AlertTriangle} color="bg-amber-500/10 text-amber-400" />
          <ScoreCard label="Pending Review" value={pendingReviewCount} icon={Clock} color="bg-indigo-500/10 text-indigo-400" />
          <ScoreCard
            label="Export Ready"
            value={activeErrors === 0 ? 1 : 0}
            icon={activeErrors === 0 ? CheckCircle2 : XCircle}
            color={activeErrors === 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}
          />
        </div>
      )}

      {/* Analyst "Needs Your Approval" queue — shown immediately above results */}
      {hasActiveRun && user?.role === 'ANALYST' && waitingApprovalItems.length > 0 && (
        <div className="bg-zinc-950 border border-indigo-500/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setApprovalPanelOpen(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              {approvalPanelOpen ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4 text-indigo-400" />}
              <Clock className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-indigo-300">Needs Your Approval</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {waitingApprovalItems.length} pending
              </span>
            </div>
            <span className="text-xs text-zinc-500">Editor submitted fixes — review before re-running validation</span>
          </button>

          {approvalPanelOpen && (
            <div className="divide-y divide-zinc-800/50">
              {waitingApprovalItems.map((item, idx) => (
                <div key={idx} className="px-4 py-4 bg-zinc-900/30">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      {/* Identity row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge status="WAITING_APPROVAL" />
                        <SeverityBadge severity={item.severity} />
                        {item.entityName && (
                          <span className="text-xs font-medium text-zinc-300 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700">
                            {item.entityName}
                          </span>
                        )}
                        <span className="text-xs text-zinc-500 font-mono">{item.templateName}</span>
                        <span className="text-xs text-zinc-400">&mdash; Field: <span className="font-mono text-zinc-300">{item.fieldName}</span></span>
                      </div>
                      <p className="text-sm text-zinc-200 mb-2">{item.message}</p>

                      {/* Before / After diff */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5">
                          <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">Previous Value (Violating)</p>
                          <p className="text-xs font-mono text-red-400 break-all">{item.invalidValue || '—'}</p>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5">
                          <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">Updated Value (Current DB)</p>
                          <p className="text-xs font-mono text-emerald-400 break-all">{item.newValue || '—'}</p>
                        </div>
                      </div>

                      {/* Editor's note */}
                      {item.editorNote && (
                        <div className="mt-2 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded px-2.5 py-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wide">Editor Note</p>
                            <p className="text-xs text-emerald-200">{item.editorNote}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Approve / Reject actions */}
                    <div className="flex flex-col gap-2 shrink-0 min-w-[130px]">
                      <button
                        onClick={() => handleApprove(item.ruleId, item.recordId || '')}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded transition-colors bg-teal-600/20 text-teal-400 border border-teal-500/30 hover:bg-teal-600 hover:text-white"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Approve Fix
                      </button>

                      {rejectingItem?.ruleId === item.ruleId && rejectingItem?.recordId === (item.recordId || '') ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            rows={2}
                            placeholder="Reason for rejection..."
                            className="w-full bg-zinc-950 border border-rose-500/30 rounded px-2 py-1 text-xs text-zinc-100 resize-none focus:outline-none focus:border-rose-500"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                handleReject(item.ruleId, item.recordId || '', rejectReason || 'Fix needs revision.');
                                setRejectingItem(null);
                                setRejectReason('');
                              }}
                              disabled={!rejectReason.trim()}
                              className="flex-1 text-xs font-semibold px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Confirm Reject
                            </button>
                            <button
                              onClick={() => { setRejectingItem(null); setRejectReason(''); }}
                              className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRejectingItem({ ruleId: item.ruleId, recordId: item.recordId || '' })}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded transition-colors bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pre-flight gate */}
      {hasActiveRun && activeErrors > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">RoI Export Blocked</p>
            <p className="text-xs text-red-400 mt-1">
              {activeErrors} error(s) must be resolved before exporting the Register of Information. Fix the issues below and re-run validation.
            </p>
          </div>
        </div>
      )}

      {hasActiveRun && activeErrors === 0 && (
        <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-300">Data Validated Successfully</p>
            <p className="text-xs text-green-400 mt-1">
              All mandatory EBA checks passed. {activeWarnings > 0 ? `${activeWarnings} warning(s) remain — review recommended but not blocking.` : 'No warnings. Data is fully export-ready.'}
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {hasActiveRun && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">
            {lastRun ? 'Latest Run Results' : 'Run Results'}
            {lastRun && <span className="text-xs text-zinc-500 ml-2 font-normal">{new Date(lastRun.executedAt).toLocaleString()}</span>}
          </h2>
          <ResultsTable
            results={activeResults}
            isAnalyst={user?.role === 'ANALYST'}
            isEditor={user?.role === 'EDITOR'}
            onFlag={handleFlag}
            latestRunId={lastRun?.runId || selectedRun?.id}
            onResolve={handleResolve}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>
      )}

      {/* Run History */}
      {user?.role !== 'ADMIN' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-300">Run History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-center">Errors</th>
                  <th className="px-4 py-3 font-medium text-center">Warnings</th>
                  <th className="px-4 py-3 font-medium text-center">Info</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading history...
                    </td>
                  </tr>
                ) : !history?.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No validation runs yet. Click "Run Validation" to start.
                    </td>
                  </tr>
                ) : (
                  history.map((run) => (
                    <tr
                      key={run.id}
                      className={`hover:bg-zinc-900/50 transition-colors cursor-pointer ${selectedRunId === run.id ? 'bg-blue-500/5 border-l-2 border-l-blue-500' : ''}`}
                      onClick={() => { setSelectedRunId(run.id); setLastRun(null); }}
                    >
                      <td className="px-4 py-3 text-zinc-300">{new Date(run.executedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${run.totalErrors > 0 ? 'text-red-400' : 'text-zinc-600'}`}>{run.totalErrors}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${run.totalWarnings > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{run.totalWarnings}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-500">{run.totalInfo}</td>
                      <td className="px-4 py-3 text-center">
                        {run.totalErrors === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <XCircle className="w-3 h-3" /> Fail
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-xs text-blue-400 hover:text-blue-300">View Details</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
