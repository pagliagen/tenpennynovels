/**
 * YouTube utility functions for character sheet audio themes
 */

export interface YouTubeVideoInfo {
  id: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
}

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
export const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;

  const patterns = [
    // Standard YouTube URLs
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    // Shortened YouTube URLs
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // YouTube embed URLs
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // YouTube playlist URLs (extract first video)
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})&list=/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Check if a URL is a YouTube URL
 */
export const isYouTubeUrl = (url: string): boolean => {
  return extractYouTubeId(url) !== null;
};

/**
 * Get YouTube video info from URL
 */
export const getYouTubeVideoInfo = (url: string): YouTubeVideoInfo | null => {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return {
    id: videoId,
    url,
    embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&loop=1&playlist=${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  };
};

/**
 * YouTube Player API wrapper for character sheets
 */
export class YouTubeAudioPlayer {
  private player: any = null;
  private playerReady: boolean = false;
  private videoId: string;
  private containerId: string;
  private onPlayCallback?: () => void;
  private onPauseCallback?: () => void;
  private onEndCallback?: () => void;

  constructor(
    videoId: string, 
    containerId: string,
    callbacks?: {
      onPlay?: () => void;
      onPause?: () => void;
      onEnd?: () => void;
    }
  ) {
    this.videoId = videoId;
    this.containerId = containerId;
    this.onPlayCallback = callbacks?.onPlay;
    this.onPauseCallback = callbacks?.onPause;
    this.onEndCallback = callbacks?.onEnd;
  }

  /**
   * Initialize YouTube player
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load YouTube API if not already loaded
      if (!window.YT) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);

        window.onYouTubeIframeAPIReady = () => {
          this.createPlayer().then(resolve).catch(reject);
        };
      } else {
        this.createPlayer().then(resolve).catch(reject);
      }
    });
  }

  private async createPlayer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.player = new window.YT.Player(this.containerId, {
          height: '0',
          width: '0',
          videoId: this.videoId,
          playerVars: {
            autoplay: 0,
            loop: 1,
            playlist: this.videoId,
            controls: 0,
            showinfo: 0,
            rel: 0,
            fs: 0,
            modestbranding: 1
          },
          events: {
            onReady: () => {
              this.playerReady = true;
              resolve();
            },
            onStateChange: (event: any) => {
              switch (event.data) {
                case window.YT.PlayerState.PLAYING:
                  this.onPlayCallback?.();
                  break;
                case window.YT.PlayerState.PAUSED:
                  this.onPauseCallback?.();
                  break;
                case window.YT.PlayerState.ENDED:
                  this.onEndCallback?.();
                  break;
              }
            },
            onError: () => {
              reject(new Error('YouTube player error'));
            }
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Play the video
   */
  play(): void {
    if (this.playerReady && this.player) {
      this.player.playVideo();
    }
  }

  /**
   * Pause the video
   */
  pause(): void {
    if (this.playerReady && this.player) {
      this.player.pauseVideo();
    }
  }

  /**
   * Stop the video
   */
  stop(): void {
    if (this.playerReady && this.player) {
      this.player.stopVideo();
    }
  }

  /**
   * Set volume (0-100)
   */
  setVolume(volume: number): void {
    if (this.playerReady && this.player) {
      this.player.setVolume(Math.max(0, Math.min(100, volume)));
    }
  }

  /**
   * Check if player is playing
   */
  isPlaying(): boolean {
    if (this.playerReady && this.player) {
      return this.player.getPlayerState() === window.YT.PlayerState.PLAYING;
    }
    return false;
  }

  /**
   * Destroy the player
   */
  destroy(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
      this.playerReady = false;
    }
  }
}

// Extend Window interface for YouTube API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}