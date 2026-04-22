import { useAuthStore } from '../store/authStore';
import AdminDashboard from './AdminDashboard';
import AnalystDashboard from './AnalystDashboard';
import EditorDashboard from './EditorDashboard';

export default function Dashboard() {
  const { user } = useAuthStore();

  switch (user?.role) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'EDITOR':
      return <EditorDashboard />;
    case 'ANALYST':
    default:
      // Default to analyst view if role is somehow missing
      return <AnalystDashboard />;
  }
}
