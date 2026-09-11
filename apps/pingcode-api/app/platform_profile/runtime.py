from pathlib import Path
from types import MappingProxyType
from typing import Any


class RuntimeProfile:
    def __init__(self, loaded: dict[str, Any]):
        self._profile = loaded["profile"]
        self.context = loaded["context"]
        self._resources = {item["reference"]: Path(item["path"]) for item in loaded["resources"]}

    @property
    def brand(self) -> dict[str, str]:
        return self.context.get("brand", {})

    @property
    def domain_id(self) -> str:
        return self._profile["domain"]["id"]

    @property
    def domain_version(self) -> str:
        domain = self._profile["domain"]
        return f'{domain["id"]}-domain:{domain["version"]}'

    @property
    def profile_id(self) -> str:
        return self._profile["metadata"]["id"]

    @property
    def profile_version(self) -> str:
        return self._profile["metadata"]["version"]

    @property
    def config_fingerprint(self) -> str:
        return self.context["configFingerprint"]

    @property
    def trace(self) -> MappingProxyType:
        return MappingProxyType({
            "profileId": self.profile_id,
            "profileVersion": self.profile_version,
            "enterpriseId": self.context["enterpriseId"],
            "configFingerprint": self.config_fingerprint,
        })

    def resource(self, collection: str, resource_id: str) -> Path:
        item = next((candidate for candidate in self._profile[collection] if candidate["id"] == resource_id), None)
        if item is None:
            raise RuntimeError(f"企业能力包未登记资源：{collection}/{resource_id}")
        reference = item.get("resourceRef") or item.get("manifestRef")
        if reference not in self._resources:
            raise RuntimeError(f"企业能力包资源未解析：{collection}/{resource_id}")
        return self._resources[reference]


__all__ = ["RuntimeProfile"]
