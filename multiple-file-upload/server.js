const path = require("path");
const Koa = require("koa");
const cors = require("@koa/cors"); // 处理跨域请求的中间件
const serve = require("koa-static"); // 处理静态资源的中间件
const multer = require("@koa/multer"); // 处理 multipart/form-data 的中间件
const Router = require("@koa/router"); // 处理路由的中间件

const app = new Koa();
const router = new Router();
const PORT = 3000;
const RESOURCE_URL = `http://localhost:${PORT}`;
const UPLOAD_DIR = path.join(__dirname, "../public/upload");

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    // 设置文件的存储目录
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // 设置文件名
    console.log(file);
    cb(null, `${file.originalname}`);
  },
});

const multerUpload = multer({ storage });

router.post(
  "/upload/multiple",
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