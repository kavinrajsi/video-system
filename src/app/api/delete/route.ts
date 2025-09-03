import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json();
    
    if (!fileName) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    // Extract just the filename from the URL if full URL is provided
    const actualFileName = fileName.startsWith('/uploads/') 
      ? fileName.replace('/uploads/', '') 
      : fileName;

    const filePath = path.join(process.cwd(), 'public', 'uploads', actualFileName);
    
    // Check if file exists and delete it
    if (existsSync(filePath)) {
      await unlink(filePath);
      return NextResponse.json({ message: 'File deleted successfully' });
    } else {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' }, 
      { status: 500 }
    );
  }
}