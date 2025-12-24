
import React, { useState, useMemo, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Participant, Expense, Settlement, Balance, SplitEvent } from './types.ts';
import ParticipantManager from './components/ParticipantManager.tsx';
import ExpenseForm from './components/ExpenseForm.tsx';
import SettlementView from './components/SettlementView.tsx';
import { calculateBalances, calculateSettlements } from './utils/calculation.ts';

// Helper to generate a 6-character random ID for short URLs
const generateShortId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Initialize Supabase client using environment variables
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://yrlvjtnxusbgqeqgaonu.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_bFgmsQkkShvZYtyLf7ASEA_I1J6Y3zw'
);

const App: React.FC = () => {
  const [events, setEvents] = useState<Record<string, SplitEvent>>({});
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [newEventName, setNewEventName] = useState('');
  
  // App states scoped to sharing and loading
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlement'>('expenses');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'saving' | 'copied' | 'error'>('idle');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEventId, setShareEventId] = useState<string | null>(null);
  const [generatedShortUrl, setGeneratedShortUrl] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingShared, setIsLoadingShared] = useState(false);

  const getAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=4f46e5&textColor=ffffff`;

  // Fetch Logic: On mount, check if URL contains a short trip ID and load it from Supabase
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Load local storage events
      const savedEvents = localStorage.getItem('splitit_multi_events');
      let currentEvents: Record<string, SplitEvent> = savedEvents ? JSON.parse(savedEvents) : {};

      // 2. Check for short ID in hash (e.g., #/trip/abc123)
      const hash = window.location.hash;
      const shortIdMatch = hash.match(/#\/?trip\/([a-z0-9]{6})$/i);
      
      if (shortIdMatch && shortIdMatch[1]) {
        const tripSlug = shortIdMatch[1];
        setIsLoadingShared(true);
        try {
          const { data, error } = await supabase
            .from('trips')
            .select('trip_data')
            .eq('id', tripSlug)
            .single();

          if (error) throw error;
          
          if (data && data.trip_data) {
            const fetchedEvent = data.trip_data as SplitEvent;
            // Use the remote event, ensure it's in our local dictionary
            const localId = fetchedEvent.id || tripSlug;
            currentEvents[localId] = fetchedEvent;
            setCurrentEventId(localId);
            
            // Clean up the URL hash after loading to provide a clean browsing experience
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (err) {
          console.error("Failed to fetch shared trip from Supabase:", err);
        } finally {
          setIsLoadingShared(false);
        }
      }
      
      setEvents(currentEvents);
      setIsInitialized(true);
    };

    loadInitialData();
  }, []);

  // Sync state to local storage for persistence
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('splitit_multi_events', JSON.stringify(events));
    }
  }, [events, isInitialized]);

  // Helper for the currently viewed event
  const activeEvent = currentEventId ? events[currentEventId] : null;

  // Compute balances and settlements whenever active event changes
  const { balances, settlements, totalSpent } = useMemo(() => {
    if (!activeEvent) return { balances: [], settlements: [], totalSpent: 0 };
    
    const bals = calculateBalances(activeEvent.participants, activeEvent.expenses);
    const setts = calculateSettlements([...bals]);
    const total = activeEvent.expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0);

    return { 
      balances: bals, 
      settlements: setts, 
      totalSpent: total
    };
  }, [activeEvent]);

  // Event Handlers
  const createEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    const id = crypto.randomUUID();
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
    if (window.confirm("Delete this group session permanently?")) {
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

  // Save Logic: Save to Supabase and generate short URL
  const handleShareToSupabase = async () => {
    if (!shareEventId || !events[shareEventId]) return;
    
    setShareStatus('saving');
    const targetEvent = events[shareEventId];
    const shortId = generateShortId();
    
    try {
      const { error } = await supabase
        .from('trips')
        .insert([{ 
          id: shortId,
          trip_data: targetEvent,
          name: targetEvent.name 
        }]);

      if (error) throw error;
      
      const shortUrl = `https://splitits.in/#/trip/${shortId}`;
      setGeneratedShortUrl(shortUrl);
      setShareStatus('idle');
    } catch (err) {
      console.error("Supabase Save Error:", err);
      setShareStatus('error');
    }
  };

  const openShareModal = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setShareEventId(id);
    setGeneratedShortUrl(null);
    setShareStatus('idle');
    setShowShareModal(true);
  };

  const handleShareWhatsApp = () => {
    if (!generatedShortUrl || !shareEventId) return;
    const ev = events[shareEventId];
    
    // Construct settlement summary
    const settlementText = settlements.length === 0 
      ? "All clear! No pending payments. ✅" 
      : settlements.map(s => {
          const fromName = ev.participants.find(p => p.id === s.from)?.name;
          const toName = ev.participants.find(p => p.id === s.to)?.name;
          return `💸 *${fromName}* owes *${toName}*: ₹${s.amount.toFixed(2)}`;
        }).join('\n');
    
    // Construct the final message with the requested tagline
    const text = `💰 *SplitIt: ${ev.name}*\n\n*Current Settlements:*\n${settlementText}\n\n🔗 Open trip and settle:\n${generatedShortUrl}\n\nNo more awkward money talks! SplitIt handles it all for you.\nTry it Now: splitits.in`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    if (!generatedShortUrl) return;
    navigator.clipboard.writeText(generatedShortUrl).then(() => {
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    });
  };

  // Loading Screen for Init or DB Fetch
  if (!isInitialized || isLoadingShared) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-[#4f46e5] rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          {isLoadingShared ? 'Fetching shared trip...' : 'Initializing SplitIt...'}
        </p>
      </div>
    );
  }

  // Dashboard View: Shown when no specific event is selected
  if (!currentEventId) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
        <header className="bg-white border-b border-slate-100 p-6 sm:p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#4f46e5] rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-100 transition-transform hover:rotate-6">
               <i className="fa-solid fa-money-bill-transfer"></i>
             </div>
             <h1 className="text-2xl font-black text-slate-800 tracking-tight">SplitIt</h1>
          </div>
          <div className="hidden sm:block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-4 py-1.5 rounded-full">Dashboard</span>
          </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-20 space-y-12 animate-in fade-in duration-700">
          <section className="bg-white rounded-[3rem] p-8 sm:p-16 shadow-2xl shadow-indigo-100/40 border border-slate-50 text-center space-y-10">
            <div className="space-y-4">
              <h2 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight leading-tight">Split expenses, <br/><span className="text-[#4f46e5]">keep the friendship.</span></h2>
              <p className="text-slate-400 font-medium text-lg max-w-lg mx-auto">Toss your paper receipts. splitIt tracks everything so you don't have to.</p>
            </div>
            
            <form onSubmit={createEvent} className="max-w-md mx-auto relative group">
              <input 
                type="text" 
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                placeholder="Name your adventure (e.g. Goa 2024)"
                className="w-full px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-[#4f46e5] focus:bg-white text-lg font-bold transition-all outline-none pr-36 shadow-inner"
              />
              <button 
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-[#4f46e5] text-white px-8 rounded-[1.5rem] font-black text-sm hover:bg-[#4338ca] transition-all shadow-lg active:scale-95"
              >
                CREATE
              </button>
            </form>
          </section>

          {Object.keys(events).length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Recent Groups</h3>
                <span className="text-xs font-bold text-[#4f46e5] bg-[#eef2ff] px-3 py-1 rounded-full">{Object.keys(events).length} Sessions</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Object.values(events) as SplitEvent[]).sort((a, b) => b.createdAt - a.createdAt).map((ev) => {
                  const evTotal = ev.expenses.reduce((acc, curr) => curr.category !== 'Payment' ? acc + curr.amount : acc, 0);
                  return (
                    <div 
                      key={ev.id}
                      onClick={() => setCurrentEventId(ev.id)}
                      className="group bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-[#4f46e5]/20 hover:-translate-y-2 transition-all cursor-pointer flex flex-col justify-between min-h-[240px]"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="w-12 h-12 bg-[#eef2ff] text-[#4f46e5] rounded-2xl flex items-center justify-center text-xl font-black group-hover:bg-[#4f46e5] group-hover:text-white transition-all duration-300">
                            {ev.name.charAt(0)}
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => openShareModal(e, ev.id)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-[#4f46e5] hover:bg-white flex items-center justify-center transition-all border border-transparent hover:border-slate-100"><i className="fa-solid fa-share-nodes text-xs"></i></button>
                            <button onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-white flex items-center justify-center transition-all border border-transparent hover:border-slate-100"><i className="fa-solid fa-trash-can text-xs"></i></button>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-slate-800 line-clamp-1 group-hover:text-[#4f46e5] transition-colors">{ev.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider">{ev.participants.length} Members • {ev.expenses.length} Records</p>
                        </div>
                      </div>
                      <div className="pt-5 border-t border-slate-50 flex items-end justify-between">
                         <div>
                            <span className="block text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Spent</span>
                            <span className="text-2xl font-black text-slate-800">₹{evTotal.toFixed(0)}</span>
                         </div>
                         <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-[#4f46e5] group-hover:border-[#4f46e5] transition-all">
                           <i className="fa-solid fa-chevron-right text-xs"></i>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  // Active Trip Management View
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans overflow-x-hidden">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm px-4">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button 
              onClick={() => setCurrentEventId(null)}
              className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all border border-transparent hover:border-slate-100"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-lg font-black text-[#1e293b] truncate uppercase tracking-tight">{activeEvent.name}</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <p className="text-[9px] font-black text-slate-400 tracking-[0.1em] uppercase">Cloud Sync Active</p>
              </div>
            </div>
          </div>
          <nav className="flex bg-[#f1f5f9] p-1.5 rounded-2xl shrink-0">
            <button onClick={() => setActiveTab('expenses')} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'expenses' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Activity</button>
            <button onClick={() => setActiveTab('settlement')} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'settlement' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Settlement</button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-8 py-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 gap-6">
          <div className="flex gap-12 text-center sm:text-left">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase block mb-1 tracking-widest">Aggregate Spent</span>
              <p className="text-3xl font-black text-slate-800">₹{totalSpent.toFixed(0)}</p>
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase block mb-1 tracking-widest">The Squad</span>
              <p className="text-3xl font-black text-slate-800">{activeEvent.participants.length}</p>
            </div>
          </div>
          <button 
            onClick={(e) => openShareModal(e, activeEvent.id)}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-xl shadow-indigo-200 active:scale-[0.97]"
          >
            <i className="fa-solid fa-cloud-arrow-up"></i>
            Cloud Sync & Share
          </button>
        </div>

        {activeTab === 'expenses' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-3">
              <ParticipantManager participants={activeEvent.participants} onAdd={addParticipant} onRemove={removeParticipant} />
            </div>
            <div className="lg:col-span-5 space-y-6">
              <div className="flex justify-between items-center px-2">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <i className="fa-solid fa-list-check"></i>
                  Recent Transactions
                </h2>
                <span className="text-[10px] font-bold text-[#4f46e5] bg-[#eef2ff] px-3 py-1 rounded-full">{activeEvent.expenses.length} Total</span>
              </div>
              <div className="min-h-[400px] bg-white border border-slate-100 rounded-[2rem] p-4 overflow-y-auto max-h-[650px] scrollbar-hide shadow-sm">
                {activeEvent.expenses.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-300 py-24 gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center"><i className="fa-solid fa-receipt text-2xl"></i></div>
                    <p className="text-xs font-bold uppercase tracking-widest">No activity recorded yet</p>
                  </div>
                ) : (
                  activeEvent.expenses.sort((a,b) => b.date - a.date).map(e => (
                    <div 
                      key={e.id} 
                      onClick={() => setSelectedExpense(e)} 
                      className={`p-5 mb-4 rounded-2xl border transition-all cursor-pointer group ${e.category === 'Payment' ? 'bg-slate-50/50 border-slate-100 border-dashed' : 'bg-white border-slate-50 hover:border-[#4f46e5] hover:shadow-lg hover:shadow-indigo-50'}`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="min-w-0 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${e.category === 'Payment' ? 'text-green-500 bg-green-50' : 'text-slate-400 bg-slate-50'}`}>
                             <i className={`fa-solid ${e.category === 'Payment' ? 'fa-hand-holding-dollar' : 'fa-receipt'}`}></i>
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 truncate group-hover:text-[#4f46e5] transition-colors">{e.description}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                              <span className="text-slate-600">{activeEvent.participants.find(p=>p.id===e.payerId)?.name}</span> paid • {new Date(e.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-slate-800 text-lg">₹{e.amount.toFixed(0)}</p>
                          <p className="text-[8px] text-slate-300 font-black uppercase tracking-widest">{e.category}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="lg:col-span-4">
              <ExpenseForm participants={activeEvent.participants} onAdd={addExpense} />
            </div>
          </div>
        ) : (
          <SettlementView participants={activeEvent.participants} balances={balances} settlements={settlements} totalSpent={totalSpent} onSettle={handleSettle} />
        )}
      </main>

      {/* Cloud Sync & Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cloud Sync</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Get your unique short link</p>
              </div>
              <button 
                onClick={() => setShowShareModal(false)} 
                className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-slate-300 hover:text-slate-600 transition-all border border-transparent hover:border-slate-100"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            
            <div className="p-10 space-y-8">
              {shareStatus === 'saving' ? (
                <div className="flex flex-col items-center justify-center py-12 gap-6">
                  <div className="w-16 h-16 border-[6px] border-slate-100 border-t-[#4f46e5] rounded-full animate-spin shadow-inner"></div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">Pushing to Cloud...</p>
                </div>
              ) : generatedShortUrl ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center relative overflow-hidden group">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Short Link Generated</span>
                    <p className="text-sm font-bold text-[#4f46e5] truncate px-4">{generatedShortUrl}</p>
                    <div className="absolute inset-0 bg-[#4f46e5]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={handleShareWhatsApp} className="flex flex-col items-center gap-3 p-6 rounded-[2rem] bg-green-50 hover:bg-green-100 transition-all border border-green-100 group">
                      <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100 group-hover:scale-110 transition-transform"><i className="fa-brands fa-whatsapp text-2xl"></i></div>
                      <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">WhatsApp</span>
                    </button>
                    <button onClick={handleCopyLink} className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] transition-all border group ${shareStatus === 'copied' ? 'bg-green-100 border-green-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all group-hover:scale-110 ${shareStatus === 'copied' ? 'bg-green-600 shadow-green-100' : 'bg-slate-800 shadow-slate-100'}`}>
                        <i className={`fa-solid ${shareStatus === 'copied' ? 'fa-check' : 'fa-link-slash'} text-xl`}></i>
                      </div>
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{shareStatus === 'copied' ? 'Success' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleShareToSupabase}
                  className="w-full bg-[#4f46e5] text-white py-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-200 hover:bg-[#4338ca] hover:-translate-y-1 transition-all active:scale-[0.98]"
                >
                  Generate Private Link
                </button>
              )}
              {shareStatus === 'error' && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                  <p className="text-[9px] text-red-500 font-black uppercase tracking-widest">Connection lost. Please check credentials.</p>
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-50/80 text-center border-t border-slate-100">
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                <i className="fa-solid fa-shield-halved text-[#4f46e5]"></i>
                End-to-End Persistence
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detail & Deletion Modal */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl p-10 space-y-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
               <h3 className="text-2xl font-black text-slate-800 tracking-tight">Transaction Info</h3>
               <button onClick={() => setSelectedExpense(null)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-6 border-b border-slate-50">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Label</span>
                <span className="font-black text-xl text-slate-800">{selectedExpense.description}</span>
              </div>
              <div className="flex justify-between items-center pb-6 border-b border-slate-50">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Value</span>
                <span className="font-black text-3xl text-[#4f46e5]">₹{selectedExpense.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pb-6 border-b border-slate-50">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Payer</span>
                <span className="font-black text-slate-800">{activeEvent.participants.find(p=>p.id===selectedExpense.payerId)?.name}</span>
              </div>
            </div>
            <button 
              onClick={() => removeExpense(selectedExpense.id)} 
              className="w-full py-5 bg-red-50 text-red-500 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-3 border border-red-100"
            >
              <i className="fa-solid fa-trash-can"></i>
              Void Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
