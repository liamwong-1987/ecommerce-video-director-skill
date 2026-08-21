# MiniMax H3 提示词规范

英文提示词，两种模式（两个权重）：关键帧模式（FL2VA/I2VA/L2VA）和全能参考模式（Ref2VA）。

---

## 模式判定

| 输入 | 模式 | 说明 |
|------|------|------|
| 1 图（未说明尾帧） | **I2VA** | 该图是 0.00s 首帧 |
| 1 图（明确尾帧） | **L2VA** | 倒推前态，落到尾帧 |
| 2 图 | **FL2VA** | 图1 首帧 + 图2 尾帧 |
| 多图/多视频/多音频 | **Ref2VA** | 全能参考模式 |

**输入上限**（Ref2VA）：9 图 + 3 视频 + 3 音频，合计 ≤12 个。音频不能作为唯一输入。默认时长 5.00s。

## 口播 / 对白路由规则（电商带货必读）

- **含口播 / 对白（有声叙事）→ 强制全能参考模式 Ref2VA**：即便只有 1 张图也走 Ref2VA（以 `keyframe completion` 锚定该图为首帧），对白用 `<d>[Chinese] 原话</d>` 写进 `detailed_description`。
- **禁止**用关键帧模式（FL2VA/I2VA/L2VA）承载口播——它只有 3 字段、无 `detailed_description`，对白会被静默丢弃（即模型拿到口播需求却不生成对白）。
- 纯视觉无口播（如 ASMR / 产品特写 / 纯展示）才用关键帧模式（I2VA/FL2VA）。
- **交付前硬阻断**：分镜存在说话、口播、介绍、回答、对镜讲解或张嘴表达时，若不是 Ref2VA、没有 `detailed_description`、没有说话人 `(S1)/(S2)`、或没有 `<d>[Language] 确认剧本原话</d>`，一律 FAIL，禁止交付。
- 无对白镜必须在 `detailed_description` 写明 `No dialogue; only ...`；画外音必须说明画面内角色双唇闭合。

---

## 模式 1：关键帧模式（FL2VA/I2VA/L2VA）

**输出结构**（英文，3 字段）：

```
第一行 = 对齐指令（按模式不同，见下）

integrated_multimodal_description: [Shot 1] ...
overall_soundscape: ...
non_diegetic_music: ...   # 配乐；本 SKILL 默认不生成 BGM，禁 BGM 时填 N/A 或不输出
```

**对齐指令**（首行，按模式）：

- **I2VA**：`For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.`
- **FL2VA**：`How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.`
- **L2VA**：`How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.`

（`N` = 实际最终镜头编号，`S.SS` = 实际时长，保留两位小数）

---

## 模式 2：全能参考模式（Ref2VA）

**输出结构**（英文，6 区段，固定顺序）：

```
subject_definitions:      ← 定义 <Subject N>/<Picture N>/<Video N>/<Audio N> 标签
summary:                  ← 任务类型前缀 + 一段概述
retention_analysis:       ← 每个标签的保留关系标记
detailed_description:     ← 主生成正文（350-500 词）
overall_soundscape:       ← 环境声/动作音效
non_diegetic_music:       ← 配乐（本 SKILL 默认不生成 BGM，禁 BGM 时填 N/A 或不输出）
```

### 标签体系

- `<Subject N>`：目标视频中复用/修改的可见内容（人物/物体/场景/服装/道具/风格/动作）
- `<Picture N>`：仅当图片是具体首帧/关键帧/尾帧/构图锚点时单独定义
- `<Video N>`：整段视频关系（编辑/续写/运镜参考）
- `<Audio N>`：独立音频或启用同步音轨（复制 vs 参考）

### summary 任务类型前缀（用 + 合并，不重复）

- `keyframe completion`：图片是具体帧锚点
- `reference generation`：资产只指导人物/场景/风格/动作
- `video editing`：直接修改源视频
- `video continuation`：从源视频结尾续写
- `audio reuse`：直接复用音频信号
- `audio reference`：只参考音色/风格/内容

### retention_analysis 保留标记

- 视觉标签：`fully_preserved` / `partially_preserved` / `attribute_transfer` / `weak_reference`
- 音频标签：`fully_copy` / `partially_copy` / `reference` / `weak_reference`

---

## 共同规范

### 镜头与时间

- `[Shot 1]` 不带时间戳；后续 `[Shot 2] At 00:03.500, the camera cuts to...`
- 切点递增且落在总时长内；切镜用 `the camera cuts to` / `the shot transitions to`
- 只有用户要求才用 cross-dissolve / fade / wipe

### 运镜（英文）

Zoom In/Out、Push In/Pull Out、Pan Left/Right、Truck Left/Right、Tilt Up/Down、Pedestal Up/Down、Arc Shot、Tracking Shot、Static Shot、Shake Slightly/Strongly、POV、Roll Clockwise/Counterclockwise，可加 `with small/large amplitude`、`at slow/fast speed`。

### 六维表演（英文落地）+ 分级运镜

H3 真人还原度较低，六维表演在 `detailed_description` 内用英文写，**重点写体态/动作中间态，微表情少写**（详见 `model-specs.md`「导演思维公式」）：

- 情绪禁抽象词（不写 `sad/angry/tense`），改用可见生理细节：`shifts weight forward`、`shoulders rise and fall with breath`、`fingers tighten on the hem`、`throat rolls in a swallow`、`ambient light drift across the face`。
- 动作中间态优先：`hand hovers mid-air`、`half-step pause`、`turns and hesitates`——不写已完成的静态结果。
- 微表情少写（脸还原不准），用身体/姿势传情绪。

**分级运镜**（按景别选，术语用上文「运镜」清单）：

| 景别 | 运镜标签 |
|---|---|
| 特写/大特写 | `Static Shot` 或 `Static Shot with small shake` |
| 中近景/台词 | `Tracking Shot with small amplitude, at slow speed` |
| 全景/空镜 | `Pan/Truck` 配合 `natural handheld breathing` |

### 节奏/速度（慢动作是间接实现）

H3 **没有直接的「慢动作」开关**，慢速感靠两种间接方式：

- **运镜术语**：`slow zoom in` / `slow tracking shot` / `at slow speed`，用「缓慢运镜」造慢速感。
- **分段过程描述**：按时间戳分节写动作节奏（`0-2s fast action... 2-6s steady...`），每段不同动作节奏。

真要慢动作/升格（放慢画面），需**生成高帧率后在后期软件放慢**（模型本身不直接出慢动作）。提示词里写 "slow motion" 不会真正放慢，只产生慢速运镜观感。升格需求优先考虑 Seedance 2.5（时间锚点变速）或可灵（slow-motion 原生）。

### 说话者与对白

- 说话者按实际发声顺序分配 `(S1)`、`(S2)`，多人 `(S1,S2)`
- 对白格式：`<d>[Chinese] 原话</d>`，身份/ID/动作/语气放 `<d>` 外
- 用户给的台词/歌词逐字逐标点保留，不翻译不润色
- 画外音用 `says in an off-screen voiceover`，并说明画面内角色双唇闭合
- 对白跨镜用 `<scenetrans>`，结尾截断用 `<cutoff>`
- 画面真实可见文字用英文双引号包围，原文标点不变

### 声音字段

- `overall_soundscape`：1-4 句英文，环境声/物理动作声/非语言人声，不重复对白
- `non_diegetic_music`：1-3 句英文，画外配乐的乐器/速度/节奏，不用空泛情绪词；**本 SKILL 默认不生成 BGM，禁 BGM 时该字段填 N/A 或不输出**
- 全程静音才写 `N/A`

### 输出纪律

- 全英文，只有对白/歌词/画面可见文字保留原语言
- 不输出分析过程、参数建议、负面提示词、标题、Markdown 围栏
- 不虚构品牌/角色/台词/参考关系；图片内容不得臆造

## 时长衔接（多段超 15s，由 Phase 7 分镜「尾帧衔接」列决定）

> 是否走衔接流程由 Phase 7 分镜表「尾帧衔接」列决定：**不按视频类型、不按模型豁免**。跳切段（标记「否」）直接新景别独立生成；连续段（标记「是」）强制走下方「尾帧高清还原 + 校验-重试闭环」。

**连续段（尾帧衔接 = 是）**：
- 用 **FL2VA 首末帧模式**保真还原：取上一段尾帧 + 本段首帧意图，对齐到高清（首尾帧模式本身即保真还原，内容/构图/主体/服装/光源/色调完全不变，仅提清），或走 **Regenerate-2K** 复用原始上下文还原 2K。
- **强制校验-重试闭环**：逐条视觉比对还原图与尾帧（主体/构图/服装/光源/色调/姿态），并用客观指标（SSIM / 感知哈希）辅助；首次通过即停止，不一致才重做（升参考权重 / 加对齐约束 / 换种子），累计最多 3 次。**重试耗尽前禁止回退低清尾帧、禁止跳过还原步骤**；3 次仍不一致**上报用户**。
- 还原通过的高清图当下一段首帧，下一段提示词锚定该首帧继续。

**跳切段（尾帧衔接 = 否）**：不取尾帧、不做还原，直接按新场景 / 新景别独立生成下一段。
