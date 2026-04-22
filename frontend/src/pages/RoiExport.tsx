import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { roiExportApi } from '../api/roiExport';
import { useAuthStore } from '../store/authStore';
import {
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Package,
  FileText,
} from 'lucide-react';

const TEMPLATE_LABELS: Record<string, { label: string; article: string }> = {
  'RT.01.01': { label: 'Entity maintaining register', article: 'Art. 28' },
  'RT.01.02': { label: 'Entities in scope', article: 'Art. 28' },
  'RT.01.03': { label: 'Branches', article: 'Art. 28' },
  'RT.02.01': { label: 'Contracts — General', article: 'Art. 28§2' },
  'RT.02.02': { label: 'Contracts — Specific', article: 'Art. 30' },
  'RT.03.01': { label: 'Group Contract Coverage', article: 'Art. 29' },
  'RT.04.01': { label: 'Entities Using Services', article: 'Art. 29' },
  'RT.05.01': { label: 'ICT Providers', article: 'Art. 28§1' },
  'RT.05.02': { label: 'Supply Chain', article: 'Art. 28§3' },
  'RT.06.01': { label: 'Business Functions', article: 'Art. 28§4' },
  'RT.07.01': { label: 'Service Assessments', article: 'Art. 28§5' },
};

type ExportType = 'excel' | 'xbrl';

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function RoiExport() {
  const { user } = useAuthStore();
  const [exportType, setExportType] = useState<ExportType>('excel');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const canExport = user?.role === 'ADMIN' || user?.role === 'ANALYST' || user?.role === 'EDITOR';
  const canXbrl = user?.role === 'ADMIN' || user?.role === 'ANALYST';

  const { data: templates } = useQuery({
    queryKey: ['roi-templates'],
    queryFn: roiExportApi.getTemplates,
  });

  const preflightMutation = useMutation({
    mutationFn: roiExportApi.preflight,
  });

  const parseBlobError = async (err: any) => {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        return json.message || 'Export failed: Server returned an error.';
      } catch {
        return 'Export failed: Unknown error occurred.';
      }
    }
    return err.message || 'Export failed.';
  };

  const downloadMutation = useMutation({
    mutationFn: async (template?: string) => {
      setExportError(null);
      setExportSuccess(null);
      const blob = await roiExportApi.downloadExcel(template);
      const suffix = template ? template.replace(/\./g, '_') : 'Full';
      const filename = `DORA_RoI_${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`;
      triggerDownload(blob, filename);
    },
    onSuccess: (_, template) => {
      setExportSuccess(`Successfully exported ${template ? template : 'full workbook'} as Excel.`);
    },
    onError: async (error: any) => {
      setExportError(await parseBlobError(error));
    }
  });

  const xbrlMutation = useMutation({
    mutationFn: async () => {
      setExportError(null);
      setExportSuccess(null);
      const blob = await roiExportApi.downloadXbrl();
      const filename = `DORA_RoI_XBRL_${new Date().toISOString().split('T')[0]}.zip`;
      triggerDownload(blob, filename);
    },
    onSuccess: () => {
      setExportSuccess('Successfully exported XBRL OIM-CSV archive.');
    },
    onError: async (error: any) => {
      setExportError(await parseBlobError(error));
    }
  });

  const preflight = preflightMutation.data;
  const isReady = preflight?.exportReady === true;
  const isBusy = downloadMutation.isPending || xbrlMutation.isPending;

  // Auto-run preflight on mount so export buttons show correct state immediately
  useEffect(() => {
    preflightMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-teal-400" />
            Register of Information Export
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Generate CBI-ready exports per EBA ITS templates (RT.01–RT.07). Supports Excel and XBRL OIM-CSV.
          </p>
        </div>
      </div>

      {/* Pre-flight Check */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Pre-flight Validation</h2>
          </div>
          <button
            id="run-preflight-btn"
            onClick={() => preflightMutation.mutate()}
            disabled={preflightMutation.isPending}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {preflightMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
            ) : (
              <><ShieldCheck className="w-4 h-4" /> Run Pre-flight Check</>
            )}
          </button>
        </div>

        {preflight && (
          <div className={`flex items-start gap-3 p-4 rounded-lg border ${
            isReady
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            {isReady ? (
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${isReady ? 'text-green-300' : 'text-red-300'}`}>
                {isReady ? 'Data Validated — Export Ready' : 'Export Blocked'}
              </p>
              <p className={`text-xs mt-1 ${isReady ? 'text-green-400' : 'text-red-400'}`}>
                {isReady
                  ? `All mandatory checks passed.${preflight.totalWarnings > 0 ? ` ${preflight.totalWarnings} warning(s) — review recommended.` : ''}`
                  : `${preflight.totalErrors} error(s) must be fixed. Go to Validation Dashboard to review.`
                }
              </p>
            </div>
          </div>
        )}

        {!preflight && !preflightMutation.isPending && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-zinc-800 bg-zinc-950">
            <AlertTriangle className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-500">Run a pre-flight check before exporting. This validates all data against EBA rules.</p>
          </div>
        )}

        {preflightMutation.isError && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/20 bg-red-500/10">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">Pre-flight Failed</p>
              <p className="text-xs text-red-400 mt-1">
                {(preflightMutation.error as any)?.response?.data?.message || 'Validation errors detected. Fix them before exporting.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Export Status Hints */}
      {exportError && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">Download Failed</p>
            <p className="text-xs text-red-400 mt-1">{exportError}</p>
          </div>
        </div>
      )}

      {exportSuccess && (
        <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-300">Download Complete</p>
            <p className="text-xs text-green-400 mt-1">{exportSuccess}</p>
          </div>
        </div>
      )}

      {/* Export Type Selector */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3">Export Format</h2>
          <div className="flex gap-2">
            <button
              id="export-type-excel"
              onClick={() => setExportType('excel')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                exportType === 'excel'
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel (.xlsx)
            </button>
            <button
              id="export-type-xbrl"
              onClick={() => setExportType('xbrl')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                exportType === 'xbrl'
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <Package className="w-4 h-4" />
              XBRL OIM-CSV (.zip)
            </button>
          </div>
          {exportType === 'xbrl' && (
            <p className="text-xs text-zinc-500 mt-2">
              Packages all templates as EBA-compliant CSV files in a ZIP archive with metadata.json for CBI Portal upload.
            </p>
          )}
        </div>

        {/* Excel Mode */}
        {exportType === 'excel' && (
          <div>
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <p className="text-xs text-zinc-500">Download individual templates or the full workbook as Excel</p>
              {canExport && (
                <button
                  id="download-full-excel-btn"
                  onClick={() => downloadMutation.mutate(undefined)}
                  disabled={isBusy || !isReady}
                  className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloadMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Download className="w-4 h-4" /> Download Full Workbook</>
                  )}
                </button>
              )}
            </div>
            <div className="p-4">
              {!isReady && (
                <p className="text-xs text-zinc-500 mb-4">Run a successful pre-flight check to enable downloads.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates?.templates.map(t => (
                  <div
                    key={t.code}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isReady
                        ? 'border-zinc-800 bg-zinc-900/50 hover:border-teal-500/30 hover:bg-teal-500/5'
                        : 'border-zinc-800/50 bg-zinc-950 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-teal-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{t.code}</p>
                        <p className="text-xs text-zinc-500">{TEMPLATE_LABELS[t.code]?.label || t.code}</p>
                        <p className="text-xs text-zinc-600">{TEMPLATE_LABELS[t.code]?.article || ''}</p>
                      </div>
                    </div>
                    {isReady && canExport && (
                      <button
                        id={`download-${t.code.replace(/\./g, '-')}-btn`}
                        onClick={() => downloadMutation.mutate(t.code)}
                        disabled={isBusy}
                        className="p-2 text-zinc-500 hover:text-teal-400 hover:bg-teal-400/10 rounded-md transition-colors"
                        title={`Download ${t.code}`}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* XBRL Mode */}
        {exportType === 'xbrl' && (
          <div className="p-6 space-y-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-teal-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-200">XBRL OIM-CSV Package</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Single ZIP containing {templates?.templates.length || 11} CSV files (one per template) plus a{' '}
                    <code className="text-teal-400 font-mono">metadata.json</code> following the EBA OIM-CSV naming convention.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {templates?.templates.map(t => (
                      <span key={t.code} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
                        {t.code.replace(/\./g, '_')}.csv
                      </span>
                    ))}
                    <span className="text-xs bg-teal-900/40 text-teal-400 px-2 py-0.5 rounded font-mono border border-teal-500/20">
                      metadata.json
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {!isReady && (
              <p className="text-xs text-zinc-500">Run a successful pre-flight check to enable the XBRL download.</p>
            )}
            {canXbrl && (
              <button
                id="download-xbrl-btn"
                onClick={() => xbrlMutation.mutate()}
                disabled={isBusy || !isReady}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {xbrlMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Packaging XBRL Archive...</>
                ) : (
                  <><Package className="w-4 h-4" /> Download XBRL OIM-CSV Package (.zip)</>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status messages */}
      {(downloadMutation.isError || xbrlMutation.isError) && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/10">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">Export Failed</p>
            <p className="text-xs text-red-400 mt-1">
              {((downloadMutation.error || xbrlMutation.error) as any)?.response?.data?.message || 'An error occurred during export. Please check validation.'}
            </p>
          </div>
        </div>
      )}

      {(downloadMutation.isSuccess || xbrlMutation.isSuccess) && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-green-500/20 bg-green-500/10">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <p className="text-sm text-green-300">
            {xbrlMutation.isSuccess
              ? 'XBRL OIM-CSV package downloaded. Upload the ZIP to the CBI XBRL Portal for submission.'
              : 'Excel file downloaded successfully. Upload to the CBI Portal for submission.'}
          </p>
        </div>
      )}
    </div>
  );
}
