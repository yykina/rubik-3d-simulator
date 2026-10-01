# Repository Guidelines

## Project Structure & Module Organization

- `src/cube-core.js` — 3×3×3 内核：几何、状态操作、朝向读取、官方面片编码。
  Node 下导出 CommonJS，浏览器下挂 `window.CubeCore`（UMD）。
  （自研剪枝表求解器已移除；求解由 cubejs 承担，内核只负责状态与面片编码。）
- `src/test-core.js` — 测试脚本：几何自检、与 Kociemba 官方表的回归断言、编码/状态机一致性。
- `src/SOLVER-NOTES.md` — **求解器设计与踩坑记录，改求解器前必读。**
- `vendor/cubejs/` — 求解器 cubejs 1.3.2（ldez/cubejs，MIT）原始 CommonJS 源码。
- `web/` — 三维界面：`index.html`（渲染与交互）、`cube-core.js`（内核副本，改内核后需同步）、
  `vendor/cubejs/cubejs.browser.js`（由 `tools/build-cubejs-browser.js` 生成的浏览器包，挂 `window.Cube`）。
- `tools/` — `serve.js`（静态服务器）、`verify-web.js`（Playwright 端到端验证，含真实求解）、
  `verify-cubejs.js`（求解器校验：内核状态→求解→几何回放）、
  `build-cubejs-browser.js`（生成 cubejs 浏览器包）。
- `STATUS.md` 记录进度、约定与已知限制；`CHANGLOG.md` 记录变更历史。

## Build, Test, and Development Commands

```bash
npm install                          # 仅测试需要（Playwright + Chromium）
npm run serve                        # 静态服务器 http://127.0.0.1:5173
npm test                             # 内核测试（含与 Kociemba 官方表比对的回归断言）
npm run verify:solver                # 求解器校验（内核几何独立回放，要求 0 错位）
npm run verify                       # 浏览器端到端验证（含真实求解 + 播放）
npm run build:cubejs                 # 重新生成 cubejs 浏览器包（改 vendor/cubejs 后执行）
node --check src/cube-core.js        # 语法检查
```

首次打开页面时求解器会在空闲时初始化（`Cube.initSolver()`，约 1.7 秒），
期间界面完全可玩；就绪后「提示 / 自动求解」按钮自动启用。

## Coding Style & Naming Conventions

两空格缩进、分号、以单引号为主。函数与局部变量用 `camelCase`，常量表用 `UPPER_SNAKE_CASE`。
内核必须与渲染层解耦，并同时兼容 Node 与浏览器。未配置格式化或 lint 工具。

**务必保持的约定**（详见 `STATUS.md` / `SOLVER-NOTES.md`）：

- `perm[pos]` = 该位置上的原始 cubie 编号；`ori[pos]` = 该 cubie 的旋转矩阵（行主序）。
- `applyTurn` / `applyPack` 必须**先收集赋值再统一写入**，否则就地置换会读到被覆盖的源位置。
- `mul(a, b)` 实际算的是「先 a 再 b」的复合；`compose` 必须由 `mul` 生成，勿手写索引。
- `isSolved()` 等于 `isSolvedByAppearance()`：只看**外观**。已穷举验证：只有 6 个面心块
  各自存在 3 种不可见的朝向冗余，角块与棱块（含 E 层 FR/FL/BL/BR）的任何朝向偏差都可见。
- **转动角度必须与 Kociemba 官方表一致**，`src/test-core.js` 的 [1b] 段逐项比对；
  自洽性测试（逆动作互消等）无法发现「整体取逆」，不能替代它。
- `Core.faceletString()` 是与外部求解器对接的**唯一通道**，改动后必须跑
  `npm test`、`npm run verify:solver`、`npm run verify` 三项。
- **逻辑状态只提交一次**：`perform()` 不要动 `state`；打断操作必须先结算进行中的动画，
  否则 `await performAsync` 的 Promise 永不 resolve。

## Testing Guidelines

测试使用本地 `ok` 助手与进程退出码，没有测试框架与覆盖率门槛。
新增回归断言请加在 `src/test-core.js`，覆盖：逆动作互消、`pack/unpack` 往返、
压缩状态机与几何状态机一致性、求解器输出经**独立面片校验**（`misplacedStickers`）确实还原。
端到端验证放在 `tools/verify-web.js`，必须对关键行为断言并在失败时返回非零。

求解器已改用 cubejs（见 `STATUS.md` / `SOLVER-NOTES.md`）。任何求解相关改动都必须运行
`npm run verify:solver`——它用**独立面片校验**（`misplacedStickers`）而非 `isSolved()` 判定。

## Commit & Pull Request Guidelines

提交信息用简洁的描述性主题（历史上有 `wip:` / `fix:` / `feat:` / `test:` 前缀）。
PR 说明请包含：改变了什么行为、执行了哪些命令、结果如何、遗留限制；并更新 `STATUS.md`
与 `CHANGLOG.md`。
