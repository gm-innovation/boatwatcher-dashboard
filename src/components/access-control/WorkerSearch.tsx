import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { CachedWorker } from '@/hooks/useOfflineAccessControl';

interface WorkerSearchProps {
  workers: CachedWorker[];
  onSelect: (worker: CachedWorker) => void;
}

export function WorkerSearch({ workers, onSelect }: WorkerSearchProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return workers.slice(0, 50);
    const q = query.toLowerCase().trim();
    return workers.filter(w =>
      w.name.toLowerCase().includes(q) ||
      w.document_number?.toLowerCase().includes(q) ||
      String(w.code).includes(q)
    ).slice(0, 50);
  }, [workers, query]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF ou matrícula..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-10 h-12 text-base"
          autoComplete="off"
        />
      </div>
      <div className="max-h-[40vh] overflow-y-auto rounded-md border bg-card divide-y divide-border">
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">Nenhum trabalhador encontrado</p>
        )}
        {filtered.map(w => (
          <button
            key={w.id}
            onClick={() => onSelect(w)}
            className="w-full flex items-center gap-3 p-3 hover:bg-accent text-left transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
              {w.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{w.name}</p>
              <p className="text-xs text-muted-foreground">
                Mat: {w.code} {w.document_number && `• ${w.document_number}`}
              </p>
            </div>
            {w.company_name && (
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">{w.company_name}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
