"use strict"
// 双边循环法
function quick(arr, startIndex, endIndex) {
  if(startIndex >= endIndex) {
    return;
  }
  const pivotIndex = partition(arr, startIndex, endIndex);
  quick(arr, startIndex, pivotIndex - 1)
  quick(arr, pivotIndex + 1, endIndex)
}

function partition(arr, startIndex, endIndex) {
  let pivot = arr[startIndex]
  let left = startIndex;
  let right = endIndex;
  while(left != right) {
    // 两个循环的位置不能交换，否则会导致基准元素位置错误
    while (left < right && arr[right] > pivot) {
      right--
    }
    while (left < right && arr[left] <= pivot) {
      left++
    }
    if(left < right) {
      [arr[left], arr[right]] = [arr[right], arr[left]]
    }
  }
  [arr[left], arr[startIndex]] = [arr[startIndex], arr[left]]
  return left
}

const arr = [4, 7, 6, 5, 3, 2, 8, 1]
quick(arr, 0, arr.length - 1)
console.log(arr);

// 单边循环法
function quick2(arr, startIndex, endIndex) {
  if(startIndex >= endIndex) {
    return
  }
  const pivotIndex = partition2(arr, startIndex, endIndex)
  quick2(arr, startIndex, pivotIndex - 1)
  quick2(arr, pivotIndex + 1, endIndex)
}

function partition2(arr, startIndex, endIndex) {
  const pivot = arr[startIndex]
  let mark = startIndex
  let left = startIndex + 1
  while (left <= endIndex) {
    if(arr[left] >= pivot) {
      left++
    } else {
      mark++
      [arr[mark], arr[left]] = [arr[left], arr[mark]]
      left++
    }
  }
  [arr[startIndex], arr[mark]] = [arr[mark], arr[startIndex]]
  return mark
}

// quick2(arr, 0, arr.length - 1)
// console.log(arr);