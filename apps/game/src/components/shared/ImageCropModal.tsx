/**
 * ImageCropModal - Modal component for cropping images to square format
 *
 * Features:
 * - Interactive crop with drag and zoom
 * - Square aspect ratio (1:1)
 * - Canvas-based processing
 * - Preview of final crop
 */

import React, { useState, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';

import { getCroppedImage, readFileAsDataURL } from '@/lib/utils/imageProcessing';
import styles from '@/styles/components/ImageCropModal.module.scss';

import { Modal } from './Modal';

interface ImageCropModalProps {
  isOpen: boolean;
  imageFile: File;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export function ImageCropModal({
  isOpen,
  imageFile,
  onConfirm,
  onCancel,
}: ImageCropModalProps): React.ReactElement {
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSmallImage, setIsSmallImage] = useState(false);

  // Load image file as data URL when modal opens
  useEffect(() => {
    if (!isOpen || !imageFile) return;

    setLoadError(null);
    setIsSmallImage(false);

    readFileAsDataURL(imageFile)
      .then((dataUrl) => {
        setImageDataUrl(dataUrl);

        // Check image size for warning
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth < 512 || img.naturalHeight < 512) {
            setIsSmallImage(true);
          }
        };
        img.src = dataUrl;
      })
      .catch((error) => {
        setLoadError(error.message || 'Impossibile caricare l\'immagine');
      });
  }, [isOpen, imageFile]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setImageDataUrl('');
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setProcessing(false);
      setLoadError(null);
      setIsSmallImage(false);
    }
  }, [isOpen]);

  // Add class to body to override modal z-index and backdrop opacity
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('crop-modal-open');
    } else {
      document.body.classList.remove('crop-modal-open');
    }
    return () => {
      document.body.classList.remove('crop-modal-open');
    };
  }, [isOpen]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels || !imageDataUrl) return;

    setProcessing(true);

    try {
      const croppedBlob = await getCroppedImage(imageDataUrl, croppedAreaPixels, 1024);
      onConfirm(croppedBlob);
    } catch (error) {
      alert(
        `Errore durante il ritaglio dell'immagine: ${
          error instanceof Error ? error.message : 'Errore sconosciuto'
        }\n\nL'immagine non verrà ritagliata.`
      );
      onCancel();
    } finally {
      setProcessing(false);
    }
  }, [croppedAreaPixels, imageDataUrl, onConfirm, onCancel]);

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  }, []);

  if (loadError) {
    return (
      <Modal isOpen={isOpen} onClose={onCancel} title="Errore" size="medium">
        <div className={styles.errorContainer}>
          <p>{loadError}</p>
          <button onClick={onCancel} className={styles.errorButton}>
            Chiudi
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Ritaglia immagine"
      size="large"
      closeOnBackdropClick={false}
      closeOnEscape={!processing}
    >
      <div className={styles.modalContent}>
        {/* Crop area */}
        <div className={styles.cropContainer}>
          {imageDataUrl && (
            <Cropper
              image={imageDataUrl}
              crop={crop}
              zoom={zoom}
              aspect={1} // Square 1:1
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* Warnings */}
        {isSmallImage && (
          <div className={styles.warning}>
            ⚠️ Immagine piccola, la qualità potrebbe essere ridotta
          </div>
        )}

        {imageFile.type === 'image/gif' && (
          <div className={styles.info}>
            ℹ️ Le animazioni non sono supportate, verrà usato il primo frame
          </div>
        )}

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.zoomControl}>
            <label htmlFor="zoom-slider" className={styles.zoomLabel}>
              Zoom: {zoom.toFixed(1)}x
            </label>
            <input
              id="zoom-slider"
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={handleZoomChange}
              className={styles.zoomSlider}
              disabled={processing}
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className={styles.footer}>
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className={styles.cancelButton}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing || !croppedAreaPixels}
            className={styles.confirmButton}
          >
            {processing ? 'Elaborazione...' : 'Conferma ritaglio'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
