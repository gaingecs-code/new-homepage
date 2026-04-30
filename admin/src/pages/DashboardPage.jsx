export default function DashboardPage() {
  return (
    <section className="page">
      <h2 className="page-title">대시보드</h2>
      <div className="cards">
        <article className="card">
          <p className="card-label">오늘 문의</p>
          <p className="card-value">3</p>
        </article>
        <article className="card">
          <p className="card-label">미처리 문의</p>
          <p className="card-value">1</p>
        </article>
        <article className="card">
          <p className="card-label">게시된 사례</p>
          <p className="card-value">1</p>
        </article>
      </div>
      <p className="muted">다음 단계에서 Supabase 데이터로 카드 값을 연결합니다.</p>
    </section>
  );
}
