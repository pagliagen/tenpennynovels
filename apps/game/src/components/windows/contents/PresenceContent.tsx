'use client';

import { useRouter } from 'next/router';
import { useCallback, useState, useMemo } from 'react';

import { useAuthStore } from '@/store/authStore';
import { usePresenceStore, type GlobalPresence } from '@/store/presenceStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import styles from '@/styles/components/windows/PresenceContent.module.scss';

// Stesso marcatore che il backend (LocationService.getGlobalPresence) assegna ai luoghi non accessibili
const PRIVATE_ROOM_NAME = 'STANZA PRIVATA';

type PresenceTab = 'all' | 'players' | 'staff';

const TABS: ReadonlyArray<{ key: PresenceTab; label: string }> = [
  { key: 'all', label: 'Tutti' },
  { key: 'players', label: 'In gioco' },
  { key: 'staff', label: 'Staff' },
];

// TODO: placeholder finché non esiste un campo di stato per personaggio
const PLACEHOLDER_STATUS = 'status presenti scritto fin qui';

/**
 * Contenuto della finestra "Presenti" (utility `presenti` del window manager).
 * Cornice, titolo e pulsanti di chiusura/minimizzazione sono dello shell `Window`.
 */
export function PresenceContent(): JSX.Element {
  const router = useRouter();
  const globalPresence = usePresenceStore((s) => s.globalPresence);
  const openWindow = useWindowManagerStore((s) => s.openWindow);
  const { selectedCharacter, hasGamePermission } = useAuthStore();
  const [tab, setTab] = useState<PresenceTab>('all');

  const filteredPresence = useMemo(() => {
    const all = globalPresence || [];
    if (tab === 'staff') return all.filter((p) => p.isStaff);
    // "In gioco" = dentro una sottochat pubblica di Londra (locationId vuoto = Londra stessa)
    if (tab === 'players') {
      return all.filter((p) => p.locationId !== '' && p.locationName !== PRIVATE_ROOM_NAME);
    }
    return all;
  }, [globalPresence, tab]);

  // Raggruppa per luogo mantenendo l'ordine di prima apparizione
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; members: GlobalPresence[] }>();
    for (const p of filteredPresence) {
      const key = p.locationId || '';
      const group = map.get(key) ?? { name: p.locationName, slug: p.locationSlug, members: [] };
      group.members.push(p);
      map.set(key, group);
    }
    return Array.from(map.entries());
  }, [filteredPresence]);

  const handleAvatarClick = useCallback((characterId: string, characterName: string, characterSurname: string | undefined, avatar: string | undefined) => {
    const isOwnDraftCharacter =
      characterId === selectedCharacter?._id &&
      selectedCharacter?.playerStatus === 'draft' &&
      hasGamePermission('game:character:wizard');

    if (isOwnDraftCharacter) {
      router.push('/character/wizard');
      return;
    }

    const fullName = characterSurname ? `${characterName} ${characterSurname}` : characterName;
    openWindow('characterSheet', {
      characterId,
      characterName: fullName,
      avatar,
    });
  }, [openWindow, selectedCharacter, hasGamePermission, router]);

  const handleLocationClick = (locationSlug: string, _locationName: string) => {
    if (!locationSlug) {
      // London (no specific location chat)
      return;
    }
    // Navigate to location chat: /locations/{slug}/chat
    router.push(`/locations/${locationSlug}/chat`);
  };

  return (
    <div className={styles.root}>
      <div className={styles.tabs} role="tablist" aria-label="Filtra presenti">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.divider} aria-hidden="true">
        <span className={styles.dividerLine} />
        {/* TODO: sostituire con l'immagine della falena */}
        <span className={styles.dividerIcon}>✦</span>
        <span className={styles.dividerLine} />
      </div>

      <div className={styles.content}>
        {groups.length === 0 ? (
          <div className={styles.empty}>Nessuno online al momento</div>
        ) : (
          groups.map(([key, group]) => (
            <section key={key || 'london'} className={styles.group}>
              <h3 className={styles.groupTitle}>
                {group.slug ? (
                  <button
                    type="button"
                    className={styles.groupLink}
                    onClick={() => handleLocationClick(group.slug, group.name)}
                    aria-label={`Apri chat di ${group.name}`}
                  >
                    {group.name}
                  </button>
                ) : (
                  group.name
                )}
              </h3>
              <ul className={styles.list} role="list">
                {group.members.map((presence) => {
                  const fullName = presence.characterSurname
                    ? `${presence.characterName} ${presence.characterSurname}`
                    : presence.characterName;
                  return (
                    <li key={presence.characterId} className={styles.item} role="listitem">
                      {presence.isStaff && (
                        <svg
                          className={styles.staffStar}
                          viewBox="0 0 24 24"
                          role="img"
                          aria-label="Staff"
                        >
                          <path d="M12 0Q13 11 24 12Q13 13 12 24Q11 13 0 12Q11 11 12 0Z" />
                        </svg>
                      )}
                      <button
                        type="button"
                        className={styles.avatarButton}
                        onClick={() => handleAvatarClick(
                          presence.characterId,
                          presence.characterName,
                          presence.characterSurname ?? undefined,
                          presence.avatar ?? undefined
                        )}
                        aria-label={`Apri scheda di ${fullName}`}
                      >
                        <img
                          src={presence.avatar || '/images/sidebar/miniavatar_default.png'}
                          onError={(e) => {
                            e.currentTarget.src = '/images/sidebar/miniavatar_default.png';
                          }}
                          alt=""
                          aria-hidden="true"
                          className={styles.avatar}
                        />
                      </button>
                      <div className={styles.row}>
                        <span className={styles.name}>{fullName}</span>
                        {/* TODO: pallino di stato reale (verde/arancione) */}
                        <span className={styles.statusDot} aria-hidden="true" />
                        <span className={styles.status}>{PLACEHOLDER_STATUS}</span>
                        {/* TODO: collegare al messaggio privato e sostituire con l'icona busta */}
                        <button
                          type="button"
                          className={styles.mailButton}
                          disabled
                          aria-label={`Scrivi a ${fullName}`}
                        >
                          <svg viewBox="0 0 24 16" aria-hidden="true">
                            <rect x="1" y="1" width="22" height="14" rx="1" fill="none" stroke="currentColor" />
                            <path d="M1 1l11 8 11-8M1 15l8-7M23 15l-8-7" fill="none" stroke="currentColor" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
