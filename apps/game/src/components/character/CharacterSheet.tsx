import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import styles from './CharacterSheet.module.scss';
import { useCharacterSheets, CharacterSheetState } from '../../contexts/CharacterSheetsContext';
import { isYouTubeUrl, getYouTubeVideoInfo, YouTubeAudioPlayer } from '../../utils/youtube';
import CorporationDashboard from './CorporationDashboard';
import HousingDashboard from '../housing/HousingDashboard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface CharacterSheetProps {
  sheet: CharacterSheetState;
}

const CharacterSheet: React.FC<CharacterSheetProps> = ({ sheet }) => {
  const { closeCharacterSheet, minimizeCharacterSheet } = useCharacterSheets();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Position state
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const dragRef = useRef<HTMLDivElement>(null);
  
  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 800, height: 600 });
  
  // Character data state
  const [characterData, setCharacterData] = useState(sheet.character);
  const [loading, setLoading] = useState(!sheet.character);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('INFORMAZIONI');
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    avatar: '',
    profileImage: '',
    prestavolto: '',
    audioTheme: ''
  });
  const [editErrors, setEditErrors] = useState<{[key: string]: string}>({});
  const [editLoading, setEditLoading] = useState(false);
  
  // Audio state
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubeAudioPlayer | null>(null);
  const [isYouTubeAudio, setIsYouTubeAudio] = useState(false);
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  
  // Preview audio state (for edit mode)
  const [previewPlayer, setPreviewPlayer] = useState<YouTubeAudioPlayer | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isPreviewYouTube, setIsPreviewYouTube] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch character data from API (always, to get fresh data with proper permissions)
  useEffect(() => {
    const fetchCharacterData = async () => {
        try {
          setLoading(true);
          const response = await fetch(`${API_BASE_URL}/game/characters/${sheet.characterId}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();
          if (result.success) {
            setCharacterData(result.data.character);
          } else {
            console.error('Failed to fetch character:', result.error);
          }
        } catch (error) {
          console.error('Error fetching character data:', error);
        } finally {
          setLoading(false);
        }
    };

    fetchCharacterData();
  }, [sheet.characterId]); // Remove sheet.character dependency to always fetch

  // Initialize edit data when character data is loaded
  useEffect(() => {
    if (characterData && !isEditing) {
      setEditData({
        avatar: characterData.avatar || '',
        profileImage: characterData.profileImage || '',
        prestavolto: characterData.prestavolto || '',
        audioTheme: characterData.audioTheme || ''
      });
    }
  }, [characterData, isEditing]);

  // Setup audio theme when sheet opens or character data updates
  useEffect(() => {
    const audioTheme = characterData?.audioTheme || sheet.audioTheme;
    if (!audioTheme || sheet.isMinimized) {
      return;
    }

    const setupAudio = async () => {
      // Cleanup previous audio setup
      if (youtubePlayer) {
        youtubePlayer.destroy();
        setYoutubePlayer(null);
      }

      // Check if it's a YouTube URL
      if (isYouTubeUrl(audioTheme)) {
        setIsYouTubeAudio(true);
        const videoInfo = getYouTubeVideoInfo(audioTheme);
        if (videoInfo && youtubeContainerRef.current) {
          try {
            const player = new YouTubeAudioPlayer(
              videoInfo.id,
              `youtube-player-${sheet.characterId}`,
              {
                onPlay: () => setIsAudioPlaying(true),
                onPause: () => setIsAudioPlaying(false),
                onEnd: () => setIsAudioPlaying(false)
              }
            );

            await player.init();
            player.setVolume(30); // 30% volume like regular audio
            setYoutubePlayer(player);

            // Check user autoplay preference (default: enabled)
            const autoplayEnabled = localStorage.getItem('characterSheetAutoplay') !== 'false';
            if (autoplayEnabled) {
              player.play();
            }
          } catch (error) {
            console.error('Failed to initialize YouTube player:', error);
            setIsYouTubeAudio(false);
          }
        }
      } else {
        // Regular audio file
        setIsYouTubeAudio(false);
        if (audioRef.current) {
          audioRef.current.src = audioTheme;
          audioRef.current.volume = 0.3;
          
          // Add event listeners to track play state
          const audio = audioRef.current;
          const handlePlay = () => setIsAudioPlaying(true);
          const handlePause = () => setIsAudioPlaying(false);
          const handleEnded = () => setIsAudioPlaying(false);
          
          audio.addEventListener('play', handlePlay);
          audio.addEventListener('pause', handlePause);
          audio.addEventListener('ended', handleEnded);
          
          // Check user autoplay preference (default: enabled)
          const autoplayEnabled = localStorage.getItem('characterSheetAutoplay') !== 'false';
          if (autoplayEnabled) {
            audio.play().catch(console.error);
          }
          
          // Cleanup event listeners on next effect or unmount
          return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
          };
        }
      }
    };

    setupAudio();

    // Cleanup on unmount or when dependencies change
    return () => {
      if (youtubePlayer) {
        youtubePlayer.destroy();
      }
    };
  }, [characterData?.audioTheme, sheet.audioTheme, sheet.isMinimized, sheet.characterId]);

  // Setup preview audio when editing audioTheme
  useEffect(() => {
    const setupPreviewAudio = async () => {
      // Cleanup previous preview setup
      if (previewPlayer) {
        previewPlayer.destroy();
        setPreviewPlayer(null);
      }
      setIsPreviewPlaying(false);

      if (!editData.audioTheme || !isEditing) {
        setIsPreviewYouTube(false);
        return;
      }

      // Check if it's a YouTube URL
      if (isYouTubeUrl(editData.audioTheme)) {
        setIsPreviewYouTube(true);
        const videoInfo = getYouTubeVideoInfo(editData.audioTheme);
        if (videoInfo && previewContainerRef.current) {
          try {
            const player = new YouTubeAudioPlayer(
              videoInfo.id,
              `youtube-preview-${sheet.characterId}`,
              {
                onPlay: () => setIsPreviewPlaying(true),
                onPause: () => setIsPreviewPlaying(false),
                onEnd: () => setIsPreviewPlaying(false)
              }
            );

            await player.init();
            player.setVolume(30);
            setPreviewPlayer(player);
          } catch (error) {
            console.error('Failed to initialize preview YouTube player:', error);
            setIsPreviewYouTube(false);
          }
        }
      } else {
        // Regular audio file
        setIsPreviewYouTube(false);
        if (previewAudioRef.current) {
          previewAudioRef.current.src = editData.audioTheme;
          previewAudioRef.current.volume = 0.3;
          
          // Add event listeners to track play state
          const audio = previewAudioRef.current;
          const handlePlay = () => setIsPreviewPlaying(true);
          const handlePause = () => setIsPreviewPlaying(false);
          const handleEnded = () => setIsPreviewPlaying(false);
          
          audio.addEventListener('play', handlePlay);
          audio.addEventListener('pause', handlePause);
          audio.addEventListener('ended', handleEnded);
          
          // Return cleanup function for these specific listeners
          return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
          };
        }
      }
    };

    setupPreviewAudio();

    // Cleanup on unmount or when dependencies change
    return () => {
      if (previewPlayer) {
        previewPlayer.destroy();
      }
    };
  }, [editData.audioTheme, isEditing, sheet.characterId]);

  // Simple mouse drag functionality
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = dragRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Resizing functionality
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = Math.max(400, resizeStart.width + (e.clientX - resizeStart.x));
    const newHeight = Math.max(300, resizeStart.height + (e.clientY - resizeStart.y));
    
    setSize({
      width: newWidth,
      height: newHeight
    });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  if (sheet.isMinimized) return null;

  if (loading) {
    return (
      <div 
        className={styles.characterSheet}
        style={{ 
          left: position.x, 
          top: position.y,
          width: size.width,
          height: size.height
        }}
      >
        <div className={styles.loading}>
          Caricamento scheda personaggio...
        </div>
      </div>
    );
  }

  if (!characterData) return null;

  // Audio control functions
  const handlePlayPause = () => {
    if (isYouTubeAudio && youtubePlayer) {
      if (isAudioPlaying) {
        youtubePlayer.pause();
      } else {
        youtubePlayer.play();
      }
    } else if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
    }
  };

  const handleStop = () => {
    if (isYouTubeAudio && youtubePlayer) {
      youtubePlayer.stop();
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // Preview audio control functions
  const handlePreviewPlayPause = () => {
    if (isPreviewYouTube && previewPlayer) {
      if (isPreviewPlaying) {
        previewPlayer.pause();
      } else {
        previewPlayer.play();
      }
    } else if (previewAudioRef.current) {
      if (isPreviewPlaying) {
        previewAudioRef.current.pause();
      } else {
        previewAudioRef.current.play().then(() => {
          setIsPreviewPlaying(true);
        }).catch(console.error);
      }
    }
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    setEditLoading(true);
    setEditErrors({});
    
    try {
      const response = await fetch(`${API_BASE_URL}/game/characters/${sheet.characterId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...(editData.avatar && { avatar: editData.avatar }),
          ...(editData.profileImage && { profileImage: editData.profileImage }),
          ...(editData.prestavolto && { prestavolto: editData.prestavolto }),
          ...(editData.audioTheme && { audioTheme: editData.audioTheme })
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Refresh character data
        const updatedResponse = await fetch(`${API_BASE_URL}/game/characters/${sheet.characterId}`, {
          credentials: 'include'
        });
        const updatedResult = await updatedResponse.json();
        if (updatedResult.success) {
          setCharacterData(updatedResult.data.character);
        }
        setIsEditing(false);
        setActiveTab('INFORMAZIONI');
      } else {
        // Handle validation errors
        if (result.details) {
          setEditErrors(result.details);
        } else {
          setEditErrors({ general: result.error || 'Errore durante il salvataggio' });
        }
      }
    } catch (error) {
      console.error('Error saving character:', error);
      setEditErrors({ general: 'Errore di connessione durante il salvataggio' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset edit data to original values
    setEditData({
      avatar: characterData.avatar || '',
      profileImage: characterData.profileImage || '',
      prestavolto: characterData.prestavolto || '',
      audioTheme: characterData.audioTheme || ''
    });
    setEditErrors({});
    setIsEditing(false);
    setActiveTab('INFORMAZIONI');
  };

  // Handle off-game chat creation
  const handleOffGameClick = async () => {
    try {
      // Create direct chat with this character
      const response = await fetch(`${API_BASE_URL}/game/offgame-chats`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'direct',
          participants: [sheet.characterId]
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Navigate to the created chat
        router.push('/');
        // Then trigger opening the chat panel
        setTimeout(() => {
          // Dispatch custom event to open OffGameChat panel
          const event = new CustomEvent('openOffGameChat');
          window.dispatchEvent(event);
        }, 100);
      } else {
        console.error('Failed to create chat:', data.error);
        alert('Errore nella creazione della chat: ' + (data.error || 'Errore sconosciuto'));
      }
    } catch (error) {
      console.error('Error creating off-game chat:', error);
      alert('Errore di connessione durante la creazione della chat');
    }
  };

  return (
    <div 
      ref={dragRef}
      className={`${styles.characterSheet} ${characterData.status === 'DRAFT' ? styles.draftSheet : ''}`}
      style={{ 
        left: position.x, 
        top: position.y,
        width: size.width,
        height: size.height,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Audio element */}
      <audio ref={audioRef} />
      
      {/* YouTube player container (hidden) */}
      <div 
        ref={youtubeContainerRef}
        style={{ display: 'none' }}
      >
        <div id={`youtube-player-${sheet.characterId}`}></div>
      </div>
      
      {/* YouTube preview player container (hidden) */}
      <div 
        ref={previewContainerRef}
        style={{ display: 'none' }}
      >
        <div id={`youtube-preview-${sheet.characterId}`}></div>
      </div>
      
      {/* Hidden audio element for preview */}
      <audio ref={previewAudioRef} />
      
      {/* Header with drag handle */}
      <div 
        className={styles.header}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className={styles.characterName}>
          {characterData.name}
          {characterData.status === 'DRAFT' && (
            <span className={styles.draftBadge}>
              📝 BOZZA
            </span>
          )}
          {characterData.status === 'PENDING_APPROVAL' && (
            <span className={styles.pendingBadge}>
              ⏳ IN ATTESA DI APPROVAZIONE
            </span>
          )}
          <button 
            className={styles.editButton}
            onClick={() => {
              if (isEditing) {
                // Save changes
                handleSaveEdit();
              } else {
                // Enter edit mode
                setIsEditing(true);
                setActiveTab('MODIFICA');
              }
            }}
          >
            {isEditing ? 'salva modifiche' : 'modifica scheda'}
          </button>
          
          {/* Audio controls for character audio theme */}
          {(characterData.audioTheme || sheet.audioTheme) && (
            <div className={styles.headerAudioControls}>
              <button 
                className={styles.audioControlButton}
                onClick={handlePlayPause}
                title={isAudioPlaying ? "Pausa audio" : "Riproduci audio"}
              >
                {isAudioPlaying ? '⏸️' : '▶️'}
              </button>
              {/* <button 
                className={styles.audioControlButton}
                onClick={handleStop}
                title="Ferma audio"
              >
                ⏹️
              </button> */}
            </div>
          )}
        </div>
        <div className={styles.controls}>
          <button 
            className={styles.minimizeButton}
            onClick={() => minimizeCharacterSheet(sheet.id)}
          >
            –
          </button>
          <button 
            className={styles.closeButton}
            onClick={() => closeCharacterSheet(sheet.id)}
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.leftPanel}>
          {/* Character portrait */}
          <div className={styles.portraitSection}>
            {characterData.profileImage ? (
              <img 
                src={characterData.profileImage} 
                alt={characterData.name}
                className={styles.portrait}
              />
            ) : (
              <div className={styles.portraitPlaceholder}>
                No Image
              </div>
            )}
            
            {/* Message controls */}
            <div className={styles.audioControls}>
              <div className={styles.audioLabel}>MESSAGGI</div>
              <div className={styles.audioButtons}>
                {characterData.status === 'APPROVED' && (
                  <button className={styles.audioButton}>IN-GAME</button>
                )}
                {!characterData.isOwnCharacter && (
                  <button 
                    className={styles.audioButton}
                    onClick={handleOffGameClick}
                  >
                    OFF-GAME
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.rightPanel}>
          {/* Sections tabs */}
          <div className={styles.sectionTabs}>
            <button 
              className={`${styles.sectionTab} ${activeTab === 'INFORMAZIONI' ? styles.active : ''}`}
              onClick={() => setActiveTab('INFORMAZIONI')}
            >
              INFORMAZIONI
            </button>
            <button 
              className={`${styles.sectionTab} ${activeTab === 'BACKGROUND' ? styles.active : ''}`}
              onClick={() => setActiveTab('BACKGROUND')}
            >
              BACKGROUND
            </button>
            <button 
              className={`${styles.sectionTab} ${activeTab === 'STATISTICHE' ? styles.active : ''}`}
              onClick={() => setActiveTab('STATISTICHE')}
            >
              STATISTICHE
            </button>
            <button 
              className={`${styles.sectionTab} ${activeTab === 'DIARIO' ? styles.active : ''}`}
              onClick={() => setActiveTab('DIARIO')}
            >
              DIARIO
            </button>
            <button 
              className={`${styles.sectionTab} ${activeTab === 'NOTE MASTER' ? styles.active : ''}`}
              onClick={() => setActiveTab('NOTE MASTER')}
            >
              NOTE MASTER
            </button>
            <button 
              className={`${styles.sectionTab} ${activeTab === 'INVENTARIO' ? styles.active : ''}`}
              onClick={() => setActiveTab('INVENTARIO')}
            >
              INVENTARIO
            </button>
            <button 
              className={`${styles.sectionTab} ${activeTab === 'CORPORATIONS' ? styles.active : ''}`}
              onClick={() => setActiveTab('CORPORATIONS')}
            >
              CORPORAZIONI
            </button>
            <button 
              className={`${styles.sectionTab} ${activeTab === 'HOUSING' ? styles.active : ''}`}
              onClick={() => setActiveTab('HOUSING')}
            >
              ALLOGGIO
            </button>
            {isEditing && (
              <button 
                className={`${styles.sectionTab} ${activeTab === 'MODIFICA' ? styles.active : ''}`}
                onClick={() => setActiveTab('MODIFICA')}
              >
                MODIFICA
              </button>
            )}
          </div>

          {/* Content area */}
          <div className={styles.sectionContent}>
            {activeTab === 'INFORMAZIONI' && (
              <>
                {/* Basic Information */}
                <div className={styles.infoGrid}>
                  <div className={styles.infoGroup}>
                    <label>Età apparente:</label>
                    <span>{characterData.apparentAge || '[DATO PRIVATO]'}</span>
                  </div>
                  <div className={styles.infoGroup}>
                    <label>Genere:</label>
                    <span>{characterData.gender === 'male' ? 'Maschio' : characterData.gender === 'female' ? 'Femmina' : '[DATO PRIVATO]'}</span>
                  </div>
                  <div className={styles.infoGroup}>
                    <label>Esperienze Pregresse:</label>
                    <span>{characterData.occupationName || '[DATO PRIVATO]'}</span>
                  </div>
                  <div className={styles.infoGroup}>
                    <label>Classe sociale:</label>
                    <span>
                      {characterData.socialClass === 'working' ? 'Operaia' : 
                       characterData.socialClass === 'middle' ? 'Media' : 
                       characterData.socialClass === 'upper' ? 'Alta' : '[DATO PRIVATO]'}
                    </span>
                  </div>
                  <div className={styles.infoGroup}>
                    <label>Luogo di nascita:</label>
                    <span>{characterData.birthPlace || '[DATO PRIVATO]'}</span>
                  </div>
                </div>

                {/* Physical Description */}
                <div className={styles.descriptionSection}>
                  <label>Descrizione fisica:</label>
                  <div className={styles.descriptionText}>
                    {characterData.physicalDescription || '[DATO PRIVATO]'}
                  </div>
                </div>

                {/* Public Description */}
                <div className={styles.descriptionSection}>
                  <label>Descrizione pubblica:</label>
                  <div className={styles.descriptionText}>
                    {characterData.publicDescription || '[DATO PRIVATO]'}
                  </div>
                </div>

                {/* Stats Preview */}
                <div className={styles.statsPreview}>
                  <div className={styles.statItem}>
                    <label>Sanità:</label>
                    <span>{characterData.derived?.sanityPoints || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <label>Punti Vita:</label>
                    <span>{characterData.derived?.hitPoints || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <label>Punti Magia:</label>
                    <span>{characterData.derived?.magicPoints || 0}</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'BACKGROUND' && (
              <>
                {/* Background Privato */}
                <div className={styles.descriptionSection}>
                  <label>Background Privato:</label>
                  <div className={styles.descriptionText}>
                    {characterData.privateDescription || '[DATO PRIVATO]'}
                  </div>
                </div>

                {/* Motivazioni */}
                <div className={styles.descriptionSection}>
                  <label>Motivazioni Personali:</label>
                  <div className={styles.descriptionText}>
                    {characterData.motivations || '[DATO PRIVATO]'}
                  </div>
                </div>

                {/* Paure e Fobie */}
                <div className={styles.descriptionSection}>
                  <label>Paure e Fobie:</label>
                  <div className={styles.descriptionText}>
                    {characterData.fears || '[DATO PRIVATO]'}
                  </div>
                </div>

                {/* Età reale (campo privato) */}
                <div className={styles.descriptionSection}>
                  <label>Età Reale:</label>
                  <div className={styles.descriptionText}>
                    {characterData.age || '[DATO PRIVATO]'}
                  </div>
                </div>

                {characterData.guidedBackground && (
                  <>
                    {characterData.guidedBackground.phobias && characterData.guidedBackground.phobias.length > 0 && (
                      <div className={styles.descriptionSection}>
                        <label>Fobie (Legacy):</label>
                        <div className={styles.listContainer}>
                          {characterData.guidedBackground.phobias.map((phobia: string, index: number) => (
                            <div key={index} className={styles.listItem}>{phobia}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {characterData.guidedBackground.pastTraumas && characterData.guidedBackground.pastTraumas.length > 0 && (
                      <div className={styles.descriptionSection}>
                        <label>Traumi del Passato (Legacy):</label>
                        <div className={styles.listContainer}>
                          {characterData.guidedBackground.pastTraumas.map((trauma: string, index: number) => (
                            <div key={index} className={styles.listItem}>{trauma}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {characterData.guidedBackground.beliefSystem && (
                      <div className={styles.descriptionSection}>
                        <label>Sistema di Credenze (Legacy):</label>
                        <div className={styles.descriptionText}>
                          {characterData.guidedBackground.beliefSystem}
                        </div>
                      </div>
                    )}

                    {characterData.guidedBackground.significantBonds && characterData.guidedBackground.significantBonds.length > 0 && (
                      <div className={styles.descriptionSection}>
                        <label>Legami Significativi (Legacy):</label>
                        <div className={styles.listContainer}>
                          {characterData.guidedBackground.significantBonds.map((bond: string, index: number) => (
                            <div key={index} className={styles.listItem}>{bond}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {characterData.guidedBackground.secrets && characterData.guidedBackground.secrets.length > 0 && (
                      <div className={styles.descriptionSection}>
                        <label>Segreti (Legacy):</label>
                        <div className={styles.listContainer}>
                          {characterData.guidedBackground.secrets.map((secret: string, index: number) => (
                            <div key={index} className={styles.listItem}>{secret}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {characterData.backgroundResponses && characterData.backgroundResponses.length > 0 && (
                  <div className={styles.descriptionSection}>
                    <label>Risposte del Background:</label>
                    <div className={styles.backgroundResponses}>
                      {characterData.backgroundResponses.map((response: any, index: number) => (
                        <div key={index} className={styles.backgroundResponse}>
                          <strong>{response.question}</strong>
                          <div className={styles.responseText}>{response.answer}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'STATISTICHE' && (
              <>
                <div className={styles.descriptionSection}>
                  <label>Statistiche Base:</label>
                  <div className={styles.statsColumn}>
                    {[
                      { key: 'charm', label: 'Fascino', value: characterData.stats?.charm || 0 },
                      { key: 'constitution', label: 'Costituzione', value: characterData.stats?.constitution || 0 },
                      { key: 'dexterity', label: 'Destrezza', value: characterData.stats?.dexterity || 0 },
                      { key: 'education', label: 'Educazione', value: characterData.stats?.education || 0 },
                      { key: 'intelligence', label: 'Intelligenza', value: characterData.stats?.intelligence || 0 },
                      { key: 'power', label: 'Potere', value: characterData.stats?.power || 0 },
                      { key: 'size', label: 'Taglia', value: characterData.stats?.size || 0 },
                      { key: 'strength', label: 'Forza', value: characterData.stats?.strength || 0 }
                    ].sort((a, b) => a.label.localeCompare(b.label)).map(stat => (
                      <div key={stat.key} className={styles.statRow}>
                        <span className={styles.statLabel}>{stat.label}:</span>
                        <span className={styles.statValue}>{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.descriptionSection}>
                  <label>Statistiche Derivate:</label>
                  <div className={styles.statsColumn}>
                    {[
                      { key: 'damageBonus', label: 'Bonus Danno', value: characterData.derived?.damageBonus || '0' },
                      { key: 'build', label: 'Corporatura', value: characterData.derived?.build || 0 },
                      { key: 'luckRoll', label: 'Fortuna', value: characterData.derived?.luckRoll || 0 },
                      { key: 'ideaRoll', label: 'Idea', value: characterData.derived?.ideaRoll || 0 },
                      { key: 'knowledge', label: 'Conoscenze', value: characterData.derived?.knowledge || 0 },
                      { key: 'magicPoints', label: 'Punti Magia', value: characterData.derived?.magicPoints || 0 },
                      { key: 'sanityPoints', label: 'Punti Sanità', value: characterData.derived?.sanityPoints || 0 },
                      { key: 'hitPoints', label: 'Punti Vita', value: characterData.derived?.hitPoints || 0 }
                    ].sort((a, b) => a.label.localeCompare(b.label)).map(stat => (
                      <div key={stat.key} className={styles.statRow}>
                        <span className={styles.statLabel}>{stat.label}:</span>
                        <span className={styles.statValue}>{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.descriptionSection}>
                  <label>Abilità:</label>
                  <div className={styles.skillsColumn}>
                    {characterData.skills && Object.entries(characterData.skills)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([skillName, skillValue]) => {
                        const isProfessionalSkill = characterData.professionalSkillNames?.includes(skillName);
                        return (
                          <div key={skillName} className={`${styles.statRow} ${isProfessionalSkill ? styles.professionalSkill : ''}`}>
                            <span className={styles.statLabel}>
                              {isProfessionalSkill && <span className={styles.professionalIcon}>🎯</span>}
                              {skillName}:
                            </span>
                            <span className={styles.statValue}>{skillValue as number}%</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'DIARIO' && (
              <>
                {characterData.personalityTraits && characterData.personalityTraits.length > 0 && (
                  <div className={styles.descriptionSection}>
                    <label>Tratti della Personalità:</label>
                    <div className={styles.listContainer}>
                      {characterData.personalityTraits.map((trait: string, index: number) => (
                        <div key={index} className={styles.listItem}>{trait}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.descriptionSection}>
                  <label>Status del Personaggio:</label>
                  <div className={styles.statusInfo}>
                    <div className={styles.statusItem}>
                      <span className={styles.statLabel}>Stato:</span>
                      <span className={`${styles.statValue} ${styles[`status${characterData.status}`]}`}>
                        {characterData.status === 'DRAFT' ? 'Bozza' :
                         characterData.status === 'PENDING_APPROVAL' ? 'In attesa di approvazione' :
                         characterData.status === 'APPROVED' ? 'Approvato' : characterData.status}
                      </span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.statLabel}>Attivo:</span>
                      <span className={styles.statValue}>
                        {characterData.isActive ? 'Sì' : 'No'}
                      </span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.statLabel}>Creato il:</span>
                      <span className={styles.statValue}>
                        {characterData.createdAt ? new Date(characterData.createdAt).toLocaleDateString('it-IT') : 'N/A'}
                      </span>
                    </div>
                    {characterData.submittedAt && (
                      <div className={styles.statusItem}>
                        <span className={styles.statLabel}>Inviato per approvazione:</span>
                        <span className={styles.statValue}>
                          {new Date(characterData.submittedAt).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    )}
                    {characterData.lastActive && (
                      <div className={styles.statusItem}>
                        <span className={styles.statLabel}>Ultima attività:</span>
                        <span className={styles.statValue}>
                          {new Date(characterData.lastActive).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {characterData.gameplayRoles && characterData.gameplayRoles.length > 0 && (
                  <div className={styles.descriptionSection}>
                    <label>Ruoli di Gioco:</label>
                    <div className={styles.rolesContainer}>
                      {characterData.gameplayRoles.map((role: string, index: number) => (
                        <span key={index} className={styles.roleTag}>
                          {role === 'personaggio' ? 'Personaggio' :
                           role === 'master' ? 'Master' :
                           role === 'moderatore' ? 'Moderatore' :
                           role === 'gestore' ? 'Gestore' : role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'NOTE MASTER' && (
              <>
                {characterData.reviewHistory && characterData.reviewHistory.length > 0 ? (
                  <div className={styles.descriptionSection}>
                    <label>Cronologia Revisioni:</label>
                    <div className={styles.reviewHistory}>
                      {characterData.reviewHistory.map((review: any, index: number) => (
                        <div key={index} className={styles.reviewItem}>
                          <div className={styles.reviewHeader}>
                            <span className={styles.reviewDate}>
                              {new Date(review.date).toLocaleDateString('it-IT')}
                            </span>
                            <span className={styles.reviewAuthor}>{review.masterName}</span>
                          </div>
                          <div className={styles.reviewContent}>{review.notes}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>📝</span>
                    <span className={styles.emptyText}>Nessuna nota master disponibile</span>
                  </div>
                )}

                <div className={styles.descriptionSection}>
                  <label>Informazioni Tecniche:</label>
                  <div className={styles.techInfo}>
                    <div className={styles.statusItem}>
                      <span className={styles.statLabel}>ID Personaggio:</span>
                      <span className={styles.statValue}>{characterData._id}</span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.statLabel}>ID Utente:</span>
                      <span className={styles.statValue}>{characterData.userId}</span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.statLabel}>Background Completato:</span>
                      <span className={styles.statValue}>
                        {characterData.backgroundCompleted ? 'Sì' : 'No'}
                      </span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.statLabel}>Ultimo aggiornamento:</span>
                      <span className={styles.statValue}>
                        {characterData.updatedAt ? new Date(characterData.updatedAt).toLocaleDateString('it-IT') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'INVENTARIO' && (
              <>
                {characterData.equipment && characterData.equipment.length > 0 && (
                  <div className={styles.descriptionSection}>
                    <label>Equipaggiamento Attuale:</label>
                    <div className={styles.inventoryGrid}>
                      {characterData.equipment.map((item: any, index: number) => (
                        <div key={index} className={styles.inventoryItem}>
                          <div className={styles.itemName}>{item.name}</div>
                          {item.quantity && <div className={styles.itemQuantity}>Qtà: {item.quantity}</div>}
                          {item.description && <div className={styles.itemDescription}>{item.description}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!characterData.equipment || characterData.equipment.length === 0) && (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>📦</span>
                    <span className={styles.emptyText}>Nessun oggetto nell'inventario</span>
                  </div>
                )}
              </>
            )}

            {activeTab === 'CORPORATIONS' && (
              <CorporationDashboard characterId={sheet.characterId} />
            )}

            {activeTab === 'HOUSING' && (
              <HousingDashboard characterId={sheet.characterId} />
            )}

            {activeTab === 'MODIFICA' && (
              <>
                <div className={styles.editForm}>
                  {/* General error message */}
                  {editErrors.general && (
                    <div className={styles.errorMessage}>
                      <span className={styles.errorIcon}>⚠️</span>
                      {editErrors.general}
                    </div>
                  )}
                  <div className={styles.editSection}>
                    <label className={styles.editLabel}>Avatar (immagine chat):</label>
                    <input
                      type="text"
                      value={editData.avatar}
                      onChange={(e) => setEditData({...editData, avatar: e.target.value})}
                      placeholder="URL dell'immagine avatar per la chat"
                      className={`${styles.editInput} ${editErrors.avatar ? styles.inputError : ''}`}
                    />
                    {editErrors.avatar && (
                      <div className={styles.fieldError}>
                        {editErrors.avatar}
                      </div>
                    )}
                    {editData.avatar && (
                      <div className={styles.imagePreview}>
                        <img src={editData.avatar} alt="Avatar preview" className={styles.avatarPreview} />
                      </div>
                    )}
                  </div>

                  <div className={styles.editSection}>
                    <label className={styles.editLabel}>Immagine di profilo (scheda personaggio):</label>
                    <input
                      type="text"
                      value={editData.profileImage}
                      onChange={(e) => setEditData({...editData, profileImage: e.target.value})}
                      placeholder="URL dell'immagine di profilo per la scheda"
                      className={`${styles.editInput} ${editErrors.profileImage ? styles.inputError : ''}`}
                    />
                    {editErrors.profileImage && (
                      <div className={styles.fieldError}>
                        {editErrors.profileImage}
                      </div>
                    )}
                    {editData.profileImage && (
                      <div className={styles.imagePreview}>
                        <img src={editData.profileImage} alt="Profile preview" className={styles.profilePreview} />
                      </div>
                    )}
                  </div>

                  <div className={styles.editSection}>
                    <label className={styles.editLabel}>Prestavolto (riferimento famoso):</label>
                    <input
                      type="text"
                      value={editData.prestavolto}
                      onChange={(e) => setEditData({...editData, prestavolto: e.target.value})}
                      placeholder="Nome di persona famosa/personaggio come riferimento"
                      className={`${styles.editInput} ${editErrors.prestavolto ? styles.inputError : ''}`}
                    />
                    {editErrors.prestavolto && (
                      <div className={styles.fieldError}>
                        {editErrors.prestavolto}
                      </div>
                    )}
                  </div>

                  <div className={styles.editSection}>
                    <label className={styles.editLabel}>Audio Tema:</label>
                    <input
                      type="text"
                      value={editData.audioTheme}
                      onChange={(e) => setEditData({...editData, audioTheme: e.target.value})}
                      placeholder="URL del file audio tema del personaggio"
                      className={`${styles.editInput} ${editErrors.audioTheme ? styles.inputError : ''}`}
                    />
                    {editErrors.audioTheme && (
                      <div className={styles.fieldError}>
                        {editErrors.audioTheme}
                      </div>
                    )}
                    {editData.audioTheme && (
                      <div className={styles.audioPreview}>
                        {isPreviewYouTube ? (
                          <div className={styles.youtubePreview}>
                            <div className={styles.youtubePreviewInfo}>
                              🎵 YouTube: {getYouTubeVideoInfo(editData.audioTheme)?.id}
                            </div>
                            <button 
                              className={styles.previewPlayButton}
                              onClick={handlePreviewPlayPause}
                              title={isPreviewPlaying ? "Pausa anteprima" : "Riproduci anteprima"}
                            >
                              {isPreviewPlaying ? '⏸️' : '▶️'} 
                              {isPreviewPlaying ? ' Pausa' : ' Riproduci'}
                            </button>
                          </div>
                        ) : (
                          <audio controls>
                            <source src={editData.audioTheme} type="audio/mpeg" />
                            Il tuo browser non supporta l'elemento audio.
                          </audio>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={styles.editActions}>
                    <button 
                      className={styles.saveButton}
                      onClick={handleSaveEdit}
                      disabled={editLoading}
                    >
                      {editLoading ? 'Salvando...' : 'Salva Modifiche'}
                    </button>
                    <button 
                      className={styles.cancelButton}
                      onClick={handleCancelEdit}
                      disabled={editLoading}
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Resize handle */}
      <div 
        className={styles.resizeHandle}
        onMouseDown={handleResizeStart}
        style={{ cursor: 'nw-resize' }}
      />
    </div>
  );
};

export default CharacterSheet;