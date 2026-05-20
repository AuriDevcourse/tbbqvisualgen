"use client";

import { useCallback, useState } from "react";

/**
 * Document-state hook with explicit undo/redo history.
 *
 * Defaults:
 *  - Every `set()` call pushes a new history entry (so each discrete user
 *    action is undoable in one step).
 *
 * Transactions, for continuous editing (drag, slider tick, etc.):
 *  - Call `beginTransaction()` on edit-start (pointerdown).
 *  - Call `endTransaction()` on edit-end (pointerup / blur).
 *  - In between, every `set()` updates the present WITHOUT adding a new entry.
 *    The pre-transaction state IS pushed to past on the first set, so the
 *    transaction becomes one undoable unit.
 *  - Nested begin calls are tolerated; matching end calls close them.
 *
 * All transaction state (`txDepth`, `txPushed`) lives INSIDE the history
 * state, so every reducer call is a pure function of (prev, updater). This
 * means React's automatic batching plus the React Compiler optimizations
 * can't desync the transaction logic.
 */

const HISTORY_LIMIT = 10;

interface History<T> {
  past: T[];
  present: T;
  future: T[];
  txDepth: number;
  txPushed: boolean;
}

type Updater<T> = T | ((prev: T) => T);

export interface UndoableHandle<T> {
  doc: T;
  set: (updater: Updater<T>) => void;
  beginTransaction: () => void;
  endTransaction: () => void;
  undo: () => void;
  redo: () => void;
  /** Replace the present without touching history — used during hydration. */
  replaceAll: (next: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

function capPast<T>(past: T[]): T[] {
  return past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past;
}

export function useUndoableDoc<T>(initial: T): UndoableHandle<T> {
  const [history, setHistory] = useState<History<T>>({
    past: [],
    present: initial,
    future: [],
    txDepth: 0,
    txPushed: false,
  });

  const set = useCallback((updater: Updater<T>) => {
    setHistory((h) => {
      const next = typeof updater === "function" ? (updater as (prev: T) => T)(h.present) : updater;
      if (Object.is(next, h.present)) return h;
      const inTx = h.txDepth > 0;
      if (inTx && h.txPushed) {
        // Subsequent in-tx set — update present only.
        return { ...h, present: next, future: [] };
      }
      // First in-tx set OR non-tx set — push pre-state to past, advance present.
      // Flip txPushed so subsequent in-tx sets skip the push.
      return {
        past: capPast([...h.past, h.present]),
        present: next,
        future: [],
        txDepth: h.txDepth,
        txPushed: inTx ? true : h.txPushed,
      };
    });
  }, []);

  const beginTransaction = useCallback(() => {
    setHistory((h) => ({
      ...h,
      txDepth: h.txDepth + 1,
      // Reset pushed marker when opening a fresh (outer) transaction.
      txPushed: h.txDepth === 0 ? false : h.txPushed,
    }));
  }, []);

  const endTransaction = useCallback(() => {
    setHistory((h) => {
      if (h.txDepth <= 0) return h;
      const newDepth = h.txDepth - 1;
      return {
        ...h,
        txDepth: newDepth,
        txPushed: newDepth === 0 ? false : h.txPushed,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.past.length) return h;
      const newPresent = h.past[h.past.length - 1];
      return {
        ...h,
        past: h.past.slice(0, -1),
        present: newPresent,
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.future.length) return h;
      const [next, ...rest] = h.future;
      return {
        ...h,
        past: [...h.past, h.present],
        present: next,
        future: rest,
      };
    });
  }, []);

  const replaceAll = useCallback((next: T) => {
    setHistory({
      past: [],
      present: next,
      future: [],
      txDepth: 0,
      txPushed: false,
    });
  }, []);

  return {
    doc: history.present,
    set,
    beginTransaction,
    endTransaction,
    undo,
    redo,
    replaceAll,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
