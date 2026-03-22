import styles from '@/styles/pages/TicketList.module.scss';

interface TicketDetailSidePanelProps {
  selectedTicketId: string | null;
  onClose: () => void;
}

export function TicketDetailSidePanel({
  selectedTicketId,
  onClose,
}: TicketDetailSidePanelProps) {
  if (!selectedTicketId) {
    return null;
  }

  return (
    <div className={styles.sidePanelOverlay} onClick={onClose}>
      <div
        className={styles.sidePanel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-side-panel-title"
      >
        <div className={styles.sidePanelHeader}>
          <h2 id="ticket-side-panel-title">Ticket #{selectedTicketId}</h2>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.sidePanelContent}>
          <p>TicketDetailContent component - planned for future release</p>
          <p>Ticket ID: {selectedTicketId}</p>
        </div>
      </div>
    </div>
  );
}
