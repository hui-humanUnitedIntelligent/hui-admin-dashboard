// frontend/src/components/ui/ConfirmModal.tsx
'use client';

import Modal from './Modal';
import Button from './Button';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger' | 'ghost';
  loading?: boolean;
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Bestätigen',
  confirmVariant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={380}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Wird ausgeführt…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        {message}
      </p>
    </Modal>
  );
}
