import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppRuntime } from './app/AppRuntime';
import { SettingsProvider } from './hooks/useSettings';
import { ToastProvider } from './components/ui/Toast';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { NewReportPage } from './pages/NewReportPage';
import { ReportFormPage } from './pages/ReportFormPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TemplateBuilderPage } from './pages/TemplateBuilderPage';
import { SettingsPage } from './pages/SettingsPage';
import { RecipientsPage } from './pages/RecipientsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppRuntime>
        <SettingsProvider>
          <ToastProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="new" element={<NewReportPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="reports/new/:templateId" element={<ReportFormPage />} />
                <Route path="reports/:id/edit" element={<ReportFormPage />} />
                <Route path="reports/:id" element={<ReportDetailPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="templates/new" element={<TemplateBuilderPage />} />
                <Route path="templates/:id" element={<TemplateBuilderPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/recipients" element={<RecipientsPage />} />
                <Route path="*" element={<HomePage />} />
              </Route>
            </Routes>
          </ToastProvider>
        </SettingsProvider>
      </AppRuntime>
    </BrowserRouter>
  );
}
