import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Fournit une boîte de confirmation asynchrone : `if (await confirm({...})) { ... }`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((opts) => {
    resolver.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => close(false)}
        size="sm"
        title={options?.title ?? ''}
        description={options?.message}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {options?.cancelLabel ?? 'Annuler'}
            </Button>
            <Button variant={options?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {options?.confirmLabel ?? 'Confirmer'}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm doit être utilisé dans ConfirmProvider');
  return ctx;
}
