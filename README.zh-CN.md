# BenchAtlas

**以来源证据为基础，系统整理 AI Benchmark、模型公开报分、评测设置与能力覆盖。**

[English](README.md) | [简体中文](README.zh-CN.md)

[打开 BenchAtlas 中文站](https://benchatlas.cn/zh/) · [英文站](https://benchatlas.cn/) · [模型整体排名](https://benchatlas.cn/zh/ranking/) · [报告数据问题](https://github.com/LIXINGHANG/benchatlas/issues/new?template=data-correction.yml)

![BenchAtlas 界面预览](social-preview.png)

BenchAtlas 将模型厂商发布的 Model Card、System Card、发布网页和技术报告转换成可搜索的 Benchmark 数据集。在报告提供相关信息的情况下，每条分数都会保留原始来源、证据位置、模型配置、评测设置和运行说明。

BenchAtlas 的目标不是再做一个缺少上下文的排行榜，而是帮助读者理解：**测了什么、在什么条件下测的、由谁报告，以及两条分数是否真的可以直接比较。**

## BenchAtlas 解决什么问题

1. 每个模型的官方报告中出现了哪些 Benchmark？
2. 每个基础模型和配置报告了什么分数？
3. 使用了什么 Harness、工具、推理模式、上下文长度、采样参数、裁判模型、任务子集和运行次数？
4. 哪些结果采用了足够接近的评测设置，可以直接横向比较？
5. 一个模型在不同领域的最佳公开能力覆盖是什么样的？

## 当前数据规模

| 数据 | 当前快照 |
| --- | ---: |
| 公开报分记录 | 1,681 |
| 基础模型 | 32 |
| 报告实体与配置 | 58 |
| 保留的原始模型名称 | 65 |
| 归一化 Benchmark 页面 | 401 |
| 来源报告 | 11 |
| 评测配置记录 | 386 |
| 有共享设置记录的报分 | 695 |
| 来源限定报分 | 986 |

随着新官方报告被导入，以上数字会继续变化。请以[线上网站](https://benchatlas.cn/zh/)显示的数据为准。

## 核心功能

### Benchmark 地图

- 在七个稳定的一级能力领域中探索 Benchmark。
- 在包含“安全与对齐”的七个能力领域间切换，或按基础模型筛选地图。
- 搜索 Benchmark 或模型，并打开来源证据面板。
- 通过语义缩放逐步展示更多 Benchmark：领域层最多显示 49 个，详情层 63 个，深度层 70 个。
- 地图位置具有数据含义：覆盖更广、资料更完整的 Benchmark 更靠近领域中心；较新、专业或小众的 Benchmark 更靠外围。

### Benchmark 报分比较

- 在一个页面统一查看某个 Benchmark 的基础模型公开报分。
- 使用**可比组 A/B/...**的颜色识别可以直接比较的评测设置。
- 跨可比组的分数仍然展示，但不会假装不同设置完全等价。
- 当同一模型在同一 Benchmark 上存在多个来源报分时，可以切换查看每条原始记录。

### 来源证据与运行说明

- 每条结果都可以打开对应的报告或发布网页。
- 尽可能保留表格、图片、页码、行号或章节位置。
- 将运行说明拆分为：评测设置、推理配置、Agent/工具框架、数据集变体、运行次数与聚合方式、来源限制。

### 模型页与整体排名

- 在模型页查看该模型的 Benchmark 覆盖、公开配置、来源报告和原始分数。
- 在地图中筛选一个模型，查看它在哪些领域报过分、哪些 Benchmark 尚未报分。
- 查看“**公开能力上限**”，使用每个基础模型公开报告中的最佳合格配置进行汇总。
- 将 Agent 系统、Checkpoint 和 Baseline 与基础模型实体分开，避免它们错误进入模型排名。

### 数据目录与矩阵

- 从地图切换到密集的数据目录进行查找。
- 在 Benchmark × 模型矩阵中选择并比较模型。
- 矩阵颜色用于辅助观察公开数值，不代表跨可比组结果一定严格可比。

## 如何使用网站

1. 从 [Benchmark 地图](https://benchatlas.cn/zh/)开始。
2. 在顶部选择能力领域或模型。
3. 放大一个领域，查看覆盖较少或更专业的 Benchmark。
4. 点击 Benchmark 节点，打开统一报分排名。
5. 优先比较颜色相同的**可比组**记录。
6. 点击具体报分，检查来源、模型配置、结构化运行说明和证据位置。
7. 在研究、采购或模型评测中引用分数前，打开并核对原始来源。

## 什么是可比组

可比组不是正式的 Benchmark 行业标准，也不等同于“分数来源”。它是 BenchAtlas 对一组报分记录的用户界面表达：这些记录公开的评测设置足够接近，可以进行直接比较。

在信息可用时，分组会考虑：

- Benchmark 版本、任务子集和指标；
- 分数方向与聚合方式；
- Agent Harness、工具与外部访问权限；
- 上下文长度、超时和计算环境；
- 采样参数与推理配置；
- 裁判模型或评分流程；
- 运行次数与任务修正；
- 来源报告中特有的方法说明。

有明确共享设置的记录可以进入同一可比组。方法信息不足的记录会保持“来源限定”。不同颜色代表不同可比组，只有同色记录适合直接比较。

## 公开能力上限排名

整体排名表达的是模型的**最佳公开能力上限**，而不是默认产品体验、API 延迟、调用成本或绝对智能水平。

1. 每个 Benchmark 选择满足跨厂商覆盖要求的合格可比组。
2. 在组内将模型名次转换成 0–100 的百分位分数。
3. 先在能力领域内汇总各 Benchmark 百分位。
4. 不同领域使用相同权重，避免报分较多的领域主导结果。
5. 覆盖较少的模型向 50 收缩，并同时展示置信度。
6. Agent 系统、Checkpoint、Baseline 等非基础模型实体不会参与排名。
7. 每个模型可以使用最佳合格公开配置，因此该排名更接近上限，而不是默认设置。

由于数据来自厂商公开报告，整体排名仍可能受到 Benchmark 选择偏差和选择性报分影响。做出重要判断前应检查底层报分记录。

## 地图领域分类

BenchAtlas 将报告中的原始领域标签映射到七个一级能力区域：

1. 推理与知识
2. 编程与软件工程
3. 智能体与计算机操作
4. 多模态与感知
5. 语言与长上下文
6. 专业与前沿领域
7. 安全与对齐

“安全与对齐”是与其他六类互斥的一级能力领域。安全 Benchmark 会继续细分为有害内容、越狱鲁棒性、Agent 控制、滥用与前沿风险、公平偏见与隐私、健康福祉、监督监控与对齐之一。报告原始领域标签仍保留在数据和证据页面中。

在每个领域内：

- 方向表示数学、软件工程、终端系统、工具、长上下文、医疗等二级领域；
- 距离中心的位置由模型覆盖（60%）、来源覆盖（25%）和方法说明信号（15%）共同决定；
- 语义缩放会让每个领域依次显示 7、9、10 个 Benchmark 家族；
- 红色实线连接同一 Benchmark 家族的不同变体；
- 蓝色虚线连接报分模型覆盖高度重合的地图节点。

## 数据原则

- 保留官方公开数值，不在没有说明的情况下重新计算。
- 不同报告出现冲突分数时保留多条来源记录。
- 保留模型配置，同时将其映射到稳定的基础模型实体。
- 将基础模型与 Agent 系统、Checkpoint、Baseline 分开。
- 当数据集、指标、Harness 或任务子集存在实质差异时，保留独立的 Benchmark 变体。
- 尽可能让每条导入记录关联来源报告和证据位置。
- 方法信息不完整时标记为来源限定，而不是强行判定可比。

公开的归一化规则位于 [`data/normalization_rules.json`](data/normalization_rules.json)。Benchmark 领域分类使用独立的权威数据源 [`data/benchmark_taxonomy.json`](data/benchmark_taxonomy.json)，其中定义七个能力领域、二级领域、评测目的、七个“安全与对齐”子类、Benchmark 人工覆盖项、分类置信度和地图家族合并规则。数据构建会先解析 taxonomy，再生成前端数据；浏览器不再自行推断 Benchmark 分类。

## 参与贡献

最有价值的贡献包括：

- 提交新发布的官方 Model Card 或技术报告；
- 修正分数、模型名称、Benchmark 名称、指标或证据位置；
- 补充缺失的评测设置和运行说明；
- 改进模型与 Benchmark 归一化规则；
- 改进数据提取、Review、验证和前端流程。

请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，然后提交 Issue 或 Pull Request。数据修正应引用官方报告中的页面、表格、图片、脚注或方法章节。

## 本地运行

BenchAtlas 是静态网站，不依赖前端构建框架。

```bash
python3 -m http.server 4173
```

打开 `http://127.0.0.1:4173/`。

更新数据包后，可重新生成拆分数据和可索引页面：

```bash
node scripts/generate-seo-pages.js
```

检查基础模型、配置和参考实体是否正确分层：

```bash
node scripts/validate-model-entities.js
node scripts/validate-benchmark-taxonomy.js
```

## 仓库结构

| 路径 | 用途 |
| --- | --- |
| `index.html`, `zh/index.html` | 英文与中文 Benchmark 地图应用 |
| `spatial-app.js` | 地图、筛选、可比组、详情面板、矩阵和排名逻辑 |
| `site_data.bundle.js` | 完整的归一化 Benchmark 数据集 |
| `site_data.index.bundle.js` | 首页使用的紧凑数据目录 |
| `data/benchmarks/` | 按需加载的 Benchmark 报分与证据 |
| `data/pages/` | Benchmark、模型和排名页面的路由级数据包 |
| `data/normalization_rules.json` | 可审计的模型与 Benchmark 归一化规则 |
| `data/benchmark_taxonomy.json` | 能力领域、评测目的、安全与对齐子类、Benchmark 覆盖项和地图家族的权威分类文件 |
| `scripts/` | 数据拆分、页面生成、实体验证和 taxonomy 校验脚本 |
| `benchmarks/`, `models/`, `ranking/` | 自动生成的英文详情页 |
| `zh/benchmarks/`, `zh/models/`, `zh/ranking/` | 自动生成的中文详情页 |

## 引用

```text
BenchAtlas: Explore the landscape of AI benchmarks.
https://github.com/LIXINGHANG/benchatlas
访问日期：YYYY-MM-DD。
```

## 许可证

原创源代码使用 [MIT License](LICENSE)。官方模型报告、引用片段、模型名称、Benchmark 名称和其他第三方材料仍归其各自权利人所有。详情参见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
