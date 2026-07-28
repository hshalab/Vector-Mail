"use client";

import { CalendarPlus } from "lucide-react";

interface CalendarConnectButtonProps {
  className?: string;
}

export function CalendarConnectButton({ className }: CalendarConnectButtonProps) {
  return (
    <a href="/api/connect/calendar" className={className}>
      <CalendarPlus className="h-4 w-4" />
      <span>Connect Calendar</span>
    </a>
  );
}
