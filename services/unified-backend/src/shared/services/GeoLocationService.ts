// =============================================================================
// GeoLocation Service - Rilevamento Città Italiane da IP
// =============================================================================

import { logger } from '@shared/utils/logger';

// Validate IPv4 and IPv6 addresses to prevent SSRF attacks
function isValidIPAddress(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;

  // IPv4 pattern
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(ip)) {
    return ip.split('.').every(octet => {
      const num = Number.parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 pattern (simplified)
  const ipv6 = /^([\da-f]{0,4}:){2,7}[\da-f]{0,4}$/i;
  return ipv6.test(ip);
}

interface IpApiResponse {
  error?: boolean;
  country_code?: string;
  city?: string;
  region?: string;
}

interface IpBaseResponse {
  country_code?: string;
  city?: string;
  region?: string;
}

interface IpInfoResponse {
  bogon?: boolean;
  country?: string;
  city?: string;
  region?: string;
}

interface GeoLocationResult {
  country: string;
  city: string;
  region?: string;
  isItalian: boolean;
}

export class GeoLocationService {
  /**
   * Determina la città italiana dall'IP address
   * Supporta diversi servizi di geolocalizzazione
   */
  static async getCityFromIP(ipAddress: string): Promise<GeoLocationResult> {
    // Skip per IP locali e privati
    if (this.isLocalIP(ipAddress)) {
      return {
        country: 'Italia',
        city: '',
        region: '',
        isItalian: true
      }
    }

    try {
      // Prova prima con ipinfo.io (più accurato per città italiane, 50k richieste/mese)
      let result = await this.getLocationFromIPInfo(ipAddress);
      if (result) return result;

      // Fallback a ipbase.com (buona accuratezza, gratuito)
      result = await this.getLocationFromIPBase(ipAddress);
      if (result) return result;

      // Fallback a ipapi.co (meno accurato per cittadine italiane)
      result = await this.getLocationFromIPAPICO(ipAddress);
      if (result) return result;

      // Fallback finale ai dati mock
      return {
        country: 'Italia',
        city: '',
        region: '',
        isItalian: true
      }

    } catch (error: any) {
      logger.error('GeoLocation error:', error);
      return {
        country: 'Italia',
        city: '',
        region: '',
        isItalian: true
      };
    }
  }

  /**
   * Servizio ipapi.co (gratuito, 1000 richieste/giorno)
   */
  private static async getLocationFromIPAPICO(ipAddress: string): Promise<GeoLocationResult | null> {
    // Validate IP address to prevent SSRF attacks
    if (!isValidIPAddress(ipAddress)) {
      logger.warn('Invalid IP address for IPAPI.CO request', { ipAddress });
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TenPennyNovels-Analytics/1.0'
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      
      const data = await response.json() as IpApiResponse;
      
      if (data.error) return null;

      const isItalian = data.country_code === 'IT';
      
      return {
        country: isItalian ? 'Italia' : 'Non Italiano',
        city: isItalian ? (data.city ?? '') : 'Estero',
        region: data.region ?? '',
        isItalian
      };

    } catch (error: unknown) {
      logger.error('IPAPI.CO error:', error);
      return null;
    }
  }

  /**
   * Servizio ipbase.com (gratuito, accurato per città italiane)
   */
  private static async getLocationFromIPBase(ipAddress: string): Promise<GeoLocationResult | null> {
    // Validate IP address to prevent SSRF attacks
    if (!isValidIPAddress(ipAddress)) {
      logger.warn('Invalid IP address for IPBASE.COM request', { ipAddress });
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`https://api.ipbase.com/v1/json/${ipAddress}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TenPennyNovels-Analytics/1.0'
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      
      const data = await response.json() as IpBaseResponse;
      
      if (!data.country_code) return null;

      const isItalian = data.country_code === 'IT';
      
      return {
        country: isItalian ? 'Italia' : 'Non Italiano',
        city: isItalian ? (data.city ?? '') : 'Estero',
        region: data.region ?? '',
        isItalian
      };

    } catch (error: unknown) {
      logger.error('IPBASE.COM error:', error);
      return null;
    }
  }

  /**
   * Servizio ipinfo.io (gratuito, 50k richieste/mese, TESTATO ACCURATO per Terni)
   */
  private static async getLocationFromIPInfo(ipAddress: string): Promise<GeoLocationResult | null> {
    // Validate IP address to prevent SSRF attacks
    if (!isValidIPAddress(ipAddress)) {
      logger.warn('Invalid IP address for IPINFO.IO request', { ipAddress });
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`https://ipinfo.io/${ipAddress}/json`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TenPennyNovels-Analytics/1.0'
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      
      const data = await response.json() as IpInfoResponse;
      
      if (data.bogon) return null; // IP privato/riservato

      const isItalian = data.country === 'IT';
      
      return {
        country: isItalian ? 'Italia' : 'Non Italiano',
        city: isItalian ? (data.city ?? '') : 'Estero',
        region: data.region ?? '',
        isItalian
      };

    } catch (error: unknown) {
      logger.error('IPINFO.IO error:', error);
      return null;
    }
  }  

  /**
   * Verifica se l'IP è locale/privato
   */
  private static isLocalIP(ipAddress: string): boolean {
    if (!ipAddress || ipAddress === 'unknown') return true;
    
    const localPatterns = [
      /^127\./,          // Localhost
      /^192\.168\./,     // Private Class C
      /^10\./,           // Private Class A
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private Class B
      /^::1$/,           // IPv6 localhost
      /^fc00:/,          // IPv6 private
      /^fe80:/           // IPv6 link-local
    ];

    return localPatterns.some(pattern => pattern.test(ipAddress));
  }

  /**
   * Per abilitare geolocalizzazione reale in produzione
   */
  static enableRealGeoLocation(): void {
    logger.warn('Per abilitare geolocalizzazione reale:');
    logger.info('1. Registrarsi su https://ip-api.com per limiti più alti');
    logger.info('2. Oppure usare MaxMind GeoLite2 con API key');
    logger.info('3. Configurare variabili ambiente GEOLOCATION_SERVICE e API_KEY');
  }
}

export default GeoLocationService;