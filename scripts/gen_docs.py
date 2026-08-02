# -*- coding: utf-8 -*-
"""重新生成产出 1 / 产出 2 交付 docx：忠实重排版，原生 Word 样式。"""
import re
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HEADER_BG = "1F3A5F"   # 深蓝表头
CODE_BG = "F2F2F2"     # 代码块浅灰底
ROW_ALT = "EDF1F7"     # 表格交替行浅蓝

def set_zh(run, name="微软雅黑"):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), name)

def shade_cell(cell, color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), color)
    tcPr.append(shd)

def shade_par(p, color):
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), color)
    pPr.append(shd)

TOKEN = re.compile(r"(\*\*.+?\*\*|`[^`]+`)")

def rich(p, text, size=None, bold_all=False, color=None):
    for tok in TOKEN.split(text):
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**"):
            r = p.add_run(tok[2:-2]); r.bold = True
        elif tok.startswith("`") and tok.endswith("`"):
            r = p.add_run(tok[1:-1])
            r.font.name = "Consolas"
            r._element.get_or_add_rPr().find(qn("w:rFonts")).set(qn("w:eastAsia"), "微软雅黑")
        else:
            r = p.add_run(tok)
        set_zh(r)
        if size: r.font.size = Pt(size)
        if bold_all: r.bold = True
        if color: r.font.color.rgb = color
    return p

def h(doc, level, text, color=RGBColor(0x1F, 0x3A, 0x5F)):
    p = doc.add_heading("", level=level)
    r = p.add_run(text)
    set_zh(r)
    r.font.color.rgb = color
    r.bold = True
    sizes = {0: 20, 1: 16, 2: 13, 3: 11.5}
    r.font.size = Pt(sizes.get(level, 11))
    p.paragraph_format.space_before = Pt({0: 6, 1: 14, 2: 10, 3: 8}.get(level, 6))
    p.paragraph_format.space_after = Pt({0: 6, 1: 6, 2: 4, 3: 4}.get(level, 4))
    return p

def para(doc, text, size=10.5, indent=None, space_after=6):
    p = doc.add_paragraph()
    rich(p, text, size=size)
    if indent: p.paragraph_format.left_indent = Cm(indent)
    p.paragraph_format.space_after = Pt(space_after)
    return p

def bullets(doc, items, size=10.5):
    for it in items:
        p = doc.add_paragraph(style="List Bullet")
        rich(p, it, size=size)
        p.paragraph_format.space_after = Pt(2)

def code_block(doc, lines, size=9):
    for i, ln in enumerate(lines):
        p = doc.add_paragraph()
        r = p.add_run(ln)
        r.font.name = "Consolas"
        set_zh(r, "Consolas")
        r.font.size = Pt(size)
        shade_par(p, CODE_BG)
        p.paragraph_format.space_after = Pt(0 if i < len(lines) - 1 else 6)
        p.paragraph_format.left_indent = Cm(0.2)

def table(doc, headers, rows, widths=None, size=9.5):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Table Grid"
    t.autofit = True
    for j, htxt in enumerate(headers):
        cell = t.cell(0, j)
        p = cell.paragraphs[0]
        rich(p, htxt, size=size, bold_all=True, color=RGBColor(0xFF, 0xFF, 0xFF))
        shade_cell(cell, HEADER_BG)
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            cell = t.cell(i + 1, j)
            p = cell.paragraphs[0]
            rich(p, val, size=size)
            if i % 2 == 1:
                shade_cell(cell, ROW_ALT)
    if widths:
        for j, w in enumerate(widths):
            for row in t.rows:
                row.cells[j].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

# =====================================================================
# 产出 1：需求澄清与问题定义
# =====================================================================
def build_requirements(path):
    doc = Document()
    doc.add_heading("", level=0)
    h(doc, 0, "产出 1：需求澄清与问题定义")

    h(doc, 1, "一、产品问题重定义")
    para(doc, "**负责人原话**：\u201c我要 AI 帮编辑更快找到真正值得写的观点，保留证据，形成可编辑的内容初稿；最后一层判断，仍然由编辑完成。\u201d")
    para(doc, "**改写为可执行的产品问题**：")
    para(doc, "这个工具解决的是\u201c编辑通读长访谈的效率问题\u201d——让编辑不需要从头啃完 90 分钟的逐字稿，而是先看到一份结构化的\u201c内容素材地图\u201d。")
    bullets(doc, [
        "**输入**：访谈 SRT 逐字稿、历史笔记库、样稿风格参考",
        "**输出**：带小标题的短篇文章片段（每个片段聚焦一个核心观点），编辑可以自行拖拽、排序、拼接成完整文章",
        "**做得好不好看三点**：①小标题是否准确反映了正文内容（不标题党）；②关键词和观点分类是否精准（编辑搜索时能快速找到）；③AI 生成的内容是否基于真实证据（每句话能回溯到逐字稿），同时有看点、有热点",
    ])

    h(doc, 1, "二、关键假设清单")
    h(doc, 2, "1. 原始素材及历史内容的版权、隐私和可使用范围")
    para(doc, "**假设**：素材版权归笔记侠所有，内部工具可自由使用。但访谈中嘉宾可能提及不愿公开的内容。")
    para(doc, "**需要确认**：")
    bullets(doc, [
        "历史笔记的\u201c可引用范围\u201d字段是否需要强制执行？（note_01 明确标注\u201c不建议作为 AI 工具落地的事实依据\u201d）",
        "如果前端做得足够清晰，访谈者本人是否可以直接在知识图谱上勾选\u201c可公开/需删减\u201d，把隐私确认前置到访谈结束环节？",
    ])

    h(doc, 2, "2. 编辑当前从素材到文章初稿的实际流程、耗时和主要返工点")
    para(doc, "**假设**：当前流程的核心瓶颈不在\u201c写\u201d，在\u201c找\u201d——编辑被迫通读大量低信息密度的口语对话才能定位到几个关键段落。")
    para(doc, "**需要确认**：")
    bullets(doc, [
        "编辑实际通读一篇 90 分钟逐字稿需要多久？60 分钟还是更久？",
        "主要返工发生在哪个环节？是写完之后发现漏了重要观点要回头补，还是结构搭好之后被主编推翻？",
        "编辑目前是否已经在用 AI 工具辅助？（如果已经在用，用了什么？效果如何？）",
    ])

    h(doc, 2, "3. 内容成品的目标读者、渠道、时效要求和编辑 SLA")
    para(doc, "**假设**：目标读者为创业者、企业管理者和 AI 落地推动者；发布渠道以笔记侠公众号为主；AI 应用方向选题时效性要求高，需在访谈后 48–72 小时内出稿。")
    para(doc, "**需要确认**：")
    bullets(doc, [
        "不同渠道（公众号深度文章 vs 社群复盘材料）的内容标准差异有多大？",
        "\u201c时效性强\u201d是要求 24 小时出稿还是 72 小时？不同时效要求直接影响系统是\u201c辅助决策\u201d还是\u201c辅助快速产出\u201d",
    ])

    h(doc, 2, "4. 什么样的 AI 输出可以直接使用，什么必须由编辑确认")
    para(doc, "**假设**：")
    bullets(doc, [
        "**可以直接用**：纯事实转述（\u201c嘉宾B 说他用过 Claude\u201d）、结构化整理（时间线、对比表）、语言润色（口语改书面语）",
        "**必须编辑确认**：涉及因果归因的论断（\u201c这意味着……\u201d）、使用了热点或敏感表述的段落、AI 加了修饰但找不到逐字稿原文支撑的句子",
    ])
    para(doc, "**判断依据**：Agent 1 在提取阶段就给每句话打了置信度——原文可逐句回溯的（绿色）可以直接用，AI 做了语义延伸的（黄色）需要编辑看一眼，找不到原文支撑的（红色）必须编辑确认。这个分级标准是否合理？")

    h(doc, 2, "5. 如何定义\u201c内容质量提升\u201d与\u201c编辑效率提升\u201d")
    para(doc, "**假设**：")
    bullets(doc, [
        "**内容质量提升**的标准：观点密度是否够高（正确废话少）、关键论述是否可溯源（证据链完整）、是否回应了目标读者的真实困惑",
        "**编辑效率提升**的标准：编辑不再需要从头通读逐字稿就能搭建文章骨架。AI 把逐字稿预加工成可拖拽的知识卡片，编辑做的是\u201c选哪些、怎么排、在哪里加自己的判断\u201d——从\u201c写作工具\u201d变成\u201c编辑决策辅助\u201d",
    ])
    para(doc, "**需要确认**：")
    bullets(doc, [
        "笔记侠内部是否已有内容质量的量化标准？（比如文章打开率、完读率、收藏率？）",
        "\u201c效率提升\u201d用什么指标衡量？初稿产出时间缩短 60%？还是编辑加班天数减少？",
    ])

    doc.save(path)
    print("saved:", path)

# =====================================================================
# 产出 2：方案设计
# =====================================================================
def build_solution(path):
    doc = Document()
    h(doc, 0, "产出 2：方案设计 — AI 增强内容复盘工具")

    # ---------- 一、整体架构 ----------
    h(doc, 1, "一、整体架构")
    code_block(doc, [
        "编辑交互前端",
        "· 四象限全局概览（置信度 × 热点）",
        "· 卡片库（抽屉）  |  编辑工作区（拖拽拼接）",
        "        ▲  viewpoints.json + draft",
        "AI 处理管道",
        "输入层：SRT 逐字稿 + 8 篇历史笔记 + 3 篇样稿 + 外部知识库",
        "SRT → Agent 1 观点提取 (Prompt) → Agent 2 复用判断 (Prompt+检索)",
        "      → [编辑选择角度]  ← 人工决策关卡",
        "      → Agent 3 内容生成 (Prompt) → Agent 4 事实核查 (Prompt+RAG)",
        "输出层：结构化 JSON → 知识图谱前端 → 可编辑初稿",
    ])
    h(doc, 2, "为什么叫\u201c多 Agent\u201d但不用 Agent 框架")
    para(doc, "每个模块有独立的**角色定义、Prompt、输入输出契约、质量标准和故障处理策略**。它们像一个编辑团队的四个专业角色——观点编辑、资料编辑、撰稿人、事实核查员——各自独立工作、通过结构化文件交接。这个设计不依赖 LangGraph 或 CrewAI，而是用**多步 Prompt 链 + 中间文件协议**实现相同的架构效果。")
    para(doc, "调研中 lumentis（1.7k★）、buildnext-oss、onepod-Skill 均采用此模式。调研中 AWS、Contently、Markup AI 的多 Agent 架构理念——\u201c每个 Agent 只做一件事、独立可替换、通过结构化数据交接\u201d——在本方案中被完整保留。")

    # ---------- 二、Agent 1 ----------
    h(doc, 1, "二、Agent 1：观点提取")
    h(doc, 2, "角色定位")
    para(doc, "相当于一个资深编辑通读整篇逐字稿，用三色荧光笔标出\u201c高维思想\u201d\u201c当下解答\u201d\u201c信息差\u201d三类内容，并在每个标注旁写下证据位置、置信度、热点匹配和风险提示。")
    h(doc, 2, "输入")
    bullets(doc, [
        "`interview_transcript.srt`：97 段带说话人和时间戳的逐字稿",
        "`content_brief.md`：目标读者、发布渠道、时效要求",
        "当前热点话题列表（预定义，非实时爬取）",
    ])
    h(doc, 2, "AI 介入方式：Prompt")
    para(doc, "任务明确、输入确定、无外部检索需求——**Prompt 是最合适的工具**。")
    para(doc, "核心 Prompt 策略（详见 `agent1_prompt.md`）：")
    bullets(doc, [
        "**角色设定**：\u201c你是笔记侠资深商业内容编辑，从长篇访谈中提取有发表价值的观点\u201d",
        "**三维度分类**：high_order_insight（高维思想）、current_answer（当下解答）、info_gap（信息差）",
        "**证据溯源强制约束**：每个观点至少附带一条逐字稿原文引用 + 时间戳",
        "**置信度三级标注**：high（可逐句回溯）、medium（AI 做了语义延伸）、low（AI 推测了未明说含义）",
        "**热点匹配**：与预定义热点列表做语义关联判断",
        "**编辑标注**：fact_check_needed / sensitive_content / needs_human_judgment + 具体原因",
    ])
    h(doc, 2, "输出")
    para(doc, "`viewpoints.json`：10–15 个结构化观点节点，JSON 格式供前端渲染知识图谱。")
    para(doc, "数据结构（详见已生成的原型输出）：")
    code_block(doc, [
        "{",
        '  "viewpoint_id": "vp_01",',
        '  "title": "观点小标题（≤12字，有判断力）",',
        '  "category": "high_order_insight | current_answer | info_gap",',
        '  "speaker": "说话人",',
        '  "timestamp_start": "00:00:00",',
        '  "evidence_quotes": [{ "text": "原文", "speaker": "", "timestamp": "" }],',
        '  "confidence": "high | medium | low",',
        '  "keywords": [],',
        '  "hotspot_match": { "matched": true/false, "topic": "", "score": 0.0 },',
        '  "editorial_flags": {',
        '    "fact_check_needed": false,',
        '    "sensitive_content": false,',
        '    "needs_human_judgment": false',
        "  },",
        '  "summary_short": "一句话摘要（≤40字）"',
        "}",
    ])
    h(doc, 2, "因果链建模（causalChain）")
    para(doc, "嘉宾观点的价值往往藏在论证过程里，而不是结论本身。Agent 1 在提取观点时同步提取因果链，让编辑一眼看到\u201c前提 → 推理 → 结论\u201d的论证骨架，而不是被口语化的跳跃表达淹没。")
    para(doc, "**提取判断标准**（只有包含因果推理才提取；纯事实陈述或纯行动建议填 null）：")
    bullets(doc, [
        "嘉宾说\u201c因为X，所以Y\u201d → 有因果",
        "嘉宾说\u201c如果不X，就会Y\u201d → 有因果",
        "嘉宾说\u201cX导致了Y，所以我们需要Z\u201d → 有因果",
        "嘉宾说\u201c以前是A，现在是B，这意味着C\u201d → 有因果",
        "嘉宾只是描述事实\u201cX公司做了Y产品\u201d → 无因果，填 null",
        "嘉宾只是给建议\u201c你应该去试试Z\u201d → 无因果，填 null",
    ])
    para(doc, "**结构**：")
    code_block(doc, [
        "{",
        '  "premise": "前提",',
        '  "reasoning": "推理过程",',
        '  "conclusion": "结论",',
        '  "evidence": [{ "segment": "说话人 时间戳", "text": "支撑因果链的原文" }],',
        '  "missingSteps": ["这个因果链还缺什么？编辑应该注意什么逻辑断点？"]',
        "}",
    ])
    para(doc, "Prompt 要求至少 5 个观点带 causalChain——大多数嘉宾观点都包含因果推理。")
    para(doc, "**前端呈现与编辑价值**：观点详情弹窗中，因果链以蓝色递进箭头展示\u201c前提 → 推理 → 结论\u201d，每条链附证据原文；`missingSteps` 以琥珀色\u201c推理链断点\u201d警示。这正面回应了题目强调的痛点——\u201cAI 容易遗漏关键因果、把嘉宾的口语表达写得过满\u201d：因果链让编辑直接看到论证的完整性与断点，决定是否补足或删减，而不是让 AI 在生成时自行脑补缺失环节。")

    h(doc, 2, "观点间关系建模（relations，逻辑链）")
    para(doc, "因果链解决\u201c一个观点内部的论证\u201d，relations 解决**观点与观点之间的逻辑关系**。Agent 1 提取完观点后，为有明确逻辑关系的观点对添加 relations，把扁平的 JSON 列表变成可追溯的逻辑链：")
    bullets(doc, [
        "**causal（因果）**：vp_A 是 vp_B 的前提/原因——\u201c因为A，所以B\u201d跨观点的推导",
        "**progressive（递进）**：vp_B 是 vp_A 的深化/延伸——先讲现象，再讲机制，再讲怎么办",
        "**contrast（对比）**：vp_B 与 vp_A 构成对立或张力——两位嘉宾观点冲突，或同一嘉宾的\u201c反常识\u201d对照",
    ])
    para(doc, "**结构**（每个观点节点的 relations 字段）：")
    code_block(doc, [
        '"relations": [',
        '  { "targetId": "vp_12", "type": "causal", "reason": "工业革命从未自动化劳动而是改变技能结构——这正是今天不适应新技术者收入下降的历史原因" }',
        "]",
    ])
    para(doc, "Prompt 要求至少 3 对关系，只标注逐字稿中明确可判断的关系，不硬凑。")
    para(doc, "**编辑价值**：文章结构不能是观点的随意堆叠。relations 让编辑一眼看到哪些观点是\u201c前提\u201d、哪些是\u201c结论\u201d、哪些构成张力——搭结构时自然形成递进或对比，而不是平铺。Agent 3 生成初稿时也会据此把有因果关系的观点组织进同一段落，避免\u201c观点之间没有逻辑勾连\u201d的 AI 味。")

    h(doc, 2, "案例独立建模（case）")
    para(doc, "商业内容最有说服力的部分是案例，但案例不能只当\u201c证据引用\u201d用。Agent 1 识别嘉宾提到的具体案例（公司实践、个人经历、行业事件），**单独建模并标注完整性**：")
    bullets(doc, [
        "**background**：背景（当事人是谁、什么处境）",
        "**action**：行动（做了什么）",
        "**result**：结果（带来了什么变化）",
        "**completeness**：三要素齐全=complete；缺一个=partial；只言片语无法成案=unknown",
    ])
    para(doc, "**结构**（每个观点节点的 case 字段）：")
    code_block(doc, [
        '"case": {',
        '  "background": "嘉宾B是一位CEO，管理整个公司但坚持亲自动手",',
        '  "action": "用AI编程工具自建了整套CEO工具栈",',
        '  "result": "应用开发成本从几个月降到一个周末",',
        '  "completeness": "complete",',
        '  "evidence": "我的整个CEO工具栈里全是我自己构建的应用。"',
        "}",
    ])
    para(doc, "Prompt 要求至少 3 个观点带 case；泛泛举例（\u201c比如很多公司都这样\u201d）填 null。")
    para(doc, "**编辑价值**：completeness 标注直接告诉编辑——这个案例能不能直接写进文章？三要素完整（complete）的案例可以直接用；要素不全（partial）的需要编辑补背景或结果，或降级为一句引述；unknown 的不建议作为案例展开。前端详情弹窗中，案例以\u201c背景/行动/结果\u201d三段式展示，完整性以彩色徽标标注（绿色=完整、琥珀=需补、灰=仅只言片语），方便编辑在选素材时直接识别可用案例。")

    h(doc, 2, "编辑做什么")
    bullets(doc, [
        "审核 Agent 1 提出的 10–15 个观点——删掉不认同的、补充 AI 漏掉的",
        "调整分类（比如把 AI 分到 info_gap 的观点移到 high_order_insight）",
        "确认 `editorial_flags` 的标注是否合理",
    ])
    h(doc, 2, "质量 Rubric")
    table(doc,
        ["维度", "好", "差"],
        [
            ["**观点密度**", "每个节点是一个独立的、有判断力的观点，不是\u201cAI很重要\u201d这种泛泛而谈", "输出的是逐字稿摘要而非观点提炼"],
            ["**证据覆盖**", "每个节点至少一条可精准定位的原文引用", "观点和证据\u201c大概对得上\u201d但时间戳模糊"],
            ["**分类准确**", "三种维度边界清晰，高层思想不会被当成信息差", "所有节点都分到同一类"],
            ["**热点判断**", "匹配的理由具体（\u201c直接回应了XX焦虑\u201d）", "匹配理由为空或泛泛而谈"],
        ],
        widths=[2.5, 7.5, 6.5])
    h(doc, 2, "数据质量处理")
    bullets(doc, [
        "**转录重复/明显错误**（如\u201c或者AI编程工具或者AI编程工具\u201d）：Agent 1 标注 `transcript_issue: true`，可推断正确内容写入 `inferred_text`，但**不覆盖**原文 `evidence_quotes` 中的原始转录",
        "**嘉宾表达跳跃**：不做强制合并。让一个观点节点只承载一段逻辑完整的对话。跳跃的上下文拆成独立节点",
        "**SRT 开头截断**（第 1 段主持人被截断）：如不影响核心观点提取，忽略；如影响，标注在 `editorial_checks` 中",
    ])

    # ---------- 三、Agent 2 ----------
    h(doc, 1, "三、Agent 2：历史复用判断")
    h(doc, 2, "角色定位")
    para(doc, "相当于一个资料编辑——手里有 8 篇过往笔记的索引，每新来一个选题，ta 快速判断：哪些过往内容可以用、哪些不能用、哪些是陷阱。")
    h(doc, 2, "输入")
    bullets(doc, [
        "`viewpoints.json`（Agent 1 输出）",
        "`historical_notes.jsonl`（8 篇脱敏历史笔记）",
    ])
    h(doc, 2, "AI 介入方式：Prompt + 结构化检索")
    para(doc, "8 篇历史笔记的总长度可控（总字符数约 400K），不需要上向量数据库。**直接将 8 篇笔记的标题、日期、主题、适用读者、可引用范围和前 500 字摘要塞入 Prompt 上下文**，让 LLM 对每篇做多维判断。")
    para(doc, "**为什么不是 RAG**：")
    bullets(doc, [
        "8 篇的数量级不需要向量检索——全量塞入上下文即可",
        "复用判断的核心不是\u201c语义相似度\u201d，而是**多维判断**：日期是否过时？读者是否匹配？是否同一场？引用范围是否允许？——这些需要 LLM 的推理能力，不是向量检索的相似度排序",
    ])
    para(doc, "**判断矩阵**（LLM 对每篇笔记回答以下问题）：")
    table(doc,
        ["判断维度", "问题", "选项"],
        [
            ["内容唯一性", "这篇笔记和当前逐字稿是同一场访谈吗？", "是 → 不复用 / 否 → 继续判断"],
            ["时效性", "这篇笔记的日期距今多久？话题是否还有效？", "<6 个月 → 可能可用 / >1 年 → 仅背景参考"],
            ["读者匹配", "这篇笔记的适用读者和当前目标读者重叠吗？", "重叠 → 可用 / 不重叠 → 标注差异"],
            ["引用范围", "这篇笔记的可引用范围允许当前用途吗？", "允许 → 可用 / 建议核实 → 标注 / 禁止 → 不复用"],
            ["观点增强", "这篇笔记能补充或强化 Agent 1 提取的哪些观点？", "列出具体 vp_id"],
        ],
        widths=[2.6, 7.4, 6.5])
    h(doc, 2, "输出")
    para(doc, "`reuse_suggestions.md`：每篇笔记一个判定结论（不复用 / 有限复用 / 明确复用）+ 具体理由。")
    h(doc, 2, "Agent 2 的特殊设计：同一场陷阱检测")
    para(doc, "题目材料中的 note_02 与当前逐字稿是**同一场访谈的历史版本**。Agent 2 必须在第一步就识别这个关系：")
    bullets(doc, [
        "先做\u201c内容指纹\u201d比对——note_02 标题\u201c关于AI、能动性与未来的对话\u201d与访谈主题高度吻合",
        "标注为 ❌ 不复用",
        "额外建议：如编辑想对照新旧版本，note_02 可作为\u201c差异化基准\u201d——新稿必须在观点选择和组织方式上与旧版有明显区别",
    ])
    h(doc, 2, "编辑做什么")
    bullets(doc, [
        "审核 Agent 2 的复用判断，特别关注\u201c有限复用\u201d——编辑最终决定用不用",
        "如果编辑知道 Agent 2 不知道的信息（比如某篇笔记的版权状态），直接覆盖 AI 判断",
    ])
    h(doc, 2, "质量 Rubric")
    table(doc,
        ["维度", "好", "差"],
        [
            ["**陷阱检测**", "准确识别 note_02 为同一场并标记不复用", "把 note_02 当\u201c主题相关\u201d推荐复用"],
            ["**时效判断**", "2023 年的内容标注过时或仅背景参考", "不对日期做任何判断"],
            ["**可用性判定**", "\u201c可用于XX\u201d有具体理由", "\u201c可以用\u201d没有理由"],
        ],
        widths=[2.5, 7.5, 6.5])

    # ---------- 四、Agent 3 ----------
    h(doc, 1, "四、Agent 3：内容生成")
    h(doc, 2, "角色定位")
    para(doc, "相当于一个熟悉笔记侠风格的撰稿人——拿到编辑选定的角度和观点素材后，按出版标准写出初稿。ta 不决定\u201c写什么\u201d（这是 Agent 1 和编辑的事），ta 决定\u201c怎么写\u201d。")
    h(doc, 2, "前置：编辑选择角度")
    para(doc, "在 Agent 3 启动之前，编辑从 Agent 1 输出的 3 个切入角度中选择 1 个（或自定义）。这是一个**强制性人工关卡**——Agent 3 不会自动选择角度。")
    h(doc, 2, "输入")
    bullets(doc, [
        "编辑选定的切入角度（来自 `angles.md` 或自定义）",
        "选定角度对应的观点节点列表（从 `viewpoints.json` 中筛选）",
        "3 篇样稿的风格特征（由预处理步骤提取，见下文\u201c风格预处理\u201d）",
        "`content_brief.md`：目标读者、渠道",
    ])
    h(doc, 2, "AI 介入方式：Prompt（含样稿风格约束）")
    para(doc, "**为什么不是 Agent**：")
    bullets(doc, [
        "任务高度结构化——给定观点 + 大纲 + 风格 → 写出分段草稿",
        "不需要自主决策——Agent 3 不决定\u201c写什么\u201d，只决定\u201c怎么写\u201d",
    ])
    para(doc, "**Prompt 核心策略**：")
    bullets(doc, [
        "**风格约束**：从样稿中归纳的笔记侠风格特征作为 Prompt 的一部分",
        "**证据锚定**：每个段落必须能回到 `viewpoints.json` 中的 `evidence_quotes`",
        "**长度控制**：分段生成，每段 150–200 字，总长 500–800 字",
        "**可编辑性**：输出是 Markdown，保留结构标记，编辑可以直接修改",
    ])
    h(doc, 2, "样稿风格预处理（手动 + AI 辅助）")
    para(doc, "3 篇 published_samples 的风格特征（已完成归纳）：")
    bullets(doc, [
        "**标题模式**：人名/公司名 + 冒号 + 核心观点句",
        "**开头结构**：内容来源 + 责编 + 第X篇深度好文 + \u201c笔记君说\u201d推荐语",
        "**正文组织**：背景导入 → 大标题分段 → 每段有案例/数据 → 结尾升华",
        "**引用方式**：不直接标时间戳，但每段可回溯到原始演讲/访谈",
        "**字数**：深度文章 5000–10000 字；本原型目标 500–800 字（演示用）",
    ])
    h(doc, 2, "输出")
    para(doc, "`draft_v0_5.md`：500–800 字可编辑初稿，含时间戳标注、待确认标记。")
    h(doc, 2, "编辑做什么")
    bullets(doc, [
        "**结构层**：调整段落顺序，拆分或合并段落",
        "**表达层**：修改具体措辞，添加自己的判断和金句",
        "**事实层**：确认或修正 AI 标注的待核实项",
    ])
    h(doc, 2, "质量 Rubric")
    table(doc,
        ["维度", "好", "差"],
        [
            ["**风格一致**", "读起来像笔记侠文章，不是 ChatGPT 文章", "有明显的\u201cAI 味\u201d——每段开头都是\u201c在当今时代…\u201d"],
            ["**证据保真**", "关键论述能回到观点节点 → 回到逐字稿", "文章流畅但找不到原始出处"],
            ["**结构可用**", "编辑拿到可以在此基础上改，不需要推翻重写", "编辑需要重新搭结构"],
            ["**编辑判断保留**", "AI 标注了哪些地方它不确定", "所有地方看起来\u201c一样确定\u201d"],
        ],
        widths=[2.5, 7.5, 6.5])

    # ---------- 五、Agent 4 ----------
    h(doc, 1, "五、Agent 4：事实核查")
    h(doc, 2, "角色定位")
    para(doc, "相当于一个\u201c吹毛求疵\u201d的事实核查编辑——拿到初稿后，逐句往回比对原始证据。AI 做的论断 AI 自己来查，嘉宾说的外部数据 AI 去外部知识库验证。")
    h(doc, 2, "输入")
    bullets(doc, [
        "`draft_v0_5.md`（Agent 3 输出）",
        "`interview_transcript.srt`（原始逐字稿——内检基准）",
        "`viewpoints.json`（观点节点及其证据时间戳）",
    ])
    h(doc, 2, "AI 介入方式：Prompt + RAG（双通道）")
    para(doc, "Agent 4 分两个通道：")
    para(doc, "**通道 1：内检（Prompt）**——草稿中的每个论断 vs 原始 SRT")
    bullets(doc, [
        "逐句比对：这句话在逐字稿中有没有对应的原文？",
        "语义一致性：AI 有没有把\u201c可能\u201d\u201c也许\u201d改成\u201c一定\u201d\u201c必然\u201d？",
        "说话人归属：AI 有没有把嘉宾A 说的话写成嘉宾B？",
    ])
    para(doc, "**通道 2：外检（RAG）**——草稿中标注 `fact_check_needed: true` 的论断 vs 外部可信知识库")
    para(doc, "检索源：学术论文摘要（arXiv / Semantic Scholar）、权威媒体报道、维基百科。外检只在编辑开启时才执行——因为检索结果需要编辑解读，不能自动采纳。")
    para(doc, "**RAG 外检的技术路径**：")
    code_block(doc, [
        "标注 fact_check_needed 的句子",
        "  ↓",
        "句子向量化（text-embedding-3-small 或 bge-large-zh）",
        "  ↓",
        "检索（预建可信知识库索引，余弦相似度 Top-K=5）",
        "  ↓",
        "LLM 判断（逐文档）：",
        "  · 支撑：文档提供了支持该论断的证据",
        "  · 部分支撑：方向一致但细节有差异",
        "  · 无支撑：找不到相关证据",
        "  · 矛盾：找到与该论断相反的证据",
        "  ↓",
        "输出：每句待核实论断 + 检索结果 + 判断 + 来源链接",
    ])
    h(doc, 2, "输出")
    para(doc, "`editorial_checks.md`：分为六个部分——")
    bullets(doc, [
        "事实核查项（需核实外部数据 + 检索结果）",
        "转录含混项（SRT 中语义不完整的段落）",
        "事实不确定项（嘉宾表述模糊或可能不准确）",
        "观点冲突或需编辑判断项（可能引发争议的表述）",
        "数据缺失项（无视频、样稿读取问题等）",
        "历史素材复用警告（是否存在同一场/过时/主题不匹配）",
    ])
    h(doc, 2, "编辑做什么")
    bullets(doc, [
        "逐条审核 Agent 4 的核查结果",
        "决定：修改原文？标注\u201c据嘉宾引用的研究\u201d？删除？",
        "外检结果不能自动采纳——编辑必须打开来源链接确认",
    ])
    h(doc, 2, "外检结果呈现（在前端）")
    para(doc, "每句待核实论断在前端显示为**可点击的黄色高亮**。点击弹出侧栏：")
    bullets(doc, [
        "论断原文",
        "RAG 检索结果（支撑 / 部分支撑 / 无支撑 / 矛盾）+ 置信度",
        "建议编辑动作（修改表述 / 加注脚 / 删除 / 保留但标注）",
        "\u201c打开来源\u201d链接",
    ])
    h(doc, 2, "质量 Rubric")
    table(doc,
        ["维度", "好", "差"],
        [
            ["**内检覆盖率**", "初稿中每个带时间戳的论述都被比对过", "只检查了部分段落"],
            ["**误报控制**", "flag 的都是真问题，没有\u201c狼来了\u201d", "大量 flag 是正确但 AI 误判的"],
            ["**外检溯源**", "检索结果有可点击的来源链接", "给出了判断但不知道依据是什么"],
            ["**编辑可操作性**", "每个标注有\u201c建议动作\u201d，编辑不用自己猜怎么改", "只说\u201c可能有问题\u201d但不给建议"],
        ],
        widths=[2.5, 7.5, 6.5])

    # ---------- 六、编辑交互前端 ----------
    h(doc, 1, "六、编辑交互前端（知识图谱可视化）")
    h(doc, 2, "设计理念")
    para(doc, "不是仪表盘，不是报表。是**编辑的决策辅助面板**——AI 把逐字稿预加工成可拖拽的知识卡片，编辑做的是选择、排序、拼接，而不是从零开始写。")
    h(doc, 2, "界面布局")
    code_block(doc, [
        "┌ 顶部工具栏：导入SRT / 导入历史笔记 / 重新分析 / 导出初稿",
        "├ 四象限全局概览（可选折叠）",
        "│   · 纵轴：置信度（高→低）    横轴：热点相关性（低→高）",
        "│   · 🟢 高置信+高热点（优先写）  🟡 低置信+高热点（需核实）",
        "│   · 🟢 高置信+低热点（信息宝藏） 🔴 低置信+低热点（可跳过）",
        "├ 左侧：抽屉卡片库（按维度分组）",
        "│   · ▼ 高维思想 (5)  ▼ 当下解答 (4)  ▼ 信息差 (4)  🔴 仅低置信 (2)",
        "└ 右侧：编辑工作区（拖拽拼接）",
        "    · 引言：vp_01 企业家=能动性（嘉宾A 00:00:04 🟢高置信）",
        "    · 正文一：vp_08 杠铃效应、vp_12 不适应者收入降（🔴 待核实数据）",
        "    · 结尾：[空] 从左侧拖一个观点进来",
        "    · [生成全文草稿]  [Agent 4 事实核查] 按钮",
    ])
    h(doc, 2, "交互行为")
    table(doc,
        ["操作", "效果"],
        [
            ["点击左侧卡片", "右侧弹出详情：证据原文、完整时间戳、编辑标注、热点匹配理由"],
            ["拖拽卡片到右侧工作区", "卡片被添加到对应区域（引言/各段/结尾）"],
            ["在工作区拖动卡片排序", "调整段落内观点的出场顺序"],
            ["右击工作区卡片 → \u201c展开\u201d", "用 Agent 3 的 Prompt 对该观点做 150 字扩写"],
            ["右击工作区卡片 → \u201c移除\u201d", "从当前大纲中移除（卡片回到左侧库）"],
            ["点击 🟡/🔴 置信度标签", "弹出 Agent 4 的核查详情和编辑建议"],
            ["点击 [生成全文草稿]", "调用 Agent 3，把右侧工作区的结构 + 卡片扩写成完整文章"],
            ["点击 [Agent 4 核查]", "调用 Agent 4，对当前草稿执行内检 +（可选）外检"],
        ],
        widths=[5.5, 11.0])
    para(doc, "**卡片右下角信息**：每张卡片右下角显示 `说话人 | 时间戳 | 置信度标签颜色`。编辑不点开卡片也能快速定位证据来源。")
    h(doc, 2, "前端技术选型建议")
    bullets(doc, [
        "**框架**：React + TypeScript（交互状态管理成熟）",
        "**拖拽**：dnd-kit 或 react-beautiful-dnd",
        "**四象限图**：ECharts 散点图（中文文档好，上手快）",
        "**卡片渲染**：纯 CSS Grid/Flexbox",
        "**数据驱动**：所有卡片数据来自 `viewpoints.json`",
    ])

    # ---------- 七、数据缺失处理 ----------
    h(doc, 1, "七、数据缺失、噪声与冲突信号的处理策略")
    table(doc,
        ["信号类型", "检测方式", "处理方式", "责任归属"],
        [
            ["SRT 转录重复/乱码", "Agent 1 检测疑似重复或格式异常的段落", "标注 `transcript_issue: true`；推断正确内容写入 `inferred_text`；**不覆盖**原始转录", "编辑决定是否采纳推断"],
            ["嘉宾表述跳跃/断裂", "Agent 1 检测到上下文逻辑不连贯", "不强制合并——拆成独立节点，降低置信度为 medium", "编辑在写作阶段决定是否弥合"],
            ["嘉宾表述含混", "Agent 1 检测到语义不完整", "降低置信度为 low，标注 `needs_human_judgment: true`", "AI 不填补嘉宾没说清楚的内容"],
            ["两个嘉宾观点冲突", "Agent 2 检测同一话题下两个嘉宾的判断不一致", "保留双方观点，标注\u201c观点分歧：嘉宾A认为X，嘉宾B认为Y\u201d。AI 不做仲裁", "编辑决定：都呈现 / 只用一个 / 标注为\u201c不同视角\u201d"],
            ["历史笔记与当前素材重复", "Agent 2 识别 note_02 等同一场内容", "标注为 ❌ 不复用", "编辑确认"],
            ["历史笔记过时", "Agent 2 检查日期（>1 年）和可引用范围", "标注\u201c仅背景参考\u201d", "编辑决定是否保留"],
            ["缺少视频/分镜稿", "—", "在 `editorial_checks.md` 中明示缺失项", "编辑如有视频可补充判断"],
            ["样稿读取失败（sample_03）", "预处理流水线检测", "不阻塞流程——记录失败、降级为手动读取", "编辑手动查看并补充风格归纳"],
            ["外部数据无法核实", "Agent 4 外检 RAG 未找到匹配", "标注\u201c未找到独立核实来源\u201d——不假装知道", "编辑决定是否保留该论断或改为\u201c嘉宾称\u201d"],
        ],
        widths=[3.6, 3.6, 5.2, 4.0])

    # ---------- 八、质量 Rubric 汇总 ----------
    h(doc, 1, "八、关键节点的质量 Rubric 汇总")
    para(doc, "每个指标都有可执行的操作刻度：怎么打分、测什么、通过线在哪。编辑不需要凭感觉判断\u201c好不好\u201d。")
    table(doc,
        ["节点", "核心指标", "操作刻度（怎么打分）", "通过标准"],
        [
            ["Agent 1 观点提取", "观点密度、证据覆盖、分类准确", "LLM-as-judge 对每个节点打 1-5 分（能否回原文、分类是否合理）；随机抽 30% 节点反向定位原文；统计泛化句（\u201cAI很重要\u201d类）占比", "密度均分 ≥4；回源率 ≥90%；分类合理率 ≥80%；泛化句占比 <10%"],
            ["Agent 2 复用判断", "陷阱检测、时效判断、可用性判定", "检查 note_02 是否标记\u201c同一场/不复用\u201d；检查 >1 年笔记是否标\u201c仅背景参考\u201d；逐条检查判断理由是否具体", "note_02 识别率 100%（漏检即不通过）；过时标注率 100%；理由为空条目 = 0"],
            ["编辑角度选择", "—（纯人工步骤，不设自动化指标）", "—", "—"],
            ["Agent 3 内容生成", "风格一致、证据保真、结构可用、判断保留", "编辑按 1-5 打风格分；随机抽 20% 论述反向定位到观点节点；统计\u201c在当今时代\u201d类 AI 味开头次数；核对是否有语气升级（\u201c也许\u201d改\u201c一定\u201d）", "风格 ≥4 分；定位率 100%；AI 味开头 ≤1 次；语气升级 = 不通过；结构 10 分钟可改"],
            ["Agent 4 事实核查", "内检覆盖率、误报率、外检溯源、可操作性", "统计带时间戳论述的比对率；编辑复核标注后统计\u201c狼来了\u201d占比；检查每条外检结论是否有来源链接；检查每条标注是否有\u201c建议动作\u201d", "覆盖率 100%；误报率 <20%；无链接 = 不通过；缺建议动作 = 不通过"],
            ["最终文章", "观点密度、读者匹配、证据可溯源", "编辑终审 + 读者抽读反馈", "编辑通过 + 读者能追溯关键结论到原文（抽读可溯源率 ≥90%）"],
        ],
        widths=[2.8, 3.4, 6.2, 4.2])

    # ---------- 九、人机分工 ----------
    h(doc, 1, "九、人机分工总览")
    table(doc,
        ["环节", "AI 做", "人做"],
        [
            ["逐字稿通读", "✅ 自动提取观点，输出结构化节点", "❌ 不再需要通读 97 段"],
            ["找\u201c值得写的\u201d", "✅ 三维度分类 + 置信度 + 热点匹配，排序推荐", "✅ 最终决定哪些写、哪些不写"],
            ["选角度", "✅ 生成 3 个备选角度 + 理由", "✅ **必须人工选择**——这是不可跳过的决策关卡"],
            ["资料复用", "✅ 8 篇笔记逐一判断", "✅ 审核判断结果，特别关注有限复用"],
            ["写初稿", "✅ 按选定角度 + 观点节点生成分段草稿", "✅ 调整结构、添加个人判断和金句"],
            ["事实核查", "✅ 内检逐句回原文 + 外检 RAG 搜索", "✅ 确认每个标注，决定修改/保留/删除"],
            ["风格适配", "✅ 从样稿提取风格特征，应用到生成", "✅ 微调措辞使风格统一"],
            ["最终审稿", "❌ 不做——AI 不能代编辑拍板", "✅ **必须由人完成**——这是题目负责人的原话"],
        ],
        widths=[2.6, 7.6, 6.4])

    doc.save(path)
    print("saved:", path)

if __name__ == "__main__":
    import sys
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "docs"
    build_requirements(f"{out_dir}/requirements_definition.docx")
    build_solution(f"{out_dir}/solution_design.docx")
