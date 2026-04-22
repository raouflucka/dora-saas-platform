import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ictProvidersApi } from '../api/ictProviders';
import { referenceApi } from '../api/reference';
import { validationApi } from '../api/validation';
import { useAuthStore } from '../store/authStore';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ToastProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import RoleGuard from '../components/RoleGuard';
import CommentsPanel from '../components/CommentsPanel';
import {
  Server,
  Plus,
  Search,
  Building2,
  Loader2,
  Pencil,
  Trash2,
  Info,
  MoreVertical,
  CheckCircle2,
  ClipboardCheck,
  Check,
} from 'lucide-react';
import IssueHintBanner from '../components/IssueHintBanner';

const providerSchema = z.object({
  providerCode: z.string().min(1, 'Provider code is required').toUpperCase(),
  legalName: z.string().min(1, 'Legal name is required (EBA VR_81)'),
  latinName: z.string().optional(),
  personTypeId: z.string().min(1, 'Person type is required (EBA VR_83)'),
  headquartersCountry: z.string().max(2).optional().or(z.literal('')),
  currency: z.string().max(3).optional().or(z.literal('')),
  annualCost: z.string().optional().or(z.literal('')),
  lei: z.string()
    .length(20, 'LEI must be exactly 20 characters (ISO 17442)')
    .refine(v => !v || /^[A-Z0-9]{18}[0-9]{2}$/.test(v.toUpperCase()), { message: 'LEI must be exactly 20 alphanumeric characters (18 alphanumeric + 2 check digits)' })
    .transform(v => v.toUpperCase())
    .optional()
    .or(z.literal('')),
  naceCode: z.string().optional().or(z.literal('')),
  ultimateParentLei: z.string().toUpperCase().optional().or(z.literal('')),
  intraGroupFlag: z.boolean().optional(),
  competentAuthority: z.string().optional().or(z.literal('')),
});
type ProviderFormValues = z.infer<typeof providerSchema>;

export default function IctProviders() {
  const { user } = useAuthStore();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const openProviderId = searchParams.get('openProviderId');
  const openId = searchParams.get('openId');
  const fieldKey = searchParams.get('fieldKey') || '';
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  // Save-interception state for "Is this issue fixed?" prompt
  const [issueFixedPrompt, setIssueFixedPrompt] = useState<{ runId: string; ruleId: string; recordId: string } | null>(null);
  const [showFixNote, setShowFixNote] = useState(false);
  const [fixNote, setFixNote] = useState('');

  useEffect(() => {
    if ((highlightId || openId) && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [highlightId, openId]);

  const { register, handleSubmit, formState: { errors, touchedFields, dirtyFields }, reset, watch } = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    mode: 'onChange',
    defaultValues: { providerCode: '', legalName: '', latinName: '', personTypeId: '', headquartersCountry: '', currency: '', annualCost: '', lei: '', naceCode: '', ultimateParentLei: '', intraGroupFlag: false, competentAuthority: '' }
  });

  const getInputClass = (fieldName: keyof ProviderFormValues) => {
    const base = "w-full rounded-md py-2 px-3 text-sm focus:outline-none transition-all ";
    if (errors[fieldName]) {
      return base + "bg-rose-500/5 border border-rose-500/50 focus:ring-1 focus:ring-rose-500";
    }
    const val = watch(fieldName);
    if ((touchedFields[fieldName] || dirtyFields[fieldName]) && val !== '' && val !== undefined) {
      return base + "bg-emerald-500/5 border border-emerald-500/50 focus:ring-1 focus:ring-emerald-500";
    }
    return base + "bg-zinc-900 border border-zinc-800 focus:ring-1 focus:ring-indigo-500";
  };

  const FieldLabel = ({ label, required, doraRef, tooltip }: { label: string, required?: boolean, doraRef?: string, tooltip?: string }) => (
    <div className="flex justify-between items-end mb-1.5">
      <label className="text-sm font-medium text-zinc-300">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {doraRef && (
        <div className="group relative flex items-center gap-1 cursor-help">
          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">{doraRef}</span>
          <Info className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[102%] w-48 bg-zinc-800 text-zinc-200 text-xs p-2.5 rounded shadow-xl border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <span className="font-semibold block mb-1">{doraRef}</span>
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );

  const watchLei = watch('lei');

  const { data: providers, isLoading } = useQuery({
    queryKey: ['ict-providers'],
    queryFn: ictProvidersApi.getAll,
  });

  const { data: countries } = useQuery({
    queryKey: ['reference-countries'],
    queryFn: referenceApi.getCountries,
  });

  const { data: currencies } = useQuery({
    queryKey: ['reference-currencies'],
    queryFn: referenceApi.getCurrencies,
  });

  const { data: providerPersonTypes } = useQuery({
    queryKey: ['reference-provider-person-types'],
    queryFn: referenceApi.getProviderPersonTypes,
  });

  const deleteMutation = useMutation({
    mutationFn: ictProvidersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ict-providers'] });
      toast.success('Provider deleted.');
    },
    onError: () => toast.error('Failed to delete provider.'),
  });

  const createMutation = useMutation({
    mutationFn: ictProvidersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ict-providers'] });
      setIsDialogOpen(false);
      reset();
      toast.success('ICT provider registered successfully.');
    },
    onError: () => toast.error('Failed to register provider. Check all required fields.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => ictProvidersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ict-providers'] });
      setIsDialogOpen(false);
      setEditingId(null);
      reset();
      // Check for deep-link flagged issue context
      const runId = searchParams.get('runId');
      const ruleId = searchParams.get('ruleId');
      const recordId = searchParams.get('recordId');
      if (fieldKey && runId && ruleId) {
        setIssueFixedPrompt({ runId, ruleId, recordId: recordId || editingId || '' });
      } else {
        toast.success('Provider updated successfully.');
      }
    },
    onError: () => toast.error('Failed to update provider.'),
  });

  const selfResolveMutation = useMutation({
    mutationFn: ({ runId, ruleId, recordId, note }: { runId: string; ruleId: string; recordId: string; note: string }) =>
      validationApi.resolveIssue(runId, ruleId, recordId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-run'] });
      setIssueFixedPrompt(null);
      setShowFixNote(false);
      setFixNote('');
      toast.success('Fix submitted for Analyst approval.');
    },
    onError: () => toast.error('Failed to submit fix.'),
  });

  const onSubmit = (data: ProviderFormValues) => {
    const payload = {
      ...data,
      personTypeId: data.personTypeId ? Number(data.personTypeId) : undefined,
      headquartersCountry: data.headquartersCountry?.toUpperCase() || undefined,
      currency: data.currency?.toUpperCase() || undefined,
      annualCost: data.annualCost && data.annualCost !== '' ? Number(data.annualCost) : undefined,
      lei: data.lei || undefined,
      naceCode: data.naceCode || undefined,
      ultimateParentLei: data.ultimateParentLei || undefined,
      competentAuthority: data.competentAuthority || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    reset({ providerCode: '', legalName: '', latinName: '', personTypeId: '', headquartersCountry: '', currency: '', annualCost: '', lei: '', naceCode: '', ultimateParentLei: '', intraGroupFlag: false, competentAuthority: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (provider: any) => {
    setEditingId(provider.id);
    reset({
      providerCode: provider.providerCode,
      legalName: provider.legalName || '',
      latinName: provider.latinName || '',
      personTypeId: provider.personTypeId?.toString() || '',
      headquartersCountry: provider.headquartersCountry || '',
      currency: provider.currency || '',
      annualCost: provider.annualCost ? provider.annualCost.toString() : '',
      lei: provider.lei || '',
      naceCode: provider.naceCode || '',
      ultimateParentLei: provider.ultimateParentLei || '',
      intraGroupFlag: provider.intraGroupFlag || false,
      competentAuthority: provider.competentAuthority || '',
    });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (openProviderId && providers) {
      const provider = providers.find(p => p.id === openProviderId);
      if (provider && provider.id !== editingId) {
        openEditDialog(provider);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openProviderId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [openProviderId, providers, editingId, searchParams, setSearchParams]);

  // Deep-link: openId auto-opens the edit dialog for the exact provider
  useEffect(() => {
    if (openId && providers && !openProviderId) {
      const provider = providers.find(p => p.id === openId);
      if (provider && provider.id !== editingId) {
        openEditDialog(provider);
        // Keep highlight param but remove openId to prevent re-triggering
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [openId, providers, editingId]); // eslint-disable-line

  const filteredProviders = providers?.filter(p =>
    p.providerCode.toLowerCase().includes(search.toLowerCase()) ||
    (p.legalName && p.legalName.toLowerCase().includes(search.toLowerCase())) ||
    (p.lei && p.lei.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* ── "Is this issue fixed?" modal ── */}
      {issueFixedPrompt && !showFixNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-400" /> Is this issue fixed?
            </h2>
            <p className="text-sm text-zinc-400">You just saved changes to this record. Has the flagged compliance issue been resolved?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setIssueFixedPrompt(null); toast.success('Provider updated successfully.'); }} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-lg transition-colors">No — not yet</button>
              <button onClick={() => setShowFixNote(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors">Yes — submit fix</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Fix note modal ── */}
      {issueFixedPrompt && showFixNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-teal-400" /> Submit Fix for Analyst Approval
            </h2>
            <p className="text-xs text-zinc-400">Briefly describe what you changed (optional).</p>
            <textarea value={fixNote} onChange={e => setFixNote(e.target.value)} rows={3} placeholder="e.g. Updated the LEI code to the correct 20-character format." className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500 resize-none" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowFixNote(false); setIssueFixedPrompt(null); toast.success('Provider updated successfully.'); }} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-lg">Cancel</button>
              <button onClick={() => selfResolveMutation.mutate({ ...issueFixedPrompt, note: fixNote })} disabled={selfResolveMutation.isPending} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                {selfResolveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Submit Fix
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Server className="w-6 h-6 text-emerald-400" />
            {t('ICT Providers')}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your ICT third-party service providers registry (EBA RT.03).
          </p>
        </div>

        {/* Add Provider — Editor Only */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <RoleGuard allowed={['EDITOR']}>
            <DialogTrigger asChild>
              <button onClick={openCreateDialog} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" />
                {t('Add Provider')}
              </button>
            </DialogTrigger>
          </RoleGuard>
          <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 dark max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-6">
              <DialogHeader className="shrink-0 mb-4">
                <DialogTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-indigo-400" />
                  {editingId ? t('Edit ICT Provider') : t('Register New ICT Provider')}
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  {t('Register provider details. Note: LEI (Legal Entity Identifier) is mandatory.')}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto flex gap-6 pr-2">
                <div className="flex-1 space-y-4">
                  <fieldset disabled={user?.role !== 'EDITOR'} className="contents">
                    <form id="provider-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      {/* Issue hint — shown when page was opened from a validation deep-link */}
                      {fieldKey && editingId && (
                        <IssueHintBanner
                          fieldKey={fieldKey}
                          message={searchParams.get('message') || undefined}
                          analystNote={searchParams.get('analystNote') || undefined}
                        />
                      )}
                      {/* Core Information Section */}
                    <div>
                      <h3 className="text-sm font-medium text-zinc-100 mb-3 border-b border-zinc-800 pb-2 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-400" /> Corporate Details
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <FieldLabel label="Provider Code" required doraRef="RT.03.01.0010" tooltip="Unique internal reference code for this ICT vendor." />
                          <input {...register('providerCode')} className={`${getInputClass('providerCode')} uppercase`} />
                          {errors.providerCode && <p className="text-rose-400 text-xs">{errors.providerCode.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Legal Name" required doraRef="RT.03.01.0030" tooltip="Full registered legal name of the entity." />
                          <input {...register('legalName')} className={getInputClass('legalName')} />
                          {errors.legalName && <p className="text-rose-400 text-xs">{errors.legalName.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Latin Name" />
                          <input {...register('latinName')} className={getInputClass('latinName')} />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('LEI') + ' (20 char)'} doraRef="RT.03.01.0020" tooltip="Legal Entity Identifier. Resolves concentration risk accurately." />
                          <input {...register('lei')} className={`${getInputClass('lei')} font-mono uppercase`} placeholder="00000000000000000000" maxLength={20} />
                          {watchLei && watchLei.length > 0 && watchLei.length !== 20 && (
                            <p className="text-amber-400 text-xs">LEI must be exactly 20 characters ({watchLei.length}/20)</p>
                          )}
                        </div>
                      </div>
                      {/* Person Type — EBA VR_83 required field */}
                      <div className="mt-4">
                        <FieldLabel label="Person Type" required doraRef="RT.05.01.c0070" tooltip="Legal personality of the ICT provider (e.g. Legal Person, Natural Person). Required by EBA VR_83." />
                        <select {...register('personTypeId')} className={getInputClass('personTypeId')}>
                          <option value="">Select person type...</option>
                          {providerPersonTypes?.map((pt: any) => (
                            <option key={pt.id} value={pt.id}>{pt.personType || pt.name || `Type ${pt.id}`}</option>
                          ))}
                        </select>
                        {errors.personTypeId && <p className="text-rose-400 text-xs mt-1">{errors.personTypeId.message}</p>}
                      </div>
                    </div>

                    {/* DORA Regulatory Fields */}
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-400 mb-3 border-b border-zinc-800 pb-2">2. DORA Regulatory Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <FieldLabel label={t('NACE Code')} doraRef="RT.03.01.0040" tooltip="Economic activity classification of the ICT provider." />
                          <input {...register('naceCode')} className={getInputClass('naceCode')} placeholder="J62.01" />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label={t('Ultimate Parent LEI')} doraRef="RT.03.01.0050" tooltip="If this provider is a subsidiary, provide the global parent organization's LEI." />
                          <input {...register('ultimateParentLei')} className={`${getInputClass('ultimateParentLei')} font-mono uppercase`} placeholder="00000000000000000000" maxLength={20} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="space-y-1">
                          <FieldLabel label={t('Competent Authority')} doraRef="RT.03.01.0090" tooltip="Relevant regulatory authority if the provider is also a financial entity." />
                          <input {...register('competentAuthority')} className={getInputClass('competentAuthority')} placeholder="e.g. Central Bank of Ireland" />
                        </div>
                        <div className="flex items-center gap-3 pt-6">
                          <input type="checkbox" {...register('intraGroupFlag')} className="w-4 h-4 rounded bg-zinc-900 border-zinc-800 text-emerald-600 focus:ring-emerald-500" />
                          <div>
                            <label className="text-sm font-medium text-zinc-300">Intra-Group Provider</label>
                            <p className="text-xs text-zinc-500">Is this ICT service provided within your own corporate group? (DORA Art. 28§3)</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Location & Cost */}
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-400 mb-3 border-b border-zinc-800 pb-2">3. Location & Cost</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-300">{t('Headquarters Country')}</label>
                          <select {...register('headquartersCountry')} className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500">
                            <option value="">{t('Select')}</option>
                            {countries?.map((c: any) => (
                              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-300">{t('Currency')}</label>
                          <select {...register('currency')} className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500">
                            <option value="">{t('Select')}</option>
                            {currencies?.map((c: any) => (
                              <option key={c.code} value={c.code}>{c.name || c.code} ({c.code})</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-300">{t('Annual Cost')}</label>
                          <input type="number" step="0.01" {...register('annualCost')} className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="50000" />
                        </div>
                      </div>
                    </div>
                  </form>
                  </fieldset>
                </div>

                {editingId && (
                  <div className="w-80 shrink-0 border-l border-zinc-800 pl-6 h-full flex flex-col">
                    <CommentsPanel entityType="IctProvider" entityId={editingId} />
                  </div>
                )}
              </div>

              <div className="shrink-0 pt-4 flex justify-end gap-3 bg-zinc-950/90 border-t border-zinc-800 mt-4">
                <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 pointer-events-auto">{t('Close')}</button>
                {user?.role === 'EDITOR' && (
                  <button type="submit" form="provider-form" disabled={createMutation.isPending || updateMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 pointer-events-auto">
                    {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? t('Save Changes') : t('Create Provider'))}
                  </button>
                )}
              </div>
            </DialogContent>
          </Dialog>
      </div>

      {/* Contextual Guidance */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3 items-start">
        <Server className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-emerald-400">DORA Context: ICT Third-Party Providers</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Under DORA Art. 28(3), you must maintain an exhaustive list of all ICT third-party service providers. Missing LEIs are a frequent reason for EBA rejection. Ensure you capture the "Ultimate Parent LEI" to assist regulators with concentration risk analysis.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder={t('Search by code, name, or LEI...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-shadow"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">{t('ICT Provider')}</th>
                <th className="px-6 py-4 font-medium">{t('LEI')}</th>
                <th className="px-6 py-4 font-medium">{t('Headquarters')}</th>
                <th className="px-6 py-4 font-medium">{t('Annual Cost')}</th>
                <th className="px-6 py-4 font-medium text-center">{t('Intra-Group')}</th>
                <th className="px-6 py-4 font-medium text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    {t('Loading providers')}
                  </td>
                </tr>
              ) : filteredProviders?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    {t('No ICT provider found')}
                  </td>
                </tr>
              ) : (
                filteredProviders?.map((provider) => (
                  <tr
                    key={provider.id}
                    ref={provider.id === highlightId ? highlightRef : null}
                    className={`hover:bg-zinc-900/50 transition-colors group ${
                      provider.id === highlightId ? 'ring-2 ring-inset ring-amber-500/60 bg-amber-500/5 animate-pulse' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                          <Server className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-medium text-zinc-200">{provider.legalName || provider.providerCode}</div>
                          <div className="text-xs text-zinc-500 mt-0.5 font-mono">{provider.providerCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400 tracking-wider">
                      {provider.lei || <span className="text-zinc-600 italic">Not set</span>}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {provider.headquartersRef?.name ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs">
                          {provider.headquartersRef.name}
                        </span>
                      ) : provider.headquartersCountry ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs">
                          {provider.headquartersCountry}
                        </span>
                      ) : (
                        <span className="text-zinc-600 italic">{t('Not specified')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {provider.annualCost ? (
                        <span className="text-emerald-400 font-medium">
                          {new Intl.NumberFormat(i18n.language || 'en', { style: 'currency', currency: provider.currency || 'EUR' }).format(provider.annualCost)}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {provider.intraGroupFlag ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">Yes</span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Edit — Admin & Editor & Analyst */}
                        <RoleGuard allowed={['ADMIN', 'EDITOR', 'ANALYST']}>
                          <button onClick={() => openEditDialog(provider)} className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-md transition-colors">
                            {user?.role === 'EDITOR' ? <Pencil className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                          </button>
                        </RoleGuard>
                        <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
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
