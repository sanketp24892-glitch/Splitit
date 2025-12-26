
import { createClient } from '@supabase/supabase-js';
import { Participant, Expense } from '../types.ts';

// Your Supabase Project Credentials
const SUPABASE_URL = 'https://yrlvjtnxusbgqeqgaonu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bFgmsQkkShvZYtyLf7ASEA_I1J6Y3zw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const toTitleCase = (str: string) => {
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

/**
 * Logs an action to the activity_log table
 */
export const logActivity = async (eventId: string, description: string) => {
  try {
    await supabase.from('activity_log').insert([{ event_id: eventId, description }]);
  } catch (err) {
    console.error("Log Activity Error:", err);
  }
};

/**
 * Fetches the activity history for an event
 */
export const fetchActivityHistory = async (eventId: string) => {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error("Fetch History Error:", error);
    return [];
  }
  return data || [];
};

/**
 * Creates a new event entry in the 'events' table
 */
export const createEvent = async (name: string, shortCode: string): Promise<string> => {
  const { data, error } = await supabase
    .from('events')
    .insert([{ name, short_code: shortCode }])
    .select();

  if (error) {
    console.error("Supabase Create Event Error:", error);
    throw error;
  }
  const eventId = data?.[0]?.id;
  if (eventId) {
    await logActivity(eventId, `Event "${name}" was created`);
  }
  return eventId;
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
        name: toTitleCase(p.name),
        avatar: p.avatar,
        upiId: p.upi_id // Mapping database upi_id to app upiId
      })),
      expenses: (expenses || []).map(e => ({
        ...e,
        payerId: e.payer_id,
        participantIds: e.participant_ids,
        date: new Date(e.created_at).getTime(),
        proofUrl: e.proof_url
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
  const titleName = toTitleCase(p.name);
  const { data, error } = await supabase
    .from('participants')
    .insert([{ 
      name: titleName,
      avatar: p.avatar, 
      upi_id: p.upiId || null, // Explicit mapping to database column upi_id
      event_id: eventId 
    }])
    .select();
  
  if (error) {
    console.error("Add Participant Error:", error);
    throw error;
  }
  
  const result = data?.[0];
  if (!result) throw new Error("No data returned from insert");

  await logActivity(eventId, `Member "${titleName}" joined the squad`);

  return {
    ...result,
    name: toTitleCase(result.name),
    upiId: result.upi_id // Return mapped for UI
  };
};

/**
 * Updates a participant's details
 */
export const updateParticipant = async (id: string, updates: Partial<Participant>, eventId?: string) => {
  const payload: any = {};
  if (updates.name) payload.name = toTitleCase(updates.name);
  if (updates.upiId !== undefined) payload.upi_id = updates.upiId;
  
  const { error } = await supabase
    .from('participants')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error("Update Participant Error:", error);
    throw error;
  }

  if (eventId && updates.name) {
    await logActivity(eventId, `Member details updated for "${toTitleCase(updates.name)}"`);
  }
};

/**
 * Deletes a participant by ID
 */
export const deleteParticipant = async (id: string, eventId?: string, name?: string) => {
  const { error } = await supabase.from('participants').delete().eq('id', id);
  if (error) {
    console.error("Delete Participant Error:", error);
  } else if (eventId && name) {
    await logActivity(eventId, `Member "${toTitleCase(name)}" was removed`);
  }
};

/**
 * Adds an expense linked to an event and participants
 */
export const addExpense = async (eventId: string, e: Omit<Expense, 'id'>) => {
  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      event_id: eventId,
      description: e.description || "Expense",
      amount: Number(e.amount) || 0,
      payer_id: e.payerId,
      // Fix: use camelCase property name from Expense interface
      participant_ids: e.participantIds || [],
      category: e.category || 'Other',
      // Fix: use camelCase property name from Expense interface
      proof_url: e.proofUrl || null
    }])
    .select();

  if (error) {
    console.error("Add Expense Error:", error);
    throw error;
  }

  const logMsg = e.category === 'Payment' 
    ? `Settlement of ₹${e.amount} recorded` 
    : `Expense "${e.description}" (₹${e.amount}) added`;
  await logActivity(eventId, logMsg);

  return data?.[0] || null;
};

/**
 * Updates an existing expense
 */
export const updateExpense = async (id: string, e: Partial<Expense>, eventId?: string) => {
  const payload: any = {};
  if (e.description) payload.description = e.description;
  if (e.amount !== undefined) payload.amount = e.amount;
  if (e.payerId) payload.payer_id = e.payerId;
  if (e.participantIds) payload.participant_ids = e.participantIds;
  if (e.category) payload.category = e.category;
  if (e.proofUrl !== undefined) payload.proof_url = e.proofUrl;

  const { error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error("Update Expense Error:", error);
    throw error;
  }

  if (eventId) {
    await logActivity(eventId, `Expense "${e.description || 'updated item'}" was modified`);
  }
};

/**
 * Deletes an expense by ID
 */
export const deleteExpense = async (id: string, eventId?: string, desc?: string) => {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) {
    console.error("Delete Expense Error:", error);
  } else if (eventId) {
    await logActivity(eventId, `Expense "${desc || 'item'}" was deleted`);
  }
};

/**
 * Listens for real-time changes to participants, expenses, or activity_log for a specific event
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
    .on(
      'postgres_changes', 
      { event: '*', schema: 'public', table: 'activity_log', filter: `event_id=eq.${eventId}` }, 
      onUpdate
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
