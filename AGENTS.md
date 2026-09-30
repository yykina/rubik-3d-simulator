# Repository Guidelines

## Project Structure & Module Organization

- `src/cube-core.js` — 3×3×3 内核：几何、状态操作、坐标转换、Kociemba 两阶段求解器。
  Node 下导出 CommonJS，浏览器下挂 `window.CubeCore`（UMD）。
- `src/test-core.js` — 测试脚本：几何自检、编码/状态机一致性、求解器随机验证。
- `src/SOLVER-NOTES.md` — **求解器设计与踩坑记录，改求解器前必读。**
- `src/debug/` — 建表/加载/性能工具与历史诊断脚本；表缓存 `solver-tables.bin` 不纳入版本控制。
- `web/` — 三维界面：`index.html`（渲染与交互）、`solver-worker.js`（建表并回传 ArrayBuffer）、
  `solver-table-worker.js`（单表并行构建）、`cube-core.js`（内核副本，改内核后需同步）。
- `tools/` — `serve.js`（静态服务器）、`verify-web.js`（Playwright 端到端验证）、
  `seed-tables.js`（把表缓存注入 IndexedDB）、`verify-solver-core.js`（求解器正确性验证）。
- `STATUS.md` 记录进度、约定与已知限制；`CHANGLOG.md` 记录变更历史。

## Build, Test, and Development Commands

```bash
npm install                          # 仅测试需要（Playwright + Chromium）
npm run serve                        # 静态服务器 http://127.0.0.1:5173
npm test                             # 内核 + 求解器测试（有表缓存时很快）
npm run tables                       # 重新生成剪枝表缓存（约 3 分钟，6.1 MB）
node tools/verify-web.js             # 浏览器端到端验证（含截图，失败返回非零）
SEED_TABLES=1 node tools/verify-web.js   # 注入表缓存，跳过首次构建
node --check src/cube-core.js        # 语法检查
```

首次在浏览器打开页面时会在后台并行构建求解表（约 1~2 分钟，期间界面可玩），
构建完写入 IndexedDB，之后刷新秒级加载。表缓存文件缺失时可先跑 `npm run tables`。

## Coding Style & Naming Conventions

两空格缩进、分号、以单引号为主。函数与局部变量用 `camelCase`，常量表用 `UPPER_SNAKE_CASE`。
内核必须与渲染层解耦，并同时兼容 Node 与浏览器。未配置格式化或 lint 工具。

**务必保持的约定**（详见 `STATUS.md` / `SOLVER-NOTES.md`）：

- `perm[pos]` = 该位置上的原始 cubie 编号；`ori[pos]` = 该 cubie 的旋转矩阵（行主序）。
- `applyTurn` / `applyPack` 必须**先收集赋值再统一写入**，否则就地置换会读到被覆盖的源位置。
- `mul(a, b)` 实际算的是「先 a 再 b」的复合；`compose` 必须由 `mul` 生成，勿手写索引。
- `isSolved()` 等于 `isSolvedByAppearance()`：只看**外观**。已穷举验证：只有 6 个面心块
  各自存在 3 种不可见的朝向冗余，角块与棱块（含 E 层 FR/FL/BL/BR）的任何朝向偏差都可见。
- 任何影响坐标或编码的改动，都必须同步提升剪枝表缓存的版本号（`CBxx`）并重建。

## Testing Guidelines

测试使用本地 `ok` 助手与进程退出码，没有测试框架与覆盖率门槛。
新增回归断言请加在 `src/test-core.js`，覆盖：逆动作互消、`pack/unpack` 往返、
压缩状态机与几何状态机一致性、求解器输出经**独立面片校验**（`misplacedStickers`）确实还原。
端到端验证放在 `tools/verify-web.js`，必须对关键行为断言并在失败时返回非零。

求解器当前仍有限制（见 `STATUS.md`）：两阶段结果可能残留少量错位块，已用有界修复搜索兜底，
且求解结果在返回前**必须**通过外观校验。若修改求解器，请同时运行
`node tools/verify-solver-core.js`，它用独立面片校验而非 `isSolved()`。

## Commit & Pull Request Guidelines

提交信息用简洁的描述性主题（历史上有 `wip:` / `fix:` / `feat:` / `test:` 前缀）。
PR 说明请包含：改变了什么行为、执行了哪些命令、结果如何、遗留限制；并更新 `STATUS.md`
与 `CHANGLOG.md`。
