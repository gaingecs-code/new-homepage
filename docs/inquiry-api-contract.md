# 문의 API 계약 (사전 고정)

이 문서는 `컨설팅 문의하기 / 교육 문의하기` 폼의 서버 연동 전에 payload/response를 고정하기 위한 계약서입니다.

## 1) 요청 스키마 (POST JSON)

```json
{
  "schemaVersion": "v1",
  "inquiry": {
    "id": "inq_1715000000000_ab12cd",
    "createdAt": "2026-05-06T07:00:00.000Z",
    "company": "가인지",
    "name": "홍길동 / 대표",
    "phone": "010-0000-0000",
    "email": "hello@example.com",
    "message": "문의 내용",
    "recipientEmail": "gainge.cs@gainge.com",
    "source": {
      "page": "/story-inquiry-popup.html",
      "type": "consulting"
    },
    "schemaVersion": "v1"
  },
  "email": {
    "to": "gainge.cs@gainge.com",
    "subject": "[가인지] 상담 문의 접수 - 가인지",
    "text": "메일 본문(줄바꿈 문자열)"
  },
  "meta": {
    "requestedAt": "2026-05-06T07:00:00.000Z",
    "channel": "web_form"
  }
}
```

### `source.type` 권장값
- `consulting`
- `education`
- `general`

## 2) 응답 스키마 (성공)

```json
{
  "ok": true,
  "inquiryId": "inq_1715000000000_ab12cd",
  "mailed": true,
  "message": "문의가 정상 접수되었습니다."
}
```

## 3) 응답 스키마 (실패)

HTTP status는 4xx/5xx 사용 권장.

```json
{
  "ok": false,
  "message": "유효성 검사 실패",
  "code": "INVALID_PAYLOAD"
}
```

## 4) 프론트 인터페이스

`js/inquiry.js`에서 아래 인터페이스를 이미 노출합니다.

- `window.GaingeInquiryApi.version`
- `window.GaingeInquiryApi.buildInquiryPayload(formData)`
- `window.GaingeInquiryApi.buildEmailPayload(inquiry)`
- `window.GaingeInquiryApi.submit(envelope)`

## 5) 현재 동작(연동 전)

- API URL 미설정 시: 문의는 로컬에 저장되고(`GAINGE_INQUIRIES`, `admin.local.inquiries.v1`) 성공 피드백 표시
- API URL 설정 시: 위 요청 스키마로 POST 전송

## 6) API 연결 시 체크리스트

- 서버에서 DB 저장 성공 + 메일 발송 성공 여부(`mailed`)를 함께 반환
- 실패 시 프론트는 "저장됨/전송실패"를 분리해 안내
- 중복 제출 방지: `inquiry.id` 기반 멱등 처리 권장
