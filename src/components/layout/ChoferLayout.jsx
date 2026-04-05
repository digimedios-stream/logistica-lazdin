import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

const NAV_ITEMS = [
  { to: '/chofer', icon: 'dashboard', label: 'Inicio', end: true },
  { to: '/chofer/turno', icon: 'play_circle', label: 'Turno' },
  { to: '/chofer/combustible', icon: 'local_gas_station', label: 'Combustible' },
  { to: '/chofer/novedades', icon: 'report', label: 'Novedades' },
  { to: '/chofer/adicionales', icon: 'add_task', label: 'Adicionales' },
]

export default function ChoferLayout() {
  const { choferData, logout } = useAuth()
  const { tema, esTercero, nombreMostrar } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-lazdin-bg">
      {/* Header con branding dinámico */}
      <header className={`fixed top-0 w-full z-50 bg-slate-900/95 backdrop-blur-md shadow-lg border-b border-slate-800 ${esTercero ? 'border-t-4 border-t-orange-600' : ''}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 h-16 w-full">
          <div className="flex items-center gap-3">
            {/* Logo solo para propios */}
            {tema.showLogo && (
              <div className="w-8 h-8 bg-lazdin-primary-container rounded-lg flex items-center justify-center border border-lazdin-outline-variant/20">
                <span className="material-symbols-outlined text-lazdin-emerald text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
              </div>
            )}
            <span className={`text-lg font-bold tracking-tighter ${esTercero ? 'text-slate-200' : 'text-lazdin-emerald'}`}>
              {nombreMostrar}
            </span>
            {/* Badge para terceros */}
            {tema.badgeVehiculo && (
              <span className="hidden sm:inline-flex px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] font-bold uppercase tracking-wider rounded border border-orange-500/20">
                {tema.badgeVehiculo}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:bg-slate-800 transition-colors active:scale-95 duration-150 rounded-full">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="flex items-center gap-3 pl-2 sm:pl-4 sm:border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-200">{choferData?.nombre || 'Chofer'}</p>
                <p className="text-[10px] text-slate-500">{esTercero ? 'Conductor Externo' : 'Conductor'}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-lazdin-surface-highest flex items-center justify-center border border-slate-700 overflow-hidden">
                {choferData?.foto_perfil_url ? (
                  <img src={choferData.foto_perfil_url} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-slate-400">account_circle</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full z-40 bg-slate-950 w-64 border-r border-slate-800">
        <div className="p-6 mt-16">
          {/* Driver profile */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
              {choferData?.foto_perfil_url ? (
                <img src={choferData.foto_perfil_url} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-slate-400">person</span>
              )}
            </div>
            <div>
              <p className="text-white font-bold leading-none text-sm">{choferData?.nombre || 'Chofer'}</p>
              <p className="text-slate-500 text-xs mt-1">DNI: {choferData?.dni || '—'}</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? tema.sidebarActive
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`
                }
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="mt-8 pt-4 border-t border-slate-800">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all rounded-lg w-full"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="font-medium text-sm">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="pt-20 pb-24 md:pb-8 px-4 md:px-8 md:ml-64 max-w-7xl mx-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="md:ml-64 mt-auto py-8 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-xs text-slate-500 italic">
            {esTercero ? 'Operando como Tercero Autorizado' : 'Logística Lazdin'}
          </span>
          <p className="text-xs text-slate-500 font-medium">© 2026 DigimediosApps — Sistemas de Gestión</p>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-2 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-3 py-1 rounded-xl transition-all text-[11px] font-medium ${
                isActive
                  ? `${tema.accentText} ${tema.accentBg}`
                  : 'text-slate-500'
              }`
            }
          >
            <span className="material-symbols-outlined mb-0.5 text-[22px]">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
