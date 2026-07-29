/**
 * PNG Picker Modal
 *
 * Single popup for creating/selecting a PNG a character posts as. Same
 * underlying flow either way (slot grid, activate/select, edit, delete) —
 * only the scope differs:
 * - "del personaggio": tied to the character, activated/deactivated
 *   server-side (persists across messages, any character with the
 *   game:chat:use-fake-png permission).
 * - "della location": shared, visible to everyone in the location, chosen
 *   per composition via `selectedLocationPngId` (master only).
 *
 * Both tabs are shown unconditionally to whoever can open the popup at all
 * (permission-based, known client-side) — never hidden based on whether a
 * background fetch succeeded. A failed/denied fetch shows an inline message
 * inside that tab instead of making the tab disappear.
 *
 * @module components/png-picker/PngPickerModal
 * @since 2.2.0
 */

'use client';

import { useEffect, useState } from 'react';

import { fakePngApi } from '@/lib/api/fakePng';
import { locationPngApi } from '@/lib/api/locationPng';
import styles from '@/styles/components/fake-png/FakePngManager.module.scss';
import type { FakePng } from '@/types/fakePng';
import type { LocationPng } from '@/types/locationPng';

import { FakePngForm } from '../fake-png/FakePngForm';
import { FakePngSlot } from '../fake-png/FakePngSlot';
import { LocationPngForm } from '../location-png/LocationPngForm';
import { logger } from '@/lib/logger';

interface PngPickerModalProps {
  characterId: string;
  locationId: string;

  /** Show the "del personaggio" tab (game:chat:use-fake-png permission) */
  showFakeSection: boolean;

  /** Show the "della location" tab (master only — client-known, not probed) */
  showLocationSection: boolean;

  /** Currently selected location PNG for this composition ('' = io stesso) */
  selectedLocationPngId: string;
  onSelectLocationPng: (id: string) => void;

  onClose: () => void;

  /** Called when either list (or the active/selected state) changes, so the caller can refetch */
  onFakePngChanged?: () => void;
  onLocationPngChanged?: () => void;
}

const MAX_FAKE_SLOTS = 4;
const MAX_LOCATION_PNGS = 20;

type ViewMode = 'list' | 'creating-fake' | 'editing-fake' | 'creating-location';

export function PngPickerModal({
  characterId,
  locationId,
  showFakeSection,
  showLocationSection,
  selectedLocationPngId,
  onSelectLocationPng,
  onClose,
  onFakePngChanged,
  onLocationPngChanged,
}: PngPickerModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingFake, setEditingFake] = useState<FakePng | null>(null);
  const [activeTab, setActiveTab] = useState<'fake' | 'location'>(showFakeSection ? 'fake' : 'location');
  const showTabs = showFakeSection && showLocationSection;

  const [fakePngs, setFakePngs] = useState<FakePng[]>([]);
  const [activeFakePngId, setActiveFakePngId] = useState<string | null>(null);
  const [loadingFake, setLoadingFake] = useState(showFakeSection);
  const [fakeLoadError, setFakeLoadError] = useState(false);

  const [locationPngs, setLocationPngs] = useState<LocationPng[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(showLocationSection);
  const [locationLoadError, setLocationLoadError] = useState(false);

  useEffect(() => {
    if (showFakeSection) loadFakePngs();
    if (showLocationSection) loadLocationPngs();
  }, [characterId, locationId, showFakeSection, showLocationSection]);

  const loadFakePngs = async () => {
    try {
      setLoadingFake(true);
      setFakeLoadError(false);
      const data = await fakePngApi.list(characterId);
      setFakePngs(data.fakePngs);
      setActiveFakePngId(data.activeFakePngId);
    } catch (error) {
      logger.error('Failed to load fake PNGs:', { error });
      setFakeLoadError(true);
    } finally {
      setLoadingFake(false);
    }
  };

  const loadLocationPngs = async () => {
    try {
      setLoadingLocation(true);
      setLocationLoadError(false);
      const data = await locationPngApi.list(locationId);
      setLocationPngs(data.locationPngs);
    } catch (error) {
      logger.error('Failed to load location PNGs:', { error });
      setLocationLoadError(true);
    } finally {
      setLoadingLocation(false);
    }
  };

  // --- Fake PNG (PNG Light) ---

  const handleCreateFake = async (data: { name: string; surname?: string; avatar?: string }) => {
    try {
      await fakePngApi.create(characterId, data);
      await loadFakePngs();
      setViewMode('list');
      onFakePngChanged?.();
    } catch (error) {
      logger.error('Failed to create fake PNG:', { error });
      alert('Errore durante la creazione');
    }
  };

  const handleUpdateFake = async (fakeId: string, data: { name?: string; surname?: string; avatar?: string }) => {
    try {
      await fakePngApi.update(characterId, fakeId, data);
      await loadFakePngs();
      setEditingFake(null);
      setViewMode('list');
      onFakePngChanged?.();
    } catch (error) {
      logger.error('Failed to update fake PNG:', { error });
      alert('Errore durante l\'aggiornamento');
    }
  };

  const handleDeleteFake = async (fakeId: string) => {
    if (!confirm('Eliminare questo PNG del personaggio?')) return;

    try {
      await fakePngApi.delete(characterId, fakeId);
      await loadFakePngs();
      onFakePngChanged?.();
    } catch (error) {
      logger.error('Failed to delete fake PNG:', { error });
      alert('Errore durante l\'eliminazione');
    }
  };

  const handleActivateFake = async (fakeId: string) => {
    try {
      await fakePngApi.activate(characterId, fakeId);
      setActiveFakePngId(fakeId);
      onFakePngChanged?.();
    } catch (error) {
      logger.error('Failed to activate fake PNG:', { error });
      alert('Errore durante l\'attivazione');
    }
  };

  const handleDeactivateFake = async () => {
    try {
      await fakePngApi.deactivate(characterId);
      setActiveFakePngId(null);
      onFakePngChanged?.();
    } catch (error) {
      logger.error('Failed to deactivate fake PNG:', { error });
      alert('Errore durante la disattivazione');
    }
  };

  // --- Location PNG ---

  const handleCreateLocationPng = async (data: { name: string; surname?: string; avatar?: string }) => {
    try {
      await locationPngApi.create(locationId, data);
      await loadLocationPngs();
      setViewMode('list');
      onLocationPngChanged?.();
    } catch (error) {
      logger.error('Failed to create location PNG:', { error });
      alert('Errore durante la creazione');
    }
  };

  const handleDeleteLocationPng = async (pngId: string) => {
    if (!confirm('Eliminare questo PNG della location?')) return;

    try {
      await locationPngApi.delete(locationId, pngId);
      await loadLocationPngs();
      if (selectedLocationPngId === pngId) onSelectLocationPng('');
      onLocationPngChanged?.();
    } catch (error) {
      logger.error('Failed to delete location PNG:', { error });
      alert('Errore durante l\'eliminazione');
    }
  };

  // --- Form views (replace the whole modal content, same pattern as before the merge) ---

  if (viewMode === 'creating-fake' || viewMode === 'editing-fake') {
    return (
      <div className={styles.modal} onClick={onClose}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <h2>{viewMode === 'creating-fake' ? 'Crea PNG del personaggio' : 'Modifica PNG del personaggio'}</h2>
          <FakePngForm
            characterId={characterId}
            initialData={editingFake || undefined}
            onSubmit={(data) => {
              if (editingFake) {
                handleUpdateFake(editingFake._id, data);
              } else {
                handleCreateFake(data);
              }
            }}
            onCancel={() => {
              setEditingFake(null);
              setViewMode('list');
            }}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'creating-location') {
    return (
      <div className={styles.modal} onClick={onClose}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <h2>Crea PNG della location</h2>
          <LocationPngForm
            locationId={locationId}
            onSubmit={handleCreateLocationPng}
            onCancel={() => setViewMode('list')}
          />
        </div>
      </div>
    );
  }

  // --- Unified list view ---

  const fakeSlots = Array.from({ length: MAX_FAKE_SLOTS }, (_, i) => fakePngs[i] || null);

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>PNG</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        {showTabs && (
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'fake' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('fake')}
            >
              Personaggio {!loadingFake && `(${fakePngs.length}/${MAX_FAKE_SLOTS})`}
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'location' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('location')}
            >
              Location {!loadingLocation && `(${locationPngs.length}/${MAX_LOCATION_PNGS})`}
            </button>
          </div>
        )}

        {showFakeSection && (!showTabs || activeTab === 'fake') && (
          <section>
            {!showTabs && (
              <h3 className={styles.sectionTitle}>
                PNG ad uso e consumo del personaggio {!loadingFake && `(${fakePngs.length}/${MAX_FAKE_SLOTS})`}
              </h3>
            )}

            {activeFakePngId && (
              <div className={styles.activeIndicator}>
                <span>✓ PNG del personaggio attivo</span>
                <button className={styles.deactivateButton} onClick={handleDeactivateFake}>
                  Disattiva (torna reale)
                </button>
              </div>
            )}

            {loadingFake ? (
              <p>Caricamento...</p>
            ) : fakeLoadError ? (
              <p className={styles.sectionDescription}>
                Non riesco a caricare i PNG del personaggio. Riprova più tardi o segnalalo se persiste.
              </p>
            ) : (
              <div className={styles.slotsGrid}>
                {fakeSlots.map((fake, index) => (
                  <FakePngSlot
                    key={fake?._id || `empty-${index}`}
                    fake={fake}
                    isActive={fake?._id === activeFakePngId}
                    onActivate={() => fake && handleActivateFake(fake._id)}
                    onEdit={() => {
                      if (!fake) return;
                      setEditingFake(fake);
                      setViewMode('editing-fake');
                    }}
                    onDelete={() => fake && handleDeleteFake(fake._id)}
                    onCreate={() => setViewMode('creating-fake')}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {showLocationSection && (!showTabs || activeTab === 'location') && (
          <section style={{ marginTop: !showTabs && showFakeSection ? '2rem' : 0 }}>
            {!showTabs && (
              <h3 className={styles.sectionTitle}>
                PNG della location {!loadingLocation && `(${locationPngs.length}/${MAX_LOCATION_PNGS})`}
              </h3>
            )}
            <p className={styles.sectionDescription}>
              Personaggi rapidi (es. &quot;il barista&quot;) usabili per postare al posto del tuo
              nome/avatar in questa location. Visibili e modificabili solo da master e proprietario.
            </p>

            {selectedLocationPngId && (
              <div className={styles.activeIndicator}>
                <span>✓ PNG di location selezionato</span>
                <button className={styles.deactivateButton} onClick={() => onSelectLocationPng('')}>
                  Torna a te stesso
                </button>
              </div>
            )}

            {loadingLocation ? (
              <p>Caricamento...</p>
            ) : locationLoadError ? (
              <p className={styles.sectionDescription}>
                Non riesci a gestire i PNG di questa location (serve essere master o proprietario),
                oppure si è verificato un errore. Segnalalo se pensi sia un errore.
              </p>
            ) : (
              <div className={styles.slotsGrid}>
                {locationPngs.map((png) => {
                  const isSelected = png._id === selectedLocationPngId;
                  return (
                    <div key={png._id} className={`${styles.slotCard} ${isSelected ? styles.slotActive : ''}`}>
                      <div className={styles.slotAvatar}>
                        {png.avatar ? (
                          <img src={png.avatar} alt="" />
                        ) : (
                          <span className={styles.avatarPlaceholder}>{png.name[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className={styles.slotInfo}>
                        <div className={styles.slotName}>
                          {png.name}{png.surname ? ` ${png.surname}` : ''}
                        </div>
                        {isSelected && <span className={styles.activeBadge}>✓ Selezionato</span>}
                      </div>
                      <div className={styles.slotActions}>
                        {!isSelected && (
                          <button
                            className={styles.actionButton}
                            onClick={() => onSelectLocationPng(png._id)}
                            title="Usa questo PNG"
                          >
                            ▶
                          </button>
                        )}
                        <button
                          className={styles.actionButton}
                          onClick={() => handleDeleteLocationPng(png._id)}
                          title="Elimina"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}

                {locationPngs.length < MAX_LOCATION_PNGS && (
                  <button className={styles.slotEmpty} onClick={() => setViewMode('creating-location')}>
                    <span className={styles.plusIcon}>+</span>
                    <span className={styles.slotLabel}>Aggiungi PNG</span>
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
