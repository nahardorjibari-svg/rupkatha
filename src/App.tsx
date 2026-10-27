/**
 * Rupkatha Apparels Ltd. - Knit and Woven Garments ERP
 * Main Application Root
 */
import { CompanyProvider } from './context/CompanyContext';
import { UnitProvider } from './context/UnitContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <ThemeProvider>
      <CompanyProvider>
        <UnitProvider>
          <AuthProvider>
            <SidebarProvider>
              <AppRoutes />
            </SidebarProvider>
          </AuthProvider>
        </UnitProvider>
      </CompanyProvider>
    </ThemeProvider>
  );
}
