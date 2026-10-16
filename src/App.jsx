import { AuthProvider } from './contexts/AuthContext';
import { PontosProvider } from './contexts/PontosContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <AuthProvider>
      <PontosProvider>
        <AppRoutes />
      </PontosProvider>
    </AuthProvider>
  );
}
