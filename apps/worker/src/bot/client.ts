/**
 * Discord Bot — client & registrasi slash commands.
 * Commands didaftarkan ke guild (dev) atau global (prod).
 */

import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    type SlashCommandBuilder,
    type SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { env } from "../config";
import { logger } from "../logger";
import { registerCommands } from "./commands";

export const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

export async function deployCommands(
    commands: (SlashCommandBuilder | SlashCommandOptionsOnlyBuilder)[],
) {
    const rest = new REST({ version: "10" }).setToken(env.DISCORD_BOT_TOKEN);
    const body = commands.map((c) => c.toJSON());

    try {
        if (env.DISCORD_GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
                body,
            });
            logger.info("slash commands didaftarkan ke guild");
        } else {
            await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
            logger.info("slash commands didaftarkan global");
        }
    } catch (err) {
        logger.error({ err }, "gagal deploy slash commands");
    }
}

export async function startBot() {
    client.once("ready", () => {
        logger.info(`bot online sebagai ${client.user?.tag}`);
    });

    client.on("error", (err) => {
        logger.error({ err }, "discord client error");
    });

    registerCommands(client);

    await deployCommands(COMMAND_BUILDERS);
    await client.login(env.DISCORD_BOT_TOKEN);
}

// Re-export agar index.ts bisa deploy commands.
import { COMMAND_BUILDERS } from "./commands";