

## Fix: Remove duplicate return block in WorkerManagement.tsx

### Problem
Lines 989–1139 contain an old, duplicate `return (...)` block that sits **outside** the component function (which already closes at line 988). This orphaned code causes `TS1128: Declaration or statement expected`.

### Fix
**File: `src/components/workers/WorkerManagement.tsx`**
- Delete lines 989–1139 entirely. The component already has its complete return statement ending at line 988.

### Result
Build error resolved. No functional change — the deleted code was unreachable dead code.

