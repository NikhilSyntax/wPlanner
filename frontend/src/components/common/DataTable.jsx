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
      elevation={0}
      sx={{
        width: '100%',
        overflow: 'hidden',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      {(title || searchable) && (
        <Box
          sx={{
            p: { xs: 1.25, sm: '10px 16px' },
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.25,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {typeof title === 'string' ? (
              <Typography variant="subtitle1" fontWeight={700} sx={{ letterSpacing: '-0.01em' }}>
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
                    <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: { xs: '100%', sm: 200 },
                '& .MuiInputBase-root': { height: 32, fontSize: '0.8125rem' },
              }}
            />
          )}
        </Box>
      )}

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.field || column.id}
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    bgcolor: (th) => th.palette.mode === 'dark' ? '#0c0c0c' : '#f8fafc',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    py: 1,
                  }}
                >
                  {column.headerName || column.label}
                </TableCell>
              ))}
              {actions && (
                <TableCell
                  sx={{
                    bgcolor: (th) => th.palette.mode === 'dark' ? '#0c0c0c' : '#f8fafc',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    width: 48,
                    py: 1,
                  }}
                />
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  sx={{ textAlign: 'center', py: 5, borderBottom: 'none' }}
                >
                  {emptyMessage || (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
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
                      bgcolor: 'action.hover',
                    },
                    transition: 'background-color 100ms ease',
                  }}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.field || column.id}
                      sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        py: 1.1,
                      }}
                    >
                      {renderCellValue(row, column)}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell
                      sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        py: 1.1,
                        textAlign: 'right',
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={(event) => handleMenuClick(event, row)}
                        sx={{ p: 0.5 }}
                      >
                        <MoreVertIcon sx={{ fontSize: 18 }} />
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
