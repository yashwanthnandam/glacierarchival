import React from 'react';
import DirectoryUploader from '../components/DirectoryUploader';

const UploadPage = () => {
  const handleUploadComplete = (results) => {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    alert(`Upload completed! ${successful.length} files uploaded successfully, ${failed.length} failed.`);
  };

  const handleUploadProgress = (percentage, fileName) => {
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Glacier Archival Platform
          </h1>
          <p className="text-lg text-gray-600">
            Upload your files directly to S3
          </p>
        </div>
        
        <DirectoryUploader 
          onUploadComplete={handleUploadComplete}
          onUploadProgress={handleUploadProgress}
        />
      </div>
    </div>
  );
};

export default UploadPage;
