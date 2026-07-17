import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import { runAgentMode } from "./agent/orchestrator";
import { runAskMode } from "./ask/orchestrator";

export const runCliModes = async () => {
  while (true) {
    const mode = await select({
      message: "Choose CLI sub-mode",
      options: [
        { value: "agent", label: "Agent Mode" },
        { value: "plan", label: "Plan Mode" },
        { value: "ask", label: "Ask Mode" },
        { value: "back", label: "← Back to main menu" },
      ],
    });

    if (isCancel(mode) || mode == "back") {
      console.log(chalk.dim("\nGoodbye....\n"));
      return;
    }

    if (mode == "agent") {
      await runAgentMode();
    } else if (mode == "plan") {
      console.log(chalk.dim("\nCLI Mode/Plan Mode\n"));
    } else if (mode == "ask") {
      return runAskMode();
    } else {
      console.log(chalk.yellow("Choosen mode is not implemented yet."));
    }
  }
};
