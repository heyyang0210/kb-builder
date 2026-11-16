import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.pingcode_service import PingCodeService, PingcodeTaskSourceError, TASK_DETAIL_PROPERTIES, _get_work_item_details, _task_description
from app.main import app
from pingcode_core.api_client import PingCodeAPIClient


class TaskSourcePageTest(unittest.TestCase):
    def test_work_item_detail_fetch_splits_batches_at_api_limit_and_preserves_order(self):
        api = Mock()
        short_ids = [f'short-{index}' for index in range(501)]
        api.get_work_items.side_effect = lambda batch, concurrency: [{'short_id': value} for value in batch]

        details = _get_work_item_details(api, short_ids, concurrency=7)

        self.assertEqual(short_ids, [item['short_id'] for item in details])
        self.assertEqual([500, 1], [len(call.args[0]) for call in api.get_work_items.call_args_list])
        self.assertTrue(all(call.kwargs['concurrency'] == 7 for call in api.get_work_items.call_args_list))

    def test_detail_fields_preserve_description_zero_and_empty_values(self):
        properties = {key: f'内容-{index}' for index, (key, _) in enumerate(TASK_DETAIL_PROPERTIES)}
        properties['shangcheyunhangcishu'] = 0
        properties['ceshijianyi'] = ''
        result = _task_description({'description': '<p>需求正文</p>', 'properties': properties})
        self.assertIn('## 需求描述\n\n需求正文', result)
        self.assertIn('## 测试建议\n\nPingCode 未填写', result)
        self.assertIn('## 上车运行次数\n\n0', result)
        for _, label in TASK_DETAIL_PROPERTIES:
            self.assertIn(f'## {label}\n\n', result)

    def setUp(self):
        self.service = PingCodeService.__new__(PingCodeService)
        self.service.config = SimpleNamespace(base_url='https://pingcode.yasdb.com')
        self.service._relation_concurrency = 10
        self.service._detail_concurrency = 10
        self.api = Mock()
        self.api.get_idea_work_items_batch.side_effect = lambda ideas, concurrency=10: [
            self.api.get_idea_work_items(idea_id, version_id) for idea_id, version_id in ideas
        ]
        self.service._ensure_api = Mock(return_value=self.api)
        self.service._submit = lambda callback, *args: callback(*args)

    def test_baseline_uses_structured_relation_and_preserves_ir(self):
        self.api.get_product.return_value = {'data': {'value': {'identifier': 'YASHAN', '_id': 'product-1'}}}
        self.api.get_baseline.return_value = {'data': {'value': {
            'short_id': 'baseline-1', 'scope': 'product-1', 'updated_at': 10,
        }}}
        self.api.get_agile_project.return_value = {'data': {'value': {'identifier': 'YDBRD', '_id': 'project-1'}}}
        self.api.get_baseline_ideas.return_value = {'data': {
            'count': 1, 'page_count': 1, 'value': [{
                '_id': 'idea-1', 'version_id': 'version-1', 'whole_identifier': 'YASHAN-1473',
                'relation_data': {'work_item': 1},
            }],
        }}
        self.api.get_idea_work_items.return_value = {'data': {'value': [{
            '_id': 'work-1', 'whole_identifier': 'YDBRD-55130', 'short_id': 'N83ysN8k',
            'project_id': 'project-1', 'title': '支持 r2dbc',
        }]}}
        self.api.get_work_items.return_value = [{
            '_id': 'work-1', 'whole_identifier': 'YDBRD-55130', 'short_id': 'N83ysN8k',
            'project_id': 'project-1', 'title': '支持 r2dbc', 'description': '<p>正文</p>',
            'properties': {'gaiyaoshejifangan': '概要设计内容', 'kaifashejifangan': '开发设计内容',
                           'kaifashejifanganpingshenhuiyijiyao': '会议纪要内容'},
        }]

        with self.assertLogs('app.pingcode_service', level='INFO') as logs:
            result = self.service.read_task_source_page(
                'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas?category=all',
                'requirement', 0,
            )

        self.assertEqual('YASHAN-1473', result['items'][0]['ir'])
        self.assertEqual('YDBRD-55130', result['items'][0]['workItems'][0]['number'])
        description = result['items'][0]['workItems'][0]['description']
        for value in ('测试建议', '概要设计方案', 'PingCode 未填写', '开发设计方案', '开发设计内容', '会议纪要内容'):
            self.assertIn(value, description)
        self.api.get_work_items.assert_called_once_with(['N83ysN8k'], concurrency=10)
        self.api.get_idea_work_items_batch.assert_called_once_with([('idea-1', 'version-1')], concurrency=10)
        self.api.get_idea_work_items.assert_called_once_with('idea-1', 'version-1')
        self.assertTrue(any('pingcode.task_source_page.completed' in line
                            and 'relationRequests=1' in line and 'detailDurationMs=' in line for line in logs.output))

    def test_work_item_details_allow_pingcode_short_id_and_bound_batch(self):
        page = Mock()
        page.evaluate.return_value = [{'short_id': 'R8zzm6Ue'}, {'short_id': 'short-id_2'}]
        api = PingCodeAPIClient(page, 'https://pingcode.yasdb.com')

        result = api.get_work_items(['R8zzm6Ue', 'short-id_2'], concurrency=4)

        self.assertEqual(['R8zzm6Ue', 'short-id_2'], [item['short_id'] for item in result])
        page.evaluate.assert_called_once()
        self.assertEqual({'shortIds': ['R8zzm6Ue', 'short-id_2'], 'concurrency': 4},
                         page.evaluate.call_args.args[1])
        self.assertEqual(2, len(api.get_work_items(['R8zzm6Ue'] * 51)))
        with self.assertRaisesRegex(ValueError, '批次无效'):
            api.get_work_items(['R8zzm6Ue'] * 501)
        with self.assertRaisesRegex(ValueError, '批次无效'):
            api.get_work_items(['R8zzm6Ue'], concurrency=51)
        self.assertEqual(2, page.evaluate.call_count)

    def test_idea_relations_are_fetched_in_one_bounded_browser_batch(self):
        page = Mock()
        page.evaluate.return_value = [{'data': {'value': []}}, {'data': {'value': []}}]
        api = PingCodeAPIClient(page, 'https://pingcode.yasdb.com')

        result = api.get_idea_work_items_batch([('idea-1', 'v1'), ('idea-2', 'v2')], concurrency=4)

        self.assertEqual([{'data': {'value': []}}, {'data': {'value': []}}], result)
        page.evaluate.assert_called_once()
        self.assertEqual({'ideas': [('idea-1', 'v1'), ('idea-2', 'v2')], 'concurrency': 4},
                         page.evaluate.call_args.args[1])
        with self.assertRaisesRegex(ValueError, '批次无效'):
            api.get_idea_work_items_batch([('idea-1', 'v1')], concurrency=51)

    def test_baseline_idea_pages_are_fetched_concurrently_in_one_browser_call(self):
        page = Mock()
        page.evaluate.return_value = [{'data': {'value': []}}, {'data': {'value': []}}]
        api = PingCodeAPIClient(page, 'https://pingcode.yasdb.com')

        result = api.get_baseline_ideas_pages('product-1', 'baseline-1', 3, suite_id='suite-1', concurrency=2)

        self.assertEqual(2, len(result))
        page.evaluate.assert_called_once()
        self.assertEqual({'productId': 'product-1', 'baselineId': 'baseline-1',
            'pageIndexes': [1, 2], 'suiteId': 'suite-1', 'concurrency': 2}, page.evaluate.call_args.args[1])
        with self.assertRaisesRegex(ValueError, '分页批次无效'):
            api.get_baseline_ideas_pages('product-1', 'baseline-1', 101)

    def test_requirement_snapshot_fetches_all_pages_relations_and_details_once(self):
        self.api.get_product.return_value = {'data': {'value': {'identifier': 'YASHAN', '_id': 'product-1'}}}
        self.api.get_baseline.return_value = {'data': {'value': {
            'short_id': 'baseline-1', 'scope': 'product-1', 'updated_at': 10,
        }}}
        self.api.get_agile_project.return_value = {'data': {'value': {'identifier': 'YDBRD', '_id': 'project-1'}}}
        self.api.get_baseline_ideas.return_value = {'data': {'count': 3, 'page_count': 2, 'value': [{
            '_id': 'idea-1', 'version_id': 'v1', 'whole_identifier': 'YASHAN-1', 'relation_data': {'work_item': 1},
        }]}}
        self.api.get_baseline_ideas_pages.return_value = [{'data': {'count': 3, 'page_count': 2, 'value': [
            {'_id': 'idea-2', 'version_id': 'v2', 'whole_identifier': 'YASHAN-2', 'relation_data': {'work_item': 1}},
            {'_id': 'idea-3', 'version_id': 'v3', 'whole_identifier': 'YASHAN-3', 'relation_data': {'work_item': 1}},
        ]}}]
        shared = {'_id': 'work-1', 'whole_identifier': 'YDBRD-10', 'short_id': 'short-1', 'project_id': 'project-1'}
        self.api.get_idea_work_items_batch.side_effect = None
        self.api.get_idea_work_items_batch.return_value = [
            {'data': {'value': [shared]}}, {'data': {'value': [shared]}}, {'data': {'value': []}},
        ]
        self.api.get_work_items.return_value = [{**shared, 'title': 'SR', 'description': '<p>正文</p>', 'properties': {}}]

        result = self.service.read_task_source_pages(
            'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas?category=all')

        self.assertEqual([0, 1], [page['pageIndex'] for page in result['pages']])
        self.assertEqual(['YDBRD-10', 'YDBRD-10'], [page['items'][0]['workItems'][0]['number'] for page in result['pages']])
        self.assertEqual(['YASHAN-3'], result['unlinkedIrNumbers'])
        self.assertEqual(1, result['pages'][1]['unlinkedIrCount'])
        self.api.get_baseline_ideas_pages.assert_called_once_with('product-1', 'baseline-1', 2, suite_id='')
        self.api.get_idea_work_items_batch.assert_called_once_with(
            [('idea-1', 'v1'), ('idea-2', 'v2'), ('idea-3', 'v3')], concurrency=10)
        self.api.get_work_items.assert_called_once_with(['short-1'], concurrency=10)

    def test_requirement_snapshot_rejects_source_changed_during_batch(self):
        self.api.get_product.return_value = {'data': {'value': {'identifier': 'YASHAN', '_id': 'product-1'}}}
        self.api.get_baseline.side_effect = [
            {'data': {'value': {'short_id': 'baseline-1', 'scope': 'product-1', 'updated_at': 10}}},
            {'data': {'value': {'short_id': 'baseline-1', 'scope': 'product-1', 'updated_at': 11}}},
        ]
        self.api.get_agile_project.return_value = {'data': {'value': {'identifier': 'YDBRD', '_id': 'project-1'}}}
        self.api.get_baseline_ideas.return_value = {'data': {'count': 1, 'page_count': 1, 'value': [{
            '_id': 'idea-1', 'version_id': 'v1', 'whole_identifier': 'YASHAN-1', 'relation_data': {'work_item': 0},
        }]}}
        self.api.get_baseline_ideas_pages.return_value = []
        self.api.get_idea_work_items_batch.side_effect = None
        self.api.get_idea_work_items_batch.return_value = [{'data': {'value': []}}]
        self.api.get_work_items.return_value = []

        with self.assertRaises(PingcodeTaskSourceError) as raised:
            self.service.read_task_source_pages(
                'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas')

        self.assertEqual('PINGCODE_SOURCE_CHANGED', raised.exception.code)

    def test_baseline_rejects_work_item_detail_identity_mismatch(self):
        self.api.get_product.return_value = {'data': {'value': {'identifier': 'YASHAN', '_id': 'product-1'}}}
        self.api.get_baseline.return_value = {'data': {'value': {
            'short_id': 'baseline-1', 'scope': 'product-1', 'updated_at': 10,
        }}}
        self.api.get_agile_project.return_value = {'data': {'value': {'identifier': 'YDBRD', '_id': 'project-1'}}}
        self.api.get_baseline_ideas.return_value = {'data': {'count': 1, 'page_count': 1, 'value': [{
            '_id': 'idea-1', 'version_id': 'version-1', 'whole_identifier': 'YASHAN-1473',
            'relation_data': {'work_item': 1},
        }]}}
        self.api.get_idea_work_items.return_value = {'data': {'value': [{
            '_id': 'work-1', 'whole_identifier': 'YDBRD-55130', 'short_id': 'N83ysN8k',
            'project_id': 'project-1',
        }]}}
        self.api.get_work_items.return_value = [{
            '_id': 'different-work', 'whole_identifier': 'YDBRD-55130', 'short_id': 'N83ysN8k',
            'project_id': 'project-1', 'description': '',
        }]

        with self.assertRaisesRegex(ValueError, '详情与需求来源不一致'):
            self.service.read_task_source_page(
                'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas',
                'requirement', 0,
            )

    def test_baseline_reads_deduplicated_work_item_details_once_per_page(self):
        self.api.get_product.return_value = {'data': {'value': {'identifier': 'YASHAN', '_id': 'product-1'}}}
        self.api.get_baseline.return_value = {'data': {'value': {
            'short_id': 'baseline-1', 'scope': 'product-1', 'updated_at': 10,
        }}}
        self.api.get_agile_project.return_value = {'data': {'value': {'identifier': 'YDBRD', '_id': 'project-1'}}}
        self.api.get_baseline_ideas.return_value = {'data': {'count': 2, 'page_count': 1, 'value': [
            {'_id': 'idea-1', 'version_id': 'v1', 'whole_identifier': 'YASHAN-1', 'relation_data': {'work_item': 1}},
            {'_id': 'idea-2', 'version_id': 'v2', 'whole_identifier': 'YASHAN-2', 'relation_data': {'work_item': 1}},
        ]}}
        shared = {'_id': 'work-1', 'whole_identifier': 'YDBRD-10', 'short_id': 'short-1', 'project_id': 'project-1'}
        self.api.get_idea_work_items.return_value = {'data': {'value': [shared]}}
        self.api.get_work_items.return_value = [{**shared, 'title': 'SR', 'description': '正文', 'properties': {}}]

        result = self.service.read_task_source_page(
            'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas', 'requirement', 0,
        )

        self.api.get_work_items.assert_called_once_with(['short-1'], concurrency=10)
        self.assertEqual(2, len(result['items']))
        self.assertTrue(all(item['workItems'][0]['number'] == 'YDBRD-10' for item in result['items']))

    def test_unlinked_ir_is_retained_but_excluded_from_task_projection(self):
        self.api.get_product.return_value = {'data': {'value': {'identifier': 'YASHAN', '_id': 'product-1'}}}
        self.api.get_baseline.return_value = {'data': {'value': {'short_id': 'baseline-1', 'scope': 'product-1', 'updated_at': 10}}}
        self.api.get_agile_project.return_value = {'data': {'value': {'identifier': 'YDBRD', '_id': 'project-1'}}}
        self.api.get_baseline_ideas.return_value = {'data': {'count': 1, 'page_count': 1, 'value': [{
            '_id': 'idea-1', 'version_id': 'v1', 'whole_identifier': 'YASHAN-1',
            'relation_data': {'work_item': 1},
        }]}}
        self.api.get_idea_work_items.return_value = {'data': {'value': []}}
        self.api.get_work_items.return_value = []
        with self.assertLogs('app.pingcode_service', level='WARNING') as logs:
            result = self.service.read_task_source_page(
                'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas',
                'requirement', 0,
            )
        self.assertEqual(1, result['count'])
        self.assertEqual(1, len(result['items']))
        self.assertEqual('YASHAN-1', result['items'][0]['ir'])
        self.assertEqual([], result['items'][0]['workItems'])
        self.assertEqual(1, result['unlinkedIrCount'])
        self.assertTrue(any('pingcode.task_source_page.unlinked_ir' in line
                            and 'expectedCount=1' in line and 'actualCount=0' in line for line in logs.output))

    def test_partially_missing_relation_still_blocks_page(self):
        self.api.get_product.return_value = {'data': {'value': {'identifier': 'YASHAN', '_id': 'product-1'}}}
        self.api.get_baseline.return_value = {'data': {'value': {'short_id': 'baseline-1', 'scope': 'product-1', 'updated_at': 10}}}
        self.api.get_agile_project.return_value = {'data': {'value': {'identifier': 'YDBRD', '_id': 'project-1'}}}
        self.api.get_baseline_ideas.return_value = {'data': {'count': 1, 'page_count': 1, 'value': [{
            '_id': 'idea-1', 'version_id': 'v1', 'whole_identifier': 'YASHAN-1',
            'relation_data': {'work_item': 2},
        }]}}
        self.api.get_idea_work_items.return_value = {'data': {'value': [{
            '_id': 'work-1', 'whole_identifier': 'YDBRD-1', 'short_id': 'short-1', 'project_id': 'project-1',
        }]}}
        with self.assertRaises(PingcodeTaskSourceError) as raised:
            self.service.read_task_source_page(
                'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas', 'requirement', 0,
            )
        self.assertEqual('PINGCODE_RELATION_INCOMPLETE', raised.exception.code)
        self.assertEqual({'sourceNumber': 'YASHAN-1', 'expectedCount': 2, 'actualCount': 1}, raised.exception.details)

    def test_internal_page_endpoint_returns_safe_relation_diagnostic(self):
        client = TestClient(app)
        payload = {'url': 'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas',
                   'type': 'requirement', 'pageIndex': 4}
        with patch('app.main._TASK_SYNC_TOKEN', 'test-secret'), patch(
            'app.main.pingcode.read_task_source_page',
            side_effect=PingcodeTaskSourceError('PINGCODE_RELATION_INCOMPLETE',
                '需求关联工作项数量与详情不一致', sourceNumber='YASHAN-1', expectedCount=2, actualCount=0),
        ):
            response = client.post('/api/internal/pingcode/task-source-page', json=payload,
                headers={'x-internal-token': 'test-secret'})
        self.assertEqual(422, response.status_code)
        error = response.json()['error']
        self.assertEqual({
            'code': 'PINGCODE_RELATION_INCOMPLETE',
            'message': '需求关联工作项数量与详情不一致',
            'retryable': False,
            'sourceNumber': 'YASHAN-1',
            'expectedCount': 2,
            'actualCount': 0,
        }, {key: value for key, value in error.items() if key != 'requestId'})
        self.assertTrue(error['requestId'])

    def test_defect_view_uses_saved_filter_and_rejects_foreign_project(self):
        self.api.get_agile_project.return_value = {'data': {'value': {
            '_id': 'project-1', 'identifier': 'YDBRD',
            'addons': [{'_id': 'addon-1', 'key': 'defect'}],
        }}}
        self.api.get_defect_view.return_value = {'data': {'value': {
            '_id': 'view-1', 'short_id': 'nGn-Krlo', 'addon_id': 'addon-1',
            'updated_at': 12, 'query': {'conditions': [{'field': 'state', 'value': 'open'}]},
            'columns': [{'property_key': 'identifier'}, {'property_key': 'title'}],
        }}}
        row = {'_id': 'work-1', 'short_id': 'short-1', 'whole_identifier': 'YDBRD-5',
               'project_id': 'project-1', 'title': '缺陷', 'description': '<p>正文</p>'}
        self.api.get_defect_view_content.return_value = {'data': {
            'count': 1, 'page_count': 1, 'value': [row],
        }}
        self.api.get_work_items.return_value = [{**row, 'properties': {'ceshijianyi': '测试建议内容'}}]
        result = self.service.read_task_source_page(
            'https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/nGn-Krlo', 'ticket', 0,
        )
        self.assertEqual(['YDBRD-5'], [item['number'] for item in result['items']])
        self.api.get_work_items.assert_called_once_with(['short-1'])
        self.assertIn('测试建议内容', result['items'][0]['description'])
        args = self.api.get_defect_view_content.call_args.args
        self.assertEqual([{'field': 'state', 'value': 'open'}], args[3]['conditions'])
        self.api.get_defect_view_content.return_value['data']['value'][0]['project_id'] = 'other'
        with self.assertRaisesRegex(ValueError, '非目标项目'):
            self.service.read_task_source_page(
                'https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/nGn-Krlo', 'ticket', 0,
            )

    def test_internal_page_endpoint_requires_shared_token(self):
        client = TestClient(app)
        payload = {'url': 'https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/nGn-Krlo',
                   'type': 'ticket', 'pageIndex': 0}
        self.assertEqual(403, client.post('/api/internal/pingcode/task-source-page', json=payload).status_code)
        with patch('app.main.pingcode.read_task_source_page', return_value={'items': []}) as reader:
            response = client.post('/api/internal/pingcode/task-source-page', json=payload,
                                   headers={'x-internal-token': 'test-secret'})
            self.assertEqual(403, response.status_code)
            with patch('app.main._TASK_SYNC_TOKEN', 'test-secret'):
                response = client.post('/api/internal/pingcode/task-source-page', json=payload,
                                       headers={'x-internal-token': 'test-secret'})
                self.assertEqual(200, response.status_code)
                self.assertEqual({'items': []}, response.json())
                reader.assert_called_once_with(payload['url'], 'ticket', 0)


if __name__ == '__main__':
    unittest.main()
