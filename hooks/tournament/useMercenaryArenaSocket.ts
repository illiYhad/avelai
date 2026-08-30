// hooks/tournament/useMercenaryArenaSocket.ts
//
// เดิมใช้ Socket.io ต่อเซิร์ฟเวอร์แยก (ต้องเช่าเพิ่ม/ดูแลเอง)
// เปลี่ยนมาใช้ Supabase Realtime แทน — ฟรี ไม่ต้องเช่าเซิร์ฟเวอร์เพิ่ม
// ทำงานแบบเดียวกัน: ฟังการเปลี่ยนแปลงห้อง (mercenary_lobbies) แบบสด

import { useEffect, useRef, useState } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

export interface MercenaryRoomState {
  roomId: string;
  roomCode: string;
  filledSeats: number;
  maxSeats: number;
  potThb: number;
  status: 'WAITING' | 'IN_PROGRESS' | 'SETTLED' | 'CANCELLED';
}

export interface MercenaryMatchSettledPayload {
  roomId: string;
  winnerUserId: string;
  payoutThb: number;
}

interface MercenaryLobbyRow {
  id: string;
  room_code: string;
  current_players: number;
  max_players: number;
  total_pot_thb: number;
  status: 'WAITING' | 'IN_PROGRESS' | 'SETTLED' | 'CANCELLED';
  winner_user_id: string;
}

interface UseMercenarySocketOptions {
  roomId: string | null; // ห้องที่กำลังติดตามอยู่ (null = ยังไม่เข้าห้อง)
  onRoomFilled?: (state: MercenaryRoomState) => void;
  onMatchSettled?: (payload: MercenaryMatchSettledPayload) => void;
  onError?: (error: string) => void;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const useMercenaryArenaSocket = ({
  roomId,
  onRoomFilled,
  onMatchSettled,
  onError,
}: UseMercenarySocketOptions) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<MercenaryRoomState | null>(null);

  // เก็บ Callback ไว้ใน Ref เพื่อเลี่ยงปัญหาวน Re-subscribe ทุกครั้งที่ Re-render
  const callbacksRef = useRef({ onRoomFilled, onMatchSettled, onError });
  useEffect(() => {
    callbacksRef.current = { onRoomFilled, onMatchSettled, onError };
  });

  useEffect(() => {
    if (!roomId) {
      return;
    }

    // Subscribe เฉพาะแถวห้องนี้ในตาราง mercenary_lobbies
    const channel = supabase
      .channel(`mercenary_lobby_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mercenary_lobbies',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as MercenaryLobbyRow;
          const nextState: MercenaryRoomState = {
            roomId: row.id,
            roomCode: row.room_code,
            filledSeats: row.current_players,
            maxSeats: row.max_players,
            potThb: row.total_pot_thb,
            status: row.status,
          };
          setRoomState(nextState);

          if (nextState.status === 'IN_PROGRESS' && callbacksRef.current.onRoomFilled) {
            callbacksRef.current.onRoomFilled(nextState);
          }

          if (nextState.status === 'SETTLED' && callbacksRef.current.onMatchSettled) {
            callbacksRef.current.onMatchSettled({
              roomId: row.id,
              winnerUserId: row.winner_user_id,
              payoutThb: row.total_pot_thb,
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        }
        if (status === 'CHANNEL_ERROR' && callbacksRef.current.onError) {
          callbacksRef.current.onError('REALTIME_CHANNEL_ERROR');
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
      setRoomState(null);
    };
  }, [roomId]);

  return {
    isConnected: Boolean(roomId && isConnected),
    roomState: roomId ? roomState : null,
  };
};