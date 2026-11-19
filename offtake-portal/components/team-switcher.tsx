'use client';

import { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { apiRequest } from '@/lib/portal-api';

interface Workspace {
  id: string;
  name: string;
}

export function TeamSwitcher({
  workspaces,
  activeWorkspaceId,
  onWorkspaceChange,
}: {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onWorkspaceChange: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!workspaces.length) return null;

  async function switchWorkspace(supplierId: string) {
    if (!supplierId || supplierId === activeWorkspaceId || pending) return;
    setPending(true);
    setError('');
    try {
      await apiRequest('offtake.php?action=switch_workspace', {
        method: 'POST',
        body: JSON.stringify({ supplier_id: supplierId }),
      });
      onWorkspaceChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to switch company workspace.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-w-0">
      <label className="sr-only" htmlFor="team-workspace">Company workspace</label>
      <div className="flex h-10 max-w-28 items-center gap-1 rounded-xl border border-[var(--green)] bg-[#000000] px-2 text-[#FFFFFF] shadow-sm sm:max-w-56 sm:gap-2 sm:px-3">
        <Building2 size={15} aria-hidden="true" className="shrink-0 text-[var(--green)] sm:h-4 sm:w-4" />
        <select
          id="team-workspace"
          value={activeWorkspaceId}
          disabled={pending || workspaces.length < 2}
          onChange={(event) => void switchWorkspace(event.currentTarget.value)}
          className="min-w-0 flex-1 appearance-none truncate bg-transparent text-[10px] font-semibold text-[#FFFFFF] outline-none disabled:cursor-default sm:text-xs"
          aria-busy={pending}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id} className="bg-[#000000] text-[#FFFFFF]">
              {workspace.name}
            </option>
          ))}
        </select>
        {workspaces.length > 1 && <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-[var(--green)] sm:h-[15px] sm:w-[15px]" />}
      </div>
      {error && <p role="alert" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-rose-200 bg-white p-2 text-xs text-rose-800 shadow-lg">{error}</p>}
    </div>
  );
}
