"""
Agent 基类和数据结构
"""

from __future__ import annotations

from typing import Any, Dict, List, Callable
from dataclasses import dataclass, field


@dataclass
class AgentTask:
    """Agent 任务定义"""
    task_id: str
    input_data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """Agent 执行结果"""
    output_data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取输出数据中的字段"""
        return self.output_data.get(key, default)


class AgentState:
    """Agent 状态管理"""
    
    def __init__(self):
        self._data: Dict[str, Any] = {}
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取状态值"""
        return self._data.get(key, default)
    
    def set(self, key: str, value: Any):
        """设置状态值"""
        self._data[key] = value
    
    def update(self, data: Dict[str, Any]):
        """批量更新状态"""
        self._data.update(data)
    
    def get_all(self) -> Dict[str, Any]:
        """获取所有状态"""
        return self._data.copy()
    
    def clear(self):
        """清空状态"""
        self._data.clear()


class ToolRegistry:
    """工具注册表"""
    
    def __init__(self):
        self._tools: Dict[str, Callable] = {}
    
    def register(self, name: str, tool_func: Callable):
        """注册工具"""
        self._tools[name] = tool_func
    
    def get(self, name: str) -> Callable:
        """获取工具"""
        if name not in self._tools:
            raise KeyError(f"工具未注册: {name}")
        return self._tools[name]
    
    def has(self, name: str) -> bool:
        """检查工具是否已注册"""
        return name in self._tools
    
    def list_tools(self) -> List[str]:
        """列出所有已注册的工具"""
        return list(self._tools.keys())


class BaseAgent:
    """Agent 基类"""
    
    def __init__(self, agent_id: str, config: Dict[str, Any]):
        """
        初始化 Agent
        
        Args:
            agent_id: Agent 标识符
            config: 配置字典
        """
        self.agent_id = agent_id
        self.config = config
        self.state = AgentState()
        self.tools = ToolRegistry()
    
    def execute(self, task: AgentTask) -> AgentResult:
        """
        执行任务（子类必须实现）
        
        Args:
            task: 任务定义
            
        Returns:
            AgentResult: 执行结果
        """
        raise NotImplementedError("子类必须实现 execute() 方法")
    
    def register_tool(self, tool_name: str, tool_func: Callable):
        """注册工具"""
        self.tools.register(tool_name, tool_func)
    
    def get_tool(self, tool_name: str) -> Callable:
        """获取工具"""
        return self.tools.get(tool_name)
