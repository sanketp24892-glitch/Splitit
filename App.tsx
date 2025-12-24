
import React, { useState, useMemo, useEffect } from 'react';
import { Participant, Expense, SplitEvent } from './types.ts';
import ParticipantManager from './components/ParticipantManager.tsx';
import ExpenseForm from './components/ExpenseForm.tsx';
import SettlementView from './components/SettlementView.tsx';
import { calculateBalances, calculateSettlements } from './utils/calculation.ts';
import * as db from './services/supabaseService.ts';

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
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  // Router Utility
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

  // Track Recent Events
  useEffect(() => {
    const saved = localStorage.getItem('splitit_recent_codes');
    if (saved) setRecentCodes(JSON.parse(saved));
  }, []);

  const addToRecent = (code: string) => {
    const updated = [code, ...recentCodes.filter(c => c !== code)].slice(0, 5);
    setRecentCodes(updated);
    localStorage.setItem('splitit_recent_codes', JSON.stringify(updated));
  };

  // Load Event Data
  const loadData = async (code: string) => {
    setLoading(true);
    const data = await db.fetchEventByCode(code);
    if (data) {
      setActiveEvent(data);
      addToRecent(code);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (routeMatch.type === 'event') {
      loadData(routeMatch.code);
    } else {
      setActiveEvent(null);
    }
    setIsInitialized(true);
  }, [routeMatch.code, routeMatch.type]);

  // Real-time Sync
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
    await db.createEvent(newEventName.trim(), code);
    navigate(`/event/${code}`);
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setShareStatus('copied');
    setTimeout(() => setShareStatus('idle'), 2000);
  };

  if (!isInitialized) return null;

  if (routeMatch.type === 'home') {
    return (
      <div className="min-h-screen bg-white flex flex-col font-sans animate-in overflow-hidden relative">
        <header className="p-8 absolute top-0 left-0 z-10">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-100">
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tighter">splitIt</h1>
              <p className="text-[9px] font-bold text-slate-400 lowercase tracking-tight -mt-1 leading-none">
                trips end. memories stay. debts don’t.
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-4xl mx-auto w-full text-center space-y-12">
          <div className="space-y-6">
            <h1 className="text-[56px] sm:text-[90px] font-[900] text-slate-900 tracking-tighter leading-[0.95] max-w-2xl mx-auto">
              Stop doing <span className="text-indigo-600 italic">awkward</span> math.
            </h1>
            <p className="text-lg sm:text-2xl font-medium text-slate-400 max-w-lg mx-auto leading-relaxed">
              The cleanest way to split bills, track group expenses, and settle debts instantly with the squad.
            </p>
          </div>

          <div className="flex flex-col items-center gap-10">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <button 
                onClick={() => navigate('/create')}
                className="relative px-12 py-6 bg-indigo-600 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition-all hover:bg-indigo-700"
              >
                Start an Event
              </button>
            </div>

            {recentCodes.length > 0 && (
              <div className="space-y-4 animate-in">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Recently Visited</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {recentCodes.map(code => (
                    <button 
                      key={code} 
                      onClick={() => navigate(`/event/${code}`)}
                      className="px-5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all"
                    >
                      Code: {code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <footer className="pt-16 space-y-3">
            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">good times in, awkward math out.</p>
            <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">Try SplitIt Now: <span className="underline decoration-indigo-200 underline-offset-4">splitits.in</span></p>
          </footer>
        </main>
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">What are we splitting today?</p>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <input 
              type="text" 
              autoFocus
              value={newEventName}
              onChange={e => setNewEventName(e.target.value)}
              placeholder="e.g. Goa Trip 2025"
              className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white text-lg font-bold transition-all outline-none"
            />
            <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Create Event</button>
            <button type="button" onClick={() => navigate('/')} className="w-full py-2 text-[10px] font-black text-slate-300 uppercase">Cancel</button>
          </form>
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
              <h1 className="text-sm font-black truncate uppercase tracking-tight">{activeEvent?.name || 'Loading...'}</h1>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{routeMatch.code}</p>
            </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button onClick={()=>navigate(`/event/${routeMatch.code}`)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${routeMatch.tab==='overview'?'bg-white text-indigo-600 shadow-sm':'text-slate-400'}`}>OVERVIEW</button>
            <button onClick={()=>navigate(`/event/${routeMatch.code}/settlement`)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${routeMatch.tab==='settlement'?'bg-white text-indigo-600 shadow-sm':'text-slate-400'}`}>SETTLEMENT</button>
          </nav>
        </div>
      </header>

      {loading && !activeEvent ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hydrating from Cloud...</p>
        </div>
      ) : activeEvent && (
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6 animate-in">
          <div className="bg-white px-6 py-5 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex gap-10 text-center sm:text-left">
              <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Spent</span><p className="text-2xl font-black">₹{totalSpent.toFixed(0)}</p></div>
              <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Squad</span><p className="text-2xl font-black">{activeEvent.participants.length}</p></div>
            </div>
            <button onClick={()=>setShowShareModal(true)} className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all">Share with Squad</button>
          </div>

          {routeMatch.tab === 'overview' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-3 order-1">
                <ParticipantManager 
                  participants={activeEvent.participants} 
                  onAdd={(n, u) => db.addParticipant(activeEvent.id, { name: n, upiId: u, avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${n}&backgroundColor=4f46e5&textColor=ffffff` })} 
                  onRemove={(id) => db.deleteParticipant(id)} 
                />
              </div>
              <div className="lg:col-span-5 order-3 lg:order-2 space-y-6">
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm min-h-[400px]">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Activity Feed</h3>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-hide">
                    {activeEvent.expenses.length === 0 ? <div className="text-center py-20 text-slate-200 font-black text-[10px] uppercase">No activity yet</div> : activeEvent.expenses.sort((a,b)=>b.date-a.date).map(e => (
                      <div key={e.id} onClick={() => setSelectedExpense(e)} className={`p-4 rounded-2xl border transition-all cursor-pointer ${e.category==='Payment'?'bg-green-50/50 border-green-100 italic':'bg-white border-slate-50 hover:border-indigo-100'}`}>
                        <div className="flex justify-between items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-slate-800 text-sm truncate">{e.description}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{activeEvent.participants.find(p=>p.id===e.payerId)?.name || 'Member'} paid</p>
                          </div>
                          <p className="font-black text-slate-900 text-sm">₹{Number(e.amount).toFixed(0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 order-2 lg:order-3">
                <ExpenseForm 
                  participants={activeEvent.participants} 
                  onAdd={(exp) => db.addExpense(activeEvent.id, exp)} 
                />
              </div>
            </div>
          ) : (
            <SettlementView 
              participants={activeEvent.participants} 
              balances={balances} 
              settlements={settlements} 
              totalSpent={totalSpent} 
              onSettle={(f, t, a) => db.addExpense(activeEvent.id, { description: `Settlement Record`, amount: a, payerId: f, participantIds: [t], category: 'Payment', date: Date.now() })}
            />
          )}
        </main>
      )}

      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto shadow-lg"><i className="fa-solid fa-users-viewfinder"></i></div>
            <h3 className="text-xl font-black">Share Event</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Anyone with this link can view and add transactions in real-time.</p>
            <button onClick={handleCopyLink} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${shareStatus==='copied' ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-900'}`}>
              {shareStatus==='copied' ? <><i className="fa-solid fa-check mr-2"></i>Link Copied</> : <><i className="fa-solid fa-copy mr-2"></i>Copy Event Link</>}
            </button>
            <button onClick={() => setShowShareModal(false)} className="w-full py-2 text-[10px] font-black text-slate-300 uppercase">Close</button>
          </div>
        </div>
      )}

      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-8 space-y-6 shadow-2xl animate-in">
            <div className="flex justify-between items-center"><h3 className="text-lg font-black">Expense Detail</h3><button onClick={()=>setSelectedExpense(null)} className="p-2"><i className="fa-solid fa-xmark"></i></button></div>
            <div className="space-y-4 pt-4 border-t border-slate-50">
              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-300 uppercase">Label</span><span className="font-bold text-sm truncate max-w-[150px]">{selectedExpense.description}</span></div>
              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-300 uppercase">Amount</span><span className="font-black text-indigo-600 text-xl">₹{Number(selectedExpense.amount).toFixed(0)}</span></div>
            </div>
            <button onClick={() => db.deleteExpense(selectedExpense.id).then(() => setSelectedExpense(null))} className="w-full py-4 bg-red-50 text-red-500 font-black text-[11px] uppercase rounded-2xl border border-red-100 transition-all hover:bg-red-100">
              <i className="fa-solid fa-trash-can mr-2"></i>Delete Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
