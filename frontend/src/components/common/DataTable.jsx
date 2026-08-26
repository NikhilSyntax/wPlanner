import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Box,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';

function DataTable({
  columns,
  data,
  title,
  onEdit,
  onDelete,
  onView,
  onRowClick,
  searchable = true,
  actions = true,
  emptyMessage,
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuClick = (event, row) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleAction = (action) => {
    if (selectedRow) {
      switch (action) {
        case 'view':
          onView?.(selectedRow);
          break;
        case 'edit':
          onEdit?.(selectedRow);
          break;
        case 'delete':
          onDelete?.(selectedRow);
          break;
        default:
          break;
      }
    }
    handleMenuClose();
  };

  // Filter data based on search term
  const filteredData = data.filter((row) =>
    columns.some((column) =>
      String(row[column.field] || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
  );

  // Paginate data
  const paginatedData = filteredData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const renderCellValue = (row, column) => {
    const columnKey = column.field || column.id;
    const value = columnKey ? row?.[columnKey] : undefined;

    if (column.render) {
      // Backward compatible: some pages pass render(row), others render(value, row).
      return column.field ? column.render(value, row) : column.render(row);
    }

    if (column.type === 'chip') {
      return (
        <Chip
          label={value}
          color={column.getColor ? column.getColor(value) : 'default'}
          size="small"
        />
      );
    }

    if (column.type === 'date') {
      return new Date(value).toLocaleDateString();
    }

    return value;
  };

  return (
    <Paper
      sx={{
        width: '100%',
        overflow: 'hidden',
        borderRadius: 3,
        boxShadow:
          '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      }}
    >
      {/* Header */}
      {(title || searchable) && (
        <Box
          sx={{
            p: { xs: 1.5, sm: '12px 20px' },
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {typeof title === 'string' ? (
              <Typography variant="h6" fontWeight={700}>
                {title}
              </Typography>
            ) : (
              title
            )}
          </Box>
          {searchable && (
            <TextField
              size="small"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: { xs: '100%', sm: 220 },
                '& .MuiInputBase-root': { height: 34, borderRadius: 2 },
              }}
            />
          )}
        </Box>
      )}

      {/* Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {columns.map((column) => (
                <TableCell
                  key={column.field || column.id}
                  sx={{
                    fontWeight: 600,
                    color: 'text.secondary',
                    borderBottom: 'none',
                  }}
                >
                  {column.headerName || column.label}
                </TableCell>
              ))}
              {actions && <TableCell sx={{ borderBottom: 'none' }} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  sx={{ textAlign: 'center', py: 6 }}
                >
                  {emptyMessage || (
                    <Typography variant="body2" color="text.secondary">
                      No data available
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow
                  key={row._id || row.id || index}
                  hover={Boolean(onRowClick)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{
                    ...(onRowClick && { cursor: 'pointer' }),
                    '&:hover': {
                      bgcolor: onRowClick ? 'action.hover' : 'grey.50',
                    },
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.field || column.id} sx={{ borderBottom: 'none' }}>
                      {renderCellValue(row, column)}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell sx={{ borderBottom: 'none' }}>
                      <IconButton
                        size="small"
                        onClick={(event) => handleMenuClick(event, row)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={filteredData.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          '.MuiTablePagination-toolbar': {
            px: 3,
            py: 2,
          },
        }}
      />

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {onView && (
          <MenuItem onClick={() => handleAction('view')}>
            <ViewIcon sx={{ mr: 1, fontSize: 18 }} />
            View
          </MenuItem>
        )}
        {onEdit && (
          <MenuItem onClick={() => handleAction('edit')}>
            <EditIcon sx={{ mr: 1, fontSize: 18 }} />
            Edit
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem
            onClick={() => handleAction('delete')}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1, fontSize: 18 }} />
            Delete
          </MenuItem>
        )}
      </Menu>
    </Paper>
  );
}

export default DataTable;
