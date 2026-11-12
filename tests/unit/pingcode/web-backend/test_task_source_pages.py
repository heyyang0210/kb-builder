import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.pingcode_service import PingCodeService, PingcodeTaskSourceError
from app.main import app


class TaskSourcePageTest(unittest.TestCase):
    def setUp(self):
        self.service = PingCodeService.__new__(PingCodeService)
        self.service.config = SimpleNamespace(base_url='https://pingcode.yasdb.com')
        self.api = Mock()
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

        result = self.service.read_task_source_page(
            'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas?category=all',
            'requirement', 0,
        )

        self.assertEqual('YASHAN-1473', result['items'][0]['ir'])
        self.assertEqual('YDBRD-55130', result['items'][0]['workItems'][0]['number'])
        self.api.get_idea_work_items.assert_called_once_with('idea-1', 'version-1')

    def test_missing_relation_blocks_confirmation_data(self):
        self.api.get_product.return_value = {'data': {'value': {'identifier': 'YASHAN', '_id': 'product-1'}}}
        self.api.get_baseline.return_value = {'data': {'value': {'short_id': 'baseline-1', 'scope': 'product-1', 'updated_at': 10}}}
        self.api.get_agile_project.return_value = {'data': {'value': {'identifier': 'YDBRD', '_id': 'project-1'}}}
        self.api.get_baseline_ideas.return_value = {'data': {'count': 1, 'page_count': 1, 'value': [{
            '_id': 'idea-1', 'version_id': 'v1', 'whole_identifier': 'YASHAN-1',
            'relation_data': {'work_item': 1},
        }]}}
        self.api.get_idea_work_items.return_value = {'data': {'value': []}}
        with self.assertRaisesRegex(PingcodeTaskSourceError, '数量与详情不一致') as raised:
            self.service.read_task_source_page(
                'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/baseline-1/ideas',
                'requirement', 0,
            )
        self.assertEqual('PINGCODE_RELATION_INCOMPLETE', raised.exception.code)
        self.assertEqual({'sourceNumber': 'YASHAN-1', 'expectedCount': 1, 'actualCount': 0}, raised.exception.details)

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
        self.api.get_work_item.return_value = {'data': {'value': row}}
        result = self.service.read_task_source_page(
            'https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/nGn-Krlo', 'ticket', 0,
        )
        self.assertEqual(['YDBRD-5'], [item['number'] for item in result['items']])
        self.api.get_work_item.assert_not_called()
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
