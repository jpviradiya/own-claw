import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";

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

    if (isCancel(mode)) {
      console.log(chalk.dim(`\nGoodbye....\n`));
      return;
    }

    if (mode == "agent") {
      console.log(chalk.dim(`\nCLI Mode/Agent Mode\n`));
    } else if (mode == "plan") {
      console.log(chalk.dim(`\nCLI Mode/Plan Mode\n`));
    } else if (mode == "ask") {
      console.log(chalk.dim(`\nCLI Mode/Ask Mode\n`));
    } else if (mode == "back") {
      console.log(chalk.dim(`\nCLI Mode/Back Mode\n`));
      return;
    } else {
      console.log(chalk.yellow("Choosen mode is not implemented yet."));
    }
  }
};
