import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type InviteUserPayload } from '../api/admin';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useAuthStore } from '../store/authStore';

// ─── Manage User Modal ───────────────────────────────────────────────────────
function ManageUserModal({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [form, setForm] = useState({ email: user.email, password: '' });
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void; danger?: boolean } | null>(null);

  const roleMutation = useMutation({
    mutationFn: (role: string) => adminApi.updateRole(user.id, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); },
  });
  const updateMutation = useMutation({
    mutationFn: () => adminApi.updateUser(user.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); },
  });
  const deactivateMutation = useMutation({
    mutationFn: () => adminApi.deactivateUser(user.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); },
  });
  const activateMutation = useMutation({
    mutationFn: () => adminApi.activateUser(user.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); },
  });
  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteUser(user.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); },
  });

  const isSelf = currentUser?.id === user.id;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg space-y-6">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">Manage User</h2>
            <p className="text-xs text-zinc-500">{user.id}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><XCircle className="w-6 h-6" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">New Password (leave blank to keep)</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500" placeholder="••••••••" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium flex items-center gap-2">
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
            </button>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <label className="text-xs text-zinc-400 mb-2 block">Role</label>
            <div className="flex gap-2">
              {['ADMIN', 'ANALYST', 'EDITOR'].map(r => (
                <button
                  key={r}
                  onClick={() => {
                    if (user.role?.roleName !== r) {
                      setConfirmAction({
                        title: 'Change Role',
                        message: `Change ${user.email}'s role to ${r}?`,
                        onConfirm: () => { roleMutation.mutate(r); setConfirmAction(null); },
                      });
                    }
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${user.role?.roleName === r ? ROLE_COLORS[r] + ' ring-1 ring-white/10' : 'bg-transparent text-zinc-500 border-zinc-800 hover:bg-zinc-800/50'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {!isSelf && (
            <div className="border-t border-red-900/30 pt-4 mt-6">
              <label className="text-xs font-bold text-red-500/80 mb-2 block">Danger Zone</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction({
                    title: 'Deactivate / Activate',
                    message: `Are you sure you want to toggle access for ${user.email}?`,
                    danger: true,
                    onConfirm: () => { deactivateMutation.mutate(); setConfirmAction(null); },
                  })}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors border border-orange-500/20"
                >
                  Deactivate
                </button>
                <button
                  onClick={() => activateMutation.mutate()}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                >
                  Activate
                </button>
                <button
                  onClick={() => setConfirmAction({
                    title: 'Delete User',
                    message: `PERMANENTLY delete ${user.email}? This action cannot be undone.`,
                    danger: true,
                    onConfirm: () => { deleteMutation.mutate(); setConfirmAction(null); },
                  })}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
                >
                  Hard Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          danger={confirmAction.danger}
          confirmLabel={confirmAction.danger ? 'Yes, Proceed' : 'Confirm'}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
import {
  Users, ShieldAlert, BarChart3, Plus,
  Loader2, ChevronDown, ChevronRight, Mail, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

type Tab = 'users' | 'auditlog' | 'risk';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
  ANALYST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  EDITOR: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const RISK_COLORS: Record<string, string> = {
  HIGH: 'bg-red-500/10 text-red-400 border-red-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  LOW: 'bg-green-500/10 text-green-400 border-green-500/20',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-green-400',
  UPDATE: 'text-blue-400',
  DELETE: 'text-red-400',
};



// ─── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<InviteUserPayload>({ email: '', role: 'ANALYST' });
  const mutation = useMutation({
    mutationFn: adminApi.inviteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); },
  });
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-5">
        <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
          <Mail className="w-5 h-5 text-teal-400" /> Invite User
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Email address *</label>
            <input
              id="invite-email"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Full name</label>
            <input
              id="invite-name"
              type="text"
              value={form.fullName || ''}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Role</label>
            <select
              id="invite-role"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500"
            >
              <option value="ANALYST">ANALYST</option>
              <option value="EDITOR">EDITOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>
        {mutation.isError && (
          <div className="text-xs text-red-400 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            {(mutation.error as any)?.response?.data?.message || 'Failed to send invitation.'}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
          <button
            id="send-invite-btn"
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.email}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Mail className="w-4 h-4" /> Send Invite</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { data, isLoading, refetch } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.getUsers });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Toast feedback */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">{data?.length ?? 0} user(s) in this tenant</p>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors"><RefreshCw className="w-4 h-4" /></button>
          <button id="invite-user-btn" onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded-lg font-medium transition-colors">
            <Plus className="w-4 h-4" /> Invite User
          </button>
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div> : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/80 border-b border-zinc-800">
                {['Name', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.map(u => (
                <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3 text-zinc-200 font-medium">{u.fullName || '—'}</td>
                  <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs rounded-md px-2 py-1 font-medium whitespace-nowrap border ${ROLE_COLORS[u.role?.roleName || 'ANALYST']}`}>
                      {u.role?.roleName || 'ANALYST'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-md transition-colors"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {selectedUser && <ManageUserModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}

// ─── Audit Value Renderer ──────────────────────────────────────────────────────
/** Internal / system fields never shown to the user */
const SKIP_FIELDS = new Set([
  'id', 'tenant_id', 'tenantId', 'created_at', 'createdAt',
  'updated_at', 'updatedAt', 'password_hash', 'passwordHash',
  'reset_token', 'resetToken', 'reset_token_expires', 'resetTokenExpires',
]);

/** Human-readable labels for common snake_case DB field names */
const FIELD_LABELS: Record<string, string> = {
  contract_reference: 'Contract Reference',
  contract_type: 'Contract Type',
  financial_entity_id: 'Financial Entity',
  provider_id: 'ICT Provider',
  subcontractor_provider_id: 'Subcontractor Provider',
  ict_service_type_id: 'Service Type',
  reliance_level_id: 'Reliance Level',
  data_sensitivity_id: 'Data Sensitivity',
  start_date: 'Start Date',
  end_date: 'End Date',
  annual_cost: 'Annual Cost',
  currency: 'Currency',
  termination_notice_period: 'Termination Notice (days)',
  renewal_terms: 'Renewal Terms',
  service_description: 'Service Description',
  governing_law_country: 'Governing Law Country',
  service_country: 'Service Country',
  processing_location: 'Processing Location',
  storage_location: 'Storage Location',
  data_storage: 'Personal Data Storage',
  provided_by_contractor: 'Provided by Contractor',
  provided_by_subcontractor: 'Provided by Subcontractor',
  lei: 'LEI',
  name: 'Name',
  email: 'Email',
  full_name: 'Full Name',
  role: 'Role',
  is_active: 'Active',
  function_name: 'Function Name',
  function_identifier: 'Function Identifier',
  criticality_level_id: 'Criticality Level',
  last_assessment_date: 'Last Assessment Date',
  rto: 'RTO (hours)',
  rpo: 'RPO (hours)',
  impact_discontinuation: 'Discontinuation Impact',
  legal_name: 'Legal Name',
  provider_code: 'Provider Code',
  headquarters_country: 'Headquarters Country',
  nace_code: 'NACE Code',
  ultimate_parent_lei: 'Ultimate Parent LEI',
  intra_group_flag: 'Intra-Group',
  competent_authority: 'Competent Authority',
  exit_trigger: 'Exit Trigger',
  exit_strategy: 'Exit Strategy',
  fallback_provider_id: 'Fallback Provider',
  is_substitutable: 'Substitutable',
  substitution_reason: 'Substitution Reason',
  last_audit_date: 'Last Audit Date',
  exit_plan_exists: 'Exit Plan Exists',
  reintegration_possible: 'Reintegration Possible',
  discontinuation_impact: 'Discontinuation Impact',
  alternative_providers_exist: 'Alternative Providers Exist',
  alternative_provider_reference: 'Alternative Provider Ref.',
  country: 'Country',
  branch_code: 'Branch Code',
  supply_rank: 'Supply Rank',
  service_type_id: 'Service Type',
  total_assets: 'Total Assets',
  integration_date: 'Integration Date',
  deletion_date: 'Deletion Date',
  entity_type_id: 'Entity Type',
  parent_entity_id: 'Parent Entity',
};

/** Plain-English names for database table names */
const TABLE_LABELS: Record<string, string> = {
  contractual_arrangements: 'Contract',
  financial_entities: 'Financial Entity',
  ict_providers: 'ICT Provider',
  ict_services: 'ICT Service',
  ict_supply_chain: 'Supply Chain Entry',
  ict_service_assessments: 'ICT Assessment',
  business_functions: 'Business Function',
  exit_strategies: 'Exit Strategy',
  branches: 'Branch',
  users: 'User',
  audit_logs: 'Audit Log',
};

/** Format a single field value into a readable string */
function formatValue(val: any): string {
  if (val === null || val === undefined || val === '') return '— (empty)';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  // Detect ISO date strings and format them
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(val)) {
    try { return new Date(val).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { /* fall through */ }
  }
  // Detect UUIDs — abbreviate them
  if (typeof val === 'string' && /^[0-9a-f-]{36}$/i.test(val)) return `${val.slice(0, 8)}…`;
  return String(val);
}

/** Human-readable field-by-field diff for an audit log entry */
function AuditDiff({ actionType, oldValues, newValues }: { actionType: string; oldValues?: any; newValues?: any }) {
  if (actionType === 'UPDATE' && oldValues && newValues) {
    // Compute diff — only fields that actually changed
    const allKeys = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])];
    const changedKeys = allKeys.filter(k => {
      if (SKIP_FIELDS.has(k)) return false;
      const oldV = JSON.stringify(oldValues[k] ?? null);
      const newV = JSON.stringify(newValues[k] ?? null);
      return oldV !== newV;
    });

    if (changedKeys.length === 0) {
      return <p className="text-xs text-zinc-500 italic">No data fields changed (metadata-only update).</p>;
    }

    return (
      <div className="space-y-1.5 mt-2 bg-zinc-900/50 p-2.5 rounded border border-zinc-800">
        {changedKeys.map((key, idx) => {
          const fieldName = FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return (
            <div key={key} className={`text-xs text-zinc-300 flex items-baseline gap-2 ${idx > 0 && 'pt-1.5 border-t border-zinc-800/50'}`}>
              <span className="font-semibold text-zinc-200 min-w-[140px]">{fieldName}</span>
              <span className="text-zinc-400">Old: {formatValue(oldValues[key])}</span>
              <span className="text-zinc-500 text-[10px]">→</span>
              <span className="text-zinc-200">New: {formatValue(newValues[key])}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (actionType === 'CREATE' && newValues) {
    const keys = Object.keys(newValues).filter(k => !SKIP_FIELDS.has(k) && newValues[k] !== null && newValues[k] !== '');
    return (
      <div>
        <p className="text-xs font-semibold text-zinc-400 mb-3">Record created with {keys.length} fields</p>
        <div className="space-y-1">
          {keys.map(key => (
            <div key={key} className="flex items-baseline gap-2 py-1 border-b border-zinc-800/50 last:border-0">
              <span className="text-xs text-zinc-500 w-40 shrink-0">{FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              <span className="text-xs text-zinc-300 break-words">{formatValue(newValues[key])}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (actionType === 'DELETE' && oldValues) {
    const keys = Object.keys(oldValues).filter(k => !SKIP_FIELDS.has(k) && oldValues[k] !== null);
    return (
      <div>
        <p className="text-xs font-semibold text-red-400 mb-3">Record deleted — snapshot below</p>
        <div className="space-y-1">
          {keys.map(key => (
            <div key={key} className="flex items-baseline gap-2 py-1 border-b border-zinc-800/50 last:border-0">
              <span className="text-xs text-zinc-500 w-40 shrink-0">{FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              <span className="text-xs text-zinc-400 line-through break-words">{formatValue(oldValues[key])}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <p className="text-xs text-zinc-600 italic">No change details available.</p>;
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────
function AuditLogTab() {
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', table, action, offset],
    queryFn: () => adminApi.getAuditLogs({ table: table || undefined, action: action || undefined, limit: 25, offset }),
  });

  /** Build a short plain-English sentence describing the entry */
  function entryLabel(entry: any): string {
    const who = entry.user?.email || 'System';
    const what = TABLE_LABELS[entry.tableName] || entry.tableName?.replace(/_/g, ' ') || 'record';
    switch (entry.actionType) {
      case 'CREATE': return `${who} created a new ${what}.`;
      case 'UPDATE': {
        // Count changed fields for a quick summary
        const old = entry.oldValues || {};
        const nw = entry.newValues || {};
        const changed = Object.keys({ ...old, ...nw }).filter(k => !SKIP_FIELDS.has(k) && JSON.stringify(old[k]) !== JSON.stringify(nw[k]));
        if (changed.length === 0) return `${who} updated a ${what} (no visible changes).`;
        const fields = changed.slice(0, 3).map(k => FIELD_LABELS[k] || k.replace(/_/g, ' ')).join(', ');
        return `${who} updated ${what}: changed ${fields}${changed.length > 3 ? ` +${changed.length - 3} more` : ''}.`;
      }
      case 'DELETE': return `${who} deleted a ${what}.`;
      default: return `${who} performed ${entry.actionType} on ${what}.`;
    }
  }

  const ACTION_BG: Record<string, string> = {
    CREATE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    UPDATE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={table}
          onChange={e => { setTable(e.target.value); setOffset(0); }}
          placeholder="Filter by module table..."
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 w-48 focus:outline-none focus:border-teal-500"
        />
        <select
          value={action}
          onChange={e => { setAction(e.target.value); setOffset(0); }}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-teal-500"
        >
          <option value="">All actions</option>
          <option value="CREATE">CREATE — new records</option>
          <option value="UPDATE">UPDATE — edits</option>
          <option value="DELETE">DELETE — removals</option>
        </select>
        <button onClick={() => refetch()} className="p-2 text-zinc-400 hover:text-zinc-200 rounded-md" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-xs text-zinc-500 ml-auto">{data?.total ?? 0} total entries</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : (
        <div className="space-y-2">
          {(data?.data.length ?? 0) === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">No audit entries found.</p>
          )}
          {data?.data.map(entry => (
            <div key={entry.id} className="border border-zinc-800 rounded-xl overflow-hidden">
              {/* Summary row — collapsed */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors text-left"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                {expanded === entry.id
                  ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />}
                {/* Action badge */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${ACTION_BG[entry.actionType || ''] || 'bg-zinc-700 text-zinc-300 border-zinc-600'}`}>
                  {entry.actionType}
                </span>
                {/* Plain-English description */}
                <span className="text-sm text-zinc-300 flex-1 truncate">{entryLabel(entry)}</span>
                {/* Timestamp */}
                <span className="text-xs text-zinc-600 shrink-0">
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              </button>

              {/* Expanded detail */}
              {expanded === entry.id && (
                <div className="px-4 pb-4 border-t border-zinc-800 bg-zinc-950/60 pt-3 space-y-3">
                  <div className="flex items-center gap-4 text-xs text-zinc-600">
                    <span>Module: <span className="text-zinc-400">{TABLE_LABELS[entry.tableName] || entry.tableName}</span></span>
                    <span>By: <span className="text-zinc-400">{entry.user?.email || entry.userId || 'system'}</span></span>
                    <span className="font-mono">ID: {entry.recordId?.slice(0, 8)}…</span>
                  </div>
                  <AuditDiff
                    actionType={entry.actionType || ''}
                    oldValues={entry.oldValues}
                    newValues={entry.newValues}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        <button
          disabled={offset === 0}
          onClick={() => setOffset(o => Math.max(0, o - 25))}
          className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
        >← Previous</button>
        <span className="text-xs text-zinc-600">Page {Math.floor(offset / 25) + 1}</span>
        <button
          disabled={(data?.data.length ?? 0) < 25}
          onClick={() => setOffset(o => o + 25)}
          className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
        >Next →</button>
      </div>
    </div>
  );
}

// ─── Concentration Risk Tab ───────────────────────────────────────────────────
function RiskTab() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['concentration-risk'], queryFn: adminApi.getConcentrationRisk });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">Total contracts: {data?.totalContracts ?? '—'}</p>
        <button onClick={() => refetch()} className="p-2 text-zinc-400 hover:text-zinc-200 rounded-md"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {data?.summary && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${
          data.dominantProviders > 0 ? 'bg-red-500/10 border-red-500/20' :
          data.riskItems.some(r => r.riskLevel === 'MEDIUM') ? 'bg-amber-500/10 border-amber-500/20' :
          'bg-green-500/10 border-green-500/20'
        }`}>
          {data.dominantProviders > 0 ? <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" /> :
           data.riskItems.some(r => r.riskLevel === 'MEDIUM') ? <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" /> :
           <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />}
          <p className="text-sm text-zinc-200">{data.summary}</p>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div> : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/80 border-b border-zinc-800">
                {['Provider', 'LEI', 'Contracts', 'Share %', 'Risk Level'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.riskItems.map(item => (
                <tr key={item.providerId} className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3 text-zinc-200 font-medium">{item.providerName}</td>
                  <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{item.providerLei || '—'}</td>
                  <td className="px-4 py-3 text-zinc-300">{item.contractCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 max-w-24">
                        <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${Math.min(item.percentageShare, 100)}%` }} />
                      </div>
                      <span className="text-xs text-zinc-300">{item.percentageShare}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md border font-semibold ${RISK_COLORS[item.riskLevel]}`}>{item.riskLevel}</span>
                  </td>
                </tr>
              ))}
              {(data?.riskItems.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-500 text-xs">No contracts found. Add contractual arrangements to analyse risk.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Admin Panel Page ─────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'users';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center space-y-2">
          <XCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-zinc-200 font-semibold">Access Denied</p>
          <p className="text-xs text-zinc-500">This page is restricted to ADMIN users.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'auditlog', label: 'Audit Log', icon: ShieldAlert },
    { id: 'risk', label: 'Concentration Risk', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-teal-400" />
          Admin Panel
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Tenant administration, audit trail (DORA Art. 25), and concentration risk engine (EBA RT.09).
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-teal-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'auditlog' && <AuditLogTab />}
        {activeTab === 'risk' && <RiskTab />}
      </div>
    </div>
  );
}
