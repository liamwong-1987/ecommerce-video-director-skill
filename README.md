# 电商短视频导演 · 一键 PROMPT 工厂

从一句话需求到可直接喂给视频模型的完整 PROMPT 包。

理解创意 → 摸需求 → 深度挖掘 → 纯文字剧本 → 合规检查 → 自检清单 → 提取分镜 → 提取资产 → 模型选择 → 生成视频 PROMPT → 尾帧重绘衔接。

11 个阶段覆盖从"我想做个电商短视频"到"拿去即梦 / Seedance / MiniMax 一键出片"的完整链路。

**核心能力**
- **11 阶段标准化流程**：从模糊需求到剧本、分镜、资产、视频 PROMPT、尾帧重绘方案全产出；设"用户确认关卡"防跑偏，剧本不确认绝不往下走
- **国内外 11 平台红线分开加载**：抖音 / 快手 / 视频号 / 小红书 / B站 + TikTok / YouTube / Instagram / Facebook / Snapchat，每条规则标来源（官方 / 源Skill / 实测 / 导演经验）
- **6 大类视频类型 × 20 种呈现风格自由组合**：种草转化 / 剧情 / 品牌 / 人设IP / 促销 / 知识热点，真人出镜 / 非真人低成本 / 叙事手法任选
- **三模型适配**：Seedance 2.5(30s) / 2.0(15s) / MiniMax H3(15s·2K)，同一剧本直出对应格式 PROMPT（中文六板块 / 英文三字段）
- **合规先行**：极限词 / 导流 / 医疗功效 / 招商资质等红线自动改写，但真实卖点不动
- **纯提示词、零依赖**：不调用任何外部 API，没有生图生视频能力也能用，生成那步由你执行

**产出物**
- 纯文字剧本：钩子 + 痛点共鸣 + 卖点 + 金句 + CTA，台词按风格写满
- 分镜表：镜头 / 时间轴 / 画面 / 台词 / 声音，标关键帧
- 资产 SPEC：角色锚点 / 场景 / 产品图 / 道具 / 首尾帧
- 视频模型专用 PROMPT：Seedance 中文六板块 / MiniMax H3 英文，复制即用
- 尾帧高清重绘方案：长视频分段衔接用

**安装**
```
git clone https://github.com/liamwong-1987/ecommerce-video-director-skill
```
两种方式使用：
- **作为 Skill 加载**：把整个目录放到你 AI 助手的 skills 文件夹（如 WorkBuddy 的 `~/.workbuddy/skills/`、Claude Code 的 `~/.claude/skills/`、CodeBuddy / Cursor 的对应 skills 目录），工具会按 SKILL.md 自动调用。
- **零配置直接用**：即使不配置 Skill，也可以把 `SKILL.md` 全文贴给任意 AI 对话，说"按这个流程帮我做一条 [产品] 的 [平台] [类型] 视频 PROMPT"，它就会照 11 阶段走。

**架构**
SKILL.md 是 11 阶段主流程（核心调度），references/ 是各阶段按需加载的知识库，examples/ 是跑通案例。

```
ecommerce-video-director/
├── SKILL.md                   # 11 阶段主流程，核心调度逻辑
├── references/                # 各阶段知识库（按需加载）
│   ├── video-types.md         # 6 大类视频类型 + 判断信号
│   ├── style-guide.md         # 20 种呈现风格 + 类型×区域默认映射
│   ├── platform-strategies.md # 国内外 11 平台红线（附官方 URL）
│   ├── model-specs.md         # 三模型规格对比
│   ├── seedance-prompt.md     # Seedance PROMPT 规则（六板块/时间戳/声音括号）
│   ├── h3-prompt.md           # MiniMax H3 PROMPT 规则
│   ├── asset-workflow.md      # 资产 SPEC 工作流（角色/场景锚点）
│   ├── copywriting-library.md # 文案库（钩子/卖点/CTA 模板）
│   └── compliance-checklist.md# 合规自检清单（来源标注）
└── examples/
    └── README.md              # 完整案例索引（如德伦堡小金罐 30s 种草）
```

**数据流**：用户需求 → P1–P4 产出纯文字剧本（唯一事实源，须用户确认）→ P5–P6 合规过滤 / 自检 → P7–P8 提取分镜 / 资产 SPEC → P9–P10 按选定模型映射出专用 PROMPT → P11 长视频尾帧高清重绘衔接。

**示例**
见 `examples/`，含完整跑通案例（德伦堡小金罐 30s 抖音种草等）。

**说明**
这是个通用提示词工作流（Skill 格式），不绑定任何 AI 工具——加载到任何支持自定义指令的 AI 助手里都能用。
