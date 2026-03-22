/**
 * Create Ticket Modal Component
 *
 * Modal form for creating new support tickets
 *
 * @module components/tickets/CreateTicketModal
 */

'use client';

import { useState } from 'react';

import { useTicketCategories, useCreateTicket } from '@/hooks/useTickets';

interface CreateTicketModalProps {
  onClose: () => void;
}

export function CreateTicketModal({ onClose }: CreateTicketModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');

  const { data: categories = [], isLoading: loadingCategories } = useTicketCategories();
  const createTicket = useCreateTicket();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !category || !content.trim()) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    try {
      await createTicket.mutateAsync({
        title: title.trim(),
        category,
        content: content.trim()
      });

      alert('Ticket creato con successo!');
      onClose();
    } catch (error: any) {
      alert(error.message || 'Errore nella creazione del ticket');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '2rem',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', margin: 0 }}>
          Nuovo Ticket
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Category */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
              Categoria *
            </label>
            {loadingCategories ? (
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Caricamento categorie...</p>
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Seleziona una categoria</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            )}
            {category && categories.find(c => c.value === category)?.description && (
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: 0 }}>
                {categories.find(c => c.value === category)?.description}
              </p>
            )}
          </div>

          {/* Title */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
              Titolo *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              placeholder="Descrivi brevemente il problema"
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: 0, textAlign: 'right' }}>
              {title.length}/100
            </p>
          </div>

          {/* Content */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
              Descrizione *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
              required
              placeholder="Descrivi dettagliatamente la tua richiesta o problema..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '0.625rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: 0, textAlign: 'right' }}>
              {content.length}/5000
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={createTicket.isPending}
              style={{
                padding: '0.625rem 1.25rem',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: createTicket.isPending ? 'not-allowed' : 'pointer'
              }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={createTicket.isPending || !title.trim() || !category || !content.trim()}
              style={{
                padding: '0.625rem 1.25rem',
                backgroundColor: createTicket.isPending || !title.trim() || !category || !content.trim() ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: createTicket.isPending || !title.trim() || !category || !content.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {createTicket.isPending ? 'Creazione...' : 'Invia Richiesta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
