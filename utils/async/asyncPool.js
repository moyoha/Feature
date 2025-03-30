// 能提供并发控制,但需要等待所有异步任务完成以后才能进行下一步处理
async function asyncPoolAll(iterable, iteratorFn, concurrency = 3) {
  const executing = new Set();
  const rv = [];

  for (const item of iterable) {
    const p = Promise.resolve().then(() => iteratorFn(item, iterable));
    rv.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.finally(clean);
    if (executing.size >= concurrency) {
      try {
        await Promise.race(executing);
      } catch (error) {
        console.error(error);
      }
    }
  }

  return Promise.allSettled(rv);
}

// 能提供并发控制,并且能够流式处理任务
async function* asyncPoolStream(iterable, iteratorFn, concurrency = 3) {
  const executing = new Set();

  for (const item of iterable) {
    const p = Promise.resolve().then(() => iteratorFn(item, iterable));

    executing.add(p);
    const clean = () => executing.delete(p);
    p.finally(clean);

    if (executing.size >= concurrency) {
      try {
        yield await Promise.race(executing);
      } catch (error) {
        console.error(error);
      }
    }
  }

  // 避免有任务未执行
  while (executing.size) {
    try {
      yield await Promise.race(executing);
    } catch (error) {
      console.error(error);
    }
  }
}

const delay = (ms, val) => new Promise((res, rej) => setTimeout(() => {
  if (Math.random() > 0.5) {
    res(val);
  } else {
    rej(val);
  }
}, ms));

// 测试流式并发
async function testStream() {
  try {
    for await (const result of asyncPoolStream([500, 200, 100], async (ms) => delay(ms, ms), 2)) {
      console.log(result);
    }
  } catch (error) {

  }
}

// testStream();

// 测试并发
async function teatAll() {
  try {
    const res = await asyncPoolAll([500, 200, 100], async (ms) => delay(ms, ms), 2);
    console.log(res);
  } catch (error) {

  }
}

teatAll();