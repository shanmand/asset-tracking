
import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';

/**
 * Utility to ensure all IDs are strings before sending to Supabase.
 * This prevents the 'Operator does not exist: text = uuid' error.
 */
export const castId = (id: any): string => {
  if (id === null || id === undefined) return '';
  if (typeof id === 'object' && id !== null) {
    if ('id' in id) return String(id.id);
    if ('batch_id' in id) return String(id.batch_id);
    if ('uuid' in id) return String(id.uuid);
  }
  const str = String(id);
  return str === '[object Object]' ? '' : str;
};

/**
 * Casts all ID-like fields in an object to strings.
 */
export const normalizePayload = (payload: any): any => {
  if (Array.isArray(payload)) {
    return payload.map(item => normalizePayload(item));
  }
  
  if (typeof payload !== 'object' || payload === null) {
    return payload;
  }

  const normalized: any = {};
  for (const key in payload) {
    let value = payload[key];
    
    // If value is an object with an 'id' property, extract the 'id'
    if (value && typeof value === 'object' && 'id' in value && (key === 'id' || key.endsWith('_id'))) {
      value = value.id;
    }

    // Heuristic: if key ends with _id or is 'id', cast to string
    if (key === 'id' || key.endsWith('_id')) {
      normalized[key] = value !== null && value !== undefined ? castId(value) : null;
    } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      normalized[key] = normalizePayload(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
};

/**
 * Wrapper for Supabase RPC calls with normalized payload.
 */
export const callRpc = async (supabase: any, rpcName: string, params: any): Promise<PostgrestResponse<any>> => {
  return supabase.rpc(rpcName, normalizePayload(params));
};

/**
 * Wrapper for Supabase insertions with normalized payload.
 */
export const insertRecord = async (supabase: any, table: string, payload: any): Promise<PostgrestResponse<any>> => {
  return supabase.from(table).insert(normalizePayload(payload));
};

/**
 * Wrapper for Supabase updates with normalized payload.
 */
export const updateRecord = async (supabase: any, table: string, payload: any, id: string): Promise<PostgrestResponse<any>> => {
  return supabase.from(table).update(normalizePayload(payload)).eq('id', castId(id));
};
