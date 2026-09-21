import React, { useState, useEffect } from 'react';
import { 
  Shield, Zap, Users, Building2, Calendar, LogOut, 
  Sun, Moon, Activity, Cpu, Sparkles 
} from 'lucide-react';
import Login from './pages/Login';
import ProsumerManagement from './pages/ProsumerManagement';
import StationManagement from './pages/StationManagement';
import ReservationManagement from './pages/ReservationManagement';
import StaffManagement from './pages/StaffManagement';
import OperatorDashboard from './pages/OperatorDashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('prosumers');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    // Check dark mode
    const savedTheme = localStorage.getItem('solvance_theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Check user session
    const savedUser = localStorage.getItem('solar_user_data');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        if (parsed.role === 'GridOperator') {
          setCurrentTab('terminal');
        }
      } catch (e) {
        localStorage.removeItem('solar_user_data');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('solvance_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    if (userData.role === 'GridOperator') {
      setCurrentTab('terminal');
    } else {
      setCurrentTab('prosumers');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('solar_auth_token');
    localStorage.removeItem('solar_user_data');
    setUser(null);
  };

  if (!user) {
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  const isBackoffice = user.role === 'Backoffice';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img
                src={theme === 'dark' ? '/solvance_logo_dark_trans.png?v=5' : '/solvance_logo_light_trans.png?v=5'}
                alt="Solvance"
                className="h-9 w-auto"
              />
              <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
                ENTERPRISE CONSOLE
              </span>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1.5">
              {isBackoffice && (
                <>
                  <button
                    onClick={() => setCurrentTab('prosumers')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      currentTab === 'prosumers'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>Prosumer KYC</span>
                  </button>

                  <button
                    onClick={() => setCurrentTab('stations')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      currentTab === 'stations'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Microgrid Nodes</span>
                  </button>

                  <button
                    onClick={() => setCurrentTab('reservations')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      currentTab === 'reservations'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Energy Bookings</span>
                  </button>

                  <button
                    onClick={() => setCurrentTab('staff')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      currentTab === 'staff'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    <span>Staff Accounts</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setCurrentTab('terminal')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  currentTab === 'terminal'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Zap className="h-4 w-4" />
                <span>Operator Terminal</span>
              </button>
            </nav>

            {/* User Profile & Theme Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{user.fullName}</span>
                <span className={`text-[10px] font-bold ${isBackoffice ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {user.role} ({user.nic})
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Submenu Tabs */}
        <div className="md:hidden flex overflow-x-auto px-4 py-2 border-t border-slate-200 dark:border-slate-800 gap-1">
          {isBackoffice && (
            <>
              <button
                onClick={() => setCurrentTab('prosumers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  currentTab === 'prosumers' ? 'bg-amber-500 text-slate-950' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Prosumers
              </button>
              <button
                onClick={() => setCurrentTab('stations')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  currentTab === 'stations' ? 'bg-amber-500 text-slate-950' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Stations
              </button>
              <button
                onClick={() => setCurrentTab('reservations')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  currentTab === 'reservations' ? 'bg-amber-500 text-slate-950' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Bookings
              </button>
              <button
                onClick={() => setCurrentTab('staff')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  currentTab === 'staff' ? 'bg-amber-500 text-slate-950' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Staff
              </button>
            </>
          )}
          <button
            onClick={() => setCurrentTab('terminal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
              currentTab === 'terminal' ? 'bg-emerald-500 text-slate-950' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Operator
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'prosumers' && <ProsumerManagement theme={theme} />}
        {currentTab === 'stations' && <StationManagement theme={theme} />}
        {currentTab === 'reservations' && <ReservationManagement theme={theme} />}
        {currentTab === 'staff' && <StaffManagement theme={theme} />}
        {currentTab === 'terminal' && <OperatorDashboard theme={theme} />}
      </main>
    </div>
  );
}
