import {
  extractJsonMiddleware,
  generateText,
  Output,
  stepCountIs,
  tool,
  wrapLanguageModel,
} from "ai";
import chalk from "chalk";
import { z } from "zod";
import { getAgentModel } from "../../ai";
import { ActionTracker } from "../agent/action-tracker";
import { ToolExecutor } from "../agent/tool-executor";
import { defaultAgentConfig } from "../agent/types";
import type { PlanStep } from "./types.plan";
import { webSearchTools } from "./web-search";

// Define the expected JSON structure for the generated plan so the model output stays consistent.
const planSchema = z.object({
  researchSummary: z.string().optional(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        hints: z.array(z.string()).optional(),
        complexity: z.enum(["low", "medium", "high"]).optional(),
      })
    )
    .min(1)
    .max(15),
});

// Build the read-only tool registry used to research the workspace before drafting a plan.
const readOnlyTools = (executor: ToolExecutor) => {
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

// Provide the planner agent with a short system prompt that keeps it focused and read-only.
const PLAN_INSTRUCTIONS = (codebase: string, hasWebSearchTool: boolean) =>
  [
    "You are a Plan-Mode planner. You DO NOT modify files.",
    `Workspace: ${codebase}`,
    "Use read-only tools for codebase/skills research.",
    hasWebSearchTool
      ? "Web tools are available (web_search/web_crawl/fetch_url). Use only when needed."
      : "Web tools are unavailable (no FIRECRAWL_API_KEY).",
    "Output must match the provided JSON schema.",
    "Keep it short: 1-15 steps.",
  ].join("\n");

// Generate a short, structured plan from the user's goal using the available research tools.
export const generatePlan = async (goal: string) => {
  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(config, tracker);
  const hasWebSearch = !!process.env.FIRECRAWL_API_KEY; // return boolean value

  // Wrap the model with middleware that extracts structured JSON from the response.
  const model = wrapLanguageModel({
    model: getAgentModel(),
    middleware: extractJsonMiddleware(),
  });

  // Combine the read-only research tools with any available web search tools.
  const tools = {
    ...readOnlyTools(executor),
    ...(hasWebSearch ? webSearchTools(tracker) : {}),
  };

  console.log(chalk.cyan("\n🔍 Researching & drafting a plan…\n"));

  // Ask the model to research the workspace and produce a plan in the expected schema.
  const result = await generateText({
    model,
    tools: tools,
    stopWhen: stepCountIs(20),
    system: PLAN_INSTRUCTIONS(config.codebasePath, hasWebSearch),
    prompt: `User goal: \n${goal}`,
    output: Output.object({ schema: planSchema }),
  });

  // Validate the model output before converting it into the internal plan shape.
  const validate = planSchema.parse(result.output);

  // Map the validated steps into the app's internal plan-step format.
  const steps: PlanStep[] = validate.steps.map((value, index) => ({
    id: `step-${index + 1}`,
    title: value.title,
    description: value.description,
    hint: value.hints,
    complexity: value.complexity,
  }));

  return { goal, researchSummary: validate.researchSummary, steps };
};
