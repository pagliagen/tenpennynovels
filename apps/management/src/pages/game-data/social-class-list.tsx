import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useConfirm } from '@/hooks/useConfirm';
import {
  useSocialClasses,
  useCreateSocialClass,
  useUpdateSocialClass,
  useDeleteSocialClass
} from '@/hooks/api/useSocialClasses';
import { useNotificationStore } from '@/store/notificationStore';
import type { SocialClass, CreateSocialClassData } from '@/types/api/SocialClass';
import styles from '@/styles/pages/SocialClassList.module.scss';

const EMPTY_FORM: CreateSocialClassData = {
  name: '',
  label: '',
  minFinanceSkill: 1,
  maxFinanceSkill: 99,
  weeklyCredit: 0,
  initialWealth: {
    minCash: 0,
    maxCash: 0,
    hasPrivateApartment: false,
    apartmentType: '',
    bonusItems: []
  },
  displayOrder: 0,
  description: ''
};

export default function SocialClassListPage() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('displayOrder');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSocialClassData>({ ...EMPTY_FORM });

  const { data, isLoading } = useSocialClasses({ search, sortBy, sortOrder });
  const createMutation = useCreateSocialClass();
  const updateMutation = useUpdateSocialClass();
  const deleteMutation = useDeleteSocialClass();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(s => s.addNotification);

  const socialClasses = useMemo(() => data?.data?.socialClasses ?? [], [data]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  const sortIndicator = (col: string) => {
    if (sortBy !== col) return '';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (sc: SocialClass) => {
    setEditingId(sc._id);
    setForm({
      name: sc.name,
      label: sc.label,
      minFinanceSkill: sc.minFinanceSkill,
      maxFinanceSkill: sc.maxFinanceSkill,
      weeklyCredit: sc.weeklyCredit,
      initialWealth: {
        minCash: sc.initialWealth.minCash,
        maxCash: sc.initialWealth.maxCash,
        hasPrivateApartment: sc.initialWealth.hasPrivateApartment,
        apartmentType: sc.initialWealth.apartmentType || '',
        bonusItems: sc.initialWealth.bonusItems || []
      },
      displayOrder: sc.displayOrder,
      description: sc.description || ''
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const setField = <K extends keyof CreateSocialClassData>(key: K, value: CreateSocialClassData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const setWealth = <K extends keyof CreateSocialClassData['initialWealth']>(
    key: K,
    value: CreateSocialClassData['initialWealth'][K]
  ) => {
    setForm(prev => ({
      ...prev,
      initialWealth: { ...prev.initialWealth, [key]: value }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: form });
        addNotification({ type: 'success', message: 'Classe sociale aggiornata' });
      } else {
        await createMutation.mutateAsync(form);
        addNotification({ type: 'success', message: 'Classe sociale creata' });
      }
      closeModal();
    } catch (err) {
      addNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore nel salvataggio'
      });
    }
  };

  const handleDelete = async (sc: SocialClass) => {
    const used = sc.usage?.characterCount ?? 0;
    const confirmed = await confirm({
      title: 'Conferma Eliminazione',
      message: used > 0
        ? `Questa classe è usata da ${used} personaggi. Vuoi eliminarla comunque?`
        : `Sei sicuro di voler eliminare "${sc.label}"?`
    });
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync({
        id: sc._id,
        reason: 'Eliminazione da pannello admin',
        forceDelete: used > 0
      });
      addNotification({ type: 'success', message: 'Classe sociale eliminata' });
    } catch (err) {
      addNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore nell\'eliminazione'
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Gestione Classi Sociali</title>
      </Head>

      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1>Gestione Classi Sociali</h1>
            <p>Configura le classi sociali disponibili nel gioco</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.createButton} onClick={openCreate}>
              + Nuova Classe
            </button>
          </div>
        </header>

        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Cerca per nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className={styles.loading}>Caricamento...</div>
        ) : socialClasses.length === 0 ? (
          <div className={styles.emptyState}>
            {search ? 'Nessun risultato trovato.' : 'Nessuna classe sociale configurata.'}
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.sortable} onClick={() => handleSort('label')}>
                    Label{sortIndicator('label')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleSort('name')}>
                    Nome{sortIndicator('name')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleSort('minFinanceSkill')}>
                    Finanza Min{sortIndicator('minFinanceSkill')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleSort('maxFinanceSkill')}>
                    Finanza Max{sortIndicator('maxFinanceSkill')}
                  </th>
                  <th className={styles.sortable} onClick={() => handleSort('weeklyCredit')}>
                    Credito Sett.{sortIndicator('weeklyCredit')}
                  </th>
                  <th>Appartamento</th>
                  <th className={styles.sortable} onClick={() => handleSort('displayOrder')}>
                    Ordine{sortIndicator('displayOrder')}
                  </th>
                  <th style={{ textAlign: 'right' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {socialClasses.map(sc => (
                  <tr key={sc._id}>
                    <td className={styles.labelCell}>{sc.label}</td>
                    <td>{sc.name}</td>
                    <td>{sc.minFinanceSkill}</td>
                    <td>{sc.maxFinanceSkill}</td>
                    <td>{sc.weeklyCredit}</td>
                    <td>
                      <span className={`${styles.boolBadge} ${sc.initialWealth.hasPrivateApartment ? styles.yes : styles.no}`}>
                        {sc.initialWealth.hasPrivateApartment ? 'Sì' : 'No'}
                      </span>
                    </td>
                    <td>{sc.displayOrder}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => openEdit(sc)} title="Modifica">✏️</button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(sc)} title="Elimina">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modalOpen && (
          <div className={styles.modal}>
            <div className={styles.overlay} onClick={closeModal} />
            <div className={styles.modalContent}>
              <h2>{editingId ? 'Modifica Classe Sociale' : 'Nuova Classe Sociale'}</h2>
              <form onSubmit={handleSubmit}>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label>Nome</label>
                    <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} required />
                  </div>
                  <div className={styles.formField}>
                    <label>Label</label>
                    <input type="text" value={form.label} onChange={e => setField('label', e.target.value)} required />
                  </div>
                  <div className={styles.formField}>
                    <label>Finanza Min</label>
                    <input type="number" min={1} max={99} value={form.minFinanceSkill} onChange={e => setField('minFinanceSkill', +e.target.value)} required />
                  </div>
                  <div className={styles.formField}>
                    <label>Finanza Max</label>
                    <input type="number" min={1} max={99} value={form.maxFinanceSkill} onChange={e => setField('maxFinanceSkill', +e.target.value)} required />
                  </div>
                  <div className={styles.formField}>
                    <label>Credito Settimanale</label>
                    <input type="number" min={0} value={form.weeklyCredit} onChange={e => setField('weeklyCredit', +e.target.value)} required />
                  </div>
                  <div className={styles.formField}>
                    <label>Ordine</label>
                    <input type="number" value={form.displayOrder} onChange={e => setField('displayOrder', +e.target.value)} required />
                  </div>
                  <div className={`${styles.formField} ${styles.fullWidth}`}>
                    <label>Descrizione</label>
                    <textarea value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Descrizione opzionale..." />
                  </div>

                  <h3 className={styles.sectionTitle}>Ricchezza Iniziale</h3>
                  <div className={styles.formField}>
                    <label>Cash Minimo</label>
                    <input type="number" min={0} value={form.initialWealth.minCash} onChange={e => setWealth('minCash', +e.target.value)} />
                  </div>
                  <div className={styles.formField}>
                    <label>Cash Massimo</label>
                    <input type="number" min={0} value={form.initialWealth.maxCash} onChange={e => setWealth('maxCash', +e.target.value)} />
                  </div>
                  <div className={`${styles.formField} ${styles.checkboxField}`}>
                    <input
                      type="checkbox"
                      id="hasApartment"
                      checked={form.initialWealth.hasPrivateApartment}
                      onChange={e => setWealth('hasPrivateApartment', e.target.checked)}
                    />
                    <label htmlFor="hasApartment">Appartamento Privato</label>
                  </div>
                  {form.initialWealth.hasPrivateApartment && (
                    <div className={styles.formField}>
                      <label>Tipo Appartamento</label>
                      <input
                        type="text"
                        value={form.initialWealth.apartmentType || ''}
                        onChange={e => setWealth('apartmentType', e.target.value)}
                        placeholder="es. modest, comfortable..."
                      />
                    </div>
                  )}
                </div>

                <div className={styles.formActions}>
                  <button type="button" className={styles.cancelBtn} onClick={closeModal}>Annulla</button>
                  <button type="submit" className={styles.submitBtn} disabled={isSaving}>
                    {isSaving ? 'Salvataggio...' : editingId ? 'Salva Modifiche' : 'Crea Classe'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
