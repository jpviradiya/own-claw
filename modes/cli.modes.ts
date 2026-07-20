import { isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import { runAgentMode } from "./agent/orchestrator";
import { runAskMode } from "./ask/orchestrator";
import { runPlanMode } from "./plan/orchestrator";

// Present the sub-mode picker and route the user into the selected workflow.
export const runCliModes = async () => {
  while (true) {
    // Prompt the user to choose which CLI experience to start.
    const mode = await select({
      message: "Choose CLI sub-mode",
      options: [
        { value: "agent", label: "Agent Mode" },
        { value: "plan", label: "Plan Mode" },
        { value: "ask", label: "Ask Mode" },
        { value: "back", label: "← Back to main menu" },
      ],
    });

    // Exit cleanly if the prompt is canceled or the user wants to return.
    if (isCancel(mode) || mode == "back") {
      console.log(chalk.dim("\nGoodbye....\n"));
      return;
    }

    // Dispatch into the appropriate mode handler for each supported workflow.
    if (mode == "agent") {
      await runAgentMode();
    } else if (mode == "plan") {
      return runPlanMode();
    } else if (mode == "ask") {
      return runAskMode();
    } else {
      // Keep the loop safe for any unhandled values while the app evolves.
      console.log(chalk.yellow("Choosen mode is not implemented yet."));
    }
  }
};
