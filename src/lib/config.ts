import { homedir } from "os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as readline from "readline";

// Allow override via environment variable for testing
// Must be a function to support runtime changes (e.g., test isolation)
function getConfigDir(): string {
  return process.env.ENDURANCE_COACH_CONFIG_DIR || join(homedir(), ".endurance-coach");
}

export interface StravaConfig {
  client_id: string;
  client_secret: string;
}

export interface Config {
  strava: StravaConfig;
  sync_days: number;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete_id: number;
}

export function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function getTokensPath(): string {
  return join(getConfigDir(), "tokens.json");
}

export function getDbPath(): string {
  return join(getConfigDir(), "coach.db");
}

export function configExists(): boolean {
  return existsSync(getConfigPath());
}

export function tokensExist(): boolean {
  return existsSync(getTokensPath());
}

export function loadConfig(): Config {
  const configPath = getConfigPath();
  if (!configExists()) {
    throw new Error(`Config not found at ${configPath}. Run setup first.`);
  }
  const data = readFileSync(configPath, "utf-8");
  return JSON.parse(data);
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

export function loadTokens(): Tokens {
  const tokensPath = getTokensPath();
  if (!tokensExist()) {
    throw new Error(`Tokens not found at ${tokensPath}. Run auth first.`);
  }
  const data = readFileSync(tokensPath, "utf-8");
  return JSON.parse(data);
}

export function saveTokens(tokens: Tokens): void {
  ensureConfigDir();
  writeFileSync(getTokensPath(), JSON.stringify(tokens, null, 2));
}

export function tokensExpired(tokens: Tokens): boolean {
  // Add 60 second buffer
  return Date.now() / 1000 > tokens.expires_at - 60;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function promptForConfig(): Promise<Config> {
  console.log("\n🚴 Endurance Coach Setup\n");
  console.log("To use this tool, you need a Strava API application.");
  console.log("Create one at: https://www.strava.com/settings/api");
  console.log('Set "Authorization Callback Domain" to: localhost\n');

  const client_id = await prompt("Enter your Strava Client ID: ");
  const client_secret = await prompt("Enter your Strava Client Secret: ");
  const sync_days_str = await prompt("Days of history to sync (default 730): ");
  const sync_days = parseInt(sync_days_str) || 730;

  return {
    strava: { client_id, client_secret },
    sync_days,
  };
}

export function createConfig(client_id: string, client_secret: string, sync_days = 730): Config {
  return {
    strava: { client_id, client_secret },
    sync_days,
  };
}
