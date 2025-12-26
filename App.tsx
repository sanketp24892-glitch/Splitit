
import React, { useState, useMemo, useEffect } from 'react';
import { Participant, Expense, SplitEvent } from './types.ts';
import ParticipantManager from './components/ParticipantManager.tsx';
import ExpenseForm from './components/ExpenseForm.tsx';
import SettlementView from './components/SettlementView.tsx';
import OverviewCharts from './components/OverviewCharts.tsx';
import { calculateBalances, calculateSettlements } from './utils/calculation.ts';
import * as db from './services/supabaseService.ts';

interface RecentEvent {
  code: string;
  name: string;
}

interface ActivityLog {
  id: string;
  description: string;
  created_at: string;
}

const generateShortId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const App: React.FC = () => {
  const [activeEvent, setActiveEvent] = useState<SplitEvent | null>(null);
  const [path, setPath] = useState(window.location.pathname);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAppShareModal, setShowAppShareModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const navigate = (to: string) => {
    window.history.pushState(null, "", to);
    setPath(to);
    window.scrollTo(0, 0);
  };

  const routeMatch = useMemo(() => {
    if (path === '/' || path === '') return { type: 'home' };
    if (path === '/create') return { type: 'create' };
    const eventMatch = path.match(/^\/event\/([a-z0-9]{6})(\/settlement)?$/);
    if (eventMatch) {
      return { 
        type: 'event', 
        code: eventMatch[1], 
        tab: eventMatch[2] === '/settlement' ? 'settlement' : 'overview' 
      };
    }
    return { type: 'home' };
  }, [path]);

  useEffect(() => {
    const saved = localStorage.getItem('splitit_recent_events_v3');
    if (saved) setRecentEvents(JSON.parse(saved));
  }, []);

  const addToRecent = (code: string, name: string) => {
    setRecentEvents(prev => {
      const filtered = prev.filter(e => e.code !== code);
      const updated = [{ code, name }, ...filtered].slice(0, 5);
      localStorage.setItem('splitit_recent_events_v3', JSON.stringify(updated));
      return updated;
    });
  };

  const loadData = async (code: string) => {
    setLoading(true);
    try {
      const data = await db.fetchEventByCode(code);
      if (data) {
        setActiveEvent(data);
        addToRecent(code, data.name);
        const history = await db.fetchActivityHistory(data.id);
        setActivities(history);
      }
    } catch (err) {
      console.error("Failed to load event:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (routeMatch.type === 'event') {
      loadData(routeMatch.code);
    } else {
      setActiveEvent(null);
    }
    setIsInitialized(true);
  }, [routeMatch.code, routeMatch.type]);

  useEffect(() => {
    if (activeEvent?.id && routeMatch.type === 'event') {
      return db.subscribeToChanges(activeEvent.id, () => loadData(routeMatch.code));
    }
  }, [activeEvent?.id]);

  const { balances, settlements, totalSpent } = useMemo(() => {
    if (!activeEvent) return { balances: [], settlements: [], totalSpent: 0 };
    const safeBals = calculateBalances(activeEvent.participants, activeEvent.expenses);
    const setts = calculateSettlements(safeBals);
    const total = activeEvent.expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0);
    return { balances: safeBals, settlements: setts, totalSpent: total };
  }, [activeEvent]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    const code = generateShortId();
    try {
      await db.createEvent(newEventName.trim(), code);
      addToRecent(code, newEventName.trim());
      navigate(`/event/${code}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create event. Please try again.");
    }
  };

  const handleAddParticipant = async (name: string, upiId?: string) => {
    if (!activeEvent) return;
    try {
      await db.addParticipant(activeEvent.id, { 
        name, 
        upiId, 
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=4f46e5&textColor=ffffff` 
      });
      await loadData(routeMatch.code);
    } catch (err) {
      console.error("Add participant error:", err);
      alert("Could not add member. Please check your connection.");
    }
  };

  const handleAddExpense = async (exp: Omit<Expense, 'id'>) => {
    if (!activeEvent) return;
    try {
      await db.addExpense(activeEvent.id, exp);
      await loadData(routeMatch.code);
    } catch (err) {
      console.error("Add expense error:", err);
    }
  };

  const handleUpdateExpense = async (id: string, exp: Partial<Expense>) => {
    if (!activeEvent) return;
    try {
      await db.updateExpense(id, exp, activeEvent.id);
      await loadData(routeMatch.code);
      setEditingExpense(null);
    } catch (err) {
      console.error("Update expense error:", err);
    }
  };

  const handleShare = (type: 'whatsapp' | 'sms' | 'copy' | 'gmail', isAppShare?: boolean) => {
    let text = '';
    if (isAppShare) {
      text = `Found a simple way to split and settle expenses very easily — no apps to install, no Excel sheets.\n\nYou can split and settle expenses very easily, track payments in real time, and avoid confusion later\n\nJust open the link and update\n\nTry it now: *www.splitits.in*\n\n_Less maths. More memories_`;
    } else {
      const url = window.location.origin + `/event/${routeMatch.code}`;
      text = `Join my event *${activeEvent?.name}* on Splitit: ${url}\n\nLess maths. More memories.\nTry Splitit → www.splitits.in`;
    }
    
    if (type === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (type === 'sms') {
      window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank');
    } else if (type === 'gmail') {
      const subject = isAppShare ? "Found a simple way to split expenses" : `Expense details for ${activeEvent?.name}`;
      const plainText = text.replace(/\*/g, '').replace(/_/g, '');
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`, '_blank');
    } else {
      navigator.clipboard.writeText(text.replace(/\*/g, '').replace(/_/g, ''));
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    }
  };

  if (!isInitialized) return null;

  if (routeMatch.type === 'home') {
    return (
      <div className="min-h-screen bg-white flex flex-col font-sans animate-in overflow-hidden relative">
        <header className="p-6 sm:p-8 absolute top-0 left-0 z-10 w-full">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-100">
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tighter leading-none">
                <span className="text-slate-900">Split</span>
                <span className="text-indigo-600">It</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 lowercase tracking-tight mt-1 whitespace-nowrap overflow-visible">
                trips end. memories stay. debts don’t.
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-4xl mx-auto w-full text-center space-y-8 pt-20">
          <div className="space-y-4">
            <h1 className="text-[54px] sm:text-[90px] font-[900] text-slate-900 tracking-tighter leading-[0.9] max-w-2xl mx-auto">
              Stop doing <span className="text-indigo-600 italic">awkward</span> math.
            </h1>
            <p className="text-sm sm:text-xl font-medium text-slate-500 max-w-lg mx-auto leading-relaxed px-4">
              The cleanest way to split bills, track group expenses, and settle debts instantly with the squad.
            </p>
          </div>

          <div className="flex flex-col items-center gap-10 w-full">
            <button 
              onClick={() => navigate('/create')}
              className="w-full max-w-[280px] px-8 py-5 bg-[#4f46e5] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all hover:bg-indigo-700"
            >
              Start an Event
            </button>

            {recentEvents.length > 0 && (
              <div className="space-y-4 animate-in w-full px-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Recent Events</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {recentEvents.map(event => (
                    <button 
                      key={event.code} 
                      onClick={() => navigate(`/event/${event.code}`)}
                      className="px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black text-slate-700 hover:bg-white hover:border-indigo-100 transition-all flex flex-col items-center min-w-[120px]"
                    >
                      <span className="truncate w-full text-center uppercase">{event.name}</span>
                      <span className="text-[7px] text-slate-300 uppercase mt-1">{event.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => setShowAppShareModal(true)}
              className="mt-2 px-6 py-3 border border-slate-200 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2 active:scale-95"
            >
              <i className="fa-solid fa-share-nodes"></i>
              Share with friends
            </button>
          </div>
        </main>

        <footer className="w-full p-8 text-center space-y-1">
          <p className="text-[10px] font-bold text-slate-400 lowercase tracking-tight italic">
            Less maths. More memories.
          </p>
          <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">
            Try Splitit → <span className="underline cursor-pointer">www.splitits.in</span>
          </p>
        </footer>

        {showAppShareModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in">
            <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto shadow-lg"><i className="fa-solid fa-share-nodes"></i></div>
              <h3 className="text-xl font-black">Share SplitIt</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">Help your friends stop doing awkward math too!</p>
              
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => handleShare('whatsapp', true)} className="w-full flex items-center justify-center gap-3 py-4 bg-green-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                  <i className="fa-brands fa-whatsapp text-lg"></i> WhatsApp
                </button>
                <button onClick={() => handleShare('gmail', true)} className="w-full flex items-center justify-center gap-3 py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                  <i className="fa-solid fa-envelope text-lg"></i> Gmail
                </button>
                <button onClick={() => handleShare('sms', true)} className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                  <i className="fa-solid fa-comment-sms text-lg"></i> Text Message
                </button>
                <button onClick={() => handleShare('copy', true)} className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${shareStatus==='copied' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  {shareStatus==='copied' ? <><i className="fa-solid fa-check"></i> Copied</> : <><i className="fa-solid fa-link"></i> Copy Link</>}
                </button>
              </div>
              
              <button onClick={() => setShowAppShareModal(false)} className="w-full py-2 text-[10px] font-black text-slate-300 uppercase">Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (routeMatch.type === 'create') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center px-6 animate-in">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl shadow-indigo-100/50 border border-slate-50 space-y-8 text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto shadow-lg"><i className="fa-solid fa-receipt"></i></div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Name your squad</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">What's the occasion?</p>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <input 
              type="text" 
              autoFocus
              required
              value={newEventName}
              onChange={e => setNewEventName(e.target.value)}
              placeholder="e.g. Goa Trip 2025"
              className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white text-lg font-bold transition-all outline-none text-center"
            />
            <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Create Event</button>
            <button type="button" onClick={() => navigate('/')} className="w-full py-2 text-[10px] font-black text-slate-300 uppercase">Cancel</button>
          </form>
        </div>
        <div className="mt-8 text-center space-y-1">
          <p className="text-[10px] font-bold text-slate-400 lowercase tracking-tight italic">
            Less maths. More memories.
          </p>
          <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">
            Try Splitit → <span className="underline">www.splitits.in</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 h-20 shadow-sm">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={()=>navigate('/')} className="w-9 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 transition-colors"><i className="fa-solid fa-arrow-left"></i></button>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black truncate uppercase tracking-tight">{activeEvent?.name || 'Loading...'}</h1>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{routeMatch.code}</p>
            </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button onClick={()=>navigate(`/event/${routeMatch.code}`)} className={`px-4 py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase transition-all ${routeMatch.tab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>OVERVIEW</button>
            <button onClick={()=>navigate(`/event/${routeMatch.code}/settlement`)} className={`px-4 py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase transition-all ${routeMatch.tab === 'settlement' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>SETTLEMENT</button>
          </nav>
        </div>
      </header>

      {loading && !activeEvent ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Syncing...</p>
        </div>
      ) : activeEvent && (
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6 animate-in pb-10">
          <div className="bg-white px-6 py-5 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex gap-10 text-center sm:text-left">
              <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Spent</span><p className="text-xl sm:text-2xl font-black">₹{totalSpent.toFixed(0)}</p></div>
              <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Squad</span><p className="text-xl sm:text-2xl font-black">{activeEvent.participants.length}</p></div>
            </div>
            <button onClick={()=>setShowShareModal(true)} className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all">Share with Squad</button>
          </div>

          {routeMatch.tab === 'overview' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-4 order-1">
                <ParticipantManager 
                  participants={activeEvent.participants} 
                  onAdd={handleAddParticipant} 
                  onRemove={async (id) => {
                    const participant = activeEvent.participants.find(p => p.id === id);
                    if (participant && window.confirm(`Are you sure you want to remove ${participant.name}?`)) {
                      await db.deleteParticipant(id, activeEvent.id, participant.name);
                      loadData(routeMatch.code);
                    }
                  }} 
                />
              </div>
              <div id="expense-form-section" className="lg:col-span-8 order-2 space-y-8">
                <ExpenseForm 
                  participants={activeEvent.participants} 
                  onAdd={handleAddExpense}
                  onUpdate={handleUpdateExpense}
                  editingExpense={editingExpense}
                  onCancelEdit={() => setEditingExpense(null)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Transactions List */}
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 text-center lg:text-left">Transactions</h3>
                    
                    <div className="flex-1 flex flex-col min-w-0">
                      {/* Grid Header */}
                      <div className="grid grid-cols-4 gap-2 px-2 mb-3 border-b border-slate-50 pb-2">
                        <span className="text-[8px] font-black text-slate-300 uppercase">Category</span>
                        <span className="text-[8px] font-black text-slate-300 uppercase">Paid By</span>
                        <span className="text-[8px] font-black text-slate-300 uppercase text-center">Amount</span>
                        <span className="text-[8px] font-black text-slate-300 uppercase text-right">Split Among</span>
                      </div>

                      <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-hide">
                        {activeEvent.expenses.length === 0 ? (
                          <div className="text-center py-10 text-slate-200 font-black text-[10px] uppercase">No transactions yet</div>
                        ) : (
                          [...activeEvent.expenses].sort((a,b)=>b.date-a.date).map(e => {
                            const payer = activeEvent.participants.find(p => p.id === e.payerId)?.name || 'member';
                            const splitAmong = e.participantIds.length === activeEvent.participants.length 
                              ? 'All' 
                              : e.participantIds.map(id => activeEvent.participants.find(p => p.id === id)?.name).join(', ');

                            return (
                              <div 
                                key={e.id} 
                                onClick={() => setSelectedExpense(e)} 
                                className="grid grid-cols-4 gap-2 p-3 rounded-xl border border-slate-50 hover:border-indigo-100 transition-all cursor-pointer items-center bg-white"
                              >
                                <span className="text-[9px] font-bold text-slate-500 uppercase truncate tracking-tighter">{e.category}</span>
                                <span className="text-[10px] font-black text-slate-800 truncate">{payer}</span>
                                <span className="text-[10px] font-black text-indigo-600 text-center">₹{Number(e.amount).toFixed(0)}</span>
                                <span className="text-[9px] font-medium text-slate-400 text-right leading-tight">{splitAmong}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Update History Section */}
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 text-center lg:text-left">Update History</h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto scrollbar-hide flex-1">
                      {activities.length === 0 ? (
                        <div className="text-center py-10 text-slate-200 font-black text-[10px] uppercase">No updates yet</div>
                      ) : (
                        activities.map((act) => (
                          <div key={act.id} className="flex gap-3 items-start p-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                            <div>
                              <p className="text-[11px] font-bold text-slate-700 leading-tight">{act.description}</p>
                              <p className="text-[8px] font-black text-slate-300 uppercase tracking-tight mt-1">
                                {new Date(act.created_at).toLocaleDateString()} · {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <OverviewCharts 
                    participants={activeEvent.participants} 
                    expenses={activeEvent.expenses} 
                  />
                </div>
                
                <div className="pt-8 text-center space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 lowercase tracking-tight italic">
                    Less maths. More memories.
                  </p>
                  <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">
                    Try Splitit → <span className="underline">www.splitits.in</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <SettlementView 
              participants={activeEvent.participants} 
              balances={balances} 
              settlements={settlements} 
              expenses={activeEvent.expenses}
              totalSpent={totalSpent} 
              onSettle={async (f, t, a, desc, proof) => {
                if (!activeEvent) return;
                try {
                  await db.addExpense(activeEvent.id, { 
                    description: desc, 
                    amount: Number(a), 
                    payerId: f, 
                    participantIds: [t], 
                    category: 'Payment', 
                    date: Date.now(),
                    proofUrl: proof
                  });
                  await loadData(routeMatch.code);
                } catch (err) {
                  console.error("OnSettle Error:", err);
                  throw err;
                }
              }}
              onUndoSettlement={async (id) => {
                if (!activeEvent) return;
                const exp = activeEvent.expenses.find(e => e.id === id);
                if (exp && window.confirm(`Undo this settlement of ₹${exp.amount}?`)) {
                  await db.deleteExpense(id, activeEvent.id, "Settlement");
                  await loadData(routeMatch.code);
                }
              }}
            />
          )}
        </main>
      )}

      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto shadow-lg"><i className="fa-solid fa-users-viewfinder"></i></div>
            <h3 className="text-xl font-black">Share with Squad</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Let everyone add their own expenses in real-time.</p>
            
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => handleShare('whatsapp')} className="w-full flex items-center justify-center gap-3 py-4 bg-green-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                <i className="fa-brands fa-whatsapp text-lg"></i> WhatsApp
              </button>
              <button onClick={() => handleShare('sms')} className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                <i className="fa-solid fa-comment-sms text-lg"></i> Text Message
              </button>
              <button onClick={() => handleShare('copy')} className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${shareStatus==='copied' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
                {shareStatus==='copied' ? <><i className="fa-solid fa-check"></i> Copied</> : <><i className="fa-solid fa-link"></i> Copy Link</>}
              </button>
            </div>
            
            <button onClick={() => setShowShareModal(false)} className="w-full py-2 text-[10px] font-black text-slate-300 uppercase">Close</button>
          </div>
        </div>
      )}

      {showAppShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto shadow-lg"><i className="fa-solid fa-share-nodes"></i></div>
            <h3 className="text-xl font-black">Share SplitIt</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Help your friends stop doing awkward math too!</p>
            
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => handleShare('whatsapp', true)} className="w-full flex items-center justify-center gap-3 py-4 bg-green-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                <i className="fa-brands fa-whatsapp text-lg"></i> WhatsApp
              </button>
              <button onClick={() => handleShare('gmail', true)} className="w-full flex items-center justify-center gap-3 py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                <i className="fa-solid fa-envelope text-lg"></i> Gmail
              </button>
              <button onClick={() => handleShare('sms', true)} className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                <i className="fa-solid fa-comment-sms text-lg"></i> Text Message
              </button>
              <button onClick={() => handleShare('copy', true)} className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${shareStatus==='copied' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
                {shareStatus==='copied' ? <><i className="fa-solid fa-check"></i> Copied</> : <><i className="fa-solid fa-link"></i> Copy Link</>}
              </button>
            </div>
            
            <button onClick={() => setShowAppShareModal(false)} className="w-full py-2 text-[10px] font-black text-slate-300 uppercase">Close</button>
          </div>
        </div>
      )}

      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-8 space-y-6 shadow-2xl animate-in">
            <div className="flex justify-between items-center"><h3 className="text-lg font-black">Expense Detail</h3><button onClick={()=>setSelectedExpense(null)} className="p-2"><i className="fa-solid fa-xmark"></i></button></div>
            <div className="space-y-4 pt-4 border-t border-slate-50">
              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-300 uppercase">Label</span><span className="font-bold text-sm truncate max-w-[150px] text-right">{selectedExpense.description}</span></div>
              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-300 uppercase">Amount</span><span className="font-black text-indigo-600 text-xl">₹{Number(selectedExpense.amount).toFixed(0)}</span></div>
              {selectedExpense.proofUrl && (
                <div className="pt-4 space-y-2">
                  <span className="text-[10px] font-black text-slate-300 uppercase block">Settlement Proof</span>
                  <div className="relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                    <img src={selectedExpense.proofUrl} alt="Proof" className="w-full h-auto max-h-60 object-contain bg-slate-50" />
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  setEditingExpense(selectedExpense);
                  setSelectedExpense(null);
                  const el = document.getElementById('expense-form-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }} 
                className="w-full py-4 bg-indigo-50 text-indigo-600 font-black text-[11px] uppercase rounded-2xl border border-indigo-100 transition-all hover:bg-indigo-100"
              >
                <i className="fa-solid fa-pen mr-2"></i>Edit
              </button>
              <button 
                onClick={async () => {
                  if (window.confirm(`Are you sure you want to delete "${selectedExpense.description}"?`)) {
                    await db.deleteExpense(selectedExpense.id, activeEvent?.id, selectedExpense.description);
                    setSelectedExpense(null);
                    loadData(routeMatch.code);
                  }
                }} 
                className="w-full py-4 bg-red-50 text-red-500 font-black text-[11px] uppercase rounded-2xl border border-red-100 transition-all hover:bg-red-100"
              >
                <i className="fa-solid fa-trash-can mr-2"></i>Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
