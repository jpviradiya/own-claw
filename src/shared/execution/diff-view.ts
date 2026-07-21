import { createTwoFilesPatch } from "diff";
import type { ActionLog } from "./types.ts";

// Generates a unified diff patch string (3 lines of context) between the before/after content of a file
export const formatPatch = (filePath: string, before: string, after: string): string => {
  return createTwoFilesPatch(filePath, filePath, before, after, "", "", { context: 3 });
};

// Combines a chronological list of actions on one file into a single before/after diff pair.
export const composeBeforeAfter = (
  sorted: ActionLog[]
): { before: string; after: string } => {
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  // If the file ends up deleted, the diff is "before" content -> empty (deletion).
  if (last.type === "file_delete")
    return { before: last.details.before ?? "", after: "" };

  // If the file started as a fresh create, there's no real "before" state.
  const before = first.type === "file_create" ? "" : (first.details.before ?? "");
  // "after" is whatever the last action left the file as.
  const after = last.details.after ?? "";
  return { before, after };
};
