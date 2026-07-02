import { findTelegramAccountByTelegramId, type TelegramAccount } from "@/lib/data/telegramLinks";

export async function getLinkedTelegramAccount(telegramId: number): Promise<TelegramAccount | null> {
  return findTelegramAccountByTelegramId(telegramId);
}

export async function requireLinkedTelegramAccount(telegramId: number): Promise<TelegramAccount> {
  const account = await getLinkedTelegramAccount(telegramId);
  if (!account || account.disabledAt) {
    throw new Error("Telegram account is not linked");
  }
  return account;
}
