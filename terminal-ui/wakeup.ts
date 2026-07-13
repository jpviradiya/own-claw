import { select, isCancel } from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import { runCliModes } from "../modes/cli.modes";

// constants values
const BANNER_FONT = "ANSI Shadow";
const SHADOW = chalk.hex("#5b4d9e");
const FACE = chalk.hex("#e8dcf8").bold;

// writes information in terminal
const printBannerWithShadow = (ascii: string) => {
  const bannerLines = ascii.replace(/\s+$/, "").split("\n");
  const maxLen = Math.max(...bannerLines.map((l) => l.length), 0);
  const rowWidth = maxLen + 2;

  for (const line of bannerLines) {
    console.log(SHADOW(("  " + line).padEnd(rowWidth)));
  }
  process.stdout.write(`\x1b[${bannerLines.length}A`);
  for (const line of bannerLines) {
    console.log(FACE(line.padEnd(rowWidth)));
  }
  console.log();
};

// function that is responsible to give response while calling the first command
export const runWakeup = async () => {
  let ascii: string;
  try {
    ascii = figlet.textSync("own-claw", { font: BANNER_FONT });
  } catch (error) {
    ascii = figlet.textSync("own-claw", { font: "Standard" });
  }

  // printing the banner
  printBannerWithShadow(ascii);

  while (true) {
    // give option to user for further interation
    const mode = await select({
      message: "Which mode you want to proceed with?",
      options: [
        { value: "cli", label: "CLI" },
        { value: "telegram", label: "Telegram" },
        { value: "exit", label: "Exit" },
      ],
    });

    if (isCancel(mode) || mode == "exit") {
      console.log(chalk.dim(`\nGoodbye....\n`));
      return;
    } else if (mode == "cli") {
      await runCliModes();
    } else if (mode == "telegram") {
      // await runTelegramModes();
    }
  }
};
