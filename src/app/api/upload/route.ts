// src/app/api/upload/route.ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

// Maximum file size: 500MB for client uploads (Vercel Blob limit)
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 
  'video/webm', 
  'video/mov', 
  'video/avi', 
  'video/quicktime',
  'video/x-msvideo'
];

export async function POST(request: Request): Promise<NextResponse> {
  console.log('Upload API called');
  
  try {
    const body = (await request.json()) as HandleUploadBody;
    console.log('Request body:', body);

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        console.log('onBeforeGenerateToken called:', { pathname, clientPayload });
        
        // ⚠️ Add authentication/authorization here if needed
        // For now, allowing uploads but with strict content type validation
        
        // Validate file type and size from client payload
        if (clientPayload) {
          try {
            const payload = JSON.parse(clientPayload);
            console.log('Client payload parsed:', payload);
            
            if (payload.fileSize > MAX_FILE_SIZE) {
              const error = `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
              console.error(error);
              throw new Error(error);
            }
            
            if (!ALLOWED_VIDEO_TYPES.includes(payload.fileType)) {
              const error = `Invalid file type. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}`;
              console.error(error);
              throw new Error(error);
            }
          } catch (parseError) {
            console.error('Error parsing client payload:', parseError);
            throw new Error('Invalid client payload');
          }
        }

        const tokenConfig = {
          allowedContentTypes: ALLOWED_VIDEO_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            uploadedAt: new Date().toISOString(),
            // Add any additional metadata you want to track
          }),
        };
        
        console.log('Token config:', tokenConfig);
        return tokenConfig;
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // ⚠️ This will not work on `localhost` - use ngrok for local development
        console.log('Video upload completed:', {
          url: blob.url,
          pathname: blob.pathname,
          tokenPayload
        });

        try {
          // Here you could automatically add the video to your database
          // For now, we'll let the client handle this after upload completion
          console.log('Upload completion processing finished successfully');
          
        } catch (error) {
          console.error('Error processing completed upload:', error);
          // Don't throw here to avoid webhook retries
        }
      },
    });

    console.log('handleUpload response:', jsonResponse);
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Upload API error:', error);
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}

// Ensure the API route can handle the upload flow
export const runtime = 'nodejs';
export const maxDuration = 60;