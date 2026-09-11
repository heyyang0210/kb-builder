from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from .models import DatasetVersion, MaterialBatch, TaskSnapshot


ACTIVE_STATES = {"queued", "running", "pausing", "paused", "cancelling"}


class WorkbenchService:
    PROCESS_STATES = {"pending", "running", "review", "failed", "publishable", "completed", "unknown"}

    def __init__(self, batches, tasks, preprocess, training):
        self.batches = batches
        self.tasks = tasks
        self.preprocess = preprocess
        self.training = training

    def enrich_page(self, page: dict[str, Any]) -> dict[str, Any]:
        context = self._context()
        return {**page, "items": [self._enrich(item, context) for item in page["items"]]}

    def list_page(
        self,
        *,
        page: int,
        page_size: int,
        workbench_state: str | None = None,
        **filters,
    ) -> dict[str, Any]:
        if workbench_state and workbench_state not in self.PROCESS_STATES:
            raise ValueError(f"加工状态不支持：{workbench_state}")
        available = max(len(self.batches.list()), 1)
        base = self.batches.list_page(page=1, page_size=available, **filters)
        context = self._context()
        items = [self._enrich(item, context) for item in base["items"]]
        process_counts = {state: 0 for state in self.PROCESS_STATES}
        for item in items:
            process_counts[item["processSummary"]["state"]] += 1
        if workbench_state:
            items = [item for item in items if item["processSummary"]["state"] == workbench_state]
        start = (page - 1) * page_size
        return {
            **base,
            "items": items[start:start + page_size],
            "page": page,
            "pageSize": page_size,
            "total": len(items),
            "hasMore": start + page_size < len(items),
            "facets": {**base["facets"], "processStates": process_counts},
        }

    def detail(self, batch_id: str) -> dict[str, Any]:
        batch = self.batches.get(batch_id)
        return self._enrich(self.batches.serialize(batch), self._context())

    def summary(self) -> dict[str, Any]:
        context = self._context()
        items = [self._enrich(self.batches.serialize(batch), context) for batch in self.batches.list()]
        counts = {key: 0 for key in ("all", "pending", "running", "review", "failed", "publishable")}
        counts["all"] = len(items)
        for item in items:
            state = item["processSummary"]["state"]
            if state in counts:
                counts[state] += 1
        active_tasks = [
            self._task_public(task)
            for task in context["allTasks"]
            if task.state in ACTIVE_STATES
        ][:8]
        return {"counts": counts, "activeTasks": active_tasks, "recentTasks": items[:6]}

    def _context(self) -> dict[str, Any]:
        tasks_by_batch: dict[str, list[TaskSnapshot]] = defaultdict(list)
        all_tasks = self.tasks.list()
        for task in all_tasks:
            tasks_by_batch[task.batch_id].append(task)
        datasets_by_batch: dict[str, list[DatasetVersion]] = defaultdict(list)
        for dataset in self.preprocess.list_datasets():
            if dataset.state != "deleted":
                datasets_by_batch[dataset.batch_id].append(dataset)
        return {
            "allTasks": all_tasks,
            "tasks": tasks_by_batch,
            "datasets": datasets_by_batch,
            "reviews": self.training.pending_review_counts_by_batch(),
        }

    def _enrich(self, item: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        batch = MaterialBatch.model_validate(item)
        tasks = context["tasks"].get(batch.id, [])
        datasets = context["datasets"].get(batch.id, [])
        latest_task = tasks[0] if tasks else None
        latest_dataset = datasets[0] if datasets else None
        pending_review = context["reviews"].get(batch.id, 0)
        process = self._process_summary(batch, latest_task, latest_dataset, pending_review)
        return {
            **item,
            "processSummary": process,
            "qualitySummary": self._quality_summary(latest_task, latest_dataset, pending_review),
            "materialSummary": {
                "pages": batch.source_snapshot.estimated_pages,
                "attachments": batch.source_snapshot.estimated_attachments,
                "documents": latest_dataset.total_documents if latest_dataset else None,
                "chunks": latest_dataset.total_chunks if latest_dataset else None,
            },
            "recommendedAction": self._recommended_action(batch, latest_task, latest_dataset, process),
            "latestActivity": self._latest_activity(batch, latest_task, latest_dataset),
        }

    @staticmethod
    def _process_summary(batch, task, dataset, pending_review) -> dict[str, Any]:
        if task and task.state in ACTIVE_STATES:
            percent = round(task.completed / task.total * 100) if task.total else None
            completed_steps = sum(1 for stage in task.stages if stage.get("state") in {"completed", "skipped"})
            return {
                "state": "running", "stage": task.stage, "percent": percent,
                "completedSteps": completed_steps, "totalSteps": 6, "blockingReason": None,
            }
        if (task and task.state == "failed") or batch.state == "failed":
            return {
                "state": "failed", "stage": task.stage if task else None, "percent": None,
                "completedSteps": 0, "totalSteps": 6,
                "blockingReason": task.message if task else "资料加工失败",
            }
        if pending_review:
            state = "review"
        elif dataset and dataset.state == "candidate" and dataset.publishable and dataset.quality_passed:
            state = "publishable"
        elif dataset and dataset.state == "published":
            state = "completed"
        else:
            state = "pending"
        return {
            "state": state,
            "stage": task.stage if task else batch.state,
            "percent": 100 if state == "completed" else None,
            "completedSteps": 6 if dataset else 0,
            "totalSteps": 6,
            "blockingReason": dataset.quality_notice if dataset and dataset.quality_state == "blocked" else None,
        }

    @staticmethod
    def _quality_summary(task, dataset, pending_review) -> dict[str, Any]:
        errors = task.failed if task else 0
        warnings = task.warnings if task else 0
        if errors or (dataset and dataset.quality_state == "blocked"):
            state = "failed"
        elif pending_review:
            state = "review"
        elif dataset and dataset.quality_passed:
            state = "passed"
        else:
            state = "unknown"
        return {"state": state, "warnings": warnings, "errors": errors, "pendingReview": pending_review}

    @staticmethod
    def _recommended_action(batch, task, dataset, process) -> dict[str, str]:
        download_route = f"/batches/{batch.id}/download"
        process_route = f"/batches/{batch.id}/preprocess"
        quality_route = f"/batches/{batch.id}/quality"
        if process["state"] == "failed":
            route = download_route if task and task.type == "download" else process_route
            return {"type": "handle_failure", "label": "处理异常", "route": route}
        if task and task.state in ACTIVE_STATES:
            route = download_route if task.type == "download" else process_route
            return {"type": "view_progress", "label": "查看进度", "route": route}
        if process["state"] == "review":
            return {"type": "review_quality", "label": "人工复核", "route": process_route}
        if dataset and dataset.state == "candidate" and dataset.publishable:
            return {"type": "review_publish", "label": "检查并发布", "route": quality_route}
        if dataset and dataset.state == "published":
            return {"type": "view_dataset", "label": "查看数据集", "route": quality_route}
        if batch.state in {"draft", "downloading"}:
            return {"type": "continue_download", "label": "继续下载", "route": download_route}
        if batch.state in {"staging", "uploaded", "downloaded", "processing"}:
            return {"type": "start_processing", "label": "开始加工", "route": process_route}
        return {"type": "view_task", "label": "查看任务", "route": download_route}

    @staticmethod
    def _latest_activity(batch, task, dataset) -> dict[str, Any]:
        candidates: list[tuple[datetime, str, str]] = [(batch.updated_at, "material_task", "资料加工任务已更新")]
        if task:
            candidates.append((task.updated_at, "execution_task", task.message or task.stage or "执行任务已更新"))
        if dataset:
            candidates.append((dataset.created_at, "dataset", "数据集版本已生成"))
        at, activity_type, message = max(candidates, key=lambda candidate: candidate[0])
        return {"type": activity_type, "message": message, "at": at.isoformat()}

    @staticmethod
    def _task_public(task: TaskSnapshot) -> dict[str, Any]:
        return {
            "id": task.id, "batchId": task.batch_id, "type": task.type,
            "state": task.state, "stage": task.stage, "completed": task.completed,
            "total": task.total, "updatedAt": task.updated_at.isoformat(),
        }
