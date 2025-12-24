
import React, { useState } from 'react';
import { Participant, Settlement, Balance } from '../types.ts';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface Props {
  participants: Participant[];
  balances: Balance[];
  settlements: Settlement[];
  totalSpent: number;
  onSettle: (fromId: string, toId: string, amount: number) => void;
}

const SettlementView: React.FC<Props> = ({ participants, balances, settlements, totalSpent, onSettle }) => {
  const [paymentModal, setPaymentModal] = useState<{ settlement: Settlement; show: boolean } | null>(null);

  const getParticipant = (id: string) => participants.find(p => p.id === id);
  const getParticipantName = (id: string) => getParticipant(id)?.name || 'Guest';
  
  const handleWhatsAppRequest = (s: Settlement) => {
    const payer = getParticipant(s.from);
    const payee = getParticipant(s.to);
    if (!payer || !payee) return;
    
    let message = `Hi ${payer.name}, reminder from SplitIt! 👋\n\nYou owe me *₹${s.amount.toFixed(2)}*.`;
    if (payee.upiId) {
      message += `\n\nMy UPI ID: ${payee.upiId}`;
    }
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const getUPILink = (s: Settlement, method: 'gpay' | 'phonepe' | 'cred' | 'generic') => {
    const payee = getParticipant(s.to);
    if (!payee || !payee.upiId) return '';
    
    const upiString = `upi://pay?pa=${payee.upiId}&pn=${encodeURIComponent(payee.name)}&am=${s.amount.toFixed(2)}&cu=INR`;
    
    switch (method) {
      case 'gpay': return `googlegpay://pay?pa=${payee.upiId}&pn=${encodeURIComponent(payee.name)}&am=${s.amount.toFixed(2)}&cu=INR`;
      case 'phonepe': return `phonepe://pay?pa=${payee.upiId}&pn=${encodeURIComponent(payee.name)}&am=${s.amount.toFixed(2)}&cu=INR`;
      default: return upiString;
    }
  };

  const handlePayment = (method: 'gpay' | 'phonepe' | 'cred' | 'generic') => {
    if (!paymentModal) return;
    const url = getUPILink(paymentModal.settlement, method);
    if (url) {
      window.location.href = url;
    }
    setPaymentModal(null);
  };

  const chartData = balances.map(b => ({
    name: getParticipantName(b.participantId),
    value: b.amount
  }));

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Settlements */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-lg shadow-slate-100/50 border border-slate-100">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-handshake"></i></div>
            <h2 className="text-lg font-black uppercase tracking-tight">Pending Payments</h2>
          </div>
          <div className="space-y-4">
            {settlements.length === 0 ? (
              <div className="text-center py-16 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                <p className="text-slate-300 font-black text-[10px] uppercase tracking-widest">Everything is settled! ✅</p>
              </div>
            ) : (
              settlements.map((s, idx) => {
                const payee = getParticipant(s.to);
                return (
                  <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-indigo-100 transition-all shadow-sm">
                    <div className="flex items-center justify-between mb-6 gap-2">
                      <div className="text-left min-w-0 flex-1">
                        <span className="text-[8px] font-black uppercase text-slate-300 block mb-1">Payer</span>
                        <p className="font-black text-slate-900 truncate text-sm">{getParticipantName(s.from)}</p>
                      </div>
                      <div className="text-center flex flex-col items-center shrink-0 px-2">
                        <i className="fa-solid fa-arrow-right text-indigo-200 text-xs mb-1"></i>
                        <p className="text-xl font-black text-indigo-600">₹{s.amount.toFixed(0)}</p>
                      </div>
                      <div className="text-right min-w-0 flex-1">
                        <span className="text-[8px] font-black uppercase text-slate-300 block mb-1">Receiver</span>
                        <p className="font-black text-slate-900 truncate text-sm">{getParticipantName(s.to)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        onClick={() => setPaymentModal({ settlement: s, show: true })}
                        className="bg-indigo-600 text-white text-[9px] font-black uppercase py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-bolt"></i>
                        MAKE PAYMENT
                      </button>
                      <button
                        onClick={() => handleWhatsAppRequest(s)}
                        className="bg-green-500 text-white text-[9px] font-black uppercase py-3.5 rounded-xl hover:bg-green-600 transition-all shadow-md shadow-green-100 flex items-center justify-center gap-2"
                      >
                        <i className="fa-brands fa-whatsapp"></i>
                        REQUEST
                      </button>
                      <button
                        onClick={() => onSettle(s.from, s.to, s.amount)}
                        className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase py-3.5 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-check"></i>
                        MARK PAID
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Balance Overview */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-lg shadow-slate-100/50 border border-slate-100">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-chart-pie"></i></div>
            <h2 className="text-lg font-black uppercase tracking-tight">Chart Overview</h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={80} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '1.25rem', border: 'none', background: '#1e293b', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                  formatter={(value: number) => `₹${value.toFixed(2)}`}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment Selection Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-10 border-b border-slate-100 flex flex-col items-center bg-slate-50/50 text-center">
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2">Payable Amount</span>
               <h3 className="text-5xl font-black text-slate-900 tracking-tighter">₹{paymentModal.settlement.amount.toFixed(2)}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">Paying to {getParticipantName(paymentModal.settlement.to)}</p>
            </div>
            
            <div className="p-8 grid grid-cols-2 gap-4">
              <button onClick={() => handlePayment('gpay')} className="flex flex-col items-center gap-2 p-5 bg-slate-50 rounded-3xl hover:bg-white border border-transparent hover:border-slate-100 transition-all group">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><i className="fa-brands fa-google-pay text-3xl text-[#4285F4]"></i></div>
                <span className="text-[10px] font-black uppercase text-slate-500 mt-1">GPay</span>
              </button>
              <button onClick={() => handlePayment('phonepe')} className="flex flex-col items-center gap-2 p-5 bg-slate-50 rounded-3xl hover:bg-white border border-transparent hover:border-slate-100 transition-all group">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><i className="fa-solid fa-mobile-screen text-2xl text-[#5f259f]"></i></div>
                <span className="text-[10px] font-black uppercase text-slate-500 mt-1">PhonePe</span>
              </button>
              <button onClick={() => handlePayment('cred')} className="flex flex-col items-center gap-2 p-5 bg-slate-50 rounded-3xl hover:bg-white border border-transparent hover:border-slate-100 transition-all group">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm font-black text-sm italic group-hover:scale-110 transition-transform tracking-tight">CRED</div>
                <span className="text-[10px] font-black uppercase text-slate-500 mt-1">Cred</span>
              </button>
              <button onClick={() => handlePayment('generic')} className="flex flex-col items-center gap-2 p-5 bg-slate-50 rounded-3xl hover:bg-white border border-transparent hover:border-slate-100 transition-all group">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-slate-700 font-black text-xs uppercase tracking-tighter">UPI</div>
                <span className="text-[10px] font-black uppercase text-slate-500 mt-1 text-center">Other UPI</span>
              </button>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100">
               <button onClick={() => setPaymentModal(null)} className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancel Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlementView;
