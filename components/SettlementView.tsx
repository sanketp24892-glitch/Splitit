
import React from 'react';
import { Participant, Settlement, Balance } from '../types.ts';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Props {
  participants: Participant[];
  balances: Balance[];
  settlements: Settlement[];
  totalSpent: number;
  onSettle: (fromId: string, toId: string, amount: number) => void;
}

const SettlementView: React.FC<Props> = ({ participants, balances, settlements, totalSpent, onSettle }) => {
  const getParticipant = (id: string) => participants.find(p => p.id === id);
  const getParticipantName = (id: string) => getParticipant(id)?.name || 'Unknown';
  
  const handleWhatsAppRequest = (s: Settlement) => {
    const payer = getParticipant(s.from);
    const payee = getParticipant(s.to);
    
    if (!payer || !payee) return;

    let message = `Hi ${payer.name}, just a friendly reminder from SplitIt AI! 👋\n\nYou owe me *₹${s.amount.toFixed(2)}* for our recent expenses.`;
    
    if (payee.upiId) {
      // Create a standard UPI payment link
      const upiLink = `upi://pay?pa=${payee.upiId}&pn=${encodeURIComponent(payee.name)}&am=${s.amount.toFixed(2)}&cu=INR`;
      message += `\n\nYou can pay me here: ${upiLink}\n\nOr use my UPI ID: *${payee.upiId}*`;
    } else {
      message += `\n\nPlease settle up when you can! Thanks!`;
    }

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const chartData = balances.map(b => ({
    name: getParticipantName(b.participantId),
    value: b.amount
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settlement Summary */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <i className="fa-solid fa-handshake text-indigo-600"></i>
            Settlement Guide
          </h2>
          <div className="space-y-3">
            {settlements.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="fa-solid fa-check-double text-2xl"></i>
                </div>
                <p className="text-slate-400 font-medium">Everything settled up!</p>
              </div>
            ) : (
              settlements.map((s, idx) => (
                <div key={idx} className="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From (Payer)</span>
                      <span className="font-bold text-slate-700">{getParticipantName(s.from)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <i className="fa-solid fa-arrow-right text-indigo-300"></i>
                      <span className="text-sm font-black text-indigo-600">₹{s.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To (Payee)</span>
                      <span className="font-bold text-slate-700">{getParticipantName(s.to)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleWhatsAppRequest(s)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <i className="fa-brands fa-whatsapp text-sm"></i>
                      Request
                    </button>
                    <button
                      onClick={() => onSettle(s.from, s.to, s.amount)}
                      className="bg-white hover:bg-indigo-600 hover:text-white text-indigo-600 text-[10px] font-black uppercase tracking-wider py-2 px-3 rounded-lg border border-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-circle-check"></i>
                      Mark Paid
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Balance Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <i className="fa-solid fa-scale-balanced text-indigo-600"></i>
            Net Balances
          </h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`₹${value}`, 'Balance']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 rounded-2xl shadow-xl shadow-indigo-100 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-indigo-100 font-semibold mb-1">Total Group Spend</h3>
          <p className="text-5xl font-black tracking-tight">₹{totalSpent.toFixed(2)}</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10">
            <span className="block text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1">Per Person Avg</span>
            <span className="text-2xl font-black">₹{(totalSpent / (participants.length || 1)).toFixed(2)}</span>
          </div>
          <div className="bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10">
            <span className="block text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1">Dues Outstanding</span>
            <span className="text-2xl font-black">{settlements.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementView;
