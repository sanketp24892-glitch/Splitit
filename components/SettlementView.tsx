
import React, { useState, useRef, useMemo } from 'react';
import { Participant, Settlement, Balance, Expense } from '../types.ts';

interface Props {
  participants: Participant[];
  balances: Balance[];
  settlements: Settlement[];
  expenses: Expense[];
  totalSpent: number;
  onSettle: (fromId: string, toId: string, amount: number, description: string, proof?: string) => Promise<void>;
  onUndoSettlement: (expenseId: string) => Promise<void>;
}

const SettlementView: React.FC<Props> = ({ participants, balances, settlements, expenses, totalSpent, onSettle, onUndoSettlement }) => {
  const [paymentModal, setPaymentModal] = useState<{ settlement: Settlement; show: boolean } | null>(null);
  const [manualConfirmModal, setManualConfirmModal] = useState<Settlement | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [manualComment, setManualComment] = useState('');
  const [showUpiInput, setShowUpiInput] = useState(false);
  const [manualUpi, setManualUpi] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getParticipant = (id: string) => participants.find(p => p.id === id);
  const getParticipantName = (id: string) => getParticipant(id)?.name || 'member';

  const settlementHistory = useMemo(() => {
    return expenses
      .filter(e => e.category === 'Payment')
      .sort((a, b) => b.date - a.date);
  }, [expenses]);

  const handleWhatsAppReminder = (s: Settlement) => {
    const payer = getParticipant(s.from);
    const payee = getParticipant(s.to);
    if (!payer || !payee) return;
    
    const msg = `Hey *${payer.name}*, split our bills on SplitIt! 💸 You owe *${payee.name}* *₹${s.amount.toFixed(0)}*.\n${payee.upiId ? `\nMy UPI: ${payee.upiId}` : ''}\n\nLess maths. More memories.\nTry Splitit → www.splitits.in`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handlePayNow = (s: Settlement) => {
    const receiver = getParticipant(s.to);
    if (receiver?.upiId) {
      const link = `upi://pay?pa=${receiver.upiId}&pn=${encodeURIComponent(receiver.name)}&am=${s.amount.toFixed(2)}&cu=INR`;
      window.location.href = link;
    } else {
      setPaymentModal({ settlement: s, show: true });
      setShowUpiInput(true);
      setManualUpi('');
    }
  };

  const openUpiApp = () => {
    if (!paymentModal) return;
    const payee = getParticipant(paymentModal.settlement.to);
    const upi = manualUpi || payee?.upiId;
    if (!upi) {
      alert("Please enter a valid UPI ID");
      return;
    }
    
    const link = `upi://pay?pa=${upi}&pn=${encodeURIComponent(payee?.name || 'User')}&am=${paymentModal.settlement.amount.toFixed(2)}&cu=INR`;
    setPaymentModal(null);
    window.location.href = link;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("File is too large. Please select a screenshot smaller than 1MB.");
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmManualSettle = async () => {
    if (manualConfirmModal && !isProcessing) {
      const hasProof = !!screenshot || !!manualComment.trim();
      if (!hasProof) {
        alert("Please provide either a screenshot or a comment.");
        return;
      }

      setIsProcessing(true);
      try {
        const desc = manualComment.trim() ? `Manual: ${manualComment.trim()}` : "Settle payment";
        await onSettle(manualConfirmModal.from, manualConfirmModal.to, manualConfirmModal.amount, desc, screenshot || undefined);
        setManualConfirmModal(null);
        setScreenshot(null);
        setManualComment('');
      } catch (err) {
        console.error("Manual settlement error:", err);
        alert("Failed to record settlement.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in pb-20 max-w-4xl mx-auto px-2 sm:px-0">
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
            <i className="fa-solid fa-hand-holding-dollar text-lg"></i>
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">Settle Expenses</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clear group debts</p>
          </div>
        </div>

        {settlements.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-16 text-center border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
              <i className="fa-solid fa-check"></i>
            </div>
            <h3 className="text-xl font-black text-slate-800">You're All Settled!</h3>
            <p className="text-sm font-medium text-slate-400 mt-2">Everyone has paid their share.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settlements.map((s, idx) => {
              const payer = getParticipant(s.from);
              const receiver = getParticipant(s.to);
              return (
                <div key={idx} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-3 flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-[8px] text-slate-500 font-black uppercase shrink-0">Sender</div>
                        <p className="text-sm font-black text-slate-900 uppercase truncate tracking-tight">{payer?.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-[8px] font-black uppercase shrink-0">Receiver</div>
                        <p className="text-sm font-black text-indigo-600 uppercase truncate tracking-tight">{receiver?.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Owes</p>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter">₹{s.amount.toFixed(0)}</h3>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handlePayNow(s)} 
                        className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-indigo-100/50 flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-bolt-lightning text-[10px]"></i>
                        Pay now
                      </button>
                      <button 
                        onClick={() => handleWhatsAppReminder(s)} 
                        className="flex-1 bg-green-50 text-green-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-green-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fa-brands fa-whatsapp text-lg"></i>
                        Request
                      </button>
                    </div>
                    <button 
                      onClick={() => {setManualConfirmModal(s); setManualComment(''); setScreenshot(null);}} 
                      className="w-full bg-slate-50 text-slate-900 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-100 hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-receipt"></i>
                      Settle payment
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {manualConfirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black uppercase tracking-tight">Settle Payment</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Confirm settlement of <strong>₹{manualConfirmModal.amount.toFixed(0)}</strong> from <strong>{getParticipantName(manualConfirmModal.from)}</strong> to <strong>{getParticipantName(manualConfirmModal.to)}</strong>.
              </p>
              <p className="text-[10px] font-black text-indigo-500 uppercase">Screenshot or comment is mandatory</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <input type="file" accept="image/*" className="hidden" id="manual-screenshot" ref={fileInputRef} onChange={handleFileChange} />
                {screenshot ? (
                  <div className="relative group mx-auto w-32 h-32 rounded-2xl overflow-hidden border-2 border-indigo-600 shadow-md">
                    <img src={screenshot} className="w-full h-full object-cover" />
                    {!isProcessing && (
                      <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <i className="fa-solid fa-camera text-white"></i>
                      </button>
                    )}
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center gap-2 hover:bg-slate-100 transition-all">
                    <i className="fa-solid fa-upload text-slate-400 text-lg"></i>
                    <span className="text-[10px] font-black uppercase text-slate-400">Upload Attachment</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-1">OR ADD A COMMENT</label>
                <textarea 
                  value={manualComment}
                  onChange={(e) => setManualComment(e.target.value)}
                  placeholder="e.g. Paid via UPI, Cash, etc."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold focus:outline-none focus:border-indigo-600 focus:bg-white transition-all min-h-[80px] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button disabled={isProcessing} onClick={() => {setManualConfirmModal(null); setScreenshot(null); setManualComment('');}} className="py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">Cancel</button>
                <button 
                  disabled={(!screenshot && !manualComment.trim()) || isProcessing}
                  onClick={confirmManualSettle} 
                  className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${(screenshot || manualComment.trim()) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}
                >
                  {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : "Confirm Settle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Report */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 sm:p-10 shadow-sm space-y-6 mx-2 sm:mx-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black tracking-tight uppercase">Summary Report</h2>
        </div>

        <div className="space-y-4">
          {settlements.length === 0 ? (
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-4">No pending debts.</p>
          ) : (
            <div className="space-y-3">
              {settlements.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <p className="text-xs text-slate-600 tracking-tight">
                    <span className="text-slate-900 font-bold">{getParticipantName(s.from)}</span> pays <span className="text-slate-900 font-bold">{getParticipantName(s.to)}</span>
                  </p>
                  <p className="text-sm font-black text-slate-900">₹{s.amount.toFixed(0)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 flex justify-between items-center border-t border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Outstanding</span>
            <span className="text-xl font-black text-indigo-600 tracking-tighter">₹{settlements.reduce((acc, curr) => acc + curr.amount, 0).toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 border border-slate-100 shadow-sm space-y-6 mx-2 sm:mx-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Settlement History</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Past Transactions</p>
          </div>
        </div>

        <div className="space-y-3">
          {settlementHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-300 font-bold uppercase text-[9px]">No settlements recorded yet</div>
          ) : (
            settlementHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all">
                <div className="flex items-center gap-4 min-w-0">
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${h.description.includes('Manual') ? 'bg-orange-50 text-orange-500' : 'bg-indigo-50 text-indigo-500'}`}>
                     <i className={h.description.includes('Manual') ? "fa-solid fa-camera" : "fa-solid fa-mobile-screen"}></i>
                   </div>
                   <div className="min-w-0">
                      <p className="text-xs font-black tracking-tight truncate">
                        {getParticipantName(h.payerId)} → {getParticipantName(h.participantIds[0])}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[150px]">{h.description}</span>
                        {h.proofUrl && (
                          <button onClick={() => {
                            const w = window.open();
                            if (w) w.document.write(`<img src="${h.proofUrl}" style="max-width:100%; height:auto;" />`);
                          }} className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100">
                             <i className="fa-solid fa-paperclip mr-1"></i>VIEW PROOF
                          </button>
                        )}
                      </div>
                   </div>
                </div>
                <div className="text-right flex flex-col items-end shrink-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-slate-900">₹{Number(h.amount).toFixed(0)}</p>
                    <button 
                      onClick={() => onUndoSettlement(h.id)}
                      className="w-6 h-6 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 flex items-center justify-center transition-all"
                      title="Undo"
                    >
                      <i className="fa-solid fa-rotate-left text-[9px]"></i>
                    </button>
                  </div>
                  <p className="text-[8px] font-bold text-slate-300 uppercase">{new Date(h.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 text-center space-y-1">
        <p className="text-[10px] font-bold text-slate-400 lowercase tracking-tight">
          Less maths. More memories.
        </p>
        <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">
          Try Splitit → <span className="underline">www.splitits.in</span>
        </p>
      </div>

      {paymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full shadow-2xl overflow-hidden">
            <div className="p-10 border-b border-slate-50 text-center bg-slate-50/50">
               <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-3 block">UPI PAYMENT</span>
               <h3 className="text-5xl font-black text-slate-900 tracking-tighter">₹{paymentModal.settlement.amount.toFixed(0)}</h3>
               <p className="text-sm font-bold text-slate-500 mt-4">Recipient: {getParticipantName(paymentModal.settlement.to)}</p>
            </div>
            
            <div className="p-8 space-y-3">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-1">Recipient VPA</label>
                  <input type="text" autoFocus value={manualUpi} onChange={e => setManualUpi(e.target.value)} placeholder="username@upi" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPaymentModal(null)} className="flex-1 py-5 bg-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                  <button onClick={openUpiApp} className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Proceed to Apps</button>
                </div>
              </div>
              <p className="text-[9px] text-center text-slate-400 font-bold uppercase py-2">Device will show available UPI apps after you click proceed</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlementView;
