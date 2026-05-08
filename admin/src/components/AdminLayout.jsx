import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const menus = [
  { to: "/admin/inquiries", label: "문의 관리" },
  { to: "/admin/books", label: "가인지 도서 관리" },
  { to: "/admin/cases", label: "고객 사례 관리" },
  { to: "/admin/education-intro", label: "기업교육 프로그램" },
  { to: "/admin/education-calendar", label: "기업교육 캘린더" },
  { to: "/admin/community-calendar", label: "커뮤니티 캘린더" },
];

export default function AdminLayout() {
  const { signOut, user, isLocalMode, supabaseEnabled } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="admin-shell" translate="no">
      <aside className="sidebar">
        <h1 className="sidebar-title">Admin</h1>
        <nav className="sidebar-nav" translate="no">
          {menus.map((menu) => (
            <NavLink
              key={menu.to}
              to={menu.to}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " sidebar-link--active" : ""}`
              }
            >
              <span translate="no">{menu.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className="admin-content">
        <header className="topbar">
          <div>
            <p className="topbar-title">관리자 페이지</p>
            <p className="topbar-sub">
              {isLocalMode
                ? "Local JSON 모드"
                : supabaseEnabled
                  ? "Remote DB 모드 (Supabase)"
                  : "Remote DB 모드(환경변수 미설정)"}
            </p>
          </div>
          <div className="topbar-actions">
            <span className="user-email">{user?.email ?? "unknown"}</span>
            <button className="btn btn-outline" onClick={handleLogout} type="button">
              로그아웃
            </button>
          </div>
        </header>
        <main className="page-wrap">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
