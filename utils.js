const _ = require('lodash');

const assets = require('./assets');


function contains(v) {
  for (let i = 0; i < this.length; i++) {
    if (this[i] === v) return true;
  }
  return false;
}

function unique() {
  const arr = [];
  for (let i = 0; i < this.length; i++) {
    if (!arr.contains(this[i])) {
      arr.push(this[i]);
    }
  }
  return arr;
}

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

function reverseString(str) {
  return (str === '') ? '' : reverseString(str.substr(1)) + str.charAt(0);
}

function makeHint(str, num = 1) {
  const cho = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  let result = '';
  let count = 0;
  const index = Math.floor((Math.random() * str.length));
  for (let i = str.length - 1; i >= 0; i--) {
    const code = str.charCodeAt(i) - 44032;
    if (count < num && i <= index && code > -1 && code < 11172) {
      count += 1;
      result += str[i];
    } else if (code > -1 && code < 11172) result += cho[Math.floor(code / 588)];
    else result += str[i];
  }
  return reverseString(result);
}

function countIn(arr, value, key) {
  let num = 0;
  for (let i = 0; i < arr.length; i++) {
    const obj = arr[i];
    if (obj[key] === value) num += 1;
  }
  return num;
}

function makeTitleName(data) {
  const titles = assets.titleNames;
  let title;
  _.forEach(titles, (value, key) => {
    if (data > key) title = value;
  });
  return title;
}

module.exports = {
  contains, unique, hangulChosung, reverseString, makeHint, countIn, makeTitleName,
};
