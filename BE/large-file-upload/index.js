const fs = require("fs");
const path = require("path");
const util = require("util");
const Koa = require("koa");
const cors = require("@koa/cors");
const multer = require("@koa/multer");
const Router = require("@koa/router");
const serve = require("koa-static");
const fse = require("fs-extra");
const CONSTANT = require("../../utils/constant")

const readdir = util.promisify(fs.readdir); // fs.readdir 读取指定目录下的所有文件和子目录的名称
const unlink = util.promisify(fs.unlink); // fs.unlink 用于删除文件

const app = new Koa();
const router = new Router();
const TMP_DIR = path.join(__dirname, "tmp"); // 临时目录
const UPLOAD_DIR = path.join(__dirname, CONSTANT.UPLOAD_PATH);
const IGNORES = [".DS_Store"]; // 忽略的文件列表

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    let fileMd5 = file.originalname.split("-")[0];
    const fileDir = path.join(TMP_DIR, fileMd5);
    await fse.ensureDir(fileDir);
    cb(null, fileDir);
  },
  filename: function (req, file, cb) {
    let chunkIndex = file.originalname.split("-")[1];
    cb(null, `${chunkIndex}`);
  },
});

const multerUpload = multer({ storage });

// 判断文件是否已存在
router.get("/upload/exists", async (ctx) => {
  const { name: fileName, md5: fileMd5 } = ctx.query;
  const filePath = path.join(UPLOAD_DIR, fileName);
  const isExists = await fse.pathExists(filePath);
  if (isExists) {
    ctx.body = {
      status: "success",
      data: {
        isExists: true,
        url: `http://localhost:3000/${fileName}`,
      },
    };
  } else {
    // 确认是否存在已经上传的块，并返回已经存在的块的 id
    let chunkIds = [];
    const chunksPath = path.join(TMP_DIR, fileMd5);
    const hasChunksPath = await fse.pathExists(chunksPath);
    if (hasChunksPath) {
      let files = await readdir(chunksPath);
      chunkIds = files.filter((file) => {
        return IGNORES.indexOf(file) === -1;
      });
    }
    ctx.body = {
      status: "success",
      data: {
        isExists: false,
        chunkIds,
      },
    };
  }
});

router.post(
  "/upload/single",
  multerUpload.single("file"),
  async (ctx, next) => {
    ctx.body = {
      code: 1,
      data: ctx.file,
    };
  }
);

router.get("/upload/concatFiles", async (ctx) => {
  const { name: fileName, md5: fileMd5 } = ctx.query;
  await concatFiles(
    path.join(TMP_DIR, fileMd5),
    path.join(UPLOAD_DIR, fileName)
  );
  ctx.body = {
    status: "success",
    data: {
      url: `http://localhost:3000/${fileName}`,
    },
  };
});

// 拼接文件
async function concatFiles(sourceDir, targetPath) {
  // 封装读流与写流的函数
  const readFile = (file, ws) =>
    new Promise((resolve, reject) => {
      fs.createReadStream(file)
        .on("data", (data) => ws.write(data))
        .on("end", resolve)
        .on("error", reject);
    });
  const files = await readdir(sourceDir);
  console.log(files)

  const sortedFiles = files
    .filter((file) => {
      return IGNORES.indexOf(file) === -1;
    })
    .sort((a, b) => a - b);
  const writeStream = fs.createWriteStream(targetPath);
  // 开始读流与写流
  for (const file of sortedFiles) {
    let filePath = path.join(sourceDir, file);
    await readFile(filePath, writeStream);
    await unlink(filePath); // 删除已合并的分块
  }
  writeStream.end(); // 结束写流
}

// 注册中间件
app.use(cors());
app.use(serve(UPLOAD_DIR));
app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => {
  console.log("app starting at port 3000");
});