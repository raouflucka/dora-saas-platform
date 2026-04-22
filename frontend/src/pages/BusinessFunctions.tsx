import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessFunctionsApi } from '../api/businessFunctions';
import { financialEntitiesApi } from '../api/financialEntities';
import { contractualArrangementsApi } from '../api/contractualArrangements';
import { referenceApi } from '../api/reference';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import RoleGuard from '../components/RoleGuard';
import { validationApi } from '../api/validation';
import { useAuthStore } from '../store/authStore';
import { useSearchParams } from 'react-router-dom';
import { Cpu, Plus, Search, Pencil, Trash2, Loader2, Link2, Unlink, Activity, Server, ChevronRight, CheckCircle2, Info, ClipboardCheck, Check } from 'lucide-react';
import IssueHintBanner from '../components/IssueHintBanner';
import { useToast } from '../components/ToastProvider';

const functionSchema = z.object({
  financialEntityId: z.string().min(1, 'Financial Entity is required'),
  functionIdentifier: z.string().min(1, 'Identifier is required').max(50),
  functionName: z.string().min(1, 'Function name is required').max(255),
  criticalityLevelId: z.string().optional().or(z.literal('')),
  criticalityReason: z.string().optional().or(z.literal('')),
  licensedActivity: z.string().optional().or(z.literal('')),
  impactDiscontinuation: z.string().optional().or(z.literal('')),
  rto: z.string().optional().or(z.literal('')),
  rpo: z.string().optional().or(z.literal('')),
  lastAssessmentDate: z.string().optional().or(z.literal('')),
});

type FunctionFormValues = z.infer<typeof functionSchema>;

const CRITICALITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  Important: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Not Critical': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export default function BusinessFunctions() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDepDialogOpen, setIsDepDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFn, setSelectedFn] = useState<any>(null);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [confirmRemoveDep, setConfirmRemoveDep] = useState<{ depId: string; contractId: string; label: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('openId');
  const highlightId = searchParams.get('highlight');
  const fieldKey = searchParams.get('fieldKey') || '';
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  const [issueFixedPrompt, setIssueFixedPrompt] = useState<{ runId: string; ruleId: string; recordId: string } | null>(null);
  const [showFixNote, setShowFixNote] = useState(false);
  const [fixNote, setFixNote] = useState('');

  useEffect(() => {
    if ((highlightId || openId) && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [highlightId, openId]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FunctionFormValues>({
    resolver: zodResolver(functionSchema),
    defaultValues: {
      financialEntityId: '',
      functionIdentifier: '',
      functionName: '',
      criticalityLevelId: '',
      criticalityReason: '',
      licensedActivity: '',
      impactDiscontinuation: '',
      rto: '',
      rpo: '',
      lastAssessmentDate: '',
    },
  });
  const { data: functions, isLoading, isError } = useQuery({
    queryKey: ['business-functions'],
    queryFn: businessFunctionsApi.getAll,
  });

  // Auto-open dialog from validation deep-link
  useEffect(() => {
    if (openId && functions) {
      const fn = functions.find((f: any) => f.id === openId);
      if (fn && fn.id !== editingId) {
        openEditDialog(fn);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [openId, functions, editingId]); // eslint-disable-line
  const { data: financialEntities } = useQuery({
    queryKey: ['financial-entities'],
    queryFn: financialEntitiesApi.getAll,
  });
  const { data: criticalityLevels } = useQuery({
    queryKey: ['reference-criticality-levels'],
    queryFn: referenceApi.getCriticalityLevels,
  });
  const { data: contracts } = useQuery({
    queryKey: ['contractual-arrangements'],
    queryFn: contractualArrangementsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: businessFunctionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-functions'] });
      setIsDialogOpen(false);
      reset();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      businessFunctionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-functions'] });
      setIsDialogOpen(false);
      setEditingId(null);
      reset();
      const runId = searchParams.get('runId');
      const ruleId = searchParams.get('ruleId');
      const recordId = searchParams.get('recordId');
      if (fieldKey && runId && ruleId) {
        setIssueFixedPrompt({ runId, ruleId, recordId: recordId || editingId || '' });
      }
    },
  });

  const selfResolveMutation = useMutation({
    mutationFn: ({ runId, ruleId, recordId, note }: { runId: string; ruleId: string; recordId: string; note: string }) =>
      validationApi.resolveIssue(runId, ruleId, recordId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-run'] });
      setIssueFixedPrompt(null); setShowFixNote(false); setFixNote('');
      toast.success('Fix submitted for Analyst approval.');
    },
    onError: () => toast.error('Failed to submit fix.'),
  });
  const deleteMutation = useMutation({
    mutationFn: businessFunctionsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-functions'] }),
  });

  const addDepMutation = useMutation({
    mutationFn: ({ fnId, contractId }: { fnId: string; contractId: string }) =>
      businessFunctionsApi.addIctDependency(fnId, contractId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['business-functions'] });
      if (selectedFn) {
        const detail = await businessFunctionsApi.getById(selectedFn.id);
        setSelectedFn(detail);
      }
      setSelectedContractId('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message
        || 'Cannot link this contract. Only contracts with active subcontracting (DORA Art.28§3) can be linked as ICT dependencies.';
      toast.error(msg);
    },
  });

  const removeDepMutation = useMutation({
    mutationFn: ({ fnId, contractId }: { fnId: string; contractId: string }) =>
      businessFunctionsApi.removeIctDependency(fnId, contractId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['business-functions'] });
      if (selectedFn) {
        const detail = await businessFunctionsApi.getById(selectedFn.id);
        setSelectedFn(detail);
      }
      setConfirmRemoveDep(null);
    },
  });

  const onSubmit = (data: FunctionFormValues) => {
    const payload = {
      ...data,
      criticalityLevelId: data.criticalityLevelId ? Number(data.criticalityLevelId) : undefined,
      rto: data.rto ? Number(data.rto) : undefined,
      rpo: data.rpo ? Number(data.rpo) : undefined,
      lastAssessmentDate: data.lastAssessmentDate || undefined,
      criticalityReason: data.criticalityReason || undefined,
      licensedActivity: data.licensedActivity || undefined,
      impactDiscontinuation: data.impactDiscontinuation || undefined,
    };
    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  };

  const openCreateDialog = () => {
    setEditingId(null);
    reset();
    setIsDialogOpen(true);
  };

  const openEditDialog = (fn: any) => {
    setEditingId(fn.id);
    reset({
      financialEntityId: fn.financialEntityId,
      functionIdentifier: fn.functionIdentifier,
      functionName: fn.functionName,
      criticalityLevelId: fn.criticalityLevelId?.toString() || '',
      criticalityReason: fn.criticalityReason || '',
      licensedActivity: fn.licensedActivity || '',
      impactDiscontinuation: fn.impactDiscontinuation || '',
      rto: fn.rto?.toString() || '',
      rpo: fn.rpo?.toString() || '',
      lastAssessmentDate: fn.lastAssessmentDate ? fn.lastAssessmentDate.split('T')[0] : '',
    });
    setIsDialogOpen(true);
  };

  const openDepDialog = async (fn: any) => {
    setConfirmRemoveDep(null);
    setSelectedContractId('');
    const detail = await businessFunctionsApi.getById(fn.id);
    setSelectedFn(detail);
    setIsDepDialogOpen(true);
  };

  const filtered = functions?.filter(f =>
    f.functionIdentifier.toLowerCase().includes(search.toLowerCase()) ||
    f.functionName.toLowerCase().includes(search.toLowerCase()) ||
    f.financialEntity?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {issueFixedPrompt && !showFixNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-teal-400" /> Is this issue fixed?</h2>
            <p className="text-sm text-zinc-400">You just saved changes. Has the flagged compliance issue been resolved?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIssueFixedPrompt(null)} className="px-4 py-2 text-sm text-zinc-400 bg-zinc-800 rounded-lg">No — not yet</button>
              <button onClick={() => setShowFixNote(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Yes — submit fix</button>
            </div>
          </div>
        </div>
      )}
      {issueFixedPrompt && showFixNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-teal-400" /> Submit Fix for Analyst Approval</h2>
            <textarea value={fixNote} onChange={e => setFixNote(e.target.value)} rows={3} placeholder="Describe what you changed..." className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500 resize-none" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowFixNote(false); setIssueFixedPrompt(null); }} className="px-4 py-2 text-sm text-zinc-400 bg-zinc-800 rounded-lg">Cancel</button>
              <button onClick={() => selfResolveMutation.mutate({ ...issueFixedPrompt, note: fixNote })} disabled={selfResolveMutation.isPending} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                {selfResolveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Submit Fix
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-violet-400" />
            Business Functions
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            DORA Art. 28§4 — Register critical and important business functions and their ICT dependencies (RT.04).
          </p>
        </div>

        {/* Add Function — ANALYST or EDITOR */}
        <RoleGuard allowed={['ANALYST', 'EDITOR']}>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button
                onClick={openCreateDialog}
                className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Function
              </button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 dark max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Business Function' : 'New Business Function'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
                {/* Issue hint — shown when navigated from validation deep-link */}
                {fieldKey && editingId && (
                  <IssueHintBanner
                    fieldKey={fieldKey}
                    message={searchParams.get('message') || undefined}
                    analystNote={searchParams.get('analystNote') || undefined}
                  />
                )}
                {/* Section 1: Identification */}
                <div>
                  <h3 className="text-sm font-semibold text-violet-400 mb-3 border-b border-zinc-800 pb-2">
                    1. Identification
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Function Identifier <span className="text-red-500">*</span></label>
                      <input
                        {...register('functionIdentifier')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-violet-500"
                        placeholder="BF-001"
                      />
                      {errors.functionIdentifier && <p className="text-red-400 text-xs">{errors.functionIdentifier.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Function Name <span className="text-red-500">*</span></label>
                      <input
                        {...register('functionName')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        placeholder="Payment Processing"
                      />
                      {errors.functionName && <p className="text-red-400 text-xs">{errors.functionName.message}</p>}
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Financial Entity <span className="text-red-500">*</span></label>
                    <select
                      {...register('financialEntityId')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="">Select an entity...</option>
                      {financialEntities?.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.lei})</option>
                      ))}
                    </select>
                    {errors.financialEntityId && <p className="text-red-400 text-xs">{errors.financialEntityId.message}</p>}
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Licensed Activity</label>
                    <input
                      {...register('licensedActivity')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                      placeholder="e.g. Payment services, credit intermediation..."
                    />
                  </div>
                </div>

                {/* Section 2: Criticality */}
                <div>
                  <h3 className="text-sm font-semibold text-violet-400 mb-3 border-b border-zinc-800 pb-2">
                    2. Criticality Assessment
                  </h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Criticality Level</label>
                    <select
                      {...register('criticalityLevelId')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="">Select level...</option>
                      {criticalityLevels?.map((l: any) => (
                        <option key={l.id} value={l.id}>{l.levelName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Criticality Reason</label>
                    <textarea
                      {...register('criticalityReason')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm min-h-[60px] focus:outline-none focus:ring-1 focus:ring-violet-500"
                      placeholder="Explain why this function is critical or important..."
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Impact of Discontinuation</label>
                    <textarea
                      {...register('impactDiscontinuation')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm min-h-[60px] focus:outline-none focus:ring-1 focus:ring-violet-500"
                      placeholder="Describe the impact if this function were to be discontinued..."
                    />
                  </div>
                </div>

                {/* Section 3: Resilience */}
                <div>
                  <h3 className="text-sm font-semibold text-violet-400 mb-3 border-b border-zinc-800 pb-2">
                    3. Resilience & Recovery
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">RTO (minutes)</label>
                      <input
                        type="number"
                        min="0"
                        {...register('rto')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        placeholder="60"
                      />
                      <p className="text-xs text-zinc-500">Recovery Time Objective</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">RPO (minutes)</label>
                      <input
                        type="number"
                        min="0"
                        {...register('rpo')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        placeholder="15"
                      />
                      <p className="text-xs text-zinc-500">Recovery Point Objective</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Last Assessment</label>
                      <input
                        type="date"
                        {...register('lastAssessmentDate')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-zinc-950/90 py-4 backdrop-blur-sm border-t border-zinc-800">
                  <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      editingId ? 'Save Changes' : 'Create Function'
                    )}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      {/* Contextual Guidance */}
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex gap-3 items-start">
        <Cpu className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-violet-400">DORA Context: Business Functions</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Map your critical and important business functions per DORA Art. 28(4). Linking these functions to ICT contracts forms the basis of the Register of Information (RT.04).
          </p>
        </div>
      </div>

      {/* ICT Dependency Dialog */}
      <Dialog
        open={isDepDialogOpen}
        onOpenChange={(open) => {
          setIsDepDialogOpen(open);
          if (!open) { setConfirmRemoveDep(null); setSelectedContractId(''); }
        }}
      >
        <DialogContent
          className="bg-zinc-950 border border-zinc-800 text-zinc-100 dark flex flex-col"
          style={{ maxWidth: confirmRemoveDep ? '58rem' : '44rem', maxHeight: '85vh', transition: 'max-width 0.25s ease' }}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Activity className="w-5 h-5 text-violet-400" />
              ICT Dependencies
            </DialogTitle>
            {selectedFn && (
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-xs font-mono bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded border border-violet-500/20">
                  {selectedFn.functionIdentifier}
                </span>
                <span className="text-xs text-zinc-400">{selectedFn.functionName}</span>
                {selectedFn.criticalityLevel?.levelName && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    CRITICALITY_COLORS[selectedFn.criticalityLevel.levelName] || 'bg-zinc-700 text-zinc-400 border-zinc-600'
                  }`}>
                    {selectedFn.criticalityLevel.levelName}
                  </span>
                )}
              </div>
            )}
          </DialogHeader>

          {/* Split pane: main content left + confirmation right */}
          <div className="flex flex-1 gap-0 overflow-hidden mt-4" style={{ minHeight: 0 }}>

            {/* Left: scrollable content */}
            <div className={`overflow-y-auto pr-1 space-y-4 transition-opacity duration-200 ${
              confirmRemoveDep ? 'flex-shrink-0 w-[30rem] opacity-40 pointer-events-none' : 'flex-1'
            }`}>

              {/* DORA context */}
              <div className="rounded-xl bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 p-3 flex gap-2.5 items-start">
                <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Link this function to the ICT contracts that <strong className="text-zinc-200">directly support</strong> its operation.
                  Required for the DORA <span className="text-violet-300 font-medium">Register of Information (RT.04)</span>.
                  {selectedFn?.ictDependencies?.length > 0 && (
                    <span className="ml-1 text-emerald-400">
                      <CheckCircle2 className="inline w-3 h-3 mb-0.5 mr-0.5" />
                      {selectedFn.ictDependencies.length} contract{selectedFn.ictDependencies.length !== 1 ? 's' : ''} linked.
                    </span>
                  )}
                </p>
              </div>

              {/* Add Link form — ANALYST only */}
              <RoleGuard allowed={['ANALYST', 'EDITOR']}>
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-sm font-semibold text-zinc-200">Link an ICT Contract</span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={selectedContractId}
                      onChange={e => setSelectedContractId(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg py-2.5 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                    >
                      <option value="">Select a contract to link...</option>
                      {contracts
                        ?.filter(c => !selectedFn?.ictDependencies?.some((d: any) => d.contractId === c.id))
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.contractReference} — {c.provider?.legalName ?? 'Unknown'}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => {
                        if (selectedContractId && selectedFn) {
                          addDepMutation.mutate({ fnId: selectedFn.id, contractId: selectedContractId });
                        }
                      }}
                      disabled={!selectedContractId || addDepMutation.isPending}
                      className="bg-violet-600 hover:bg-violet-500 active:scale-95 text-white px-4 py-2.5 rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5 text-sm font-medium shrink-0 shadow-lg shadow-violet-900/30"
                    >
                      {addDepMutation.isPending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Link2 className="w-4 h-4" /><span>Add Link</span></>}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-600">
                    Only contracts not already linked are shown. Changes take effect immediately.
                  </p>
                </div>
              </RoleGuard>

              {/* Linked contracts list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Linked Contracts</p>
                  <span className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                    {selectedFn?.ictDependencies?.length || 0}
                  </span>
                </div>

                {!selectedFn?.ictDependencies?.length ? (
                  <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-zinc-800/80 rounded-xl text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-3">
                      <Server className="w-5 h-5 text-zinc-700" />
                    </div>
                    <p className="text-sm font-medium text-zinc-500">No ICT contracts linked yet</p>
                    <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                      Use the selector above to link the first ICT dependency.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedFn.ictDependencies.map((dep: any, idx: number) => (
                      <div
                        key={dep.id}
                        className="group flex items-center justify-between p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl hover:border-violet-500/40 hover:bg-violet-500/5 transition-all duration-200"
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Status dot */}
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center ring-1 ring-violet-500/20">
                              <Server className="w-3.5 h-3.5 text-violet-400" />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-zinc-900" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-100 truncate leading-tight">
                              {dep.contractualArrangement?.contractReference}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {dep.contractualArrangement?.provider?.legalName && (
                                <span className="text-[11px] text-zinc-500 truncate">
                                  {dep.contractualArrangement.provider.legalName}
                                </span>
                              )}
                              {dep.contractualArrangement?.ictServiceType?.name && (
                                <>
                                  <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0" />
                                  <span className="text-[11px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">
                                    {dep.contractualArrangement.ictServiceType.name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <RoleGuard allowed={['ANALYST']}>
                          <button
                            onClick={() => setConfirmRemoveDep({
                              depId: dep.id,
                              contractId: dep.contractId,
                              label: dep.contractualArrangement?.contractReference || 'this contract',
                            })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Unlink className="w-3 h-3" /> Remove
                          </button>
                        </RoleGuard>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>{/* end left scrollable */}

            {/* Right: inline confirmation panel */}
            {confirmRemoveDep && (
              <div className="w-72 shrink-0 border-l border-zinc-800 pl-5 flex flex-col justify-center space-y-5">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <Unlink className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="text-sm font-bold text-zinc-100">Remove Link?</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">You are about to unlink:</p>
                  <div className="bg-zinc-900 border border-red-500/20 rounded-lg p-3">
                    <p className="text-sm font-semibold text-red-300 break-words">"{confirmRemoveDep.label}"</p>
                    <p className="text-[11px] text-zinc-500 mt-1">ICT contract dependency</p>
                  </div>
                  <p className="text-xs text-zinc-600">This updates the DORA Register of Information (RT.04) immediately.</p>
                </div>
                <div className="space-y-2">
                  <button
                    disabled={removeDepMutation.isPending}
                    onClick={() => removeDepMutation.mutate({ fnId: selectedFn.id, contractId: confirmRemoveDep.contractId })}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-red-900/30"
                  >
                    {removeDepMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><Unlink className="w-4 h-4" /> Confirm Remove</>}
                  </button>
                  <button
                    onClick={() => setConfirmRemoveDep(null)}
                    className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-zinc-800/50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </div>{/* end split pane */}
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="flex items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by identifier, function name, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Identifier</th>
                <th className="px-6 py-4 font-medium">Function Name</th>
                <th className="px-6 py-4 font-medium">Financial Entity</th>
                <th className="px-6 py-4 font-medium text-center">Criticality</th>
                <th className="px-6 py-4 font-medium">ICT Dependencies</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
                    Loading business functions...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-red-400 font-medium text-sm">Failed to load business functions.</p>
                    <p className="text-zinc-500 text-xs mt-1">Check that the backend is running and you have the correct permissions.</p>
                  </td>
                </tr>
              ) : filtered?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No business functions found. Add your first function to get started.
                  </td>
                </tr>
              ) : (
                filtered?.map((fn) => (
                  <tr key={fn.id} className="hover:bg-zinc-900/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-violet-400 bg-violet-400/10 px-2 py-1 rounded">
                        {fn.functionIdentifier}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-200">{fn.functionName}</div>
                      {fn.licensedActivity && (
                        <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-[200px]">{fn.licensedActivity}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {fn.financialEntity?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {fn.criticalityLevel?.levelName ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${CRITICALITY_COLORS[fn.criticalityLevel.levelName] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                          {fn.criticalityLevel.levelName}
                        </span>
                      ) : (
                        <span className="text-zinc-600 italic">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDepDialog(fn)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group/dep"
                        >
                          <Activity className="w-3.5 h-3.5 text-zinc-500 group-hover/dep:text-violet-400 transition-colors" />
                          <span className="text-xs font-medium text-zinc-400 group-hover/dep:text-zinc-200 transition-colors">
                            {fn.ictDependencies?.length > 0
                              ? <>{fn.ictDependencies.length} Linked<span className="hidden sm:inline"> Contract{fn.ictDependencies.length !== 1 ? 's' : ''}</span></>
                              : 'Manage ICT Links'
                            }
                          </span>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <RoleGuard allowed={['ANALYST']}>
                          <button
                            onClick={() => openEditDialog(fn)}
                            className="p-1.5 text-zinc-400 hover:text-violet-400 hover:bg-violet-400/10 rounded-md transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </RoleGuard>
                        <RoleGuard allowed={['ADMIN']}>
                          <button
                            onClick={() => {
                              if (confirm(`Delete function "${fn.functionIdentifier}"?`)) {
                                deleteMutation.mutate(fn.id);
                              }
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </RoleGuard>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
