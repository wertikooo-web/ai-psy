import fs from "fs";
import { unlink } from "fs/promises";
import OpenAI from "openai";
import { getLinkedTelegramAccount } from "@/lib/telegram/auth";
import { linkTelegramAccount, setTelegramNaturalLanguageEnabled, type TelegramAccount, type TelegramIdentity } from "@/lib/data/telegramLinks";
import {
  answerTelegramCallback,
  downloadTelegramFileToTemp,
  editTelegramMessage,
  getTelegramFile,
  parseTelegramCommand,
  sendTelegramMessage,
  type TelegramCallbackQuery,
  type TelegramMessage,
} from "@/lib/telegram/bot";
import { handleTelegramAudioMessage } from "@/lib/telegram/audioFlow";
import { handleTelegramReadOnlySearch, isTelegramNaturalLanguageEnabled, sendCapabilitiesOverview, sendCapabilityHelp } from "@/lib/telegram/search";

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
  "Можно писать обычными фразами, например:",
  "«Последняя консультация Анны»",
  "«Найди всё про тревогу»",
  "«Сколько консультаций было в июне?»",
  "",
  "Для транскрибации — прикрепите аудиофайл.",
  "",
  "Что умею → напишите «Что ты умеешь?»",
].join("\n");

const HELP_TEXT = [
  "Можно писать обычными фразами — команды необязательны.",
  "",
  "Примеры:",
  "«Последняя консультация Анны»",
  "«Найди всё про тревогу»",
  "«Сколько консультаций было в июне?»",
  "«Что помнить про клиента перед сессией?»",
  "",
  "Команды (резерв):",
  "/client Имя — карточка клиента",
  "/last Имя — последняя консультация",
  "/consultations Имя — список консультаций",
  "/search запрос — поиск",
  "/stats month — статистика",
  "/settings — настройки",
  "",
  "Аудиофайл → транскрибация консультации.",
].join("\n");

const VOICE_QUERY_MAX_SECONDS = 180;
const SETTINGS_NL_PREFIX = "settings:nl:";

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

function settingsText(account: TelegramAccount): string {
  return [
    "Настройки Telegram",
    "",
    `Обычные фразы через LLM: ${account.naturalLanguageEnabled ? "включены" : "выключены"}`,
    "",
    "Команды /client, /last, /consultations и /search работают всегда.",
  ].join("\n");
}

function settingsKeyboard(account: TelegramAccount) {
  const next = account.naturalLanguageEnabled ? "off" : "on";
  return {
    inline_keyboard: [
      [
        {
          text: account.naturalLanguageEnabled ? "LLM-фразы: выключить" : "LLM-фразы: включить",
          callback_data: `${SETTINGS_NL_PREFIX}${next}`,
        },
      ],
      [{ text: "Статус", callback_data: "settings:status" }],
    ],
  };
}

async function sendTelegramSettings(chatId: number, telegramId: number): Promise<void> {
  const account = await getLinkedTelegramAccount(telegramId);
  if (!account) {
    await sendTelegramMessage(chatId, INTRO_TEXT);
    return;
  }
  await sendTelegramMessage(chatId, settingsText(account), settingsKeyboard(account));
}

export async function handleHelpCallback(query: TelegramCallbackQuery): Promise<boolean> {
  const data = query.data ?? "";
  if (!data.startsWith("help:")) return false;

  const chatId = query.message?.chat.id;
  await answerTelegramCallback(query.id);
  if (!chatId) return true;

  if (data === "help:capabilities") {
    await sendCapabilitiesOverview(chatId);
  } else {
    await sendCapabilityHelp(chatId, data.slice(5));
  }
  return true;
}

export async function handleTelegramSettingsCallback(query: TelegramCallbackQuery): Promise<boolean> {
  const data = query.data ?? "";
  if (!data.startsWith("settings:")) return false;

  try {
    const account = await getLinkedTelegramAccount(query.from.id);
    if (!account) {
      await answerTelegramCallback(query.id, "Telegram не подключён");
      return true;
    }

    let nextAccount = account;
    if (data.startsWith(SETTINGS_NL_PREFIX)) {
      nextAccount = await setTelegramNaturalLanguageEnabled(query.from.id, data.endsWith("on"));
      await answerTelegramCallback(query.id, nextAccount.naturalLanguageEnabled ? "LLM-фразы включены" : "LLM-фразы выключены");
    } else if (data === "settings:status") {
      await answerTelegramCallback(query.id, account.naturalLanguageEnabled ? "LLM-фразы включены" : "LLM-фразы выключены");
    } else {
      await answerTelegramCallback(query.id);
      return true;
    }

    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    if (chatId && messageId) {
      await editTelegramMessage(chatId, messageId, settingsText(nextAccount), settingsKeyboard(nextAccount));
    }
  } catch (error) {
    console.error("[telegram/settings callback]", error);
    await answerTelegramCallback(query.id, "Не удалось изменить настройку");
  }
  return true;
}

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-...")) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

async function transcribeVoiceQuery(message: TelegramMessage): Promise<string> {
  if (!message.voice?.file_id) throw new Error("Voice message is missing");
  if ((message.voice.duration ?? 0) > VOICE_QUERY_MAX_SECONDS) {
    throw new Error("Voice query is too long");
  }

  let tempPath: string | null = null;
  try {
    const file = await getTelegramFile(message.voice.file_id);
    if (!file.file_path) throw new Error("Telegram voice file path is missing");
    tempPath = await downloadTelegramFileToTemp(file.file_path);
    const openai = getOpenAI();
    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
      language: "ru",
    });
    return (result.text ?? "").trim();
  } finally {
    if (tempPath) await unlink(tempPath).catch(() => {});
  }
}

async function handleVoiceSearch(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  try {
    const account = message.from?.id ? await getLinkedTelegramAccount(message.from.id) : null;
    if (!message.from?.id || !account) {
      await sendTelegramMessage(chatId, INTRO_TEXT);
      return;
    }
    if (!isTelegramNaturalLanguageEnabled() || !account.naturalLanguageEnabled) {
      await sendTelegramMessage(
        chatId,
        [
          "Голосовые вопросы подключим после проверки команд.",
          "",
          "Сейчас используйте:",
          "/client Имя",
          "/last Имя",
          "/consultations Имя",
          "/search запрос",
          "",
          "Если это запись консультации, прикрепите её как аудиофайл.",
        ].join("\n"),
      );
      return;
    }
    const text = await transcribeVoiceQuery(message);
    if (!text) {
      await sendTelegramMessage(chatId, "Не удалось распознать голосовой вопрос. Попробуйте сказать короче или написать текстом.");
      return;
    }
    await sendTelegramMessage(chatId, `Распознал: «${text}»`);
    await handleTelegramReadOnlySearch(message, text);
  } catch (error) {
    console.error("[telegram/voice query]", error);
    const text = error instanceof Error && error.message === "Voice query is too long"
      ? "Голосовой вопрос слишком длинный. Для поиска отправьте короткий вопрос, а запись консультации прикрепите как аудиофайл."
      : "Не удалось обработать голосовой вопрос. Попробуйте написать запрос текстом.";
    await sendTelegramMessage(chatId, text);
  }
}

async function handleAudioUpload(message: TelegramMessage): Promise<boolean> {
  try {
    return await handleTelegramAudioMessage(message);
  } catch (error) {
    console.error("[telegram/audio command]", error);
    await sendTelegramMessage(
      message.chat.id,
      "Аудиофайл получен, но не удалось подготовить загрузку. Проверьте подключение Telegram на сайте и попробуйте ещё раз.",
    );
    return true;
  }
}

export async function handleTelegramMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const identity = identityFromMessage(message);
  if (!identity) return;

  const parsed = parseTelegramCommand(message.text);

  if (parsed?.command === "/start") {
    const account = await getLinkedTelegramAccount(identity.id);
    await sendTelegramMessage(chatId, account ? LINKED_TEXT : INTRO_TEXT);
    return;
  }

  if (parsed?.command === "/help") {
    await sendTelegramMessage(chatId, HELP_TEXT);
    return;
  }

  if (parsed?.command === "/settings") {
    await sendTelegramSettings(chatId, identity.id);
    return;
  }

  if (parsed?.command === "/status") {
    const account = await getLinkedTelegramAccount(identity.id);
    await sendTelegramMessage(
      chatId,
      account
        ? "Telegram подключён.\nПрофиль: текущий профиль приложения."
        : "Telegram не подключён.",
    );
    return;
  }

  if (parsed?.command === "/link") {
    const code = parsed.args.trim();
    try {
      const result = await linkTelegramAccount(code, identity);
      await sendTelegramMessage(
        chatId,
        result.ok ? "Telegram успешно подключён к TRANSCRIPT AI · PSY." : linkErrorText(result.reason),
      );
    } catch (error) {
      console.error("[telegram/link command]", error);
      await sendTelegramMessage(
        chatId,
        "Не удалось подключить Telegram. Создайте новый код в настройках и попробуйте ещё раз.",
      );
    }
    return;
  }

  if (message.voice) {
    await handleVoiceSearch(message);
    return;
  }

  if (await handleAudioUpload(message)) return;

  if (message.text) {
    try {
      await handleTelegramReadOnlySearch(message, message.text);
    } catch (error) {
      console.error("[telegram/read-only search]", error);
      await sendTelegramMessage(
        chatId,
        "Сначала подключите Telegram в настройках приложения. После получения кода отправьте /link 123456.",
      );
    }
    return;
  }

  await sendTelegramMessage(chatId, "Пришлите текстовый вопрос, короткое голосовое для поиска или прикрепите аудиофайл консультации.");
}
