export interface BaseEventFields {
  title: string
  description?: string
  startsAt: Date
  endsAt?: Date
  // Event page URL (separate from image URL)
  eventUrl?: string
}

// For creating via base64 upload to R2
export interface CreateEventWithUploadParams extends BaseEventFields {
  imageBase64: string
}

// For creating via external URL (no upload)
export interface CreateEventWithExternalParams extends BaseEventFields {
  externalUrl: string
}

export type CreateEventParams = CreateEventWithUploadParams | CreateEventWithExternalParams

export interface UpdateEventParams {
  eventId: string
  title?: string
  description?: string
  startsAt?: Date
  endsAt?: Date
  // Supply one of the following to replace image
  newImageBase64?: string
  externalUrl?: string
  // Update event page URL (separate from image URL)
  eventUrl?: string
}

// Backward compat for existing upload service
export type UploadEventParams = CreateEventWithUploadParams


