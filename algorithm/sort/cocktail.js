"use strict"
// 鸡尾酒排序
function cocktail(arr) {
  const len = arr.length;
  for(let i = 0; i < len / 2; i++) {
    let isSorted = true;
    for(let j = i; j < len - 1 - i; j++) {
      if(arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]]
        isSorted = false;
      }
    }
    if(isSorted) {
      break;
    }
    isSorted = true;
    for(let k = len - 1 - i; k > 0; k--) {
      if(arr[k] < arr[k - 1]) {
        [arr[k], arr[k - 1]] = [arr[k - 1], arr[k]]
        isSorted = false;
      }
    }
    if(isSorted) {
      break;
    }
  }
  return arr;
}

console.log(cocktail([2, 3, 4, 5, 6, 7, 8, 1]));