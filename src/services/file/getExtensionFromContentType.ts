export function getExtensionFromContentType(contentType?: string): string {
  switch ((contentType || '').toLowerCase()) {
    case 'image/webp':
      return 'webp'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/gif':
      return 'gif'
    default:
      return 'png'
  }
}


