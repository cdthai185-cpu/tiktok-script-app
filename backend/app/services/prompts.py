from __future__ import annotations

# Tốc độ nói tiếng Việt trên TikTok (từ / phút)
# Thay đổi theo tone: chậm sâu, bình thường, nhanh sôi nổi.
BASE_WPM = 140
TONE_WPM = {
    "default": 140,
    "humor": 155,       # hơi nhanh, giọng vui
    "deep": 120,        # chậm, ngẫm
    "storytelling": 135,  # nhẹ, đều
    "energetic": 170,   # sôi nổi, câu ngắn
    "selfmock": 145,    # tự trào, tự nhiên
}


def word_range(duration_seconds: int, tone: str = "default") -> tuple[int, int, int]:
    """
    Trả (min, target, max) số từ tiếng Việt cho video dài duration_seconds.
    Range ±15% quanh target để LLM có chỗ thở.
    """
    wpm = TONE_WPM.get(tone, BASE_WPM)
    target = max(30, int(duration_seconds * wpm / 60))
    delta = max(10, int(target * 0.15))
    return max(20, target - delta), target, target + delta


TONE_INSTRUCTIONS = {
    "default": (
        "**GIỌNG:** 70% gần gũi đời thường — 20% hài nhẹ — 10% sâu sắc. "
        "Nói miệng vlog, tự trào, câu ngắn."
    ),
    "humor": (
        "**GIỌNG NGẢ SANG HÀI NHẸ:** 50% gần gũi — 40% hài nhẹ — 10% sâu. "
        "Cho phép than thở vui, tự cười mình rõ hơn. KHÔNG hài quá đà mất uy tín."
    ),
    "deep": (
        "**GIỌNG NGẢ SANG SÂU:** 40% gần gũi — 10% hài — 50% sâu sắc. "
        "Câu suy ngẫm, nhịp chậm, kết mở để người xem tự nghĩ. "
        "VẪN không lên lớp — sâu qua chi tiết đời thường."
    ),
    "storytelling": (
        "**GIỌNG KỂ CHUYỆN:** mở đầu 'Hôm nọ...' hoặc 'Có lần...'. "
        "Chi tiết hoá tình huống theo thời gian. Kể như đang ngồi nói cho bạn nghe."
    ),
    "energetic": (
        "**GIỌNG SÔI NỔI, NHẤN MẠNH:** câu ngắn dồn dập, ngữ khí mạnh. "
        "Cho phép 'vãi', 'thật sự luôn', 'trời ơi'. Điểm nhấn cảm xúc rõ."
    ),
    "selfmock": (
        "**GIỌNG TỰ TRÀO ĐẬM:** thừa nhận cái dở/sai lầm ngay hook. "
        "Chê chính mình. Cuối kịch bản mới ngầm rút ra bài học từ trải nghiệm."
    ),
}


BASE_SYSTEM_RULES = """\
Bạn là copywriter viết kịch bản TikTok cho nhân vật trong HỒ SƠ PHONG CÁCH dưới đây.

# NGUYÊN TẮC TUYỆT ĐỐI (vi phạm = bản FAIL)

1. **XƯNG HÔ**: Tự xưng "em". Gọi người xem "các bác". Cấm: "tôi/bạn", "tao/mày", "anh em", "mọi người".

2. **CẤU TRÚC**:
   - HOOK 3 giây đầu: gây tò mò, chạm vấn đề, hoặc thừa nhận sai/dở.
   - TÌNH HUỐNG/CÂU CHUYỆN: kể như đang vlog tại chỗ, không "đúc kết" trên cao.
   - THÔNG ĐIỆP NGẦM: không lên lớp. Người xem tự rút.
   - KẾT: câu hỏi ngược cho khán giả HOẶC câu suy ngẫm mở.

3. **CÂU HỎI NGƯỢC**: ≥1 câu hỏi cho người xem để kéo tương tác.

4. **KEYWORD**: cài tự nhiên ≥1 keyword chính trong câu chuyện (không như hashtag).
   Keyword chính: Cai Duy Thái · 24 tuổi · 6 năm kinh nghiệm · Giám đốc ASKO Việt Nam · thiết bị bếp · thiết bị phòng tắm.

5. **CẤM**:
   - Khoe chức danh trực tiếp ("em là Giám đốc..." → SAI; "hôm nọ em đi gặp khách..." → ĐÚNG).
   - Khoe tiền/thành tích lộ liễu.
   - Dạy đời, ra vẻ chuyên gia, tổng kết kiểu "bài học là...".
   - Drama bẩn, giật tít lừa, công kích đối thủ.
   - Nhắc trend/âm thanh/câu viral cụ thể (app không xài trend).
   - Câu văn vở, sáo rỗng, generic ai cũng nói được.

# OUTPUT
Trả về DUY NHẤT kịch bản lời thoại. KHÔNG ghi "Hook:", "Thân:", "Kết:". Viết liền mạch như đang nói.
KHÔNG kèm hướng dẫn cảnh, ghi chú đạo diễn, hashtag, hay metadata.
Sau kịch bản, để 1 dòng trống rồi ghi:
[GỢI Ý HÌNH]: 2-3 gạch đầu dòng ngắn gợi ý cảnh quay/B-roll.
"""


def build_system_prompt(
    profile_md: str,
    samples: list[str],
    duration_seconds: int = 60,
    tone: str = "default",
) -> str:
    wmin, wtarget, wmax = word_range(duration_seconds, tone)
    tone_ins = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["default"])

    length_rule = (
        f"\n# ĐỘ DÀI (bắt buộc)\n"
        f"Video dài **{duration_seconds} giây** → kịch bản khoảng **{wtarget} từ tiếng Việt** "
        f"(chấp nhận {wmin}-{wmax} từ).\n"
        f"Đếm và đảm bảo trong khoảng. Ngắn hơn = video hụt hơi. Dài hơn = phải cắt.\n"
    )
    tone_rule = f"\n# VĂN PHONG BẢN NÀY\n{tone_ins}\n"

    parts = [BASE_SYSTEM_RULES, length_rule, tone_rule,
             "\n---\n\n# HỒ SƠ PHONG CÁCH\n\n", profile_md]

    if samples:
        parts.append("\n\n---\n\n# MẪU GIỌNG THẬT — BẮT CHƯỚC VĂN PHONG NÀY\n")
        for i, s in enumerate(samples, 1):
            parts.append(f"\n### Mẫu {i}\n{s}\n")
        parts.append(
            "\n**Học VĂN PHONG, XƯNG HÔ, NHỊP CÂU** từ mẫu. "
            "KHÔNG copy nội dung — nội dung phải khớp mô tả video user đưa.\n"
        )
    return "".join(parts)


def build_user_prompt(
    input_text: str,
    context_qa: str = "",
    variant_index: int = 0,
) -> str:
    nudge = ""
    if variant_index == 1:
        nudge = "\n\nGợi ý bản này: thử mở bằng một SAI LẦM hoặc KHOẢNH KHẮC ĐỜI THƯỜNG bất ngờ."
    elif variant_index == 2:
        nudge = "\n\nGợi ý bản này: thử mở bằng một CÂU HỎI THẲNG khiến người trong ngành phải nghĩ."

    context_block = ""
    if context_qa.strip():
        context_block = (
            f"\n\n# CHI TIẾT VIDEO (user đã trả lời để bám sát)\n"
            f"```\n{context_qa.strip()}\n```\n"
            f"→ ĐƯA CÁC CHI TIẾT NÀY vào kịch bản. Đặc biệt: tôn trọng "
            f"MỐC THỜI GIAN, ĐIỂM NHẤN CẢM XÚC, và QUOTE THẬT nếu có."
        )

    return (
        f"Đây là mô tả video em (Cai Duy Thái) muốn quay:\n\n"
        f"```\n{input_text.strip()}\n```"
        f"{context_block}\n\n"
        f"Viết 1 kịch bản lời thoại bám đúng hồ sơ + giọng mẫu + độ dài yêu cầu, kèm gợi ý hình."
        f"{nudge}"
    )


CRITIQUE_PROMPT = """\
Chấm kịch bản dưới đây theo 9 tiêu chí. Trả JSON đúng format, KHÔNG kèm gì khác.

Kịch bản:
```
{script}
```

Mô tả gốc video:
```
{input}
```

Độ dài yêu cầu: {wmin}-{wmax} từ (target {wtarget}).

Hồ sơ phong cách:
```
{profile_excerpt}
```

Tiêu chí (mỗi cái "pass": true/false + "reason" ngắn 1 câu):
1. xưng_hô — Dùng "em/các bác" xuyên suốt, không "tôi/bạn"?
2. độ_dài — Đếm thử có nằm trong {wmin}-{wmax} từ không?
3. có_hook — 1-2 câu đầu níu người xem (tò mò/sai lầm/vấn đề)?
4. câu_hỏi_ngược — Có ≥1 câu hỏi cho khán giả?
5. giọng_đời_thường — Nói miệng vlog tại chỗ, không văn vở/sáo rỗng?
6. không_khoe — Không khoe chức/tiền/thành tích lộ liễu?
7. không_lên_lớp — Không tổng kết kiểu "bài học là...", không dạy đời?
8. keyword_tự_nhiên — Có ≥1 keyword chính cài tự nhiên?
9. đúng_đối_tượng — Người trong ngành (sale, kỹ thuật, KTS, nội thất) thấy mình trong đó?

Format JSON BẮT BUỘC:
{{
  "scores": {{
    "xưng_hô": {{"pass": true, "reason": "..."}},
    "độ_dài": {{"pass": true, "reason": "..."}},
    "có_hook": {{"pass": true, "reason": "..."}},
    "câu_hỏi_ngược": {{"pass": true, "reason": "..."}},
    "giọng_đời_thường": {{"pass": true, "reason": "..."}},
    "không_khoe": {{"pass": true, "reason": "..."}},
    "không_lên_lớp": {{"pass": true, "reason": "..."}},
    "keyword_tự_nhiên": {{"pass": true, "reason": "..."}},
    "đúng_đối_tượng": {{"pass": true, "reason": "..."}}
  }},
  "overall_pass": true,
  "summary": "1-2 câu nhận xét tổng quát."
}}

Bản PASS = tất cả 9 tiêu chí pass. 1 fail → overall_pass = false.
"""


def build_critique_prompt(
    script: str,
    input_text: str,
    profile_md: str,
    duration_seconds: int = 60,
    tone: str = "default",
) -> str:
    wmin, wtarget, wmax = word_range(duration_seconds, tone)
    return CRITIQUE_PROMPT.format(
        script=script,
        input=input_text,
        profile_excerpt=profile_md[:1500],
        wmin=wmin, wtarget=wtarget, wmax=wmax,
    )


# =============================================================
# Q&A: sinh câu hỏi cụ thể cho video để user trả lời trước khi
# app sinh kịch bản chi tiết (bám sát video).
# =============================================================

QUESTION_PROMPT = """\
Nhân vật: Cai Duy Thái, làm content TikTok về thiết bị bếp/phòng tắm.
Anh ấy đang chuẩn bị quay 1 video dài **{duration_seconds} giây**.

Mô tả THÔ của anh ấy về video này:
```
{input}
```

Nhiệm vụ: sinh **5 câu hỏi CỤ THỂ, sát video này** để anh ấy trả lời, giúp
kịch bản chi tiết bám sát cảnh quay và cảm xúc thật.

Câu hỏi phải:
- Bám vào NỘI DUNG cụ thể anh đưa (không generic "video có gì hay?" mà phải nhắc chi tiết).
- Hỏi về MỐC THỜI GIAN cụ thể (vd "giây 5 quay gì?", "đoạn giữa nhấn cảm xúc nào?").
- Hỏi về CẢM XÚC thật anh muốn truyền tải.
- Hỏi về QUOTE THẬT / PHẢN ỨNG KHÁCH nếu có.
- Hỏi về ĐIỂM BẤT NGỜ / CAO TRÀO nếu có.

KHÔNG hỏi: chức danh, keyword muốn nhét, format video (đã cố định).

Trả JSON:
{{
  "questions": [
    "Câu hỏi 1...?",
    "Câu hỏi 2...?",
    "Câu hỏi 3...?",
    "Câu hỏi 4...?",
    "Câu hỏi 5...?"
  ]
}}
"""


def build_questions_prompt(input_text: str, duration_seconds: int) -> str:
    return QUESTION_PROMPT.format(
        input=input_text.strip(),
        duration_seconds=duration_seconds,
    )
