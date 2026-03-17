'use client';

import { useState, useEffect } from 'react';
import { fakePngApi } from '@/lib/api/fakePng';
import { FakePngSlot } from './FakePngSlot';
import { FakePngForm } from './FakePngForm';
import type { FakePng } from '@/types/fakePng';
import styles from '@/styles/components/fake-png/FakePngManager.module.scss';

interface FakePngManagerProps {
  characterId: string;
  onClose: () => void;
}

const MAX_SLOTS = 5;

export function FakePngManager({ characterId, onClose }: FakePngManagerProps) {
  const [fakePngs, setFakePngs] = useState<FakePng[]>([]);
  const [activeFakePngId, setActiveFakePngId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingFake, setEditingFake] = useState<FakePng | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadFakePngs();
  }, [characterId]);

  const loadFakePngs = async () => {
    try {
      setLoading(true);
      const data = await fakePngApi.list(characterId);
      setFakePngs(data.fakePngs);
      setActiveFakePngId(data.activeFakePngId);
    } catch (error) {
      console.error('Failed to load fake PNGs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: { name: string; surname?: string; avatar?: string }) => {
    try {
      await fakePngApi.create(characterId, data);
      await loadFakePngs();
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create fake PNG:', error);
      alert('Errore durante la creazione');
    }
  };

  const handleUpdate = async (fakeId: string, data: { name?: string; surname?: string; avatar?: string }) => {
    try {
      await fakePngApi.update(characterId, fakeId, data);
      await loadFakePngs();
      setEditingFake(null);
    } catch (error) {
      console.error('Failed to update fake PNG:', error);
      alert('Errore durante l\'aggiornamento');
    }
  };

  const handleDelete = async (fakeId: string) => {
    if (!confirm('Eliminare questo PNG Light?')) return;

    try {
      await fakePngApi.delete(characterId, fakeId);
      await loadFakePngs();
    } catch (error) {
      console.error('Failed to delete fake PNG:', error);
      alert('Errore durante l\'eliminazione');
    }
  };

  const handleActivate = async (fakeId: string) => {
    try {
      await fakePngApi.activate(characterId, fakeId);
      setActiveFakePngId(fakeId);
    } catch (error) {
      console.error('Failed to activate fake PNG:', error);
      alert('Errore durante l\'attivazione');
    }
  };

  const handleDeactivate = async () => {
    try {
      await fakePngApi.deactivate(characterId);
      setActiveFakePngId(null);
    } catch (error) {
      console.error('Failed to deactivate fake PNG:', error);
      alert('Errore durante la disattivazione');
    }
  };

  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => fakePngs[i] || null);

  if (loading) {
    return (
      <div className={styles.modal}>
        <div className={styles.modalContent}>Caricamento...</div>
      </div>
    );
  }

  if (isCreating || editingFake) {
    return (
      <div className={styles.modal}>
        <div className={styles.modalContent}>
          <h2>{isCreating ? 'Crea PNG Light' : 'Modifica PNG Light'}</h2>
          <FakePngForm
            characterId={characterId}
            initialData={editingFake || undefined}
            onSubmit={(data) => {
              if (editingFake) {
                handleUpdate(editingFake._id, data);
              } else {
                handleCreate(data);
              }
            }}
            onCancel={() => {
              setIsCreating(false);
              setEditingFake(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>PNG Light ({fakePngs.length}/{MAX_SLOTS})</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        {activeFakePngId && (
          <div className={styles.activeIndicator}>
            <span>✓ PNG Light attivo</span>
            <button className={styles.deactivateButton} onClick={handleDeactivate}>
              Disattiva (torna reale)
            </button>
          </div>
        )}

        <div className={styles.slotsGrid}>
          {slots.map((fake, index) => (
            <FakePngSlot
              key={fake?._id || `empty-${index}`}
              fake={fake}
              isActive={fake?._id === activeFakePngId}
              onActivate={() => fake && handleActivate(fake._id)}
              onEdit={() => fake && setEditingFake(fake)}
              onDelete={() => fake && handleDelete(fake._id)}
              onCreate={() => setIsCreating(true)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
