import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs } from "ai";
import chalk from "chalk";
import { getAgentModel } from "../../ai/index";
import { renderTerminalMarkDown } from "../../shared/ui/terminal-md";
import { ActionTracker } from "../../shared/execution/action-tracker";
import { runApprovalFlow } from "../../shared/execution/approval";
import { ToolExecutor } from "../../shared/execution/tool-executor";
import { defaultAgentConfig } from "../../shared/execution/types";
import { webSearchTools } from "../../shared/tools/web-search";
import { getReadOnlyTools } from "../../shared/tools/read-only-tools";

// Format the saved Ask-mode response as a small markdown document for later review.
const saveFileAsMd = (question: string, answer: string): string => {
  return `# Ask Mode\n\n## Question\n\n${question.trim()}\n\n## Answer\n\n${answer.trim()}\n`;
};

// Collect a question, gather an answer from the agent, and optionally save it to disk.
export const runAskMode = async () => {
  console.log(chalk.bold("\n❓ Ask Mode\n"));

  // take question from user and validate it
  const question = await text({ message: "What do you want to ask?" });
  if (isCancel(question) || !question.trim()) return;

  // default config
  const config = defaultAgentConfig();
  config.tools = {
    allowFileCreation: true,
    allowFileModification: false,
    allowFolderCreation: false,
    allowShellExecution: false,
  };

  const tracker = new ActionTracker();
  const executor = new ToolExecutor(config, tracker);

  // Combine shared read-only filesystem tools and web search tools
  const tools = {
    ...getReadOnlyTools(executor),
    ...webSearchTools(tracker),
  };

  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(20),
    tools: tools,
  });

  const result = await agent.generate({ prompt: question.trim() });
  const response = result.text?.trim() || "(no answer)";
  console.log("\n" + renderTerminalMarkDown(response) + "\n");

  const wantsSave = await confirm({
    message: "Do you want to save this response into .md file in the current directory?",
    initialValue: false,
  });
  if (isCancel(wantsSave) || !wantsSave) return;

  const fileName = await text({
    message: "Give filename.",
    initialValue: "ask.md",
    validate: (val) => {
      const s = (val ?? "").trim();
      if (!s) return "Required";
      if (s.includes("..") || s.includes("/") || s.includes("\\")) return "No paths";
      if (!s.toLowerCase().endsWith(".md")) return "Must end with .md";
    },
  });

  if (isCancel(fileName)) return;
  executor.createFile(`own-claw-response/${fileName}`, saveFileAsMd(question, response));

  const ok = await runApprovalFlow(tracker);
  if (!ok) return executor.clearStaging();

  executor.applyApprovedFromTracker();
  executor.clearStaging();
};
