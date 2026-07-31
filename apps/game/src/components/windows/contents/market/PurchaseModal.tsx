/**
 * PurchaseModal — confirmation dialog for buying a Mercato item.
 *
 * Uses the shared Modal component (not a hand-rolled overlay like
 * CreateTicketModal — that inconsistency isn't repeated here).
 */

import React, { useState } from 'react';

import { Modal } from '@/components/shared/Modal';
import type { MarketItem, PaymentMethod } from '@/types/economy';

import styles from '@/styles/components/windows/market/Market.module.scss';

interface PurchaseModalProps {
  item: MarketItem;
  isPending: boolean;
  onConfirm: (paymentMethod: PaymentMethod) => void;
  onClose: () => void;
}

export function PurchaseModal({ item, isPending, onConfirm, onClose }: PurchaseModalProps): React.ReactElement {
  const availableMethods: PaymentMethod[] = [
    ...(item.canPurchaseWithCash ? (['cash'] as const) : []),
    ...(item.canPurchaseWithCredit ? (['credit'] as const) : []),
  ];

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(availableMethods[0] ?? null);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Acquista: ${item.name}`}
      size="small"
      footer={
        <>
          <button className={styles.secondaryButton} onClick={onClose} disabled={isPending}>
            Annulla
          </button>
          <button
            className={styles.primaryButton}
            onClick={() => paymentMethod && onConfirm(paymentMethod)}
            disabled={!paymentMethod || isPending}
          >
            {isPending ? 'Acquisto in corso…' : 'Conferma acquisto'}
          </button>
        </>
      }
    >
      <p className={styles.modalDescription}>{item.description}</p>
      <p className={styles.modalPrice}>Prezzo: {item.priceFormatted}</p>

      {availableMethods.length === 0 ? (
        <p className={styles.modalWarning}>Fondi insufficienti per acquistare questo oggetto.</p>
      ) : (
        <div className={styles.paymentOptions}>
          {availableMethods.map((method) => (
            <label key={method} className={styles.paymentOption}>
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === method}
                onChange={() => setPaymentMethod(method)}
              />
              {method === 'cash' ? 'Contanti / Deposito bancario' : 'Credito settimanale'}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
