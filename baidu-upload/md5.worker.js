importScripts('https://cdn.jsdelivr.net/npm/spark-md5@3.0.2/spark-md5.min.js');

let spark = new SparkMD5.ArrayBuffer();

self.onmessage = function (event) {
    if (event.data === 'dataEnd') {
        let md5 = spark.end();
        postMessage(md5);
    } else {
        spark.append(event.data);
    }
};

