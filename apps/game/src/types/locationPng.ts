/**
 * Location PNG persona types
 * Lightweight name+avatar personas scoped to a location (e.g. "il barista",
 * "il maggiordomo"), usable by the location owner and by master to override
 * their posted name/avatar. Max 20 per location.
 */

export interface LocationPng {
  _id: string;
  name: string;
  surname?: string;
  avatar?: string;
  createdAt: string;
  createdBy: string;
}

export interface LocationPngListResponse {
  locationPngs: LocationPng[];
}

export interface CreateLocationPngRequest {
  name: string;
  surname?: string;
  avatar?: string;
}
