"""
CAS 登录客户端

支持：
- CAS 单点登录
- 持久化浏览器会话（Cookie 缓存）
- 自动重登录
"""

from pathlib import Path
from playwright.sync_api import sync_playwright, Page, BrowserContext
from .config import PingCodeConfig

class PingCodeClient:
    """PingCode CAS 登录客户端"""
    
    def __init__(self, config: PingCodeConfig, headless: bool = True, login_url: str | None = None):
        self.config = config
        self.headless = headless
        self.login_url = login_url
        self._playwright = None
        self._browser = None
        self._page = None
    
    @property
    def user_data_dir(self) -> Path:
        """浏览器会话数据目录"""
        return Path(__file__).parent.parent.parent / '.browser-data' / 'pingcode'
    
    def start(self) -> Page:
        """启动浏览器并登录"""
        self._playwright = sync_playwright().start()
        
        self.user_data_dir.mkdir(parents=True, exist_ok=True)
        
        self._browser = self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.user_data_dir),
            headless=self.headless,
            viewport={'width': 1920, 'height': 1080}
        )
        
        self._page = self._browser.pages[0] if self._browser.pages else self._browser.new_page()
        
        # 检查是否需要登录
        if not self._is_logged_in():
            self._login()
        
        return self._page
    
    def _is_logged_in(self) -> bool:
        """检查是否已登录"""
        try:
            self._page.goto(self.config.base_url + '/wiki', wait_until='domcontentloaded', timeout=10000)
            self._page.wait_for_timeout(2000)
            return 'login' not in self._page.url.lower() and 'Login' not in self._page.title()
        except Exception:
            return False
    
    def _login(self):
        """执行 CAS 登录"""
        email = self.config.email
        password = self.config.password
        
        if not email or not password:
            raise ValueError("账号密码未配置")
        
        # 访问任意页面触发 CAS 重定向
        target_url = self.login_url or f"{self.config.base_url}/wiki"
        self._page.goto(target_url, wait_until='domcontentloaded', timeout=30000)
        self._page.wait_for_timeout(3000)
        
        # 检查是否重定向到登录页
        if 'login' not in self._page.url.lower() and 'Login' not in self._page.title():
            return  # 已登录
        
        # 填写 CAS 登录表单
        self._page.wait_for_selector('input[name="username"]', timeout=15000)
        self._page.fill('input[name="username"]', email)
        self._page.fill('input[name="password"]', password)
        self._page.click('input[type="submit"], button[type="submit"]')
        self._page.wait_for_load_state('networkidle', timeout=30000)
        self._page.wait_for_timeout(3000)
        
        # 验证登录结果
        if 'login' in self._page.url.lower():
            raise RuntimeError("登录失败，请检查账号密码")
    
    def navigate(self, url: str, wait_time: int = 5000) -> Page:
        """导航到指定页面"""
        self._page.goto(url, wait_until='domcontentloaded', timeout=30000)
        self._page.wait_for_timeout(wait_time)
        return self._page
    
    def close(self):
        """关闭浏览器"""
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
