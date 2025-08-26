export const handleR2Error = (error: any): string => {
  const errorMap: Record<string, string> = {
    CredentialsProviderError: 'Invalid R2 credentials - Check R2_ACCESS_KEY and R2_SECRET_KEY',
    NoSuchBucket: 'Bucket not found - Check R2_BUCKET_NAME',
    AccessDenied: 'Access denied - Check R2 permissions and credentials',
    NetworkingError: 'Network error - Check internet connection',
    InvalidAccessKeyId: 'Invalid access key - Check R2_ACCESS_KEY',
    SignatureDoesNotMatch: 'Invalid secret key - Check R2_SECRET_KEY',
    NoSuchKey: 'File not found'
  }

  const errorName = (error as any).name || (error as any).Code
  return (errorMap as any)[errorName] || `Operation failed: ${(error as any).message || errorName}`
}

export const logError = (operation: string, key: string | null, error: any): void => {
  console.error(`${operation} error${key ? ` for ${key}` : ''}:`, {
    name: (error as any).name,
    code: (error as any).Code,
    message: (error as any).message,
    statusCode: (error as any).$metadata?.httpStatusCode
  })
}


