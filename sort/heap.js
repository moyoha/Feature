"use strict"
function heap(arr) {
  const len = arr.length;
  // 构建最大堆
  for(let i = ~~((len - 2) / 2); i >= 0; i--) {
    downAdjust(arr, i, len)
  }
  // j === 0 时，堆最小的元素处于堆顶
  for(let j = len - 1; j > 0; j--) {
    [arr[0], arr[j]] = [arr[j], arr[0]]
    // 需要不断缩小堆自我调整的范围
    downAdjust(arr, 0, j)
  }
}

// 下沉、构建最大堆
function downAdjust(arr, parentIndex, length) {
  const parent = arr[parentIndex]
  let childrenIndex = parentIndex * 2 + 1
  while (childrenIndex < length) {
    // 得到最大孩子的下标, childrenIndex + 1 < length 避免当 parentIndex 为最下层节点时，childrenIndex 越界
    if(childrenIndex + 1 < length && arr[childrenIndex] < arr[childrenIndex + 1]) {
      childrenIndex++
    }
    if(parent >= arr[childrenIndex]) { break }
    arr[parentIndex] = arr[childrenIndex]
    parentIndex = childrenIndex
    childrenIndex = 2 * parentIndex + 1
  }
  arr[parentIndex] = parent
}
const arr = [2, 3, 4, 5, 6, 7, 8, 1]
heap(arr)
console.log(arr);