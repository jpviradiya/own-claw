import { confirm, isCancel, text } from "@clack/prompts";
import { stepCountIs, ToolLoopAgent } from "ai";
import chalk from "chalk";
import { getAgentModel } from "../../ai";
import { renderTerminalMarkDown } from "../../terminal-ui/terminal-md";
import { ActionTracker } from "../agent/action-tracker";
import { agentTools } from "../agent/agent-tools";
import { runApprovalFlow } from "../agent/approval";
import { ToolExecutor } from "../agent/tool-executor";
import { defaultAgentConfig } from "../agent/types";
import { generatePlan } from "./plan-generator";
import { printPlan, selectSteps } from "./selection";
import type { PlanStep } from "./types.plan";
import { webSearchTools } from "./web-search";

// Build the prompt text that sends one selected plan step to the execution agent.
function stepPrompt(goal: string, step: PlanStep): string {
  return [`Goal: ${goal}`, `Step: ${step.title}`, step.description].join("\n");
}

// Run the planning flow, let the user pick steps, and execute them with approval.
export const runPlanMode = async () => {
  console.log(chalk.bold("\n🧭 Plan Mode\n"));

  const goal = await text({ message: "What is your goal?" });
  if (isCancel(goal) || !goal.trim()) return;

  const plan = await generatePlan(goal);
  printPlan(plan);

  const selected = await selectSteps(plan);
  if (selected.length == 0) return;

  // Ask whether the selected steps should actually be executed.
  const proceed = await confirm({
    message: `Execute ${selected.length} step(s).`,
    initialValue: true,
  });

  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(config, tracker);

  const tools = { ...agentTools(executor), ...webSearchTools(tracker) };

  // Run each selected step as a focused agent pass with the current plan context.
  for (const step of selected) {
    console.log(chalk.bold(`\n🔧 ${step.title}\n`));

    const agent = new ToolLoopAgent({
      model: getAgentModel(),
      stopWhen: stepCountIs(30),
      tools: tools,
    });

    const result = await agent.generate({
      prompt: stepPrompt(plan.goal, step),
    });

    if (result.text) return console.log(renderTerminalMarkDown(result.text));
  }

  // Review staged mutations before applying them to the workspace.
  const ok = await runApprovalFlow(tracker);
  if (!ok) return executor.clearStaging();

  // Apply the approved changes and report any failures that occur.
  const { errors } = executor.applyApprovedFromTracker();
  if (errors.length) {
    console.log(chalk.red("\nSome operations reported errors:\n"));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  } else {
    console.log(chalk.green("\n✓ Applied.\n"));
  }
  executor.clearStaging();
};
