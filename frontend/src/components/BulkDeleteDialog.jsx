import React, { memo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import {
  Delete,
} from '@mui/icons-material';

const BulkDeleteDialog = memo(({ 
  open, 
  count, 
  onClose, 
  onConfirm 
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Delete color="error" />
        Confirm Bulk Delete
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          Are you sure you want to delete <strong>{count}</strong> items?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This action cannot be undone. All selected files and folders will be permanently removed.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          startIcon={<Delete />}
        >
          Delete {count} Items
        </Button>
      </DialogActions>
    </Dialog>
  );
});

BulkDeleteDialog.displayName = 'BulkDeleteDialog';

export default BulkDeleteDialog;

