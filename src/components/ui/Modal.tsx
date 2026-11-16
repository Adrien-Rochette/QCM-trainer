import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { IconButton } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Fenêtre modale basée sur l'élément natif <dialog> :
 * focus piégé, fermeture avec Échap et retour du focus gérés par le navigateur.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clic sur le fond (en dehors du contenu) : fermeture.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-transparent open:animate-pop dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
        size === 'sm' && 'max-w-md',
        size === 'md' && 'max-w-lg',
        size === 'lg' && 'max-w-2xl',
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </div>
              )}
            </div>
            <IconButton label="Fermer" onClick={onClose} className="-mr-2 -mt-1">
              <X className="size-5" />
            </IconButton>
          </div>
          {children && <div className="overflow-y-auto px-6 py-4">{children}</div>}
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">{footer}</div>
          )}
          {!children && !footer && <div className="h-5" />}
        </div>
      )}
    </dialog>
  );
}
