#!/usr/bin/env python3
"""
构建测试索引

用于测试索引 API 接口。
"""

import sys
from pathlib import Path

# 添加 backend 到路径
sys.path.insert(0, str(Path(__file__).parent))

from app.index_service import IndexService
from app.config import settings

# 创建索引服务
index_service = IndexService(settings.data_root)

# 模拟知识提取结果
mock_extraction_results = [
    {
        "resourceId": "doc-001",
        "results": [
            {
                "chunkId": "chunk-001",
                "knowledgePoints": [
                    {
                        "title": "YashanDB 连接参数配置",
                        "summary": "YashanDB 数据库的连接参数包括 max_connections、timeout 等，用于控制数据库的连接行为。",
                        "keywords": ["YashanDB", "连接参数", "max_connections", "timeout"],
                        "evidenceText": "YashanDB 数据库的连接参数包括 max_connections、timeout 等",
                        "confidence": 0.95
                    },
                    {
                        "title": "错误码 YAS-00001",
                        "summary": "YAS-00001 是 YashanDB 的通用错误码，表示连接失败。",
                        "keywords": ["YAS-00001", "错误码", "连接失败"],
                        "evidenceText": "YAS-00001 是 YashanDB 的通用错误码，表示连接失败",
                        "confidence": 0.90
                    }
                ],
                "entities": [
                    {
                        "name": "max_connections",
                        "type": "Parameter",
                        "evidenceText": "max_connections 参数控制最大连接数"
                    },
                    {
                        "name": "YAS-00001",
                        "type": "ErrorCode",
                        "evidenceText": "YAS-00001 错误码"
                    }
                ],
                "relations": [
                    {
                        "source": "max_connections",
                        "target": "YAS-00001",
                        "type": "AFFECTS",
                        "evidenceText": "max_connections 配置不当可能导致 YAS-00001 错误"
                    }
                ],
                "documentStructure": {
                    "headingPath": ["YashanDB", "配置", "连接参数"]
                }
            }
        ]
    }
]

mock_documents = [
    {
        "resourceId": "doc-001",
        "title": "YashanDB 配置指南",
        "sourcePath": "docs/yashandb-config.md"
    }
]

print("=" * 60)
print("构建测试索引")
print("=" * 60)

# 构建索引
stats = index_service.build_indexes(mock_extraction_results, mock_documents)

print(f"✓ 索引构建完成")
print(f"  - 文档数量: {stats.get('document_count', 0)}")
print(f"  - 提取结果数量: {stats.get('extraction_count', 0)}")
print(f"  - 目录索引: {stats.get('directory', {})}")
print(f"  - 倒排索引: {stats.get('inverted', {})}")
print(f"  - 知识图谱: {stats.get('graph', {})}")

print("\n" + "=" * 60)
print("测试搜索功能")
print("=" * 60)

# 测试搜索
results = index_service.search("YashanDB")
print(f"✓ 搜索 'YashanDB' 结果: {len(results)} 条")
for result in results:
    print(f"  - {result.get('title')} (score: {result.get('score', 0):.2f})")

print("\n" + "=" * 60)
print("测试完成！")
print("=" * 60)
