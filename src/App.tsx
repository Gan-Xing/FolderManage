import React, { useCallback, useEffect, useState } from "react";
import { invoke, dialog as tauriDialog } from "@tauri-apps/api";
import { useTranslation } from "react-i18next";
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
  Chip,
} from "@mui/material";
import DynamicHeightList from "./DynamicHeighhtList";
import "./App.css"

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
  const [moreSettings, setMoreSettings] = useState(false); // 新增状态来控制更多设置的显示
  const { t } = useTranslation();

  useEffect(() => {
    const unlisten = listen<string>("folder-found", (event) => {
      setResults((prevResults) => [...prevResults, event.payload]);
    });
    const unlistenNoFoldersFound = listen<string>("no-folders-found", () => {
      setSnackbarMessage(t("not_found_folders"));
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
    if (!useTextInput) {
      setMoreSettings(!moreSettings);
    }
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
      setSnackbarMessage(t("no_path_or_folder_selected"));
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
      setSnackbarMessage(t("no_files_selected"));
      setSnackbarOpen(true);
      return;
    }
    setToDeleteFiles(selectedFiles);
    setOpenDialog(true);
    setDialogContent(t("delete_confirmation"));
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
      setSnackbarMessage(t("files_deleted_success"));
      setSnackbarOpen(true);
      searchNodeModules();
      setIsDeleting(false); // 完成删除后设置状态为false
    } catch (error) {
      console.error("Error invoking delete_folders:", error);
      setSnackbarMessage(t("failed_delete_files"));
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
      alert(`${t("failed_open_file")}: ${error}`);
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

  const handleToggleMoreSettings = () => {
    setMoreSettings(!moreSettings);
  };

  const switches = [
    {
      label: t("manual_input_path_switch"),
      value: useTextInput,
      toggle: toggleInputMethod,
      minWidth: 200,
    },
    {
      label: t("dig_into_subfolders_switch"),
      value: digin,
      toggle: setDigin,
      minWidth: 205,
    },
    {
      label: t("fuzzy_search_switch"),
      value: fuzzy,
      toggle: setFuzzy,
      minWidth: 160,
    },
    {
      label: t("case_sensitive_switch"),
      value: casesense,
      toggle: setCasesense,
      minWidth: 170,
    },
  ];

  return (
    <Box sx={{ p:2,minWidth: 1100,height:"100%",boxSizing: "border-box",display:"flex",flexDirection:'column'}}>
      {moreSettings ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            height: "100%",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                flexWrap: "wrap",
                backgroundColor: "#f5f5f5",
                pt: 2,
                pb: 2,
                borderRadius: "8px",
              }}
            >
              <TextField
                label={t("skip_folder_label")}
                value={skipfolder}
                onChange={(e) => setSkipfolder(e.target.value)}
                variant="outlined"
                size="small"
                sx={{ flex: 1, minWidth: "240px" }}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleAddSkipFolder();
                }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleAddSkipFolder}
              >
                {t("add_button")}
              </Button>
            </Box>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                padding: 1,
                backgroundColor: "#e3f2fd",
                borderRadius: "8px",
                minHeight: 40,
              }}
            >
              {skipfolders.map((folder, index) => (
                <Chip
                  key={index}
                  label={folder}
                  onDelete={() => handleRemoveSkipFolder(index)}
                  color="primary"
                  variant="outlined"
                  sx={{ margin: "4px" }}
                />
              ))}
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                marginTop: 2,
                minHeight: 40,
              }}
            >
              <Typography sx={{ minWidth: "100px" }}>
                {t("search_path_label")}
              </Typography>
              {useTextInput ? (
                <TextField
                  fullWidth
                  variant="outlined"
                  value={selectedPath}
                  onChange={(e) => setSelectedPath(e.target.value)}
                  placeholder={t("select_folder_path_button")}
                />
              ) : (
                <Button
                  variant="outlined"
                  onClick={selectSearchPath}
                  sx={{ flexGrow: 1, Height: "100%" }}
                >
                  {selectedPath || t("select_folder_path_button")}
                </Button>
              )}
            </Box>
          </Box>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleToggleMoreSettings}
            sx={{ alignSelf: "flex-end", mt: 2 }}
          >
            {t("back_button")}
          </Button>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <TextField
              label={t("folder_name_label")}
              value={foldername}
              onChange={(e: {
                target: { value: React.SetStateAction<string> };
              }) => setFoldername(e.target.value)}
              variant="outlined"
              sx={{ flex: 1, margin: "1rem" }}
            />
            <Box>
              {isSearching ? (
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={stopSearch}
                  disabled={!isSearching}
                >
                  {t("stop_search_button")}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={searchNodeModules}
                  disabled={isDeleting}
                  sx={{ mr: 1 }}
                >
                  {t("search_button")}
                </Button>
              )}
              <Button
                variant="contained"
                color="error"
                onClick={deleteSelected}
                disabled={isDeleting}
              >
                {isDeleting ? t("deleting_status") : t("delete_button")}
              </Button>
            </Box>
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Checkbox checked={selectAll} onChange={handleSelectAllChange} />
              <Typography sx={{ minWidth: 70 }}>{t("select_all")}</Typography>
              {switches.map((sw, index) => (
                <FormControlLabel
                  key={index}
                  control={
                    <Switch
                      checked={sw.value}
                      onChange={(e) => sw.toggle(e.target.checked)}
                    />
                  }
                  label={sw.label}
                  sx={{ m: 1, minWidth: `${sw.minWidth}px` }}
                />
              ))}
            </Box>
            <Button
              variant="outlined"
              onClick={handleToggleMoreSettings}
              sx={{ m: 2, minWidth: 160 }}
            >
              {t("more_settings_button")}
            </Button>
          </Box>
          <Typography>
            {t("folders_found", { count: results.length })}
          </Typography>
          <Box sx={{ flex: 1, width: "100%", overflow: "auto" }}>
            <DynamicHeightList
              items={results}
              checkedState={checkedState}
              handleCheckChange={handleCheckChange}
              openDirectory={openDirectory}
            />
          </Box>
          <Dialog open={openDialog} onClose={() => handleDialogClose(false)}>
            <DialogTitle>{t("confirmation_title")}</DialogTitle>
            <DialogContent>
              <DialogContentText>{dialogContent}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleDialogClose(false)}>
                {t("cancel_button")}
              </Button>
              <Button onClick={() => handleDialogClose(true)} autoFocus>
                {t("confirm_button")}
              </Button>
            </DialogActions>
          </Dialog>
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={2500}
            onClose={() => setSnackbarOpen(false)}
            message={snackbarMessage}
          />
        </>
      )}
    </Box>
  );
};

export default App;
