const TelegramBot = require('node-telegram-bot-api');
const bluebird = require('bluebird');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const _ = require('lodash');

const Models = require('./models');
const utils = require('./utils');

dotenv.config();

const TOKEN = process.env.TOKEN || 'telegram-bot-token';
const URL = process.env.APP_URL || 'telegram-bot-url';
const DB = process.env.DB || 'database-host';
const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const options = {
  webHook: {
    port: process.env.PORT || 443,
  },
};
const bot = new TelegramBot(TOKEN, options);
const googleTranslate = require('@google-cloud/translate')({
  projectId: GOOGLE_PROJECT_ID,
  key: GOOGLE_API_KEY,
});

const SUCCESS_MSG = {
  CREATE: '알겠어요!',
  DELETE: '잊었어요.',
};
const ERROR_MSG = {
  UNKNOWN: '어라..?',
  NOT_FOUND: '모르겠어요.',
};

Array.prototype.contains = utils.contains;
Array.prototype.unique = utils.unique;

global.Promise = bluebird;
mongoose.Promise = bluebird;
mongoose.connect(DB, { server: { socketOptions: { keepAlive: 1 } } });

bot.setWebHook(`${URL}/bot${TOKEN}`);


/*
* 단순 명령어
*/

bot.onText(/^안녕, 오겜봇/, (msg) => {
  bot.sendMessage(msg.chat.id, '안녕하세요!');
});

bot.onText(/^\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
    노페에 의한, 노페를 위한, 노페의 텔레그램 봇이에요.\
    \n제가 할수 있는 일이 궁금하시다면 [코드 저장소](https://github.com/kimminsik-bernard/nosfe-ogame-bot)를 방문해주세요.
  `, { parse_mode: 'Markdown' });
});

bot.onText(/^\/후방주의/, (msg) => {
  bot.sendMessage(msg.chat.id, '.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n- 후방주의 -');
});

bot.onText(/^\/주사위 (\d+)/, (msg, match) => {
  const number = match[1];
  const random = Math.floor(Math.random() * (parseInt(number, 10) - 1)) + 1;
  return bot.sendMessage(msg.chat.id, `[${random}]이 나왔어요.`);
});


/*
* 단어장
*/

bot.onText(/^\/기억 (\S+) (.+)/, (msg, match) => {
  const keyword = match[1];
  const definition = match[2];
  const document = new Models.dictionary({
    keyword, definition,
  });
  document.save()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then(() => bot.sendMessage(msg.chat.id, SUCCESS_MSG.CREATE));
});

bot.onText(/^\/알려$/, (msg) => {
  Models.dictionary.find()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      let keywords = docs.map(doc => doc.keyword);
      keywords = keywords.unique();
      const message = `저는 ${keywords.length}개의 단어를 알고있어요.`;
      return bot.sendMessage(msg.chat.id, message);
    });
});

bot.onText(/^\/알려줘$/, (msg) => {
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

bot.onText(/^\/알려 (.+)/, (msg, match) => {
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

bot.onText(/^\/잊어 (.+)/, (msg, match) => {
  const keyword = match[1];
  Models.dictionary.find({ keyword }).remove()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      if (docs.length < 1) return bot.sendMessage(msg.chat.id, ERROR_MSG.NOT_FOUND);
      return bot.sendMessage(msg.chat.id, SUCCESS_MSG.DELETE);
    });
});

bot.onText(/^\/입력 (\S+) (.+)/, (msg) => {
  bot.sendMessage(msg.chat.id, '"/입력" 대신 "/기억"이라고 해주세요.');
});


/*
* 알림
*/

const schedules = [];
Models.schedule.find().then(docs => docs.map(doc => schedules.push(doc)));

bot.onText(/^\/알림 (\d+)(초|분|시간|일)(.*)/, (msg, match) => {
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
      Models.schedule.findOneAndRemove({ schedule: doc.schedule })
        .then(() => bot.sendMessage(doc.chatId, `알림 시간이에요! ${doc.memo}`, { reply_to_message_id: doc.messageId }));
    }
    return true;
  });
}, 1000);


/*
* 구글 번역
*/

bot.onText(/^\/갓글 (.+)/, (msg, match) => {
  const sentences = match[1];
  const translateOptions = {
    from: 'ko',
    to: 'en',
    model: 'nmt',
  };
  googleTranslate.detect(sentences)
    .then((data) => {
      if (data[0].language !== 'ko') {
        translateOptions.from = data[0].language;
        translateOptions.to = 'ko';
      }
      return googleTranslate.translate(sentences, translateOptions);
    })
    .then(data => bot.sendMessage(msg.chat.id, data[0]));
});


/*
* 초성퀴즈
*/

const jqz = {};

function makeQuiz(chatId) {
  jqz[chatId].currentRound += 1;
  const category = jqz[chatId].category;
  const condition = category ? { category } : {};

  return Models.jaumQuiz.count(condition)
    .then((count) => {
      const random = Math.floor(Math.random() * count);
      return Models.jaumQuiz.findOne(condition).skip(random);
    })
    .then((doc) => {
      if (!doc) {
        return bot.sendMessage(chatId, `${jqz[chatId].category} 영역에서 알고있는 문제가 없어요!`)
          .then(() => { jqz[chatId] = null; });
      }

      jqz[chatId].quiz = doc.quiz;
      jqz[chatId].quizCategory = doc.category;
      const chosung = utils.hangulChosung(jqz[chatId].quiz);

      setTimeout(() => {
        if (jqz[chatId].quiz && doc.quiz === jqz[chatId].quiz && jqz[chatId].hintAt < Date.now()) {
          const hint = utils.makeHint(jqz[chatId].quiz);
          jqz[chatId].hintAt = Date.now() + (1000 * 30);
          bot.sendMessage(chatId, `어려운가요? 한 글자를 알려드릴게요.\n${hint}`);
        }
      }, 1000 * 60);

      setTimeout(() => {
        if (jqz[chatId].quiz && doc.quiz === jqz[chatId].quiz) {
          bot.sendMessage(chatId, `정말 어려운가봐요. 정답은 "${jqz[chatId].quiz}"였어요.\n다음 문제를 내드릴게요.`)
            .then(() => makeQuiz(chatId));
        }
      }, 1000 * 60 * 3);

      return bot.sendMessage(chatId, `[${doc.category}] ${chosung}`)
        .then(() => { jqz[chatId].listen = true; });
    });
}

bot.onText(/^\/초성퀴즈$/, (msg) => {
  Models.jaumQuiz.find()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      let quizzes = docs.map(doc => doc.quiz);
      quizzes = quizzes.unique();

      let categories = docs.map(doc => doc.category);
      categories = categories.unique();

      let categoriesDetail = categories.map(cat => `${cat}: ${utils.countIn(docs, cat, 'category')}개`);
      // categories = categories.join(', ');
      categoriesDetail = categoriesDetail.join('\n');

      const message = `저는 ${categories.length}개의 영역에서 ${quizzes.length}개의 문제를 알고있어요.\n-\n${categoriesDetail}`;
      return bot.sendMessage(msg.chat.id, message);
    });
});

bot.onText(/^\/초성퀴즈 시작 (\d+)(.*)$/, (msg, match) => {
  if (jqz[msg.chat.id]) return bot.sendMessage(msg.chat.id, '대답을 기다리고 있어요!');

  const category = match[2] ? match[2].replace(' ', '') : null;
  const categoryVerbose = category || '모든';

  jqz[msg.chat.id] = {
    round: parseInt(match[1], 10),
    currentRound: 0,
    scores: [],
    quiz: '',
    listen: false,
    category,
    hintAt: Date.now() + (1000 * 30),
  };

  return bot.sendMessage(msg.chat.id, `${categoryVerbose} 영역에서 총 ${match[1]}개의 초성퀴즈를 낼게요.`)
    .then(() => makeQuiz(msg.chat.id));
});

bot.onText(/^\/초성퀴즈 힌트$/, (msg) => {
  const distance = jqz[msg.chat.id].hintAt - Date.now();
  if (distance > 0) {
    return bot.sendMessage(msg.chat.id, `아직 힌트를 알려드리기엔 이른것 같아요. ${Math.floor(distance / 1000)}초를 더 기다려주세요.`);
  }
  const hint = utils.makeHint(jqz[msg.chat.id].quiz);
  jqz[msg.chat.id].hintAt = Date.now() + (1000 * 30);
  return bot.sendMessage(msg.chat.id, `그러면 한 글자를 알려드릴게요.\n${hint}`);
});

bot.onText(/^\/초성퀴즈 추가 (.+) @(\S+)/, (msg, match) => {
  const quiz = match[1];
  const category = match[2];
  return Models.jaumQuiz.findOneAndRemove({ quiz, category })
    .then((doc) => {
      if (doc) return bot.sendMessage(msg.chat.id, '그 문제는 이미 있는걸요?');
      const document = new Models.jaumQuiz({
        quiz, category,
      });
      return document.save()
        .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
        .then(() => bot.sendMessage(msg.chat.id, `초성퀴즈 "${quiz}"를 "${category}"영역에 추가했어요.`));
    });
});

bot.onText(/^\/초성퀴즈 삭제 (.+) @(\S+)/, (msg, match) => {
  const quiz = match[1];
  const category = match[2];
  Models.jaumQuiz.findOneAndRemove({ quiz, category })
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((doc) => {
      if (!doc) return bot.sendMessage(msg.chat.id, '그런 문제가 없는걸요?');
      return bot.sendMessage(msg.chat.id, `초성퀴즈 "${quiz}"를 "${category}"영역에서 삭제했어요.`);
    });
});

bot.onText(/^\/초성퀴즈 중단$/, (msg) => {
  if (jqz[msg.chat.id]) {
    jqz[msg.chat.id] = null;
    return bot.sendMessage(msg.chat.id, '초성퀴즈를 강제로 끝냈어요.');
  }
  return bot.sendMessage(msg.chat.id, '퀴즈를 내고 있지 않은걸요?');
});

bot.onText(/(.*)/, (msg, match) => {
  if (jqz[msg.chat.id] && jqz[msg.chat.id].listen && match[1] === jqz[msg.chat.id].quiz) {
    jqz[msg.chat.id].listen = false;

    const quizCategory = jqz[msg.chat.id].quizCategory;
    const point = 1;
    Models.jaumQuizPlayer.findOne({ userId: msg.from.id, chatId: msg.chat.id })
      .then((player) => {
        if (!player) {
          const newPlayer = new Models.jaumQuizPlayer({
            userId: msg.from.id,
            chatId: msg.chat.id,
            scores: { [quizCategory]: point },
          });
          newPlayer.save();
        } else {
          const scores = player.scores;
          if (scores[quizCategory]) scores[quizCategory] += point;
          else scores[quizCategory] = point;
          player.update({ scores }).exec();
        }
      });

    jqz[msg.chat.id].scores.push(msg.from);
    bot.sendMessage(msg.chat.id, '정답이에요!', { reply_to_message_id: msg.message_id }).then(() => {
      if (jqz[msg.chat.id].round === jqz[msg.chat.id].currentRound) {
        const obj = {};
        _.forEach(jqz[msg.chat.id].scores, (user) => {
          if (obj[user.id]) {
            obj[user.id].score += 1;
          } else {
            obj[user.id] = {
              firstName: user.first_name,
              score: 1,
            };
          }
        });

        const queries = [];
        _.forEach(obj, (val, key) => {
          const query = Models.jaumQuizPlayer.findOne({ userId: key, chatId: msg.chat.id })
            .then((player) => {
              let totalScore = 0;
              _.forEach(player.scores, (value) => { totalScore += value; });
              return {
                firstName: obj[key].firstName,
                score: obj[key].score,
                totalScore,
              };
            });
          queries.push(query);
        });

        jqz[msg.chat.id] = null;

        Promise.all(queries).then((array) => {
          array.sort((a, b) => b.score - a.score);
          let result = [];
          array.map(player => result.push(`${utils.makeTitleName(player.totalScore)}_${player.firstName}: ${player.score}점`));
          result = result.join('\n');
          bot.sendMessage(msg.chat.id, `초성퀴즈가 끝났어요!\n${result}`);
        });
      } else makeQuiz(msg.chat.id);
    });
  }
});
