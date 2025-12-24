
import React, { useState, useMemo, useEffect } from 'react';
import LZString from 'lz-string';
import { Participant, Expense, Settlement, Balance, SplitEvent } from './types.ts';
import ParticipantManager from './components/ParticipantManager.tsx';
import ExpenseForm from './components/ExpenseForm.tsx';
import SettlementView from './components/SettlementView.tsx';
import { calculateBalances, calculateSettlements } from './utils/calculation.ts';

const generateShortId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const serializeEvent = (event: SplitEvent): string => {
  return LZString.compressToEncodedURIComponent(JSON.stringify(event));
};

const deserializeEvent = (data: string): SplitEvent | null => {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(data);
    return decompressed ? JSON.parse(decompressed) : null;
  } catch (e) {
    return null;
  }
};

const App: React.FC = () => {
  const [events, setEvents] = useState<Record<string, SplitEvent>>({});
  const [path, setPath] = useState(window.location.pathname);
  const [isInitialized, setIsInitialized] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [shareStatus, setShareStatus] = useState<'idle' | 'shortening' | 'copied'>('idle');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      const tripData = params.get('trip');

      if (tripData) {
        const sharedEvent = deserializeEvent(tripData);
        if (sharedEvent) {
          setEvents(prev => ({ ...prev, [sharedEvent.id]: sharedEvent }));
          window.history.replaceState(null, "", `/event/${sharedEvent.id}`);
          setPath(`/event/${sharedEvent.id}`);
          return;
        }
      }
      setPath(window.location.pathname);
    };

    if (!isInitialized) {
      const saved = localStorage.getItem('splitit_storage');
      if (saved) {
        try {
          setEvents(JSON.parse(saved));
        } catch(e) {
          console.error("Storage corrupted, resetting.");
        }
      }
      setIsInitialized(true);
      handleLocationChange();
    }

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [isInitialized]);

  useEffect(() => {
    if (isInitialized) localStorage.setItem('splitit_storage', JSON.stringify(events));
  }, [events, isInitialized]);

  const navigate = (to: string) => {
    window.history.pushState(null, "", to);
    setPath(to);
    window.scrollTo(0, 0);
  };

  const routeMatch = useMemo(() => {
    if (path === '/') return { type: 'home' };
    if (path === '/create') return { type: 'create' };
    const eventMatch = path.match(/^\/event\/([a-z0-9]{6})(\/settlement|\/expenses)?$/);
    if (eventMatch) {
      const sub = eventMatch[2];
      // Note: sub === '/expenses' now also points to overview because expense tab is removed
      return { 
        type: 'event', 
        id: eventMatch[1], 
        tab: sub === '/settlement' ? 'settlement' : 'overview' 
      };
    }
    return { type: 'home' };
  }, [path]);

  const activeEvent = routeMatch.type === 'event' ? events[routeMatch.id] : null;

  const { balances, settlements, totalSpent } = useMemo(() => {
    if (!activeEvent) return { balances: [], settlements: [], totalSpent: 0 };
    const safeBals = calculateBalances(activeEvent.participants, activeEvent.expenses).map(b => ({...b}));
    const setts = calculateSettlements(safeBals);
    const total = activeEvent.expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0);
    return { 
      balances: calculateBalances(activeEvent.participants, activeEvent.expenses), 
      settlements: setts, 
      totalSpent: total 
    };
  }, [activeEvent]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    const id = generateShortId();
    const newEv: SplitEvent = { id, name: newEventName.trim(), participants: [], expenses: [], createdAt: Date.now() };
    setEvents(prev => ({ ...prev, [id]: newEv }));
    setNewEventName('');
    navigate(`/event/${id}`);
  };

  const getShareUrl = async () => {
    if (!activeEvent) return "";
    const longUrl = `${window.location.origin}/event/${activeEvent.id}?trip=${serializeEvent(activeEvent)}`;
    try {
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
      return res.ok ? await res.text() : longUrl;
    } catch {
      return longUrl;
    }
  };

  const handleCopyLink = async () => {
    setShareStatus('shortening');
    const url = await getShareUrl();
    await navigator.clipboard.writeText(url);
    setShareStatus('copied');
    setTimeout(() => setShareStatus('idle'), 2000);
  };

  const handleShareWhatsApp = async () => {
    const url = await getShareUrl();
    const text = `Join my squad on SplitIt for "${activeEvent?.name}": ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareSMS = async () => {
    const url = await getShareUrl();
    const text = `Join my squad on SplitIt for "${activeEvent?.name}": ${url}`;
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank');
  };

  const BrandingFooter = () => (
    <footer className="w-full py-12 px-6 text-center space-y-3 bg-transparent mt-auto border-t border-slate-50">
      <p className="text-sm font-bold text-slate-400">good times in, awkward math out.</p>
      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">
        Try splitit now: <span className="underline decoration-indigo-200 underline-offset-4 cursor-pointer" onClick={() => navigate('/')}>splitits.in</span>
      </p>
    </footer>
  );

  if (!isInitialized) return null;

  if (routeMatch.type === 'home') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
        <header className="p-8 sm:p-12">
          <div className="max-w-6xl mx-auto flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl shadow-indigo-100">
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">SplitIt</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-1">simplified group math</p>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 sm:py-20 flex flex-col items-center text-center space-y-16">
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-5xl sm:text-7xl font-black text-slate-900 tracking-tight leading-[0.9]">Stop doing <span className="text-indigo-600 italic">awkward</span> math.</h2>
            <p className="text-xl text-slate-500 font-medium">The cleanest way to split bills, track group expenses, and settle debts instantly with the squad.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <button onClick={() => navigate('/create')} className="px-10 py-5 bg-indigo-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all">Start an Event</button>
              {Object.keys(events).length > 0 && (
                <button onClick={() => {
                  const recent = (Object.values(events) as SplitEvent[]).sort((a,b)=>b.createdAt-a.createdAt)[0];
                  if (recent) navigate(`/event/${recent.id}`);
                }} className="px-10 py-5 bg-white text-slate-900 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl border border-slate-100 hover:bg-slate-50 transition-all">View Recent</button>
              )}
            </div>
          </div>

          {Object.keys(events).length > 0 && (
            <div className="w-full max-w-xl space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Your Active Squads</h3>
              <div className="grid grid-cols-1 gap-4">
                {(Object.values(events) as SplitEvent[]).sort((a,b)=>b.createdAt-a.createdAt).slice(0, 3).map(ev => (
                  <div key={ev.id} onClick={()=>navigate(`/event/${ev.id}`)} className="bg-white p-6 rounded-3xl border border-slate-100 hover:shadow-xl transition-all cursor-pointer flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">{ev.name.charAt(0)}</div>
                      <div className="text-left">
                        <h4 className="font-black text-slate-800">{ev.name}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{ev.participants.length} members • {ev.id}</p>
                      </div>
                    </div>
                    <i className="fa-solid fa-chevron-right text-slate-200 group-hover:text-indigo-600 transition-colors"></i>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
        <BrandingFooter />
      </div>
    );
  }

  if (routeMatch.type === 'create') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
        <header className="p-8 sm:p-12">
          <div className="max-w-6xl mx-auto flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl shadow-indigo-100">
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">SplitIt</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-1">simplified group math</p>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-xl mx-auto w-full px-6 py-10 space-y-12">
          <section className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-2xl shadow-indigo-100/30 border border-slate-50 text-center space-y-8">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">New Squad Event</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input 
                type="text" 
                autoFocus
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                placeholder="e.g. Goa Trip 2025"
                className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white text-lg font-bold transition-all outline-none shadow-inner"
              />
              <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Create Event</button>
            </form>
          </section>
        </main>
        <BrandingFooter />
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-2xl font-black">Event Not Found</h2>
        <button onClick={() => navigate('/')} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold">Back to Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 h-20 shadow-sm">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={()=>navigate('/')} className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400"><i className="fa-solid fa-arrow-left"></i></button>
            <div className="min-w-0">
              <h1 className="text-lg font-black truncate uppercase tracking-tight">{activeEvent.name}</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{activeEvent.id}</p>
            </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={()=>navigate(`/event/${activeEvent.id}`)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${routeMatch.tab==='overview'?'bg-white text-indigo-600 shadow-sm':'text-slate-400'}`}>OVERVIEW</button>
            <button onClick={()=>navigate(`/event/${activeEvent.id}/settlement`)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${routeMatch.tab==='settlement'?'bg-white text-indigo-600 shadow-sm':'text-slate-400'}`}>SETTLEMENT</button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 space-y-8 animate-in fade-in duration-500">
        <div className="bg-white px-8 py-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/50 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex gap-12 text-center sm:text-left">
            <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Spent</span><p className="text-3xl font-black">₹{totalSpent.toFixed(0)}</p></div>
            <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Squad</span><p className="text-3xl font-black">{activeEvent.participants.length}</p></div>
          </div>
          <button onClick={()=>setShowShareModal(true)} className="w-full sm:w-auto bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">Share with Squad</button>
        </div>

        {routeMatch.tab === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-3 order-1"><ParticipantManager participants={activeEvent.participants} onAdd={(n, u)=>setEvents(prev => ({ ...prev, [activeEvent.id]: { ...activeEvent, participants: [...activeEvent.participants, { id: crypto.randomUUID(), name: n, upiId: u, avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${n}&backgroundColor=4f46e5&textColor=ffffff` }] }}))} onRemove={(id)=>setEvents(prev => ({ ...prev, [activeEvent.id]: { ...activeEvent, participants: activeEvent.participants.filter(p=>p.id!==id) }}))} /></div>
            <div className="lg:col-span-5 order-3 lg:order-2 space-y-6">
              <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm overflow-hidden min-h-[400px]">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Activity Feed</h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-hide">
                  {activeEvent.expenses.length === 0 ? <div className="text-center py-20 text-slate-200 font-black text-[10px] uppercase tracking-widest">No activity yet</div> : activeEvent.expenses.sort((a,b)=>b.date-a.date).map(e => (
                    <div key={e.id} onClick={() => setSelectedExpense(e)} className={`p-5 rounded-3xl border transition-all cursor-pointer ${e.category==='Payment'?'bg-green-50/50 border-green-100 italic':'bg-white border-slate-50 hover:border-indigo-100'}`}>
                      <div className="flex justify-between items-center">
                        <div className="min-w-0">
                          <p className="font-black text-slate-800 truncate">{e.description}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{activeEvent.participants.find(p=>p.id===e.payerId)?.name} paid</p>
                        </div>
                        <p className="font-black text-slate-900 ml-4">₹{e.amount.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-4 order-2 lg:order-3"><ExpenseForm participants={activeEvent.participants} onAdd={(exp)=>setEvents(prev => ({ ...prev, [activeEvent.id]: { ...activeEvent, expenses: [{...exp, id: crypto.randomUUID()}, ...activeEvent.expenses] }}))} /></div>
          </div>
        ) : (
          <SettlementView 
            participants={activeEvent.participants} 
            balances={balances} 
            settlements={settlements} 
            totalSpent={totalSpent} 
            onSettle={(f, t, a) => setEvents(prev => ({ ...prev, [activeEvent.id]: { ...activeEvent, expenses: [{ id: crypto.randomUUID(), description: `Settlement: ${activeEvent.participants.find(p=>p.id===f)?.name} paid ${activeEvent.participants.find(p=>p.id===t)?.name}`, amount: a, payerId: f, participantIds: [t], category: 'Payment', date: Date.now() }, ...activeEvent.expenses] }}))}
          />
        )}
      </main>
      <BrandingFooter />

      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-10 border-b border-slate-100 flex flex-col items-center bg-slate-50/50 text-center">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl mb-4 shadow-xl shadow-indigo-100"><i className="fa-solid fa-link"></i></div>
              <h3 className="text-xl font-black text-slate-900">Share with Squad</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Spread the word via your favorite app</p>
            </div>
            <div className="p-8 space-y-3">
              <button 
                onClick={handleShareWhatsApp}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 bg-green-500 text-white hover:bg-green-600"
              >
                <i className="fa-brands fa-whatsapp text-lg"></i> WhatsApp
              </button>
              <button 
                onClick={handleShareSMS}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 bg-indigo-500 text-white hover:bg-indigo-600"
              >
                <i className="fa-solid fa-comment-sms text-lg"></i> Text Message
              </button>
              <button 
                onClick={handleCopyLink}
                disabled={shareStatus === 'shortening'}
                className={`w-full flex items-center justify-center gap-3 py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 border-2 border-indigo-600 ${shareStatus==='copied' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-50'}`}
              >
                {shareStatus === 'shortening' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className={`fa-solid ${shareStatus==='copied'?'fa-check':'fa-copy'}`}></i>}
                {shareStatus === 'shortening' ? 'Generating...' : shareStatus === 'copied' ? 'Link Copied!' : 'Copy Link'}
              </button>
              <button onClick={() => setShowShareModal(false)} className="w-full py-2 mt-4 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 transition-colors">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Detail</h3>
              <button onClick={()=>setSelectedExpense(null)} className="text-slate-400 hover:text-slate-800"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="space-y-4 pt-4 border-t border-slate-50">
              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Label</span><span className="font-bold text-slate-800">{selectedExpense.description}</span></div>
              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Amount</span><span className="font-black text-indigo-600 text-2xl">₹{selectedExpense.amount.toFixed(2)}</span></div>
            </div>
            <button onClick={()=>{
              setEvents(prev => ({ ...prev, [activeEvent.id]: { ...activeEvent, expenses: activeEvent.expenses.filter(e => e.id !== selectedExpense.id) }}));
              setSelectedExpense(null);
            }} className="w-full py-5 bg-red-50 text-red-500 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-100 transition-all border border-red-100">
              <i className="fa-solid fa-trash-can mr-2"></i>Delete Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
