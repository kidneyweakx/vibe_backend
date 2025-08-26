export function generatePhotoKey(userId: string, format: string = 'png'): string {
  return `photos/${userId}/${Date.now()}.${format}`
}


