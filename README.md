# Resume Editor — AI 简历优化工具

本地 Web 应用：上传简历或调用已保存档案 + 粘贴 JD → Claude API 优化 → PDF 预览 / 前后对比 → 导出 PDF/Word。

---

## 启动方式

```bash
# 后端（端口 8000）
cd backend
uvicorn main:app --reload --port 8000

# 前端（端口 3000，另开终端）
cd frontend
npm run dev
```

访问 `http://localhost:3000`。  
`backend/.env` 需包含：`ANTHROPIC_API_KEY=sk-ant-...`

**数据持久化**：所有历史记录、优化结果、个人档案均存储在 `backend/resume_editor.db`（SQLite）和 `backend/uploads/` 中，关闭进程后数据不丢失。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3.11 · FastAPI · SQLAlchemy (async) · aiosqlite · SQLite |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) · Prompt Caching · SSE 流式输出 |
| 简历解析 | pdfplumber (word-level y-grouping) · python-docx |
| 导出 | reportlab (PDF, Times-Roman) · python-docx (DOCX) |
| 前端 | Next.js 16 · React 19 · TypeScript · Tailwind CSS |

---

## 目录结构

```
Resume_Editor/
├── backend/
│   ├── main.py                     # FastAPI 入口，CORS，startup 建表
│   ├── requirements.txt
│   ├── .env                        # ANTHROPIC_API_KEY=...
│   ├── resume_editor.db            # 运行时自动创建，持久化存储
│   └── app/
│       ├── config.py
│       ├── database.py
│       ├── models.py               # ORM: sessions / resumes / optimizations / exports / profile
│       ├── schemas.py
│       ├── api/routes/
│       │   ├── resume.py           # POST /resumes/upload（上传后自动合并进档案）
│       │   ├── optimize.py         # POST /optimize  +  GET /optimize/stream/{sid}
│       │   ├── history.py          # GET/DELETE /history
│       │   ├── export.py           # POST /export/{id}/pdf|docx  +  GET /export/download/{id}
│       │   └── profile.py          # GET/PUT /profile, POST /profile/add-text, POST /profile/start-session
│       └── services/
│           ├── resume_parser.py    # pdfplumber + python-docx 解析为纯文本
│           ├── claude_service.py   # Prompt caching + 流式输出 + Profile 输入支持
│           ├── diff_service.py     # 内容级行 diff（normalize 后比较，去除格式符干扰）
│           ├── export_service.py   # reportlab PDF + python-docx DOCX
│           └── profile_service.py  # Claude 合并简历进档案
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx            # 主页：上传/档案 → JD → 优化 → 预览
        │   ├── history/page.tsx    # 历史记录页（支持重新加载恢复完整状态）
        │   └── profile/page.tsx    # 个人档案管理页
        ├── components/
        │   ├── ResumeUploader.tsx
        │   ├── JDInput.tsx
        │   ├── InstructionBox.tsx
        │   ├── ComparisonView.tsx  # PDF预览 / 对比改动 切换
        │   ├── ResumePreview.tsx   # PDF 排版复现（Times New Roman，两栏布局）
        │   ├── DiffHighlight.tsx
        │   ├── ExportButtons.tsx
        │   └── HistoryList.tsx
        ├── hooks/
        │   ├── useOptimize.ts      # SSE 流式接收 + loadResult（历史恢复）
        │   └── useHistory.ts
        └── lib/api.ts              # 所有后端调用
```

---

## 数据库 Schema

### sessions / resumes / optimizations / exports
（同原始设计，不赘述）

### profile（新）
单行表，全局唯一，跨会话积累候选人的完整经历。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 始终为 1 |
| owner_name | VARCHAR | 从档案首行提取的姓名 |
| structured_text | TEXT | 结构化 Markdown 档案全文 |
| updated_at | DATETIME | 最后更新时间 |

---

## API 端点（前缀 `/api/v1`）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /resumes/upload | 上传 PDF/DOCX，解析，后台异步合并进 profile |
| POST | /optimize | 触发优化 |
| GET | /optimize/stream/{session_id} | SSE 流式推送 |
| GET | /optimize/{id} | 获取完整结果 |
| GET | /history | 分页列表 |
| GET | /history/{session_id} | 详情（含所有版本） |
| DELETE | /history/{session_id} | 删除 |
| POST | /export/{id}/pdf | 生成 PDF |
| POST | /export/{id}/docx | 生成 DOCX |
| GET | /export/download/{id} | 下载文件 |
| GET | /profile | 获取当前档案 |
| PUT | /profile | 手动替换档案内容 |
| POST | /profile/add-text | 追加文字到 MANUAL ADDITIONS |
| POST | /profile/start-session | 用档案内容创建新 session（无需上传文件） |

---

## 核心设计说明

### 个人档案（Profile）系统

**目的**：跨会话积累候选人所有简历版本，让 Claude 每次都从完整经历库里挑最适合当前 JD 的内容。

**格式**（结构化 Markdown）：
```
# CANDIDATE PROFILE: Xiaotian (Tiger) Lin
Contact: ...

## EDUCATION
### University of Pennsylvania | Philadelphia, PA
Degree: M.S.E. in Data Science, GPA: 3.73 | Expected May 2026
Courses: NLP, Applied ML...

## EXPERIENCE
### Apple | Beijing, China | Jun 2024 – Aug 2024

#### [Version — SDE / Data-Engineering]
Role: Data Scientist Intern
- ETL pipeline bullets...
Tools: Python, SQL, Spark

#### [Version — Analytics / Business]
Role: Data Analyst Intern
- Dashboard / metrics bullets...
Tools: Tableau, Excel

## SKILLS POOL
...

## MANUAL ADDITIONS
[用户直接输入的经历描述]
```

**合并流程**：
- 上传简历时，后台异步调用 Claude 将新简历合并进 profile（不阻塞上传响应，约 2-5 秒后完成）
- 同一公司：内容差异 > 50% 则新增 Version；否则保留较好版本
- Skills Pool 取所有版本并集
- MANUAL ADDITIONS 原样保留

**使用档案生成**：主页"使用已保存档案"按钮 → 调 `/profile/start-session` → 创建以 profile 内容为 `parsed_text` 的 session → 后续流程与上传文件完全一致。此模式下不显示"对比改动"标签（与自身档案对比没意义）。

### Claude 优化策略

`claude_service.py` 的 System Prompt 采用两步走框架：

1. **分析 JD**：提取 Top-3 技术技能、Top-3 日常职责、4-6 个高频关键词
2. **重新映射**：
   - 同一 section 内，最贴近 JD 的经历排最前（可打破时间顺序）
   - 用 JD 的原话重写 bullet（不只缩短，要用 JD 的语言体系）
   - Technical Skills 中 JD 相关技能优先排列
   - 课程行：与 JD 相关则保留，完全无关且空间紧张才删
   - Profile 输入时：读所有 Version，挑或混合最匹配的版本

**Prompt Caching 断点**：System Prompt（每次）+ resume/profile 文本（同内容多次优化时命中）。

### PDF 导出（reportlab）

`export_service.py` 关键设计：
- `_parse_lines(text)`：生成器，`last_kind == 'name'` 后紧接的行无论含 `|` 与否都识别为 `contact`
- `_fit_para(text, font, size, width)`：逐步缩小字号（0.5pt/步）直到单行可容纳，用于长学位/职位行
- `_two_col(left, right, frac)`：reportlab Table 实现公司名/日期两栏，零内边距
- 页边距：左右 0.65 inch，上下 0.48 inch，可用宽 ≈ 519 pt
- 联系方式行（contact）下方**无**分割线；分割线只在 section 标题下方

### 网页 PDF 预览（ResumePreview）

`ResumePreview.tsx` 用内联 CSS 完整复现 PDF 排版：
- `font-family: "Times New Roman", Times, serif`
- 与 `_parse_lines` 完全对应的 TypeScript 解析器
- 两栏行用 `flex justify-between`，公司名粗体，日期右对齐
- 职位行斜体，bullet 用 `•` + 左缩进
- 显示在灰色背景衬纸（`max-width: 680px`，居中，带阴影）

### Diff 内容比较

`diff_service.py` 的 `_normalize(line)` 在比较前剥离：`##` / `#`、`- ` / `●` / `•` 等 bullet 符、`**bold**`、`|`。

效果：原始简历用 `●` 而优化版用 `-`，相同内容不再被标为"改动"；只有实际文字内容变化才会标红/绿。

---

## 主要页面

| 路径 | 说明 |
|---|---|
| `/` | 主页：上传或选档案 → 粘贴 JD → 优化 → PDF 预览 → 导出 |
| `/history` | 历史记录，点"重新加载"完整恢复对比视图 |
| `/profile` | 档案管理：查看结构化档案、编辑、文字补充 |
