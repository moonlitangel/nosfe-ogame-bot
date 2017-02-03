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

module.exports.dictionary = mongoose.model('Dictionary', Dictionary);
module.exports.schedule = mongoose.model('Schedule', Schedule);
module.exports.jaumQuiz = mongoose.model('JaumQuiz', JaumQuiz);

