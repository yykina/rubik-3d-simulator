# 三维魔方模拟器 — 项目状态

> 原则：**只把经过独立验证的东西标为完成**。

## 一句话

单页三维魔方（3×3×3）：Three.js 渲染 + 完整手动玩法（打乱 / 转动 / 撤销 / 计时 / 整体转）
+ **自动求解 / 提示**（基于 cubejs 的 Kociemba 两阶段算法）。

## 进度

| 模块 | 状态 | 依据 |
| --- | --- | --- |
| 几何与转动记号（26 cubie、18 种动作） | ✅ 完成 | `npm test`：逆动作互消、(R U R' U')×6、逆序回放 |
| 转动方向对齐官方表 | ✅ 完成 | `npm test`：六个动作的 cp/ep 与 Kociemba 官方表逐项一致（含多步组合） |
| 还原判定（外观口径） | ✅ 完成 | `isSolved` 与「每面 9 张同色」在 400 个随机状态一致 |
| 朝向编码 / 压缩状态机 | ✅ 完成 | 24 种旋转编码往返；与几何状态机 300 步一致 |
| 三维界面与交互 | ✅ 完成 | `npm run verify` 端到端断言全部通过 |
| 打乱 / 撤销 / 计时 / 步数 | ✅ 完成 | 打乱不计成绩、计时从打乱结束开始、撤销恢复状态 |
| 整体转 X / Y / Z | ✅ 完成 | 改变摆放但不改变还原程度、不计步数 |
| 转动动画 | ✅ 完成 | 动画终点由「该步结束后的姿态」插值得到，必然与逻辑一致 |
| **自动求解 / 提示** | ✅ **可用** | `npm run verify:solver` 20/20 正确；界面端到端真实求解通过 |
| 官方面片编码 `Core.faceletString` | ✅ 完成 | 还原态串与官方一致；U/D/L/R/F/B 六个动作与 cubejs `asString()` 逐字符一致 |

## 求解器

- **实现**：`cubejs` 1.3.2（ldez/cubejs，MIT），收录在 `vendor/cubejs/`；
  浏览器包由 `npm run build:cubejs` 生成（`web/vendor/cubejs/cubejs.browser.js`）。
- **数据流**：内核状态 → `Core.faceletString()` → 官方 54 面片串 →
  `Cube.fromString().solve()` → 动作序列 → `Core.applyMoves` 回放。
- **性能**：建表 `Cube.initSolver()` 约 1.7 秒（页面空闲时自动进行）；求解平均 ~0.1 秒、
  平均解长 ~20 步、最坏 ~0.6 秒。
- **为什么不自研**：自研两阶段在「E 层棱块朝向」上存在坐标歧义，会留下可见错位；
  详见 `src/SOLVER-NOTES.md`（含完整踩坑记录与最终方案）。

## 运行

```bash
npm install                  # 仅测试需要（Playwright + Chromium）
npm run serve                # 打开 http://127.0.0.1:5173/
npm test                     # 内核测试（含官方表回归断言）
npm run verify:solver        # 求解器端到端校验（内核几何独立回放）
npm run verify               # 浏览器端到端验证（含真实求解 + 播放）
npm run build:cubejs         # 重新生成 cubejs 浏览器包（改 vendor 后执行）
```

## 文件

| 路径 | 作用 |
| --- | --- |
| `src/cube-core.js` | 内核：几何 + 状态 + 转动 + 朝向读取 + 官方面片编码（Node/浏览器通用） |
| `src/test-core.js` | 内核测试（含与 Kociemba 官方表比对的防退化断言） |
| `src/SOLVER-NOTES.md` | **求解器踩坑与方案记录，改求解相关代码前必读** |
| `web/index.html` | 界面：渲染、交互、计时、整体转、求解接入 |
| `web/cube-core.js` | 内核副本（改内核后需同步：`cp src/cube-core.js web/`） |
| `web/vendor/cubejs/` | cubejs 源码与其浏览器打包产物 |
| `vendor/cubejs/` | cubejs 原始 CommonJS 源码（npm cubejs@1.3.2） |
| `tools/verify-web.js` | 浏览器端到端验证（含真实求解、播放、独立面片校验） |
| `tools/verify-cubejs.js` | 求解器校验：内核状态 → 求解 → 几何回放，断言 0 错位 |
| `tools/build-cubejs-browser.js` | 生成 cubejs 浏览器包 |
| `tools/serve.js` | 静态服务器（默认 5173） |
| `CODE_REVIEW.md` | 审查报告原文 |

## 关键约定（改动前必读）

- 转动角度必须与 Kociemba 官方 `cp/co/ep/eo` 表一致：
  `['U',1,1,90], ['D',1,-1,-90], ['R',0,1,90], ['L',0,-1,-90], ['F',2,1,90], ['B',2,-1,-90]`。
  `npm test` 的 [1b] 段会逐项比对官方表——**这是唯一能挡住「整体取逆」这类退化的检查**，
  自洽性测试（逆动作互消等）在该情形下依然成立，不能替代它。
- `applyTurn` / `applyPack` 必须先收集赋值再统一写入，否则就地置换读到被覆盖的源位置。
- `mul(a, b)` 实际算的是「先 a 再 b」的复合；`compose` 必须由 `mul` 生成，勿手写索引。
- 内核矩阵为**行主序**；交给 `THREE.Matrix4.set` 时**不要转置**（审查第 2 项的 bug 就在此）。
- `isSolved()` = `isSolvedByAppearance()`：只看外观。已穷举验证：只有 6 个面心块
  各自存在 3 种不可见朝向冗余。
- `Core.faceletString()` 是**与外部求解器对接的唯一通道**：改动后必须同时跑
  `npm test`、`npm run verify:solver`、`npm run verify`。
- **逻辑状态只提交一次**：`perform()` 里不要动 `state`，提交统一由动画结算函数负责；
  打断操作（`cancelPending`）必须先把进行中的动画结算掉，否则 Promise 永不 resolve。
- 改内核后要同步 `web/cube-core.js`。

## 后续可做

1. 触屏双指旋转视角。
2. 求解进度反馈（当前求解 ~0.1 秒，通常无需；极少数状态可能到 0.6 秒）。
3. 渲染端补一条自动化断言（例如截图颜色直方图），避免再次出现矩阵转置这类问题。
4. 若要减小首屏负担，可把 `Cube.initSolver()` 挪进 Web Worker（目前 1.7 秒同步计算
   已放在空闲时执行，实测不阻塞交互）。
