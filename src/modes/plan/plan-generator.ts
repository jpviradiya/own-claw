import {
  extractJsonMiddleware,
  generateText,
  Output,
  stepCountIs,
  wrapLanguageModel,
} from "ai";
import chalk from "chalk";
import { z } from "zod";
import { getAgentModel } from "../../ai/index";
import { ActionTracker } from "../../shared/execution/action-tracker";
import { ToolExecutor } from "../../shared/execution/tool-executor";
import { defaultAgentConfig } from "../../shared/execution/types";
import type { PlanStep } from "./types.plan";
import { webSearchTools } from "../../shared/tools/web-search";
import { getReadOnlyTools } from "../../shared/tools/read-only-tools";

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
    ...getReadOnlyTools(executor),
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
