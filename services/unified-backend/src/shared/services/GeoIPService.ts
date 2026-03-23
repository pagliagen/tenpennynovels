/**
 * GeoIP Lookup Service
 *
 * Provides IP geolocation for security audit trail.
 * Uses free ipapi.co service (150 req/day limit) with aggressive caching.
 */

import axios from 'axios';
import { logger } from '../utils/logger';

interface GeoLocation {
  country: string;
  city?: string;
}

export class GeoIPService {
  private static cache = new Map<string, GeoLocation>();
  private static CACHE_TTL = 3600000; // 1 hour

  /**
   * Lookup IP geolocation with caching
   */
  static async lookup(ip: string): Promise<GeoLocation> {
    // Return cached result if available
    if (this.cache.has(ip)) {
      return this.cache.get(ip)!;
    }

    // Skip localhost/private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      const result = { country: 'Local', city: 'Local' };
      this.cache.set(ip, result);
      return result;
    }

    try {
      // Free service: ipapi.co (150 req/day)
      const { data } = await axios.get(`https://ipapi.co/${ip}/json/`, {
        timeout: 2000
      });

      const result: GeoLocation = {
        country: data.country_name || 'Unknown',
        city: data.city
      };

      // Cache result
      this.cache.set(ip, result);

      // Auto-expire cache after TTL
      setTimeout(() => this.cache.delete(ip), this.CACHE_TTL);

      return result;
    } catch (error) {
      logger.warn(`GeoIP lookup failed for ${ip}`, error);

      // Return fallback
      const fallback = { country: 'Unknown' };
      this.cache.set(ip, fallback);
      return fallback;
    }
  }

  /**
   * Format location string for display
   */
  static formatLocation(location: GeoLocation): string {
    if (location.city) {
      return `${location.city}, ${location.country}`;
    }
    return location.country;
  }
}
