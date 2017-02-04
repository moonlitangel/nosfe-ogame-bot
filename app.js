const TelegramBot = require('node-telegram-bot-api');
const bluebird = require('bluebird');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const Models = require('./models');

dotenv.config();

const TOKEN = process.env.TOKEN || 'telegram-bot-token';
const URL = process.env.APP_URL || 'https://nosfe-ogame-bot.herokuapp.com:443';
const DB = process.env.DB || 'database-host';
const options = {
  webHook: {
    port: process.env.PORT || 443,
  },
};
const SUCCESS_MSG = {
  CREATE: '알겠어요!',
  DELETE: '잊었어요.',
};
const ERROR_MSG = {
  UNKNOWN: '어라..?',
  NOT_FOUND: '모르겠어요.',
};

Array.prototype.contains = function conatins(v) {
  for (let i = 0; i < this.length; i++) {
    if (this[i] === v) return true;
  }
  return false;
};

Array.prototype.unique = function unique() {
  const arr = [];
  for (let i = 0; i < this.length; i++) {
    if (!arr.contains(this[i])) {
      arr.push(this[i]);
    }
  }
  return arr;
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
    keyword, definition,
  });
  document.save()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then(() => bot.sendMessage(msg.chat.id, SUCCESS_MSG.CREATE));
});

bot.onText(/\/알려$/, (msg, match) => {
  Models.dictionary.find()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      let keywords = docs.map(doc => doc.keyword);
      keywords = keywords.unique();
      const message = `저는 ${keywords.length}개의 단어를 알고있어요.`;
      return bot.sendMessage(msg.chat.id, message);
    });
});

bot.onText(/\/알려줘$/, (msg, match) => {
  Models.dictionary.find()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      let keywords = docs.map(doc => doc.keyword);
      keywords = keywords.unique();
      keywords = keywords.join(', ');
      const message = `저는 이런 단어들을 알고있어요.\n${keywords}`;
      return bot.sendMessage(msg.chat.id, message);
    });
});

bot.onText(/\/알려 (.+)/, (msg, match) => {
  const keyword = match[1];
  Models.dictionary.find({ keyword })
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      if (docs.length < 1) return bot.sendMessage(msg.chat.id, ERROR_MSG.NOT_FOUND);
      let definitions = docs.map(doc => doc.definition);
      definitions = definitions.join(', ');
      return bot.sendMessage(msg.chat.id, definitions);
    });
});

bot.onText(/\/잊어 (.+)/, (msg, match) => {
  const keyword = match[1];
  Models.dictionary.find({ keyword }).remove()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      if (docs.length < 1) return bot.sendMessage(msg.chat.id, ERROR_MSG.NOT_FOUND);
      return bot.sendMessage(msg.chat.id, SUCCESS_MSG.DELETE);
    });
});

const schedules = [];
Models.schedule.find().then(docs => docs.map(doc => schedules.push(doc)));

bot.onText(/\/알림 (\d+)(초|분|시간|일)(.*)/, (msg, match) => {
  const num = match[1];
  const unit = match[2];
  const memo = match[3] || '';

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
      break;
    default:
      break;
  }

  const offset = parseInt(num, 10) * toMil;
  const schedule = Date.now() + offset;

  const document = new Models.schedule({
    schedule,
    memo,
    messageId: msg.message_id,
    chatId: msg.chat.id,
    userId: msg.from.id,
  });
  document.save()
    .catch(err => bot.sendMessage(msg.chat.id, ERROR_MSG))
    .then((doc) => {
      schedules.push(doc);
      return bot.sendMessage(msg.chat.id, `${SUCCESS_MSG.CREATE} ${num}${unit}뒤에 알려드릴게요.`);
    });
});

setInterval(() => {
  const now = Date.now();
  schedules.map((doc) => {
    if (doc.schedule < now) {
      const index = schedules.map(_doc => _doc.messageId).indexOf(doc.messageId);
      schedules.splice(index, 1);
      bot.sendMessage(doc.chatId, `알림 시간이에요! ${doc.memo}`, { reply_to_message_id: doc.messageId });
      Models.schedule.findOneAndRemove({ schedule: doc.schedule }).exec();
    }
    return true;
  });
}, 1000);

function hangulChosung(str) {
  const cho = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if (code > -1 && code < 11172) result += cho[Math.floor(code / 588)];
    else result += str[i];
  }
  return result;
}

const jqz = {};

function makeQuiz(chatId) {
  jqz[chatId].currentRound += 1;
  let query = Models.jaumQuiz.find();
  if (jqz[chatId].category) {
    query = Models.jaumQuiz.find({ category: jqz[chatId].category });
  }
  return query
    .then((docs) => {
      if (docs.length < 1) {
        return bot.sendMessage(chatId, `${jqz[chatId].category} 영역에서 알고있는 문제가 없어요!`)
          .then(() => { jqz[chatId] = null; });
      }
      const index = Math.floor((Math.random() * docs.length));
      jqz[chatId].quiz = docs[index].quiz;
      const due = (1000 * 60 * 3);
      setTimeout(() => {
        if (docs[index].quiz === jqz[chatId].quiz) {
          bot.sendMessage(chatId, `어려운가요? 정답은 "${jqz[chatId].quiz}"였어요.\n다음 문제를 내드릴게요.`)
            .then(() => makeQuiz(chatId));
        }
      }, 3000);
      jqz[chatId].expireAt = Date.now() + due;
      const chosung = hangulChosung(jqz[chatId].quiz);
      return bot.sendMessage(chatId, `[${docs[index].category}] ${chosung}`)
        .then(() => {
          jqz[chatId].listen = true;
        });
    });
}

bot.onText(/\/초성퀴즈$/, (msg, match) => {
  Models.jaumQuiz.find()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      let quizes = docs.map(doc => doc.quiz);
      quizes = quizes.unique();
      let categories = docs.map(doc => doc.category);
      categories = categories.unique();
      categories = categories.join(', ');
      const message = `저는 ${quizes.length}개의 문제를 알고있어요.\n문제들의 영역은 ${categories}이에요.`;
      return bot.sendMessage(msg.chat.id, message);
    });
});

bot.onText(/\/초성퀴즈 시작 (\d+)(.*)$/, (msg, match) => {
  if (jqz[msg.chat.id]) return bot.sendMessage(msg.chat.id, '대답을 기다리고 있어요!');
  const category = match[2] ? match[2].replace(' ', '') : null;
  jqz[msg.chat.id] = {
    round: parseInt(match[1], 10),
    currentRound: 0,
    scores: [],
    quiz: '',
    listen: false,
    category,
  };
  return makeQuiz(msg.chat.id);
});

bot.onText(/(.*)/, (msg, match) => {
  if (jqz[msg.chat.id] && jqz[msg.chat.id].listen && match[1] === jqz[msg.chat.id].quiz) {
    jqz[msg.chat.id].listen = false;
    jqz[msg.chat.id].scores.push(msg.from);
    bot.sendMessage(msg.chat.id, '정답이에요!', { reply_to_message_id: msg.message_id })
      .then(() => {
        if (jqz[msg.chat.id].round === jqz[msg.chat.id].currentRound) {
          const count = {};
          for (let i = 0; i < jqz[msg.chat.id].scores.length; i++) {
            const name = jqz[msg.chat.id].scores[i].first_name;
            count[name] = count[name] ? count[name] + 1 : 1;
          }

          const counts = Object.keys(count).map(key => ({ firstName: key, count: count[key] }));
          counts.sort((a, b) => b.count - a.count);

          let result = [];
          counts.map(scorer => result.push(`${scorer.firstName} : ${scorer.count}점`));
          result = result.join('\n');

          bot.sendMessage(msg.chat.id, `초성퀴즈가 끝났어요!\n${result}`);
          jqz[msg.chat.id] = null;
        } else makeQuiz(msg.chat.id);
      });
  }
});

bot.onText(/\/초성퀴즈 추가 (.+) @(\S+)/, (msg, match) => {
  const quiz = match[1];
  const category = match[2];
  return Models.jaumQuiz.findOneAndRemove({ quiz, category })
    .then((doc) => {
      if (doc) return bot.sendMessage(msg.chat.id, '이미 있는걸요?');
      const document = new Models.jaumQuiz({
        quiz, category,
      });
      return document.save()
        .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
        .then(() => bot.sendMessage(msg.chat.id, `초성퀴즈 "${quiz}"를 "${category}"영역에 추가했어요.`));
    });
});

bot.onText(/\/초성퀴즈 삭제 (.+) @(\S+)/, (msg, match) => {
  const quiz = match[1];
  const category = match[2];
  Models.jaumQuiz.findOneAndRemove({ quiz, category })
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then(() => bot.sendMessage(msg.chat.id, `초성퀴즈 "${quiz}"를 "${category}"영역에서 삭제했어요.`));
});

bot.onText(/\/초성퀴즈 중지$/, (msg, match) => {
  if (jqz[msg.chat.id]) {
    jqz[msg.chat.id] = null;
    bot.sendMessage(msg.chat.id, '초성퀴즈를 강제로 끝냈어요.');
  }
});
