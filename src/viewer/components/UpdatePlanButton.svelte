<script lang="ts">
  import { planData } from "../stores/plan";
  import {
    updatePlanAndRegenerate,
    getChangesFromLocalStorage,
    hasPendingChanges,
  } from "../lib/UpdatePlan";

  interface Props {
    onStatus?: (status: { message: string; isError: boolean } | null) => void;
  }

  let { onStatus }: Props = $props();

  let hasChanges = $derived(hasPendingChanges(planData.meta.id));

  function handleUpdatePlan() {
    try {
      const { changes, completed } = getChangesFromLocalStorage(planData.meta.id);
      const result = updatePlanAndRegenerate(planData, changes, completed);

      if (result.success) {
        onStatus?.({ message: `Downloaded ${result.planFilename}`, isError: false });
      } else {
        onStatus?.({ message: result.error || "Export failed", isError: true });
      }
    } catch (error) {
      onStatus?.({
        message: error instanceof Error ? error.message : "Unknown error",
        isError: true,
      });
    }
  }
</script>

<button class="data-btn export" onclick={handleUpdatePlan} disabled={!hasChanges}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
  Export
</button>

<style>
  /* Button styles (same as SettingsModal) */
  .data-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--border-medium);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 500;
    transition: all var(--transition-fast);
    flex-shrink: 0;
    cursor: pointer;
  }

  .data-btn svg {
    width: 16px;
    height: 16px;
  }

  .data-btn:hover {
    background: var(--bg-elevated);
    border-color: var(--border-medium);
    color: var(--text-primary);
  }

  .data-btn.export:hover {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg-primary);
  }

  .data-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
