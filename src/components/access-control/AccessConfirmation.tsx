import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccessConfirmationProps {
  onConfirm: (direction: 'entry' | 'exit') => void;
  disabled?: boolean;
}

export function AccessConfirmation({ onConfirm, disabled }: AccessConfirmationProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        onClick={() => onConfirm('entry')}
        disabled={disabled}
        className="h-14 text-base font-bold gap-2 bg-green-600 hover:bg-green-700 text-white"
      >
        <LogIn className="h-5 w-5" />
        ENTRADA
      </Button>
      <Button
        onClick={() => onConfirm('exit')}
        disabled={disabled}
        className="h-14 text-base font-bold gap-2 bg-purple-700 hover:bg-purple-800 text-white"
      >
        <LogOut className="h-5 w-5" />
        SAÍDA
      </Button>
    </div>
  );
}
