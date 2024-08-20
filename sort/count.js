function count(arr) {
  const len = arr.length
  const min = Math.min.apply(null, arr)
  const max = Math.max.apply(null, arr)
  const len2 = max - min + 1
  const countArr = Array.from({length: len2}, () => 0)

  for(let i = 0; i < len; i++) {
    countArr[arr[i]-min]++
  }

  for(let j = 1; j < len2; j++) {
    countArr[j] += countArr[j-1]
  }

  const sortedArr = []
  for(let k = len - 1; k >= 0; k--) {
    // 位次下标
    const rank = countArr[arr[k]-min]-1;
    sortedArr[rank] = arr[k]
    countArr[arr[k]-min]--
  }
  return sortedArr
}

const arr = [95, 94, 91, 98, 99, 90, 99, 93, 91, 92]
console.log(count(arr));
