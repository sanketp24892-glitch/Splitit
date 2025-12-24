
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
  const getParticipantName = (id: string) => getParticipant(id)?.name || 'Member';

  const handleWhatsAppReminder = (s: Settlement) => {
    const payer = getParticipant(s.from);
    const payee = getParticipant(s.to);
    if (!payer || !payee) return;
    const msg = `Hey ${payer.name}, split our bills on SplitIt! 💸 You owe me *₹${s.amount.toFixed(0)}*.\n${payee.upiId ? `\nMy UPI: ${payee.upiId}` : ''}\n\nThanks! 👋`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
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
    <div className="space-y-6 animate-in pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Settlement Actions */}
        <div className="bg-white rounded-[2rem] p-5 sm:p-8 shadow-xl shadow-slate-100/30 border border-slate-50">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-hand-holding-dollar text-lg"></i></div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Settle Expenses</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Clear the bills</p>
            </div>
          </div>

          <div className="space-y-4">
            {settlements.length === 0 ? (
              <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                <p className="text-slate-300 font-black text-[10px] uppercase tracking-widest">All settled up! 🥂</p>
              </div>
            ) : (
              settlements.map((s, idx) => {
                const payer = getParticipant(s.from);
                const receiver = getParticipant(s.to);
                return (
                  <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-6 hover:border-indigo-100 transition-all space-y-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                       <div className="flex items-center gap-2 min-w-0">
                          <img src={payer?.avatar} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tighter">{payer?.name}</p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Owes</p>
                          </div>
                       </div>
                       
                       <div className="px-1">
                          <i className="fa-solid fa-arrow-right text-slate-200 text-[10px]"></i>
                       </div>

                       <div className="flex items-center gap-2 min-w-0 flex-row-reverse text-right">
                          <img src={receiver?.avatar} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tighter">{receiver?.name}</p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Receives</p>
                          </div>
                       </div>
                    </div>

                    <div className="py-2 text-center border-y border-slate-50">
                       <p className="text-2xl font-black text-indigo-600">₹{s.amount.toFixed(0)}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button 
                        onClick={() => {setPaymentModal({settlement: s, show: true}); setShowUpiInput(false);}} 
                        className="bg-indigo-600 text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md active:scale-95 transition-all"
                      >
                        Make Payment
                      </button>
                      <button 
                        onClick={() => handleWhatsAppReminder(s)} 
                        className="bg-green-50 text-green-600 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-green-100 transition-all border border-green-100 active:scale-95"
                      >
                        Request via WhatsApp
                      </button>
                      <button 
                        onClick={() => onSettle(s.from, s.to, s.amount)} 
                        className="sm:col-span-2 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center hover:bg-slate-50 rounded-xl border border-dashed border-slate-100 active:scale-95"
                      >
                        Settle it Manually
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Balance Chart */}
        <div className="bg-white rounded-[2rem] p-5 sm:p-8 shadow-xl shadow-slate-100/30 border border-slate-50 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-chart-simple text-lg"></i></div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Status</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Squad Standing</p>
            </div>
          </div>
          <div className="flex-1 min-h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} />
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
               <p className="text-[10px] font-bold text-slate-500 mt-3 uppercase">To: {getParticipantName(paymentModal.settlement.to)}</p>
            </div>
            
            <div className="p-6 space-y-3">
              {!showUpiInput ? (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={openUpiApp} className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 active:scale-95 transition-all hover:bg-slate-100">
                    <div className="text-xl text-slate-900"><i className="fa-brands fa-google-pay"></i></div>
                    <span className="text-[8px] font-black uppercase text-slate-500">Google Pay</span>
                  </button>
                  <button onClick={openUpiApp} className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 active:scale-95 transition-all hover:bg-slate-100">
                    <div className="text-xl text-purple-600"><i className="fa-solid fa-mobile-screen-button"></i></div>
                    <span className="text-[8px] font-black uppercase text-slate-500">PhonePe</span>
                  </button>
                  <button onClick={() => setShowUpiInput(true)} className="col-span-2 flex items-center justify-center gap-2 p-4 bg-indigo-50 rounded-xl border border-indigo-100 active:scale-95 transition-all">
                    <div className="text-base text-indigo-600"><i className="fa-solid fa-at"></i></div>
                    <span className="text-[9px] font-black uppercase text-indigo-600">Enter UPI ID Manually</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-300 px-1">Recipient VPA</label>
                    <input type="text" autoFocus value={manualUpi} onChange={e => setManualUpi(e.target.value)} placeholder="username@upi" className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowUpiInput(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest">Back</button>
                    <button onClick={openUpiApp} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg">Proceed</button>
                  </div>
                </div>
              )}
              <button onClick={() => setPaymentModal(null)} className="w-full pt-4 text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlementView;
