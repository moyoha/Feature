// 如何用栈实现队列
class Stack {
  constructor() {
    this.stack = []
  }
  push(value) {
    return this.stack.push(value)
  }
  pop() {
    return this.stack.pop()
  }
}

class List {
  constructor() {
    // 入队
    this.stackA = new Stack()
    // 出队
    this.stackB = new Stack()
  }
  push(value) {
    return this.stackA.push(value)
  }
  shift() {
    if(this.stackB.stack.length === 0) {
      while(this.stackA.stack.length !== 0) {
        const item = this.stackA.pop();
        this.stackB.push(item);
      }
      return this.stackB.pop();
    }
    return this.stackB.pop();
  }
}

const list = new List()
console.log(list.push(1));
console.log(list.push(2));
console.log(list.push(3));
console.log(list.push(4));
console.log(list.shift());
console.log(list.shift());
console.log(list.push(5));
console.log(list.shift());
console.log(list);