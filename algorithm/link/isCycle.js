// 判断链表是否有环
function isCycle(head) {
  let l1 = head;
  let l2 = head;
  while(l2 && l2.next) {
    l1 = l1.next;
    l2 = l2.next.next;
    if(l1 === l2) {
      return true
    }
  }
  return false
}

const node1 = { value: 5 }
const node2 = { value: 3 }
const node3 = { value: 7 }
const node4 = { value: 2 }
const node5 = { value: 6 }

node1.next = node2;
node2.next = node3;
node3.next = node4;
node4.next = node5;
// node5.next = node2;
node5.next = null;

console.log(isCycle(node1));