"use client";

import { useAppData, storageFailed } from "@/lib/store";

/**
 * Shown when localStorage stopped accepting writes, almost always a full quota.
 * The app keeps working from memory, which is exactly why this needs saying out
 * loud: sets look logged, and then a reload throws the workout away. Reads on
 * every render of the page it sits on, riding useAppData's re-render so it
 * appears on the first failed save rather than the next reload.
 */
export default function StorageWarning() {
  const data = useAppData();
  if (!data || !storageFailed()) return null;

  return (
    <div className="mb-3 rounded-xl border border-warn/40 bg-warn/10 p-4">
      <span className="display mb-2 block text-sm font-bold uppercase tracking-wide text-warn">
        Not saving on this device
      </span>
      <p className="text-xs text-muted">
        This device&apos;s storage is full, so today&apos;s sets only exist until you close the app.
        Export your data now, then free up space in your browser settings. If cloud sync is signed
        in, your history is already safe there.
      </p>
    </div>
  );
}
