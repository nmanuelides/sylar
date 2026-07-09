import { Navigate, Route, Routes } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Toasts } from '@/components/common/Toasts';
import { EditorPage } from '@/pages/editor/EditorPage';
import { MyWatchfacesPage } from '@/pages/watchfaces/MyWatchfacesPage';
import { CommunityPage } from '@/pages/community/CommunityPage';
import { DocsPage } from '@/pages/docs/DocsPage';

export function App() {
  return (
    <div className="app">
      <TopBar />
      <main className="app__page">
        <Routes>
          <Route path="/" element={<Navigate to="/watchfaces" replace />} />
          <Route path="/create" element={<EditorPage />} />
          <Route path="/create/:id" element={<EditorPage />} />
          <Route path="/watchfaces" element={<MyWatchfacesPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="*" element={<Navigate to="/watchfaces" replace />} />
        </Routes>
      </main>
      <Toasts />
    </div>
  );
}
