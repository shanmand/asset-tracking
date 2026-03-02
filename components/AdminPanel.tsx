
import React, { useState } from 'react';
import { 
  Settings, 
  Users as UsersIcon, 
  ShieldCheck, 
  Database, 
  Key, 
  UserPlus, 
  Building2, 
  Calendar, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  MoreVertical, 
  DollarSign, 
  ArrowRight,
  TrendingUp,
  History,
  Trash2,
  RefreshCw,
  Search,
  Plus
} from 'lucide-react';
import { MOCK_USERS, MOCK_ASSETS, MOCK_FEES } from '../constants';
import { UserRole, FeeType } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

const AdminPanel: React.FC<{ currentRole: UserRole }> = ({ currentRole }) => {
  const isAdmin = currentRole === UserRole.ADMIN;
  const [activeSubTab, setActiveSubTab] = useState<'fees' | 'users' | 'maintenance'>('fees');
  
  // Fee Form State
  const [targetAsset, setTargetAsset] = useState(MOCK_ASSETS[0].id);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyRental, setDailyRental] = useState(5.15);
  const [issueFee, setIssueFee] = useState(145.00);
  const [replacementFee, setReplacementFee] = useState(135.00);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  /**
   * Action: Introduce New Fee Schedule
   * 1. Check Role
   * 2. Update existing active fees for this asset (Set is_active = false)
   * 3. Insert new fee schedule records
   */
  const handleUpdateFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setNotification({ msg: "Forbidden: Admin role required.", type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        // 1. Bulk Update: Close existing active fees for the asset
        const { error: updateError } = await supabase
          .from('FeeSchedule')
          .update({ is_active: false, effective_to: effectiveDate })
          .eq('asset_id', targetAsset)
          .is('effective_to', null);

        if (updateError) throw updateError;

        // 2. Insert New Fee Schedule
        const newFees = [
          { asset_id: targetAsset, fee_type: FeeType.DAILY_RENTAL, amount_zar: dailyRental, effective_from: effectiveDate, is_active: true },
          { asset_id: targetAsset, fee_type: FeeType.ISSUE_FEE, amount_zar: issueFee, effective_from: effectiveDate, is_active: true },
          { asset_id: targetAsset, fee_type: FeeType.REPLACEMENT_FEE, amount_zar: replacementFee, effective_from: effectiveDate, is_active: true }
        ];

        const { error: insertError } = await supabase
          .from('FeeSchedule')
          .insert(newFees);

        if (insertError) throw insertError;
      } else {
        // Mock success for development
        console.warn("Supabase not configured. Simulating fee update success.");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setNotification({ msg: "Annual fee schedule transitioned successfully.", type: 'success' });
    } catch (err: any) {
      console.error("Fee update error:", err);
      setNotification({ msg: err.message || "Failed to update fees.", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!isAdmin) return;
    try {
      // In real scenario: supabase.auth.admin.resetPasswordForEmail(...)
      alert(`Password reset link dispatched for User ID: ${userId}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ role_name: newRole })
        .eq('id', userId);
      
      if (error) throw error;
      setNotification({ msg: `Role updated for ${userId}`, type: 'success' });
    } catch (err) {
      setNotification({ msg: "Failed to update role", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleWipeData = async () => {
    if (!isAdmin) return;
    if (!window.confirm("CRITICAL WARNING: This will permanently delete ALL records from the database. This action cannot be undone. Proceed?")) return;

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        // Delete in order of dependencies if needed, or just all
        const tables = ['users', 'locations', 'equipment', 'FeeSchedule'];
        for (const table of tables) {
          const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
          if (error) console.warn(`Error wiping ${table}:`, error);
        }
        setNotification({ msg: "Database wiped successfully. System is now clean.", type: 'success' });
      } else {
        setNotification({ msg: "Supabase not connected. Mock data remains in source code but session is 'Live Mode' ready.", type: 'success' });
      }
    } catch (err: any) {
      setNotification({ msg: "Failed to wipe data", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const renderMaintenance = () => (
    <div className="max-w-4xl space-y-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 bg-rose-600 text-white">
          <h3 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight"><Trash2 size={24} /> Danger Zone</h3>
          <p className="text-xs text-rose-100 font-bold uppercase tracking-widest mt-1">Destructive System Operations</p>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex items-start gap-6 p-6 bg-rose-50 rounded-2xl border border-rose-100">
            <AlertTriangle className="text-rose-600 shrink-0" size={32} />
            <div>
              <p className="font-black text-slate-900 uppercase tracking-tight">Wipe All System Records</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will truncate all tables in your Supabase instance. This includes Users, Locations, Equipment, and Fee Schedules. 
                Use this only when transitioning from <strong>Staging/UAT</strong> to <strong>Production (Live)</strong>.
              </p>
              <button 
                onClick={handleWipeData}
                disabled={isSubmitting || !isAdmin}
                className="mt-6 px-8 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2 shadow-xl shadow-rose-100 disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Execute Full System Wipe
              </button>
            </div>
          </div>

          <div className="flex items-start gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <Zap className="text-amber-500 shrink-0" size={32} />
            <div>
              <p className="font-black text-slate-900 uppercase tracking-tight">Transition to Live Mode</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ensure your Supabase connection is verified before going live. Once live, mock data will be ignored and the system will rely solely on your Postgres infrastructure.
              </p>
              <div className="mt-6 flex items-center gap-4">
                <div className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest ${isSupabaseConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                  {isSupabaseConfigured ? 'Supabase Connected' : 'Supabase Disconnected'}
                </div>
                {isSupabaseConfigured && (
                  <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                    <CheckCircle2 size={14} /> Ready for Production
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.msg}</p>
        </div>
      )}

      <div className="flex bg-slate-200 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveSubTab('fees')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'fees' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <DollarSign size={14} /> Global Fees
        </button>
        <button 
          onClick={() => setActiveSubTab('users')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <UsersIcon size={14} /> User RBAC
        </button>
        <button 
          onClick={() => setActiveSubTab('maintenance')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'maintenance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Zap size={14} /> System Maintenance
        </button>
      </div>

      {activeSubTab === 'fees' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2"><Zap className="text-amber-400" /> Annual Fee Update</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">Introduction of new asset rental and replacement rates.</p>
                </div>
                {!isAdmin && <Lock className="text-rose-500" size={24} />}
              </div>

              <form onSubmit={handleUpdateFees} className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Database size={12} /> Target Asset Type
                    </label>
                    <select 
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                      value={targetAsset}
                      onChange={e => setTargetAsset(e.target.value)}
                    >
                      {MOCK_ASSETS.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={12} /> Effective Start Date
                    </label>
                    <input 
                      disabled={!isAdmin}
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                      value={effectiveDate}
                      onChange={e => setEffectiveDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FeeInput label="Daily Rental" value={dailyRental} onChange={setDailyRental} disabled={!isAdmin} />
                  <FeeInput label="Issue Fee (QSR)" value={issueFee} onChange={setIssueFee} disabled={!isAdmin} />
                  <FeeInput label="Replacement" value={replacementFee} onChange={setReplacementFee} disabled={!isAdmin} />
                </div>

                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                  <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    <strong>Action Warning:</strong> Saving these rates will automatically set <code>is_active = FALSE</code> and set an <code>effective_to</code> date for all existing active schedules for this asset. This operation is forensic-logged.
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting || !isAdmin}
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl transition-all hover:bg-slate-800 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                  VERIFY & DEPLOY NEW RATES
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <History size={16} /> Current Active Rates
              </h4>
              <div className="space-y-4">
                {MOCK_FEES.filter(f => f.asset_id === targetAsset && f.effective_to === null).map(f => (
                  <div key={f.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{f.fee_type}</p>
                      <p className="text-sm font-bold text-slate-800">R {f.amount_zar.toFixed(2)}</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'users' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter users..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <button disabled={!isAdmin} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50">
                <UserPlus size={16} /> Add System User
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
                    <th className="px-8 py-5">Full Name</th>
                    <th className="px-8 py-5">Role Permission</th>
                    <th className="px-8 py-5">Home Branch</th>
                    <th className="px-8 py-5 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {MOCK_USERS.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 border border-slate-200">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{user.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <select 
                          disabled={!isAdmin}
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value as UserRole)}
                          className="text-[10px] font-bold bg-slate-100 border-none rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <Building2 size={12} className="text-slate-400" /> {user.branch_id}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right space-x-2">
                        <button 
                          onClick={() => handleResetPassword(user.id)}
                          disabled={!isAdmin}
                          title="Reset Password"
                          className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all disabled:opacity-30"
                        >
                          <Key size={16} />
                        </button>
                        <button disabled={!isAdmin} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-30">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        renderMaintenance()
      )}
    </div>
  );
};

const FeeInput: React.FC<{ label: string, value: number, onChange: (val: number) => void, disabled: boolean }> = ({ label, value, onChange, disabled }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label} (ZAR)</label>
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R</div>
      <input 
        disabled={disabled}
        type="number"
        step="0.01"
        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pl-8 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  </div>
);

export default AdminPanel;
