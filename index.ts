#!/usr/bin/env bun
// It is a shebang that tells the operating system to execute the file using Bun.
// EX:- dir-to-cmd % bun index.ts

import { Command } from "commander";
import { runWakeup } from "./terminal-ui/wakeup";

// Create the CLI entrypoint so commands can be registered and executed.
const program = new Command();

// Define the top-level CLI metadata that appears in help output and version info.
program
  .name("own-claw")
  .description("To be added................................")
  .version("0.0.1");

// Register the wakeup command that starts the interactive terminal experience.
program
  .command("wakeup")
  .description("Show the banner and modes of action.")
  .action(async () => {
    // Run the wakeup flow when the command is invoked from the terminal.
    await runWakeup();
  });

// Parse the incoming CLI arguments so the selected command can execute.
await program.parseAsync(process.argv);
