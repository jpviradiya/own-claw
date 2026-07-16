import type { ActionLog, ActionStatus } from "./types";
import { isMutationType } from "./types";

export class ActionTracker {
  private logs: ActionLog[] = [];

  // add log entry for an action.
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

  // return all logs
  getLogs(): readonly ActionLog[] {
    return this.logs;
  }

  // returns array of logs with pending status
  getPendingMutations(): ActionLog[] {
    return this.logs.filter((a) => isMutationType(a.type) && a.status === "pending");
  }

  // update the status and user approval in logs of actions.
  updateStatus(id: string, status: ActionStatus, userApproved?: boolean): void {
    const a = this.logs.find((x) => x.id === id);
    if (!a) return;
    a.status = status;
    if (a.userApproved !== undefined) a.userApproved = userApproved;
  }
}
