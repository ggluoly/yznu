# 长江师范学院 2017届优秀毕业生周年纪念展示页

面向长江师范学院 2017 届优秀毕业生的周年静态纪念专题页。页面通过当前站点的网络响应时间自动计算毕业年限，展示优秀毕业生风采、成长主题和致敬寄语；不包含聚会、返校或报名等活动功能。

## 页面内容

- 官网风格顶部：本地校名图、校训图和专题页导航。
- 周年首屏：根据当前自然年份动态展示毕业年限和纪念主题。
- 优秀毕业生名录：当前为展示占位，后续替换为经确认的真实资料。
- 周年回望：以启程、成长、初心、致敬组织纪念叙事。
- 致敬寄语：作为页面收束内容。
- 响应式布局：桌面端三列名录，平板端双列，移动端单列。

## 技术栈

- Vite
- TypeScript
- 原生 HTML 模板与 CSS
- Notion API（可选，构建时同步）

核心纪念展示页不依赖前端框架或运行时接口，可作为静态文件部署。优秀学生数据的 Notion Token 仅在 GitHub Actions 构建阶段使用；可选访问记录功能通过独立 Cloudflare Worker 运行，两个 Notion Token 都不会进入浏览器或 GitHub Pages 构建产物。

## 目录说明

```text
yznu/
├─ public/
│  ├─ yznu-logo.png       # 学校校名与校徽图
│  ├─ yznu-xx.png         # 学校校训图
│  └─ yznu-favicon.ico    # 浏览器图标
├─ scripts/
│  └─ sync-notion.mjs     # Notion 数据和授权照片同步脚本
├─ src/
│  ├─ data/
│  │  └─ graduates.json   # 默认数据或 Notion 同步结果
│  ├─ main.ts             # 页面结构、展示数据与导航状态
│  └─ style.css           # 页面样式与响应式规则
├─ .env.example           # 本地 Notion 配置示例
├─ index.html             # 页面元信息与入口
├─ vite.config.ts         # Vite 相对资源路径配置
└─ package.json           # 开发和构建脚本
```

## 本地开发

安装依赖：

```powershell
npm install
```

启动开发服务器：

```powershell
npm run dev
```

执行生产构建：

```powershell
npm run build
```

构建完成后，可使用以下命令预览 `dist/`：

```powershell
npm run preview
```

## 内容维护

优秀毕业生数据位于 `src/data/graduates.json`。每一项包含以下字段：

```ts
{
  number: '01',
  name: '姓名',
  department: '学院 / 专业',
  honor: '荣誉称号',
  message: '个人寄语或纪念文案',
  photo: 'graduates/01.webp',
  photoAlt: '姓名纪念照片',
}
```

当前所有姓名、院系、荣誉和寄语均为展示占位，不可作为正式发布内容。

接入真实照片时，建议：

- 使用经本人授权的照片和寄语。
- 使用裁剪后的 WebP、AVIF 或压缩 JPG，避免直接上传原始大图。
- 为人物照片提供准确的替代文本。
- 核验姓名、院系、专业、荣誉称号及数据来源。

## Notion 数据同步

### 数据源字段

Notion 数据源需要使用以下字段名称和类型：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| 姓名 | Title | 是 | 页面展示姓名 |
| 排序 | Number | 否 | 数字越小越靠前 |
| 学院 | Rich text、Select | 否 | 所属学院 |
| 专业 | Rich text、Select | 否 | 专业名称 |
| 荣誉称号 | Rich text、Select | 是 | 正式荣誉名称 |
| 寄语 | Rich text | 是 | 个人寄语或纪念文案 |
| 照片 | Files | 否 | 第一张图片作为人物照片 |
| 发布状态 | Checkbox、Status、Select | 是 | 勾选或填写“已发布”才会同步 |
| 肖像授权 | Checkbox | 否 | 只有勾选后才会下载并展示照片 |

同步脚本只输出公开展示字段，不会将其他 Notion 属性写入页面。照片会在构建时下载到 `public/graduates/`，仅支持 HTTPS 的 JPG、PNG、WebP 和 AVIF，单张文件上限为 5 MiB。

### GitHub 配置

1. 在 Notion 创建 Internal Integration，并为其授予读取内容权限。
2. 将优秀毕业生数据源共享给该 Integration。
3. 在 GitHub 仓库进入 `Settings → Secrets and variables → Actions`。
4. 在 `Secrets` 中新增 `NOTION_TOKEN`，值为 Notion Integration Token。
5. 在 `Variables` 中新增 `NOTION_DATA_SOURCE_ID`，值为数据源 ID。
6. 进入 `Actions → Deploy GitHub Pages`，点击 `Run workflow` 重新同步并发布。

工作流行为：

- 两项配置都不存在：跳过 Notion，同步使用仓库中的默认数据。
- 两项配置都存在：从 Notion 同步已发布记录后构建页面。
- 只配置其中一项：构建失败，避免错误配置被静默忽略。
- Notion API、字段校验或照片下载失败：构建失败，保留上一版 GitHub Pages。

### 本地同步

复制 `.env.example` 为 `.env`，填写：

```text
NOTION_TOKEN=replace_with_your_integration_token
NOTION_DATA_SOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

执行同步：

```powershell
npm run sync:notion
```

如果希望未配置 Notion 时直接使用默认数据：

```powershell
npm run sync:notion:optional
```

`.env` 和同步下载的 `public/graduates/` 已被 `.gitignore` 排除，Token 和临时签名图片地址不会提交到 Git。

## 访问记录

页面支持在每次完整加载时记录一条访问事件：首次打开和刷新会分别记录；浏览器从历史缓存恢复时会记录；页面内锚点跳转不会重复记录。统计接口未配置时，页面不会发送访问数据。

### 数据范围与保留

访问记录会写入 Notion 的“访问记录”数据源（Data Source ID：`8f58fd9d-240e-431c-a82c-86a24245ba75`），包含：

- Worker 服务端访问时间。
- Cloudflare `CF-Connecting-IP` 真实客户端 IP 地址。
- 页面路径、来源域名、设备类型、浏览器语言、时区和 Cloudflare 国家/地区代码。

页面不记录完整来源 URL、查询参数、精确位置或用户主动身份信息。Worker 默认在 Notion 中标记 90 天后的“数据保留截止日”；该字段是清理提醒，不会自动删除数据。管理员必须按学校数据合规制度定期删除或脱敏到期记录。

### 部署 Cloudflare Worker

Worker 位于 `worker/`，与 GitHub Pages 站点独立部署。先在 Cloudflare 账户中创建两个 Queue：

```powershell
cd worker
npm install
npx wrangler login
npx wrangler queues create yznu-visit-events
npx wrangler queues create yznu-visit-events-dlq
```

仓库不固定站点域名或 Worker 域名。复制 `worker/.dev.vars.example` 为 `worker/.dev.vars`，用于本地调试；该文件已被 Git 忽略。部署前配置 Worker Secret：

```powershell
npx wrangler secret put NOTION_VISITOR_TOKEN
npx wrangler secret put NOTION_VISITOR_DATA_SOURCE_ID
npx wrangler deploy
```

其中：

- `NOTION_VISITOR_TOKEN` 使用专门的写入型 Notion Integration Token。
- `NOTION_VISITOR_DATA_SOURCE_ID` 填写 `8f58fd9d-240e-431c-a82c-86a24245ba75`。
- 将“访问记录”数据表共享给该 Integration，且不要共享“优秀学生”表。

部署 Worker 后，在 Cloudflare Dashboard 配置运行变量：

```text
Workers & Pages
→ yznu-visitor-recorder
→ Settings
→ Variables and Secrets
→ Add variable
```

新增：

```text
名称：ALLOWED_ORIGIN
值：https://站点自定义域名
```

只填写协议和域名，不带末尾斜线、路径或查询参数。需要在域名迁移期间同时允许多个来源时，可用英文逗号分隔：

```text
https://graduates.example.edu.cn,https://old.example.edu.cn
```

未配置 `ALLOWED_ORIGIN` 时，Worker 会返回 `503`，不会接受访问记录。

`worker/wrangler.jsonc` 已设置 `keep_vars: true`，后续执行 `wrangler deploy` 时会保留通过 Cloudflare Dashboard 设置的 `ALLOWED_ORIGIN`。Notion Token 使用 Secret 存储，也不会被部署删除。

### 自定义域名配置

项目支持站点和 Worker 都通过控制台配置自定义域名，后续更换域名无需修改源码。

#### 站点域名

在 GitHub 仓库设置：

```text
Settings → Pages → Custom domain
```

填写站点完整域名，例如：

```text
graduates.example.edu.cn
```

并在 DNS 服务商创建指向 GitHub Pages 的记录。对于子域名，通常使用：

```text
类型：CNAME
名称：graduates
目标：GitHub用户名.github.io
```

等待 GitHub 完成域名检查后启用 `Enforce HTTPS`。当前 Vite 使用相对资源路径，不需要因站点域名变化修改 `vite.config.ts`。

#### Worker API 域名

在 Cloudflare Dashboard 设置：

```text
Workers & Pages
→ yznu-visitor-recorder
→ Settings
→ Domains & Routes
→ Add → Custom Domain
```

填写 Worker 自定义域名，例如：

```text
visitor-api.example.edu.cn
```

该域名必须属于当前 Cloudflare 账户管理的 Zone。Cloudflare 会管理对应 DNS 和 HTTPS 证书。仓库中的 `wrangler.jsonc` 不固定 `routes`，因此域名可完全通过 Dashboard 添加、更换或删除。

自定义 Worker API 完整地址为：

```text
https://visitor-api.example.edu.cn/api/visit
```

在 GitHub 仓库 `Settings → Secrets and variables → Actions → Variables` 新建：

```text
VISITOR_API_URL=https://visitor-api.example.edu.cn/api/visit
```

随后重新运行 GitHub Actions 的 `Deploy GitHub Pages`，构建时会将该公开 API 地址写入前端。此变量只包含 Worker URL，绝不能填入 Notion Token。

以后更换域名时只需同步修改：

1. GitHub Pages 的 `Custom domain` 和对应 DNS。
2. Cloudflare Worker 的 `Custom Domain`。
3. Cloudflare Worker 变量 `ALLOWED_ORIGIN`。
4. GitHub Actions Variable `VISITOR_API_URL`。

源码、`vite.config.ts`、`wrangler.jsonc` 和 GitHub Actions 工作流均无需修改。

### 防护策略

- Worker 仅接受 `ALLOWED_ORIGIN` 声明的来源。
- 仅接受 `POST /api/visit`，请求体最大 2 KiB。
- 常见机器人 User-Agent 不写入记录。
- 按真实 IP 限制为每分钟最多 60 次请求，IP 仅用于限流和写入访问记录。
- 使用 Cloudflare Queue 异步写入 Notion；Notion 返回 `429` 或 `5xx` 时会重试，连续失败后进入死信队列。
- 访问统计失败不会影响纪念页面正常显示。

Worker 本地检查和测试：

```powershell
cd worker
npm run check
npm test
```

## 部署说明

`vite.config.ts` 设置 `base: './'`，构建后的 JS、CSS、favicon 和本地图片均使用相对路径。因此可将 `dist/` 内全部文件部署至学校网站的任意专题子目录，例如：

```text
https://www.yznu.edu.cn/special/2017-graduates/
```

部署时应上传 `dist/` 中的全部文件及目录，不要只上传 `index.html`。

## 发布前检查

- 执行 `npm run build`，确保 TypeScript 检查和生产构建通过。
- 在实际部署子目录检查校名图、校训图、favicon、CSS 和 JS 是否正常加载。
- 在桌面端、平板和移动端检查顶部导航、锚点跳转和名录布局。
- 使用键盘 Tab 检查导航焦点和“跳到主要内容”链接。
- 确认所有优秀毕业生资料、照片和寄语已经获得审核与授权。
- 配置访问记录前，确认学校对真实 IP 的告知、访问控制、保留期限和删除流程要求。
