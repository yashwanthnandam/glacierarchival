import React from 'react';
import { DataGrid } from '@mui/x-data-grid';

const ArchiveList = () => {
  const columns = [
    { field: 'id', headerName: 'ID', width: 90 },
    { field: 'name', headerName: 'File Name', width: 150 },
    { field: 'status', headerName: 'Status', width: 150 },
    { field: 'archive', headerName: 'Archive', width: 150, renderCell: (params) => <button>Archive</button> },
    { field: 'restore', headerName: 'Restore', width: 150, renderCell: (params) => <button>Restore</button> },
  ];

  const rows = [];
  return <DataGrid rows={rows} columns={columns} pageSize={5} />;
};

export default ArchiveList;