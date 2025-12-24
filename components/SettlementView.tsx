
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

  const handleWhatsAppReminder = (s: Settlement) => {
    const payer = getParticipant(s.from);
    const payee = getParticipant(s.to);
    if (!payer || !payee) return;
    const msg = `Hey ${payer.name}, hope you're having a great day! 👋\nJust a quick heads-up from SplitIt: You owe me *₹${s.amount.toFixed(0)}* for our recent trip.\n${payee.upiId ? `\nMy UPI: ${payee.upiId}` : ''}\n\nThanks! 💸`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const openUpiApp = (app?: string) => {
    if (!paymentModal) return;
    const payee = getParticipant(paymentModal.settlement.to);
    const upi = manualUpi || payee?.upiId;
    if (!upi) {
      setShowUpiInput(true);
      return;
    }
    const link = `upi://pay?pa=${upi}&pn=${encodeURIComponent(payee?.name || 'SplitIt User')}&am=${paymentModal.settlement.amount.toFixed(2)}&cu=INR`;
    window.location.href = link;
  };

  const chartData = balances.map(b => ({
    name: getParticipantName(b.participantId),
    value: b.amount
  }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl shadow-slate-100/30 border border-slate-50">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><i className="fa-solid fa-hand-holding-dollar text-xl"></i></div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Who Owes Whom</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instant mobile settlement</p>
            </div>
          </div>

          <div className="space-y-6">
            {settlements.length === 0 ? (
              <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                <p className="text-slate-300 font-black text-[10px] uppercase tracking-widest">No pending debts! 🥂</p>
              </div>
            ) : (
              settlements.map((s, idx) => {
                const payer = getParticipant(s.from);
                const receiver = getParticipant(s.to);
                return (
                  <div key={idx} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-6 hover:border-indigo-100 hover:shadow-lg transition-all space-y-6">
                    {/* Compact Horizontal Settlement Display */}
                    <div className="flex items-center justify-between gap-2">
                       <div className="flex flex-col items-center gap-1 shrink-0 w-[85px]">
                          <img src={payer?.avatar} className="w-12 h-12 rounded-2xl shadow-sm border border-slate-100" />
                          <p className="text-[10px] font-black text-slate-900 truncate w-full text-center">{payer?.name}</p>
                          <span className="text-[7px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-1.5 py-0.5 rounded-full">OWES</span>
                       </div>

                       <div className="flex flex-col items-center flex-1 min-w-0">
                          <p className="text-2xl font-black text-slate-900 tracking-tighter">₹{s.amount.toFixed(0)}</p>
                          <div className="flex items-center gap-1 text-slate-100 w-full px-2">
                             <div className="h-[2px] flex-1 bg-slate-100 rounded-full"></div>
                             <i className="fa-solid fa-chevron-right text-[8px] text-slate-200"></i>
                             <div className="h-[2px] flex-1 bg-slate-100 rounded-full"></div>
                          </div>
                       </div>

                       <div className="flex flex-col items-center gap-1 shrink-0 w-[85px]">
                          <img src={receiver?.avatar} className="w-12 h-12 rounded-2xl shadow-sm border border-slate-100" />
                          <p className="text-[10px] font-black text-slate-900 truncate w-full text-center">{receiver?.name}</p>
                          <span className="text-[7px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-1.5 py-0.5 rounded-full">GETS</span>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => {setPaymentModal({settlement: s, show: true}); setShowUpiInput(false);}} className="bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-indigo-700 active:scale-95 transition-all">PAY NOW</button>
                      <button onClick={() => handleWhatsAppReminder(s)} className="bg-green-50 text-green-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-100 transition-all border border-green-100 active:scale-95">REMIND</button>
                      <button onClick={() => onSettle(s.from, s.to, s.amount)} className="col-span-2 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors border border-dashed border-slate-100 rounded-xl">Manual Settle</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl shadow-slate-100/30 border border-slate-50 flex flex-col">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><i className="fa-solid fa-chart-simple text-xl"></i></div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Balance Map</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your squad status</p>
            </div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '1.5rem', border: 'none', background: '#1e293b', color: '#fff', fontSize: '10px', fontWeight: 'bold' }} />
                <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={32}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.value >= 0 ? '#10b981' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {paymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[3rem] max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-10 border-b border-slate-50 text-center bg-slate-50/50">
               <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-4 block">PAYMENT REQUEST</span>
               <h3 className="text-5xl font-black text-slate-900 tracking-tighter">₹{paymentModal.settlement.amount.toFixed(0)}</h3>
               <p className="text-sm font-bold text-slate-500 mt-4 uppercase">Pay to {getParticipantName(paymentModal.settlement.to)}</p>
            </div>
            
            <div className="p-8 space-y-4">
              {!showUpiInput ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => openUpiApp()} className="flex flex-col items-center justify-center gap-3 p-5 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-all border border-slate-100 group">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-2xl text-slate-900"><i className="fa-brands fa-google-pay"></i></div>
                      <span className="text-[9px] font-black uppercase text-slate-600">G-Pay</span>
                    </button>
                    <button onClick={() => openUpiApp()} className="flex flex-col items-center justify-center gap-3 p-5 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-all border border-slate-100 group">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-2xl text-purple-600"><i className="fa-solid fa-mobile-screen-button"></i></div>
                      <span className="text-[9px] font-black uppercase text-slate-600">PhonePe</span>
                    </button>
                    <button onClick={() => openUpiApp()} className="flex flex-col items-center justify-center gap-3 p-5 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-all border border-slate-100 group">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-2xl text-slate-900"><i className="fa-solid fa-credit-card"></i></div>
                      <span className="text-[9px] font-black uppercase text-slate-600">CRED</span>
                    </button>
                    <button onClick={() => setShowUpiInput(true)} className="flex flex-col items-center justify-center gap-3 p-5 bg-indigo-50 rounded-3xl hover:bg-indigo-100 transition-all border border-indigo-100 group">
                      <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-sm text-2xl text-white"><i className="fa-solid fa-at"></i></div>
                      <span className="text-[9px] font-black uppercase text-indigo-600">Enter UPI</span>
                    </button>
                  </div>
                  <button onClick={() => openUpiApp()} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">Launch All Apps</button>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-1">Recipient ID</label>
                    <input 
                      type="text" 
                      autoFocus
                      value={manualUpi} 
                      onChange={e => setManualUpi(e.target.value)}
                      placeholder="username@bank"
                      className="w-full px-8 py-5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-600 focus:bg-white transition-all text-sm font-bold outline-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowUpiInput(false)} className="flex-1 py-5 bg-slate-100 rounded-2xl font-black text-[10px] uppercase">Back</button>
                    <button onClick={() => openUpiApp()} className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-indigo-100">Proceed to Pay</button>
                  </div>
                </div>
              )}
              <button onClick={() => setPaymentModal(null)} className="w-full pt-4 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 transition-colors">Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlementView;
