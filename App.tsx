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

// Defensive Supabase initialization
let supabase: SupabaseClient | null = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const App: React.FC = () => {
  const [events, setEvents] = useState<Record<string, SplitEvent>>({});
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [newEventName, setNewEventName] = useState('');
  
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlement'>('expenses');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'saving' | 'copied' | 'error'>('idle');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEventId, setShareEventId] = useState<string | null>(null);
  const [generatedShortUrl, setGeneratedShortUrl] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingShared, setIsLoadingShared] = useState(false);

  const getAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=4f46e5&textColor=ffffff`;

  // Fetch Logic: Check for short ID in hash on load
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Load Local Storage
      const savedEvents = localStorage.getItem('splitit_multi_events');
      let currentEvents: Record<string, SplitEvent> = savedEvents ? JSON.parse(savedEvents) : {};

      // 2. Check Hash for /trip/[ID] or just /[ID] (6 characters)
      const hash = window.location.hash;
      const shortIdMatch = hash.match(/#\/?([a-z0-9]{6})$/i);
      
      if (shortIdMatch && shortIdMatch[1] && supabase) {
        const tripSlug = shortIdMatch[1];
        setIsLoadingShared(true);
        try {
          const { data, error } = await supabase
            .from('trips')
            .select('trip_data')
            .eq('id', tripSlug)
            .single();

          if (!error && data && data.trip_data) {
            const fetchedEvent = data.trip_data as SplitEvent;
            const localId = fetchedEvent.id || tripSlug;
            currentEvents[localId] = fetchedEvent;
            setCurrentEventId(localId);
            
            // Clean up hash
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (err) {
          console.error("Failed to fetch shared trip:", err);
        } finally {
          setIsLoadingShared(false);
        }
      }
      
      setEvents(currentEvents);
      setIsInitialized(true);
    };

    loadInitialData();
  }, []);

  // Persistence Sync
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

  // Actions
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
    if (window.confirm("Delete this group permanently?")) {
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

  // Save Logic: Upload trip to Supabase
  const handleShareToSupabase = async () => {
    if (!shareEventId || !events[shareEventId] || !supabase) {
      if (!supabase) alert("Supabase credentials missing. Check index.html polyfills.");
      return;
    }
    
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
      
      const shortUrl = `https://splitits.in/#/${shortId}`;
      setGeneratedShortUrl(shortUrl);
      setShareStatus('idle');
    } catch (err) {
      console.error("Save error:", err);
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
    const settlementText = settlements.length === 0 ? "All settled! ✅" : settlements.map(s => `💸 *${ev.participants.find(p=>p.id===s.from)?.name}* owes *${ev.participants.find(p=>p.id===s.to)?.name}*: ₹${s.amount.toFixed(2)}`).join('\n');
    
    const text = `💰 *SplitIt: ${ev.name}*\n\n*Settlements:*\n${settlementText}\n\n🔗 View & Settle:\n${generatedShortUrl}\n\nNo more awkward money talks! SplitIt handles it all for you.\nTry it Now: splitits.in`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    if (!generatedShortUrl) return;
    navigator.clipboard.writeText(generatedShortUrl).then(() => {
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    });
  };

  if (!isInitialized || isLoadingShared) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-[#4f46e5] rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          {isLoadingShared ? 'Loading Shared Trip...' : 'Initializing splitIt...'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setCurrentEventId(null)}
          >
            <div className="w-10 h-10 bg-[#4f46e5] rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:rotate-12 transition-all">
              <i className="fa-solid fa-receipt text-white"></i>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">SplitIt</h1>
          </div>
          
          {activeEvent && (
            <div className="flex items-center gap-4">
              <button 
                onClick={(e) => openShareModal(e, activeEvent.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black text-[#4f46e5] bg-[#eef2ff] hover:bg-[#e0e7ff] transition-all tracking-widest uppercase"
              >
                <i className="fa-solid fa-share-nodes"></i>
                <span className="hidden sm:inline">Share Event</span>
              </button>
              <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>
              <p className="text-sm font-bold text-slate-600 truncate max-w-[120px]">{activeEvent.name}</p>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-10 pb-20">
        {!currentEventId ? (
          <div className="max-w-2xl mx-auto py-10 sm:py-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-12">
              <h2 className="text-4xl sm:text-5xl font-black text-slate-800 mb-4 tracking-tight leading-tight">Split costs, <br/><span className="text-[#4f46e5]">effortlessly.</span></h2>
              <p className="text-slate-400 font-medium text-lg">Your group trip's best friend. No math, just memories.</p>
            </div>

            <form onSubmit={createEvent} className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 mb-12">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block mb-4 px-1">Create a new group</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="e.g. Weekend at Alibaug"
                  className="flex-1 px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:border-[#4f46e5] focus:bg-white text-base transition-all"
                />
                <button 
                  type="submit"
                  className="bg-[#4f46e5] text-white px-8 py-5 rounded-2xl font-bold text-base hover:bg-[#4338ca] transition-all shadow-lg active:scale-95"
                >
                  Get Started
                </button>
              </div>
            </form>

            {Object.values(events).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-1">Existing Groups</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Fixed TypeScript error by explicitly casting Object.values(events) to SplitEvent[] to ensure correct property access */}
                  {(Object.values(events) as SplitEvent[]).sort((a, b) => b.createdAt - a.createdAt).map(ev => (
                    <div 
                      key={ev.id}
                      onClick={() => setCurrentEventId(ev.id)}
                      className="group bg-white p-6 rounded-3xl border border-slate-100 hover:border-[#4f46e5] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{ev.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{ev.participants.length} Squad • {ev.expenses.length} Exp.</p>
                      </div>
                      <div className="flex gap-1">
                         <button onClick={(e) => openShareModal(e, ev.id)} className="w-8 h-8 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all"><i className="fa-solid fa-share-nodes text-sm"></i></button>
                         <button onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }} className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><i className="fa-solid fa-trash-can text-sm"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="lg:col-span-3 space-y-6">
              <ParticipantManager 
                participants={activeEvent.participants}
                onAdd={addParticipant}
                onRemove={removeParticipant}
              />
              <div className="bg-[#1e293b] p-6 rounded-3xl text-white">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Total Budget</p>
                <p className="text-3xl font-black">₹{totalSpent.toFixed(0)}</p>
              </div>
            </div>

            <div className="lg:col-span-9 space-y-8">
              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit">
                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`px-8 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'expenses' ? 'bg-[#4f46e5] text-white' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Transactions
                </button>
                <button
                  onClick={() => setActiveTab('settlement')}
                  className={`px-8 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'settlement' ? 'bg-[#4f46e5] text-white' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Settlement
                </button>
              </div>

              {activeTab === 'expenses' ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <ExpenseForm participants={activeEvent.participants} onAdd={addExpense} />
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Recent Activity</h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
                      {activeEvent.expenses.length === 0 ? (
                        <div className="p-12 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                          <p className="text-slate-300 font-bold text-xs">No expenses logged yet</p>
                        </div>
                      ) : (
                        activeEvent.expenses.map(exp => (
                          <div key={exp.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-[#4f46e5] transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#4f46e5]"><i className="fa-solid fa-receipt"></i></div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-slate-800 truncate">{exp.description}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{activeEvent.participants.find(p => p.id === exp.payerId)?.name} • {exp.category}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                               <p className="font-black text-sm">₹{exp.amount}</p>
                               <button onClick={() => removeExpense(exp.id)} className="text-slate-200 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can text-xs"></i></button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <SettlementView 
                  participants={activeEvent.participants}
                  balances={balances}
                  settlements={settlements}
                  totalSpent={totalSpent}
                  onSettle={handleSettle}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl animate-in zoom-in-95 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Share Group</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Short Link Generation</p>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-lg"></i></button>
            </div>
            
            <div className="p-8 space-y-6">
              {!generatedShortUrl ? (
                <button
                  onClick={handleShareToSupabase}
                  disabled={shareStatus === 'saving'}
                  className="w-full bg-[#4f46e5] text-white py-5 rounded-2xl font-bold text-sm shadow-lg hover:bg-[#4338ca] transition-all disabled:opacity-50"
                >
                  {shareStatus === 'saving' ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      SAVING...
                    </span>
                  ) : 'CREATE SHORT LINK'}
                </button>
              ) : (
                <div className="space-y-4 animate-in fade-in zoom-in-95">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-slate-400 truncate flex-1">{generatedShortUrl}</span>
                    <button 
                      onClick={handleCopyLink} 
                      className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${shareStatus === 'copied' ? 'bg-green-100 text-green-600 border-green-200' : 'bg-white text-[#4f46e5] border-slate-100'}`}
                    >
                      {shareStatus === 'copied' ? 'COPIED' : 'COPY'}
                    </button>
                  </div>
                  <button onClick={handleShareWhatsApp} className="w-full bg-[#25D366] text-white py-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-[#20bd5a] transition-all">
                    <i className="fa-brands fa-whatsapp text-xl"></i>
                    SEND ON WHATSAPP
                  </button>
                </div>
              )}
              {shareStatus === 'error' && <p className="text-[10px] text-red-500 font-bold text-center uppercase tracking-widest">Failed to sync with cloud. Try again.</p>}
            </div>
            <div className="p-6 bg-slate-50 text-center"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Powered by Supabase DB</p></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;