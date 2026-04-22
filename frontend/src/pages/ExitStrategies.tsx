import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exitStrategiesApi, type ExitStrategy } from '../api/exitStrategies';
import { contractualArrangementsApi } from '../api/contractualArrangements';
import { ictProvidersApi } from '../api/ictProviders';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import RoleGuard from '../components/RoleGuard';
import { useToast } from '../components/ToastProvider';
import { useAuthStore } from '../store/authStore';
import CommentsPanel from '../components/CommentsPanel';
import { LogOut, Plus, Search, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';

const exitSchema = z.object({
  contractId: z.string().min(1, 'Contract is required'),
  exitTrigger: z.string().min(1, 'Exit trigger is required'),
  exitStrategy: z.string().min(1, 'Exit plan is required'),
  fallbackProviderId: z.string().optional().or(z.literal('')),
});
type ExitFormValues = z.infer<typeof exitSchema>;

export default function ExitStrategies() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const openExitStrategyId = searchParams.get('openExitStrategyId');
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ExitFormValues>({
    resolver: zodResolver(exitSchema),
    defaultValues: { contractId: '', exitTrigger: '', exitStrategy: '', fallbackProviderId: '' },
  });

  const { data: strategies, isLoading } = useQuery({
    queryKey: ['exit-strategies'],
    queryFn: () => exitStrategiesApi.getAll(),
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
    mutationFn: exitStrategiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exit-strategies'] });
      setIsDialogOpen(false);
      reset();
      toast.success('Exit strategy created successfully.');
    },
    onError: () => toast.error('Failed to create exit strategy. Ensure all fields are valid.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => exitStrategiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exit-strategies'] });
      setIsDialogOpen(false);
      setEditingId(null);
      reset();
      toast.success('Exit strategy updated successfully.');
    },
    onError: () => toast.error('Failed to update exit strategy.'),
  });

  const deleteMutation = useMutation({
    mutationFn: exitStrategiesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exit-strategies'] });
      toast.success('Exit strategy deleted.');
    },
  });

  const onSubmit = (data: ExitFormValues) => {
    const payload = {
      ...data,
      fallbackProviderId: data.fallbackProviderId || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    reset({ contractId: '', exitTrigger: '', exitStrategy: '', fallbackProviderId: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: ExitStrategy) => {
    setEditingId(item.id);
    reset({
      contractId: item.contractId,
      exitTrigger: item.exitTrigger,
      exitStrategy: item.exitStrategy,
      fallbackProviderId: item.fallbackProviderId || '',
    });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (openExitStrategyId && strategies) {
      const strategy = strategies.find(s => s.id === openExitStrategyId);
      if (strategy && strategy.id !== editingId) {
        openEditDialog(strategy);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openExitStrategyId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [openExitStrategyId, strategies, editingId, searchParams, setSearchParams]);

  const filtered = strategies?.filter(s =>
    s.contract?.contractReference?.toLowerCase().includes(search.toLowerCase()) ||
    s.exitTrigger.toLowerCase().includes(search.toLowerCase()) ||
    s.fallbackProvider?.legalName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <LogOut className="w-6 h-6 text-orange-400" />
            Exit Strategies
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            DORA Art. 28§8 — Define exit plans and fallback providers for ICT service arrangements (EBA RT.08).
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <RoleGuard allowed={['EDITOR']}>
            <DialogTrigger asChild>
              <button onClick={openCreateDialog} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> New Exit Strategy
              </button>
            </DialogTrigger>
          </RoleGuard>
          <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 dark max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-6">
            <DialogHeader className="shrink-0 mb-4">
              <DialogTitle>{editingId ? (user?.role === 'ANALYST' ? 'View/Review Exit Strategy' : 'Edit Exit Strategy') : 'New Exit Strategy'}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto flex gap-6 pr-2">
              <div className="flex-1 space-y-4">
                <fieldset disabled={user?.role !== 'EDITOR'} className="contents">
                  <form id="exit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                    {/* Section 1: Contract Link */}
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 mb-3 border-b border-zinc-800 pb-2">1. Contract Reference</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Contractual Arrangement <span className="text-red-500">*</span></label>
                    <select
                      {...register('contractId')}
                      disabled={!!editingId}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                    >
                      <option value="">Select contract...</option>
                      {contracts?.map(c => (
                        <option key={c.id} value={c.id}>{c.contractReference} — {c.provider?.legalName || c.provider?.providerCode}</option>
                      ))}
                    </select>
                    {errors.contractId && <p className="text-red-400 text-xs">{errors.contractId.message}</p>}
                  </div>
                </div>

                {/* Section 2: Exit Conditions */}
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 mb-3 border-b border-zinc-800 pb-2">2. Exit Conditions & Plan</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Exit Trigger <span className="text-red-500">*</span>
                        <span className="text-xs text-zinc-500 ml-1">What event activates this exit plan?</span>
                      </label>
                      <input
                        {...register('exitTrigger')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                        placeholder="e.g. Provider insolvency, SLA breach > 30 days, Regulatory directive"
                      />
                      {errors.exitTrigger && <p className="text-red-400 text-xs">{errors.exitTrigger.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">Exit Strategy / Plan <span className="text-red-500">*</span>
                        <span className="text-xs text-zinc-500 ml-1">DORA Art. 28§8</span>
                      </label>
                      <textarea
                        {...register('exitStrategy')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm min-h-[120px] focus:outline-none focus:ring-1 focus:ring-orange-500"
                        placeholder="Describe the detailed exit plan: migration steps, timeline, data extraction, responsible party, communication protocol..."
                      />
                      {errors.exitStrategy && <p className="text-red-400 text-xs">{errors.exitStrategy.message}</p>}
                    </div>
                  </div>
                </div>

                {/* Section 3: Fallback */}
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 mb-3 border-b border-zinc-800 pb-2">3. Fallback Provider</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Alternative Provider</label>
                    <select
                      {...register('fallbackProviderId')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      <option value="">No fallback provider selected</option>
                      {providers?.map(p => (
                        <option key={p.id} value={p.id}>{p.providerCode} — {p.legalName}</option>
                      ))}
                    </select>
                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md mt-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300">
                        DORA Art. 28§8 requires exit strategies for critical ICT services. Identifying a fallback provider reduces concentration risk (RT.09).
                      </p>
                    </div>
                  </div>
                </div>

                  </form>
                </fieldset>
              </div>

              {editingId && (
                <div className="w-80 shrink-0 border-l border-zinc-800 pl-6 h-full flex flex-col">
                  <CommentsPanel entityType="ExitStrategy" entityId={editingId} />
                </div>
              )}
            </div>

            <div className="shrink-0 pt-4 flex justify-end gap-3 bg-zinc-950/90 border-t border-zinc-800 mt-4">
              <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 pointer-events-auto">Close</button>
              {user?.role === 'EDITOR' && (
                <button type="submit" form="exit-form" disabled={createMutation.isPending || updateMutation.isPending} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 pointer-events-auto">
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? 'Save Changes' : 'Create Exit Strategy')}
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contextual Guidance */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex gap-3 items-start">
        <LogOut className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-orange-400">DORA Context: Exit Strategies</h3>
          <p className="text-xs text-zinc-400 mt-1">
            For critical or important ICT services, DORA Art. 28§8 mandates a documented exit strategy to ensure operational continuity in case of provider failure. Mention fallback providers when applicable.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by contract, trigger, or provider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Contract</th>
                <th className="px-6 py-4 font-medium">Exit Trigger</th>
                <th className="px-6 py-4 font-medium">Fallback Provider</th>
                <th className="px-6 py-4 font-medium">Created</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                    Loading exit strategies...
                  </td>
                </tr>
              ) : filtered?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No exit strategies found. Define exit plans for your ICT contracts.
                  </td>
                </tr>
              ) : (
                filtered?.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-zinc-200">{item.contract?.contractReference || '-'}</td>
                    <td className="px-6 py-4 text-zinc-400 max-w-[200px] truncate">{item.exitTrigger}</td>
                    <td className="px-6 py-4">
                      {item.fallbackProvider ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                          {item.fallbackProvider.legalName || item.fallbackProvider.providerCode}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                          None defined
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <RoleGuard allowed={['EDITOR', 'ANALYST']}>
                          <button onClick={() => openEditDialog(item)} className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-orange-400/10 rounded-md transition-colors">
                            {user?.role === 'ANALYST' ? <Search className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                          </button>
                        </RoleGuard>
                        <RoleGuard allowed={['ADMIN']}>
                          <button onClick={() => { if (confirm('Delete this exit strategy?')) deleteMutation.mutate(item.id); }} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors">
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
