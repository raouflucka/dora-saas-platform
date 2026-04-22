import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ictServicesApi, type IctService } from '../api/ictServices';
import { ictProvidersApi } from '../api/ictProviders';
import { referenceApi } from '../api/reference';
import { validationApi } from '../api/validation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import RoleGuard from '../components/RoleGuard';
import { Cloud, Plus, Search, Pencil, Trash2, Loader2, CheckCircle2, ClipboardCheck, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/ToastProvider';

const CRITICALITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  Important: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Not Critical': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

const serviceSchema = z.object({
  providerId: z.string().min(1, 'Provider is required'),
  serviceName: z.string().min(1, 'Service name is required'),
  serviceDescription: z.string().optional().or(z.literal('')),
  serviceTypeId: z.string().optional().or(z.literal('')),
  criticalityLevelId: z.string().optional().or(z.literal('')),
  dataSensitivityId: z.string().optional().or(z.literal('')),
});
type ServiceFormValues = z.infer<typeof serviceSchema>;

export default function IctServices() {
  const { user } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const fieldKey = searchParams.get('fieldKey') || '';
  const [issueFixedPrompt, setIssueFixedPrompt] = useState<{ runId: string; ruleId: string; recordId: string } | null>(null);
  const [showFixNote, setShowFixNote] = useState(false);
  const [fixNote, setFixNote] = useState('');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { providerId: '', serviceName: '', serviceDescription: '', serviceTypeId: '', criticalityLevelId: '', dataSensitivityId: '' },
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ['ict-services'],
    queryFn: () => ictServicesApi.getAll(),
  });

  const { data: providers } = useQuery({
    queryKey: ['ict-providers'],
    queryFn: ictProvidersApi.getAll,
  });

  const { data: serviceTypes } = useQuery({
    queryKey: ['reference-ict-service-types'],
    queryFn: referenceApi.getIctServiceTypes,
  });

  const { data: criticalityLevels } = useQuery({
    queryKey: ['reference-criticality-levels'],
    queryFn: referenceApi.getCriticalityLevels,
  });

  const { data: dataSensitivityLevels } = useQuery({
    queryKey: ['reference-data-sensitivity-levels'],
    queryFn: referenceApi.getDataSensitivityLevels,
  });

  const createMutation = useMutation({
    mutationFn: ictServicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ict-services'] });
      setIsDialogOpen(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => ictServicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ict-services'] });
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
    mutationFn: ictServicesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ict-services'] }),
  });

  const onSubmit = (data: ServiceFormValues) => {
    const payload = {
      ...data,
      serviceTypeId: data.serviceTypeId ? Number(data.serviceTypeId) : undefined,
      criticalityLevelId: data.criticalityLevelId ? Number(data.criticalityLevelId) : undefined,
      dataSensitivityId: data.dataSensitivityId ? Number(data.dataSensitivityId) : undefined,
      serviceDescription: data.serviceDescription || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    reset({ providerId: '', serviceName: '', serviceDescription: '', serviceTypeId: '', criticalityLevelId: '', dataSensitivityId: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: IctService) => {
    setEditingId(item.id);
    reset({
      providerId: item.providerId,
      serviceName: item.serviceName,
      serviceDescription: item.serviceDescription || '',
      serviceTypeId: item.serviceTypeId?.toString() || '',
      criticalityLevelId: item.criticalityLevelId?.toString() || '',
      dataSensitivityId: item.dataSensitivityId?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const filtered = services?.filter(s =>
    s.serviceName.toLowerCase().includes(search.toLowerCase()) ||
    s.provider?.legalName?.toLowerCase().includes(search.toLowerCase()) ||
    s.provider?.providerCode?.toLowerCase().includes(search.toLowerCase()) ||
    s.serviceType?.name?.toLowerCase().includes(search.toLowerCase())
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
            <Cloud className="w-6 h-6 text-cyan-400" />
            ICT Services
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Register ICT services provided by third-party providers (EBA RT.05, DORA Art. 28§2).
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <RoleGuard allowed={['EDITOR']}>
            <DialogTrigger asChild>
              <button onClick={openCreateDialog} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> Add Service
              </button>
            </DialogTrigger>
          </RoleGuard>
          <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 dark max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit ICT Service' : 'New ICT Service'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
                <fieldset disabled={user?.role !== 'EDITOR'} className="contents">
                {/* Section 1: Service Identity */}
                <div>
                  <h3 className="text-sm font-semibold text-cyan-400 mb-3 border-b border-zinc-800 pb-2">1. Service Identification</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">ICT Provider <span className="text-red-500">*</span></label>
                      <select
                        {...register('providerId')}
                        disabled={!!editingId}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
                      >
                        <option value="">Select provider...</option>
                        {providers?.map(p => (
                          <option key={p.id} value={p.id}>{p.providerCode} — {p.legalName}</option>
                        ))}
                      </select>
                      {errors.providerId && <p className="text-red-400 text-xs">{errors.providerId.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Service Name <span className="text-red-500">*</span></label>
                      <input
                        {...register('serviceName')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        placeholder="e.g. Cloud Hosting, Payment Gateway"
                      />
                      {errors.serviceName && <p className="text-red-400 text-xs">{errors.serviceName.message}</p>}
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Service Description</label>
                    <textarea
                      {...register('serviceDescription')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      placeholder="Describe the scope and nature of this ICT service..."
                    />
                  </div>
                </div>

                {/* Section 2: Classification */}
                <div>
                  <h3 className="text-sm font-semibold text-cyan-400 mb-3 border-b border-zinc-800 pb-2">2. Classification & Risk</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Service Type
                        <span className="text-xs text-zinc-500 ml-1">EBA RT.05</span>
                      </label>
                      <select
                        {...register('serviceTypeId')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="">Select...</option>
                        {serviceTypes?.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Criticality Level</label>
                      <select
                        {...register('criticalityLevelId')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="">Select...</option>
                        {criticalityLevels?.map((l: any) => (
                          <option key={l.id} value={l.id}>{l.levelName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Data Sensitivity</label>
                      <select
                        {...register('dataSensitivityId')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="">Select...</option>
                        {dataSensitivityLevels?.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.levelName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                </fieldset>
                <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-zinc-950/90 py-4 backdrop-blur-sm border-t border-zinc-800">
                  <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">{user?.role !== 'EDITOR' ? 'Close' : 'Cancel'}</button>
                  {user?.role === 'EDITOR' && (
                    <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 pointer-events-auto">
                      {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? 'Save Changes' : 'Create Service')}
                    </button>
                  )}
                </div>
              </form>
            </DialogContent>
          </Dialog>
      </div>

      {/* Contextual Guidance */}
      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 flex gap-3 items-start">
        <Cloud className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-cyan-400">DORA Context: ICT Services</h3>
          <p className="text-xs text-zinc-400 mt-1">
            DORA Art. 28 demands a comprehensive mapping of all ICT services provided by third-party vendors. Ensure proper alignment with your contracts to maintain an accurate Register of Information (EBA RT.05).
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by service name, provider, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Service Name</th>
                <th className="px-6 py-4 font-medium">Provider</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium text-center">Criticality</th>
                <th className="px-6 py-4 font-medium text-center">Data Sensitivity</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                    Loading ICT services...
                  </td>
                </tr>
              ) : filtered?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No ICT services found. Register your provider services to get started.
                  </td>
                </tr>
              ) : (
                filtered?.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-200">{item.serviceName}</div>
                      {item.serviceDescription && (
                        <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-[200px]">{item.serviceDescription}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{item.provider?.legalName || item.provider?.providerCode || '-'}</td>
                    <td className="px-6 py-4 text-zinc-400">{item.serviceType?.name || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      {item.criticalityLevel?.levelName ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${CRITICALITY_COLORS[item.criticalityLevel.levelName] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                          {item.criticalityLevel.levelName}
                        </span>
                      ) : (
                        <span className="text-zinc-600 italic">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-zinc-400">
                      {item.dataSensitivity?.levelName || <span className="text-zinc-600 italic">Not set</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <RoleGuard allowed={['ADMIN', 'EDITOR', 'ANALYST']}>
                          <button onClick={() => openEditDialog(item)} className="p-1.5 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-md transition-colors">
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
