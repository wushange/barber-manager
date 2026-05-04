#!/bin/bash

# 理发会员管理系统 - 本地持久化版本启动脚本
# 数据存储在本地 JSON 文件，每周自动备份

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  理发会员管理系统 - 本地版${NC}"
echo -e "${BLUE}  数据持久化存储 + 自动备份${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未安装 Node.js${NC}"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}错误: Node.js 版本过低 (需要 >= 16)${NC}"
    echo "当前版本: $(node -v)"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 版本: $(node -v)${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未安装 npm${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm 版本: $(npm -v)${NC}"
echo ""

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ 未找到依赖，正在安装...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}错误: 依赖安装失败${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
    echo ""
fi

# 构建前端
echo -e "${BLUE}构建前端...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}错误: 构建失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 构建完成${NC}"
echo ""

# 查找可用端口
find_available_port() {
    local port=$1
    while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; do
        port=$((port + 1))
    done
    echo $port
}

PORT=$(find_available_port 3456)

echo -e "${BLUE}启动本地服务器...${NC}"
echo ""

# 数据目录信息
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  服务已启动！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  访问地址: ${YELLOW}http://localhost:$PORT/${NC}"
echo ""
echo -e "  ${BLUE}数据存储:${NC}"
echo -e "    - 数据文件: ${SCRIPT_DIR}/data/"
echo -e "    - 自动备份: ${SCRIPT_DIR}/backups/"
echo ""
echo -e "  ${BLUE}按 Ctrl+C 停止服务${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo ""

# 自动打开浏览器（macOS）
if [[ "$OSTYPE" == "darwin"* ]]; then
    sleep 1
    open "http://localhost:$PORT/"
fi

# 启动服务器
PORT=$PORT node server.js
