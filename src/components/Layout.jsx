import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  Database,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Network,
  Target
} from 'lucide-react'
import { useState } from 'react'

function Layout({ onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [dataManagementOpen, setDataManagementOpen] = useState(false)
  const location = useLocation()
  
  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/dashboard') return 'Dashboard'
    if (path.startsWith('/data-management/performance')) return 'Performance Management'
    if (path.startsWith('/data-management/target')) return 'Target Settings'
    // Clustering page removed
    return 'Dashboard'
  }
  
  const pageTitle = getPageTitle()

  const isDataManagementActive = ['/data-management/performance', '/data-management/target'].some(path => 
    location.pathname.startsWith(path)
  )

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Dark Theme */}
      <aside className={`fixed top-0 left-0 h-full bg-slate-900 border-r border-slate-800 z-30 transform transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${sidebarCollapsed ? 'w-20' : 'w-60'}`}>
        {/* Logo */}
        <div className={`border-b border-slate-800 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${sidebarCollapsed ? 'gap-1' : 'gap-3'}`}>
              <div className={`${sidebarCollapsed ? 'w-8 h-8' : 'w-12 h-12'} bg-white rounded-xl shadow-lg flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                <img 
                  src="/logo.png" 
                  alt="East Equator" 
                  className="w-full h-full object-contain"
                />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h1 className="text-base font-bold text-white">Performance Management</h1>
                  <p className="text-[10px] text-slate-400">East Equator Express Philippines Inc.</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex items-center justify-center w-8 h-8 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all duration-200 hover:scale-105 flex-shrink-0"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-2">
          <ul className="space-y-1">
            {/* Dashboard */}
            <li>
              <NavLink
                to="/dashboard"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-maroon-600 text-white font-medium shadow-lg shadow-maroon-600/25'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-white hover:translate-x-1'
                  }`
                }
                title="Dashboard"
              >
                <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-xs">Dashboard</span>}
              </NavLink>
            </li>

            {/* Data Management with submenu */}
            <li>
              <button
                onClick={() => !sidebarCollapsed && setDataManagementOpen(!dataManagementOpen)}
                className={`flex items-center w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'} py-3 rounded-xl transition-all duration-200 ${
                  isDataManagementActive
                    ? 'bg-maroon-600 text-white font-medium shadow-lg shadow-maroon-600/25'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white hover:translate-x-1'
                }`}
                title="Data Management"
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'gap-3'}`}>
                  <Database className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="text-xs">Data Management</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform ${dataManagementOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              
              {dataManagementOpen && !sidebarCollapsed && (
                <ul className="mt-1 ml-4 pl-4 border-l-2 border-slate-700 space-y-1">
                  <li>
                    <NavLink
                      to="/data-management/performance"
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center text-xs gap-3 px-4 py-2 rounded-lg transition ${
                          isActive
                            ? 'bg-maroon-600/50 text-maroon-400 font-medium'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`
                      }
                    >
                      <BarChart3 className="w-4 h-4" />
                      Performance
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/data-management/target"
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center text-xs gap-3 px-4 py-2 rounded-lg transition ${
                          isActive
                            ? 'bg-maroon-600/50 text-maroon-400 font-medium'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`
                      }
                    >
                      <Target className="w-4 h-4" />
                      Target
                    </NavLink>
                  </li>
                  {/* Clustering removed */}
                </ul>
              )}
            </li>
          </ul>
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-slate-800">
          <button
            onClick={onLogout}
            className={`flex items-center w-full text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all duration-200 ${sidebarCollapsed ? 'justify-center py-3 px-2' : 'gap-3 px-4 py-3'}`}
            title="Logout"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'} min-h-screen bg-slate-900 transition-all duration-300`}>
        {/* Header */}
        <header 
          className="border-b border-slate-800/50 p-4 flex items-center justify-between z-[60] backdrop-blur-md h-[111px] w-full relative bg-slate-800/80"
        >
          {/* Background image at 50% opacity */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'url(/east_equator_express_cover.jpg)',
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.5,
              zIndex: -1
            }}
          />
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
          <div></div>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
