// 给出一个正整数，找出这个数全排列的下一个数
function findNearedtNumber(number) {
  const numArr = String(number).split('')
  const len = numArr.length
  let idx = len - 1
  // 寻找边界
  while(idx > 0 && +numArr[idx] < +numArr[idx - 1]) {
    idx--
  }
  console.log(idx);
  if(idx <= 0) {
    return number
  }
  // 交换边界为 idx - 1
  const startArr = numArr.slice(0, idx - 1)
  const endArr = numArr.slice(idx - 1);
  endArr.sort((a, b) => {
    return +a - +b;
  })
  for(let i = 0; i < endArr.length; i++) {
    if(+endArr[i] > +numArr[idx - 1]) {
      [endArr[0], endArr[i]] = [endArr[i], endArr[0]]
      break
    }
  }
  console.log(startArr, endArr);
  return +[...startArr,...endArr].join('')
}

console.log(findNearedtNumber(12345));
console.log(findNearedtNumber(12354));
console.log(findNearedtNumber(12435));