import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccessConfirmationProps {
  direction: 'entry' | 'exit';
  onConfirm: () => void;
  disabled?: boolean;
}

export function AccessConfirmation({ direction, onConfirm, disabled }: AccessConfirmationProps) {
  const isEntry = direction === 'entry';

  return (
    <Button
      onClick={onConfirm}
      disabled={disabled}
      className={`w-full h-16 text-lg font-bold gap-3 ${
        isEntry
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-red-600 hover:bg-red-700 text-white'
      }`}
    >
      {isEntry ? <LogIn className="h-6 w-6" /> : <LogOut className="h-6 w-6" />}
      {isEntry ? 'CONFIRMAR ENTRADA' : 'CONFIRMAR SAÍDA'}
    </Button>
  );
}
