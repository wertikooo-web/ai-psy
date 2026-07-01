import { getLinkedTelegramAccount } from "@/lib/telegram/auth";
import { linkTelegramAccount, type TelegramIdentity } from "@/lib/data/telegramLinks";
import { parseTelegramCommand, sendTelegramMessage, type TelegramMessage } from "@/lib/telegram/bot";
import { handleTelegramAudioMessage } from "@/lib/telegram/audioFlow";

const INTRO_TEXT = [
  "Здравствуйте! Это Telegram-помощник TRANSCRIPT AI · PSY.",
  "",
  "Сначала подключите Telegram в настройках приложения.",
  "",
  "После получения кода отправьте:",
  "/link 123456",
].join("\n");

const LINKED_TEXT = [
  "Telegram подключён к TRANSCRIPT AI · PSY.",
  "",
  "На первом этапе доступны:",
  "/help",
  "/status",
].join("\n");

const HELP_TEXT = [
  "Доступные команды:",
  "/start — проверить подключение",
  "/link 123456 — подключить Telegram по одноразовому коду",
  "/status — статус подключения",
  "/help — помощь",
].join("\n");

function identityFromMessage(message: TelegramMessage): TelegramIdentity | null {
  if (!message.from?.id || message.from.is_bot) return null;
  return {
    id: message.from.id,
    username: message.from.username,
    firstName: message.from.first_name,
    lastName: message.from.last_name,
  };
}

function linkErrorText(reason: string): string {
  if (reason === "used") return "Код уже использован.";
  if (reason === "expired") return "Срок действия кода истёк.";
  if (reason === "already_linked") return "Telegram уже подключён.";
  if (reason === "rate_limited") return "Слишком много попыток. Попробуйте позже.";
  return "Код неверный.";
}

export async function handleTelegramMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const identity = identityFromMessage(message);
  if (!identity) return;

  if (await handleTelegramAudioMessage(message)) return;

  const parsed = parseTelegramCommand(message.text);
  if (!parsed) {
    await sendTelegramMessage(chatId, "На первом этапе доступны только команды /start, /help, /link и /status.");
    return;
  }

  if (parsed.command === "/start") {
    const account = await getLinkedTelegramAccount(identity.id);
    await sendTelegramMessage(chatId, account ? LINKED_TEXT : INTRO_TEXT);
    return;
  }

  if (parsed.command === "/help") {
    await sendTelegramMessage(chatId, HELP_TEXT);
    return;
  }

  if (parsed.command === "/status") {
    const account = await getLinkedTelegramAccount(identity.id);
    await sendTelegramMessage(
      chatId,
      account
        ? "Telegram подключён.\nПрофиль: текущий профиль приложения."
        : "Telegram не подключён.",
    );
    return;
  }

  if (parsed.command === "/link") {
    const code = parsed.args.trim();
    const result = await linkTelegramAccount(code, identity);
    await sendTelegramMessage(
      chatId,
      result.ok ? "Telegram успешно подключён к TRANSCRIPT AI · PSY." : linkErrorText(result.reason),
    );
    return;
  }

  await sendTelegramMessage(chatId, "Эта команда пока недоступна. Используйте /help.");
}
