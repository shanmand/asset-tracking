
import React, { useState } from 'react';
import { 
  Package, 
  MapPin, 
  Truck, 
  History, 
  Search,
  ChevronRight,
  TrendingUp,
  LayoutDashboard,
  Globe,
  BarChart3,
  Skull,
  Receipt,
  UserCircle,
  ShieldCheck,
  Building2,
  Users as UsersIcon,
  LogOut,
  LogIn,
  Lock,
  ClipboardList,
  AlertTriangle,
  Settings,
  Database,
  Gavel,
  Tags
} from 'lucide-react';
import { UserProvider, useUser } from './UserContext';
import DashboardView from './components/DashboardView';
import SchemaView from './components/SchemaView';
import BatchTracker from './components/BatchTracker';
import AssetList from './components/AssetList';
import ClaimsManager from './components/ClaimsManager';
import LogisticsOps from './components/LogisticsOps';
import InventoryDashboard from './components/InventoryDashboard';
import FinancialReport from './components/FinancialReport';
import LossRecorder from './components/LossRecorder';
import SupplierSettlementReport from './components/SupplierSettlementReport';
import UserManagement from './components/UserManagement';
import LocationManagement from './components/LocationManagement';
import SupabaseConnection from './components/SupabaseConnection';
import AdminPanel from './components/AdminPanel';
import { UserRole } from './types';
import { supabase } from './supabase';

enum NavItem {
  DASHBOARD = 'dashboard',
  INVENTORY = 'inventory',
  FINANCIALS = 'financials',
  SETTLEMENT = 'settlement',
  ASSETS = 'assets',
  TRACKER = 'tracker',
  LOGISTICS = 'logistics',
  LOSSES = 'losses',
  CLAIMS = 'claims',
  SCHEMA = 'schema',
  USERS = 'users',
  LOCATIONS = 'locations',
  CONNECT = 'connect',
  ADMIN = 'admin-panel'
}

const AppContent: React.FC = () => {
  const { user, profile, isLoading, logout, hasPermission } = useUser();
  const [activeTab, setActiveTab] = useState<NavItem>(NavItem.DASHBOARD);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('Consolidated');

  const currentBranchContext = profile?.role_name === UserRole.MANAGER 
    ? (profile.home_branch_name.includes('JHB') ? 'Kya Sands' : 'Durban') 
    : selectedBranchFilter;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-amber-500 font-black uppercase tracking-widest text-xs">Syncing Developer Profile...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // Explicit module rendering
    switch (activeTab) {
      case NavItem.DASHBOARD: return <DashboardView currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} branchContext={currentBranchContext as any} />;
      case NavItem.INVENTORY: return <InventoryDashboard />;
      case NavItem.FINANCIALS: return <FinancialReport branchContext={currentBranchContext as any} />;
      case NavItem.SETTLEMENT: return <SupplierSettlementReport isAdmin={profile?.role_name === UserRole.ADMIN} />;
      case NavItem.ASSETS: return <AssetList isAdmin={profile?.role_name === UserRole.ADMIN} />;
      case NavItem.TRACKER: return <BatchTracker />;
      case NavItem.LOGISTICS: return <LogisticsOps currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} />;
      case NavItem.LOSSES: return <LossRecorder currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} />;
      case NavItem.CLAIMS: return <ClaimsManager isManager={profile?.role_name === UserRole.MANAGER || profile?.role_name === UserRole.ADMIN} />;
      case NavItem.SCHEMA: return <SchemaView />;
      case NavItem.USERS: return <UserManagement />;
      case NavItem.LOCATIONS: return <LocationManagement />;
      case NavItem.CONNECT: return <SupabaseConnection />;
      case NavItem.ADMIN: return <AdminPanel currentRole={profile?.role_name || UserRole.ADMIN} />;
      default: return <DashboardView currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col fixed h-full z-10 shadow-2xl">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-amber-500 p-2 rounded-lg shadow-lg"><Package className="text-white w-6 h-6" /></div>
          <div><h1 className="font-black text-xl leading-tight">SHUKU</h1><p className="text-[10px] text-amber-400 font-bold uppercase tracking-tighter">Lupo Bakery Pro</p></div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">Main Modules</div>
          <SidebarButton active={activeTab === NavItem.DASHBOARD} onClick={() => setActiveTab(NavItem.DASHBOARD)} icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <SidebarButton active={activeTab === NavItem.INVENTORY} onClick={() => setActiveTab(NavItem.INVENTORY)} icon={<Globe size={18} />} label="Inventory Map" />
          <SidebarButton active={activeTab === NavItem.TRACKER} onClick={() => setActiveTab(NavItem.TRACKER)} icon={<History size={18} />} label="Batch Forensic" />

          <div className="pt-4 pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">Operations</div>
          <SidebarButton active={activeTab === NavItem.LOGISTICS} onClick={() => setActiveTab(NavItem.LOGISTICS)} icon={<ClipboardList size={18} />} label="Capture Movement" />
          <SidebarButton active={activeTab === NavItem.LOSSES} onClick={() => setActiveTab(NavItem.LOSSES)} icon={<Skull size={18} />} label="Report Loss" />
          <SidebarButton active={activeTab === NavItem.CLAIMS} onClick={() => setActiveTab(NavItem.CLAIMS)} icon={<Gavel size={18} />} label="Claims Center" />

          <div className="pt-4 pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">Financials</div>
          <SidebarButton active={activeTab === NavItem.FINANCIALS} onClick={() => setActiveTab(NavItem.FINANCIALS)} icon={<BarChart3 size={18} />} label="Accrual Engine" />
          <SidebarButton active={activeTab === NavItem.SETTLEMENT} onClick={() => setActiveTab(NavItem.SETTLEMENT)} icon={<Receipt size={18} />} label="Settlement Audit" />
          <SidebarButton active={activeTab === NavItem.ASSETS} onClick={() => setActiveTab(NavItem.ASSETS)} icon={<Tags size={18} />} label="Asset Registry" />

          <div className="pt-4 pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">System</div>
          <SidebarButton active={activeTab === NavItem.ADMIN} onClick={() => setActiveTab(NavItem.ADMIN)} icon={<Settings size={18} />} label="Admin Panel" />
          <SidebarButton active={activeTab === NavItem.USERS} onClick={() => setActiveTab(NavItem.USERS)} icon={<UsersIcon size={18} />} label="User Management" />
          <SidebarButton active={activeTab === NavItem.LOCATIONS} onClick={() => setActiveTab(NavItem.LOCATIONS)} icon={<MapPin size={18} />} label="Location Registry" />
          <SidebarButton active={activeTab === NavItem.CONNECT} onClick={() => setActiveTab(NavItem.CONNECT)} icon={<Globe size={18} />} label="Database Connectivity" />
          <SidebarButton active={activeTab === NavItem.SCHEMA} onClick={() => setActiveTab(NavItem.SCHEMA)} icon={<Database size={18} />} label="Data Schema" />
        </nav>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-black text-slate-900 shadow-lg">{profile?.full_name?.charAt(0) || 'D'}</div>
              <div>
                <p className="text-xs font-bold truncate text-white">{profile?.full_name || 'Dev User'}</p>
                <p className="text-[9px] text-slate-500 uppercase font-black">{profile?.role_name || 'System Admin'}</p>
              </div>
            </div>
            <button onClick={logout} className="p-2 text-slate-500 hover:text-rose-500 transition-colors"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
          <h2 className="font-black text-sm text-slate-800 uppercase tracking-widest">{activeTab.replace('-', ' ')}</h2>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1 p-1 rounded-xl border bg-slate-100 border-slate-200">
              <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-black uppercase text-slate-400 border-r border-slate-200">
                <Building2 size={14} /> Branch Context
              </div>
              {['Kya Sands', 'Durban', 'Consolidated'].map(branch => (
                <button
                  key={branch}
                  onClick={() => setSelectedBranchFilter(branch)}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${currentBranchContext === branch ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {branch}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="p-8">{renderContent()}</div>
      </main>
    </div>
  );
};

const SidebarButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${active ? 'bg-amber-500 text-slate-900 shadow-lg font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
    {icon}
    <span className="text-sm tracking-tight">{label}</span>
    {active && <ChevronRight className="ml-auto" size={12} />}
  </button>
);

const App: React.FC = () => (
  <UserProvider>
    <AppContent />
  </UserProvider>
);

export default App;
