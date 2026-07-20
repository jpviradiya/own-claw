import type { ActionLog, ActionStatus } from "./types";
import { isMutationType } from "./types";

export class ActionTracker {
  private logs: ActionLog[] = [];

  // Record a new action so the approval flow can review it later.
  log(
    entry: Omit<ActionLog, "id" | "timestamp"> & {
      id?: string;
      timestamp?: Date;
    }
  ): ActionLog {
    const lg: ActionLog = {
      id: entry.id ?? `action_${this.logs.length}`,
      timestamp: entry.timestamp ?? new Date(),
      type: entry.type,
      path: entry.path,
      details: { ...entry.details },
      status: entry.status,
      userApproved: entry.userApproved,
    };

    this.logs.push(lg);
    return lg;
  }

  // Return the full history of tracked actions for later review or application.
  getLogs(): readonly ActionLog[] {
    return this.logs;
  }

  // Return only the actions that are still waiting for approval.
  getPendingMutations(): ActionLog[] {
    return this.logs.filter((a) => isMutationType(a.type) && a.status === "pending");
  }

  // Update an action's status and approval state after the user responds.
  updateStatus(id: string, status: ActionStatus, userApproved?: boolean): void {
    const a = this.logs.find((x) => x.id === id);
    if (!a) return;
    a.status = status;
    if (a.userApproved !== undefined) a.userApproved = userApproved;
  }
}
