
import React, { useState, useMemo, useEffect } from 'react';
import LZString from 'lz-string';
import { Participant, Expense, Settlement, Balance, SplitEvent } from './types.ts';
import ParticipantManager from './components/ParticipantManager.tsx';
import ExpenseForm from './components/ExpenseForm.tsx';
import SettlementView from './components/SettlementView.tsx';
import { calculateBalances, calculateSettlements } from './utils/calculation.ts';

// Helper to generate a 6-character random ID
const generateShortId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const serializeEvent = (event: SplitEvent): string => {
  const json = JSON.stringify(event);
  return LZString.compressToEncodedURIComponent(json);
};

const deserializeEvent = (data: string): SplitEvent | null => {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(data);
    if (!decompressed) return null;
    return JSON.parse(decompressed);
  } catch (e) {
    console.error("Failed to deserialize event data", e);
    return null;
  }
};

const App: React.FC = () => {
  const [events, setEvents] = useState<Record<string, SplitEvent>>({});
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'settlement'>('overview');
  const [newEventName, setNewEventName] = useState('');
  
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'shortening' | 'copied' | 'error'>('idle');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync state with URL Hash for Routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const tripData = params.get('trip');

      // Hydration from URL param
      if (tripData) {
        const sharedEvent = deserializeEvent(tripData);
        if (sharedEvent) {
          setEvents(prev => ({ ...prev, [sharedEvent.id]: sharedEvent }));
          // Redirect to the event route without the huge query param
          window.location.hash = `#/event/${sharedEvent.id}/overview`;
          window.history.replaceState(null, "", window.location.pathname + window.location.hash);
          return;
        }
      }

      if (hash.startsWith('#/event/')) {
        const parts = hash.split('/');
        const id = parts[2];
        const tab = parts[3] === 'settlement' ? 'settlement' : 'overview';
        setCurrentEventId(id);
        setActiveTab(tab as any);
      } else {
        setCurrentEventId(null);
      }
    };

    if (!isInitialized) {
      const savedEvents = localStorage.getItem('splitit_multi_events');
      if (savedEvents) setEvents(JSON.parse(savedEvents));
      setIsInitialized(true);
      // Wait a tick for state to settle before initial route handling
      setTimeout(handleHashChange, 0);
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isInitialized]);

  // Save to LocalStorage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('splitit_multi_events', JSON.stringify(events));
    }
  }, [events, isInitialized]);

  const activeEvent = currentEventId ? events[currentEventId] : null;

  const { balances, settlements, totalSpent } = useMemo(() => {
    if (!activeEvent) return { balances: [], settlements: [], totalSpent: 0 };
    const bals = calculateBalances(activeEvent.participants, activeEvent.expenses);
    const setts = calculateSettlements([...bals]);
    const total = activeEvent.expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0);
    return { balances: bals, settlements: setts, totalSpent: total };
  }, [activeEvent]);

  const navigateTo = (path: string) => {
    window.location.hash = path;
  };

  const createEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    const id = generateShortId();
    const newEv: SplitEvent = {
      id,
      name: newEventName.trim(),
      participants: [],
      expenses: [],
      createdAt: Date.now()
    };
    setEvents(prev => ({ ...prev, [id]: newEv }));
    setNewEventName('');
    navigateTo(`#/event/${id}/overview`);
  };

  const deleteEvent = (id: string) => {
    if (window.confirm("Permanently delete this group?")) {
      const newEvents = { ...events };
      delete newEvents[id];
      setEvents(newEvents);
      if (currentEventId === id) navigateTo('#/');
    }
  };

  const updateActiveEvent = (updates: Partial<SplitEvent>) => {
    if (!currentEventId) return;
    setEvents(prev => ({
      ...prev,
      [currentEventId]: { ...prev[currentEventId], ...updates }
    }));
  };

  const addParticipant = (name: string, upiId?: string) => {
    if (!activeEvent) return;
    updateActiveEvent({
      participants: [...activeEvent.participants, { id: crypto.randomUUID(), name, avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=4f46e5&textColor=ffffff`, upiId }]
    });
  };

  const removeParticipant = (id: string) => {
    if (!activeEvent) return;
    updateActiveEvent({
      participants: activeEvent.participants.filter(p => p.id !== id),
      expenses: activeEvent.expenses.filter(e => e.payerId !== id && !e.participantIds.includes(id))
    });
  };

  const addExpense = (newExp: Omit<Expense, 'id'>) => {
    if (!activeEvent) return;
    updateActiveEvent({
      expenses: [{ ...newExp, id: crypto.randomUUID() }, ...activeEvent.expenses]
    });
  };

  const removeExpense = (id: string) => {
    if (!activeEvent) return;
    updateActiveEvent({
      expenses: activeEvent.expenses.filter(e => e.id !== id)
    });
    if (selectedExpense?.id === id) setSelectedExpense(null);
  };

  const handleSettle = (fromId: string, toId: string, amount: number) => {
    if (!activeEvent) return;
    const fromP = activeEvent.participants.find(p => p.id === fromId)?.name;
    const toP = activeEvent.participants.find(p => p.id === toId)?.name;
    addExpense({
      description: `Settlement: ${fromP} paid ${toP}`,
      amount: amount, payerId: fromId, participantIds: [toId], category: 'Payment', date: Date.now()
    });
  };

  const getLongShareUrl = () => {
    if (!activeEvent) return '';
    const serialized = serializeEvent(activeEvent);
    return `${window.location.origin}${window.location.pathname}?trip=${serialized}`;
  };

  const handleShortenLink = async () => {
    const longUrl = getLongShareUrl();
    setShareStatus('shortening');
    try {
      // Using TinyURL simple proxy-free API
      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
      if (response.ok) {
        const text = await response.text();
        setShortUrl(text);
        navigator.clipboard.writeText(text);
        setShareStatus('copied');
      } else {
        throw new Error("Shortening failed");
      }
    } catch (e) {
      // Fallback to copying long URL if shortening fails (often due to CORS)
      navigator.clipboard.writeText(longUrl);
      setShortUrl(longUrl);
      setShareStatus('copied');
    }
    setTimeout(() => setShareStatus('idle'), 2000);
  };

  const handleShareWhatsApp = () => {
    const longUrl = getLongShareUrl();
    const settlementText = settlements.length === 0 
      ? "All clear! No pending payments. ✅" 
      : settlements.map(s => {
          const fromName = activeEvent?.participants.find(p => p.id === s.from)?.name;
          const toName = activeEvent?.participants.find(p => p.id === s.to)?.name;
          return `💸 *${fromName}* owes *${toName}*: ₹${s.amount.toFixed(2)}`;
        }).join('\n');
    
    const text = `💰 *SplitIt: ${activeEvent?.name}*\n\n*Settlements:*\n${settlementText}\n\n🔗 View Trip:\n${longUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-[#4f46e5] rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading SplitIt...</p>
      </div>
    );
  }

  // Dashboard View (Home Page)
  if (!currentEventId) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
        <header className="bg-white border-b border-slate-100 p-6 sm:p-8 flex items-start justify-start">
          <div className="flex items-center gap-3 sm:gap-4">
             <div className="w-12 h-12 bg-[#4f46e5] rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg shadow-indigo-100">
               <i className="fa-solid fa-receipt"></i>
             </div>
             <div className="flex flex-col items-start text-left">
               <h1 className="text-3xl font-black text-slate-900 tracking-tighter">SplitIt</h1>
               <p className="text-xs font-medium text-slate-400 lowercase -mt-1 tracking-tight">good times in, awkward math out.</p>
             </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 sm:py-20 space-y-12">
          <section className="bg-white rounded-[2.5rem] p-8 sm:p-16 shadow-2xl shadow-indigo-100/40 border border-slate-50 text-center space-y-10">
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">Start an Event</h2>
            <form onSubmit={createEvent} className="max-w-md mx-auto flex flex-col gap-4">
              <input 
                type="text" 
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                placeholder="Event Name (e.g. Goa Trip)"
                className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-[#4f46e5] focus:bg-white text-lg font-bold transition-all outline-none shadow-inner"
              />
              <button type="submit" className="bg-[#4f46e5] text-white py-5 rounded-3xl font-black text-sm hover:bg-[#4338ca] transition-all shadow-xl active:scale-95 uppercase tracking-widest">Create an Event</button>
            </form>
          </section>

          {Object.keys(events).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(Object.values(events) as SplitEvent[]).sort((a,b)=>b.createdAt-a.createdAt).map(ev => (
                <div key={ev.id} onClick={()=>navigateTo(`#/event/${ev.id}/overview`)} className="bg-white p-6 rounded-[2rem] border border-slate-100 hover:shadow-xl transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">{ev.name.charAt(0)}</div>
                    <div className="flex gap-2">
                       <button onClick={(e)=>{e.stopPropagation(); deleteEvent(ev.id)}} className="text-slate-200 hover:text-red-500 transition-colors p-2"><i className="fa-solid fa-trash-can"></i></button>
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 line-clamp-1">{ev.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{ev.participants.length} Members • ₹{ev.expenses.reduce((acc,curr)=>curr.category!=='Payment'?acc+curr.amount:acc,0).toFixed(0)}</p>
                </div>
              ))}
            </div>
          )}
        </main>
        <footer className="p-10 text-center space-y-2 border-t border-slate-100">
           <p className="text-sm font-bold text-slate-400">good times in, awkward math out.</p>
           <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Try splitit now: <span className="underline">splitits.in</span></p>
        </footer>
      </div>
    );
  }

  // Active Event View
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm px-4">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={()=>navigateTo('#/')} className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400"><i className="fa-solid fa-arrow-left"></i></button>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-900 truncate uppercase tracking-tight">{activeEvent.name}</h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase -mt-0.5">SplitIt Safe</p>
            </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={()=>navigateTo(`#/event/${currentEventId}/overview`)} 
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab==='overview'?'bg-white text-indigo-600 shadow-sm':'text-slate-400'}`}
            >
              Overview
            </button>
            <button 
              onClick={()=>navigateTo(`#/event/${currentEventId}/settlement`)} 
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab==='settlement'?'bg-white text-indigo-600 shadow-sm':'text-slate-400'}`}
            >
              Settlement
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col items-stretch justify-between bg-white px-8 py-6 rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-100/50 gap-6 sm:flex-row sm:items-center">
          <div className="flex justify-around sm:justify-start gap-12 text-center sm:text-left">
            <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Spent</span><p className="text-3xl font-black">₹{totalSpent.toFixed(0)}</p></div>
            <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Squad</span><p className="text-3xl font-black">{activeEvent.participants.length}</p></div>
          </div>
          <button 
            onClick={() => setShowShareModal(true)} 
            className="bg-[#4f46e5] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#4338ca] shadow-lg active:scale-95 transition-all"
          >
            Share Trip
          </button>
        </div>

        {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-3 order-1 lg:order-1">
              <ParticipantManager participants={activeEvent.participants} onAdd={addParticipant} onRemove={removeParticipant} />
            </div>
            <div className="lg:col-span-5 space-y-6 order-3 lg:order-2">
              <div className="bg-white border border-slate-100 rounded-[2rem] p-4 min-h-[400px] shadow-sm overflow-hidden">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 p-4 border-b border-slate-50 mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left"></i>History
                </h2>
                <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-hide">
                  {activeEvent.expenses.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 font-bold uppercase text-[10px]">No records found</div>
                  ) : (
                    activeEvent.expenses.sort((a,b)=>b.date-a.date).map(e => (
                      <div key={e.id} onClick={()=>setSelectedExpense(e)} className={`p-4 mx-2 rounded-2xl border transition-all cursor-pointer ${e.category==='Payment'?'bg-green-50/50 border-green-100 italic':'bg-white border-slate-50 hover:border-indigo-100 hover:bg-slate-50'}`}>
                        <div className="flex justify-between items-center">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{e.description}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{activeEvent.participants.find(p=>p.id===e.payerId)?.name} paid</p>
                          </div>
                          <p className="font-black text-slate-900">₹{e.amount.toFixed(0)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="lg:col-span-4 order-2 lg:order-3">
              <ExpenseForm participants={activeEvent.participants} onAdd={addExpense} />
            </div>
          </div>
        ) : (
          <SettlementView participants={activeEvent.participants} balances={balances} settlements={settlements} totalSpent={totalSpent} onSettle={handleSettle} />
        )}
      </main>

      <footer className="p-10 text-center space-y-2">
         <p className="text-sm font-bold text-slate-400">good times in, awkward math out.</p>
         <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Try splitit now: <span className="underline">splitits.in</span></p>
      </footer>

      {/* Sharing Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800">Share Trip</h3>
              <button onClick={()=>setShowShareModal(false)} className="text-slate-400 hover:text-slate-800"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <button 
                  onClick={handleShortenLink}
                  disabled={shareStatus === 'shortening'}
                  className={`w-full flex items-center justify-center gap-3 py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 ${shareStatus==='copied' ? 'bg-green-500 text-white' : 'bg-[#4f46e5] text-white hover:bg-[#4338ca]'}`}
                >
                  {shareStatus === 'shortening' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className={`fa-solid ${shareStatus==='copied'?'fa-check':'fa-link'}`}></i>}
                  {shareStatus === 'shortening' ? 'Shortening...' : shareStatus === 'copied' ? 'Link Copied!' : 'Copy Shareable Link'}
                </button>
                
                <button onClick={handleShareWhatsApp} className="w-full flex items-center justify-center gap-3 py-5 bg-green-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-green-600 shadow-xl transition-all">
                  <i className="fa-brands fa-whatsapp text-xl"></i>
                  Share via WhatsApp
                </button>
                
                <p className="text-[9px] text-slate-400 font-bold text-center uppercase tracking-wider px-4">
                  This link captures the entire trip state. Anyone with it can add expenses.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Record Detail</h3>
              <button onClick={()=>setSelectedExpense(null)} className="text-slate-400 hover:text-slate-800"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="space-y-4 pt-4 border-t border-slate-50">
              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Label</span><span className="font-bold text-slate-800">{selectedExpense.description}</span></div>
              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Amount</span><span className="font-black text-indigo-600 text-2xl">₹{selectedExpense.amount.toFixed(2)}</span></div>
            </div>
            <button onClick={()=>{removeExpense(selectedExpense.id); setSelectedExpense(null);}} className="w-full py-5 bg-red-50 text-red-500 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-100 transition-all border border-red-100"><i className="fa-solid fa-trash-can mr-2"></i>Delete Record</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
