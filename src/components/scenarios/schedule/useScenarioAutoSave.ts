import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react';
import { Scenario, WorkflowEdge, WorkflowNode } from '../../../types';
import { buildBasicNodeSubtitle, getScenarioActiveFormat } from '../scenarioDefinitions';

interface UseScenarioAutoSaveParams {
  currentScenario: Scenario | null;
  setCurrentScenario: Dispatch<SetStateAction<Scenario | null>>;
  setScenarios: Dispatch<SetStateAction<Scenario[]>>;
  activeUserId: string;
}

export function useScenarioAutoSave({
  currentScenario,
  setCurrentScenario,
  setScenarios,
  activeUserId
}: UseScenarioAutoSaveParams) {
  const latestScenarioRef = useRef<Scenario | null>(currentScenario);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingChangesRef = useRef<boolean>(false);

  useEffect(() => {
    latestScenarioRef.current = currentScenario;
  }, [currentScenario]);

  const persistSnapshotToServer = useCallback(
    async (snapshot: Scenario | null) => {
      if (!snapshot?.id) return;
      hasPendingChangesRef.current = false;

      const cleanNodes = (snapshot.nodes || []).map((n) => {
        const copy = { ...n };
        delete copy.lastOutput;
        return copy;
      });
      const edgesToSave = snapshot.edges || [];
      const activeFormat = getScenarioActiveFormat(snapshot);

      try {
        const res = await fetch(`/api/scenarios/${encodeURIComponent(snapshot.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: String(snapshot.name || '').trim() || undefined,
            nodes: cleanNodes,
            edges: edgesToSave,
            messageFormat: activeFormat,
            userId: snapshot.userId || activeUserId
          })
        });
        if (res.ok) {
          const saved = await res.json();
          setScenarios((prev) => {
            const exists = prev.some((s) => s.id === snapshot.id);
            if (!exists) return [saved, ...prev];
            return prev.map((s) =>
              s.id === snapshot.id
                ? {
                    ...s,
                    ...saved,
                    nodes: cleanNodes,
                    edges: edgesToSave
                  }
                : s
            );
          });
          setCurrentScenario((prev) =>
            prev && prev.id === snapshot.id
              ? {
                  ...prev,
                  schedule: saved.schedule ?? prev.schedule,
                  nextRunAt: saved.nextRunAt ?? prev.nextRunAt
                }
              : prev
          );
        }
      } catch (err) {
        console.error('Auto-save scenario error:', err);
      }
    },
    [activeUserId, setCurrentScenario, setScenarios]
  );

  const scheduleAutoSave = useCallback(
    (snapshot: Scenario, immediate: boolean) => {
      latestScenarioRef.current = snapshot;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (immediate) {
        persistSnapshotToServer(snapshot);
      } else {
        hasPendingChangesRef.current = true;
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          persistSnapshotToServer(latestScenarioRef.current);
        }, 350);
      }
    },
    [persistSnapshotToServer]
  );

  const flushPendingSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (latestScenarioRef.current) {
      persistSnapshotToServer(latestScenarioRef.current);
    }
  }, [persistSnapshotToServer]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (hasPendingChangesRef.current && latestScenarioRef.current) {
        persistSnapshotToServer(latestScenarioRef.current);
      }
    };
  }, [persistSnapshotToServer]);

  const saveScenarioNodesToDb = useCallback(
    async (nodesToSave: WorkflowNode[], edgesToSave: WorkflowEdge[]) => {
      const base = latestScenarioRef.current;
      if (!base?.id) return;
      const nextSnap: Scenario = { ...base, nodes: nodesToSave, edges: edgesToSave };
      latestScenarioRef.current = nextSnap;
      await persistSnapshotToServer(nextSnap);
    },
    [persistSnapshotToServer]
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode, immediateSave = true) => {
      const base = latestScenarioRef.current;
      if (!base) return;
      const updatedNodes = (base.nodes || []).map((n) => {
        if (n.id !== nodeId) return n;
        const updated = updater(n);
        return { ...updated, subtitle: buildBasicNodeSubtitle(updated, base) };
      });
      const nextSnap: Scenario = { ...base, nodes: updatedNodes };
      latestScenarioRef.current = nextSnap;
      setCurrentScenario(nextSnap);
      scheduleAutoSave(nextSnap, immediateSave);
    },
    [scheduleAutoSave, setCurrentScenario]
  );

  return {
    latestScenarioRef,
    saveScenarioNodesToDb,
    handleUpdateNode,
    flushPendingSave,
    scheduleAutoSave
  };
}
