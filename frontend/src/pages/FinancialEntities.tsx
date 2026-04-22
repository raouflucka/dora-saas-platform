import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialEntitiesApi } from '../api/financialEntities';
import { referenceApi } from '../api/reference';
import { useAuthStore } from '../store/authStore';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ToastProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import RoleGuard from '../components/RoleGuard';
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Info,
  MoreVertical
} from 'lucide-react';
import IssueHintBanner from '../components/IssueHintBanner';

const entitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  lei: z.string()
    .min(1, 'LEI is required')
    .length(20, 'LEI must be exactly 20 characters (ISO 17442)')
    .refine(v => /^[A-Z0-9]{18}[0-9]{2}$/.test(v.toUpperCase()), { message: 'LEI must be exactly 20 alphanumeric characters (18 alphanumeric + 2 check digits)' })
    .transform(v => v.toUpperCase()),
  entityTypeId: z.string().optional().or(z.literal('')),
  country: z.string().max(2).optional().or(z.literal('')),
  currency: z.string().max(3).optional().or(z.literal('')),
  parentEntityId: z.string().optional().or(z.literal('')),
  integrationDate: z.string().optional().or(z.literal('')),
  deletionDate: z.string().optional().or(z.literal('')),
  totalAssets: z.string().optional().or(z.literal('')),
});
type EntityFormValues = z.infer<typeof entitySchema>;

export default function FinancialEntities() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  // Deep-link from validation engine
  const openId = searchParams.get('openId');
  const fieldKey = searchParams.get('fieldKey') || '';
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  // Scroll to highlighted row after data loads
  useEffect(() => {
    if ((highlightId || openId) && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId, openId]);

  // Auto-open edit dialog when navigated from validation deep-link
  const { data: entities, isLoading } = useQuery({
    queryKey: ['financial-entities'],
    queryFn: financialEntitiesApi.getAll,
  });

  useEffect(() => {
    if (openId && entities) {
      const entity = entities.find((e: any) => e.id === openId);
      if (entity && entity.id !== editingId) {
        openEditDialog(entity);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [openId, entities, editingId]); // eslint-disable-line

  const { register, handleSubmit, formState: { errors, touchedFields, dirtyFields }, reset, watch } = useForm<EntityFormValues>({
    resolver: zodResolver(entitySchema),
    mode: 'onChange',
    defaultValues: { name: '', lei: '', entityTypeId: '', country: '', currency: '', parentEntityId: '', integrationDate: '', deletionDate: '', totalAssets: '' }
  });

  const getInputClass = (fieldName: keyof EntityFormValues) => {
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

  // RBAC — EDITOR is read-only per DORA RBAC matrix
  // (entities query moved above for openId deep-link auto-open)

  const { data: countries } = useQuery({
    queryKey: ['reference-countries'],
    queryFn: referenceApi.getCountries,
  });

  const { data: currencies } = useQuery({
    queryKey: ['reference-currencies'],
    queryFn: referenceApi.getCurrencies,
  });

  const { data: entityTypes } = useQuery({
    queryKey: ['reference-entity-types'],
    queryFn: referenceApi.getEntityTypes,
  });

  const deleteMutation = useMutation({
    mutationFn: financialEntitiesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entities'] });
      toast.success('Entity deleted successfully.');
    },
    onError: () => toast.error('Failed to delete entity.'),
  });

  const createMutation = useMutation({
    mutationFn: financialEntitiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entities'] });
      setIsDialogOpen(false);
      reset();
      toast.success('Financial entity created successfully.');
    },
    onError: () => toast.error('Failed to create entity. Check all required fields.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => financialEntitiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entities'] });
      setIsDialogOpen(false);
      setEditingId(null);
      reset();
      toast.success('Entity updated successfully.');
    },
    onError: () => toast.error('Failed to update entity.'),
  });

  const onSubmit = (data: EntityFormValues) => {
    const payload = {
      ...data,
      entityTypeId: data.entityTypeId ? Number(data.entityTypeId) : undefined,
      country: data.country || undefined,
      currency: data.currency || undefined,
      parentEntityId: data.parentEntityId || undefined,
      integrationDate: data.integrationDate ? new Date(data.integrationDate).toISOString() : undefined,
      deletionDate: data.deletionDate ? new Date(data.deletionDate).toISOString() : undefined,
      totalAssets: data.totalAssets && data.totalAssets !== '' ? Number(data.totalAssets) : undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    reset({ name: '', lei: '', entityTypeId: '', country: '', currency: '', parentEntityId: '', integrationDate: '', deletionDate: '', totalAssets: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (entity: any) => {
    setEditingId(entity.id);
    reset({
      name: entity.name,
      lei: entity.lei,
      entityTypeId: entity.entityTypeId?.toString() || '',
      country: entity.country || '',
      currency: entity.currency || '',
      parentEntityId: entity.parentEntityId || '',
      integrationDate: entity.integrationDate ? entity.integrationDate.split('T')[0] : '',
      deletionDate: entity.deletionDate ? entity.deletionDate.split('T')[0] : '',
      totalAssets: entity.totalAssets?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const filteredEntities = entities?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.lei.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            {t('Financial Entities')}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your corporate hierarchy and entities (EBA RT.01).
          </p>
        </div>

        {/* Add Entity — Admin Only — separate trigger; Dialog lives at root level below */}
        <RoleGuard allowed={['ADMIN']}>
          <button
            onClick={openCreateDialog}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Add Entity')}
          </button>
        </RoleGuard>
      </div>

      {/* Contextual Guidance */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3 items-start">
        <Building2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-indigo-400">DORA Context: Financial Entities</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Define your corporate hierarchy. DORA Art. 28 requires all financial entities (and their subsidiaries) to maintain an active Register of Information (RoI). Ensure your LEI corresponds exactly to the global GLEIF database, as this populates EBA Template RT.01.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder={t('Search Entity')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">{t('Entity Name')}</th>
                <th className="px-6 py-4 font-medium">{t('LEI Code')}</th>
                <th className="px-6 py-4 font-medium">{t('Country / Currency')}</th>
                <th className="px-6 py-4 font-medium">{t('Total Assets')}</th>
                <th className="px-6 py-4 font-medium text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    {t('Loading entities')}
                  </td>
                </tr>
              ) : filteredEntities?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    {t('No entity found')}
                  </td>
                </tr>
              ) : (
                filteredEntities?.map((entity) => (
                  <tr
                    key={entity.id}
                    ref={entity.id === highlightId ? highlightRef : null}
                    className={`hover:bg-zinc-900/50 transition-colors group ${
                      entity.id === highlightId
                        ? 'ring-2 ring-inset ring-amber-500/60 bg-amber-500/5 animate-pulse'
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-200">{entity.name}</div>
                      {entity.parentEntityId && (
                        <div className="text-xs text-zinc-500 mt-0.5">{t('Subsidiary')}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-400 tracking-wider">
                      {entity.lei}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 truncate max-w-[200px]">
                        {entity.countryRef?.name || entity.country || 'N/A'} &bull; {entity.currencyRef?.name || entity.currency || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {entity.totalAssets ? new Intl.NumberFormat('en', { style: 'currency', currency: entity.currency || 'EUR', maximumFractionDigits: 0 }).format(entity.totalAssets) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Edit — Editor only */}
                        <RoleGuard allowed={['ADMIN']}>
                          <button onClick={() => openEditDialog(entity)} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-md transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </RoleGuard>
                        <RoleGuard allowed={['ADMIN']}>
                          <button
                            onClick={() => {
                              if(confirm(t('Are you sure you want to delete this entity?'))) {
                                deleteMutation.mutate(entity.id);
                              }
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Root-level Dialog — accessible to Admin via pencil button or deep-link */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 dark max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('Edit Financial Entity') : t('New Financial Entity')}
              {user?.role === 'ADMIN' && editingId && (
                <span className="ml-2 text-[10px] font-normal text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                  Admin Edit
                </span>
              )}
            </DialogTitle>
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
              <h3 className="text-sm font-semibold text-indigo-400 mb-3 border-b border-zinc-800 pb-2">1. Entity Identification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <FieldLabel label={t('Entity Name')} required doraRef="RT.01.01.0020" tooltip="Full registered name of the financial entity." />
                  <input {...register('name')} className={getInputClass('name')} placeholder="Ex: Acme Financial Ltd" />
                  {errors.name && <p className="text-rose-400 text-xs">{errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t('LEI Code') + ' (20 char)'} required doraRef="RT.01.01.0010" tooltip="Legal Entity Identifier. Resolves concentration risk accurately." />
                  <input {...register('lei')} className={`${getInputClass('lei')} uppercase font-mono`} placeholder="00000000000000000000" maxLength={20} />
                  {errors.lei && <p className="text-rose-400 text-xs">{errors.lei.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-1">
                  <FieldLabel label={t('Entity Type')} doraRef="RT.01.01.0030" tooltip="Type of financial entity under DORA scope." />
                  <select {...register('entityTypeId')} className={getInputClass('entityTypeId')}>
                    <option value="">{t('Select entity type...')}</option>
                    {entityTypes?.map((et: any) => (
                      <option key={et.id} value={et.id}>{et.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t('Parent Entity')} doraRef="RT.01.01.0040" tooltip="Corporate hierarchy — select the parent entity if this is a subsidiary." />
                  <select {...register('parentEntityId')} className={getInputClass('parentEntityId')}>
                    <option value="">{t('None (top-level)')}</option>
                    {entities?.filter(e => e.id !== editingId).map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.lei})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Location & Financials */}
            <div>
              <h3 className="text-sm font-semibold text-indigo-400 mb-3 border-b border-zinc-800 pb-2">2. Location & Financials</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <FieldLabel label={t('Country')} doraRef="RT.01.01.0050" tooltip="Country of establishment." />
                  <select {...register('country')} className={getInputClass('country')}>
                    <option value="">{t('Select')}</option>
                    {countries?.map((c: any) => (
                      <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t('Currency')} tooltip="Primary base currency of the entity." />
                  <select {...register('currency')} className={getInputClass('currency')}>
                    <option value="">{t('Select')}</option>
                    {currencies?.map((c: any) => (
                      <option key={c.code} value={c.code}>{c.name || c.code} ({c.code})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t('Total Assets')} tooltip="Used for proportionality assessment (DORA Art. 4)." />
                  <input type="number" step="0.01" {...register('totalAssets')} className={getInputClass('totalAssets')} placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* Section 3: Dates */}
            <div>
              <h3 className="text-sm font-semibold text-indigo-400 mb-3 border-b border-zinc-800 pb-2">3. Register Dates</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <FieldLabel label={t('Integration Date')} tooltip="Date the entity was added to the register." />
                  <input type="date" {...register('integrationDate')} className={getInputClass('integrationDate')} />
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t('Deletion Date')} tooltip="Set only when entity is being removed from the register." />
                  <input type="date" {...register('deletionDate')} className={getInputClass('deletionDate')} />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-zinc-950/90 py-4 backdrop-blur-sm border-t border-zinc-800">
              <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">{t('Cancel')}</button>
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2">
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? t('Save Changes') : t('Create Entity'))}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
