const fullHost = location.origin;

const URL_CONFIG = {
    locateUpload: '/rest/2.0/pcs/file?method=locateupload',
    precreate: fullHost + '/api/precreate',
    createFile: fullHost + '/api/create',
    rapidUpload: '/api/rapidupload'
};

// 拼接分片上传地址
function setServerUrl(pad) {
    let url = '/rest/2.0/pcs/superfile2?method=upload&app_id=250528&channel=dubox&clienttype=0&web=1';
    if (pad) {
        return url + '&' + pad;
    }
    return url;
}

// 检测给定的host是否可用
function detectConnection(host) {
    return new Promise((r, j) => {
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 0) {
                    j(host);
                } else {
                    xhr.abort();
                    r(host);
                }
            }
        };
        try {
            let url = setServerUrl(host);
            xhr.open('POST', url, true);
            xhr.withCredentials = true;
            xhr.send(new FormData());
        } catch (e) {
            j(host);
        }
    });
}

// 使用原生XHR发起GET请求
function pureXHR(url) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.open('get', url, true);
        xhr.onreadystatechange = function () {
            if (this.readyState === 4) {
                let isOK = /^2\d{2}$/.test(this.status);
                isOK ? resolve(JSON.parse(xhr.responseText)) : resolve();
            }
        };
        xhr.onerror = resolve;
        xhr.send();
    });
}


let isQuerying = false;
let waitList = [];

let http = null;
export default {
    init(xhr, preCreateUrl, createFileUrl) {
        http = xhr;
        preCreateUrl && (URL_CONFIG.precreate = preCreateUrl);
        createFileUrl && (URL_CONFIG.createFile = createFileUrl);
    },
    preCreate(data, queryString) {
        if (http) {
            return http.post(URL_CONFIG.precreate, data, {
                params: queryString
            });
        } else {
            return new Promise((resolve, reject) => {
                console.error('not set XMLHttpRequest');
                throw new Error('not set XMLHttpRequest');
            });
        }
    },
    rapidUpload(data, queryString) {
        if (http) {
            return http.post(URL_CONFIG.rapidUpload, data, {
                params: queryString
            });
        } else {
            return new Promise((resolve, reject) => {
                console.error('not set XMLHttpRequest');
                throw new Error('not set XMLHttpRequest');
            });
        }
    },
    create(data, queryString) {
        if (http) {
            return http.post(URL_CONFIG.createFile, data, {
                params: queryString
            });
        } else {
            return new Promise((resolve, reject) => {
                console.error('not set XMLHttpRequest');
                throw new Error('not set XMLHttpRequest');
            });
        }
    },
    getPCSLink: setServerUrl,
    // 获取可用的 host
    initEndpoint() {
        // 检查sessionStorage中是否有缓存的端点
        let endPoint = sessionStorage.getItem('upload_endpoint') || '';
        if (endPoint) {
            return Promise.resolve(endPoint);
        }
        // 并发处理
        if (isQuerying) {
            return new Promise((resolve) => {
                waitList.push(resolve);
            });
        }

        isQuerying = true;
        return pureXHR(URL_CONFIG.locateUpload).then((data) => {
            // 接口参考
            if (data && data.server != null) {
                return [].concat(data.server, data.host);
            }
            return host; // ["c-jp.terastream.fun", "c-jp.terastream.fun"]
        }).then(hosts => hosts.reduce((promise, host) => {
            // 获取可用的域名
            return promise.then((matchedUrl) => matchedUrl || host).catch(() => {
                return detectConnection(host);
            });
        }, Promise.reject())).then(host => {
            isQuerying = false;
            // 缓存结果
            sessionStorage.setItem('upload_endpoint', endPoint = host);
            // 处理并发请求
            waitList.forEach(resolve => {
                resolve(endPoint);
            });
            return endPoint;
        });
    }
};
