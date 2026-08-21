import type { ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
};

export default function Modal({ children, onClose, labelledBy }: ModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        className="panel modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </section>
    </div>
  );
}
