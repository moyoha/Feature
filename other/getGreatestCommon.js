// 求两个数的最大公约数，辗转相除法
// 两个正整数 a 和 b （a > b），他们的最大公约数等 a 除以 b 的余数 c 和 b 之间的最大公约数
function getGreat(a, b) {
  let max = a > b ? a : b;
  let min = a < b ? a : b;
  let rest = max % min
  while (rest !== 0) {
    max = min;
    min = rest;
    rest = max % min
  }
  return min;
}

// console.log(getGreat(4, 5));
// console.log(getGreat(20, 25));
// console.log(getGreat(49, 14));

// 求两个数的最大公约数，更相减损术
// 两个正整数 a 和 b （a > b），他们的最大公约数等 a 减 b 的差值 c 和 b 之间的最大公约数
function getGreat2(a, b) {
  let max = a > b ? a : b;
  let min = a < b ? a : b;
  let rest = max - min
  if(rest !== 0 ) {
    return getGreat2(min, rest)
  }
  return min;
}


console.log(getGreat2(4, 5));
console.log(getGreat2(20, 25));
console.log(getGreat2(49, 14));