import { Delete, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onConfirm: () => void;
  onCamera?: () => void;
  disabled?: boolean;
}

export function NumericKeypad({ onDigit, onClear, onConfirm, onCamera, disabled }: NumericKeypadProps) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['clear', '0', 'camera'],
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.flat().map((key) => {
        if (key === 'clear') {
          return (
            <Button
              key={key}
              variant="outline"
              className="h-14 text-lg"
              onClick={onClear}
            >
              <Delete className="h-5 w-5" />
            </Button>
          );
        }
        if (key === 'camera') {
          return (
            <Button
              key={key}
              variant="outline"
              className="h-14 text-lg"
              onClick={onCamera}
            >
              <Camera className="h-5 w-5" />
            </Button>
          );
        }
        return (
          <Button
            key={key}
            variant="outline"
            className="h-14 text-xl font-semibold"
            onClick={() => onDigit(key)}
          >
            {key}
          </Button>
        );
      })}

      <Button
        className="col-span-3 h-14 text-lg font-semibold"
        onClick={onConfirm}
      >
        Verificar Acesso
      </Button>
    </div>
  );
}
