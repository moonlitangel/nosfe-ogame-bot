const TelegramBot = require('node-telegram-bot-api');
const bluebird = require('bluebird');
const mongoose = require('mongoose');

const Models = require('./models');

dotenv.config();

const TOKEN = process.env.TOKEN || 'telegram-bot-token';
const URL = process.env.APP_URL || 'https://nosfe-ogame-bot.herokuapp.com:443';
const DB = process.env.DB || 'database-host'
const options = {
  webHook: {
    port: process.env.PORT || 443,
  }
};
const SUCCESS_MSG = {
  CREATE: '알겠어요!',
  DELETE: '잊었어요.',
};
const ERROR_MSG = {
  UNKNOWN: '어라..?',
  NOT_FOUND: '모르겠어요.',
};

mongoose.Promise = bluebird;
mongoose.connect(DB, { server: { socketOptions: { keepAlive: 1 } } });

const bot = new TelegramBot(TOKEN, options);

bot.setWebHook(`${URL}/bot${TOKEN}`);

bot.onText(/안녕, 오겜봇/, (msg) => {
  bot.sendMessage(msg.chat.id, '안녕하세요!');
});

bot.onText(/\/후방주의/, (msg) => {
  bot.sendMessage(msg.chat.id, '.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n- 후방주의 -');
});

bot.onText(/\/입력 (\S+) (.+)/, (msg, match) => {
  bot.sendMessage(msg.chat.id, '"/입력" 대신 "/기억"이라고 해주세요.');
});

bot.onText(/\/기억 (\S+) (.+)/, (msg, match) => {
  const keyword = match[1];
  const definition = match[2];
  const document = new Models.dictionary({
    keyword, definition
  });
  document.save()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then(() => bot.sendMessage(msg.chat.id, SUCCESS_MSG.CREATE));
});

bot.onText(/\/알려 (.+)/, (msg, match) => {
  const keyword = match[1];
  Models.dictionary.findOne({ keyword })
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then(doc => {
      if (!doc) return bot.sendMessage(msg.chat.id, ERROR_MSG.NOT_FOUND);
      return bot.sendMessage(msg.chat.id, doc.definition);
    });
});

bot.onText(/\/잊어 (.+)/, (msg, match) => {
  const keyword = match[1];
  Models.dictionary.findOneAndRemove({ keyword })
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((doc) => {
      if (!doc) return bot.sendMessage(msg.chat.id, ERROR_MSG.NOT_FOUND);
      return bot.sendMessage(msg.chat.id, SUCCESS_MSG.DELETE);
    });
});

bot.onText(/\/알림 (\d+)(\S+) (.+)/, (msg, match) => {
  const num = match[1];
  const unit = match[2];
  const memo = match[3];

  let toMil = 1000;
  switch (unit) {
    case '초':
      toMil = 1000;
      break;
    case '분':
      toMil = 1000 * 60;
      break;
    case '시간':
      toMil = 1000 * 60 * 60;
      break;
    case '일':
      toMil = 1000 * 60 * 60 * 24;
  }

  const offset = parseInt(num, 10) * toMil;
  const schedule = Date.now() + offset;

  const document = new Models.schedule({
    schedule: schedule,
    memo: memo,
    messageId: msg.message_id,
    chatId: msg.chat.id,
    userId: msg.from.id,
  });
  document.save()
    .catch(err => bot.sendMessage(msg.chat.id, ERROR_MSG))
    .then(() => bot.sendMessage(msg.chat.id, SUCCESS_MSG.CREATE));
});

setInterval(() => {
  const now = Date.now();
  Models.schedule.findOneAndRemove({ schedule: { $lt: now } })
    .then(doc => bot.sendMessage(doc.chatId, `알림 시간이에요! "${doc.memo}"`, { reply_to_message_id: doc.messageId }));
}, 1000);
