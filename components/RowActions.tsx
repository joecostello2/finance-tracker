"use client";

import { useState } from "react";

/** Edit (pencil) + delete (trash) buttons with a confirm prompt and busy state. */
export function RowActions({
  onEdit,
  onDelete,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
  deleteLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <button
        className="rounded-md border border-[--color-border] bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
        onClick={onEdit}
        aria-label="Edit"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        className="rounded-md border border-[--color-border] bg-white p-1.5 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        disabled={busy}
        aria-label="Delete"
        onClick={async () => {
          if (!confirm(`Delete ${deleteLabel}? This can't be undone.`)) return;
          setBusy(true);
          try {
            await onDelete();
          } finally {
            setBusy(false);
          }
        }}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
