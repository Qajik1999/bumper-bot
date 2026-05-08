const express = require('express');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const token = process.env.BOT_TOKEN || '8780622148:AAF5SkS8HJS_wSWhTG3455vMfM34KG7_JgE';
const bot = new TelegramBot(token, { polling: true });

console.log("BOT STARTED NEW CODE");

const ADMINS = [819433629, 1013947524];

let userStates = {};
let orders = [];
let completedOrders = [];

if (fs.existsSync('orders.json')) {
  const data = JSON.parse(fs.readFileSync('orders.json', 'utf8'));

  if (Array.isArray(data)) {
    orders = data;
    completedOrders = [];
  } else {
    orders = data.active || [];
    completedOrders = data.completed || [];
  }
}

function saveOrders() {
  fs.writeFileSync('orders.json', JSON.stringify({
    active: orders,
    completed: completedOrders
  }, null, 2));
}

function cleanOldCompletedOrders() {
  const limit = new Date();
  limit.setMonth(limit.getMonth() - 12);

  completedOrders = completedOrders.filter(order => {
    if (!order.completedAt) return true;
    return new Date(order.completedAt) >= limit;
  });
}

function mainMenu(chatId, text = "📋 Գլխավոր մենյու") {
  return bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [
        ["➕ Ավելացնել պատվեր"],
        ["📋 Պատվերներ"],
        ["✅ Ավարտված պատվերներ"],
        ["💰 Այս ամսվա եկամուտ"],
        ["⏰ Մոտ deadline-ներ"]
      ],
      resize_keyboard: true
    }
  });
}

bot.onText(/\/start/, (msg) => {
  mainMenu(msg.chat.id, "Ընտրիր 👇");
});

bot.onText(/\/cancel/, (msg) => {
  delete userStates[msg.chat.id];
  mainMenu(msg.chat.id, "Չեղարկվեց ✅");
});

bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `Քո ID-ն է՝ ${msg.from.id}`);
});
bot.onText(/\/backup/, (msg) => {
  if (!ADMINS.includes(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, "❌ Դու իրավունք չունես");
  }

  createBackup();

  bot.sendMessage(msg.chat.id, "✅ Backup ուղարկվեց");
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text) return;

  if (!ADMINS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Դու իրավունք չունես");
  }

  if (text.startsWith('/')) return;

  const state = userStates[chatId];

  // եթե վերջնական գումար ենք սպասում
  if (state && state.step === "final_price") {
    const order = orders[state.orderIndex];

    if (!order) {
      delete userStates[chatId];
      return bot.sendMessage(chatId, "❌ Պատվերը չգտնվեց");
    }

    order.price = Number(text);

    const doneOrder = orders.splice(state.orderIndex, 1)[0];

    doneOrder.completedAt = new Date().toISOString();
    doneOrder.completedMonth = new Date().toISOString().slice(0, 7);

    userStates[chatId] = {
      step: "qajik_share",
      doneOrder
    };

    return bot.sendMessage(chatId, "💵 Գրեք Qajik-ի բաժինը");
  }

  // եթե Qajik-ի բաժինն ենք սպասում
  if (state && state.step === "qajik_share") {
    const qajikShare = Number(text);
    const doneOrder = state.doneOrder;

    doneOrder.qajikShare = qajikShare;
    doneOrder.levonShare = Number(doneOrder.price) - qajikShare;

    completedOrders.push(doneOrder);

    cleanOldCompletedOrders();
    saveOrders();

    delete userStates[chatId];

    return bot.sendMessage(chatId,
      `✅ Ավարտվեց\n🚗 ${doneOrder.brand} (${doneOrder.plate})\n` +
      `💰 Ընդհանուր՝ ${doneOrder.price} դրամ\n` +
      `👤 Qajik՝ ${doneOrder.qajikShare} դրամ\n` +
      `👤 Levon՝ ${doneOrder.levonShare} դրամ`
    );
  }

  if (text === "➕ Ավելացնել պատվեր") {
    userStates[chatId] = { step: "brand" };
    return bot.sendMessage(chatId, "Գրի մեքենայի մակնիշը 🚗");
  }

  if (text === "📋 Պատվերներ") {
    if (orders.length === 0) {
      return bot.sendMessage(chatId, "Պատվեր չկա");
    }

    orders.forEach((o, i) => {
      bot.sendMessage(chatId,
        `🚗 ${o.brand} (${o.plate})\n📞 ${o.phone || "չկա"}\n💰 ${o.price ? o.price + " դրամ" : "վերջում"}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Պատրաստ ա", callback_data: `done_${i}` }]
            ]
          }
        }
      );
    });

    return;
  }

  if (text === "✅ Ավարտված պատվերներ") {
    if (completedOrders.length === 0) {
      return bot.sendMessage(chatId, "Ավարտված պատվեր չկա");
    }

    completedOrders.forEach((o, i) => {
      const date = o.completedAt ? new Date(o.completedAt).toLocaleString() : "չկա";

      bot.sendMessage(chatId,
        `✅ Ավարտված\n\n🚗 ${o.brand} (${o.plate})\n` +
        `📞 ${o.phone || "չկա"}\n` +
        `💰 ${o.price || 0} դրամ\n` +
        `👤 Qajik՝ ${o.qajikShare || 0} դրամ\n` +
        `👤 Levon՝ ${o.levonShare || 0} դրամ\n` +
        `📅 ${date}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🗑 Ջնջել պատմությունից", callback_data: `delete_completed_${i}` }]
            ]
          }
        }
      );
    });

    return;
  }

  if (text === "💰 Այս ամսվա եկամուտ") {
    cleanOldCompletedOrders();
    saveOrders();

    const currentMonth = new Date().toISOString().slice(0, 7);

    const monthOrders = completedOrders.filter(o => {
      const orderMonth = o.completedMonth || (o.completedAt ? o.completedAt.slice(0, 7) : "");
      return orderMonth === currentMonth;
    });

    const total = monthOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
    const qajikTotal = monthOrders.reduce((sum, o) => sum + (Number(o.qajikShare) || 0), 0);
    const levonTotal = monthOrders.reduce((sum, o) => sum + (Number(o.levonShare) || 0), 0);

    return bot.sendMessage(chatId,
      `💰 Այս ամսվա եկամուտ\n\n` +
      `📦 Ավարտված պատվերներ՝ ${monthOrders.length}\n` +
      `💵 Ընդհանուր՝ ${total} դրամ\n\n` +
      `👤 Qajik՝ ${qajikTotal} դրամ\n` +
      `👤 Levon՝ ${levonTotal} դրամ`
    );
  }

  if (text === "⏰ Մոտ deadline-ներ") {
    if (orders.length === 0) {
      return bot.sendMessage(chatId, "Պատվեր չկա");
    }

    const now = new Date();
    let result = "⏰ Deadline-ներ\n\n";

    orders.forEach(o => {
      const finish = new Date(o.finishDate);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const finishDay = new Date(finish.getFullYear(), finish.getMonth(), finish.getDate());
      const diffDays = Math.round((finishDay - today) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        result += `🔴 Ուշացել է\n🚗 ${o.brand} (${o.plate})\n\n`;
      } else if (diffDays === 0) {
        result += `🟠 Այսօր deadline\n🚗 ${o.brand} (${o.plate})\n\n`;
      } else if (diffDays === 1) {
        result += `🟡 Վաղը deadline\n🚗 ${o.brand} (${o.plate})\n\n`;
      } else {
        result += `🟢 ${diffDays} օր մնացել է\n🚗 ${o.brand} (${o.plate})\n\n`;
      }
    });

    return bot.sendMessage(chatId, result);
  }

  if (!state) return;

  if (state.step === "brand") {
    state.brand = text;
    state.step = "plate";
    return bot.sendMessage(chatId, "Գրի պետհամարանիշը 🔢");
  }

  if (state.step === "plate") {
    state.plate = text;
    state.step = "phone";
    return bot.sendMessage(chatId, "Գրի հաճախորդի հեռախոսահամարը 📞");
  }

  if (state.step === "phone") {
    state.phone = text;
    state.step = "days";
    return bot.sendMessage(chatId, "Քանի օրում պատրաստ 📅");
  }

  if (state.step === "days") {
    state.days = parseInt(text);
    state.step = "price_choice";

    return bot.sendMessage(chatId, "💰 Գումարը հիմա՞ գիտեք", {
      reply_markup: {
        keyboard: [
          ["💰 Հիմա գրել"],
          ["⏳ Վերջում գրել"]
        ],
        resize_keyboard: true
      }
    });
  }

  if (state.step === "price_choice") {
    if (text === "💰 Հիմա գրել") {
      state.step = "price";
      return bot.sendMessage(chatId, "💵 Գրեք գումարը");
    }

    if (text === "⏳ Վերջում գրել") {
      state.price = null;
      state.step = "worker";

      return bot.sendMessage(chatId, "👨‍🔧 Ով է աշխատում", {
        reply_markup: {
          keyboard: [
            ["Qajik"],
            ["Levon"]
          ],
          resize_keyboard: true
        }
      });
    }

    return bot.sendMessage(chatId, "Ընտրիր կոճակով 👇");
  }

  if (state.step === "price") {
    state.price = Number(text);
    state.step = "worker";

    return bot.sendMessage(chatId, "👨‍🔧 Ով է աշխատում", {
      reply_markup: {
        keyboard: [
          ["Qajik"],
          ["Levon"]
        ],
        resize_keyboard: true
      }
    });
  }

  if (state.step === "worker") {
    if (text !== "Qajik" && text !== "Levon") {
      return bot.sendMessage(chatId, "Ընտրիր միայն կոճակով 👇");
    }

    state.worker = text;

    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + state.days);

    state.finishDate = finishDate.toISOString();

    orders.push(state);
    saveOrders();

    delete userStates[chatId];

    bot.sendMessage(chatId,
      `✅ Պատվերը գրանցվեց\n🚗 ${state.brand}\n🔢 ${state.plate}\n📞 ${state.phone}`
    );

    return mainMenu(chatId);
  }
});

bot.on('callback_query', (query) => {
  const data = query.data;
  const msg = query.message;
  const chatId = msg.chat.id;

  if (data.startsWith("done_")) {
    const index = parseInt(data.split("_")[1]);
    const doneOrder = orders[index];

    if (!doneOrder) {
      return bot.answerCallbackQuery(query.id, { text: "Պատվերը չգտնվեց" });
    }

    if (!doneOrder.price) {
      userStates[chatId] = {
        step: "final_price",
        orderIndex: index
      };

      bot.sendMessage(chatId, "💰 Գրեք վերջնական գումարը");

      return bot.answerCallbackQuery(query.id, {
        text: "Սպասում եմ գումարին 💰"
      });
    }

    orders.splice(index, 1);

    doneOrder.completedAt = new Date().toISOString();
    doneOrder.completedMonth = new Date().toISOString().slice(0, 7);
    doneOrder.price = Number(doneOrder.price) || 0;

    userStates[chatId] = {
      step: "qajik_share",
      doneOrder
    };

    bot.sendMessage(chatId, "💵 Գրեք Qajik-ի բաժինը");

    return bot.answerCallbackQuery(query.id, {
      text: "Գրեք Qajik-ի բաժինը"
    });
  }

  if (data.startsWith("delete_completed_")) {
    const index = parseInt(data.replace("delete_completed_", ""));
    const deletedOrder = completedOrders.splice(index, 1)[0];

    if (!deletedOrder) {
      return bot.answerCallbackQuery(query.id, { text: "Չգտնվեց" });
    }

    saveOrders();

    bot.sendMessage(chatId,
      `🗑 Ջնջվեց պատմությունից\n🚗 ${deletedOrder.brand} (${deletedOrder.plate})`
    );

    return bot.answerCallbackQuery(query.id, {
      text: "Ջնջվեց ✅"
    });
  }
});

function checkDeadlines() {
  const now = new Date();

  orders.forEach(order => {
    const finish = new Date(order.finishDate);

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const finishDay = new Date(finish.getFullYear(), finish.getMonth(), finish.getDate());

    const diffDays = Math.round((finishDay - today) / (1000 * 60 * 60 * 24));

    let message = null;

    if (diffDays < 0) {
      message = `🔴 Ուշացած պատվեր\n🚗 ${order.brand} (${order.plate})\n📞 ${order.phone || "չկա"}`;
    } else if (diffDays === 0) {
      message = `🟠 Այսօր վերջին օրն է\n🚗 ${order.brand} (${order.plate})\n📞 ${order.phone || "չկա"}`;
    } else if (diffDays === 1) {
      message = `🟡 Վաղը վերջին օրն է\n🚗 ${order.brand} (${order.plate})\n📞 ${order.phone || "չկա"}`;
    }

    if (!message) return;

    ADMINS.forEach(adminId => {
      bot.sendMessage(adminId, message);
    });
  });
}

setInterval(checkDeadlines, 6 * 60 * 60 * 1000);
checkDeadlines();
function createBackup() {
  const date = new Date().toISOString().slice(0, 10);

  const backupData = {
    active: orders,
    completed: completedOrders
  };

  const fileName = `backup-${date}.json`;
  const filePath = path.join(__dirname, fileName);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

  ADMINS.forEach(adminId => {
    bot.sendDocument(adminId, filePath, {
      caption: `📦 Backup ${date}`
    });
  });

  console.log(`Backup created and sent: ${fileName}`);
}

bot.on('polling_error', (error) => {
  console.log("POLLING ERROR:", error.message);
});
schedule.scheduleJob('0 3 * * *', () => {
  createBackup();
});