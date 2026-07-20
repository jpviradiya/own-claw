import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import chalk from "chalk";
import { z } from "zod";
import { getAgentModel } from "../../ai";
import { renderTerminalMarkDown } from "../../terminal-ui/terminal-md";
import { ActionTracker } from "../agent/action-tracker";
import { runApprovalFlow } from "../agent/approval";
import { ToolExecutor } from "../agent/tool-executor";
import { defaultAgentConfig } from "../agent/types";
import { webSearchTools } from "../plan/web-search";

// Build the read-only tool set that Ask mode can use to inspect the codebase.
const askTools = (executor: ToolExecutor) => {
  return {
    // Reads a file from the workspace.
    read_file: tool({
      description:
        "Read a text file from the workspace. Use a path relative to the project root.",
      inputSchema: z.object({
        path: z.string().describe("Relative file path"),
      }),
      execute: async ({ path: p }) => executor.readFile(p), // desctructure path as p
    }),

    // Lists files and folders from a given path.
    list_files: tool({
      description: "List files and directories under a path.",
      inputSchema: z.object({
        path: z.string(),
        recursive: z.boolean().optional().default(false),
      }),
      execute: async ({ path: p, recursive }) => executor.listFiles(p, recursive),
    }),

    // Searches for files by pattern and optional content match.
    search_files: tool({
      description:
        'Find files matching a glob pattern (e.g. "*.ts", "**/*.md"). Optional content substring filter.',
      inputSchema: z.object({
        root: z.string().describe("Directory to search, relative to root"),
        pattern: z
          .string()
          .describe("Glob-like pattern using * and ** (forward slashes)"),
        content_contains: z.string().optional(),
      }),
      execute: async ({ root, pattern, content_contains }) =>
        executor.searchFiles(root, pattern, content_contains),
    }),

    // Summarizes the codebase structure without changing files.
    analyze_codebase: tool({
      description: "Summarize structure: file counts, size, extensions. Read-only.",
      inputSchema: z.object({
        path: z.string().default("."),
      }),
      execute: async ({ path: p }) => executor.analyzeCodebase(p),
    }),

    // Lists available skill definitions from the configured skill directories.
    list_skills: tool({
      description:
        "List absolute paths to SKILL.md files under configured skill directories (Cursor / Claude).",
      inputSchema: z.object({}),
      execute: async () => executor.listSkills(),
    }),

    // Reads a skill definition file from disk.
    read_skill: tool({
      description:
        "Read a SKILL.md file. Path must be absolute and under skill roots, or use a path returned by list_skills.",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path: p }) => executor.readSkill(p),
    }),
  };
};

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

  //
  const config = defaultAgentConfig();
  config.tools = {
    allowFileCreation: true,
    allowFileModification: false,
    allowFolderCreation: false,
    allowShellExecution: false,
  };

  //
  const tracker = new ActionTracker();

  //
  const executor = new ToolExecutor(config, tracker);

  //
  const tools = {
    ...askTools(executor),
    ...webSearchTools(tracker),
  };

  //
  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(20),
    tools: tools,
  });

  //
  const result = await agent.generate({ prompt: question.trim() });
  const response = result.text?.trim() || "(no answer)";
  console.log("\n" + renderTerminalMarkDown(response) + "\n");

  //
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
