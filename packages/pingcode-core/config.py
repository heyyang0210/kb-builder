"""
配置管理模块

从 config/pingcode/credentials.json 加载配置，支持：
- 凭据管理（账号密码）
- 目标页面列表
- 下载策略配置
"""

import json
from pathlib import Path
from typing import Optional

# 默认配置文件路径（相对于项目根目录）
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = REPOSITORY_ROOT / 'config' / 'pingcode' / 'credentials.json'

class PingCodeConfig:
    """PingCode 配置管理器"""
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or DEFAULT_CONFIG_PATH
        self._data = None
    
    def load(self) -> dict:
        """加载配置文件"""
        if self._data is not None:
            return self._data
        
        if not self.config_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {self.config_path}")
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            self._data = json.load(f)
        
        return self._data
    
    @property
    def base_url(self) -> str:
        return self.load().get('base_url', 'https://pingcode.yasdb.com')
    
    @property
    def credentials(self) -> dict:
        return self.load().get('credentials', {})
    
    @property
    def email(self) -> str:
        return self.credentials.get('email', '')
    
    @property
    def password(self) -> str:
        return self.credentials.get('password', '')
    
    @property
    def targets(self) -> list:
        return self.load().get('targets', [])
    
    @property
    def download_strategy(self) -> dict:
        """下载策略配置"""
        return self.load().get('download_strategy', {
            'max_concurrent': 3,
            'timeout': 30,
            'retry_count': 2,
            'file_types': []
        })
    
    def save(self, data: dict):
        """保存配置"""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        self._data = data
    
    def add_target(self, name: str, url: str):
        """添加目标页面"""
        data = self.load()
        if 'targets' not in data:
            data['targets'] = []
        data['targets'].append({'name': name, 'url': url})
        self.save(data)
    
    def validate(self) -> bool:
        """验证配置是否完整"""
        data = self.load()
        creds = data.get('credentials', {})
        return bool(creds.get('email') and creds.get('password'))
