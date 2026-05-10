const SCHEMA_SNIPPET = `{
  "version": 1,
  "locale": "vi-VN",
  "title": "Ngân hàng do AI sinh",
  "periods": [
    {
      "id": "period-slug-unique",
      "label": "Tên hiển thị đầy đủ",
      "shortLabel": "Ngắn",
      "range": { "startYear": 1000, "endYear": 1200 },
      "color": "#c9a227",
      "order": 1,
      "summary": "Mô tả tooltip"
    }
  ],
  "questions": [
    {
      "id": "q-mc-1",
      "type": "multiple_choice",
      "periodId": "period-slug-unique",
      "difficulty": "medium",
      "tags": [],
      "stem": "Câu hỏi?",
      "options": [
        { "id": "a", "text": "Đáp án A" },
        { "id": "b", "text": "Đáp án B" },
        { "id": "c", "text": "Đáp án C" },
        { "id": "d", "text": "Đáp án D" }
      ],
      "correctOptionId": "a",
      "explanation": "Giải thích chi tiết.",
      "media": null,
      "points": 10
    },
    {
      "id": "q-mp-1",
      "type": "match_pairs",
      "periodId": "period-slug-unique",
      "difficulty": "easy",
      "tags": [],
      "stem": "Nối cột trái và phải.",
      "pairs": [
        { "leftId": "L1", "leftText": "Mốc A", "rightId": "R1", "rightText": "Ý nghĩa A" }
      ],
      "explanation": "Giải thích.",
      "media": null
    },
    {
      "id": "q-ts-1",
      "type": "timeline_sort",
      "periodId": "period-slug-unique",
      "difficulty": "hard",
      "tags": [],
      "stem": "Sắp xếp sớm → muộn.",
      "items": [
        { "id": "i1", "label": "Sự kiện 1" },
        { "id": "i2", "label": "Sự kiện 2" }
      ],
      "correctOrder": ["i1", "i2"],
      "explanation": "Giải thích.",
      "media": null
    }
  ]
}`;

export function buildAiPromptTemplate() {
  return [
    "Bạn là biên tập học liệu Lịch sử THCS Việt Nam.",
    "Nhiệm vụ: Từ đoạn bài học người dùng cung cấp bên dưới, hãy sinh ĐÚNG MỘT file JSON hợp lệ theo schema QuestionBank.",
    "Quy tắc:",
    "- Chỉ trả về JSON thuần, không markdown, không giải thích ngoài JSON.",
    "- id của periods và questions phải là chữ latin, số, gạch ngang; không trùng nhau trong file.",
    "- Mỗi câu phải có explanation đầy đủ.",
    "- Ưu tiên đủ 3 loại: multiple_choice (4 phương án), match_pairs (3 cặp), timeline_sort (ít nhất 3 mục).",
    "- difficulty: easy | medium | hard.",
    "",
    "Schema mẫu (tuân thủ cấu trúc):",
    SCHEMA_SNIPPET,
    "",
    "Đoạn bài học:",
    "<<<DÁN NỘI DUNG BÀI HỌC VÀO ĐÂY>>>",
  ].join("\n");
}
