import { ErrorBoundary } from "@/components/global/ErrorBoundary";
import "@/styles/mail-mockup.css";

export default function MailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
