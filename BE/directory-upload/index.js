const path = require("path");
const Koa = require("koa");
const cors = require("@koa/cors"); // 处理跨域请求的中间件
const serve = require("koa-static"); // 处理静态资源的中间件
const multer = require("@koa/multer"); // 处理 multipart/form-data 的中间件
const Router = require("@koa/router"); // 处理路由的中间件
const fse = require("fs-extra");
const CONSTANT = require("../../utils/constant")

const app = new Koa();
const router = new Router();
const PORT = 3000;
const RESOURCE_URL = `http://localhost:${PORT}`;
const UPLOAD_DIR = path.join(__dirname, CONSTANT.UPLOAD_PATH);

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    // images@image-1.jpeg => images/image-1.jpeg
    let relativePath = file.originalname.replace(/@/g, path.sep);
    let index = relativePath.lastIndexOf(path.sep);
    let fileDir = path.join(UPLOAD_DIR, relativePath.slice(0, index));
    // 确保文件目录存在，若不存在的话，会自动创建
    await fse.ensureDir(fileDir); 
    cb(null, fileDir);
  },
  filename: function (req, file, cb) {
    let parts = file.originalname.split("@");
    cb(null, `${parts[parts.length - 1]}`); 
  },
});

const multerUpload = multer({ storage });

router.post(
  "/upload/directory",
  async (ctx, next) => {
    try {
      await next();
      urls = ctx.files.file.map(file => `${RESOURCE_URL}/${file.originalname}`);
      ctx.body = {
        code: 0,
        msg: "文件上传成功",
        urls
      };
    } catch (error) {
      ctx.body = {
        code: 1,
        msg: "文件上传失败",
      };
    }
  },
  multerUpload.fields([
    {
      name: "file", // 与FormData表单项的fieldName想对应
    },
  ])
);


// 注册中间件
app.use(cors());
app.use(serve(UPLOAD_DIR));
app.use(router.routes()).use(router.allowedMethods());

app.listen(PORT, () => {
  console.log(`应用已经启动：http://localhost:${PORT}/`);
});