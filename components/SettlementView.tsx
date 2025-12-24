
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
    const msg = `Hey ${payer.name}, heads up from SplitIt! 👋\nYou owe me *₹${s.amount.toFixed(0)}*.\n${payee.upiId ? `\nMy UPI: ${payee.upiId}` : ''}\n\nThanks! 💸`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const openUpiApp = () => {
    if (!paymentModal) return;
    const payee = getParticipant(paymentModal.settlement.to);
    const upi = manualUpi || payee?.upiId;
    if (!upi) {
      setShowUpiInput(true);
      return;
    }
    const link = `upi://pay?pa=${upi}&pn=${encodeURIComponent(payee?.name || 'User')}&am=${paymentModal.settlement.amount.toFixed(2)}&cu=INR`;
    window.location.href = link;
  };

  const chartData = balances.map(b => ({
    name: getParticipantName(b.participantId),
    value: b.amount
  }));

  return (
    <div className="space-y-6 animate-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2rem] p-5 sm:p-8 shadow-xl shadow-slate-100/30 border border-slate-50">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-hand-holding-dollar text-lg"></i></div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Who Owes Whom</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mobile settlement flow</p>
            </div>
          </div>

          <div className="space-y-4">
            {settlements.length === 0 ? (
              <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                <p className="text-slate-300 font-black text-[10px] uppercase tracking-widest">No pending debts! 🥂</p>
              </div>
            ) : (
              settlements.map((s, idx) => {
                const payer = getParticipant(s.from);
                const receiver = getParticipant(s.to);
                return (
                  <div key={idx} className="bg-white border border-slate-100 rounded-[2rem] p-4 sm:p-5 hover:border-indigo-100 transition-all space-y-5 shadow-sm">
                    {/* Horizontal Debt Journey Display */}
                    <div className="flex items-center justify-between gap-1">
                       <div className="flex flex-col items-center gap-1.5 shrink-0 w-[85px]">
                          <img src={payer?.avatar} className="w-12 h-12 rounded-2xl shadow-sm border border-slate-100 bg-slate-50" />
                          <div className="text-center w-full px-1">
                            <p className="text-[10px] font-black text-slate-900 truncate leading-tight uppercase">{payer?.name}</p>
                            <span className="text-[7px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full block mt-0.5">PAYER</span>
                          </div>
                       </div>

                       <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">
                          <p className="text-2xl font-black text-slate-900 tracking-tighter mb-1">₹{s.amount.toFixed(0)}</p>
                          <div className="flex items-center w-full px-1 gap-1 opacity-20">
                             <div className="h-0.5 flex-1 bg-slate-400 rounded-full"></div>
                             <i className="fa-solid fa-chevron-right text-[7px] text-slate-900"></i>
                             <div className="h-0.5 flex-1 bg-slate-400 rounded-full"></div>
                          </div>
                       </div>

                       <div className="flex flex-col items-center gap-1.5 shrink-0 w-[85px]">
                          <img src={receiver?.avatar} className="w-12 h-12 rounded-2xl shadow-sm border border-slate-100 bg-slate-50" />
                          <div className="text-center w-full px-1">
                            <p className="text-[10px] font-black text-slate-900 truncate leading-tight uppercase">{receiver?.name}</p>
                            <span className="text-[7px] font-black text-green-500 bg-green-50 px-2 py-0.5 rounded-full block mt-0.5">RECEIVER</span>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button onClick={() => {setPaymentModal({settlement: s, show: true}); setShowUpiInput(false);}} className="bg-indigo-600 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all">PAY NOW</button>
                      <button onClick={() => handleWhatsAppReminder(s)} className="bg-green-50 text-green-600 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-100 transition-all border border-green-100 active:scale-95">REMIND</button>
                      <button onClick={() => onSettle(s.from, s.to, s.amount)} className="col-span-2 py-2 text-[8px] font-black text-slate-300 uppercase tracking-widest text-center hover:text-indigo-600 border border-dashed border-slate-100 rounded-xl">Mark Settled Manual</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-5 sm:p-8 shadow-xl shadow-slate-100/30 border border-slate-50 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-chart-simple text-lg"></i></div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Balances</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Net squad standing</p>
            </div>
          </div>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={70} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '1rem', border: 'none', background: '#1e293b', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.value >= 0 ? '#10b981' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {paymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-50 text-center bg-slate-50/50">
               <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-3 block">PAYMENT PORTAL</span>
               <h3 className="text-4xl font-black text-slate-900 tracking-tighter">₹{paymentModal.settlement.amount.toFixed(0)}</h3>
               <p className="text-xs font-bold text-slate-500 mt-3 uppercase">Pay to {getParticipantName(paymentModal.settlement.to)}</p>
            </div>
            
            <div className="p-6 space-y-3">
              {!showUpiInput ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={openUpiApp} className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 active:scale-95 transition-all hover:bg-slate-100">
                      <div className="text-xl text-slate-900"><i className="fa-brands fa-google-pay"></i></div>
                      <span className="text-[8px] font-black uppercase text-slate-500">G-Pay</span>
                    </button>
                    <button onClick={openUpiApp} className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 active:scale-95 transition-all hover:bg-slate-100">
                      <div className="text-xl text-purple-600"><i className="fa-solid fa-mobile-screen-button"></i></div>
                      <span className="text-[8px] font-black uppercase text-slate-500">PhonePe</span>
                    </button>
                    <button onClick={() => setShowUpiInput(true)} className="col-span-2 flex items-center justify-center gap-2 p-3.5 bg-indigo-50 rounded-xl border border-indigo-100 active:scale-95 transition-all">
                      <div className="text-base text-indigo-600"><i className="fa-solid fa-at"></i></div>
                      <span className="text-[9px] font-black uppercase text-indigo-600">Manual UPI Entry</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-300 px-1">Recipient VPA</label>
                    <input type="text" autoFocus value={manualUpi} onChange={e => setManualUpi(e.target.value)} placeholder="username@upi" className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowUpiInput(false)} className="flex-1 py-3.5 bg-slate-100 rounded-xl font-black text-[9px] uppercase">Back</button>
                    <button onClick={openUpiApp} className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg shadow-indigo-100">Proceed</button>
                  </div>
                </div>
              )}
              <button onClick={() => setPaymentModal(null)} className="w-full pt-3 text-[9px] font-black text-slate-300 uppercase tracking-widest text-center hover:text-slate-500 transition-colors">Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlementView;
