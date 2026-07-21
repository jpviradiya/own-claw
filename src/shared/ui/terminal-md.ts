import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

let ready = false;

function terminalWindow(): void {
  if (ready) return;
  const w = Math.max(40, Math.min(process.stdout.columns || 80, 120));
  marked.use(markedTerminal({ width: w, reflowText: true }, {}) as any);
  ready = true;
}

export const renderTerminalMarkDown = (source: string): string => {
  terminalWindow();
  return marked.parse(source.trimEnd(), { async: false }) as string;
};
