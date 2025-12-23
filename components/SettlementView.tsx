
import React from 'react';
import { Participant, Settlement, Balance } from '../types.ts';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface Props {
  participants: Participant[];
  balances: Balance[];
  settlements: Settlement[];
  totalSpent: number;
  onSettle: (fromId: string, toId: string, amount: number) => void;
  onUpdateUpi: (id: string, upiId: string) => void;
}

const SettlementView: React.FC<Props> = ({ participants, balances, settlements, totalSpent, onSettle, onUpdateUpi }) => {
  const getParticipant = (id: string) => participants.find(p => p.id === id);
  const getParticipantName = (id: string) => getParticipant(id)?.name || 'Guest';
  
  const handleWhatsAppRequest = (s: Settlement) => {
    const payer = getParticipant(s.from);
    const payee = getParticipant(s.to);
    
    if (!payer || !payee) return;

    let targetUpi = payee.upiId;
    
    // If no UPI ID, prompt for it as requested
    if (!targetUpi) {
      const input = prompt(`Enter UPI ID for ${payee.name} to include in the WhatsApp reminder:`, "");
      if (input === null) return; 
      if (input.trim()) {
        targetUpi = input.trim();
        onUpdateUpi(payee.id, targetUpi);
      }
    }

    let message = `Hi ${payer.name}, splitIt reminder! ⚡\n\nYou owe me *₹${s.amount.toFixed(2)}*.\n`;
    if (targetUpi) {
      const upiLink = `upi://pay?pa=${targetUpi}&pn=${encodeURIComponent(payee.name)}&am=${s.amount.toFixed(2)}&cu=INR`;
      message += `\nDirect Pay: ${upiLink}\nUPI ID: *${targetUpi}*`;
    }

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const chartData = balances.map(b => ({
    name: getParticipantName(b.participantId),
    value: b.amount
  }));

  return (
    <div className="space-y-20 animate-in fade-in slide-in-from-bottom-10 duration-1000">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Settlement List */}
        <div className="space-y-10">
          <h2 className="text-5xl font-black tracking-tighter uppercase border-b-8 border-zinc-950 pb-6">Settlement</h2>
          <div className="space-y-6">
            {settlements.length === 0 ? (
              <div className="text-center py-32 bg-zinc-50 rounded-[3rem] border-2 border-dashed border-zinc-100">
                <i className="fa-solid fa-circle-check text-5xl text-zinc-200 mb-6 block"></i>
                <p className="text-zinc-400 font-black text-sm uppercase tracking-[0.3em]">All settled up</p>
              </div>
            ) : (
              settlements.map((s, idx) => (
                <div key={idx} className="group bg-zinc-50 p-10 rounded-[3rem] border-2 border-transparent hover:border-zinc-950 transition-all space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block">Debtor</span>
                      <p className="text-2xl font-black tracking-tighter uppercase">{getParticipantName(s.from)}</p>
                    </div>
                    <div className="flex flex-col items-center px-8 text-zinc-200 group-hover:text-zinc-950 transition-colors">
                      <i className="fa-solid fa-chevron-right text-3xl"></i>
                      <div className="bg-white px-5 py-2 rounded-full border border-zinc-100 shadow-sm mt-3">
                         <p className="text-xl font-black text-zinc-950">₹{s.amount.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block">Creditor</span>
                      <p className="text-2xl font-black tracking-tighter uppercase">{getParticipantName(s.to)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleWhatsAppRequest(s)}
                      className="bg-zinc-950 text-white text-[10px] font-black uppercase tracking-[0.2em] py-5 px-6 rounded-[2rem] transition-all hover:bg-zinc-800 flex items-center justify-center gap-3 shadow-xl"
                    >
                      <i className="fa-brands fa-whatsapp text-lg"></i>
                      WhatsApp Request
                    </button>
                    <button
                      onClick={() => onSettle(s.from, s.to, s.amount)}
                      className="bg-white text-zinc-950 text-[10px] font-black uppercase tracking-[0.2em] py-5 px-6 rounded-[2rem] border-2 border-zinc-200 hover:border-zinc-950 transition-all shadow-sm"
                    >
                      Settle Balance
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visualization */}
        <div className="space-y-10">
          <h2 className="text-5xl font-black tracking-tighter uppercase border-b-8 border-zinc-950 pb-6">Group Balances</h2>
          <div className="bg-white p-12 rounded-[3.5rem] border-4 border-zinc-100 h-[500px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="10 10" horizontal={false} stroke="#f8fafc" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#000', textTransform: 'uppercase', letterSpacing: '0.1em' }} 
                />
                <Tooltip 
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ borderRadius: '2rem', border: 'none', background: '#000', color: '#fff', padding: '1.5rem' }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}
                />
                <Bar dataKey="value" radius={[0, 20, 20, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#000' : '#e4e4e7'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Aggregate Stats Card */}
      <div className="relative overflow-hidden bg-zinc-950 p-16 rounded-[4rem] text-white flex flex-col md:flex-row items-center justify-between gap-16 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-zinc-800 rounded-full blur-[120px] opacity-20 -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-zinc-800 rounded-full blur-[100px] opacity-10 -ml-32 -mb-32"></div>

        <div className="text-center md:text-left relative z-10">
          <h3 className="text-zinc-500 font-black uppercase text-xs tracking-[0.5em] mb-6">Aggregate Expenditure</h3>
          <p className="text-8xl font-black tracking-tighter leading-none">₹{totalSpent.toLocaleString('en-IN')}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-8 w-full md:w-auto relative z-10">
          <div className="bg-zinc-900/50 backdrop-blur-md p-10 rounded-[3rem] border border-zinc-800 text-center space-y-3 min-w-[200px]">
            <span className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Avg / Head</span>
            <span className="text-3xl font-black">₹{(totalSpent / (participants.length || 1)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur-md p-10 rounded-[3rem] border border-zinc-800 text-center space-y-3 min-w-[200px]">
            <span className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Pending</span>
            <span className="text-3xl font-black">{settlements.length} <span className="text-xs text-zinc-600">DUES</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementView;
