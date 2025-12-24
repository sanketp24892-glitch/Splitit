
export interface Participant {
  id: string;
  name: string;
  avatar: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  payerId: string;
  participantIds: string[];
  date: number;
  category: 'Food' | 'Transport' | 'Lodging' | 'Entertainment' | 'Payment' | 'Other';
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface Balance {
  participantId: string;
  amount: number;
}

export interface SplitEvent {
  id: string;
  name: string;
  participants: Participant[];
  expenses: Expense[];
  createdAt: number;
}
