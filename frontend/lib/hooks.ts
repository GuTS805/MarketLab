'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {api} from './api';

/** Loads the user's latest session plus page data; redirects to login/setup when needed. */
export function useSessionData<T>(fetcher:(session:any)=>Promise<T>,deps:any[]=[]){
  const router=useRouter();
  const [session,setSession]=useState<any>(null),[data,setData]=useState<T|null>(null),[error,setError]=useState('');
  const reload=useCallback(async()=>{
    setError('');setData(null);
    try{
      const sessions=await api('/sessions');
      if(!sessions.length){router.replace('/setup');return}
      const current=sessions[0];
      setSession(current);setData(await fetcher(current));setError('');
    }catch(e:any){
      if(/auth/i.test(e.message))router.replace('/');else setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },deps);
  useEffect(()=>{void reload()},[reload]);
  return {session,data,error,setError,reload};
}
