
import React, { useMemo } from 'react';
import { Participant, Expense } from '../types.ts';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Props {
  participants: Participant[];
  expenses: Expense[];
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const OverviewCharts: React.FC<Props> = ({ participants, expenses }) => {
  const spendingByMember = useMemo(() => {
    const data: Record<string, number> = {};
    participants.forEach(p => data[p.name] = 0);
    expenses.forEach(e => {
      if (e.category !== 'Payment') {
        const name = participants.find(p => p.id === e.payerId)?.name || 'Unknown';
        data[name] = (data[name] || 0) + e.amount;
      }
    });
    return Object.entries(data).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [participants, expenses]);

  const spendingByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.category !== 'Payment') {
        data[e.category] = (data[e.category] || 0) + e.amount;
      }
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  if (expenses.filter(e => e.category !== 'Payment').length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
          <i className="fa-solid fa-chart-pie text-lg"></i>
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight">Analytics</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spending Breakdown</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 text-center">Spending by Member</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendingByMember} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }} 
                  contentStyle={{ borderRadius: '1rem', border: 'none', background: '#1e293b', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} 
                />
                <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 text-center">Category Split</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spendingByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {spendingByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', background: '#1e293b', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {spendingByCategory.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }}></div>
                  <span className="text-[9px] font-black uppercase text-slate-400">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewCharts;
