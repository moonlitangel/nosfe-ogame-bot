const mongoose = require('mongoose');


const Dictionary = mongoose.Schema({
  keyword: {
    type: String,
    required: true,
  },
  definition: {
    type: String,
    required: true,
  },
});

const Schedule = mongoose.Schema({
  schedule: {
    type: Number,
    require: true,
  },
  memo: {
    type: String,
  },
  userId: {
    type: Number,
  },
  messageId: {
    type: Number,
  },
  chatId: {
    type: Number,
  },
});

const JaumQuiz = mongoose.Schema({
  quiz: {
    type: String,
    require: true,
  },
  category: {
    type: String,
    require: true,
  },
});

const JaumQuizPlayer = mongoose.Schema({
  userId: {
    type: Number,
    require: true,
  },
  firstName: {
    type: String,
  },
  chatId: {
    type: Number,
    require: true,
  },
  scores: {
    type: Object,
  },
});

const ChatToken = mongoose.Schema({
  chatId: {
    type: Number,
    require: true,
  },
  token: {
    type: String,
  },
  listening: {
    type: Boolean,
    default: true,
  },
});

module.exports.dictionary = mongoose.model('Dictionary', Dictionary);
module.exports.schedule = mongoose.model('Schedule', Schedule);
module.exports.jaumQuiz = mongoose.model('JaumQuiz', JaumQuiz);
module.exports.jaumQuizPlayer = mongoose.model('JaumQuizPlayer', JaumQuizPlayer);
module.exports.chatToken = mongoose.model('ChatToken', ChatToken);
