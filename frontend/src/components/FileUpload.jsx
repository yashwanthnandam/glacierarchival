import React from 'react';
import { DropzoneArea } from 'material-ui-dropzone';

const FileUpload = () => {
  const handleDrop = (files) => {
    // handle file upload logic
  };

  return <DropzoneArea onDrop={handleDrop} />;
};

export default FileUpload;