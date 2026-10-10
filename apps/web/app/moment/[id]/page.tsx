import { Suspense } from "react";
import { Loading } from "@/components/LiveBits";
import { MomentView } from "./MomentView";

export default function MomentPage() {
  return (
    <Suspense fallback={<main className="scr no-nav"><Loading label="Loading moment…" /></main>}>
      <MomentView />
    </Suspense>
  );
}
