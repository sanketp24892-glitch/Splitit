
import React, { useState, useMemo, useEffect } from 'react';
import LZString from 'lz-string';
import { Participant, Expense, Settlement, Balance, SplitEvent } from './types.ts';
import ParticipantManager from './components/ParticipantManager.tsx';
import ExpenseForm from './components/ExpenseForm.tsx';
import SettlementView from './components/SettlementView.tsx';
import { calculateBalances, calculateSettlements } from './utils/calculation.ts';

// Helper to generate a 6-character random ID for unique event strings
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
  const [newEventName, setNewEventName] = useState('');
  
  // App states
  const [activeTab, setActiveTab] = useState<'overview' | 'settlement'>('overview');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEventId, setShareEventId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const getAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=4f46e5&textColor=ffffff`;

  // Hydration Logic: Check for shared trip data in URL query params
  useEffect(() => {
    const loadInitialData = () => {
      const savedEvents = localStorage.getItem('splitit_multi_events');
      let currentEvents: Record<string, SplitEvent> = savedEvents ? JSON.parse(savedEvents) : {};

      const urlParams = new URLSearchParams(window.location.search);
      const tripData = urlParams.get('trip');
      
      if (tripData) {
        const sharedEvent = deserializeEvent(tripData);
        if (sharedEvent) {
          // Add shared event to local events list
          currentEvents[sharedEvent.id] = sharedEvent;
          setCurrentEventId(sharedEvent.id);
          // Clean up URL to keep it pretty after hydration
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState(null, "", newUrl);
        }
      }
      
      setEvents(currentEvents);
      setIsInitialized(true);
    };

    loadInitialData();
  }, []);

  // Save local changes to localStorage
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
    setCurrentEventId(id);
  };

  const deleteEvent = (id: string) => {
    if (window.confirm("Permanently delete this group?")) {
      const newEvents = { ...events };
      delete newEvents[id];
      setEvents(newEvents);
      if (currentEventId === id) setCurrentEventId(null);
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
      participants: [...activeEvent.participants, { id: crypto.randomUUID(), name, avatar: getAvatar(name), upiId }]
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

  const currentShareUrl = useMemo(() => {
    if (!shareEventId || !events[shareEventId]) return '';
    const serialized = serializeEvent(events[shareEventId]);
    return `${window.location.origin}${window.location.pathname}?trip=${serialized}`;
  }, [shareEventId, events]);

  const getWhatsAppText = () => {
    if (!activeEvent) return '';
    const settlementText = settlements.length === 0 
      ? "All clear! No pending payments. ✅" 
      : settlements.map(s => {
          const fromName = activeEvent.participants.find(p => p.id === s.from)?.name;
          const toName = activeEvent.participants.find(p => p.id === s.to)?.name;
          return `💸 *${fromName}* owes *${toName}*: ₹${s.amount.toFixed(2)}`;
        }).join('\n');
    
    return `💰 *SplitIt: ${activeEvent.name}*\n\n*Current Settlements:*\n${settlementText}\n\n🔗 Open trip and settle:\n${currentShareUrl}\n\nNo more awkward math!`;
  };

  const handleShareWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(getWhatsAppText())}`, '_blank');
  };

  const handleShareGmail = () => {
    const subject = `Expense Split for ${activeEvent?.name}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(getWhatsAppText())}`, '_blank');
  };

  const handleCopyLink = () => {
    if (!currentShareUrl) return;
    navigator.clipboard.writeText(currentShareUrl).then(() => {
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    });
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-[#4f46e5] rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading SplitIt...</p>
      </div>
    );
  }

  // Dashboard View
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
                <div key={ev.id} onClick={()=>setCurrentEventId(ev.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 hover:shadow-xl transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">{ev.name.charAt(0)}</div>
                    <div className="flex gap-2">
                       <button onClick={(e)=>{e.stopPropagation(); setShareEventId(ev.id); setShowShareModal(true);}} className="text-slate-300 hover:text-indigo-600 transition-colors p-2"><i className="fa-solid fa-share-nodes"></i></button>
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
      </div>
    );
  }

  // Active Event View
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm px-4">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={()=>setCurrentEventId(null)} className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400"><i className="fa-solid fa-arrow-left"></i></button>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-900 truncate uppercase tracking-tight">{activeEvent.name}</h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase -mt-0.5">SplitIt Safe</p>
            </div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={()=>setActiveTab('overview')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab==='overview'?'bg-white text-indigo-600 shadow-sm':'text-slate-400'}`}>Overview</button>
            <button onClick={()=>setActiveTab('settlement')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab==='settlement'?'bg-white text-indigo-600 shadow-sm':'text-slate-400'}`}>Settlement</button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col items-stretch justify-between bg-white px-8 py-6 rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-100/50 gap-6 sm:flex-row sm:items-center">
          <div className="flex justify-around sm:justify-start gap-12 text-center sm:text-left">
            <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Spent</span><p className="text-3xl font-black">₹{totalSpent.toFixed(0)}</p></div>
            <div><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Squad</span><p className="text-3xl font-black">{activeEvent.participants.length}</p></div>
          </div>
          <button onClick={(e)=>{e.stopPropagation(); setShareEventId(activeEvent.id); setShowShareModal(true);}} className="bg-[#4f46e5] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#4338ca] shadow-lg active:scale-95 transition-all">Share with Squad</button>
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
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center relative group">
                  <p className="text-[10px] font-bold text-indigo-600 truncate pr-8">{currentShareUrl}</p>
                  <button onClick={handleCopyLink} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                    <i className={`fa-solid ${shareStatus==='copied'?'fa-check text-green-500':'fa-copy'}`}></i>
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleShareWhatsApp} className="flex flex-col items-center gap-2 p-5 bg-green-50 rounded-3xl hover:bg-green-100 transition-all">
                    <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-green-100"><i className="fa-brands fa-whatsapp"></i></div>
                    <span className="text-[10px] font-black uppercase text-green-700">WhatsApp</span>
                  </button>
                  <button onClick={handleShareGmail} className="flex flex-col items-center gap-2 p-5 bg-red-50 rounded-3xl hover:bg-red-100 transition-all">
                    <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-red-100"><i className="fa-solid fa-envelope"></i></div>
                    <span className="text-[10px] font-black uppercase text-red-700">Gmail</span>
                  </button>
                  <button onClick={handleCopyLink} className={`flex flex-col items-center gap-2 p-5 rounded-3xl transition-all col-span-2 ${shareStatus==='copied'?'bg-green-100':'bg-indigo-600 text-white'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg ${shareStatus==='copied'?'bg-green-600':'bg-indigo-800'}`}>
                      <i className={`fa-solid ${shareStatus==='copied'?'fa-check':'fa-link'}`}></i>
                    </div>
                    <span className={`text-[10px] font-black uppercase mt-1 ${shareStatus==='copied'?'text-green-700':'text-indigo-50'}`}>
                      {shareStatus==='copied'?'Copied to Clipboard':'Copy Shareable Link'}
                    </span>
                  </button>
                </div>

                <div className="pt-4 text-center">
                  <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
                    This link contains all the trip data. <br/> Anyone with this link can view and add expenses.
                  </p>
                </div>
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
              <div className="flex justify-between">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Label</span>
                <span className="font-bold text-slate-800">{selectedExpense.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Amount</span>
                <span className="font-black text-indigo-600 text-2xl">₹{selectedExpense.amount.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={()=>{removeExpense(selectedExpense.id); setSelectedExpense(null);}} className="w-full py-5 bg-red-50 text-red-500 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-100 transition-all border border-red-100">
              <i className="fa-solid fa-trash-can mr-2"></i>Delete Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
