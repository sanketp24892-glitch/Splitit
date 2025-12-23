
import { Expense, Participant, Settlement, Balance } from '../types.ts';

export const calculateBalances = (participants: Participant[], expenses: Expense[]): Balance[] => {
  const balances: Record<string, number> = {};
  participants.forEach(p => balances[p.id] = 0);

  expenses.forEach(expense => {
    const splitAmount = expense.amount / expense.participantIds.length;
    
    // Payer gets back their total minus their share
    balances[expense.payerId] += expense.amount;

    // Each participant (including payer if they are in participantIds) owes their share
    expense.participantIds.forEach(pId => {
      balances[pId] -= splitAmount;
    });
  });

  return Object.entries(balances).map(([id, amount]) => ({
    participantId: id,
    amount: parseFloat(amount.toFixed(2))
  }));
};

export const calculateSettlements = (balances: Balance[]): Settlement[] => {
  const settlements: Settlement[] = [];
  const pos = balances.filter(b => b.amount > 0).sort((a, b) => b.amount - a.amount);
  const neg = balances.filter(b => b.amount < 0).sort((a, b) => a.amount - b.amount);

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
