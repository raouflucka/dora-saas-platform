import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractualArrangementsApi } from '../api/contractualArrangements';
import { businessFunctionsApi } from '../api/businessFunctions';
import { financialEntitiesApi } from '../api/financialEntities';
import { ictProvidersApi } from '../api/ictProviders';
import { referenceApi } from '../api/reference';
import { contractEntitiesApi, contractProvidersApi } from '../api/contractRelationships';
import { validationApi } from '../api/validation';
import { useAuthStore } from '../store/authStore';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ToastProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import RoleGuard from '../components/RoleGuard';
import CommentsPanel from '../components/CommentsPanel';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { FileText, Plus, Search, Pencil, Loader2, Link2, Unlink, Info, Building2, Users, Activity, Server, CheckCircle2, ClipboardCheck, Check } from 'lucide-react';
import IssueHintBanner from '../components/IssueHintBanner';

const contractSchema = z.object({
  contractReference: z.string().min(1, 'Reference is required').max(100),
  contractType: z.string().min(1, 'Contract type is required (EBA VR_39)'),
  financialEntityId: z.string().min(1, 'Financial Entity is required'),
  providerId: z.string().min(1, 'ICT Provider is required'),
  subcontractorProviderId: z.string().optional().or(z.literal('')),
  ictServiceTypeId: z.string().optional().or(z.literal('')),
  relianceLevelId: z.string().optional().or(z.literal('')),
  dataSensitivityId: z.string().optional().or(z.literal('')),
  startDate: z.string().min(1, 'Start date is required (EBA VR_48)'),
  endDate: z.string().min(1, 'End date is required (EBA VR_50)'),
  renewalTerms: z.string().optional().or(z.literal('')),
  terminationNoticePeriod: z.string().optional().or(z.literal('')),
  serviceDescription: z.string().optional().or(z.literal('')),
  governingLawCountry: z.string().max(2).optional().or(z.literal('')),
  serviceCountry: z.string().max(2).optional().or(z.literal('')),
  processingLocation: z.string().max(2).optional().or(z.literal('')),
  storageLocation: z.string().max(2).optional().or(z.literal('')),
  dataStorage: z.boolean().optional(),
  providedByContractor: z.boolean().optional(),
  providedBySubcontractor: z.boolean().optional(),
  annualCost: z.string().optional().or(z.literal('')),
  currency: z.string().max(3).optional().or(z.literal('')),
}).refine(
  (d) => !d.startDate || !d.endDate || new Date(d.endDate) > new Date(d.startDate),
  { message: 'End date must be after start date (EBA VR_51A)', path: ['endDate'] }
);

type ContractFormValues = z.infer<typeof contractSchema>;

export default function ContractualArrangements() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDepDialogOpen, setIsDepDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const openContractId = searchParams.get('openContractId');
  // Deep-link params from validation engine (auto-open exact record + show field hint)
  const openId = searchParams.get('openId');
  const fieldKey = searchParams.get('fieldKey') || '';
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if ((highlightId || openId) && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [highlightId, openId]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [activeManageTab, setActiveManageTab] = useState<'relationships' | 'entities' | 'providers'>('relationships');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedFnId, setSelectedFnId] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState<{ type: 'function' | 'entity' | 'provider'; id: string; payload: any; name: string } | null>(null);
  // Save-interception state
  const [issueFixedPrompt, setIssueFixedPrompt] = useState<{ runId: string; ruleId: string; recordId: string } | null>(null);
  const [showFixNote, setShowFixNote] = useState(false);
  const [fixNote, setFixNote] = useState('');

  const { register, handleSubmit, formState: { errors, touchedFields, dirtyFields, isDirty }, reset, watch } = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    mode: 'onChange',
    defaultValues: {
      contractReference: '',
      contractType: '',
      financialEntityId: '',
      providerId: '',
      subcontractorProviderId: '',
      ictServiceTypeId: '',
      relianceLevelId: '',
      dataSensitivityId: '',
      startDate: '',
      endDate: '',
      renewalTerms: '',
      terminationNoticePeriod: '',
      serviceDescription: '',
      governingLawCountry: '',
      serviceCountry: '',
      processingLocation: '',
      storageLocation: '',
      dataStorage: false,
      providedByContractor: true,
      providedBySubcontractor: false,
      annualCost: '',
      currency: '',
    }
  });

  const getInputClass = (fieldName: keyof ContractFormValues) => {
    const base = "w-full rounded-md py-2 px-3 text-sm focus:outline-none transition-all ";
    if (errors[fieldName]) {
      return base + "bg-rose-500/5 border border-rose-500/50 focus:ring-1 focus:ring-rose-500";
    }
    const val = watch(fieldName);
    if ((touchedFields[fieldName] || dirtyFields[fieldName]) && val !== '' && val !== undefined && val !== null) {
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

  // Queries
  const { data: contracts, isLoading } = useQuery({ queryKey: ['contractual-arrangements'], queryFn: contractualArrangementsApi.getAll });
  const { data: financialEntities } = useQuery({ queryKey: ['financial-entities'], queryFn: financialEntitiesApi.getAll });
  const { data: ictProviders } = useQuery({ queryKey: ['ict-providers'], queryFn: ictProvidersApi.getAll });
  const { data: countries } = useQuery({ queryKey: ['reference-countries'], queryFn: referenceApi.getCountries });
  const { data: currencies } = useQuery({ queryKey: ['reference-currencies'], queryFn: referenceApi.getCurrencies });
  const { data: ictServiceTypes } = useQuery({ queryKey: ['reference-ict-service-types'], queryFn: referenceApi.getIctServiceTypes });
  const { data: relianceLevels } = useQuery({ queryKey: ['reference-reliance-levels'], queryFn: referenceApi.getRelianceLevels });
  const { data: dataSensitivityLevels } = useQuery({ queryKey: ['reference-data-sensitivity-levels'], queryFn: referenceApi.getDataSensitivityLevels });
  const { data: businessFunctions } = useQuery({ queryKey: ['business-functions'], queryFn: businessFunctionsApi.getAll });

  // Contract relationship sub-queries — only load when a contract is selected in the Manage dialog
  const { data: contractEntityLinks, refetch: refetchContractEntities } = useQuery({
    queryKey: ['contract-entities', selectedContract?.id],
    queryFn: () => contractEntitiesApi.getByContract(selectedContract!.id),
    enabled: !!selectedContract?.id && isDepDialogOpen,
  });
  const { data: contractProviderLinks, refetch: refetchContractProviders } = useQuery({
    queryKey: ['contract-providers', selectedContract?.id],
    queryFn: () => contractProvidersApi.getByContract(selectedContract!.id),
    enabled: !!selectedContract?.id && isDepDialogOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: contractualArrangementsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractual-arrangements'] });
      toast.success('Contract deleted.');
    },
    onError: () => toast.error('Failed to delete contract.'),
  });

  const createMutation = useMutation({
    mutationFn: contractualArrangementsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractual-arrangements'] });
      setIsDialogOpen(false);
      reset();
      toast.success('Contract created successfully.');
    },
    onError: () => toast.error('Failed to create contract. Check all required fields.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => contractualArrangementsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractual-arrangements'] });
      setIsDialogOpen(false);
      setEditingId(null);
      reset();
      const runId = searchParams.get('runId');
      const ruleId = searchParams.get('ruleId');
      const recordId = searchParams.get('recordId');
      if (fieldKey && runId && ruleId) {
        setIssueFixedPrompt({ runId, ruleId, recordId: recordId || editingId || '' });
      } else {
        toast.success('Contract updated successfully.');
      }
    },
    onError: () => toast.error('Failed to update contract.'),
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

  const addDepMutation = useMutation({
    mutationFn: ({ fnId, contractId }: { fnId: string; contractId: string }) =>
      businessFunctionsApi.addIctDependency(fnId, contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractual-arrangements'] });
      toast.success('Function linked successfully.');
    },
    onError: () => toast.error('Failed to link function.'),
  });

  const removeDepMutation = useMutation({
    mutationFn: ({ fnId, contractId }: { fnId: string; contractId: string }) =>
      businessFunctionsApi.removeIctDependency(fnId, contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractual-arrangements'] });
      toast.success('Link removed successfully.');
    },
    onError: () => toast.error('Failed to remove link.'),
  });

  const addContractEntityMutation = useMutation({
    mutationFn: ({ contractId, financialEntityId }: { contractId: string; financialEntityId: string }) =>
      contractEntitiesApi.add(contractId, financialEntityId),
    onSuccess: () => {
      refetchContractEntities();
      setSelectedEntityId('');
      toast.success('Entity linked to contract.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to link entity.'),
  });

  const removeContractEntityMutation = useMutation({
    mutationFn: (id: string) => contractEntitiesApi.remove(id),
    onSuccess: () => {
      refetchContractEntities();
      toast.success('Entity unlinked.');
    },
    onError: () => toast.error('Failed to unlink entity.'),
  });

  const addContractProviderMutation = useMutation({
    mutationFn: ({ contractId, providerId }: { contractId: string; providerId: string }) =>
      contractProvidersApi.add(contractId, providerId),
    onSuccess: () => {
      refetchContractProviders();
      setSelectedProviderId('');
      queryClient.invalidateQueries({ queryKey: ['supplyChainTree'] });
      toast.success('Subcontractor / co-provider linked.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to link provider.'),
  });

  const removeContractProviderMutation = useMutation({
    mutationFn: (id: string) => contractProvidersApi.remove(id),
    onSuccess: () => {
      refetchContractProviders();
      queryClient.invalidateQueries({ queryKey: ['supplyChainTree'] });
      toast.success('Provider unlinked.');
    },
    onError: () => toast.error('Failed to unlink provider.'),
  });

  const onSubmit = (data: ContractFormValues) => {
    const payload = {
      ...data,
      ictServiceTypeId: data.ictServiceTypeId ? Number(data.ictServiceTypeId) : undefined,
      relianceLevelId: data.relianceLevelId ? Number(data.relianceLevelId) : undefined,
      dataSensitivityId: data.dataSensitivityId ? Number(data.dataSensitivityId) : undefined,
      terminationNoticePeriod: data.terminationNoticePeriod ? Number(data.terminationNoticePeriod) : undefined,
      startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
      endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
      subcontractorProviderId: data.subcontractorProviderId || undefined,
      contractType: data.contractType || undefined,
      renewalTerms: data.renewalTerms || undefined,
      serviceDescription: data.serviceDescription || undefined,
      governingLawCountry: data.governingLawCountry || undefined,
      serviceCountry: data.serviceCountry || undefined,
      processingLocation: data.processingLocation || undefined,
      storageLocation: data.storageLocation || undefined,
      annualCost: data.annualCost ? Number(data.annualCost) : undefined,
      currency: data.currency || undefined,
    };

    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  };

  const openCreateDialog = () => {
    setEditingId(null);
    reset();
    setIsDialogOpen(true);
  };

  const openEditDialog = (contract: any) => {
    setEditingId(contract.id);
    reset({
      contractReference: contract.contractReference,
      contractType: contract.contractType || '',
      financialEntityId: contract.financialEntityId,
      providerId: contract.providerId,
      subcontractorProviderId: contract.subcontractorProviderId || '',
      ictServiceTypeId: contract.ictServiceTypeId?.toString() || '',
      relianceLevelId: contract.relianceLevelId?.toString() || '',
      dataSensitivityId: contract.dataSensitivityId?.toString() || '',
      startDate: contract.startDate ? contract.startDate.split('T')[0] : '',
      endDate: contract.endDate ? contract.endDate.split('T')[0] : '',
      renewalTerms: contract.renewalTerms || '',
      terminationNoticePeriod: contract.terminationNoticePeriod?.toString() || '',
      serviceDescription: contract.serviceDescription || '',
      governingLawCountry: contract.governingLawCountry || '',
      serviceCountry: contract.serviceCountry || '',
      processingLocation: contract.processingLocation || '',
      storageLocation: contract.storageLocation || '',
      dataStorage: contract.dataStorage || false,
      providedByContractor: contract.providedByContractor ?? true,
      providedBySubcontractor: contract.providedBySubcontractor || false,
      annualCost: contract.annualCost?.toString() || '',
      currency: contract.currency || '',
    });
    setIsDialogOpen(true);
  };

  const openDepDialog = async (contract: any) => {
    const detail = await contractualArrangementsApi.getById(contract.id);
    setSelectedContract(detail);
    setIsDepDialogOpen(true);
  };

  useEffect(() => {
    if (openContractId && contracts) {
      const contract = contracts.find(c => c.id === openContractId);
      if (contract && contract.id !== editingId) {
        openEditDialog(contract);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openContractId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [openContractId, contracts, editingId, searchParams, setSearchParams]);

  // openId: generic deep-link from validation engine (same behaviour as openContractId)
  useEffect(() => {
    if (openId && contracts && !openContractId) {
      const contract = contracts.find(c => c.id === openId);
      if (contract && contract.id !== editingId) {
        openEditDialog(contract);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [openId, contracts, editingId]); // eslint-disable-line

  const filteredContracts = contracts?.filter(c => 
    c.contractReference.toLowerCase().includes(search.toLowerCase()) || 
    c.financialEntity?.name.toLowerCase().includes(search.toLowerCase()) ||
    c.provider?.legalName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {issueFixedPrompt && !showFixNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-teal-400" /> Is this issue fixed?</h2>
            <p className="text-sm text-zinc-400">You just saved changes. Has the flagged compliance issue been resolved?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setIssueFixedPrompt(null); toast.success('Contract updated successfully.'); }} className="px-4 py-2 text-sm text-zinc-400 bg-zinc-800 rounded-lg">No — not yet</button>
              <button onClick={() => setShowFixNote(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Yes — submit fix</button>
            </div>
          </div>
        </div>
      )}
      {issueFixedPrompt && showFixNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-teal-400" /> Submit Fix for Analyst Approval</h2>
            <textarea value={fixNote} onChange={e => setFixNote(e.target.value)} rows={3} placeholder="e.g. Updated start date to correct ISO format." className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500 resize-none" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowFixNote(false); setIssueFixedPrompt(null); toast.success('Contract updated successfully.'); }} className="px-4 py-2 text-sm text-zinc-400 bg-zinc-800 rounded-lg">Cancel</button>
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
            <FileText className="w-6 h-6 text-indigo-400" />
            {t('Contractual Arrangements')}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">DORA RT.05: Manage ICT service contracts, vendors, and risk thresholds.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <RoleGuard allowed={['EDITOR']}>
            <DialogTrigger asChild>
              <button onClick={openCreateDialog} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> Add Contract
              </button>
            </DialogTrigger>
          </RoleGuard>
          <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 dark max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-6">
            <DialogHeader className="shrink-0 mb-4">
              <DialogTitle>{editingId ? (user?.role === 'ANALYST' ? 'View/Review Contract' : 'Edit Contract') : 'New Contract'}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto flex gap-6 pr-2">
              <div className="flex-1 space-y-4">
                <fieldset disabled={user?.role !== 'EDITOR'} className="contents">
                  <form id="contract-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Issue hint — shown when navigated from validation deep-link */}
                    {fieldKey && editingId && (
                      <IssueHintBanner
                        fieldKey={fieldKey}
                        message={searchParams.get('message') || undefined}
                        analystNote={searchParams.get('analystNote') || undefined}
                      />
                    )}
                    {/* Section 1: Core Information */}
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-400 mb-3 border-b border-zinc-800 pb-2">1. Core Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <FieldLabel label="Contract Reference" required doraRef="RT.05.01.0010" tooltip="Unique reference identifier for the contractual arrangement." />
                          <input {...register('contractReference')} className={getInputClass('contractReference')} />
                          {errors.contractReference && <p className="text-rose-400 text-xs">{errors.contractReference.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Contract Type" doraRef="RT.05.01.0020" tooltip="E.g., Master Services Agreement, Cloud Services." />
                          <input {...register('contractType')} className={getInputClass('contractType')} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="space-y-1">
                          <FieldLabel label="Financial Entity" required doraRef="RT.05.01.0030" tooltip="The internally regulated entity receiving the service." />
                          <select {...register('financialEntityId')} className={getInputClass('financialEntityId')}>
                            <option value="">Select an Entity</option>
                            {financialEntities?.map(e => <option key={e.id} value={e.id}>{e.name} ({e.lei})</option>)}
                          </select>
                          {errors.financialEntityId && <p className="text-rose-400 text-xs">{errors.financialEntityId.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Main ICT Provider" required doraRef="RT.05.01.0040" tooltip="The external third-party provider." />
                          <select {...register('providerId')} className={getInputClass('providerId')}>
                            <option value="">Select a Provider</option>
                            {ictProviders?.map(p => <option key={p.id} value={p.id}>{p.legalName || p.providerCode}</option>)}
                          </select>
                          {errors.providerId && <p className="text-rose-400 text-xs">{errors.providerId.message}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Service & Classification */}
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-400 mb-3 border-b border-zinc-800 pb-2">2. Service & Classification</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <FieldLabel label="ICT Service Type" doraRef="RT.05.01.0050" tooltip="Classification of service per EBA definitions." />
                          <select {...register('ictServiceTypeId')} className={getInputClass('ictServiceTypeId')}>
                            <option value="">Select...</option>
                            {ictServiceTypes?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Reliance Level" doraRef="RT.05.01.0060" tooltip="Business criticality and substitutability level." />
                          <select {...register('relianceLevelId')} className={getInputClass('relianceLevelId')}>
                            <option value="">Select...</option>
                            {relianceLevels?.map((r: any) => <option key={r.id} value={r.id}>{r.levelName}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Data Sensitivity" doraRef="RT.05.01.0070" tooltip="Highest classification of data involved." />
                          <select {...register('dataSensitivityId')} className={getInputClass('dataSensitivityId')}>
                            <option value="">Select...</option>
                            {dataSensitivityLevels?.map((d: any) => <option key={d.id} value={d.id}>{d.levelName}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="mt-4 space-y-1">
                        <FieldLabel label="Service Description" doraRef="RT.05.01.0080" tooltip="Summary of the ICT services provided." />
                        <textarea {...register('serviceDescription')} className={`${getInputClass('serviceDescription')} min-h-[60px]`} />
                      </div>
                    </div>

                    {/* Section 3: Timeframe & Locations */}
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-400 mb-3 border-b border-zinc-800 pb-2">3. Timeframe & Locations</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <FieldLabel label="Start Date" required doraRef="RT.05.01.0090" tooltip="Contract commencement date." />
                          <input type="date" {...register('startDate')} className={getInputClass('startDate')} />
                          {errors.startDate && <p className="text-rose-400 text-xs">{errors.startDate.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="End Date" required doraRef="RT.05.01.0100" tooltip="Contract termination or expiry date." />
                          <input type="date" {...register('endDate')} className={getInputClass('endDate')} />
                          {errors.endDate && <p className="text-rose-400 text-xs">{errors.endDate.message}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mt-4 items-end">
                        <div className="space-y-1">
                          <FieldLabel label="Service Ctry" doraRef="RT.05.01.0110" tooltip="Country where the service is predominantly delivered from." />
                          <select {...register('serviceCountry')} className={getInputClass('serviceCountry')}>
                            <option value="">-</option>
                            {countries?.map((c: any) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Processing" doraRef="RT.05.01.0120" tooltip="Location where data processing occurs." />
                          <select {...register('processingLocation')} className={getInputClass('processingLocation')}>
                            <option value="">-</option>
                            {countries?.map((c: any) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Storage" doraRef="RT.05.01.0130" tooltip="Primary location for data at rest." />
                          <select {...register('storageLocation')} className={getInputClass('storageLocation')}>
                            <option value="">-</option>
                            {countries?.map((c: any) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Gov. Law" doraRef="RT.05.01.0140" tooltip="Applicable legal jurisdiction for the agreement." />
                          <select {...register('governingLawCountry')} className={getInputClass('governingLawCountry')}>
                            <option value="">-</option>
                            {countries?.map((c: any) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                          </select>
                        </div>
                      </div>
                      {/* Data Storage toggle — VR_62: when true, storageLocation becomes required */}
                      <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                        <input
                          type="checkbox"
                          id="dataStorage"
                          {...register('dataStorage')}
                          className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <label htmlFor="dataStorage" className="text-sm font-medium text-zinc-300 cursor-pointer">Personal Data Storage Involved</label>
                          <p className="text-xs text-zinc-500 mt-0.5">Is personal/sensitive data stored as part of this service? (EBA VR_62 — requires Storage Location when enabled)</p>
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Cost & Terms */}
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-400 mb-3 border-b border-zinc-800 pb-2">4. Cost & Terms (EBA RT.02.01)</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <FieldLabel label="Annual Cost" doraRef="RT.02.01.c0050" tooltip="Total annual cost of this contractual arrangement. Required for systemic risk analysis (EBA VR_45)." />
                          <input type="number" step="0.01" {...register('annualCost')} className={getInputClass('annualCost')} placeholder="0.00" />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Currency" doraRef="RT.02.01.c0040" tooltip="Currency in which costs are denominated." />
                          <select {...register('currency')} className={getInputClass('currency')}>
                            <option value="">-</option>
                            {currencies?.map((c: any) => <option key={c.code} value={c.code}>{c.name || c.code} ({c.code})</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel label="Termination Notice (days)" doraRef="RT.02.02.c0100" tooltip="Notice period in days required to terminate the contract." />
                          <input type="number" {...register('terminationNoticePeriod')} className={getInputClass('terminationNoticePeriod')} placeholder="30" />
                        </div>
                      </div>
                      <div className="mt-4 space-y-1">
                        <FieldLabel label="Renewal Terms" tooltip="Description of renewal conditions or automatic rollover clauses." />
                        <select {...register('renewalTerms')} className={getInputClass('renewalTerms')}>
                          <option value="">-</option>
                          <option value="Auto-renewal for 12 months">Auto-renewal for 12 months</option>
                          <option value="Auto-renewal (Monthly)">Auto-renewal (Monthly)</option>
                          <option value="Manual renewal">Manual renewal</option>
                          <option value="No renewal (Fixed term)">No renewal (Fixed term)</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Section 5: Subcontractor & Service Delivery */}
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-400 mb-3 border-b border-zinc-800 pb-2">5. Subcontractor &amp; Service Delivery (EBA RT.02.02)</h3>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <FieldLabel label="Subcontractor Provider" doraRef="RT.02.02" tooltip="If the service is delivered partly or wholly via a subcontractor, select them here. DORA Art. 28(3) supply chain transparency requirement." />
                          <select {...register('subcontractorProviderId')} className={getInputClass('subcontractorProviderId')}>
                            <option value="">— None (direct provision) —</option>
                            {ictProviders?.map(p => <option key={p.id} value={p.id}>{p.legalName || p.providerCode} {p.lei ? `(LEI: ${p.lei})` : ''}</option>)}
                          </select>
                          <p className="text-xs text-zinc-500 mt-1">Select the ICT provider that acts as a subcontractor for this service. Used for RT.05.02 supply chain reporting.</p>
                        </div>
                        <div className="flex gap-6">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" {...register('providedByContractor')} className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Service provided by primary contractor</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" {...register('providedBySubcontractor')} className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Service provided by subcontractor</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Submit */}
                    <div className="pt-4 flex justify-end gap-3 bottom-0">
                      <button type="button" onClick={() => (isDirty && user?.role === 'EDITOR') ? setShowCancelConfirm(true) : setIsDialogOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 pointer-events-auto">Close</button>
                      {user?.role === 'EDITOR' && (
                        <button type="submit" form="contract-form" disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 pointer-events-auto">
                          {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? 'Save Changes' : 'Create Contract')}
                        </button>
                      )}
                    </div>
                  </form>
                </fieldset>
              </div>
                
                {editingId && (
                  <div className="w-80 shrink-0 border-l border-zinc-800 pl-6 h-full flex flex-col">
                    <CommentsPanel entityType="ContractualArrangement" entityId={editingId} />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
      </div>

      {showCancelConfirm && (
        <ConfirmModal
          title="Cancel Edits"
          message="Are you sure you want to proceed? Any unsaved changes will be lost."
          onConfirm={() => {
            setShowCancelConfirm(false);
            setIsDialogOpen(false);
          }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {/* Contextual Guidance */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3 items-start">
        <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-indigo-400">DORA Context: Contractual Arrangements</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Under DORA Art. 30, all contracts governing ICT services must be exhaustively documented. EBA guidelines require precision regarding cross-border data storage and processing locations to analyze systemic EU risk.
          </p>
        </div>
      </div>

      {/* Dependency Dialog — Manage Linked Relationships */}
      <Dialog open={isDepDialogOpen} onOpenChange={(open) => { setIsDepDialogOpen(open); if (!open) { setConfirmUnlink(null); setSelectedFnId(''); setSelectedEntityId(''); setSelectedProviderId(''); } }} modal={!confirmUnlink}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 dark flex flex-col" style={{ maxWidth: confirmUnlink ? '56rem' : '42rem', maxHeight: '85vh', transition: 'max-width 0.25s ease' }}>
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Link2 className="w-5 h-5 text-indigo-400" />
              Manage Linked Relationships
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">
              Contract: <span className="font-mono text-zinc-300">{selectedContract?.contractReference}</span>
            </p>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex border-b border-zinc-800 mt-3 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveManageTab('relationships')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeManageTab === 'relationships' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Activity className="w-4 h-4" /> Business Functions
              {selectedContract?.ictDependencies?.length ? (
                <span className="ml-1 text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold">{selectedContract.ictDependencies.length}</span>
              ) : null}
            </button>
            <button
              onClick={() => setActiveManageTab('entities')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeManageTab === 'entities' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Building2 className="w-4 h-4" /> Linked Entities
              {contractEntityLinks?.length ? (
                <span className="ml-1 text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold">{contractEntityLinks.length}</span>
              ) : null}
            </button>
            <button
              onClick={() => setActiveManageTab('providers')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeManageTab === 'providers' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Server className="w-4 h-4" /> Subcontractors
              {contractProviderLinks?.length ? (
                <span className="ml-1 text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold">{contractProviderLinks.length}</span>
              ) : null}
            </button>
          </div>

          <div className="flex flex-1 gap-0 overflow-hidden mt-4" style={{ minHeight: 0 }}>
            {/* Main scrollable tab content */}
            <div className={`overflow-y-auto pr-1 space-y-4 transition-opacity duration-200 ${confirmUnlink ? 'flex-shrink-0 w-[26rem] opacity-40 pointer-events-none' : 'flex-1'}`}>

            {/* ── Tab: Business Functions ─────────────────────────────────── */}
            {activeManageTab === 'relationships' && (
              <div className="space-y-4">
                {/* DORA context banner */}
                <div className="rounded-xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 p-3 flex gap-2.5 items-start">
                  <Activity className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Linking a business function means this contract <strong className="text-zinc-200">directly supports</strong> that function's continuity.
                    Required for <span className="text-indigo-300 font-medium">DORA Art. 30 §3</span> completeness.
                    {selectedContract?.ictDependencies?.length > 0 && (
                      <span className="ml-1 text-emerald-400">✓ {selectedContract.ictDependencies.length} function{selectedContract.ictDependencies.length !== 1 ? 's' : ''} linked.</span>
                    )}
                  </p>
                </div>

                {/* Link form — EDITOR only */}
                <RoleGuard allowed={['EDITOR']}>
                  <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      <span className="text-sm font-semibold text-zinc-200">Link a Business Function</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={selectedFnId}
                        onChange={e => setSelectedFnId(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg py-2.5 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                      >
                        <option value="">Select a function to link...</option>
                        {businessFunctions
                          ?.filter(fn => !selectedContract?.ictDependencies?.some((d: any) => d.functionId === fn.id))
                          .map(fn => (
                            <option key={fn.id} value={fn.id}>{fn.functionIdentifier} — {fn.functionName}</option>
                          ))}
                      </select>
                      <button
                        onClick={() => {
                          if (selectedFnId) {
                            addDepMutation.mutate({ fnId: selectedFnId, contractId: selectedContract.id });
                            setSelectedFnId('');
                          }
                        }}
                        disabled={!selectedFnId || addDepMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-4 py-2.5 rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5 text-sm font-medium shrink-0 shadow-lg shadow-indigo-900/30"
                      >
                        {addDepMutation.isPending
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><Link2 className="w-4 h-4" /><span className="hidden sm:inline">Link</span></>}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-600">
                      Only functions not already linked are shown. Linking updates the DORA Register of Information immediately.
                    </p>
                  </div>
                </RoleGuard>

                {/* Linked Functions list */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Linked Functions
                    </p>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                      {selectedContract?.ictDependencies?.length || 0}
                    </span>
                  </div>

                  {!selectedContract?.ictDependencies?.length ? (
                    <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-zinc-800/80 rounded-xl text-center">
                      <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-3">
                        <Activity className="w-5 h-5 text-zinc-700" />
                      </div>
                      <p className="text-sm font-medium text-zinc-500">No functions linked yet</p>
                      <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                        Use the selector above to establish the first ICT dependency for this contract.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedContract.ictDependencies.map((dep: any, idx: number) => (
                        <div
                          key={dep.id}
                          className="group flex items-center justify-between p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-200"
                          style={{ animationDelay: `${idx * 40}ms` }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Status dot */}
                            <div className="relative shrink-0">
                              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center ring-1 ring-indigo-500/20">
                                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-zinc-900" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-100 truncate leading-tight">
                                {dep.businessFunction?.functionName}
                              </p>
                              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                                {dep.businessFunction?.functionIdentifier}
                              </p>
                            </div>
                          </div>
                          <RoleGuard allowed={['EDITOR']}>
                            <button
                              onClick={() => setConfirmUnlink({
                                type: 'function',
                                id: dep.id,
                                payload: { fnId: dep.functionId, contractId: selectedContract.id },
                                name: dep.businessFunction?.functionName || dep.businessFunction?.functionIdentifier || 'this function',
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
              </div>
            )}

            {/* ── Tab: Linked Entities (EBA RT.03) ───────────────────────── */}
            {activeManageTab === 'entities' && (
              <>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-xs text-amber-300">
                    <strong>EBA RT.03:</strong> Record all financial entities that are party to this contract.
                    Required for the Register of Information sub-template.
                  </p>
                </div>

                <RoleGuard allowed={['EDITOR']}>
                  <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-semibold text-zinc-200">Link Financial Entity</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={selectedEntityId}
                        onChange={e => setSelectedEntityId(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Select entity to link...</option>
                        {financialEntities?.filter(fe => !contractEntityLinks?.some(l => l.financialEntityId === fe.id)).map(fe => (
                          <option key={fe.id} value={fe.id}>{fe.name} ({fe.lei})</option>
                        ))}
                      </select>
                      <button
                        onClick={() => { if (selectedEntityId) addContractEntityMutation.mutate({ contractId: selectedContract.id, financialEntityId: selectedEntityId }); }}
                        disabled={!selectedEntityId || addContractEntityMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium shrink-0"
                      >
                        {addContractEntityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4" /><span className="hidden sm:inline">Link Entity</span></>}
                      </button>
                    </div>
                  </div>
                </RoleGuard>

                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    Linked Entities ({contractEntityLinks?.length || 0})
                  </p>
                  <div className="space-y-2">
                    {!contractEntityLinks?.length ? (
                      <div className="flex flex-col items-center justify-center py-10 border border-dashed border-zinc-800 rounded-xl text-center">
                        <Building2 className="w-8 h-8 text-zinc-700 mb-2" />
                        <p className="text-sm text-zinc-500">No entities linked yet.</p>
                        <p className="text-xs text-zinc-600 mt-1">Add the financial entities that are party to this contract.</p>
                      </div>
                    ) : contractEntityLinks?.map(link => (
                      <div key={link.id} className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-md bg-teal-500/10 shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-teal-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{link.financialEntity?.name}</p>
                            <p className="text-xs text-zinc-500 font-mono">{link.financialEntity?.lei}</p>
                          </div>
                        </div>
                        <RoleGuard allowed={['EDITOR']}>
                          <button
                            onClick={() => setConfirmUnlink({
                              type: 'entity',
                              id: link.id,
                              payload: link.id,
                              name: link.financialEntity?.name || 'this entity',
                            })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-500/20 rounded-md transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Unlink className="w-3.5 h-3.5" /> Remove Link
                          </button>
                        </RoleGuard>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Tab: Subcontractors (EBA RT.02 Annex III) ──────────────── */}
            {activeManageTab === 'providers' && (
              <>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-xs text-amber-300">
                    <strong>EBA RT.02 Annex III:</strong> Record subcontractors, co-signatories, and intermediary
                    providers in the service chain for supply chain transparency.
                  </p>
                </div>

                <RoleGuard allowed={['EDITOR']}>
                  <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Server className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-semibold text-zinc-200">Link Subcontractor / Co-Provider</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={selectedProviderId}
                        onChange={e => setSelectedProviderId(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Select provider to link...</option>
                        {ictProviders?.filter(p => p.id !== selectedContract?.providerId && !contractProviderLinks?.some(l => l.providerId === p.id)).map(p => (
                          <option key={p.id} value={p.id}>{p.legalName || p.providerCode} {p.lei ? `(LEI: ${p.lei})` : ''}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => { if (selectedProviderId) addContractProviderMutation.mutate({ contractId: selectedContract.id, providerId: selectedProviderId }); }}
                        disabled={!selectedProviderId || addContractProviderMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium shrink-0"
                      >
                        {addContractProviderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4" /><span className="hidden sm:inline">Link Provider</span></>}
                      </button>
                    </div>
                  </div>
                </RoleGuard>

                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    Linked Subcontractors ({contractProviderLinks?.length || 0})
                  </p>
                  {selectedContract?.provider && (
                    <div className="flex items-center gap-3 p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-lg mb-2">
                      <div className="p-1.5 rounded-md bg-zinc-700/50 shrink-0">
                        <Server className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-300">{selectedContract.provider.legalName || selectedContract.provider.providerCode}</p>
                        <p className="text-xs text-zinc-600">Primary provider — already on record</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {!contractProviderLinks?.length ? (
                      <div className="flex flex-col items-center justify-center py-10 border border-dashed border-zinc-800 rounded-xl text-center">
                        <Server className="w-8 h-8 text-zinc-700 mb-2" />
                        <p className="text-sm text-zinc-500">No subcontractors linked yet.</p>
                        <p className="text-xs text-zinc-600 mt-1">Link additional providers that take part in this service chain.</p>
                      </div>
                    ) : contractProviderLinks?.map(link => (
                      <div key={link.id} className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-md bg-orange-500/10 shrink-0">
                            <Server className="w-3.5 h-3.5 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{link.provider?.legalName || link.provider?.providerCode}</p>
                            <p className="text-xs text-zinc-500 font-mono">LEI: {link.provider?.lei || '—'}</p>
                          </div>
                        </div>
                        <RoleGuard allowed={['EDITOR']}>
                          <button
                            onClick={() => setConfirmUnlink({
                              type: 'provider',
                              id: link.id,
                              payload: link.id,
                              name: link.provider?.legalName || link.provider?.providerCode || 'this provider',
                            })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-500/20 rounded-md transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Unlink className="w-3.5 h-3.5" /> Remove Link
                          </button>
                        </RoleGuard>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            </div>{/* end main scrollable content */}

            {/* Right-side confirmation panel — always visible, never hidden */}
            {confirmUnlink && (
              <div className="w-72 shrink-0 border-l border-zinc-800 pl-5 flex flex-col justify-center space-y-5">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <Unlink className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="text-sm font-bold text-zinc-100">Remove Link?</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    You are about to remove the link to:
                  </p>
                  <div className="bg-zinc-900 border border-red-500/20 rounded-lg p-3">
                    <p className="text-sm font-semibold text-red-300 break-words">"{confirmUnlink.name}"</p>
                    <p className="text-[11px] text-zinc-500 mt-1 capitalize">{confirmUnlink.type} relationship</p>
                  </div>
                  <p className="text-xs text-zinc-600">
                    This will update the DORA Register of Information immediately.
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      try {
                        if (confirmUnlink.type === 'function') {
                          await removeDepMutation.mutateAsync(confirmUnlink.payload);
                          const d = await contractualArrangementsApi.getById(selectedContract.id);
                          setSelectedContract(d);
                        } else if (confirmUnlink.type === 'entity') {
                          await removeContractEntityMutation.mutateAsync(confirmUnlink.payload);
                        } else if (confirmUnlink.type === 'provider') {
                          await removeContractProviderMutation.mutateAsync(confirmUnlink.payload);
                        }
                      } finally {
                        setConfirmUnlink(null);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-red-900/30"
                    disabled={removeDepMutation.isPending || removeContractEntityMutation.isPending || removeContractProviderMutation.isPending}
                  >
                    {(removeDepMutation.isPending || removeContractEntityMutation.isPending || removeContractProviderMutation.isPending)
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><Unlink className="w-4 h-4" /> Confirm Remove</>}
                  </button>
                  <button
                    onClick={() => setConfirmUnlink(null)}
                    className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-zinc-800/50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </div>{/* end split-pane flex wrapper */}
        </DialogContent>
      </Dialog>

      {/* NOTE: ConfirmModal is now rendered INSIDE the dialog as a side panel — see below */}

      <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search Reference, Entity or Provider..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Reference</th>
                <th className="px-6 py-4 font-medium">Financial Entity</th>
                <th className="px-6 py-4 font-medium">Main Provider</th>
                <th className="px-6 py-4 font-medium">Service Type</th>
                <th className="px-6 py-4 font-medium">Start Date</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading contracts...</td></tr>
              ) : filteredContracts?.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-500">No contracts found.</td></tr>
              ) : (
                filteredContracts?.map((contract) => (
                  <tr
                    key={contract.id}
                    ref={contract.id === highlightId ? highlightRef : null}
                    className={`hover:bg-zinc-900/50 transition-colors group ${
                      contract.id === highlightId
                        ? 'ring-1 ring-inset ring-indigo-500/60 bg-indigo-500/5 animate-pulse-once'
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4 font-medium text-zinc-200">{contract.contractReference}</td>
                    <td className="px-6 py-4 text-zinc-400">{contract.financialEntity?.name}</td>
                    <td className="px-6 py-4 text-zinc-400">{contract.provider?.legalName || contract.provider?.providerCode}</td>
                    <td className="px-6 py-4 text-zinc-400">{contract.ictServiceType?.name || '-'}</td>
                    <td className="px-6 py-4 text-zinc-400">{contract.startDate ? new Date(contract.startDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openDepDialog(contract)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 hover:border-indigo-500 transition-colors group/dep mr-2 text-zinc-400 hover:text-zinc-200"
                        >
                          <Link2 className="w-3.5 h-3.5 text-zinc-500 group-hover/dep:text-indigo-400" />
                          <span className="text-xs font-medium">Links ({contract.ictDependencies?.length || 0})</span>
                        </button>
                        <RoleGuard allowed={['EDITOR', 'ANALYST', 'ADMIN']}>
                          <button onClick={() => openEditDialog(contract)} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-md">
                            {user?.role === 'EDITOR' ? <Pencil className="w-4 h-4" /> : <Search className="w-4 h-4" />}
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
