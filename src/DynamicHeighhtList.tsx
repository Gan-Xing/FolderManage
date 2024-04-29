import React, { useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Box, Checkbox, Typography, IconButton } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import {useResizeObserver} from "./useResizeObserver"

interface DynamicHeightListProps {
  items: string[];
  checkedState: Record<string, boolean>;
  handleCheckChange: (file: string) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  openDirectory: (path: string) => void;
}

const DynamicHeightList: React.FC<DynamicHeightListProps> = ({
  items,
  checkedState,
  handleCheckChange,
  openDirectory,
}) => {
  const listContainerRef = useRef<HTMLDivElement>(null);
  const { height } = useResizeObserver(listContainerRef);

  return (
    <div ref={listContainerRef} style={{ flex: 1, minHeight: '100px', height: '100%' }}>
      {height > 0 && (
        <List
          height={height}
          itemCount={items.length}
          itemSize={50}
          width='100%'
          itemData={items}
        >
          {({ index, style }) => (
            <Box
              style={style}
              sx={{
                display: 'flex',
                alignItems: 'center',
                height: '50px',
                bgcolor: index % 2 ? 'action.hover' : 'background.paper',
              }}
            >
              <Checkbox
                checked={!!checkedState[items[index]]}
                onChange={handleCheckChange(items[index])}
              />
              <Typography
                noWrap
                sx={{
                  flexGrow: 1,
                  color: index % 2 ? 'secondary.main' : 'primary.main',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {items[index]}
              </Typography>
              <IconButton
                onClick={() => openDirectory(items[index])}
                color='primary'
                size='small'
              >
                <FolderOpenIcon />
              </IconButton>
            </Box>
          )}
        </List>
      )}
    </div>
  );
};

export default DynamicHeightList;
