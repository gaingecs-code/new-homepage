const ts = "2026-04-28T00:00:00.000Z";

function entries() {
  return {
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "6": [],
    "7": [],
    "8": [],
    "9": [],
    "10": [],
    "11": [],
    "12": [],
  };
}

export const defaultEducationCalendarData = {
  title: "기업교육 캘린더",
  guide: "정확한 교육일정은 가인지캠퍼스 교육페이지를 확인해주세요.",
  updatedAt: ts,
  rows: [
    {
      id: "education-row-4",
      program: "OKR 코치자격증",
      monthEntries: {
        ...entries(),
        "2": [{ id: "e4-2-1", label: "4일", link: "" }],
        "5": [
          { id: "e4-5-1", label: "6일", link: "" },
          { id: "e4-5-2", label: "13일", link: "" },
        ],
        "7": [
          { id: "e4-7-1", label: "15일", link: "" },
          { id: "e4-7-2", label: "22일", link: "" },
        ],
        "10": [{ id: "e4-10-1", label: "28일", link: "" }],
        "11": [{ id: "e4-11-1", label: "4일", link: "" }],
      },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: "education-row-5",
      program: "원온원 코치자격증",
      monthEntries: {
        ...entries(),
        "2": [
          { id: "e5-2-1", label: "3일", link: "" },
          { id: "e5-2-2", label: "10일", link: "" },
        ],
        "5": [
          { id: "e5-5-1", label: "1일", link: "" },
          { id: "e5-5-2", label: "18일", link: "" },
        ],
        "10": [
          { id: "e5-10-1", label: "27일", link: "" },
          { id: "e5-10-2", label: "3일", link: "" },
        ],
      },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: "education-row-6",
      program: "팀장스쿨",
      monthEntries: {
        ...entries(),
        "2": [{ id: "e6-2-1", label: "4일", link: "" }],
        "4": [{ id: "e6-4-1", label: "29일", link: "" }],
        "6": [{ id: "e6-6-1", label: "10일", link: "" }],
        "8": [{ id: "e6-8-1", label: "19일", link: "" }],
        "10": [{ id: "e6-10-1", label: "14일", link: "" }],
        "12": [{ id: "e6-12-1", label: "2일", link: "" }],
      },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: "education-row-7",
      program: "직장인 학교",
      monthEntries: {
        ...entries(),
        "1": [{ id: "e7-1-1", label: "22일", link: "" }],
        "4": [{ id: "e7-4-1", label: "8일", link: "" }],
        "7": [{ id: "e7-7-1", label: "8일", link: "" }],
        "9": [{ id: "e7-9-1", label: "9일", link: "" }],
        "11": [{ id: "e7-11-1", label: "18일", link: "" }],
      },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: "education-row-10",
      program: "면접관 교육",
      monthEntries: { ...entries(), "4": [{ id: "e10-4-1", label: "15일", link: "" }] },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: "education-row-11",
      program: "강점 기반 영업 워크샵",
      monthEntries: {
        ...entries(),
        "3": [
          { id: "e11-3-1", label: "14일", link: "" },
          { id: "e11-3-2", label: "21일", link: "" },
        ],
        "6": [
          { id: "e11-6-1", label: "13일", link: "" },
          { id: "e11-6-2", label: "27일", link: "" },
        ],
      },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: "education-row-12",
      program: "평가 보상 워크샵",
      monthEntries: {
        ...entries(),
        "8": [{ id: "e12-8-1", label: "26일", link: "" }],
        "9": [{ id: "e12-9-1", label: "2일", link: "" }],
      },
      createdAt: ts,
      updatedAt: ts,
    },
  ],
};
