// url: 上传目标地址
// file: 要上传的文件对象
// events: 包含各种回调函数的对象
// withCredentials: 是否携带凭证(cookie等)
function callXHR(url, file, events, withCredentials) {
    let xhr = new XMLHttpRequest();

    let data = new FormData();
    data.append('file', file);

    // 上传终止时的处理
    xhr.upload.onabort = function () {};

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) { // 请求完成
            let rt = xhr.responseText;
            if (typeof rt === 'string') {
                try {
                    rt = JSON.parse(rt);
                } catch (e) {}
            }
            if (xhr.status === 200) { // 请求成功
                events.onsuccess(rt.md5);
            } else { // 请求失败
                if (rt) {
                    events.onerror(rt.error_code, rt, xhr);
                } else {
                    events.onerror(undefined, rt, xhr);
                }
            }
        }
    };
    // 上传进度回调
    xhr.upload.onprogress = function (e) {
        events.onprogress(e);
    };
    xhr.open('POST', url, true);
    // timeout 应该在 xhr.open 之后设置,否则 ie10+ 会抛出错误
    xhr.timeout = 12 * 60 * 1000;
    xhr.ontimeout = function (e) {
        events.onerror('030'); // 超时错误回调
    };
    // 该属性配合CORS使用，在有Access-Control-Allow-Credentials: true这个响应头的时候
    // 设置这个属性可以让请求携带cookie
    xhr.withCredentials = withCredentials;
    xhr.send(data);

    // 请求出错时的处理
    xhr.onerror = () => {
        console.log('[xhr onerrro]:', arguments);
    };

    return xhr;
}


// precreate 参数
function preParamsCallback(file) {
    return {
        data: {
            'path': file.path,
            'autoinit': 1,
            target_path: '/',
            'local_mtime': parseInt(Date.now() / 1000),
        }
    };
}

// create 接口参数
function commitParamsCallback(file) {
    return new Promise((resolve) => {
        resolve({
            data: {
                target_path: '/',
                'local_mtime': parseInt(Date.now() / 1000),
            },
            query: {
                rtype: 1,
            }
        });
    });
}

const workerUrl = './md5.worker.js';
let workers = [];
const CHUNK_SIZE = 4 * 1024 * 1024;
const getBlobSlice = () => File && (File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice);

// 获取文件md5
function getFileMd5(file) {
    let promiseList = [];
    const sliceMd5 = getBlobSlice().call(file, 0, 256 * 1024);
    promiseList.unshift(getChunkMd5(file, 'file'));
    promiseList.unshift(getChunkMd5(sliceMd5, 'slice'));
    /**
     * sliceMd5 是为了让server 触发秒传返回return_type: 2
     * 这样端则不用重复走分片逻辑传到PCS
     */
    return Promise.all(promiseList).then(result => {
        return {
            sliceMd5: result[0],
            fileMd5: result[1].fileMd5,
            chunkMd5: result[1].chunkMd5
        };
    }).catch(err => {
        console.log(err);
    });
}
// 获取一个worker
function getOneFreeWorker(index) {
    if (typeof index === 'undefined' || isNaN(index)) {
        index = 0;
    }
    let worker = workers[index];
    if (worker === undefined) {
        let worker = new Worker(workerUrl);
        worker.free = true;
        workers.push(worker);
        return worker;
    } else {
        if (worker.free) {
            return worker;
        }

        return getOneFreeWorker(++index);
    }
}

function getChunkMd5(file, type) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();

        function hash() {
            let worker = getOneFreeWorker();
            worker.free = false;

            reader.onload = e => {
                reader = null;
                worker.postMessage(e.target.result);
                worker.postMessage('dataEnd');
            };
            worker.onmessage = function (e) {
                if (e.data === 'appendEnd') {
                    return;
                }
                worker.free = true;
                resolve(e.data);
            };
        }

        // 超过4MB文件再按4MB切割
        if (type === 'slice') {
            reader.readAsArrayBuffer(file);
            hash();
            return;
        }
        // 大于 4MB 的文件可以分别读取内存计算MD5，不占用内存
        let currentChunk = 0;
        let chunks = Math.ceil(file.size / CHUNK_SIZE);
        let buffer;
        let start = currentChunk * CHUNK_SIZE;
        let end = ((start + CHUNK_SIZE) >= file.size) ? file.size : start + CHUNK_SIZE;
        if (start < end) {
            reader.readAsArrayBuffer(getBlobSlice().call(file, start, end));
        }
        const chunkSize = Math.ceil(file.size / CHUNK_SIZE);
        let chunkMd5 = new Array(chunkSize).fill('');
        let wordArrays = new Array(chunkSize).fill('');

        for (let i = 0; i < chunkSize; i++) {
            const start = i * CHUNK_SIZE;
            let end = (i + 1) * CHUNK_SIZE;
            if ((i + 1) === chunkSize) {
                end = Math.min(end, file.size);
            }
            let reader = new FileReader();
            if (start < end) {
                reader.readAsArrayBuffer(getBlobSlice().call(file, start, end));
            }
            reader.onload = (e) => {
                buffer = e.target.result;
                wordArrays.splice(i, 1, buffer);

                let worker = getOneFreeWorker();
                worker.free = false;
                worker.postMessage(buffer);
                worker.postMessage('dataEnd');

                worker.onmessage = function (e) {
                    worker.free = true;
                    chunkMd5.splice(i, 1, e.data);
                    currentChunk += 1;

                    if (currentChunk >= chunks) {
                        let worker = getOneFreeWorker();
                        worker.free = false;
                        wordArrays.forEach((wordArray) => {
                            worker.postMessage(wordArray);
                        });
                        worker.postMessage('dataEnd');

                        worker.onmessage = function (e) {
                            worker.free = true;
                            resolve({
                                fileMd5: e.data,
                                chunkMd5
                            });
                        };
                    }
                };

                buffer = null;
                reader = null;
            };
        }
    });
}

export {
    callXHR, preParamsCallback, commitParamsCallback, getFileMd5
};
