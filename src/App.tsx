import React, { useCallback, useEffect, useState} from "react";
import { FixedSizeList as List } from "react-window";
import { invoke, dialog as tauriDialog } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import {
  Box,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
  Checkbox,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

const App = () => {
  const [selectedPath, setSelectedPath] = useState("/");
  const [useTextInput, setUseTextInput] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [openDialog, setOpenDialog] = useState(false); // 控制对话框开关
  const [dialogContent, setDialogContent] = useState(""); // 对话框内容
  const [toDeleteFiles, setToDeleteFiles] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false); // 管理删除状态
  const [foldername, setFoldername] = useState("node_modules");
  const [skipfolder, setSkipfolder] = useState("");
  const [skipfolders, setSkipfolders] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [digin, setDigin] = useState(false);
  const [fuzzy, setFuzzy] = useState(false);
  const [casesense, setCasesense] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const unlisten = listen<string>("folder-found", (event) => {
      setResults((prevResults) => [...prevResults, event.payload]);
    });
    const unlistenNoFoldersFound = listen<string>("no-folders-found", () => {
      setSnackbarMessage("未找到相关目录");
      setSnackbarOpen(true);
    });

    return () => {
      unlisten.then((resolve) => resolve());
      unlistenNoFoldersFound.then((resolve) => resolve());
    };
  }, []);

  useEffect(() => {
    if (selectAll) {
      const newCheckedState = results.reduce<{ [key: string]: boolean }>(
        (acc, result) => {
          acc[result] = true;
          return acc;
        },
        {}
      ); // 初始值也应该符合这种类型
      setCheckedState(newCheckedState);
    } else {
      setCheckedState({});
    }
  }, [selectAll, results]);

  const stopSearch = async () => {
    try {
      await invoke("stop_search");
      setIsSearching(false);
    } catch (error) {
      console.error("Error stopping the search:", error);
    }
  };

  const handleSelectAllChange = (event: {
    target: { checked: boolean | ((prevState: boolean) => boolean) };
  }) => {
    setSelectAll(event.target.checked);
  };

  const toggleInputMethod = () => {
    setUseTextInput(!useTextInput);
  };

  const selectSearchPath = async () => {
    try {
      const path = await tauriDialog.open({ directory: true, multiple: false });
      if (path) {
        setSelectedPath(path as string);
      }
    } catch (error) {
      console.error("Error selecting directory:", error);
    }
  };

  const searchNodeModules = async () => {
    if (!selectedPath || !foldername) {
      setSnackbarMessage("Please select a path and folder name first.");
      setSnackbarOpen(true);
      return;
    }

    setResults([]);
    setCheckedState({});
    setIsSearching(true);

    try {
      await invoke("search_folders", {
        path: selectedPath,
        foldername,
        skipfolders,
        digin,
        fuzzy,
        casesense,
      });
      setIsSearching(false);
    } catch (error) {
      console.error("Error invoking search_folders:", error);
      setIsSearching(false);
    }
  };

  const handleCheckChange = useCallback(
    (file: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setCheckedState((prev) => ({ ...prev, [file]: event.target.checked }));
    },
    []
  );

  const deleteSelected = async () => {
    const selectedFiles = results.filter((file) => checkedState[file]);
    if (selectedFiles.length === 0) {
      setSnackbarMessage("No files selected.");
      setSnackbarOpen(true);
      return;
    }
    setToDeleteFiles(selectedFiles);
    setOpenDialog(true);
    setDialogContent("Are you sure you want to delete the selected files?");
  };

  const handleDialogClose = async (confirm: boolean) => {
    setOpenDialog(false);
    if (confirm) {
      setTimeout(() => performDeletion(toDeleteFiles), 0);
    }
  };

  const performDeletion = async (files: string[]) => {
    try {
      setIsDeleting(true); // 设置删除状态为true
      await invoke("delete_folders", { paths: files });
      setSnackbarMessage("Files deleted successfully.");
      setSnackbarOpen(true);
      searchNodeModules();
      setIsDeleting(false); // 完成删除后设置状态为false
    } catch (error) {
      console.error("Error invoking delete_folders:", error);
      setSnackbarMessage("Failed to delete files.");
      setSnackbarOpen(true);
    }
  };

  const openDirectory = async (path: string) => {
    console.log(`Attempting to open directory: ${path}`);
    try {
      await invoke("open_directory", { path });
      console.log(`Directory opened successfully: ${path}`);
    } catch (error) {
      console.error(`Failed to open directory: ${path}`, error);
      alert(`Failed to open directory: ${error}`);
    }
  };

  const handleAddSkipFolder = () => {
    if (!skipfolder) return; // 如果当前输入为空，则不做任何操作
    setSkipfolders((prev) => [...prev, skipfolder]);
    setSkipfolder(""); // 清空输入框
  };

  const handleRemoveSkipFolder = (index: number) => {
    setSkipfolders((prev) => prev.filter((_, i) => i !== index)); // 移除指定索引的跳过文件夹
  };

  return (
    <Box sx={{ padding: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <TextField
          label="Folder Name"
          value={foldername}
          onChange={(e: { target: { value: React.SetStateAction<string> } }) =>
            setFoldername(e.target.value)
          }
          variant="outlined"
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <TextField
            label="Skip Folder"
            value={skipfolder}
            onChange={(e) => setSkipfolder(e.target.value)}
            variant="outlined"
            onKeyPress={(e) => {
              if (e.key === "Enter") handleAddSkipFolder();
            }}
          />
          <Button variant="outlined" onClick={handleAddSkipFolder}>
            Add
          </Button>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", mb: 2 }}>
          {skipfolders.map((folder, index) => (
            <Box
              key={index}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography>{folder}</Typography>
              <IconButton onClick={() => handleRemoveSkipFolder(index)}>
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
        </Box>

        <Box>
          <Button
            variant="contained"
            onClick={searchNodeModules}
            disabled={isDeleting}
          >
            {isSearching ? "Searching..." : "Search"}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={stopSearch}
            disabled={!isSearching}
          >
            Stop Search
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={deleteSelected}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Selected"}
          </Button>
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center", // 垂直居中对齐
          justifyContent: "flex-start", // 水平从左边开始排列
          mt: 2, // 上边距
          width: "100%", // 占满容器宽度
          height: "4rem",
        }}
      >
        <Typography
          sx={{
            width: "120px", // 固定宽度，根据内容最大宽度调整
            textAlign: "left", // 文字靠右对齐
            mr: 2, // 右边距
          }}
        >
          Search Path
        </Typography>
        {useTextInput ? (
          <TextField
            fullWidth // 充满剩余空间
            variant="outlined"
            value={selectedPath}
            onChange={(e: {
              target: { value: React.SetStateAction<string> };
            }) => setSelectedPath(e.target.value)}
            placeholder="Enter path to search"
            sx={{ flex: 1, mx: 2 }} // 使用 sx 属性控制样式，设置左右边距
          />
        ) : (
          <Button
            onClick={selectSearchPath}
            sx={{ flex: 1, mx: 2, height: "56px" }} // 设置按钮也充满剩余空间，同样设置左右边距
          >
            {selectedPath || "Select Folder Path"}
          </Button>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Checkbox checked={selectAll} onChange={handleSelectAllChange} />
        <Typography>Select All</Typography>
        <FormControlLabel
          control={
            <Switch checked={useTextInput} onChange={toggleInputMethod} />
          }
          label="Manual Input Path?"
          sx={{ mx: 2 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={digin}
              onChange={(e) => setDigin(e.target.checked)}
            />
          }
          label="Dig into subfolders?"
          sx={{ mx: 2 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={fuzzy}
              onChange={(e) => setFuzzy(e.target.checked)}
            />
          }
          label="Fuzzy Search"
          sx={{ mx: 2 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={casesense}
              onChange={(e) => setCasesense(e.target.checked)}
            />
          }
          label="Case Sensitive"
          sx={{ mx: 2 }}
        />
      </Box>
      <Typography>{`找到 ${results.length} 个文件夹`}</Typography>
      
      <Box sx={{ height: 400, width: "100%", overflow: "auto" }}>
        <List
          height={400}
          width="100%"
          itemCount={results.length}
          itemSize={50}
          itemData={results}
        >
          {({ index, style }) => (
            <Box
              style={style}
              sx={{
                display: "flex",
                alignItems: "center",
                height: "50px",
                bgcolor: index % 2 ? "action.hover" : "background.paper",
              }}
            >
              <Checkbox
                checked={!!checkedState[results[index]]}
                onChange={handleCheckChange(results[index])}
              />
              <Typography
                noWrap
                sx={{
                  flexGrow: 1,
                  color: index % 2 ? "secondary.main" : "primary.main",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {results[index]}
              </Typography>
              <IconButton
                onClick={() => openDirectory(results[index])}
                color="primary"
                size="small"
              >
                <FolderOpenIcon />
              </IconButton>
            </Box>
          )}
        </List>
      </Box>

      <Dialog open={openDialog} onClose={() => handleDialogClose(false)}>
        <DialogTitle>{"Confirmation"}</DialogTitle>
        <DialogContent>
          <DialogContentText>{dialogContent}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDialogClose(false)}>Cancel</Button>
          <Button onClick={() => handleDialogClose(true)} autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2500}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default App;
