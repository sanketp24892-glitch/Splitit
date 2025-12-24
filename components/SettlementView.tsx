
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
  const [showUpiInput, setShowUpiInput] = useState(false);
  const [manualUpi, setManualUpi] = useState('');

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

  const getUPILink = (s: Settlement, upiId?: string) => {
    const targetUpi = upiId || getParticipant(s.to)?.upiId;
    if (!targetUpi) return '';
    return `upi://pay?pa=${targetUpi}&pn=${encodeURIComponent(getParticipantName(s.to))}&am=${s.amount.toFixed(2)}&cu=INR`;
  };

  const handleAppPayment = (app?: string) => {
    if (!paymentModal) return;
    const link = getUPILink(paymentModal.settlement, manualUpi || undefined);
    if (!link) {
      alert("No UPI ID provided. Please enter one manually.");
      setShowUpiInput(true);
      return;
    }
    window.location.href = link;
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
            <h2 className="text-lg font-black uppercase tracking-tight">Who Owes Whom</h2>
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
                  <div key={idx} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 hover:border-indigo-100 transition-all group shadow-sm">
                    <div className="flex flex-col gap-5">
                      {/* Clear Visual Indication of Debt */}
                      <div className="flex items-center justify-between">
                         <div className="flex flex-col items-center gap-2 min-w-[80px]">
                            <img src={payer?.avatar} className="w-12 h-12 rounded-2xl bg-white shadow-sm" />
                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-tighter truncate w-20 text-center">{payer?.name}</p>
                            <span className="text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-md">OWES</span>
                         </div>

                         <div className="flex-1 flex flex-col items-center">
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">₹{s.amount.toFixed(0)}</p>
                            <div className="w-full h-[2px] bg-slate-200 relative mt-2">
                               <i className="fa-solid fa-chevron-right absolute right-0 -top-1.5 text-slate-300"></i>
                            </div>
                         </div>

                         <div className="flex flex-col items-center gap-2 min-w-[80px]">
                            <img src={receiver?.avatar} className="w-12 h-12 rounded-2xl bg-white shadow-sm" />
                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-tighter truncate w-20 text-center">{receiver?.name}</p>
                            <span className="text-[8px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-2 py-1 rounded-md">GETS</span>
                         </div>
                      </div>

                      {/* Action Row Optimized for Mobile */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setPaymentModal({ settlement: s, show: true }); setShowUpiInput(false); }}
                          className="bg-indigo-600 text-white text-[10px] font-black uppercase py-4 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          <i className="fa-solid fa-wallet"></i>
                          PAY NOW
                        </button>
                        <button
                          onClick={() => handleWhatsAppRequest(s)}
                          className="bg-white text-green-600 border border-green-100 text-[10px] font-black uppercase py-4 rounded-xl hover:bg-green-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <i className="fa-brands fa-whatsapp text-sm"></i>
                          REMIND
                        </button>
                        <button
                          onClick={() => onSettle(s.from, s.to, s.amount)}
                          className="col-span-2 bg-white text-slate-400 border border-slate-200 text-[10px] font-black uppercase py-4 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <i className="fa-solid fa-check"></i>
                          MARK AS SETTLED MANUALLY
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Debt Map */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-lg shadow-slate-100/50 border border-slate-100">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-chart-line"></i></div>
            <h2 className="text-lg font-black uppercase tracking-tight">Balance Sheet</h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '1rem', border: 'none', background: '#1e293b', color: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(v: any) => `₹${v.toFixed(0)}`} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.value >= 0 ? '#10b981' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment Options Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-10 border-b border-slate-100 flex flex-col items-center bg-slate-50/50 text-center">
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2">Payable to {getParticipantName(paymentModal.settlement.to)}</span>
               <h3 className="text-5xl font-black text-slate-900 tracking-tighter">₹{paymentModal.settlement.amount.toFixed(0)}</h3>
            </div>
            
            <div className="p-8 space-y-4">
              {!showUpiInput ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleAppPayment('gpay')} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all border border-slate-100">
                      <i className="fa-solid fa-brands fa-google-pay text-2xl text-slate-800"></i>
                      <span className="text-[9px] font-black uppercase">Google Pay</span>
                    </button>
                    <button onClick={() => handleAppPayment('phonepe')} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all border border-slate-100">
                      <i className="fa-solid fa-mobile-screen text-2xl text-purple-600"></i>
                      <span className="text-[9px] font-black uppercase">PhonePe</span>
                    </button>
                    <button onClick={() => handleAppPayment('cred')} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all border border-slate-100">
                      <i className="fa-solid fa-credit-card text-2xl text-slate-900"></i>
                      <span className="text-[9px] font-black uppercase">CRED</span>
                    </button>
                    <button onClick={() => setShowUpiInput(true)} className="flex flex-col items-center gap-2 p-4 bg-indigo-50 rounded-2xl hover:bg-indigo-100 transition-all border border-indigo-100">
                      <i className="fa-solid fa-at text-2xl text-indigo-600"></i>
                      <span className="text-[9px] font-black uppercase">Enter UPI</span>
                    </button>
                  </div>
                  <button onClick={() => handleAppPayment()} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all">
                    OPEN SYSTEM APP
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Recipient UPI ID</label>
                    <input 
                      type="text" 
                      value={manualUpi} 
                      onChange={e => setManualUpi(e.target.value)}
                      placeholder="username@bank"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:border-indigo-600 text-sm font-bold"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowUpiInput(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-[10px] uppercase">Back</button>
                    <button onClick={() => handleAppPayment()} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Pay with this ID</button>
                  </div>
                </div>
              )}
              
              <button onClick={() => setPaymentModal(null)} className="w-full py-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlementView;
