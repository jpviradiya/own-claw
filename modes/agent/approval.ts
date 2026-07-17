import chalk from "chalk";
import type { ActionTracker } from "./action-tracker";
import { isCancel, select } from "@clack/prompts";
import type { ActionLog } from "./types";
import { composeBeforeAfter, formatPatch } from "./diff-view";
import { renderTerminalMarkDown } from "../../terminal-ui/terminal-md";

interface ReviewGroup {
  label: string;
  actionIds: string[];
  patch: string | null;
}

// Groups pending actions into review units: one group per file path (with a diff), one per folder creation, and one per shell command execution.
function groupPending(pending: ActionLog[]): ReviewGroup[] {
  const byPath = new Map<string, ActionLog[]>();
  const shells: ActionLog[] = [];

  // Separate shell/tool executions from file-path-based actions.
  for (const a of pending) {
    if (a.type === "tool_execute") {
      shells.push(a);
      continue;
    }
    const key = a.path;
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key)!.push(a);
  }

  const groups: ReviewGroup[] = [];

  // Process file-path actions in alphabetical path order for stable output.
  const pathEntries = [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [p, acts] of pathEntries) {
    // Sort each path's actions chronologically so before/after state is correct.
    const sorted = acts.sort((x, y) => x.timestamp.getTime() - y.timestamp.getTime());
    const ids = sorted.map((x) => x.id);

    // Folder creations have no diff content, so give them a simple label.
    if (sorted.every((x) => x.type === "folder_create")) {
      groups.push({
        label: `Create folder: ${p}`,
        actionIds: ids,
        patch: null,
      });
      continue;
    }

    // Merge all actions on this path into a single before/after diff.
    const { before, after } = composeBeforeAfter(sorted);
    const patch = formatPatch(p, before, after);
    const kinds = [...new Set(sorted.map((x) => x.type))].join(", ");
    groups.push({ label: `${p} (${kinds})`, actionIds: ids, patch });
  }

  // Each shell command becomes its own group (no diff, just the command).
  for (const s of shells) {
    groups.push({
      label: `Shell: ${s.details.command ?? "(no command)"}`,
      actionIds: [s.id],
      patch: null,
    });
  }

  return groups;
}

export const runApprovalFlow = async (tracker: ActionTracker): Promise<Boolean> => {
  //
  const pending = tracker.getPendingMutations();
  if (pending.length == 0) {
    console.log(chalk.dim("\nNo staged files, folders or shell changes to review\n"));
    return false;
  }

  //
  const choice = await select({
    message: "Apply staged changes?",
    options: [
      { value: "all", label: "Approve and apply all" },
      { value: "review", label: "Review one by one" },
      { value: "cancel", label: "Cancel" },
    ],
  });

  //
  if (isCancel(choice) || choice === "cancel") {
    for (const p of pending) tracker.updateStatus(p.id, "rejected", false);
    return false;
  } else if (choice === "all") {
    for (const p of pending) tracker.updateStatus(p.id, "approved", true);
    return true;
  } else {
    for (const gp of groupPending(pending)) {
      while (true) {
        const opt = await select({
          message: chalk.bold(gp.label),
          options: [
            { value: "accept", label: "Accept" },
            { value: "diff", label: "Show diff", hint: gp.patch ? "" : "N/A" },
            { value: "reject", label: "Reject" },
          ],
        });

        if (isCancel(opt)) {
          for (const a of pending) tracker.updateStatus(a.id, "rejected", false);
          return false;
        }

        if (opt === "diff") {
          if (gp.patch) {
            console.log(
              "\n" + renderTerminalMarkDown("```diff\n" + gp.patch + "\n```\n") + "\n"
            );
          }
          continue;
        } else {
          for (const id of gp.actionIds) {
            tracker.updateStatus(
              id,
              opt === "accept" ? "approved" : "rejected",
              opt === "accept"
            );
          }
        }
        break;
      }
    }
  }

  return tracker.getLogs().some((a) => a.status === "approved");
};
