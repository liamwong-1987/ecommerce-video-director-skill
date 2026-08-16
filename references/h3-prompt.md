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

---

## 模式 1：关键帧模式（FL2VA/I2VA/L2VA）

**输出结构**（英文，3 字段）：

```
第一行 = 对齐指令（按模式不同，见下）

integrated_multimodal_description: [Shot 1] ...
overall_soundscape: ...
non_diegetic_music: ...
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
overall_soundscape:       ← 环境声
non_diegetic_music:       ← 配乐
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

### 说话者与对白

- 说话者按实际发声顺序分配 `(S1)`、`(S2)`，多人 `(S1,S2)`
- 对白格式：`<d>[Chinese] 原话</d>`，身份/ID/动作/语气放 `<d>` 外
- 用户给的台词/歌词逐字逐标点保留，不翻译不润色
- 画外音用 `says in an off-screen voiceover`，并说明画面内角色双唇闭合
- 对白跨镜用 `<scenetrans>`，结尾截断用 `<cutoff>`
- 画面真实可见文字用英文双引号包围，原文标点不变

### 声音字段

- `overall_soundscape`：1-4 句英文，环境声/物理动作声/非语言人声，不重复对白
- `non_diegetic_music`：1-3 句英文，画外配乐的乐器/速度/节奏，不用空泛情绪词
- 全程静音才写 `N/A`

### 输出纪律

- 全英文，只有对白/歌词/画面可见文字保留原语言
- 不输出分析过程、参数建议、负面提示词、标题、Markdown 围栏
- 不虚构品牌/角色/台词/参考关系；图片内容不得臆造
