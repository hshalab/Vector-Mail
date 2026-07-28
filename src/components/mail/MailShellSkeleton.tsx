import { Skel, SkeletonRows } from "@/components/ui/skeletons";
export function MailShellSkeleton() {
  return (
    <div
      className="flex h-dvh min-h-dvh w-full overflow-hidden bg-[#f6f8fc]"
      role="status"
      aria-busy="true"
      aria-label="Loading your inbox"
    >
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-[#e9ebf0] bg-white px-3 py-4 md:flex">
        <div className="flex items-center gap-2 px-2 pb-4">
          <Skel className="h-6 w-6 rounded-md" />
          <Skel className="h-3.5 w-24 rounded" delay={40} />
        </div>

        <Skel tone="strong" className="h-9 w-full rounded-xl" delay={60} />

        <div className="mt-6 flex flex-col gap-1 px-1">
          <Skel className="mb-2 ml-1 h-2 w-16 rounded-sm" delay={80} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Skel className="h-4 w-4 rounded" delay={100 + i * 40} />
              <Skel
                className="h-3 rounded"
                style={{ width: `${38 + i * 12}%` }}
                delay={110 + i * 40}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-1 px-1">
          <Skel className="mb-2 ml-1 h-2 w-24 rounded-sm" delay={260} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Skel className="h-4 w-4 rounded" delay={280 + i * 40} />
              <Skel
                className="h-3 rounded"
                style={{ width: `${44 + ((i * 13) % 34)}%` }}
                delay={290 + i * 40}
              />
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <Skel className="h-9 flex-1 rounded-xl" />
          <Skel className="h-9 w-9 shrink-0 rounded-lg" delay={40} />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-white">
          <SkeletonRows
            rows={10}
            avatar
            avatarClassName="h-10 w-10 rounded-lg"
            rowClassName="border-b border-[#eef0f4] px-5 py-4"
          />
        </div>
      </div>
    </div>
  );
}
