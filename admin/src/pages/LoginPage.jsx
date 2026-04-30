import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { signInWithPassword, supabaseEnabled } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const redirectTo = location.state?.from?.pathname || "/admin/inquiries";

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await signInWithPassword(email, password);
    if (error) {
      setMessage(`로그인 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  function fillDemoAndSubmit() {
    setEmail("admin@local");
    setPassword("demo1234");
  }

  return (
    <main className="center-screen">
      <form className="panel auth-panel" onSubmit={handleSubmit}>
        <h1 className="page-title">Admin 로그인</h1>
        <p className="auth-help">
          {supabaseEnabled
            ? "Supabase 계정으로 로그인하세요."
            : "환경변수가 없어 데모 모드입니다. 아무 이메일/비밀번호로 로그인할 수 있습니다."}
        </p>

        <label className="field">
          <span>이메일</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
          />
        </label>

        <label className="field">
          <span>비밀번호</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {!supabaseEnabled && (
          <button className="btn btn-outline" type="button" onClick={fillDemoAndSubmit}>
            데모 입력 채우기
          </button>
        )}

        {message && <p className="error-text">{message}</p>}
      </form>
    </main>
  );
}
