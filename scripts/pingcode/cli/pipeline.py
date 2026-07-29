#!/usr/bin/env python3
"""
PingCode 完整流水线 CLI

用法：
  python3 scripts/pingcode/cli/pipeline.py              # 处理所有目标
  python3 scripts/pingcode/cli/pipeline.py --headless   # 无头模式
  python3 scripts/pingcode/cli/pipeline.py --target 0   # 只处理第一个目标
"""

import sys
import json
import time
from pathlib import Path

# 添加项目根目录到路径（从 cli/ 向上两级到项目根）
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / 'scripts'))

from pingcode.core.config import PingCodeConfig
from pingcode.core.pipeline import PingCodePipeline


def main():
    import argparse
    parser = argparse.ArgumentParser(description='PingCode 完整流水线')
    parser.add_argument('--headless', action='store_true', help='无头模式')
    parser.add_argument('--target', type=int, help='只处理指定索引的目标')
    
    args = parser.parse_args()
    
    # 加载配置
    config = PingCodeConfig()
    if not config.validate():
        print("✗ 配置验证失败，请检查 config/pingcode.json")
        sys.exit(1)
    
    print("=" * 60)
    print("PingCode 素材下载流水线")
    print("=" * 60)
    print(f"账号：{config.email}")
    print(f"目标：{len(config.targets)} 个页面")
    print(f"输出：refs/pingcode/")
    
    # 如果指定了单个目标
    if args.target is not None:
        if args.target >= len(config.targets):
            print(f"✗ 目标索引 {args.target} 超出范围")
            sys.exit(1)
        config._data['targets'] = [config.targets[args.target]]
    
    # 运行流水线
    output_dir = PROJECT_ROOT / 'refs' / 'pingcode'
    pipeline = PingCodePipeline(config, output_dir, headless=args.headless)
    
    start_time = time.time()
    results = pipeline.run_all()
    elapsed = time.time() - start_time
    
    # 输出结果
    print("\n" + "=" * 60)
    print("流水线完成")
    print("=" * 60)
    
    total_pages = 0
    total_files = 0
    
    for r in results:
        print(f"\n{r['name']}:")
        print(f"  页面：{len(r['pages'])} 个")
        print(f"  文件：{len(r['files'])} 个")
        total_pages += len(r['pages'])
        total_files += len(r['files'])
    
    print(f"\n总计：{total_pages} 页面，{total_files} 文件")
    print(f"耗时：{elapsed:.1f} 秒")
    print(f"输出：{output_dir}")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n✗ 错误：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
