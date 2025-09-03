import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Maximum file size: 100MB (Vercel Pro limit)
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/quicktime'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      }, { status: 413 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}` 
      }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'mp4';
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2);
    const fileName = `video_${timestamp}_${randomString}.${fileExtension}`;
    
    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadsDir, fileName);
    
    await writeFile(filePath, buffer);
    
    // Return the public URL
    const fileUrl = `/uploads/${fileName}`;
    
    return NextResponse.json({ 
      fileUrl,
      fileName: file.name,
      size: file.size,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('ENOSPC')) {
        return NextResponse.json(
          { error: 'Server storage full. Please try again later.' },
          { status: 507 }
        );
      }
      
      if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
        return NextResponse.json(
          { error: 'Server busy. Please try again in a few seconds.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again.' }, 
      { status: 500 }
    );
  }
}

// Set runtime to handle larger payloads
export const runtime = 'nodejs';
export const maxDuration = 30;