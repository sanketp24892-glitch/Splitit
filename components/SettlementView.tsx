
import React from 'react';
import { Participant, Settlement, Balance } from '../types.ts';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Props {
  participants: Participant[];
  balances: Balance[];
  settlements: Settlement[];
  totalSpent: number;
}

const SettlementView: React.FC<Props> = ({ participants, balances, settlements, totalSpent }) => {
  const getParticipantName = (id: string) => participants.find(p => p.id === id)?.name || 'Unknown';
  
  const chartData = balances.map(b => ({
    name: getParticipantName(b.participantId),
    value: b.amount
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settlement Summary */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <i className="fa-solid fa-handshake text-indigo-600"></i>
            Settlement Guide
          </h2>
          <div className="space-y-3">
            {settlements.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Everything settled up!</p>
            ) : (
              settlements.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase">From</span>
                    <span className="font-bold text-slate-700">{getParticipantName(s.from)}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <i className="fa-solid fa-arrow-right text-indigo-400"></i>
                    <span className="text-sm font-black text-indigo-600">₹{s.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-400 uppercase">To</span>
                    <span className="font-bold text-slate-700">{getParticipantName(s.to)}</span>
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
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
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
      <div className="bg-indigo-600 p-8 rounded-2xl shadow-lg shadow-indigo-100 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-indigo-200 font-semibold mb-1">Total Trip Spending</h3>
          <p className="text-4xl font-black">₹{totalSpent.toFixed(2)}</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
            <span className="block text-xs font-bold text-indigo-200">Per Person Avg</span>
            <span className="text-xl font-bold">₹{(totalSpent / (participants.length || 1)).toFixed(2)}</span>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
            <span className="block text-xs font-bold text-indigo-200">Transactions</span>
            <span className="text-xl font-bold">{settlements.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementView;
