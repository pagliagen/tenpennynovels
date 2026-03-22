/**
 * LocationTreeView - Visualizzazione gerarchica delle location
 *
 * Mostra l'albero delle location con livelli root → district → location.
 * Supporta: espansione/collasso, azioni context menu, drag per riordinamento.
 */

import React, { useState, useCallback, type CSSProperties } from 'react';
import classNames from 'classnames';
import styles from '@/styles/components/LocationTreeView.module.scss';
import type { LocationTreeNode } from '@/types/api/Location';

interface LocationTreeViewProps {
  tree: LocationTreeNode[];
  onEditLocation: (locationId: string) => void;
  onCreateChild: (parentId: string, parentLevel: string) => void;
  onDeleteLocation: (locationId: string, locationName: string) => void;
}

function LocationLevelBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    root: { label: 'Root', className: styles.badgeRoot },
    district: { label: 'Distretto', className: styles.badgeDistrict },
    location: { label: 'Location', className: styles.badgeLocation },
  };
  const { label, className } = config[level] || { label: level, className: '' };
  return <span className={classNames(styles.badge, className)}>{label}</span>;
}

interface TreeNodeProps {
  node: LocationTreeNode;
  depth: number;
  onEdit: (id: string) => void;
  onCreateChild: (parentId: string, parentLevel: string) => void;
  onDelete: (id: string, name: string) => void;
}

function TreeNode({ node, depth, onEdit, onCreateChild, onDelete }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const canHaveChildren = node.locationLevel !== 'location';

  return (
    <div className={styles.treeNode}>
      <div
        className={classNames(styles.nodeRow, {
          [styles.hidden]: !node.visible,
          [styles.private]: node.private
        })}
        style={{ '--depth': depth } as CSSProperties}
      >
        {/* Expand/collapse toggle */}
        <button
          className={styles.expandToggle}
          onClick={() => setExpanded(!expanded)}
          disabled={!hasChildren}
          aria-label={expanded ? 'Comprimi' : 'Espandi'}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : '·'}
        </button>

        {/* Node info */}
        <div className={styles.nodeInfo} onClick={() => onEdit(node.id)}>
          {node.imageUrl && (
            <img src={node.imageUrl} alt="" className={styles.nodeThumb} />
          )}
          <span className={styles.nodeName}>{node.name}</span>
          <LocationLevelBadge level={node.locationLevel} />
          {!node.visible && <span className={styles.tagHidden}>Nascosta</span>}
          {node.private && <span className={styles.tagPrivate}>Privata</span>}
          {node.currentOccupants > 0 && (
            <span className={styles.occupants}>
              {node.currentOccupants} presente{node.currentOccupants !== 1 ? 'i' : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className={styles.nodeActions}>
          <button
            className={styles.actionBtn}
            onClick={() => onEdit(node.id)}
            title="Modifica"
          >
            Modifica
          </button>
          {canHaveChildren && (
            <button
              className={styles.actionBtn}
              onClick={() => onCreateChild(node.id, node.locationLevel)}
              title="Aggiungi sotto-location"
            >
              + Figlio
            </button>
          )}
          <button
            className={classNames(styles.actionBtn, styles.deleteBtn)}
            onClick={() => onDelete(node.id, node.name)}
            title="Elimina"
          >
            Elimina
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className={styles.nodeChildren}>
          {node.children
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(child => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                onEdit={onEdit}
                onCreateChild={onCreateChild}
                onDelete={onDelete}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function LocationTreeView({
  tree,
  onEditLocation,
  onCreateChild,
  onDeleteLocation
}: LocationTreeViewProps): React.ReactElement {
  if (!tree || tree.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Nessuna location trovata.</p>
        <p>Crea la prima location usando il pulsante in alto.</p>
      </div>
    );
  }

  return (
    <div className={styles.treeContainer}>
      {tree
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(node => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            onEdit={onEditLocation}
            onCreateChild={onCreateChild}
            onDelete={onDeleteLocation}
          />
        ))}
    </div>
  );
}
