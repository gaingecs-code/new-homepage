const ts = "2026-04-28T00:00:00.000Z";

export const defaultCasesData = {
  updatedAt: ts,
  items: [
    {
      id: "case-1",
      slug: "sample-case-1",
      title: "고객 사례 샘플 1",
      authorName: "작성자 1",
      industryTags: ["ICT·전자"],
      companySize: "10~20인",
      consultingTypeTags: ["HR 컨설팅"],
      content:
        "여기에 고객 사례 본문을 작성합니다.\n문단은 줄바꿈으로 구분할 수 있습니다.",
      imageUrl: "assets/간증 이미지 샘플 1.jpg",
      contentBlocks: [
        {
          id: "block-1",
          type: "text",
          text: "여기에 고객 사례 본문을 작성합니다.\n문단은 줄바꿈으로 구분할 수 있습니다.",
        },
        {
          id: "block-2",
          type: "image",
          imageUrl: "assets/간증 이미지 샘플 1.jpg",
          caption: "사례 대표 이미지",
          align: "center",
        },
      ],
      link: "story-testimonial-1.html",
      status: "published",
      publishedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
  ],
};
