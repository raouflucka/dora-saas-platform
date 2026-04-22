/**
 * ValidationCharts — Pure CSS/SVG bar charts for validation results breakdown.
 * No external chart library required.
 * Accepts a flat ValidationResult[] array and renders:
 *  1. Errors by Template (grouped bar)
 *  2. Errors by Rule Type (horizontal bar)
 */
import { useMemo } from 'react';
import type { ValidationResult } from '../api/validation';
import { BarChart3, AlertCircle } from 'lucide-react';

const TEMPLATE_LABELS: Record<string, string> = {
  'RT.01.01': 'RT.01.01', 'RT.01.02': 'RT.01.02', 'RT.01.03': 'RT.01.03',
  'RT.02.01': 'RT.02.01', 'RT.02.02': 'RT.02.02', 'RT.03.01': 'RT.03.01',
  'RT.04.01': 'RT.04.01', 'RT.05.01': 'RT.05.01', 'RT.05.02': 'RT.05.02',
  'RT.06.01': 'RT.06.01', 'RT.07.01': 'RT.07.01',
};

const RULE_TYPE_LABELS: Record<string, string> = {
  required:     'Missing required field',
  fk_exists:    'Invalid FK reference',
  format:       'Wrong format (LEI/Date)',
  range:        'Out of valid range',
  dropdown:     'Invalid reference value',
  'cross-field':'Date/field inconsistency',
  conditional:  'Conditional field missing',
};

function HorizontalBar({ label, value, max, color, sublabel }: {
  label: string; value: number; max: number; color: string; sublabel?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="group flex items-center gap-3">
      <div className="w-36 shrink-0 text-right">
        <p className="text-xs text-zinc-300 truncate" title={label}>{label}</p>
        {sublabel && <p className="text-[10px] text-zinc-600">{sublabel}</p>}
      </div>
      <div className="flex-1 h-5 bg-zinc-800/80 rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-zinc-300 w-5 text-right shrink-0">{value}</span>
    </div>
  );
}

export default function ValidationCharts({ results }: { results: ValidationResult[] }) {
  const { byTemplate, byRuleType } = useMemo(() => {
    const byTemplate: Record<string, { errors: number; warnings: number }> = {};
    const byRuleType: Record<string, number> = {};

    for (const r of results) {
      if (r.status === 'FIXED') continue;
      // Template grouping
      if (!byTemplate[r.templateName]) byTemplate[r.templateName] = { errors: 0, warnings: 0 };
      if (r.severity === 'ERROR') byTemplate[r.templateName].errors++;
      else if (r.severity === 'WARNING') byTemplate[r.templateName].warnings++;
      // Rule type grouping — errors only
      if (r.severity === 'ERROR') {
        byRuleType[r.ruleType] = (byRuleType[r.ruleType] || 0) + 1;
      }
    }
    return { byTemplate, byRuleType };
  }, [results]);

  const templateEntries = Object.entries(byTemplate)
    .filter(([, v]) => v.errors + v.warnings > 0)
    .sort(([, a], [, b]) => (b.errors + b.warnings) - (a.errors + a.warnings));

  const ruleTypeEntries = Object.entries(byRuleType)
    .sort(([, a], [, b]) => b - a);

  const maxTemplate = Math.max(...templateEntries.map(([, v]) => v.errors + v.warnings), 1);
  const maxRuleType = Math.max(...ruleTypeEntries.map(([, v]) => v), 1);

  if (templateEntries.length === 0 && ruleTypeEntries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1: Errors by Template */}
      {templateEntries.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            Issues by DORA Template
          </h3>
          <div className="space-y-3">
            {templateEntries.map(([template, counts]) => (
              <div key={template} className="space-y-1">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-zinc-400 font-mono">{TEMPLATE_LABELS[template] || template}</span>
                  <div className="flex items-center gap-2">
                    {counts.errors > 0 && <span className="text-red-400 font-semibold">{counts.errors}E</span>}
                    {counts.warnings > 0 && <span className="text-amber-400">{counts.warnings}W</span>}
                  </div>
                </div>
                {/* Stacked bar */}
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden flex">
                  {counts.errors > 0 && (
                    <div
                      className="h-full bg-red-500 transition-all duration-700"
                      style={{ width: `${(counts.errors / maxTemplate) * 100}%` }}
                    />
                  )}
                  {counts.warnings > 0 && (
                    <div
                      className="h-full bg-amber-400 transition-all duration-700"
                      style={{ width: `${(counts.warnings / maxTemplate) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-800/60">
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Errors
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Warnings
            </span>
          </div>
        </div>
      )}

      {/* Chart 2: Errors by Rule Type */}
      {ruleTypeEntries.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            Error Breakdown by Type
          </h3>
          <div className="space-y-3">
            {ruleTypeEntries.map(([ruleType, count]) => (
              <HorizontalBar
                key={ruleType}
                label={RULE_TYPE_LABELS[ruleType] || ruleType}
                sublabel={ruleType}
                value={count}
                max={maxRuleType}
                color="bg-rose-500"
              />
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-4 pt-3 border-t border-zinc-800/60">
            Showing errors by root cause. Address "Missing required field" first — they account for most RoI export failures.
          </p>
        </div>
      )}
    </div>
  );
}
