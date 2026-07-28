import { Skel } from "@/components/ui/skeletons";

export function BuddyShellSkeleton() {
  return (
    <div
      className="flex h-screen w-full flex-col bg-[#0a0a0a]"
      role="status"
      aria-busy="true"
      aria-label="Loading Buddy"
    >
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <Skel tone="dark" className="h-7 w-7 rounded-lg" />
        <Skel tone="dark" className="h-4 w-32 rounded" delay={40} />
        <Skel tone="dark" className="ml-auto h-7 w-7 rounded-lg" delay={80} />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 overflow-hidden px-4 py-8">
        <div className="flex gap-3">
          <Skel tone="dark" className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skel tone="dark" className="h-3 w-[70%] rounded" delay={40} />
            <Skel tone="dark" className="h-3 w-[86%] rounded" delay={80} />
            <Skel tone="dark" className="h-3 w-[54%] rounded" delay={120} />
          </div>
        </div>

        <div className="flex justify-end">
          <Skel tone="dark" className="h-14 w-[55%] rounded-2xl" delay={160} />
        </div>

        <div className="flex gap-3">
          <Skel tone="dark" className="h-8 w-8 shrink-0 rounded-full" delay={200} />
          <div className="flex-1 space-y-2">
            <Skel tone="dark" className="h-3 w-[82%] rounded" delay={240} />
            <Skel tone="dark" className="h-3 w-[64%] rounded" delay={280} />
            <Skel tone="dark" className="h-3 w-[38%] rounded" delay={320} />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 pb-6">
        <Skel tone="dark" className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  );
}
