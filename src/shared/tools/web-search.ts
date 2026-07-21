import { tool } from "ai";
import { Firecrawl } from "firecrawl";
import { z } from "zod";
import type { ActionTracker } from "../execution/action-tracker.ts";

let client: Firecrawl | null = null;

// Reuse a single Firecrawl client so web search requests stay lightweight.
const getClient = (): Firecrawl => {
  if (client) return client;
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured in the environment. Web tools are unavailable.");
  }
  client = new Firecrawl({ apiKey });
  return client;
};

// Trim verbose results so terminal output stays readable and compact.
function clip(s: string, n = 8000): string {
  return s.length > n ? s.slice(0, n) + "\n…[truncated]" : s;
}

// Expose the web search tools so plan and ask modes can enrich their responses.
export const webSearchTools = (tracker: ActionTracker) => {
  return {
    // Allow the agent to search the web and collect relevant context for a task.
    web_search: tool({
      description: "Search the web. Returns title/url/snippet list.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(10).optional().default(5),
      }),
      execute: async ({ query, limit }) => {
        try {
          const response = await getClient().search(query, { limit, sources: ["web"] });
          const items = (response.web ?? []).slice(0, limit);

          const output = items.length
            ? items
              .map((data, index) => {
                const title = ("title" in data && data.title) || "(untitled)";
                const url = ("url" in data && data.url) || "";
                const snip = ("snippet" in data && data.snippet) || "";
                return `${index + 1}. ${title}\n   ${url}\n   ${snip}`;
              })
              .join("\n\n")
            : "(no result)";

          tracker.log({
            type: "code_analysis",
            path: `web_search:${query}`,
            details: { after: output, toolName: "web_search" },
            status: "executed",
          });
          return clip(output);
        } catch (error) {
          if (error instanceof Error) {
            return `Error during web search: ${error.message}`;
          }
          return `Error during web search: ${String(error)}`;
        }
      },
    }),

    // Let the agent fetch and scrape a specific URL into markdown text.
    web_crawl: tool({
      description: "Scrape a URL into markdown text.",
      inputSchema: z.object({ url: z.url() }),
      execute: async ({ url }) => {
        try {
          const doc = await getClient().scrape(url, { formats: ["markdown"] });
          const md = (doc as { markdown?: string }).markdown ?? "";
          tracker.log({
            type: "code_analysis",
            path: `web_crawl:${url}`,
            details: { after: clip(md), toolName: "web_crawl" },
            status: "executed",
          });
          return clip(md) || "(empty)";
        } catch (error) {
          if (error instanceof Error) {
            return `Error during web crawl: ${error.message}`;
          }
          return `Error during web crawl: ${String(error)}`;
        }
      },
    }),

    // Provide a simple HTTP fetch helper for retrieving raw page content.
    fetch_url: tool({
      description: "HTTP GET for a URL. Returns response body.",
      inputSchema: z.object({ url: z.url() }),
      execute: async ({ url }) => {
        try {
          const r = await fetch(url, { redirect: "follow" });
          const body = await r.text();
          const out = clip(body, 16_000);
          tracker.log({
            type: "code_analysis",
            path: `fetch:${url}`,
            details: { after: `HTTP ${r.status}\n\n${out}`, toolName: "fetch_url" },
            status: "executed",
          });
          return `HTTP ${r.status}\n\n${out}`;
        } catch (error) {
          if (error instanceof Error) {
            return `Error fetching URL: ${error.message}`;
          }
          return `Error fetching URL: ${String(error)}`;
        }
      },
    }),
  };
};
