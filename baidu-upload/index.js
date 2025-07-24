import events from 'events';
import { callXHR, preParamsCallback, commitParamsCallback, getFileMd5 } from './util';
import api from './api';

const FILE_CHUNK_SIZE = 4 * 1024 * 1024; // 4M

// 文件状态
const FILE_STATUS_PENDING = -1; // 等待上传
const FILE_STATUS_UPLOADING = -2; // 上传中
const FILE_STATUS_ERROR = -3; // 上传失败
const FILE_STATUS_COMPLETE = -4; // 上传完成
const FILE_STATUS_PAUSING = -5; // 暂停中

const getBlobSlice = () => File && (File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice);

export default class Uploader extends events {
    constructor(options) {
        super();
        let {
            useChunks = true, // 分片上传开关
            threadCount = 5, // 并发上传线程数
            chunkRetryLimit = 2, // 单个分片失败重试次数
            autoUpload = true,
            preCreateUrl, // 预上传接口
            createFileUrl, // 创建文件接口
            useTeratransfer, // 是否使用特殊传输模式
            withCredentials = false
        } = options || {};

        let xhr = (options && options.xhr) || (Uploader._options && Uploader._options.xhr);
        if (!xhr) {
            throw new Error('缺少 axios 参数');
        }
        xhr && api.init(xhr, preCreateUrl, createFileUrl);
        // 获取可用上传域名
        xhr && this.getEndPoint();

        this.autoUpload = autoUpload;
        this.withCredentials = withCredentials;
        this.uploadLimit = 3; // 上传文件并发限制
        this.fileQueue = []; // 添加到上传队列中的文件
        this.uploadIndex = 0; // fileQueue 数组中下一个要上传的文件的位置
        this.chunkRetryLimit = chunkRetryLimit;
        this.preParamsCallback = preParamsCallback;
        this.commitParamsCallback = commitParamsCallback;
        this.threadCount = threadCount; // 同时上传的 chunk 数量
        this.useChunks = useChunks;
        this.pcsEndpoint = ''; // 可用上传域名
        this.uploadErrorChunksIndex = {}; // 记录对应文件上传失败的 chunk, { 0: [2, 5] } 表示第0个文件的第2和第5分片上传失败
        this.allSuccess = false; // 是否全部上传完成
        this.uploadingCount = 0; // 正在上传的文件数量
        this.isClosed = false; // 禁止上传标记
        this.useTeratransfer = useTeratransfer;
    }

    static setOptions(options) {
        Uploader._options = options;
    }

    getEndPoint() {
        api.initEndpoint().then(endpoint => {
            if (endpoint) {
                this.pcsEndpoint = endpoint; // "c-jp.terastream.fun"
                this.emit('load');
            } else {
                throw new Error();
            }
        }).catch(ex => {
            console.error('获取pcs可用域名失败', ex);
            this.emit('exception');
        });
    }

    append(files) {
        this.allSuccess = false;
        if (!files || this.isClosed) {
            return;
        }

        if (files && typeof files.length === 'undefined') {
            files = [files];
        }
        const fileIndexList = [];
        for (let i = 0, file, le = files.length; i < le; i++) {
            // 1. 遍历添加的文件,为文件添加index 和 path 属性, 处理 status 状态
            file = files[i];
            // 处理已上传完成的文件
            if (file.status === FILE_STATUS_COMPLETE) {
                this.emit('progress', file, file.size / file.size);
            }
            if (file.status !== FILE_STATUS_ERROR & file.status !== FILE_STATUS_COMPLETE) {
                file.status = FILE_STATUS_PENDING;
            }
            file.index = this.fileQueue.length;
            var relativePath = file.webkitRelativePath ? file.webkitRelativePath : file.name;
            file.path = '/' + (file.directoryPath ? file.directoryPath : relativePath);
            // 2. 将文件添加文件队列
            this.fileQueue.push(file);
            // 3. 同时将 index 添加到 fileIndexList
            fileIndexList.push(file.index);
        }

        this.emit('ready');
        // 默认上传
        if (this.autoUpload) {
            this.upload();
        }
        return fileIndexList;
    }

    upload(index) {
        if (!this.pcsEndpoint) {
            return;
        }
        index = Number(index);
        let file = null;
        let hasIndex = index > -1;
        // 上传单个文件时的并发处理
        if (this.uploadingCount > this.uploadLimit) {
            if (hasIndex) {
                // 点击上传失败的重试按钮时，4 个文件上传通道被占满，需等待其他文件上传完毕
                file = this.fileQueue[index];
                file.status = FILE_STATUS_PENDING;
            }
            return;
        }

        // 处理指定文件的上传
        if (hasIndex) {
            file = this.fileQueue[index];
            if (!file) {
                return;
            }

            if (file.status === FILE_STATUS_PENDING || file.status === FILE_STATUS_ERROR) {
                file.status = FILE_STATUS_UPLOADING;
                // 清除文件对应的定时器
                clearInterval(file.progressInterval);
                this.handleFileData(file);
            }
            return;
        }

        file = this.fileQueue[this.uploadIndex];
        if (file) {
            if (file.status === FILE_STATUS_COMPLETE) {
                this.uploadIndex++;
                this.upload();
                return;
            }
            // 如果是文件的状态是初始状态或者错误状态，开始上传
            if (file.status === FILE_STATUS_PENDING || file.status === FILE_STATUS_ERROR) {
                file.status = FILE_STATUS_UPLOADING;
                this.handleFileData(file);
                this.uploadIndex++;
            } else {
                // 上传暂停状态文件处理
                this.uploadIndex++;
                this.upload();
            }
        } else {
            // 上传完成后，从头检查有无在队列中的文件
            let state = 0;
            for (let i = 0, file, l = this.fileQueue.length; i < l; i++) {
                file = this.fileQueue[i];
                if (file.status !== FILE_STATUS_COMPLETE) {
                    state = 1;
                }
                if (file.status === FILE_STATUS_PENDING) {
                    this.uploadIndex = i;
                    this.upload();
                    break;
                }
            }

            if (state === 0 && !this.allSuccess && this.fileQueue.length) {
                this.emit('allsuccess', true);
                this.allSuccess = true;
            }
        }
    }
    // 秒传, 若秒传成功,则给文件添加 fs_id 修改文件的状态为上传成功
    async rapidUpload(file) {
        if (file.size < 256 * 1024) {
            return;
        }
        // 获取文件的 md5 和 前 256k 数据的 md5 以及每一个 chunk 的md5
        let res = await getFileMd5(file);
        file.cMD5 = res.fileMd5;
        file.sMD5 = res.sliceMd5;
        let tempObj = {
            path: file.path,
            'content-md5': file.cMD5 || '',
            'slice-md5': file.sMD5 || '',
            file: file.file,
            'content-length': file.size,
            'target_path': '/'
        };
        let query = {
            rtype: 1
        };
        if (!this.fileQueue.length ||
            file.status === FILE_STATUS_ERROR ||
            file.status === FILE_STATUS_COMPLETE) {
            // 如果列表被清空 或者
            // 文件上传失败，这里是为了避免上传出错，秒传成功带给用户困惑，先显示失败，后又成功，该逻辑判断删除没有关系
            // 如果已经上传完成，不再进行秒传
            return;
        }
        try {
            let response = await api.rapidUpload(tempObj, query);

            if (!response.errno) {
                file.fs_id = response?.info?.fs_id || 0;
                file.status = FILE_STATUS_COMPLETE;
                this.emit('progress', file, file.size / file.size);
                this.emit('success', file, response || {});
                this.uploadingCount > 0 && this.uploadingCount--;
                this.upload();
            }
            return;

        } catch (error) {
            this.emit('error', file, error);
        }
    }
    // 分片上传入口
    handleFileData(file) {
        // 上传之前处理的文件包括以下内容：
        // 1、如果文件小于等于256k，直接上传，跳过以下所有步骤
        // 2、计算文件前256k的MD5，付给文件对象值：sMD5
        // 3、获取文件在本地存储的上次上传的信息，主要为了获取uploadId。存在上传信息到步骤4，不存在到步骤6，
        // 4、走precreate接口，传单分片假MD5，获取uploadSing，传单分片，server不会与pcs交互，速度快
        // 5、分片上传，上传前，对判断如果上次上传过，不再上传，如果没有记录，使用precreate接口秒传，同时上传该分片，跳过步骤6。
        // 6、走precreate接口，传两个分片假MD5，获取uploadSing和uploadId，进行正常上传。
        // 7、每上传一个分片，保存上传信息。
        // 8、全部上传完成，删除信息

        let vm = this;
        this.uploadingCount++;


        // 获取文件的上传信息，由于本地存储使用了前256k的MD5值作为文件的唯一标记，因此必须在计算完前256K内容后获取
        // 1、precreate
        // 2、pcs upload
        // 3、commit
        this.preCreate(file)
            .then(async (res) => {
                this.rapidUpload(file);
                // 正式上传
                this.createFile(file)
                    .then(() => {
                        vm.uploadingCount > 0 && vm.uploadingCount--;
                        this.autoUpload && vm.upload();
                    }).catch(err => {
                        this.autoUpload && vm.upload();
                    });
            })
            .catch(e => {
                // 断网后调取接口的函数不会走then，而是直接被捕获错误
                file.status = FILE_STATUS_ERROR;
                this.emit('error', file, e);
                vm.uploadingCount > 0 && vm.uploadingCount--;
                this.autoUpload && vm.upload();
            });
    }

    // 给文件添加 uploadId
    preCreate(file) {
        let blockList = ['5910a591dd8fc18c32a8f3df4fdc1761'];

        if (file.size > FILE_CHUNK_SIZE) {
            blockList = ['5910a591dd8fc18c32a8f3df4fdc1761', 'a5fc157d78e6ad1c7e114b056c92821e'];
        }
        // 如果是重试续传文件，则直接沿用之前的 uploadId
        let errorChunks = this.uploadErrorChunksIndex[file.index];
        if (errorChunks && errorChunks.length && file.uploadId) {
            return new Promise((res, rej) => res());
        }
        let data = {
            autoinit: 1,
            'block_list': JSON.stringify(blockList),
            path: file.path,
            target_path: '/'
        };
        data = this.formatTime(file, data);
        if (typeof this.preParamsCallback === 'function') {
            let result = this.preParamsCallback(file);
            data = Object.assign(data, result.data);
            return this.precreateRequest(data, file, data.query);
        } else {
            return this.precreateRequest(data, file);
        }
    }
    formatTime(file, tempObj) {
        tempObj.local_mtime = parseInt(file.lastModified / 1000, 10);
        return tempObj;
    }
    // 获取 uploadid 给文件添加 uploadId
    precreateRequest(data, file, query) {
        return api.preCreate(data, query).then(response => {
            if (!response.errno) {
                file.uploadId = response.uploadid;
                if (+response.return_type !== 1) {
                    file.status = FILE_STATUS_COMPLETE;
                }
                return response;
            } else {
                file.status = FILE_STATUS_ERROR;
                throw new Error('hasError');
            }
        }).catch(err => {
            this.emit('error', file, err);
        });
    }
    pause(index) {
        let file = this.fileQueue[index];
        if (!file || file.status === FILE_STATUS_COMPLETE) {
            return;
        }
        // 增加暂停和继续的状态
        // 将完成的分片数放入 file
        // 继续上传获取 file 内的分片数
        // 判断是否上传完成和已传的 uploadedSize
        file.status = FILE_STATUS_PAUSING;
        clearInterval(file.progressInterval);
        // 用于继续上传
        file.terminate = true;
        this.uploadingCount > 0 && this.uploadingCount--;
    }
    cancel(index) {
        this.pause(index);
        this.fileQueue.splice(index, 1);
    }
    cancelAll() {
        this.pauseAll();
        this.fileQueue = [];
    }
    pauseAll() {
        // 暂停所有正在上传的文件
        this.fileQueue.forEach(file => {
            this.pause(file.index);
        });
    }
    start(index) {
        let file = this.fileQueue[index];
        if (!file || file.status === FILE_STATUS_COMPLETE) {
            return;
        }
        // 有上传错误的分片则不用重新走 precreate 接口
        let hasErrorChunks = this.uploadErrorChunksIndex[file.index];
        if (file.status === FILE_STATUS_ERROR && !hasErrorChunks) {
            // precreate 接口 error，重新走 precreate
            this.upload(index);
            return;
        }
        if (file.status !== FILE_STATUS_COMPLETE && file.status !== FILE_STATUS_ERROR) {
            file.status = FILE_STATUS_UPLOADING;
        }

        this.uploadingCount++;
        if (this.uploadingCount > this.uploadLimit) {
            this.uploadingCount = 3;
            file.status = FILE_STATUS_PENDING;
            return;
        }
        this.createFile(file)
            .then(() => {
                this.uploadingCount > 0 && this.uploadingCount--;
                this.autoUpload && this.upload();
            });
    }
    startAll() {
        this.fileQueue.forEach(file => {
            this.start(file.index);
        });
    }
    delete(idx) {
        let file = this.fileQueue[idx];
        if (!file) {
            return;
        }
        file.status = FILE_STATUS_PAUSING;
        clearInterval(file.progressInterval);
        if (this.uploadErrorChunksIndex[file.index]) {
            this.uploadErrorChunksIndex[file.index] = null;
        }
        // 个人认为此次存在问题,应该先判断该文件的状态为正在上传,然后才 -1 
        this.uploadingCount > 0 && this.uploadingCount--;
    }
    deleteAll() {
        // 暂停所有正在上传的文件
        this.fileQueue.forEach(file => {
            this.pause(file.index);
        });
        // 清空上传文件
        this.fileQueue = [];
    }
    createFile(file) {
        if (file.status === FILE_STATUS_COMPLETE) {
            return;
        }
        // 上传前查看是否之前上传过且有失败的分片， 如果有失败的分片则续传失败的分片
        let { uploadErrorChunksIndex } = this;
        let fileUploadedErrorChunks = uploadErrorChunksIndex[file.index];
        fileUploadedErrorChunks && fileUploadedErrorChunks.sort();
        return new Promise((resolve) => {
            this.invoke(file, fileUploadedErrorChunks, resolve);
        })
            .then(() => {
                if (file.status !== FILE_STATUS_PAUSING) {
                    return this.commit(file);
                }
                return {};
            })
            .then(response => {
                if (response.errno) {
                    file.status = FILE_STATUS_ERROR;
                    this.emit('error', file, response);
                    return;
                }
                file.status !== FILE_STATUS_PAUSING && this.emit('success', file, response || {});
            })
            .catch(e => {
                console.log('createFile error:', e);
                file.status = FILE_STATUS_ERROR;
                this.emit('error', file, e);
                this.autoUpload && this.upload();
            });
    }
    // 分片上传逻辑
    invoke(file, fileUploadedErrorChunks, callback) {
        // 文件部分分片上传成功过就无须置为[]
        !file.completeChunks && (file.blockList = []);

        let self = this;
        let byChunks = this.useChunks;
        let chunks = byChunks ? Math.ceil(file.size / FILE_CHUNK_SIZE) : 1;

        let currentChunk = -1; 
        let uploadedChunkSize = []; // 每个分片已经上传的大小
        let uploadedSize = 0;
        let errorChunks = ''; // 上传失败的分片队列，取一个删一个
        let allErrorChunks = ''; // 用于保存所有失败的分片，以备失败取消上传
        let isError = false;
        let time = Date.now();
        let completeChunks = 0; // 已完成上传的个数
        file.terminate && (completeChunks = file.completeChunks || 0);
        uploadedSize = completeChunks * FILE_CHUNK_SIZE;
        // 暂停继续上传
        if (file.status === FILE_STATUS_PAUSING) {
            callback();
            return;
        }
        // 800ms 报一次进度, 若该文件上传完成则进行下一个文件的上传
        file.progressInterval = setInterval(() => {
            if (file.status === FILE_STATUS_COMPLETE) {
                this.emit('progress', file, file.size / file.size, Date.now() - time);
                this.emit('success', file);
                this.autoUpload && this.upload();
                clearInterval(file.progressInterval);
            } else {
                this.emit('progress', file, uploadedSize / file.size, Date.now() - time);
            }
        }, 800);

        // 如果此文件之前上传过且有失败的分片则续传
        if (fileUploadedErrorChunks) {
            fileUploadedErrorChunks.forEach(index => {
                sendChunks(false, true, index);
            });
            return;
        }
        // 非续传
        for (let i = 0, count = Math.min(this.threadCount, chunks); i < count; i++) {
            // 使用异步任务串行上传文件
            setTimeout(() => {
                sendChunks(false, true);
            }, 0);
        }
        // 更新 chunk 已完成上传的 size
        function fileProgress(index, loaded) {
            uploadedSize -= (uploadedChunkSize[index] || 0);
            uploadedChunkSize[index] = loaded;
            uploadedSize += loaded;
            if (file.status === FILE_STATUS_COMPLETE) {
                uploadedSize = file.size;
                self.emit('progress', file, file.size / file.size);
            }
            file.uploadedSize = uploadedSize;
            if (uploadedSize >= file.size) {
                clearInterval(file.progressInterval);
                self.emit('progress', file, file.size / file.size);
            }
        }

        function getFatalChunkIndex() {
            if (!errorChunks) {
                return null;
            }
            // 取出第一个失败的分片
            let oneErrorNum = parseInt((errorChunks.match(/\d+/) || [])[0], 10);
            if (isNaN(oneErrorNum)) {
                return null;
            }

            let numReg = new RegExp('\\|' + oneErrorNum + '\\|', 'g');
            // 取出之后，直接删除，下次不再重复
            errorChunks = errorChunks.replace(numReg, '');

            // 去掉一个，以便下次重试时可以继续重试
            if (allErrorChunks.match(numReg).length > self.chunkRetryLimit) {
                return -1;
            }
            return oneErrorNum;
        }

        // 获取一个分片
        // index可以省略，不传则直接返回下一个分片
        function getChunk(index) {
            if (typeof index !== 'number') {
                // currentChunk 是从-1开始计数，chunks是分片个数，当currentChunk === chunks，即取不到该分片了
                if (++currentChunk >= chunks) {
                    return null;
                }
                index = currentChunk;
            }

            if (!byChunks) {
                return file;
            }

            let start = index * FILE_CHUNK_SIZE;
            let end = start + FILE_CHUNK_SIZE >= file.size ? file.size : start + FILE_CHUNK_SIZE;
            if (start >= end) {
                return null;
            }
            return getBlobSlice().call(file, start, end);
        }
        
        // 调用接口 上传 chunk,记录下发进度, 记录上传失败的 chunkidx
        function uploadPeerChunk(chunk, chunkIdx, cb) {

            // 秒传结束，或者某一分片上传出现问题
            if (file.status === FILE_STATUS_COMPLETE || file.status === FILE_STATUS_ERROR) {
                clearInterval(file.progressInterval);
                return;
            }

            let pad = 'path=' + encodeURIComponent(file.path) + '&uploadid=' + (file.uploadId || 0)
                + '&uploadsign=' + (file.uploadSign || 0) + '&partseq=' + (chunkIdx || 0);
            if (self.useTeratransfer) {
                pad += '&useteratransfer=1';
            }
            let url = api.getPCSLink(self.pcsEndpoint, pad);

            let xhr = callXHR(url, chunk, {
                onsuccess(md5) {
                    fileProgress(chunkIdx, chunk.size);
                    // 保存已经上传成功的 chunk 的 md5
                    file.blockList[chunkIdx] = md5;
                    // 还有没有传完的分片
                    cb();
                },
                onerror(errorCode) {
                    errorChunks += '|' + chunkIdx + '|';
                    allErrorChunks += '|' + chunkIdx + '|';

                    let temp = self.uploadErrorChunksIndex[file.index];
                    if (!temp) {
                        temp = self.uploadErrorChunksIndex[file.index] = [];
                    }
                    temp.indexOf(chunkIdx) === -1 && (temp.push(chunkIdx));
                    self.uploadErrorChunksIndex[file.index] = temp;
                    fileProgress(chunkIdx, 0);
                    cb({
                        errorCode: errorCode
                    });
                },
                onprogress(e) {
                    if (file.status === FILE_STATUS_PAUSING) {
                        xhr.abort();
                        return;
                    }
                    fileProgress(chunkIdx, e.loaded);
                }
            }, self.withCredentials);
        }

        // 发送 chunk
        let sendChunks = function (hasError, start, chunkIndex) {
            // 调用上传接口后的回调才走此处逻辑
            if (!start) {
                if (!hasError) {
                    // 上传成功
                    completeChunks++;
                    file.completeChunks = (file.completeChunks || 0) + 1;
                }

                // 上传完成
                if (completeChunks >= chunks ||
                    (!file.terminate && fileUploadedErrorChunks && completeChunks >= fileUploadedErrorChunks.length)) {
                    clearInterval(file.progressInterval);

                    self.emit('progress', file, file.size / file.size);
                    if (file.status !== FILE_STATUS_COMPLETE) {
                        // 分片上传成功
                        callback();
                    }
                    return;
                }
            }

            if (file.status === FILE_STATUS_COMPLETE) {
                return;
            }

            let chunk;
            if (chunkIndex !== undefined) {
                chunk = getChunk(chunkIndex);
                uploadPeerChunk(chunk, chunkIndex, sendChunks);
                return;
            } else {
                !fileUploadedErrorChunks && file.status !== FILE_STATUS_PAUSING && (chunk = getChunk());
                file.terminate && fileUploadedErrorChunks && (chunk = getChunk());

                if (chunk) {
                    uploadPeerChunk(chunk, currentChunk, sendChunks);
                    return;
                }
            }
            // 手动停止所有正在上传的分片
            if (file.status === FILE_STATUS_PAUSING) {
                if (!isError) {
                    callback();
                    isError = true;
                }
                return;
            }

            // chunks发送结束，检查有没有上传失败的chunk
            let fatalIndex = getFatalChunkIndex();
            // console.log('===>fatalIndex:', fatalIndex);
            // 没有上传错误的chunks
            if (fatalIndex === null) {
                return;
            }


            // 如果有上传出错的分片，重新尝试上传
            if (fatalIndex > -1) {
                uploadPeerChunk(getChunk(fatalIndex), fatalIndex, sendChunks);
                return;
            }

            if (file.status === FILE_STATUS_ERROR) {
                return;
            }
            // chunk 重试次数超过限制走此处逻辑
            // console.log('===>upload error');
            // 上传失败
            self.emit('error', file, hasError);
            clearInterval(file.progressInterval);
            file.status = FILE_STATUS_ERROR;
            self.uploadingCount > 0 && self.uploadingCount--;
            self.autoUpload && self.upload();
        };
    }

    commit(file) {
        // 如果列表被清空，直接返回
        if (!this.fileQueue.length || file.status === FILE_STATUS_COMPLETE) {
            return;
        }

        // 如果正在创建文件，直接返回
        if (file.creating) {
            return;
        }

        file.creating = true;
        let paramsData = {
            path: file.path,
            size: file.size,
            uploadid: file.uploadId,
            'block_list': JSON.stringify(file.blockList)
        };

        if (typeof this.commitParamsCallback === 'function') {
            let res = this.commitParamsCallback(file);
            if (res instanceof Promise) {
                return res.then(d => {
                    paramsData = Object.assign(paramsData, d.data);
                    return this.createRequest(file, paramsData, d.query);
                });
            } else {
                paramsData = Object.assign(paramsData, res);
                return this.createRequest(file, paramsData);
            }
        }
    }
    createRequest(file, paramsData, QueryString) {
        return api.create(paramsData, QueryString).then(response => {
            file.creating = false;
            if (!response.errno) {
                file.status = FILE_STATUS_COMPLETE;
                file.fs_id = response.fs_id;
                file.md5 = response.md5;
            }
            return response;
        }).catch((error) => {});
    }
    dispose() {
        this.isClosed = true;
        this.fileQueue = [];
    }

}
