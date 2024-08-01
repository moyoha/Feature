function bubble(arr) {
    const len = arr.length;
    let sortBorder = len - 1; // 无序数列的边界
    let lastExchangeIndex = 0; // 记录最后一次交换的位置
    for (let i = 0; i < len - 1; i++) {
        let sorted = true;
        for (let j = 0; j < sortBorder; j++) {
            // 若不再进行交换则说明已经有序
            if(arr[j] > arr[j + 1]) {
                sorted = false;
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]]
                lastExchangeIndex = j;
            }
        }
        sortBorder = lastExchangeIndex;
        if(sorted) {
            break;
        }
    }
    return arr;
}

console.log(bubble([5, 8, 6, 3, 9, 2, 1, 7]));