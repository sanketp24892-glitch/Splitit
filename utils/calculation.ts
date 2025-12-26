
import { Expense, Participant, Settlement, Balance } from '../types.ts';

export const calculateBalances = (participants: Participant[], expenses: Expense[]): Balance[] => {
  const balances: Record<string, number> = {};
  participants.forEach(p => balances[p.id] = 0);

  expenses.forEach(expense => {
    if (expense.category === 'Payment') {
      // Settlement: payerId is the sender (debtor), participantIds[0] is the receiver (creditor)
      // Payer balance increases (becomes less negative)
      balances[expense.payerId] += expense.amount;
      // Recipient balance decreases (becomes less positive)
      expense.participantIds.forEach(pId => {
        balances[pId] -= expense.amount;
      });
    } else {
      // Regular expense: split amount among all participants
      const splitAmount = expense.amount / expense.participantIds.length;
      
      // Payer gets back their total minus their share
      balances[expense.payerId] += expense.amount;

      // Each participant owes their share
      expense.participantIds.forEach(pId => {
        balances[pId] -= splitAmount;
      });
    }
  });

  return Object.entries(balances).map(([id, amount]) => ({
    participantId: id,
    amount: parseFloat(amount.toFixed(2))
  }));
};

export const calculateSettlements = (balances: Balance[]): Settlement[] => {
  const settlements: Settlement[] = [];
  // Work with a copy to avoid mutating the original array
  const pos = balances.filter(b => b.amount > 0.01).map(b => ({ ...b })).sort((a, b) => b.amount - a.amount);
  const neg = balances.filter(b => b.amount < -0.01).map(b => ({ ...b })).sort((a, b) => a.amount - b.amount);

  let i = 0; // pos index
  let j = 0; // neg index

  while (i < pos.length && j < neg.length) {
    const amount = Math.min(pos[i].amount, Math.abs(neg[j].amount));
    settlements.push({
      from: neg[j].participantId,
      to: pos[i].participantId,
      amount: parseFloat(amount.toFixed(2))
    });

    pos[i].amount -= amount;
    neg[j].amount += amount;

    if (pos[i].amount < 0.01) i++;
    if (Math.abs(neg[j].amount) < 0.01) j++;
  }

  return settlements;
};
