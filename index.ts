#!/usr/bin/env bun
// It is a shebang that tells the operating system to execute the file using Bun.
// EX:- dir-to-cmd % bun index.ts

import { Command } from "commander";
import { runWakeup } from "./terminal-ui/wakeup";

const program = new Command();

// setup the necessary details
program
  .name("own-claw")
  .description("To be added................................")
  .version("0.0.1");

// create method thats is responsible to call the bot
program
  .command("wakeup")
  .description("Show the banner and modes of action.")
  .action(async () => {
    await runWakeup();
  });

await program.parseAsync(process.argv);
