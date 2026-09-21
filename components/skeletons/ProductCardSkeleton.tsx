export default function ProductCardSkeleton() {
  return (
    <div className="flex h-full animate-pulse flex-col">
      <div className="aspect-square rounded-2xl bg-[#F6F6F6]" />
      <div className="space-y-2 px-0.5 pt-3">
        <div className="h-3.5 w-3/4 rounded bg-[#F0F0F0]" />
        <div className="h-3.5 w-1/3 rounded bg-[#F0F0F0]" />
        <div className="h-9 rounded-full bg-[#F6F6F6]" />
      </div>
    </div>
  );
}
