#!/bin/bash

# Docker部署脚本 - Notion API代理服务
# 此脚本简化了Docker容器的部署和管理过程

set -e  # 遇到错误时退出

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 打印带颜色的信息
info() {
    echo -e "${GREEN}[信息]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 检查Docker和Docker Compose是否安装
check_dependencies() {
    info "检查依赖项..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker未安装。请先安装Docker。"
        error "安装文档：https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        error "Docker Compose未安装。请先安装Docker Compose。"
        error "安装文档：https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    info "依赖项检查完成。"
}

# 检查环境变量配置
check_env() {
    info "检查环境变量配置..."
    
    if [ ! -f .env ]; then
        warn "未找到.env文件，从模板创建..."
        if [ -f .env.example ]; then
            cp .env.example .env
            warn "已创建.env文件，请编辑并填入正确的配置值！"
            warn "必需配置项：NOTION_COOKIE, NOTION_SPACE_ID, PROXY_AUTH_TOKEN"
            echo ""
            echo "编辑配置文件："
            echo "  nano .env"
            echo ""
            read -p "配置完成后按回车键继续..."
        else
            error "未找到.env.example模板文件。"
            exit 1
        fi
    fi
    
    # 检查必需的环境变量
    source .env
    if [[ -z "$NOTION_COOKIE" || "$NOTION_COOKIE" == "your_notion_cookie_here" ]]; then
        error "NOTION_COOKIE未正确配置。请编辑.env文件并设置正确的值。"
        exit 1
    fi
    
    if [[ -z "$NOTION_SPACE_ID" || "$NOTION_SPACE_ID" == "your_notion_space_id_here" ]]; then
        error "NOTION_SPACE_ID未正确配置。请编辑.env文件并设置正确的值。"
        exit 1
    fi
    
    if [[ -z "$PROXY_AUTH_TOKEN" || "$PROXY_AUTH_TOKEN" == "your_auth_token_here" ]]; then
        error "PROXY_AUTH_TOKEN未正确配置。请编辑.env文件并设置正确的值。"
        exit 1
    fi
    
    info "环境变量配置检查完成。"
}

# 构建并启动服务
start() {
    info "构建并启动Notion API代理服务..."
    docker compose up -d --build
    
    info "等待服务启动..."
    sleep 5
    
    info "检查服务状态..."
    docker compose ps
    
    # 获取容器状态
    if docker compose ps | grep -q "Up"; then
        info "服务启动成功！"
        info "服务地址：http://localhost:7860"
        info "API文档：查看README.md获取使用方法"
        echo ""
        info "常用命令："
        echo "  查看日志：docker compose logs -f notion-proxy"
        echo "  停止服务：docker compose down"
        echo "  重启服务：docker compose restart"
    else
        error "服务启动失败。请检查日志："
        docker compose logs notion-proxy
    fi
}

# 停止服务
stop() {
    info "停止Notion API代理服务..."
    docker compose down
    info "服务已停止。"
}

# 重启服务
restart() {
    info "重启Notion API代理服务..."
    docker compose restart
    info "服务已重启。"
}

# 显示日志
logs() {
    info "显示服务日志（Ctrl+C退出）..."
    docker compose logs -f notion-proxy
}

# 显示服务状态
status() {
    info "服务状态："
    docker compose ps
    
    if docker compose ps | grep -q "Up"; then
        info "服务运行中"
        # 尝试健康检查
        if curl -s -H "Authorization: Bearer $PROXY_AUTH_TOKEN" http://localhost:7860/v1/models > /dev/null; then
            info "API响应正常"
        else
            warn "API可能无法正常响应"
        fi
    else
        warn "服务未运行"
    fi
}

# 清理（停止并删除容器、网络）
clean() {
    info "清理Docker资源..."
    docker compose down --volumes --remove-orphans
    info "清理完成。"
}

# 显示帮助信息
show_help() {
    echo "Notion API代理服务 Docker部署脚本"
    echo ""
    echo "用法："
    echo "  $0 <命令>"
    echo ""
    echo "可用命令："
    echo "  start   - 构建并启动服务"
    echo "  stop    - 停止服务"
    echo "  restart - 重启服务"
    echo "  status  - 显示服务状态"
    echo "  logs    - 显示服务日志"
    echo "  clean   - 清理Docker资源"
    echo "  help    - 显示此帮助信息"
    echo ""
    echo "示例："
    echo "  $0 start    # 启动服务"
    echo "  $0 logs     # 查看日志"
    echo "  $0 status   # 查看状态"
}

# 主逻辑
case "${1:-help}" in
    start)
        check_dependencies
        check_env
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "未知命令: $1"
        echo ""
        show_help
        exit 1
        ;;
esac