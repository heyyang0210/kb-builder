"""素材接入框架的组件注册表。"""

from __future__ import annotations

from typing import Generic, Iterable, TypeVar


T = TypeVar("T")


class ComponentRegistryError(ValueError):
    """组件注册或查询失败。"""


class ComponentRegistry(Generic[T]):
    def __init__(self, component_kind: str):
        self.component_kind = component_kind
        self._components: dict[str, T] = {}

    def register(self, component: T, *, key: str | None = None) -> T:
        component_key = key or getattr(component, "key", None)
        if not component_key:
            raise ComponentRegistryError(f"{self.component_kind} 缺少唯一 key")
        if component_key in self._components:
            raise ComponentRegistryError(
                f"{self.component_kind} 已注册：{component_key}"
            )
        self._components[component_key] = component
        return component

    def get(self, key: str) -> T:
        try:
            return self._components[key]
        except KeyError as exc:
            raise ComponentRegistryError(
                f"未注册的{self.component_kind}：{key}"
            ) from exc

    def maybe_get(self, key: str) -> T | None:
        return self._components.get(key)

    def list(self) -> tuple[T, ...]:
        return tuple(self._components.values())

    def keys(self) -> tuple[str, ...]:
        return tuple(self._components.keys())

    def extend(self, components: Iterable[T]) -> None:
        for component in components:
            self.register(component)
