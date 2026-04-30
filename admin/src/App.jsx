import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import BooksPage from "./pages/BooksPage";
import CasesPage from "./pages/CasesEditorPage";
import CommunityCalendarPage from "./pages/CommunityCalendarPage";
import DashboardPage from "./pages/DashboardPage";
import EducationCalendarPage from "./pages/EducationCalendarPage";
import EducationIntroPage from "./pages/EducationIntroPage";
import InquiriesPage from "./pages/InquiriesPage";
import LoginPage from "./pages/LoginPage";

function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="inquiries" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="inquiries" element={<InquiriesPage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="books" element={<BooksPage />} />
        <Route path="education-intro" element={<EducationIntroPage />} />
        <Route path="education-calendar" element={<EducationCalendarPage />} />
        <Route path="community-calendar" element={<CommunityCalendarPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}

export default App;
