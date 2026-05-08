const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
let userState = {};
const TelegramBot = require ('node-telegram-bot-api');
const schedule = require('node-schedule');

const token = '8780622148:AAFQ8jZVDY4RvNh6iBZqvfJeKkL8oGl5Zbg'; // ստացածդ BotFather-ից
const bot = new TelegramBot(token, { polling: true });
console.log("BOT STARTED NEW CODE");

bot.onText(/\/cancel/, (msg) => {
  delete userState[msg.chat.id];

  bot.sendMessage(msg.chat.id, "Չեղարկվեց ✅", {
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
});
// 👇 ՔՈ ու ԸՆԿԵՐՈՋ ID-ները
const ADMINS = [819433629 , 1013947524];

const fs = require('fs');

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
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Ընտրիր 👇", {
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
});

// նոր պատվեր
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

if (!ADMINS.includes(userId)) {
  return bot.sendMessage(chatId, "❌ Դու իրավունք չունես");
}
  const text = msg.text;
  if (text === "⏰ Մոտ deadline-ներ") {

  if (orders.length === 0) {
    return bot.sendMessage(chatId, "Պատվեր չկա");
  }

  const now = new Date();

  let result = "⏰ Deadline-ներ\n\n";

  orders.forEach(o => {

    const finish = new Date(o.finishDate);

    const diffTime = finish - now;

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      result += `🔴 Ուշացել է\n🚗 ${o.brand} (${o.plate})\n\n`;
    }
    else if (diffDays === 0) {
      result += `🟠 Այսօր deadline\n🚗 ${o.brand} (${o.plate})\n\n`;
    }
    else if (diffDays === 1) {
      result += `🟡 Վաղը deadline\n🚗 ${o.brand} (${o.plate})\n\n`;
    }
    else {
      result += `🟢 ${diffDays} օր մնացել է\n🚗 ${o.brand} (${o.plate})\n\n`;
    }

  });

  return bot.sendMessage(chatId, result);
}

 if (text === "💰 Այս ամսվա եկամուտ") {
  cleanOldCompletedOrders();
  saveOrders();

  const currentMonth = new Date().toISOString().slice(0, 7);

  const monthOrders = completedOrders.filter(o => {
    const orderMonth = o.completedMonth || (o.completedAt ? o.completedAt.slice(0, 7) : "");
    return orderMonth === currentMonth;
  });

  const total = monthOrders.reduce((sum, o) => {
    return sum + (Number(o.price) || 0);
  }, 0);

  return bot.sendMessage(chatId,
    `💰 Այս ամսվա եկամուտ\n\n` +
    `📦 Ավարտված պատվերներ՝ ${monthOrders.length}\n` +
    `💵 Գումար՝ ${total} դրամ`
  );
}
  if (text === "✅ Ավարտված պատվերներ") {
  if (completedOrders.length === 0) {
    return bot.sendMessage(chatId, "Ավարտված պատվեր չկա");
  }

  let t = "✅ Ավարտված պատվերներ\n\n";

  completedOrders.forEach((o, i) => {
    const date = new Date(o.completedAt).toLocaleString();

    t += `${i+1}. 🚗 ${o.brand} (${o.plate})\n`;
    t += `📅 Ավարտվել է՝ ${date}\n\n`;
  });

  return bot.sendMessage(chatId, t);
}

  if (text === "➕ Ավելացնել պատվեր") {
    userState[chatId] = { step: "brand" };
    return bot.sendMessage(chatId, "Գրի մեքենայի մակնիշը 🚗");
  }

  if (text === "📋 Պատվերներ") {
  if (orders.length === 0) {
    return bot.sendMessage(chatId, "Պատվեր չկա");
  }

  orders.forEach((o, i) => {
    bot.sendMessage(chatId,
      `🚗 ${o.brand} (${o.plate})\n📞 ${o.phone || "չկա"}`,
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
  // steps
  if (!userState[chatId]) return;

  let state = userState[chatId];

  if (state.step === "brand") {
    state.brand = text;
    state.step = "plate";
    return bot.sendMessage(chatId, "Գրի պետհամարանիշը 🔢");
  }

  if (state.step === "plate") {
    state.plate = text;
    state.step = "price";
    return bot.sendMessage(chatId, "Գումարը 💰");
  }

 if (state.step === "price") {
  state.price = text;
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

    state.step = "worker";

    return bot.sendMessage(chatId, "Ընտրիր աշխատող 👇", {
      reply_markup: {
        keyboard: [["Qajik", "Levon"]],
        resize_keyboard: true
      }
    });
  }

 if (state.step === "worker") {

  state.worker = text;

  let targetId;

  if (text === "Qajik") {
    targetId = ADMINS[0];
  } else if (text === "Levon") {
    targetId = ADMINS[0]; // հետո կփոխենք ընկերոջ ID-ով
  } else {
    return bot.sendMessage(chatId, "Ընտրիր միայն կոճակով 👇");
  }

  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + state.days);

  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + (state.days - 1));

  state.finishDate = finishDate;

  orders.push(state);

  saveOrders();

  bot.sendMessage(chatId,
    `✅ Պատվերը գրանցվեց\n🚗 ${state.brand}\n🔢 ${state.plate}\n📞 ${state.phone}`
  );

  // schedule.scheduleJob(reminderDate, () => {
  //   bot.sendMessage(targetId,
  //     `⚠️ Վաղը վերջնաժամկետ\n🚗 ${state.brand}`
  //   );
  // });

  // schedule.scheduleJob(finishDate, () => {
  //   bot.sendMessage(targetId,
  //     `📅 Այսօր վերջնաժամկետ\n🚗 ${state.brand}`
  //   );
  // });

  delete userState[chatId];

  return bot.sendMessage(chatId, "📋 Գլխավոր մենյու", {
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
});

// պատվերների ցուցակ
bot.onText(/\/orders/, (msg) => {
  const chatId = msg.chat.id;

  if (orders.length === 0) {
    return bot.sendMessage(chatId, "Պատվեր չկա");
  }

  orders.forEach((o, i) => {
    bot.sendMessage(chatId,
      `🚗 ${o.brand} (${o.plate})`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Պատրաստ ա", callback_data: `done_${i}` }]
          ]
        }
      }
    );
  });
});
bot.on('callback_query', (query) => {
  const data = query.data;
  const msg = query.message;

  if (data.startsWith("done_")) {
    const index = parseInt(data.split("_")[1]);

    const order = orders[index];

    if (!order) return;

    const doneOrder = orders.splice(index, 1)[0];

doneOrder.completedAt = new Date();

doneOrder.completedAt = new Date().toISOString();
doneOrder.completedMonth = new Date().toISOString().slice(0, 7); // օրինակ 2026-05
doneOrder.price = Number(doneOrder.price) || 0;

completedOrders.push(doneOrder);
function cleanOldCompletedOrders() {
  const now = new Date();
  const limit = new Date();
  limit.setMonth(now.getMonth() - 12);

  completedOrders = completedOrders.filter(order => {
    if (!order.completedAt) return true;
    return new Date(order.completedAt) >= limit;
  });
}

saveOrders();

    saveOrders();

    bot.sendMessage(msg.chat.id,
  `✅ Ավարտվեց վաղ\n🚗 ${order.brand} (${order.plate})`
);
  }
});

function saveOrders() {
  fs.writeFileSync('orders.json', JSON.stringify({
    active: orders,
    completed: completedOrders
  }, null, 2));
}
function cleanOldCompletedOrders() {
  const now = new Date();
  const limit = new Date();
  limit.setMonth(now.getMonth() - 12);

  completedOrders = completedOrders.filter(order => {
    if (!order.completedAt) return true;
    return new Date(order.completedAt) >= limit;
  });
}
bot.on('polling_error', (error) => {
  console.log("POLLING ERROR:", error.message);
  console.log(error);
});