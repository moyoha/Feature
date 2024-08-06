// 双边循环法
function quick(arr, startIndex, endIndex) {
  if(startIndex >= endIndex) {
    return;
  }
  const pivotIndex = partition(arr, startIndex, endIndex);
  quick(arr, startIndex, pivotIndex - 1)
  quick(arr, pivotIndex + 1, endIndex)
  return arr;
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
console.log(quick(arr, 0, arr.length - 1));