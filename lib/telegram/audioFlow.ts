import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import { getClients, getClientById } from "@/lib/data/clients";
import { addConsultation, getConsultation, getConsultationsForClient, updateConsultation } from "@/lib/data/consultations";
import {
  claimTelegramAudioUpload,
  createTelegramAudioUpload,
  getTelegramAudioUpload,
  getTelegramAudioUploadByIdPrefix,
  updateTelegramAudioUpload,
  type TelegramAudioUpload,
} from "@/lib/data/telegramAudioUploads";
import { requireLinkedTelegramAccount } from "@/lib/telegram/auth";
import {
  answerTelegramCallback,
  downloadTelegramFileToTemp,
  editTelegramMessage,
  getTelegramFile,
  sendTelegramMessage,
  type TelegramCallbackQuery,
  type TelegramDocumentLike,
  type TelegramInlineKeyboardButton,
  type TelegramMessage,
} from "@/lib/telegram/bot";
import { AUDIO_MAX_RAW_SIZE, isSupportedAudioFile, storeAudioFileFromPath } from "@/lib/audio/uploadAudio";
import type { StoredClient } from "@/lib/clientStore";
import type { StoredConsultation } from "@/lib/consultationStore";

type AudioPayload = {
  fileId: string;
  fileUniqueId?: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  durationSeconds?: number;
};

const NOT_LINKED_TEXT = "Сначала подключите Telegram в настройках TRANSCRIPT AI · PSY.";

function shortId(id: string): string {
  return id.slice(0, 12);
}

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "").replace(/\/$/, "");
}

function consultationUrl(id: string): string | null {
  const base = appBaseUrl();
  return base ? `${base}/consultation/${id}` : null;
}

function button(text: string, data: string): TelegramInlineKeyboardButton {
  return { text, callback_data: data };
}

function row(...items: TelegramInlineKeyboardButton[]): TelegramInlineKeyboardButton[] {
  return items;
}

function audioFromMessage(message: TelegramMessage): AudioPayload | null {
  if (message.audio) {
    return {
      fileId: message.audio.file_id,
      fileUniqueId: message.audio.file_unique_id,
      fileName: message.audio.file_name || `telegram-audio-${message.message_id}.mp3`,
      mimeType: message.audio.mime_type,
      fileSize: message.audio.file_size,
      durationSeconds: message.audio.duration,
    };
  }
  const doc = message.document as TelegramDocumentLike | undefined;
  if (doc) {
    const fileName = doc.file_name || `telegram-document-${message.message_id}`;
    if (!isSupportedAudioFile(fileName, doc.mime_type)) return null;
    return {
      fileId: doc.file_id,
      fileUniqueId: doc.file_unique_id,
      fileName,
      mimeType: doc.mime_type,
      fileSize: doc.file_size,
    };
  }
  return null;
}

async function findUploadByShortId(idPart: string): Promise<TelegramAudioUpload | null> {
  if (idPart.length >= 32) return getTelegramAudioUpload(idPart);
  return getTelegramAudioUploadByIdPrefix(idPart);
}

async function getUploadFromCallback(uploadShortId: string, telegramId: number): Promise<TelegramAudioUpload> {
  const upload = await findUploadByShortId(uploadShortId);
  if (!upload || upload.telegramId !== telegramId) throw new Error("Upload not found");
  return upload;
}

async function findClientByShortId(idPart: string): Promise<StoredClient | null> {
  const clients = await getClients();
  return clients.find((client) => client.id.startsWith(idPart)) ?? null;
}

async function findConsultationByShortId(idPart: string) {
  const uploadId = idPart;
  if (uploadId.length >= 32) return getConsultation(uploadId);
  const clients = await getClients();
  for (const client of clients) {
    const consultations = await getConsultationsForClient(client.id);
    const found = consultations.find((item) => item.id.startsWith(idPart));
    if (found) return found;
  }
  return null;
}

async function clientKeyboard(upload: TelegramAudioUpload) {
  const clients = (await getClients()).slice(0, 6);
  const rows = clients.map((client) => row(button(client.name, `ta:c:${upload.id}:${shortId(client.id)}`)));
  rows.push(row(button("Отмена", `ta:x:${upload.id}`)));
  return { inline_keyboard: rows };
}

async function consultationKeyboard(upload: TelegramAudioUpload, clientId: string) {
  const consultations = (await getConsultationsForClient(clientId)).slice(0, 5);
  const rows = consultations.map((item) => {
    const label = item.title || new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt));
    return row(button(label, `ta:k:${upload.id}:${shortId(item.id)}`));
  });
  rows.push(row(button("Создать новую консультацию", `ta:n:${upload.id}:${shortId(clientId)}`)));
  rows.push(row(button("Отмена", `ta:x:${upload.id}`)));
  return { inline_keyboard: rows };
}

function confirmKeyboard(upload: TelegramAudioUpload) {
  const rows = [
    row(button("Загрузить и транскрибировать", `ta:y:${upload.id}`)),
    row(button("Изменить клиента", `ta:b:${upload.id}`)),
    row(button("Отмена", `ta:x:${upload.id}`)),
  ];
  return { inline_keyboard: rows };
}

async function showConfirmation(chatId: number, messageId: number, upload: TelegramAudioUpload) {
  const client = upload.clientId ? await getClientById(upload.clientId) : null;
  const consultation = upload.consultationId ? await getConsultation(upload.consultationId) : null;
  await editTelegramMessage(
    chatId,
    messageId,
    [
      "Подтвердите загрузку",
      "",
      `Клиент: ${client?.name || "не выбран"}`,
      `Консультация: ${consultation?.title || consultation?.createdAt || "не выбрана"}`,
      `Файл: ${upload.originalFilename || "аудио"}`,
      upload.fileSize ? `Размер: ${(upload.fileSize / 1024 / 1024).toFixed(1)} МБ` : "",
      upload.durationSeconds ? `Длительность: ${Math.round(upload.durationSeconds / 60)} мин.` : "",
      "",
      "После подтверждения аудио будет отправлено на транскрибацию.",
    ].filter(Boolean).join("\n"),
    confirmKeyboard(upload),
  );
}

export async function handleTelegramAudioMessage(message: TelegramMessage): Promise<boolean> {
  const audio = audioFromMessage(message);
  if (!audio) return false;
  if (!message.from?.id) return true;

  let account;
  try {
    account = await requireLinkedTelegramAccount(message.from.id);
  } catch {
    await sendTelegramMessage(message.chat.id, NOT_LINKED_TEXT);
    return true;
  }

  if (audio.fileSize && audio.fileSize > AUDIO_MAX_RAW_SIZE) {
    await sendTelegramMessage(
      message.chat.id,
      "Файл слишком большой для загрузки через Telegram.\n\nЗагрузите его через страницу консультации на сайте.",
    );
    return true;
  }

  const upload = await createTelegramAudioUpload({
    profileId: account.profileId,
    telegramId: message.from.id,
    telegramChatId: message.chat.id,
    telegramMessageId: message.message_id,
    telegramFileId: audio.fileId,
    telegramFileUniqueId: audio.fileUniqueId,
    originalFilename: audio.fileName,
    mimeType: audio.mimeType,
    fileSize: audio.fileSize,
    durationSeconds: audio.durationSeconds,
  });

  await sendTelegramMessage(
    message.chat.id,
    "Аудиозапись получена.\n\nНужно определить, к какому клиенту и консультации её прикрепить.",
    await clientKeyboard(upload),
  );
  return true;
}

async function createConsultationForUpload(upload: TelegramAudioUpload, clientId: string): Promise<StoredConsultation> {
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found");
  const now = new Date().toISOString();
  const consultation: StoredConsultation = {
    id: randomUUID(),
    clientId: client.id,
    clientName: client.name,
    clientInitials: client.initials,
    clientColor: client.color,
    title: `Telegram audio ${new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(now))}`,
    createdAt: now,
    source: "audio",
    status: "created",
  };
  await addConsultation(consultation);
  return consultation;
}

export async function handleTelegramAudioCallback(query: TelegramCallbackQuery): Promise<boolean> {
  const data = query.data ?? "";
  if (!data.startsWith("ta:")) return false;
  await answerTelegramCallback(query.id);
  if (!query.message || !query.from?.id) return true;

  const [, action, uploadShortId, targetShortId] = data.split(":");
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  try {
    const upload = await getUploadFromCallback(uploadShortId, query.from.id);

    if (action === "x") {
      await updateTelegramAudioUpload(upload.id, { status: "cancelled" });
      await editTelegramMessage(chatId, messageId, "Загрузка отменена.");
      return true;
    }

    if (action === "b") {
      await updateTelegramAudioUpload(upload.id, { clientId: undefined, consultationId: undefined, status: "awaiting_client" });
      await editTelegramMessage(chatId, messageId, "Выберите клиента:", await clientKeyboard(upload));
      return true;
    }

    if (action === "c") {
      const client = await findClientByShortId(targetShortId);
      if (!client) throw new Error("Client not found");
      // Always create a new consultation for Telegram audio uploads
      const consultation = await createConsultationForUpload(upload, client.id);
      const updated = await updateTelegramAudioUpload(upload.id, {
        clientId: client.id,
        consultationId: consultation.id,
        status: "awaiting_confirmation",
      });
      await showConfirmation(chatId, messageId, updated);
      return true;
    }

    if (action === "k") {
      const consultation = await findConsultationByShortId(targetShortId);
      if (!consultation || !upload.clientId || consultation.clientId !== upload.clientId) {
        throw new Error("Consultation/client mismatch");
      }
      const updated = await updateTelegramAudioUpload(upload.id, {
        consultationId: consultation.id,
        status: "awaiting_confirmation",
      });
      await showConfirmation(chatId, messageId, updated);
      return true;
    }

    if (action === "n") {
      const client = await findClientByShortId(targetShortId);
      if (!client) throw new Error("Client not found");
      const consultation = await createConsultationForUpload(upload, client.id);
      const updated = await updateTelegramAudioUpload(upload.id, {
        clientId: client.id,
        consultationId: consultation.id,
        status: "awaiting_confirmation",
      });
      await showConfirmation(chatId, messageId, updated);
      return true;
    }

    if (action === "y") {
      if (!upload.clientId || !upload.consultationId) throw new Error("Upload is incomplete");
      if (upload.status === "completed") {
        await editTelegramMessage(chatId, messageId, "Эта загрузка уже завершена.");
        return true;
      }
      if (["queued", "downloading", "uploading", "processing"].includes(upload.status)) {
        await editTelegramMessage(chatId, messageId, "Эта загрузка уже в обработке.");
        return true;
      }
      if (upload.status !== "awaiting_confirmation") throw new Error("Upload is not ready for processing");
      await updateTelegramAudioUpload(upload.id, {
        status: "queued",
        confirmedAt: new Date().toISOString(),
      });
      await editTelegramMessage(chatId, messageId, "Загрузка принята. Аудио отправлено на обработку.");
      await triggerTelegramUploadProcessing(upload.id);
      return true;
    }
  } catch (err) {
    console.error("[telegram/audio callback]", err instanceof Error ? err.message : String(err));
    await editTelegramMessage(chatId, messageId, "Не удалось обработать действие. Попробуйте заново.");
  }
  return true;
}

export async function triggerTelegramUploadProcessing(uploadId: string): Promise<void> {
  const base = appBaseUrl();
  const secret = process.env.TELEGRAM_INTERNAL_SECRET;
  if (!base || !secret) {
    await updateTelegramAudioUpload(uploadId, {
      status: "failed",
      errorMessage: "Telegram internal processing is not configured",
    }).catch(() => {});
    console.error("[telegram/process trigger] APP_BASE_URL or TELEGRAM_INTERNAL_SECRET is not configured");
    return;
  }
  fetch(`${base}/api/telegram/process-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-telegram-secret": secret,
    },
    body: JSON.stringify({ uploadId }),
  }).catch((err) => console.error("[telegram/process trigger]", err instanceof Error ? err.message : String(err)));
}

export async function processTelegramAudioUpload(uploadId: string): Promise<void> {
  const upload = await claimTelegramAudioUpload(uploadId);
  if (!upload || !upload.consultationId) return;
  let tempPath: string | null = null;
  try {
    const file = await getTelegramFile(upload.telegramFileId);
    if (!file.file_path) throw new Error("Telegram file path missing");
    if (file.file_size && file.file_size > AUDIO_MAX_RAW_SIZE) {
      throw new Error("Telegram file is too large for the audio pipeline");
    }
    tempPath = await downloadTelegramFileToTemp(file.file_path);
    await updateTelegramAudioUpload(upload.id, { status: "uploading" });
    const stored = await storeAudioFileFromPath({
      filePath: tempPath,
      originalName: upload.originalFilename || "telegram-audio.mp3",
      mimeType: upload.mimeType,
      fileSize: upload.fileSize ?? file.file_size,
    });

    await updateConsultation(upload.consultationId, {
      status: "created",
      audio: {
        fileName: stored.fileName,
        fileUrl: stored.fileUrl,
        fileSize: stored.fileSize,
      },
    });

    await updateTelegramAudioUpload(upload.id, { status: "processing" });
    const base = appBaseUrl();
    if (!base) throw new Error("APP_BASE_URL is not configured");
    const transcribe = await fetch(`${base}/api/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultationId: upload.consultationId }),
    });
    if (!transcribe.ok) throw new Error(`Transcription failed: ${transcribe.status}`);
    await updateTelegramAudioUpload(upload.id, { status: "completed", completedAt: new Date().toISOString() });
    const url = consultationUrl(upload.consultationId);
    await sendTelegramMessage(
      upload.telegramChatId,
      `Готово. Аудио загружено и транскрибация запущена.${url ? `\n\nОткрыть консультацию: ${url}` : ""}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Telegram audio processing failed";
    console.error("[telegram/process upload]", message);
    await updateTelegramAudioUpload(upload.id, { status: "failed", errorMessage: message }).catch(() => {});
    await sendTelegramMessage(
      upload.telegramChatId,
      "Не удалось загрузить аудио.\nФайл сохранён в очереди, повторите обработку позже.",
    ).catch(() => {});
  } finally {
    if (tempPath) await unlink(tempPath).catch(() => {});
  }
}
