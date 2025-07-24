## file 对象上的参数及含义

```typescript
const FILE_STATUS_PENDING = -1; // 等待上传
const FILE_STATUS_UPLOADING = -2; // 上传中
const FILE_STATUS_ERROR = -3; // 上传失败
const FILE_STATUS_COMPLETE = -4; // 上传完成
const FILE_STATUS_PAUSING = -5; // 暂停中
{
    status: FILE_STATUS_PENDING | FILE_STATUS_UPLOADING | FILE_STATUS_ERROR | FILE_STATUS_COMPLETE | FILE_STATUS_PAUSING, // 默认为 FILE_STATUS_PENDING
    index: number, // 文件在 filequeue 队列的位置
    path: string, // 文件保存路径
    cMD5: md5, // 文件的 md5
    sMD5: md5, // 文件前 256k 的 md5
    fs_id: undefined | string, // 接口返回的 fs_id 
    uploadId:  undefined | string, // 接口返回的 uploadid
    terminate: boolean, // 是否停止上传
    uploadedSize: undefined | number,// 默认为 undefined, 文件已上传的 size
    progressInterval: number, // 对应 setInterval 的 timer,用以在文件上传完成时清除定时器, 定时器作用: 每 800ms 报一次进度, 若该文件上传完成则进行下一个文件的上传
    completeChunks: undefined | number, // 默认为 undefined, 记录文件已经上传成功的 chunk 的数量
    blockList: md5[] | []; // 默认为 [], 保存已经上传成功的 chunk 的 md5
    creating: boolean; // 默认为 false, 是否正在调用 carete 接口
    md5: string // create 接口返回的 md5 值, 暂无用途
}
```

```mermaid
graph TB;
    A[Uploader] --- B[constructor]
    B[constructor] --- init[初始化变量] --获取 pcsEndpoint 域名--> getEndPoint
    
    A --- append --- ap[将文件添加到文件队列]
    ap --> ap1{文件是否为空或禁止上传}
    ap1 --是--> End1(结束)
    ap1 --否--> ap2[参数归一化,将 file 参数统一成数组] --> ap3["`遍历文件
        为文件添加index和path属性
        处理 status 状态`"]
    ap3 --> ap4[将文件添加文件队列]
    ap4 --> ap5[将 index 添加到 fileIndexList] --> ap6{是否自动上传} --是--> upload
    ap6 --否--> End2(结束)

    upload --- up[上传流程]
    up --> up1{pcsEndpoint 是否存在}
    up1 --否--> End3(结束)
    up1 --是--> up2{上传文件数是否超过 uploadLimit 限制} --是--> End4(结束)
    up2 --否--> up3{是否上传指定文件}  --是--> up4[上传指定文件] --> up5{文件是否存在} --否--> End5(结束)
    up5 --是--> handleFileData
    up3 --否--> up6[根据 uploadIndex 从 filequeue 中取出文件] --> up7{文件是否存在} --是--> up8{文件是否完成上传}
    up8 --是,uploadIndex+1--> upload
    up8 --否--> up9{文件上传状态是否为待上传或上传失败} --是--> up10["`文件上传状态修为正在上传
        uploadIndex+1`"] --> handleFileData
    up9 --否,文件处于暂停上传状态 uploadIndex+1--> upload2["this.upload()"]

    handleFileData --uploadingCount++--> preCreate --"`调用 /api/precreate 接口
        为文件添加 uploadId`"--> rapidUpload --> createFile
    rapidUpload --- ra1{文件size < 256k?} --是--> rt(return)
    ra1 --否--> ra2["`计算文件md5
    计算文件前256k数据md5
    每个chunkmd5`"] --> ra3[调用秒传接口] --> ra4{调用接口成功?} --是--> upload3["`文件状态更改为上传完成
    uploadingCount--
    this.upload()`"]
    ra4 --否--> rt2(return)

    createFile --- cr1{文件状态为上传完成?} --是--> cr2[return]
    cr1 --否--> invoke --> commit
    
    invoke --> in1[文件状态为暂停上传?] --是--> in2(结束)
    in1 --否--> in3[800ms报一次进度] --- in4{自动上传?} --是--> upload4[upload]
    in3 --> in5[存在上传失败的分片?] --是--> sendChunks[续传] --> in6[return]
    in5 --否--> in7[从第一个分片开始上传]
```