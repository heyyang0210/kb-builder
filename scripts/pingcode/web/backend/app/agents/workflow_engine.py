"""
工作流引擎

支持步骤编排、并行执行、重试机制和状态管理。
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Callable, Optional
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
from enum import Enum

logger = logging.getLogger(__name__)


class StepStatus(Enum):
    """步骤状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WorkflowStep:
    """工作流步骤定义"""
    id: str
    name: str
    execute_fn: Callable[[Dict[str, Any]], Dict[str, Any]]
    input_keys: List[str]
    output_keys: List[str]
    parallel: bool = False
    parallel_item_key: str = "items"
    retry_count: int = 0
    timeout_seconds: Optional[float] = None


@dataclass
class StepExecution:
    """步骤执行记录"""
    step_id: str
    status: StepStatus
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None
    item_count: int = 0


class WorkflowState:
    """工作流状态管理"""
    
    def __init__(self):
        self._data: Dict[str, Any] = {}
        self._execution_log: List[StepExecution] = []
    
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
    
    def get_many(self, keys: List[str]) -> Dict[str, Any]:
        """获取多个状态值"""
        return {key: self._data.get(key) for key in keys}
    
    def log_step(self, execution: StepExecution):
        """记录步骤执行"""
        self._execution_log.append(execution)
    
    @property
    def execution_log(self) -> List[StepExecution]:
        """获取执行日志"""
        return list(self._execution_log)


class WorkflowEngine:
    """工作流引擎"""
    
    def __init__(self, workflow_id: str, max_workers: int = 5):
        """
        初始化工作流引擎
        
        Args:
            workflow_id: 工作流标识符
            max_workers: 并行执行的最大线程数
        """
        self.workflow_id = workflow_id
        self.max_workers = max_workers
        self.steps: List[WorkflowStep] = []
        self.state = WorkflowState()
    
    def add_step(self, step: WorkflowStep):
        """添加步骤"""
        self.steps.append(step)
    
    def execute(self, initial_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行工作流
        
        Args:
            initial_data: 初始数据
            
        Returns:
            最终结果字典
        """
        # 初始化状态
        self.state.update(initial_data)
        
        # 执行每个步骤
        for step in self.steps:
            execution = StepExecution(step_id=step.id, status=StepStatus.PENDING)
            self.state.log_step(execution)
            
            try:
                execution.status = StepStatus.RUNNING
                execution.started_at = time.monotonic()
                
                # 获取输入
                input_data = self.state.get_many(step.input_keys)
                
                # 执行步骤
                if step.parallel:
                    output = self._execute_parallel(step, input_data)
                else:
                    output = self._execute_step(step, input_data)
                
                # 保存输出
                if output:
                    self.state.update(output)
                
                execution.status = StepStatus.COMPLETED
                execution.completed_at = time.monotonic()
                
                logger.info(
                    "工作流步骤完成: %s / %s (%.2fs)",
                    self.workflow_id, step.id,
                    execution.completed_at - execution.started_at,
                )
                
            except Exception as error:
                execution.status = StepStatus.FAILED
                execution.completed_at = time.monotonic()
                execution.error = str(error)
                logger.error(
                    "工作流步骤失败: %s / %s - %s",
                    self.workflow_id, step.id, error,
                )
                raise
        
        return self.state.get_all()
    
    def _execute_step(self, step: WorkflowStep, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """执行单个步骤（支持重试）"""
        last_error: Optional[Exception] = None
        
        for attempt in range(step.retry_count + 1):
            try:
                if attempt > 0:
                    logger.info(
                        "工作流步骤重试: %s / %s (attempt %d/%d)",
                        self.workflow_id, step.id, attempt + 1, step.retry_count + 1,
                    )
                return step.execute_fn(input_data)
            except Exception as error:
                last_error = error
                if attempt >= step.retry_count:
                    raise
        
        raise last_error
    
    def _execute_parallel(self, step: WorkflowStep, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """并行执行步骤"""
        items = input_data.get(step.parallel_item_key, [])
        if not items:
            return {}
        
        execution = self.state.execution_log[-1]
        execution.item_count = len(items)
        
        results: List[Dict[str, Any]] = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {}
            for index, item in enumerate(items):
                # 为每个 item 构建输入
                item_input = {**input_data, "item": item, "item_index": index}
                future = executor.submit(self._execute_step, step, item_input)
                futures[future] = index
            
            for future in as_completed(futures):
                result = future.result()
                if result:
                    results.append(result)
        
        # 合并结果
        return self._merge_parallel_results(results, step.output_keys)
    
    @staticmethod
    def _merge_parallel_results(results: List[Dict[str, Any]], output_keys: List[str]) -> Dict[str, Any]:
        """合并并行执行结果"""
        merged: Dict[str, Any] = {}
        
        for key in output_keys:
            merged[key] = []
        
        for result in results:
            for key in output_keys:
                if key in result:
                    value = result[key]
                    if isinstance(value, list):
                        merged[key].extend(value)
                    else:
                        merged[key].append(value)
        
        return merged
