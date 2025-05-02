import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase'; // Import Firebase Storage instance
import { v4 as uuidv4 } from 'uuid'; // Use UUID for unique filenames

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 *
 * @param file The file object to upload.
 * @param pathPrefix The folder path prefix in Firebase Storage (e.g., 'campaign-logos', 'pod-logos').
 * @returns A promise that resolves to the download URL of the uploaded file.
 * @throws Error if the upload fails.
 */
export async function uploadFile(file: File, pathPrefix: string): Promise<string> {
  if (!file) {
    throw new Error('No file provided for upload.');
  }
   if (!pathPrefix) {
      throw new Error('Storage path prefix is required.');
   }

  // Generate a unique filename to avoid collisions
  const fileExtension = file.name.split('.').pop();
  const uniqueFilename = `${uuidv4()}.${fileExtension}`;
  const storagePath = `${pathPrefix}/${uniqueFilename}`;
  const storageRef = ref(storage, storagePath);

  try {
    console.log(`Uploading file to: ${storagePath}`);
    const snapshot = await uploadBytes(storageRef, file);
    console.log('File uploaded successfully:', snapshot.metadata.name);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Download URL:', downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error.message || 'Unknown error'}`);
  }
}
