"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface UseAsyncActionOptions {
  /** Timeout before auto-error. Défaut: 10 000 ms */
  timeoutMs?: number;
  /** Délai avant retour à idle après succès. Défaut: 1 200 ms */
  softSuccessMs?: number;
}

export interface UseAsyncActionResult<T> {
  execute:  (...args: unknown[]) => Promise<T | null>;
  status:   AsyncStatus;
  error:    string | null;
  reset:    () => void;
  isIdle:    boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isError:   boolean;
}

/**
 * useAsyncAction — socle de tout état async dans Belo.
 *
 * Protections obligatoires implémentées :
 * 1. Double click bloqué : status === "loading" → execute() no-op
 * 2. Timeout 10 s → état error automatique
 * 3. try/finally pour cleanup des timers
 * 4. mounted.current → pas de setState après unmount
 * 5. safeTimeout helper avec cleanup automatique
 * 6. Soft success : reset idle après softSuccessMs (défaut 1 200 ms)
 * 7. useEffect cleanup complet sur unmount
 */
export function useAsyncAction<T>(
  fn:      (...args: unknown[]) => Promise<T>,
  options: UseAsyncActionOptions = {},
): UseAsyncActionResult<T> {
  const { timeoutMs = 10_000, softSuccessMs = 1_200 } = options;

  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error,  setError]  = useState<string | null>(null);

  // Protection unmount — jamais de setState sur composant démonté
  const mounted     = useRef(true);
  // Tracker les timers pour cleanup propre
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Cleanup tous les timers en suspens
      timeoutsRef.current.forEach((id) => clearTimeout(id));
      timeoutsRef.current.clear();
    };
  }, []);

  /** setTimeout avec enregistrement automatique pour cleanup. */
  const safeTimeout = useCallback(
    (callback: () => void, delay: number): ReturnType<typeof setTimeout> => {
      const id = setTimeout(() => {
        timeoutsRef.current.delete(id);
        if (mounted.current) callback();
      }, delay);
      timeoutsRef.current.add(id);
      return id;
    },
    [],
  );

  /** setState seulement si le composant est encore monté. */
  const safeSet = useCallback((update: () => void): void => {
    if (mounted.current) update();
  }, []);

  const reset = useCallback(() => {
    safeSet(() => { setStatus("idle"); setError(null); });
  }, [safeSet]);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      // Protection double-click
      if (status === "loading") return null;

      safeSet(() => { setStatus("loading"); setError(null); });

      // Race entre la fonction et le timeout
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = safeTimeout(
          () => reject(new Error("TIMEOUT")),
          timeoutMs,
        );
      });

      try {
        const result = await Promise.race([fn(...args), timeoutPromise]);

        // Cleanup du timer de timeout
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutsRef.current.delete(timeoutId);
        }

        safeSet(() => setStatus("success"));

        // Soft success — reset automatique vers idle après softSuccessMs
        safeTimeout(() => {
          setStatus((prev) => (prev === "success" ? "idle" : prev));
        }, softSuccessMs);

        return result;
      } catch (err) {
        // Cleanup du timer de timeout
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutsRef.current.delete(timeoutId);
        }

        const message =
          err instanceof Error
            ? err.message === "TIMEOUT"
              ? "Délai dépassé. Réessayez."
              : err.message
            : "Une erreur inattendue s'est produite.";

        safeSet(() => { setStatus("error"); setError(message); });
        return null;
      }
    },
    // fn est stable si l'appelant le mémoïse (useCallback)
    // status inclus pour bloquer les doubles clics
    [fn, status, timeoutMs, softSuccessMs, safeSet, safeTimeout],
  );

  return {
    execute,
    status,
    error,
    reset,
    isIdle:    status === "idle",
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError:   status === "error",
  };
}
