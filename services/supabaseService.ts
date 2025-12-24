
import { createClient } from '@supabase/supabase-js';
import { Participant, Expense } from '../types.ts';

// Your Supabase Project Credentials
const SUPABASE_URL = 'https://yrlvjtnxusbgqeqgaonu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bFgmsQkkShvZYtyLf7ASEA_I1J6Y3zw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Creates a new event entry in the 'events' table
 */
export const createEvent = async (name: string, shortCode: string): Promise<string> => {
  const { data, error } = await supabase
    .from('events')
    .insert([{ name, short_code: shortCode }])
    .select()
    .single();

  if (error) {
    console.error("Supabase Create Event Error:", error);
    throw error;
  }
  return data.id;
};

/**
 * Fetches an event and all its related participants and expenses using the short_code
 */
export const fetchEventByCode = async (shortCode: string) => {
  try {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, short_code, created_at')
      .eq('short_code', shortCode)
      .single();

    if (eventError || !event) return null;

    const { data: participants } = await supabase
      .from('participants')
      .select('*')
      .eq('event_id', event.id);

    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('event_id', event.id);

    return {
      id: event.id,
      name: event.name,
      shortCode: event.short_code,
      participants: (participants || []).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        upiId: p.upi_id // Mapping database upi_id to app upiId
      })),
      expenses: (expenses || []).map(e => ({
        ...e,
        payerId: e.payer_id,
        participantIds: e.participant_ids,
        date: new Date(e.created_at).getTime()
      })),
      createdAt: new Date(event.created_at).getTime()
    };
  } catch (e) {
    console.error("Fetch Event Error:", e);
    return null;
  }
};

/**
 * Adds a participant to an existing event
 */
export const addParticipant = async (eventId: string, p: Omit<Participant, 'id'>) => {
  const { data, error } = await supabase
    .from('participants')
    .insert([{ 
      name: p.name, 
      avatar: p.avatar, 
      upi_id: p.upiId || null, // Explicit mapping to database column upi_id
      event_id: eventId 
    }])
    .select()
    .single();
  
  if (error) {
    console.error("Add Participant Error:", error);
    throw error;
  }
  return {
    ...data,
    upiId: data.upi_id // Return mapped for UI
  };
};

/**
 * Deletes a participant by ID
 */
export const deleteParticipant = async (id: string) => {
  const { error } = await supabase.from('participants').delete().eq('id', id);
  if (error) console.error("Delete Participant Error:", error);
};

/**
 * Adds an expense linked to an event and participants
 */
export const addExpense = async (eventId: string, e: Omit<Expense, 'id'>) => {
  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      event_id: eventId,
      description: e.description,
      amount: e.amount,
      payer_id: e.payerId,
      participant_ids: e.participantIds,
      category: e.category
    }])
    .select()
    .single();

  if (error) {
    console.error("Add Expense Error:", error);
    throw error;
  }
  return data;
};

/**
 * Deletes an expense by ID
 */
export const deleteExpense = async (id: string) => {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) console.error("Delete Expense Error:", error);
};

/**
 * Listens for real-time changes to participants or expenses for a specific event
 */
export const subscribeToChanges = (eventId: string, onUpdate: () => void) => {
  const channel = supabase.channel(`event-realtime-${eventId}`)
    .on(
      'postgres_changes', 
      { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${eventId}` }, 
      onUpdate
    )
    .on(
      'postgres_changes', 
      { event: '*', schema: 'public', table: 'expenses', filter: `event_id=eq.${eventId}` }, 
      onUpdate
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
