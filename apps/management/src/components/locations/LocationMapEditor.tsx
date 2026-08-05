/**
 * Location Map Editor
 *
 * Drag & drop editor for district / sottoquartiere marker positions on the
 * London map. Districts and their sottoquartieri are shown together on the
 * same map (not split into separate views), so their relative positions can
 * be judged directly. Positions are percentage-based (0-100) and persisted
 * on Location.mapPosition via PATCH /admin/locations/:id/map-position on
 * every drop (no explicit "save" step).
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent
} from '@dnd-kit/core';
import { useUpdateLocationMapPosition } from '@/hooks/api/useLocations';
import { useNotificationStore } from '@/store/notificationStore';
import type { LocationTreeNode, MapPosition } from '@/types/api/Location';
import styles from './LocationMapEditor.module.scss';

interface LocationMapEditorProps {
  tree: LocationTreeNode[];
}

type NodeKind = 'district' | 'sottoquartiere';

interface FlatNode {
  node: LocationTreeNode;
  kind: NodeKind;
  districtName?: string; // For sottoquartieri, name of the parent district (context in lists)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Converts a dragged element's viewport rect to a percentage position (0-100)
 * relative to the map container. Used for BOTH the live drag preview and the
 * final drop — same calculation throughout, so the marker never "jumps" on
 * release (previously the live preview moved via a raw pixel CSS transform
 * while the drop position was computed separately in percent, and any tiny
 * mismatch between the two showed up as a snap at release).
 */
function rectToMapPercent(
  rect: { left: number; top: number; width: number; height: number } | null,
  mapEl: HTMLElement | null
): MapPosition | null {
  if (!rect || !mapEl) return null;

  const mapRect = mapEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const x = Math.min(100, Math.max(0, ((centerX - mapRect.left) / mapRect.width) * 100));
  const y = Math.min(100, Math.max(0, ((centerY - mapRect.top) / mapRect.height) * 100));

  return { x: round2(x), y: round2(y) };
}

interface MapMarkerProps {
  node: LocationTreeNode;
  kind: NodeKind;
  positioned: boolean;
  title?: string;
  previewPosition?: MapPosition;
}

function MapMarker({ node, kind, positioned, title, previewPosition }: MapMarkerProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: node.id });
  const effectivePosition = previewPosition ?? node.mapPosition;

  const style: React.CSSProperties = positioned && effectivePosition
    ? {
        position: 'absolute',
        left: `${effectivePosition.x}%`,
        top: `${effectivePosition.y}%`,
        transform: 'translate(-50%, -50%)',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : kind === 'district' ? 2 : 1
      }
    : {
        position: 'relative',
        opacity: isDragging ? 0.5 : 1
      };

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={kind === 'district' ? styles.districtMarker : styles.subMarker}
      style={style}
      title={title}
      {...listeners}
      {...attributes}
    >
      {node.name}
    </button>
  );
}

export function LocationMapEditor({ tree }: LocationMapEditorProps): React.ReactElement {
  const mapRef = useRef<HTMLDivElement>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; position: MapPosition } | null>(null);
  const updateMapPosition = useUpdateLocationMapPosition();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const london = tree.find((node) => node.locationLevel === 'root') ?? tree[0];
  const districts = useMemo(
    () => (london?.children ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [london]
  );

  // Districts + all their sottoquartieri, flattened into a single list — shown together on the map.
  const allNodes: FlatNode[] = useMemo(() => {
    const flat: FlatNode[] = [];
    for (const district of districts) {
      flat.push({ node: district, kind: 'district' });
      const children = district.children.slice().sort((a, b) => a.sortOrder - b.sortOrder);
      for (const child of children) {
        flat.push({ node: child, kind: 'sottoquartiere', districtName: district.name });
      }
    }
    return flat;
  }, [districts]);

  const positioned = allNodes.filter(({ node }) => node.mapPosition !== null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragMove = (event: DragMoveEvent) => {
    const position = rectToMapPercent(event.active.rect.current.translated, mapRef.current);
    if (position) {
      setDragPreview({ id: event.active.id as string, position });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // Reuse the same rect->percent calculation as the live preview so the
    // marker settles exactly where it visually was — never a separate,
    // possibly-diverging calculation at drop time.
    const position =
      rectToMapPercent(event.active.rect.current.translated, mapRef.current) ??
      (dragPreview?.id === event.active.id ? dragPreview.position : null);
    setDragPreview(null);
    if (!position) return;

    updateMapPosition.mutate(
      { id: event.active.id as string, mapPosition: position },
      {
        onError: (error) => {
          addNotification({
            type: 'error',
            message: error instanceof Error ? error.message : 'Errore nel salvataggio della posizione'
          });
        }
      }
    );
  };

  return (
    <div className={styles.editor}>
      <p className={styles.hint}>
        Trascina un marker per posizionarlo: il salvataggio è automatico al rilascio.
        <span className={styles.legend}>
          <span className={styles.legendDistrict}>●</span> distretto
          <span className={styles.legendSub}>●</span> sottoquartiere
        </span>
      </p>

      <DndContext sensors={sensors} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
        <div className={styles.mapArea} ref={mapRef}>
          {/* eslint-disable-next-line @next/next/no-img-element -- coerente con apps/game, niente next/image su questa mappa */}
          <img src="/locations/london.png" alt="Mappa di Londra" className={styles.mapImage} />

          {positioned.map(({ node, kind, districtName }) => (
            <MapMarker
              key={node.id}
              node={node}
              kind={kind}
              positioned
              title={kind === 'sottoquartiere' && districtName ? `${districtName} → ${node.name}` : node.name}
              previewPosition={dragPreview?.id === node.id ? dragPreview.position : undefined}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
