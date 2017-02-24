const TelegramBot = require('node-telegram-bot-api');  // 텔레그램 봇 API 구현체
const bluebird = require('bluebird');  // Promise 구현체
const mongoose = require('mongoose');  // 몽고DB 오브젝트 모델링
const dotenv = require('dotenv');  // 환경변수 설정
const _ = require('lodash');  // 자바스크립트 유틸리티

const express = require('express');  // http서버
const compression = require('compression');  // gzip 압축 미들웨어
const cors = require('cors');  // cors 미들웨어
const helmet = require('helmet');  // http header 공격 방어 미들웨어
const bodyParser = require('body-parser');  // http 리퀘스트 미들웨어
const randomstring = require('randomstring');

const Models = require('./models');  // mongoose 모델
const utils = require('./utils');  // 커스텀 유틸리티 함수


/*
* 환경설정
*/

dotenv.config();  // 환경변수 로드

const TOKEN = process.env.TOKEN || 'telegram-bot-token';  // 텔레그램 봇 토큰
const URL = process.env.APP_URL || 'telegram-bot-url';  // 봇 호스트
const DB = process.env.DB || 'database-host';  // 디비 호스트
const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID;  // 구글 API 프로젝트 아이디
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;  // 구글 API 키

// 봇 생성
const bot = new TelegramBot(TOKEN);
bot.setWebHook(`${URL}/bot${TOKEN}`);

// 서버 생성
const app = express();

app.use(compression());
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 웹훅 설정
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 메시지 api
app.post('/messages/:chatId', (req, res) => {
  const chatId = parseInt(req.params.chatId, 10);
  Models.chatToken.findOne({ chatId })
    .then((chatToken) => {
      if (!chatToken || chatToken.token !== req.body.token) return res.send(401, 'Invalid token');
      if (!chatToken.listening) return res.send(403, 'Message blocked');
      return bot.sendMessage(chatId, req.body.message)
        .then(() => res.send('Message on a way!'));
    });
});

// express 서버 시작
app.listen(process.env.PORT);

// 구글 번역 api
const googleTranslate = require('@google-cloud/translate')({
  projectId: GOOGLE_PROJECT_ID,
  key: GOOGLE_API_KEY,
});

// mongoose 설정 및 DB 접속
global.Promise = bluebird;
mongoose.Promise = bluebird;
mongoose.connect(DB, { server: { socketOptions: { keepAlive: 1 } } });

const SUCCESS_MSG = {
  CREATE: '알겠어요!',
  DELETE: '잊었어요.',
};
const ERROR_MSG = {
  UNKNOWN: '어라..?',
  NOT_FOUND: '모르겠어요.',
};

// array에 커스텀 메소드 할당
Array.prototype.contains = utils.contains;
Array.prototype.unique = utils.unique;


/*
* 단순 명령어
*/

bot.onText(/^안녕, 오겜봇$/, (msg) => {
  bot.sendMessage(msg.chat.id, '안녕하세요!');
});

bot.onText(/^\/help$/, (msg) => {
  bot.sendMessage(msg.chat.id, `
    노페에 의한, 노페를 위한, 노페의 텔레그램 봇이에요.\
    \n제가 할수 있는 일이 궁금하시다면 [코드 저장소](https://github.com/kimminsik-bernard/nosfe-ogame-bot)를 방문해주세요.
  `, { parse_mode: 'Markdown' });
});

bot.onText(/^\/정보$/, (msg) => {
  bot.sendMessage(msg.chat.id, `이 채팅방의 ID는 ${msg.chat.id}이고, \n${msg.from.first_name}님의 ID는 ${msg.from.id}이에요.`);
});

bot.onText(/^\/후방주의$/, (msg) => {
  bot.sendMessage(msg.chat.id, '.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n- 후방주의 -');
});

bot.onText(/^\/주사위 (\d+)$/, (msg, match) => {
  const number = match[1];
  const random = Math.floor(Math.random() * (parseInt(number, 10) - 1)) + 1;
  return bot.sendMessage(msg.chat.id, `[${random}]이 나왔어요.`);
});


/*
* 챗방
*/

bot.onText(/^\/토큰 발급$/, (msg, match) => {
  const chatId = msg.chat.id;
  const token = randomstring.generate(7);
  Models.chatToken.findOne({ chatId })
    .then((chatToken) => {
      if (!chatToken) {
        const newToken = new Models.chatToken({ chatId, token });
        return newToken.save();
      }
      return chatToken.update({ chatId, token }).exec();
    })
    .then(() => bot.sendMessage(msg.chat.id, `새로 발급한 이 채팅방의 토큰은 "${token}"이에요.`));
});

bot.onText(/^\/토큰$/, (msg, match) => {
  const chatId = msg.chat.id;
  Models.chatToken.findOne({ chatId })
    .then((chatToken) => {
      if (!chatToken) {
        return bot.sendMessage(msg.chat.id, '토큰이 없는걸요?');
      }
      return bot.sendMessage(msg.chat.id, `이 채팅방의 토큰은 "${chatToken.token}"이에요.`);
    });
});

bot.onText(/^\/메시지 (\S+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const flag = match[1];

  let listening;
  if (flag === '끄기') listening = false;
  else if (flag === '켜기') listening = true;
  else return bot.sendMessage(msg.chat.id, '메시지 알림을 \'메시지 켜기\'로 키거나 \'메시지 끄기\'로 끌 수 있어요.');

  return Models.chatToken.findOneAndUpdate({ chatId }, { listening })
    .then((chatToken) => {
      if (!chatToken) {
        return bot.sendMessage(msg.chat.id, '일단 토큰을 먼저 발급받아야해요.');
      }
      return bot.sendMessage(msg.chat.id, `메시지 알림을 ${listening ? '켰어요' : '껐어요'}`);
    });
});


/*
* 단어장
*/

bot.onText(/^\/기억 (\S+) (.+)/, (msg, match) => {
  const keyword = match[1];
  const definition = match[2];

  // dictionary컬렉션의 신규 document 생성
  // 같은 keyword의 document를 계속 저장하고, 불러올 때 병합하는 구조
  const document = new Models.dictionary({
    keyword, definition,
  });
  // document 저장
  document.save()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then(() => bot.sendMessage(msg.chat.id, SUCCESS_MSG.CREATE));
});

bot.onText(/^\/알려$/, (msg) => {
  // dictionary컬렉션에 find 쿼리 날림
  return Models.dictionary.find()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      // keywords 리스트
      let keywords = docs.map(doc => doc.keyword);

      // 중복 제거
      keywords = keywords.unique();
      const message = `저는 ${keywords.length}개의 단어를 알고있어요.`;
      return bot.sendMessage(msg.chat.id, message);
    });
});

bot.onText(/^\/알려줘$/, (msg) => {
  // dictionary컬렉션에 find 쿼리 날림
  return Models.dictionary.find()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      // keywords array 생성
      let keywords = docs.map(doc => doc.keyword);

      // 중복 제거 및 병합
      keywords = keywords.unique();
      keywords = keywords.join(', ');
      const message = `저는 이런 단어들을 알고있어요.\n${keywords}`;
      return bot.sendMessage(msg.chat.id, message);
    });
});

bot.onText(/^\/알려 (.+)/, (msg, match) => {
  const keyword = match[1];

  // dictionary컬렉션에 find 쿼리 날림
  Models.dictionary.find({ keyword })
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      // 일치하는게 없으면 빈 array가 옴
      if (docs.length < 1) return bot.sendMessage(msg.chat.id, ERROR_MSG.NOT_FOUND);

      // docs array의 definition들을 array로 만들고 string으로 병합
      let definitions = docs.map(doc => doc.definition);
      definitions = definitions.join(', ');
      return bot.sendMessage(msg.chat.id, definitions);
    });
});

bot.onText(/^\/잊어 (.+)/, (msg, match) => {
  const keyword = match[1];

  // find & remove 쿼리를 날림
  // keyword와 일치하는 모든 document 제거
  Models.dictionary.find({ keyword }).remove()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      // 일치하는 document가 없으면 빈 array가 옴
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

// 알림 스케줄을 저장할 글로벌 변수
const schedules = [];
// 앱 실행시 DB에 저장된 스케줄을 모두 가져와서 변수에 추가
Models.schedule.find().then(docs => docs.map(doc => schedules.push(doc)));

bot.onText(/^\/알림 (\d+)(초|분|시간|일)(.*)/, (msg, match) => {
  const num = match[1];
  const unit = match[2];
  const memo = match[3] || '';

  // 입력값을 밀리초로 변환
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

  // 앱 재시작을 대비하여 디비에 저장
  const document = new Models.schedule({
    schedule,  // 알림 시간
    memo,  // 메모
    messageId: msg.message_id,  // 답장을 보낼 타겟 메시지
    chatId: msg.chat.id,  // 톡방 아이디
    userId: msg.from.id,  // 유저 아이디
  });
  document.save()
    .catch(err => bot.sendMessage(msg.chat.id, ERROR_MSG))
    .then((doc) => {
      // 스케줄 변수에 추가
      schedules.push(doc);
      return bot.sendMessage(msg.chat.id, `${SUCCESS_MSG.CREATE} ${num}${unit}뒤에 알려드릴게요.`);
    });
});

// 1초에 한번씩 스케줄 변수를 확인하여 알람 실행
setInterval(() => {
  const now = Date.now();
  schedules.map((doc) => {
    // 현재시간보다 알림시간이 작은 경우 알림 수행
    if (doc.schedule < now) {
      // 스케줄 변수에서 제거
      const index = schedules.map(_doc => _doc.messageId).indexOf(doc.messageId);
      schedules.splice(index, 1);

      // DB에서 제거후 알림
      return Models.schedule.findOneAndRemove({ schedule: doc.schedule })
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

  // 구글 번역 옵션
  const translateOptions = {
    from: 'ko',
    to: 'en',
    model: 'nmt', // Neural Machine Translation 모델사용
  };

  // 입력한 언어 감지
  googleTranslate.detect(sentences)
    .then((data) => {
      // 입력값이 한국어가 아니면, 감지된 언어에서 한국어로 번역
      if (data[0].language !== 'ko') {
        translateOptions.from = data[0].language;
        translateOptions.to = 'ko';
      }
      // 번역
      return googleTranslate.translate(sentences, translateOptions);
    })
    .then(data => bot.sendMessage(msg.chat.id, data[0]));
});


/*
* 초성퀴즈
*/

// 퀴즈 현황을 저장할 변수
const jqz = {};

// 문제 제출 함수
// 입력한 톡방에 문제를 내준다
function makeQuiz(chatId) {
  // 문제 횟수 카운터
  jqz[chatId].currentRound += 1;

  // 문제를 낼 영역 설정
  const category = jqz[chatId].category;
  const condition = category ? { category } : {};

  // 설정된 영역에서 문제의 갯수를 확인
  return Models.jaumQuiz.count(condition)
    .then((count) => {
      // 랜덤하게 하나의 document를 찾음
      const random = Math.floor(Math.random() * count);
      return Models.jaumQuiz.findOne(condition).skip(random);
    })
    .then((doc) => {
      // document가 없으면 null이 옴
      if (!doc) {
        return bot.sendMessage(chatId, `${jqz[chatId].category} 영역에서 알고있는 문제가 없어요!`)
          .then(() => { jqz[chatId] = null; });
      }

      // 찾은 문제로 퀴즈 현황 설정
      jqz[chatId].quiz = doc.quiz;
      jqz[chatId].quizCategory = doc.category;
      // 초성 문제 생성
      const chosung = utils.hangulChosung(jqz[chatId].quiz);

      // 자동 힌트 스케줄링
      setTimeout(() => {
        if (jqz[chatId] && doc.quiz === jqz[chatId].quiz && jqz[chatId].hintAt < Date.now()) {
          const hint = utils.makeHint(jqz[chatId].quiz);
          jqz[chatId].hintAt = Date.now() + (1000 * 30);
          bot.sendMessage(chatId, `어려운가요? 한 글자를 알려드릴게요.\n${hint}`);
        }
      }, 1000 * 60);

      // 제한시간 스케줄링
      setTimeout(() => {
        if (jqz[chatId] && doc.quiz === jqz[chatId].quiz) {
          bot.sendMessage(chatId, `정말 어려운가봐요. 정답은 "${jqz[chatId].quiz}"였어요.\n다음 문제를 내드릴게요.`)
            .then(() => makeQuiz(chatId));
        }
      }, 1000 * 60 * 3);

      // 문제 제출
      return bot.sendMessage(chatId, `[${doc.category}] ${chosung}`)
        .then(() => { jqz[chatId].listen = true; });
    });
}

bot.onText(/^\/초성퀴즈$/, (msg) => {
  // 모든 퀴즈를 가져옴
  return Models.jaumQuiz.find()
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((docs) => {
      let quizzes = docs.map(doc => doc.quiz);
      quizzes = quizzes.unique();

      let categories = docs.map(doc => doc.category);
      categories = categories.unique();

      let categoriesDetail = categories.map(cat => `${cat}: ${utils.countIn(docs, cat, 'category')}개`);
      categoriesDetail = categoriesDetail.join('\n');

      const message = `저는 ${categories.length}개의 영역에서 ${quizzes.length}개의 문제를 알고있어요.\n-\n${categoriesDetail}`;
      return bot.sendMessage(msg.chat.id, message);
    });
});

bot.onText(/^\/초성퀴즈 시작 (\d+)(.*)$/, (msg, match) => {
  // 퀴즈 현황 변수가 설정되어있으면 이미 초성퀴즈를 풀고있는 중임
  if (jqz[msg.chat.id]) return bot.sendMessage(msg.chat.id, '대답을 기다리고 있어요!');

  // 문제 영역을 설정
  const category = match[2] ? match[2].replace(' ', '') : null;
  const categoryVerbose = category || '모든';

  // 톡방마다 독립적인 퀴즈 현황 설정
  jqz[msg.chat.id] = {
    round: parseInt(match[1], 10),
    currentRound: 0,
    scores: [],
    quiz: '',
    listen: false,
    category,
    hintAt: Date.now() + (1000 * 30),  // 힌트는 30초 이후 가능
  };

  // 퀴즈 시작
  return bot.sendMessage(msg.chat.id, `${categoryVerbose} 영역에서 총 ${match[1]}개의 초성퀴즈를 낼게요.`)
    .then(() => makeQuiz(msg.chat.id));
});

bot.onText(/^\/초성퀴즈 힌트$/, (msg) => {
  // 힌트를 내도 되는 시간인지 확인
  const distance = jqz[msg.chat.id].hintAt - Date.now();
  if (distance > 0) {
    return bot.sendMessage(msg.chat.id, `아직 힌트를 알려드리기엔 이른것 같아요. ${Math.floor(distance / 1000)}초를 더 기다려주세요.`);
  }

  // 퀴즈에서 힌트를 생성
  const hint = utils.makeHint(jqz[msg.chat.id].quiz);
  // 힌트 가능시간을 30초 이후로 재설정
  jqz[msg.chat.id].hintAt = Date.now() + (1000 * 30);
  return bot.sendMessage(msg.chat.id, `그러면 한 글자를 알려드릴게요.\n${hint}`);
});

bot.onText(/^\/초성퀴즈 추가 (.+) @(\S+)/, (msg, match) => {
  const quiz = match[1];
  const category = match[2];

  // 문제가 이미 있는건 아닌지 확인
  return Models.jaumQuiz.findOne({ quiz, category })
    .then((doc) => {
      // 있으면 바로 리턴
      if (doc) return bot.sendMessage(msg.chat.id, '그 문제는 이미 있는걸요?');

      // 없으면 새 퀴즈를 만듦
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

  // 문제가 찾고, 있으면 지움
  return Models.jaumQuiz.findOneAndRemove({ quiz, category })
    .catch(err => bot.sendMessage(msg.chat.id, `${ERROR_MSG} ${err}`))
    .then((doc) => {
      // document가 없으면 알림
      if (!doc) return bot.sendMessage(msg.chat.id, '그런 문제가 없는걸요?');
      return bot.sendMessage(msg.chat.id, `초성퀴즈 "${quiz}"를 "${category}"영역에서 삭제했어요.`);
    });
});

bot.onText(/^\/초성퀴즈 중단$/, (msg) => {
  // 퀴즈 현황 변수를 지움
  if (jqz[msg.chat.id]) {
    jqz[msg.chat.id] = null;
    return bot.sendMessage(msg.chat.id, '초성퀴즈를 강제로 끝냈어요.');
  }
  return bot.sendMessage(msg.chat.id, '퀴즈를 내고 있지 않은걸요?');
});

bot.onText(/^\/초성퀴즈 랭킹$/, (msg) => {
  // 톡방의 플레이어를 찾음
  return Models.jaumQuizPlayer.find({ chatId: msg.chat.id })
    .then((docs) => {
      // 플레이어의 영역별 점수를 합침
      const players = [];
      _.forEach(docs, (player) => {
        let totalScore = 0;
        _.forEach(player.scores, (value) => { totalScore += value; });
        players.push({ player, totalScore });
      });
      // 총점으로 정렬
      players.sort((a, b) => b.totalScore - a.totalScore);

      // string으로 합침
      let result = [];
      players.map(player => result.push(`${player.player.firstName}: 총 ${player.totalScore}점`));
      result = result.join('\n');
      return bot.sendMessage(msg.chat.id, `초성퀴즈 랭킹이에요\n${result}`);
    });
});

bot.onText(/^\/초성퀴즈 점수 (.+)$/, (msg, match) => {
  const firstName = match[1];

  // 해당 플레이어를 찾음
  return Models.jaumQuizPlayer.findOne({ chatId: msg.chat.id, firstName })
    .then((doc) => {
      // 영역별 점수를 array로 변환
      const scores = [];
      _.forEach(doc.scores, (score, category) => {
        scores.push({ category, score });
      });
      // 영역별 점수로 정렬
      scores.sort((a, b) => b.score - a.score);

      // string으로 합침
      let result = [];
      scores.map(score => result.push(`${score.category}: ${score.score}점`));
      result = result.join('\n');
      return bot.sendMessage(msg.chat.id, `${firstName}님의 초성퀴즈 점수 기록이에요.\n${result}`);
    });
});

// 퀴즈를 위해 일단 모든 톡을 들음
bot.onText(/(.*)/, (msg, match) => {
  // 해당 톡방에서 퀴즈를 내고 있고, 정답을 맞춘 첫번째 톡이라면
  if (jqz[msg.chat.id] && jqz[msg.chat.id].listen && match[1] === jqz[msg.chat.id].quiz) {
    // 중복 정답을 막기 위해 플래그를 세움
    jqz[msg.chat.id].listen = false;

    // 정답을 기록
    const quizCategory = jqz[msg.chat.id].quizCategory;
    const point = 1;
    // jaumQuizPlayer컬렉션에서 플레이어를 찾음
    Models.jaumQuizPlayer.findOne({ userId: msg.from.id, chatId: msg.chat.id })
      .then((player) => {
        // 플레이어가 없으면 새로 만듦
        if (!player) {
          const newPlayer = new Models.jaumQuizPlayer({
            userId: msg.from.id,
            firstName: msg.from.first_name,
            chatId: msg.chat.id,
            scores: { [quizCategory]: point },
          });
          newPlayer.save();
        } else {
          // 해당 영역에 점수를 추가한다.
          const scores = player.scores;
          const firstName = msg.from.first_name;
          if (scores[quizCategory]) scores[quizCategory] += point;
          else scores[quizCategory] = point;
          player.update({ scores, firstName }).exec();
        }
      });

    // 정답자를 퀴즈 현황에 기록
    jqz[msg.chat.id].scores.push(msg.from);
    // 정답자를 알림
    bot.sendMessage(msg.chat.id, '정답이에요!', { reply_to_message_id: msg.message_id }).then(() => {
      // 마지막 퀴즈인 경우
      if (jqz[msg.chat.id].round === jqz[msg.chat.id].currentRound) {
        const obj = {};
        // 정답자를 정리
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

        // 정답자의 칭호를 계산하기 위한 쿼리
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

        // 퀴즈 현황을 초기화
        jqz[msg.chat.id] = null;

        // 디비 쿼리가 모두 끝나면
        Promise.all(queries).then((array) => {
          // 정답자를 점수순으로 정렬
          array.sort((a, b) => b.score - a.score);
          // string으로 합침
          // 플레이어의 총점을 기반으로 칭호를 덧붙임
          let result = [];
          array.map(player => result.push(`${utils.makeTitleName(player.totalScore)}_${player.firstName}: ${player.score}점`));
          result = result.join('\n');
          bot.sendMessage(msg.chat.id, `초성퀴즈가 끝났어요!\n${result}`);
        });
      } else makeQuiz(msg.chat.id);  // 끝나지 않았으면 퀴즈를 또 냄
    });
  }
});
