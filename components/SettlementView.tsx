
import React from 'react';
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
  const getParticipant = (id: string) => participants.find(p => p.id === id);
  const getParticipantName = (id: string) => getParticipant(id)?.name || 'Guest';
  
  const handleWhatsAppRequest = (s: Settlement) => {
    const payer = getParticipant(s.from);
    const payee = getParticipant(s.to);
    if (!payer || !payee) return;
    
    let message = `Hi ${payer.name}, reminder from SplitIt! 👋\n\nYou owe me *₹${s.amount.toFixed(2)}*.`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const chartData = balances.map(b => ({
    name: getParticipantName(b.participantId),
    value: b.amount
  }));

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* Settlements */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6 sm:mb-8 text-[#1e293b]">
            <i className="fa-solid fa-handshake text-[#4f46e5]"></i>
            <h2 className="text-lg sm:text-xl font-bold">Suggested Payments</h2>
          </div>
          <div className="space-y-4">
            {settlements.length === 0 ? (
              <div className="text-center py-10 sm:py-12 bg-slate-50 rounded-2xl">
                <p className="text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-widest">Everything is settled!</p>
              </div>
            ) : (
              settlements.map((s, idx) => (
                <div key={idx} className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100 hover:border-[#4f46e5] transition-all">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <div className="text-left min-w-0 flex-1">
                      <span className="text-[8px] sm:text-[10px] font-bold uppercase text-slate-400 block mb-1">Debtor</span>
                      <p className="font-bold text-[#1e293b] truncate text-xs sm:text-sm">{getParticipantName(s.from)}</p>
                    </div>
                    <div className="text-center flex flex-col items-center shrink-0">
                      <i className="fa-solid fa-arrow-right text-[#4f46e5] mb-1 text-xs"></i>
                      <p className="text-sm sm:text-lg font-bold text-[#1e293b]">₹{s.amount.toFixed(0)}</p>
                    </div>
                    <div className="text-right min-w-0 flex-1">
                      <span className="text-[8px] sm:text-[10px] font-bold uppercase text-slate-400 block mb-1">Creditor</span>
                      <p className="font-bold text-[#1e293b] truncate text-xs sm:text-sm">{getParticipantName(s.to)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={() => handleWhatsAppRequest(s)}
                      className="bg-green-500 text-white text-[9px] sm:text-[10px] font-bold uppercase py-2.5 sm:py-3 rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <i className="fa-brands fa-whatsapp text-xs sm:text-sm"></i>
                      <span className="truncate">Request</span>
                    </button>
                    <button
                      onClick={() => onSettle(s.from, s.to, s.amount)}
                      className="bg-[#4f46e5] text-white text-[9px] sm:text-[10px] font-bold uppercase py-2.5 sm:py-3 rounded-xl hover:bg-[#4338ca] transition-colors"
                    >
                      <span className="truncate">Mark Paid</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Balance Distribution */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6 sm:mb-8 text-[#1e293b]">
            <i className="fa-solid fa-chart-bar text-[#4f46e5]"></i>
            <h2 className="text-lg sm:text-xl font-bold">Balance Overview</h2>
          </div>
          <div className="h-[250px] sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 5, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={60} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', background: '#1e293b', color: '#fff', fontSize: '10px' }}
                  formatter={(value: number) => `₹${value.toFixed(2)}`}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Aggregate */}
      <div className="bg-[#1e293b] p-6 sm:p-12 rounded-[2rem] sm:rounded-[2.5rem] text-white flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-8 shadow-xl">
        <div className="text-center sm:text-left">
          <h3 className="text-slate-500 font-bold uppercase text-[9px] sm:text-[10px] tracking-[0.2em] mb-2">Aggregate Spent</h3>
          <p className="text-4xl sm:text-5xl font-bold tracking-tight">₹{totalSpent.toFixed(0)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-700 text-center">
            <span className="block text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase mb-1 sm:mb-2">Per Person</span>
            <span className="text-base sm:text-xl font-bold">₹{(totalSpent / (participants.length || 1)).toFixed(0)}</span>
          </div>
          <div className="bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-700 text-center">
            <span className="block text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase mb-1 sm:mb-2">Active Dues</span>
            <span className="text-base sm:text-xl font-bold">{settlements.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementView;
