import { useState } from 'react';
import { Flag, X, AlertTriangle, ChevronRight } from 'lucide-react';

interface IssueHintBannerProps {
  /** The specific DB field name that triggered the validation issue */
  fieldKey: string;
  /** The human-readable error message from the validation rule */
  message?: string;
  /** Optional instruction left by the Analyst when flagging */
  analystNote?: string;
  /** Called when user dismisses the banner */
  onDismiss?: () => void;
}

/**
 * Shown inside edit forms/dialogs when the page was opened via a validation deep-link.
 * Helps the Editor immediately understand which field needs correcting.
 * Usage: read `?fieldKey=` and `?message=` from URL, render this component at top of form.
 */
export default function IssueHintBanner({ fieldKey, message, analystNote, onDismiss }: IssueHintBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // Convert snake_case field names to Title Case for display
  const displayField = fieldKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 overflow-hidden animate-in slide-in-from-top-2 duration-300">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center gap-2">
          <Flag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wide text-amber-400">
            Flagged Issue — Action Required
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="text-amber-500 hover:text-amber-300 transition-colors"
          title="Dismiss hint"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Field pointer */}
        <div className="flex items-center gap-2 text-sm">
          <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-zinc-300">Fix the field:</span>
          <code className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono border border-amber-500/30">
            {displayField}
          </code>
        </div>

        {/* Error description */}
        {message && (
          <div className="flex items-start gap-2 text-xs text-amber-200/80">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {/* Analyst note */}
        {analystNote && (
          <div className="mt-1 flex items-start gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
            <Flag className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-purple-400 tracking-wide mb-0.5">Analyst says:</p>
              <p className="text-xs text-purple-200">{analystNote}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
