"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { MailShellSkeleton } from "@/components/mail/MailShellSkeleton";

type MailNavContextType = {
  navigateToMail: () => void;
  isNavigating: boolean;
};

const MailNavContext = createContext<MailNavContextType>({
  navigateToMail: () => { },
  isNavigating: false,
});

export function useMailNavigation() {
  return useContext(MailNavContext);
}

export function MailNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [, startTransition] = useTransition();
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isNavigating) return;
    if (pathname?.startsWith("/mail")) {
      setIsNavigating(false);
      clearSafetyTimer();
    }
  }, [pathname, isNavigating, clearSafetyTimer]);

  useEffect(() => {
    return () => clearSafetyTimer();
  }, [clearSafetyTimer]);

  const navigateToMail = useCallback(() => {
    if (isNavigating) return;
    if (pathname?.startsWith("/mail")) {
      router.push("/mail");
      return;
    }

    setIsNavigating(true);
    startTransition(() => {
      router.push("/mail");
    });

    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => {
      setIsNavigating(false);
    }, 15000);
  }, [router, isNavigating, pathname, clearSafetyTimer]);

  return (
    <MailNavContext.Provider value={{ navigateToMail, isNavigating }}>
      {children}
      {isNavigating && <MailNavigationOverlay />}
    </MailNavContext.Provider>
  );
}

function MailNavigationOverlay() {
  return (
    <div
      className="fixed inset-0 z-[9999]"
      role="status"
      aria-live="polite"
      aria-label="Loading your inbox"
    >
      <MailShellSkeleton />
    </div>
  );
}
