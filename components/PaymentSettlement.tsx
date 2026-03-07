
import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Loader2, 
  ArrowRight,
  Receipt,
  MinusCircle,
  PlusCircle,
  FileText
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Location, User } from '../types';

interface PaymentSettlementProps {
  currentUser?: User;
}

const PaymentSettlement: React.FC<PaymentSettlementProps> = ({ currentUser }) => {
  const [suppliers, setSuppliers] = useState<Location[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [liability, setLiability] = useState<{
    total_rental_accrued: number;
    total_replacement_fees: number;
    total_credits: number;
    gross_liability: number;
  } | null>(null);

  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('partner_type', 'Supplier');
      if (data) setSuppliers(data);
      setIsLoading(false);
    };
    fetchSuppliers();
  }, []);

  const calculateLiability = async () => {
    if (!selectedSupplier || !isSupabaseConfigured) return;
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.rpc('get_supplier_liability', {
        p_supplier_id: selectedSupplier,
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setLiability(data[0]);
        setCashPaid(data[0].gross_liability);
      }
    } catch (err: any) {
      setNotification({ message: err.message || "Failed to calculate liability", type: 'error' });
    } finally {
      setIsCalculating(false);
    }
  };

  const netPayable = (liability?.gross_liability || 0) - discountAmount;

  const handleProcessPayment = async () => {
    if (!selectedSupplier || !liability || !isSupabaseConfigured || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('finalize_payment_settlement', {
        p_supplier_id: selectedSupplier,
        p_start_date: startDate,
        p_end_date: endDate,
        p_gross_liability: liability.gross_liability,
        p_discount_amount: discountAmount,
        p_net_payable: netPayable,
        p_cash_paid: cashPaid,
        p_payment_ref: paymentRef,
        p_settled_by: currentUser?.id || '00000000-0000-0000-0000-000000000000'
      });

      if (error) throw error;

      setNotification({ message: `Payment processed successfully. Settlement ID: ${data}`, type: 'success' });
      setLiability(null);
      setDiscountAmount(0);
      setCashPaid(0);
      setPaymentRef('');
    } catch (err: any) {
      setNotification({ message: err.message || "Failed to process payment", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const exportToCSV = () => {
    if (!liability) return;
    
    const supplier = suppliers.find(s => s.id === selectedSupplier)?.name || 'Unknown';
    const rows = [
      ['Supplier', supplier],
      ['Period', `${startDate} to ${endDate}`],
      ['', ''],
      ['Description', 'Amount (ZAR)'],
      ['Total Rental Accrued', liability.total_rental_accrued.toFixed(2)],
      ['Total Replacement Fees', liability.total_replacement_fees.toFixed(2)],
      ['Total Credits (Damaged)', `-${liability.total_credits.toFixed(2)}`],
      ['Gross Liability', liability.gross_liability.toFixed(2)],
      ['Discount Applied', `-${discountAmount.toFixed(2)}`],
      ['Net Payable', netPayable.toFixed(2)],
      ['Cash Paid', cashPaid.toFixed(2)],
      ['Payment Reference', paymentRef],
      ['Settled By', currentUser?.name || 'System'],
      ['Date Processed', new Date().toISOString()]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Settlement_${supplier.replace(/\s+/g, '_')}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-slate-900" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20">
              <Receipt size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest">Payment Reconciliation</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Supplier Settlement & Liability Closure</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Selection Header */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select 
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={selectedSupplier}
                  onChange={e => setSelectedSupplier(e.target.value)}
                >
                  <option value="">Select Supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
              <input 
                type="date" 
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Date</label>
              <input 
                type="date" 
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <button 
              onClick={calculateLiability}
              disabled={!selectedSupplier || isCalculating}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCalculating ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
              CALCULATE DUE
            </button>
          </div>

          {liability && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
              {/* Liability Breakdown */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-4">Liability Breakdown</h4>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3 text-slate-600">
                        <Calendar size={18} className="text-blue-500" />
                        <span className="text-sm font-bold">Total Rental Accrued</span>
                      </div>
                      <span className="text-sm font-black text-slate-900">R {formatCurrency(liability.total_rental_accrued)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3 text-slate-600">
                        <PlusCircle size={18} className="text-amber-500" />
                        <span className="text-sm font-bold">Total Replacement Fees</span>
                      </div>
                      <span className="text-sm font-black text-slate-900">R {formatCurrency(liability.total_replacement_fees)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3 text-slate-600">
                        <MinusCircle size={18} className="text-emerald-500" />
                        <span className="text-sm font-bold">Total Credits (Damaged)</span>
                      </div>
                      <span className="text-sm font-black text-emerald-600">- R {formatCurrency(liability.total_credits)}</span>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Gross Liability</span>
                      <span className="text-2xl font-black text-slate-900">R {formatCurrency(liability.gross_liability)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-8 text-white space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Accounting Export</h4>
                    <button 
                      onClick={exportToCSV}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Download size={14} /> Export CSV
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Export the full reconciliation breakdown for integration with your accounting software. This includes all batch IDs, loss records, and credit notes included in this period.
                  </p>
                </div>
              </div>

              {/* Payment Form */}
              <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6 shadow-xl relative">
                <div className="absolute top-0 right-0 p-4 opacity-5"><DollarSign size={80} /></div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-4">Process Settlement</h4>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount Amount (Negotiated)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R</span>
                      <input 
                        type="number" 
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={discountAmount}
                        onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Payable</label>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-2xl font-black text-blue-900">R {formatCurrency(netPayable)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual Cash Paid</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R</span>
                      <input 
                        type="number" 
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={cashPaid}
                        onChange={e => setCashPaid(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Reference (EFT/Check)</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="E.g. EFT-MARCH-2026-001"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={paymentRef}
                        onChange={e => setPaymentRef(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleProcessPayment}
                    disabled={isSubmitting || !paymentRef}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    PROCESS PAYMENT
                  </button>
                  
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">
                    This will mark all included records as 'Settled'
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-8 rounded-3xl flex gap-6">
        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
          <AlertTriangle size={24} />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest">Financial Closure Protocol</h4>
          <p className="text-xs text-blue-800 leading-relaxed font-medium">
            Processing a payment settlement is an irreversible action. Once finalized, all batches and loss records within the selected date range will be marked as <strong>Settled</strong>. This prevents duplicate billing and locks the liability history for the selected period. Ensure the <strong>Payment Reference</strong> matches your bank records for audit purposes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSettlement;
