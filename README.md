# FolderManage - Efficient Directory Management

## Introduction

FolderManage is a Tauri-based application tailored for developers and individuals who deal with extensive file systems. It simplifies the management of deeply nested directory structures, such as `node_modules`, by providing powerful search and deletion tools that prevent the overwhelming clutter typical of such environments.

## Features

- **Customizable Search**: Define specific search keywords and stop directories.
- **Dynamic Control**: Easily interrupt search or deletion processes.
- **Efficient Navigation**: Open and select directories directly through the app.
- **Safety Features**: Confirm before deleting files, ensuring data integrity.
- **Performance Optimizations**: Enhanced algorithms for faster search and deletion.
- **User Interface**: Clean, responsive layout with virtual listing and pagination.

## Getting Started

### Prerequisites

- Install [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/).
- Ensure [Rust](https://www.rust-lang.org/) is installed for Tauri.

### Setup

```bash
# Clone the repository
git clone https://github.com/Gan-Xing/FolderManage.git

# Navigate into the project directory
cd foldermanage

# Install dependencies
pnpm install

# Start the development server
pnpm tauri dev

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) with the [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) plugins.

## Contribution

Contributions are welcome! Please read the contribution guidelines in `CONTRIBUTING.md`.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
