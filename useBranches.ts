
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { Branch } from './types';

export const useBranches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });
          
        if (error) throw error;
        if (data) setBranches(data);
      } catch (err: any) {
        console.error('Error fetching branches:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranches();
  }, []);

  return { branches, isLoading, error };
};
