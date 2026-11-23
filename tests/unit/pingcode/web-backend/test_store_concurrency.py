import json
import multiprocessing
import tempfile
import time
import unittest
from pathlib import Path

from app.store import JsonStore


def _put_records(path: str, worker: int, count: int) -> None:
    store = JsonStore(Path(path))
    for index in range(count):
        record_id = f"{worker}-{index}"
        store.put_record("tasks", record_id, {"id": record_id, "worker": worker})


class JsonStoreConcurrencyTests(unittest.TestCase):
    def test_multiprocess_updates_have_no_lost_records(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            JsonStore(path)
            context = multiprocessing.get_context("spawn")
            processes = [
                context.Process(target=_put_records, args=(str(path), worker, 25))
                for worker in range(4)
            ]
            deadline = time.monotonic() + 60
            try:
                for process in processes:
                    process.start()
                for process in processes:
                    process.join(max(0, deadline - time.monotonic()))
                timed_out = [process for process in processes if process.is_alive()]
                if timed_out:
                    self.fail(f"{len(timed_out)} 个 worker 未在 60 秒内结束")
                for process in processes:
                    self.assertEqual(process.exitcode, 0)

                payload = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(len(payload["tasks"]), 100)
            finally:
                for process in processes:
                    if process.is_alive():
                        process.terminate()
                    if process.pid is not None:
                        process.join()


if __name__ == "__main__":
    unittest.main()
