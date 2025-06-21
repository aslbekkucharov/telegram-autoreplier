import "dotenv/config";
import prompts from "prompts";
import { TelegramClient } from "telegram";
import { NewMessage } from "telegram/events/index.js";
import { StringSession } from "telegram/sessions/index.js";
import path from "path";
const MAX_DAILY_REPLIES = 1;
const REPLY_COOLDOWN = 3e5;
path.join(process.cwd(), "session.txt");
function getUserInfo(sender) {
  if (!sender) return "Неизвестный пользователь";
  const username = sender.username ? `@${sender.username}` : "";
  const firstName = sender.firstName || "";
  const lastName = sender.lastName || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  return `${fullName} ${username} (ID: ${sender.id})`.trim();
}
function canReplyToUser(userId, replies2) {
  const now = Date.now();
  const today = (/* @__PURE__ */ new Date()).toDateString();
  const userData = replies2.get(userId);
  if (!userData) {
    replies2.set(userId, { lastReply: now, dailyCount: 1, lastResetDate: today });
    return true;
  }
  if (userData.lastResetDate !== today) {
    userData.dailyCount = 0;
    userData.lastResetDate = today;
  }
  if (now - userData.lastReply < REPLY_COOLDOWN) {
    console.log(`Кулдаун для пользователя ${userId}: осталось ${Math.ceil((REPLY_COOLDOWN - (now - userData.lastReply)) / 1e3 / 60)} мин`);
    return false;
  }
  if (userData.dailyCount >= MAX_DAILY_REPLIES) {
    console.log(`Достигнут дневной лимит для пользователя ${userId}`);
    return false;
  }
  userData.lastReply = now;
  userData.dailyCount++;
  replies2.set(userId, userData);
  return true;
}
function isOnVacation() {
  const now = /* @__PURE__ */ new Date();
  const vacationStart = /* @__PURE__ */ new Date("2024-06-23");
  const vacationEnd = /* @__PURE__ */ new Date("2024-06-29");
  return now >= vacationStart && now <= vacationEnd;
}
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const session = process.env.APP_SESSION;
const AUTO_REPLY = "Спасибо за сообщение! Я сейчас в отпуске с 23 по 29 июня. Отвечу вам, как только вернусь. 🏖️";
const replies = /* @__PURE__ */ new Map();
async function main() {
  try {
    const stringSession = new StringSession(session || "");
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      retryDelay: 2e3,
      timeout: 1e4
    });
    await client.start({
      onError: (err) => {
        console.error("Something went wrong:", err);
        process.exit(1);
      },
      phoneNumber: async () => {
        const response = await prompts({ type: "text", name: "phone", message: "Введите номер телефона:" });
        return response.phone;
      },
      password: async () => {
        const response = await prompts({ type: "password", name: "password", message: "Введите пароль 2FA:" });
        return response.password;
      },
      phoneCode: async () => {
        const response = await prompts({ type: "text", name: "phoneCode", message: "Введите код из Telegram:" });
        return response.phoneCode;
      }
    });
    console.log("✅ Авторизация успешна!");
    if (!stringSession) {
      client.session.save();
    }
    const me = await client.getMe();
    console.log(`👤 Авторизован как: ${me.firstName} ${me.lastName || ""} (@${me.username || "без username"})`);
    if (!isOnVacation()) {
      console.log("⚠️  Внимание: Сейчас не период отпуска");
    }
    client.addEventHandler(async (event) => {
      try {
        const message = event.message;
        console.log(event);
        if (message.out || message.fromId?.userId === me.id) {
          return;
        }
        if (!message.isPrivate) {
          return;
        }
        const sender = await message.getSender();
        const userInfo = getUserInfo(sender);
        const userId = sender?.id;
        if (!userId) {
          console.log("❌ Не удалось получить ID отправителя");
          return;
        }
        console.log(`📨 Получено сообщение от: ${userInfo}`);
        if (!canReplyToUser(userId, replies)) {
          return;
        }
        await message.respond({ message: AUTO_REPLY });
        console.log(`✅ Отправлен автоответ пользователю: ${userInfo}`);
      } catch (error) {
        console.error("❌ Ошибка обработки сообщения:", error);
      }
    }, new NewMessage({}));
    console.log("🤖 Бот запущен и слушает входящие сообщения...");
    console.log(`📝 Текущий текст автоответа: "${AUTO_REPLY}"`);
    console.log("Для остановки нажмите Ctrl+C");
    process.on("SIGINT", async () => {
      console.log("\n🛑 Получен сигнал остановки...");
      try {
        await client.disconnect();
        console.log("✅ Клиент отключён");
      } catch (error) {
        console.error("❌ Ошибка при отключении:", error);
      }
      process.exit(0);
    });
    setInterval(() => {
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1e3;
      let cleanedCount = 0;
      for (const [userId, userData] of replies.entries()) {
        if (userData.lastReply < cutoffTime) {
          replies.delete(userId);
          cleanedCount++;
        }
      }
      if (cleanedCount > 0) {
        console.log(`🧹 Очищены данные ${cleanedCount} неактивных пользователей`);
      }
    }, 60 * 60 * 1e3);
  } catch (error) {
    console.error("❌ Критическая ошибка:", error);
    process.exit(1);
  }
}
main().catch((error) => {
  console.error("❌ Ошибка запуска:", error);
  process.exit(1);
});
