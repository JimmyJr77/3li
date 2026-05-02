import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FastTaskMember = {
  id: string;
  displayName: string;
};

export type FastTaskBoardAssign = {
  assignAll: boolean;
  assigneeIds: string[];
};

type WorkspaceSlice = {
  members: FastTaskMember[];
  assigns: Record<string, FastTaskBoardAssign>;
};

export const defaultFastTaskBoardAssign = (): FastTaskBoardAssign => ({ assignAll: true, assigneeIds: [] });

const emptySlice = (): WorkspaceSlice => ({ members: [], assigns: {} });

type FastTaskMetaState = {
  workspaces: Record<string, WorkspaceSlice>;
  getSlice: (workspaceKey: string) => WorkspaceSlice;
  getBoardAssign: (workspaceKey: string, noteId: string) => FastTaskBoardAssign;
  setBoardAssign: (workspaceKey: string, noteId: string, next: FastTaskBoardAssign) => void;
  toggleAssignee: (workspaceKey: string, noteId: string, memberId: string, checked: boolean) => void;
  setAssignAll: (workspaceKey: string, noteId: string, assignAll: boolean) => void;
  upsertMember: (workspaceKey: string, member: FastTaskMember) => void;
  addMember: (workspaceKey: string, displayName: string) => FastTaskMember;
};

export const useFastTaskMetaStore = create<FastTaskMetaState>()(
  persist(
    (set, get) => ({
      workspaces: {},

      getSlice: (workspaceKey) => get().workspaces[workspaceKey] ?? emptySlice(),

      getBoardAssign: (workspaceKey, noteId) => {
        const a = get().workspaces[workspaceKey]?.assigns[noteId];
        return a ?? defaultFastTaskBoardAssign();
      },

      setBoardAssign: (workspaceKey, noteId, next) =>
        set((s) => {
          const prev = s.workspaces[workspaceKey] ?? emptySlice();
          return {
            workspaces: {
              ...s.workspaces,
              [workspaceKey]: {
                ...prev,
                assigns: { ...prev.assigns, [noteId]: next },
              },
            },
          };
        }),

      setAssignAll: (workspaceKey, noteId, assignAll) => {
        const cur = get().getBoardAssign(workspaceKey, noteId);
        if (assignAll) {
          get().setBoardAssign(workspaceKey, noteId, { assignAll: true, assigneeIds: [] });
          return;
        }
        const members = get().getSlice(workspaceKey).members;
        const nextIds =
          cur.assigneeIds.length > 0
            ? cur.assigneeIds
            : members[0]
              ? [members[0].id]
              : [];
        get().setBoardAssign(workspaceKey, noteId, { assignAll: false, assigneeIds: nextIds });
      },

      toggleAssignee: (workspaceKey, noteId, memberId, checked) => {
        const cur = get().getBoardAssign(workspaceKey, noteId);
        const setIds = new Set(cur.assigneeIds);
        if (checked) setIds.add(memberId);
        else setIds.delete(memberId);
        get().setBoardAssign(workspaceKey, noteId, {
          assignAll: false,
          assigneeIds: [...setIds],
        });
      },

      upsertMember: (workspaceKey, member) =>
        set((s) => {
          const prev = s.workspaces[workspaceKey] ?? emptySlice();
          const existing = prev.members.find((m) => m.id === member.id);
          if (existing?.displayName === member.displayName) {
            return s;
          }
          const others = prev.members.filter((m) => m.id !== member.id);
          const nextMembers = [...others, member].sort((a, b) =>
            a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
          );
          return {
            workspaces: {
              ...s.workspaces,
              [workspaceKey]: {
                ...prev,
                members: nextMembers,
              },
            },
          };
        }),

      addMember: (workspaceKey, displayName) => {
        const trimmed = displayName.trim();
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`;
        const member: FastTaskMember = {
          id,
          displayName: trimmed || "Teammate",
        };
        get().upsertMember(workspaceKey, member);
        return member;
      },
    }),
    {
      name: "3li-fast-task-meta-v1",
      partialize: (s) => ({ workspaces: s.workspaces }),
    },
  ),
);
