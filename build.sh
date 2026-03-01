#!/bin/bash

# 清理 dist 目录
rm -rf dist
mkdir -p dist

# 如果 node_modules 不存在则安装依赖
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# 构建 TypeScript 代码
echo "Building TypeScript..."
./node_modules/.bin/tsc

# 设置 JavaScript 文件为可执行
echo "Making JavaScript files executable..."
chmod +x dist/src/index.js

echo "Build completed successfully!"
echo "You can now run the server with: node dist/src/index.js /path/to/your/database.db"