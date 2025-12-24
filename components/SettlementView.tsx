
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

  const getUPILink = (s: Settlement) => {
    const payee = getParticipant(s.to);
    if (!payee || !payee.upiId) return '';
    return `upi://pay?pa=${payee.upiId}&pn=${encodeURIComponent(payee.name)}&am=${s.amount.toFixed(2)}&cu=INR`;
  };

  const handlePayment = () => {
    if (!paymentModal) return;
    const url = getUPILink(paymentModal.settlement);
    if (url) window.location.href = url;
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
                const payer = getParticipant(s.from);
                const receiver = getParticipant(s.to);
                return (
                  <div key={idx} className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 hover:border-indigo-100 transition-all shadow-sm group">
                    <div className="flex flex-col gap-4">
                      {/* Clear Debt Identification */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                           <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                             <img src={payer?.avatar} className="w-full h-full rounded-full" />
                           </div>
                           <div className="min-w-0">
                              <p className="text-xs font-black text-red-500 uppercase tracking-tighter">Owes</p>
                              <p className="text-base font-black text-slate-800 truncate">{payer?.name}</p>
                           </div>
                        </div>

                        <div className="flex flex-col items-center">
                           <p className="text-2xl font-black text-indigo-600">₹{s.amount.toFixed(0)}</p>
                           <i className="fa-solid fa-arrow-right-long text-slate-300 -mt-1"></i>
                        </div>

                        <div className="flex items-center gap-3 text-right min-w-0 flex-row-reverse">
                           <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                             <img src={receiver?.avatar} className="w-full h-full rounded-full" />
                           </div>
                           <div className="min-w-0">
                              <p className="text-xs font-black text-green-500 uppercase tracking-tighter">Gets</p>
                              <p className="text-base font-black text-slate-800 truncate">{receiver?.name}</p>
                           </div>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        <button
                          onClick={() => setPaymentModal({ settlement: s, show: true })}
                          className="col-span-2 sm:col-span-1 bg-indigo-600 text-white text-[9px] font-black uppercase py-4 rounded-xl hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-bolt"></i>
                          PAY NOW
                        </button>
                        <button
                          onClick={() => handleWhatsAppRequest(s)}
                          className="bg-white text-green-600 border border-green-100 text-[9px] font-black uppercase py-4 rounded-xl hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                        >
                          <i className="fa-brands fa-whatsapp text-sm"></i>
                          REQUEST
                        </button>
                        <button
                          onClick={() => onSettle(s.from, s.to, s.amount)}
                          className="bg-white text-slate-500 border border-slate-200 text-[9px] font-black uppercase py-4 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-check"></i>
                          MARK PAID
                        </button>
                      </div>
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
            <h2 className="text-lg font-black uppercase tracking-tight">Debt Map</h2>
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
            
            <div className="p-8 space-y-3">
              <button onClick={handlePayment} className="w-full flex items-center justify-center gap-3 py-5 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl transition-all">
                <i className="fa-solid fa-mobile-screen-button"></i>
                OPEN UPI APPS
              </button>
              <button onClick={() => setPaymentModal(null)} className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlementView;
