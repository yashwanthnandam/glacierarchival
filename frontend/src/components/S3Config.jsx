import React from 'react';
import { TextField, Button } from '@mui/material';

const S3Config = () => {
  return (
    <form>
      <TextField label="Bucket Name" required />
      <TextField label="Access Key" required />
      <TextField label="Secret Key" required />
      <TextField label="Region" required />
      <Button type="submit">Save</Button>
    </form>
  );
};

export default S3Config;