import { isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { agentTools } from "./agent-tools";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai";
import { renderTerminalMarkDown } from "../../terminal-ui/terminal-md";
import { runApprovalFlow } from "./approval";

export const runAgentMode = async () => {
  console.log(chalk.bold(`\n🤖 Agent Mode\n`));

  // user prompt
  const goal = await text({
    message: "What would you like to agent do?",
    placeholder: "Concrete task for this codebase.",
  });

  if (isCancel(goal) || !goal.trim()) return;

  // default agent configuration
  const config = defaultAgentConfig();

  // action tracker instance
  const actionTracker = new ActionTracker();

  // toolExecutors which is use to create the tools for the agent
  const toolExecutor = new ToolExecutor(config, actionTracker);

  // actual tools that the agent can use
  const tools = agentTools(toolExecutor);

  // agent instance that will run the loop and execute the tools
  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(40),
    instructions: [
      `Workspace root: ${config.codebasePath}`,
      "All mutation are staged untill approval.",
    ].join(`\n`),
    tools: tools,
  });

  // run the agent with the user prompt and handle the tool calls and approval flow
  const result = await agent.generate({
    prompt: goal.trim(),
    onStepFinish: ({ toolCalls }) => {
      for (const tc of toolCalls) {
        const preview = JSON.stringify(tc.input).slice(0, 160);
        console.log(
          chalk.green("  ✓"),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 160 ? "..." : ""))
        );
      }
    },
  });

  // render the result text in the terminal if any
  if (result.text?.trim()) console.log(renderTerminalMarkDown(result.text));

  // run the approval flow for the staged mutations and apply them if approved
  const ok = await runApprovalFlow(actionTracker);
  if (!ok) return toolExecutor.clearStaging();

  // apply the approved mutations and clear the staging area
  const { errors } = toolExecutor.applyApprovedFromTracker();
  if (errors.length) {
    console.log(chalk.red(`Some operation reported error:\n`));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  } else {
    console.log(chalk.green(`\n✓ Applied.\n`));
  }

  toolExecutor.clearStaging();
};
