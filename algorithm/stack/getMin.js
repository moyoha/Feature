// 构建一个栈，该栈的出栈，入栈，取最小值的时间复杂度为 O(1)

class Stack {
  minValue = Infinity
  constructor() {
    this.mainStack = []
    this.minStack = []
  }
  push(value) {
    if(value <= this.minValue) {
     this.minStack.push(value)
     this.minValue = value
    }
   return this.mainStack.push(value)
  }
  pop() {
    const outValue = this.mainStack.pop()
    if(outValue === this.minValue) {
      this.minStack.pop()
      this.minValue = this.minStack[this.minStack.length - 1]
    }
    return outValue;
  }
  getMin() {
    return this.minValue;
  }
}

const aStack = new Stack()
aStack.push(4)
aStack.push(9)
aStack.push(7)
aStack.push(3)
aStack.push(8)
aStack.push(5)
console.log(aStack.getMin());
aStack.pop()
aStack.pop()
aStack.pop()
console.log(aStack.getMin());