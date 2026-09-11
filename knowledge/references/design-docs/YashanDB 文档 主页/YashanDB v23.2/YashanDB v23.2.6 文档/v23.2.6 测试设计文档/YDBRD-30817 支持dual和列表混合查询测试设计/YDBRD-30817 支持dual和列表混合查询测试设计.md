Created by 刘立, last modified on 九月 13, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/66a3503966228b9470779d39](https://pingcode.yasdb.com/pjm/items/66a3503966228b9470779d39)    ?    
  #YDBRD-30817 支持dual和列表混合查询,并且走列执行引擎

1. 支持dual和列表混合查询。
1. 混合查询走列执行引擎。


## 1.1 相关文档

开发设计：    [dual与col混合查询 设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=163014934)  

算子分类参考文档：    [算子分享](https://conf.yasdb.com/pages/viewpage.action?pageId=135612331)  

# 2. 需求分析

## 2.1 功能点分析

1. dual 和列表混合查询使用不同的算子均支持。
1. 查询是走列执行引擎。
1. 交付范围包含单机和分布式。


## 2.2 应用场景

需求来源于智慧工会。支持单机和分布式。

主要是解决智慧工会下面的应用场景：

![](https://conf.yasdb.com/download/attachments/163014934/image2024-9-4_16-10-16.png?version=1&modificationDate=1725437417000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)

## 2.3 规格约束

1. 仅支持   dual 与 col 表的混合查询，其他系统表以及 haep 表都不支持。
1. 包含 dual 表时开启布隆过滤器不会生效。
1. 不支持并行，开启并行不会生效。


# 3. 详细测试设计

## 3.1 测试设计方法

1. 依据所有算子采用等价类划分进行测试分析；组合算子测试采用场景法进行测试分析。


  物理算子类别

|类别|物理算子|说明|示例|
|:---|:---|:---|---|
|分区扫描算子|PART SCAN ITERATOR|一组分区扫描|  PART SCAN ITERATOR,create table t1 (id int, name char(32) ) partition by range(id) (partition p1 values less than(2), partition p2 values less than(3), partition p3 values less than(10));,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select * from t1 where id < 3 ;,![](https://pingcode.yasdb.com/atlas/files/public/67396deba1ad9a3311dc944c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||PART SCAN ALL|所有分区扫描|  PART SCAN ALL,create table t1 (id int, name char(32) ) partition by range(id) (partition p1 values less than(2), partition p2 values less than(3), partition p3 values less than(10));,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select * from t1 ;,![](https://pingcode.yasdb.com/atlas/files/public/67396deba1ad9a3311dc944d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||PART SCAN SINGLE|单个分区扫描|  PART SCAN SINGLE,create table t1 (id int, name char(32) ) partition by range(id) (partition p1 values less than(2), partition p2 values less than(3), partition p3 values less than(10));,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select * from t1 where id = 1;,![](https://pingcode.yasdb.com/atlas/files/public/67396deb8970c2af4f5215d7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
|表扫描算子|TABLE ACCESS FULL|全表扫描|  TABLE ACCESS FULL,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select * from t1 where id = 1;,![](https://pingcode.yasdb.com/atlas/files/public/67396deb8970c2af4f5215d8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||TABLE ACCESS BY INDEX ROWID|根据索引查找到对应数据的block的rowid（根据rowid,回表）|  TABLE ACCESS BY INDEX ROWID,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create index idx1 on t1(id);,explain select * from t1 where id = 1;,![](https://pingcode.yasdb.com/atlas/files/public/67396deba1ad9a3311dc944e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||TABLE ACCESS BY USER ROWID|用户指定ROWID扫描|  TABLE ACCESS BY USER ROWID,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create index idx1 on t1(id);,explain select * from t1 where t1.rowid = (select rowid from t1 where id = 1);,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215d9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
|索引扫描算子|INDEX UNIQUE SCAN|唯一索引扫描，仅仅适用于where条件是等值查询的SQL,(HEAP表支持、EPC/TAC单表有限支持)|  INDEX UNIQUE SCAN,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create unique index uniqidx1 on t1(id);,explain select id from t1 where id = 1;,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||INDEX RANGE SCAN DESCENDING|索引范围降序扫描|  INDEX RANGE SCAN DESCENDING,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create unique index uniqidx1 on t1(id);,explain select id from t1 where id > 1 and id < 4 order by id desc;,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215db/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||INDEX RANGE SCAN|索引范围扫描。当扫描对象是唯一索引是，谓词条件必须是范围查询（between、<、>）；扫描对象是非唯一性索引是，则没有限制。索引范围扫描可能返回多条记录|  INDEX RANGE SCAN,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create unique index uniqidx1 on t1(id);,explain select id from t1 where id > 1 and id < 4;,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215dc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||INDEX FULL SCAN DESCENDING|索引降序全扫描|  INDEX FULL SCAN DESCENDING,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create unique index uniqidx1 on t1(id);,explain select id from t1 order by id desc;,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215dd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||INDEX FULL SCAN|索引全扫描。扫描目标索引所有叶子块的所有索引行。|  INDEX FULL SCAN,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create unique index uniqidx1 on t1(id);,explain select id from t1 order by id;,![](https://pingcode.yasdb.com/atlas/files/public/67396deca1ad9a3311dc944f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||INDEX FAST FULL SCAN|索引快速全扫描。类似索引全扫描，但扫描结果不是有序的。因为是物理读，不是逻辑读索引，同时可以并行读索引|  INDEX FAST FULL SCAN,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create unique index uniqidx1 on t1(id);,explain select id from t1;,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||INDEX FULL SCAN (MIN/MAX)|针对min、max函数优化，只返回一条记录|  INDEX FULL SCAN (MIN/MAX),create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create unique index uniqidx1 on t1(id);,explain select min(id) from t1;,![](https://pingcode.yasdb.com/atlas/files/public/67396deca1ad9a3311dc9450/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||INDEX RANGE SCAN (MIN/MAX)|针对min、max函数优化，只返回一条记录|  INDEX RANGE SCAN (MIN/MAX),create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create unique index uniqidx1 on t1(id);,explain select min(id) from t1 where id > 2;,![](https://pingcode.yasdb.com/atlas/files/public/67396deca1ad9a3311dc9451/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
|AC 扫描算子|AC SCAN|主要针对 LSC 的 AP 应用场景|create table t1 ( id int, col1 char(16) ) organization lsc tablespace users;    
  begin    
  for i in 1..1000 loop    
  insert into t1 values (i, 'test'||i);    
  end loop;    
  end;    
  /    
  commit;    
  alter table t1 alter slice all stable;    
  create access constraint ac01 from t1 on only id where id < 100;,explain select id from t1 where id = 1;,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215df/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
|HASH JOIN算子|HASH JOIN LEFT OUTER|哈希外连接（左外连接）|  HASH JOIN LEFT OUTER,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select * from t1 left join t2 on     [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396deca1ad9a3311dc9452/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||HASH JOIN RIGHT OUTER|哈希外连接（右外连接）|  HASH JOIN RIGHT OUTER,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,begin    
  for i in 1..1000 loop    
  insert into t1 values (i, 'stu_'||i);    
  end loop;    
  end;    
  /    
  commit;,insert into t2 values (1, 'Chinese');,commit;,begin    
  dbms_stats.gather_table_stats('sys', 't1', null, 1, false, 'for all columns size auto', 8, 'auto', true);,dbms_stats.gather_table_stats('sys', 't2', null, 1, false, 'for all columns size auto', 8, 'auto', true);    
  end;    
  /,explain select * from t1 right join t2 on     [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396deca1ad9a3311dc9453/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||HASH JOIN FULL OUTER|哈希全外连接|  HASH JOIN FULL OUTER,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select * from t1 full join t2 on     [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396deca1ad9a3311dc9454/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||HASH JOIN SEMI|哈希半连接|  HASH JOIN SEMI,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select * from t1 where id in (select id from t2);,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||HASH JOIN ANTI|哈希反连接|  HASH JOIN ANTI,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select * from t1 where not exists (select id from t2 where     [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    );,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215e1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||HASH JOIN INNER|哈希连接（内连接）|  HASH JOIN INNER,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select * from t1 join t2 on     [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396deca1ad9a3311dc9455/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||HASH JOIN RIGHT SEMI|哈希右半连接|  HASH JOIN RIGHT SEMI,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,begin    
  for i in 1..1000 loop    
  insert into t1 values (i, 'stu_'||i);    
  end loop;    
  end;    
  /    
  commit;,insert into t2 values (1, 'Chinese');,commit;,begin    
  dbms_stats.gather_table_stats('sys', 't1', null, 1, false, 'for all columns size auto', 8, 'auto', true);,dbms_stats.gather_table_stats('sys', 't2', null, 1, false, 'for all columns size auto', 8, 'auto', true);    
  end;    
  /,explain select * from t2 where id in (select id from t1);    -- t2 表数据 < t1 表,![](https://pingcode.yasdb.com/atlas/files/public/67396deca1ad9a3311dc9456/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||HASH JOIN RIGHT ANTI|哈希右反连接|  HASH JOIN RIGHT ANTI,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,begin    
  for i in 1..1000 loop    
  insert into t1 values (i, 'stu_'||i);    
  end loop;    
  end;    
  /    
  commit;,insert into t2 values (1, 'Chinese');,commit;,begin    
  dbms_stats.gather_table_stats('sys', 't1', null, 1, false, 'for all columns size auto', 8, 'auto', true);,dbms_stats.gather_table_stats('sys', 't2', null, 1, false, 'for all columns size auto', 8, 'auto', true);    
  end;    
  /,explain select * from t2 where not exists (select id from t1 where     [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    );   -- t2 表数据 < t1 表,![](https://pingcode.yasdb.com/atlas/files/public/67396deca1ad9a3311dc9457/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||JOIN FILTER CREATE/    
  JOIN FILTER USE|BLOOM过滤器（优化hash join性能）|![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215e2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
|MERGE JOIN算子|MERGE SORT|归并连接排序|  MERGE SORT,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select /*+ use_merge(t1, t2) */ * from t1 join t2 on     [t1.id](http://t1.id)     >     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396dec8970c2af4f5215e3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||MERGE JOIN INNER|归并连接（内连接）|见上面 MERGE SORT|
||MERGE JOIN LEFT OUTER|归并连接（左外连接）|  MERGE JOIN LEFT OUTER,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select /*+ use_merge(t1, t2) */ * from t1 left join t2 on     [t1.id](http://t1.id)     >     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215e4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||MERGE JOIN FULL OUTER|归并连接（全连接）|  MERGE JOIN FULL OUTER,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select /*+ use_merge(t1, t2) */ * from t1 full join t2 on     [t1.id](http://t1.id)     >     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215e5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
|NEST LOOP算子|NEST LOOPS LEFT OUTER|嵌套循环外连接（左外连接）|  NEST LOOPS LEFT OUTER,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select /*+ use_nl(t1, t2) */ * from t1 left join t2 on     [t1.id](http://t1.id)     >     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215e6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||NEST LOOPS FULL OUTER|嵌套循环全外连接|  NEST LOOPS FULL OUTER,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select /*+ use_nl(t1, t2) */ * from t1 full join t2 on     [t1.id](http://t1.id)     >     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396deda1ad9a3311dc9458/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||NEST LOOPS SEMI|循环嵌套半连接|  NEST LOOPS SEMI,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select /*+use_nl(t1,t2) */ * from t2 where id in (select id from t1 where     [t1.id](http://t1.id)     >     [t2.id](http://t2.id)    );,![](https://pingcode.yasdb.com/atlas/files/public/67396deda1ad9a3311dc9459/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||NEST LOOPS ANTI|嵌套循环反链接|  NEST LOOPS ANTI,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select /*+use_nl(t1,t2) */ * from t2 where not exists (select id from t1 where     [t1.id](http://t1.id)     >     [t2.id](http://t2.id)    );,![](https://pingcode.yasdb.com/atlas/files/public/67396deda1ad9a3311dc945a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||NEST LOOPS INNER|循环嵌套连接（内连接）|  NEST LOOPS INNER,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,create index idx1 on t2(id);,explain select /*+ use_nl(t1, t2) */ * from t1 join t2 on     [t1.id](http://t1.id)     >     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215e7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
|DQL查询算子    
    
|SUBQUERY|子查询标识，表示存在了行子查询执行计划，列subquery会转为result计划|  SUBQUERY,create table t1 (id int, name char(32) );,create table t2 (id int, class char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'Chinese'), (3, 'Math'), (4, 'English');,commit;,explain select * from t1 where id = any(select id from t2);,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||SELECT STATEMENT|SELECT计划|select 的查询计划都有，看以上示例|
||INSERT STATEMENT|INSERT计划|  INSERT STATEMENT,create table t1 (id int, name char(32) );,explain insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215e9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||UPDATE STATEMENT|UPDATE计划|  UPDATE STATEMENT,create table t1 (id int, name char(32) );,explain update t1 set id = 2 where id = 1;,![](https://pingcode.yasdb.com/atlas/files/public/67396deda1ad9a3311dc945b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||DELETE STATEMENT|DELETE计划|  DELETE STATEMENT,create table t1 (id int, name char(32) );,explain delete from t1 where id = 1;,![](https://pingcode.yasdb.com/atlas/files/public/67396deda1ad9a3311dc945c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||MERGE STATEMENT|MERGE计划|  MERGE STATEMENT,create table t1 (id int, name char(32) );,create table t2 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'zhangsan'), (4, 'English');,commit;,explain merge into t1 using (select * from t2) t22 on (    [t22.id](http://t22.id)    =    [t1.id](http://t1.id)    ) when matched then update set     [t1.name](http://t1.name)    =    [t22.name](http://t22.name)     where     [t22.name](http://t22.name)    ='zhangsan';,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||UNION ALL|UNION ALL计划|  UNION ALL,create table t1 (id int, name char(32) );,create table t2 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'zhangsan'), (4, 'English');,commit;,explain select * from t1 union select * from t2;,![](https://pingcode.yasdb.com/atlas/files/public/67396deda1ad9a3311dc945d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||AGGREGATE|聚集函数计划|  AGGREGATE,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select count(id) from t1;,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215eb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||FOR UPDATE|SELECT for update 计划|  FOR UPDATE,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select * from t1 for update;,![](https://pingcode.yasdb.com/atlas/files/public/67396deda1ad9a3311dc945e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||RESULT|谓词重组后，计划树上需要承载FILTER和投影的独立计划节点|  INDEX RANGE SCAN (MIN/MAX),create table t1 (id int, name char(32) ) organization tac;,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create or replace view v1 as select * from t1;,explain select * from t1 where id > any(select id from v1);,![](https://pingcode.yasdb.com/atlas/files/public/67396deda1ad9a3311dc945f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||WINDOW|limit数据筛选|  WINDOW,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select * from t1 limit 1;,![](https://pingcode.yasdb.com/atlas/files/public/67396deda1ad9a3311dc9460/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||WINDOW SORT|窗口函数|  WINDOW SORT,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select rank() over(order by id) from t1 ;,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215ec/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||WINDOW NOSORT|窗口函数|  WINDOW NOSORT,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select sum(id) over() from t1 ;,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215ed/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||FIRST ROW|返回第一行|  FIRST ROW,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create index idx1 on t1(id);,explain select max(id) from t1 ;,![](https://pingcode.yasdb.com/atlas/files/public/67396ded8970c2af4f5215ee/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||COUNT|ROWNUM对应算子|  COUNT,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select id, rownum from t1;,![](https://pingcode.yasdb.com/atlas/files/public/67396deea1ad9a3311dc9461/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||COUNT STOPKEY|ROWNUM对于算子，并且作为数据筛选|  COUNT STOPKEY,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select id, rownum from t1 where rownum < 4;,![](https://pingcode.yasdb.com/atlas/files/public/67396deea1ad9a3311dc9462/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
|辅助打印    
    
    
|LOAD TABLE CONVENTIONAL|在刚才插入数据的时候,数据库执行了实时统计值收集的动作|见 INSERT STATEMENT|
||Optimizer: ADOPT_C|优化器类型为CBO|所有计划都打印 ADOPT_C |
|辅助功能算子|MERGE|数据合并，将多路有序的数据源进行归并成一路数据的算子|见 MERGE STATEMENT|
||COL TO ROW|列计算转为行计算|列执行都有该算子|
||MATERIAL|将输入的数据源物化|  
|
|分组/排序算子    
    
    
    
    
    
    
    
    
    
    
    
|SORT|优化器根据实际情况生成的排序计划|  SORT,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select name from t1 order by id;,![](https://pingcode.yasdb.com/atlas/files/public/67396dee8970c2af4f5215ef/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||TOP SORT|根据实际情况生成前TOP个数据的排序计划|  TOP SORT,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select name from t1 order by id limit 2;,![](https://pingcode.yasdb.com/atlas/files/public/67396dee8970c2af4f5215f0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||SORT ORDER BY|order by语句产生的排序计划|  
|
||HASH DISTINCT|hash除重|  HASH DISTINCT,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select distinct id from t1 ;,![](https://pingcode.yasdb.com/atlas/files/public/67396dee8970c2af4f5215f1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||SORT DISTINCT|排序除重|  SORT DISTINCT,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select distinct id from t1 order by id ;,![](https://pingcode.yasdb.com/atlas/files/public/67396dee8970c2af4f5215f2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||SORTED DISTINCT|使用排序算法对已排序的数据进行除重|  SORTED DISTINCT,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create index idx1 on t1(id);,explain select distinct id from t1 order by id ;,![](https://pingcode.yasdb.com/atlas/files/public/67396deea1ad9a3311dc9463/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||TOP SORT DISTINCT|使用排序算法对已排序的数据进行除重，并返回前TOP个|  TOP SORT DISTINCT,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select distinct id from t1 order by id limit 2;,![](https://pingcode.yasdb.com/atlas/files/public/67396deea1ad9a3311dc9464/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||HASH GROUP|hash分组|  HASH GROUP,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select id from t1 group by id;,![](https://pingcode.yasdb.com/atlas/files/public/67396deea1ad9a3311dc9465/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||GROUP|已排好序的分组|  GROUP,create table t1 (id int, name char(32) );,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,create index idx1 on t1(id);,explain select id from t1 group by id order by id;,![](https://pingcode.yasdb.com/atlas/files/public/67396deea1ad9a3311dc9466/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
||SORT GROUPING SETS|按照多个列进行分组，并对结果进行Union操作|  SORT GROUPING SETS,create table t1 (id int, name char(32) ) organization tac;,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,commit;,explain select id from t1 group by grouping sets(id, name);,![](https://pingcode.yasdb.com/atlas/files/public/67396dee8970c2af4f5215f3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|
|并行数据交换算子（PX）,  
,  
|PX COORDINATOR|并行数据交换算子协调节点，用于并行资源的准备|px 算子必定带这个算子|
||PX  I2I LOCAL,PX I2N LOCAL,PX N2I LOCAL,PX N2N LOCAL|并行数据交换算子，I代表1个节点，N代表多节点，例如PX N2I  LOCAL，代表并行多节点向一个节点发送数据，在下方Operation Information中可以找到对相应的发送方式和接收方式，发送有 RANDOM， HASH，BROADCAST的方式，接收有SORT，RANDOM的方式，同时会有发送节点到接收节点的信息如：3→1 [3][4][5]->[2]|  PX N2I LOCAL,create table t1 (id int, name char(32) ) organization tac;,create table t2 (id int, name char(32) ) organization tac;,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'zhangsan'), (4, 'sunsun');,commit;,explain select /*+parallel(t1, 2) */ id from t1;,![](https://pingcode.yasdb.com/atlas/files/public/67396deea1ad9a3311dc9467/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk),  PX N2N LOCAL,create table t1 (id int, name char(32) ) organization tac;,create table t2 (id int, name char(32) ) organization tac;,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'zhangsan'), (4, 'sunsun');,commit;,explain select /*+parallel(t1, 2) parallel(t2,2) */ t1.* from t1 join t2 on     [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396deea1ad9a3311dc9468/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk),  PX 12N LOCAL,create table t1 (id int, name char(32) ) organization tac;,create table t2 (id int, name char(32) ) organization tac;,insert into t1 values (1, 'zhangsan'), (2, 'lisi'), (3, 'wangwu');,insert into t2 values (1, 'zhangsan'), (4, 'sunsun');,commit;,begin    
  dbms_stats.gather_table_stats('sys', 't1', null, 1, false, 'for all columns size auto', 8, 'auto', true);,dbms_stats.gather_table_stats('sys', 't2', null, 1, false, 'for all columns size auto', 8, 'auto', true);    
  end;    
  /,explain select /*+parallel(t1, 2) parallel(t2,2) */ t1.* from t1 join t2 on     [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    ;,![](https://pingcode.yasdb.com/atlas/files/public/67396dee8970c2af4f5215f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUZFRUNFaDZIQWdBRW94QU1Ea0FnQUJDUklpQUNvUVFBQVVBaUlpVUJGQUlFTWlHVUdFQm9JWm1DUXhBNGdJTUdBRkdVa0NWRVNDSWdCRkZoQkFRUXdTQXk5WU9LY0FBMDVHQ1I1eEVKS0VFQUNFR01KQUdWWFJIZ2dCQWd3UUZvZ01pVUFBZ2dBbmhDckJtQ0FnTEZBQUlBVElGeUFRQUNBYUFBR0lBSVFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NzksImV4cCI6MTc4MjMyMzc3OX0.c7pJklDdRSfzQc1tciKHtlg8B8kKLVcgRrOj0Ms1ejk)|


  


## 3.2 详细测试设计

覆盖在不同算子中 dual 和列表混合查询

关注点：

- 测试覆盖执行操作和查看访问计划 explain，其中访问计划走列执行引擎（包含 COL TO ROW ），同时关注 dual 表的 Rows 内容
- 测试同时覆盖 TAC 和 LSC（用例复用）


1、单个算子测试和算子组合测试

单个算子测试  覆盖不同的    [数据类型](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B/00%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B.html)    ，重点关注 lob 类型  。组合场景随机覆盖不同的数据类型（明确 lob 数据类型相关的场景）

代码中发现 lob 存在多余的拦截，在单算子场景中把 lob 数据类型覆盖一下

|类别|物理算子|说明|单算子测试项|组合测试项|
|:---|:---|:---|---|---|
|分区扫描算子|PART SCAN ITERATOR|一组分区扫描|分区类型：,- range 分区
- hash 分区
- less 分区
,分区扫描算子公共：,- dual 表在子查询中
- 列表在子查询中
|- 索引扫描算子测试
- hash join 算子
- merge join 算子
- nest loop 算子
- DQL查询算子 全量
- 分组/排序算子 全量
|
||PART SCAN ALL|所有分区扫描|  
|  
|
||PART SCAN SINGLE|单个分区扫描|  
|  
|
|表扫描算子|TABLE ACCESS FULL|全表扫描|包含子查询公共测试点：,- dual 在子查询
- 列表在子查询
,子查询位于 where 部分公共测试点：,- 比较运算符：=、!=、<、>、<=、>= 
- 逻辑运算符：AND、OR、NOT
- 模糊查询：LIKE、NOT LIKE、RLIKE、NOT RLIKE
- 空值检查：IS NULL、IS NOT NULL（组合其他运算符）
- 范围检查：between and、in、not in、exists、not exists
- any / all / some
- case when
,子查询位于目标列：,- select (select 1 from dual) from t1;
- select (select id from t1) from dual;
|  
|
||TABLE ACCESS BY INDEX ROWID|根据索引查找到对应数据的block的rowid（根据rowid,回表）|  
|  
|
||TABLE ACCESS BY USER ROWID|用户指定ROWID扫描|  
|  
|
|索引扫描算子|INDEX UNIQUE SCAN|唯一索引扫描，仅仅适用于where条件是等值查询的SQL,(HEAP表支持、EPC/TAC单表有限支持)|- dual 子查询在 where 中
- dual 子查询在 order by 中
- dual 子查询位于目标列
- 子查询位于 where 部分公共测试点：
    - 比较运算符：=、!=、<、>、<=、>= 
    - 逻辑运算符：AND、OR、NOT
    - 模糊查询：LIKE、NOT LIKE、RLIKE、NOT RLIKE
    - 空值检查：IS NULL、IS NOT NULL（组合其他运算符）
    - 范围检查：between and、in、not in、exists、not exists
    - any / all / some
    - case when
|- merge join 算子
- nest loop 算子
- DQL查询算子 全量
- 分组/排序算子 全量
|
||INDEX RANGE SCAN DESCENDING|索引范围降序扫描|  
|  
|
||INDEX RANGE SCAN|索引范围扫描。当扫描对象是唯一索引是，谓词条件必须是范围查询（between、<、>）；扫描对象是非唯一性索引是，则没有限制。索引范围扫描可能返回多条记录|  
|  
|
||INDEX FULL SCAN DESCENDING|索引降序全扫描|  
|  
|
||INDEX FULL SCAN|索引全扫描。扫描目标索引所有叶子块的所有索引行。|  
|  
|
||INDEX FAST FULL SCAN|索引快速全扫描。类似索引全扫描，但扫描结果不是有序的。因为是物理读，不是逻辑读索引，同时可以并行读索引|  
|  
|
||INDEX FULL SCAN (MIN/MAX)|针对min、max函数优化，只返回一条记录|  
|  
|
||INDEX RANGE SCAN (MIN/MAX)|针对min、max函数优化，只返回一条记录|  
|  
|
|AC 扫描算子|AC SCAN|主要针对 LSC 的 AP 应用场景|- 列表和 dual 表混合查询
- access 和 dual 表混合查询
|  
|
|HASH JOIN算子|HASH JOIN LEFT OUTER|哈希外连接（左外连接）|dual 表参与 join 查询（与 union all、intersect、minus 组合测试）,- dual 表位于 join 左节点
- dual 表位于 join 右节点
,dual 表不参与 join 查询,- dual 作为子查询在 where 中
|- DQL查询算子 全量
- 分组/排序算子 全量
|
||HASH JOIN RIGHT OUTER|哈希外连接（右外连接）|  
|  
|
||HASH JOIN INNER|哈希连接（内连接）|  
|  
|
||HASH JOIN FULL OUTER|哈希全外连接|- dual 作为子查询在 where 中
|  
|
||HASH JOIN SEMI|哈希半连接|  
|  
|
||HASH JOIN ANTI|哈希反连接|  
|  
|
||HASH JOIN RIGHT SEMI|哈希右半连接|  
|  
|
||HASH JOIN RIGHT ANTI|哈希右反连接|  
|  
|
||JOIN FILTER CREATE/    
  JOIN FILTER USE|BLOOM过滤器（优化hash join性能）|不支持，dual 表混合查询场景不会出现 bloom 过滤器算子|  
|
|MERGE JOIN算子|MERGE SORT|归并连接排序|dual 表参与 join 查询（与 union all、intersect、minus 组合测试）,- dual 表位于 join 左节点
- dual 表位于 join 右节点
,dual 表不参与 join 查询,- dual 作为子查询在 where 中
|- 索引扫描算子
- DQL查询算子 全量
- 分组/排序算子 全量
|
||MERGE JOIN INNER|归并连接（内连接）|  
|  
|
||MERGE JOIN LEFT OUTER|归并连接（左外连接）|  
|  
|
||MERGE JOIN FULL OUTER|归并连接（全连接）|  
|  
|
|NEST LOOP算子|NEST LOOPS LEFT OUTER|嵌套循环外连接（左外连接）|dual 表参与 join 查询（与 union all、intersect、minus 组合测试）,- dual 表位于 join 左节点
- dual 表位于 join 右节点
,dual 表不参与 join 查询,- dual 作为子查询在 where 中
|- 索引扫描算子
- DQL查询算子 全量
- 分组/排序算子 全量
|
||NEST LOOPS FULL OUTER|嵌套循环全外连接|  
|  
|
||NEST LOOPS SEMI|循环嵌套半连接|  
|  
|
||NEST LOOPS ANTI|嵌套循环反链接|  
|  
|
||NEST LOOPS INNER|循环嵌套连接（内连接）|  
|  
|
|DQL查询算子    
    
|SUBQUERY|子查询标识，表示存在了行子查询执行计划，列subquery会转为result计划|其他场景组合覆盖|- 多层子查询嵌套
- 子查询同时包含 dual 表和列表，dual 作为其中的一部分
|
||SELECT STATEMENT|SELECT计划|场景均包含|  
|
||INSERT STATEMENT|INSERT计划|insert + select,- 通过 select 插入
- 使用 values 插入，dual 查询表在 values 中
- values 嵌套函数，函数中包含 dual 表
|select 包含子查询,- select 为 dual 表和列表混合查询
- select 值包含列表
,select 中包含其他算子,- 索引扫描算子
- hash join 算子
- merge join 算子
- nest loop 算子
- 分组/排序算子 全量
,在 insert 中覆盖全量，update/delete/merge 不重复测试|
||UPDATE STATEMENT|UPDATE计划|update + select,- dual 表查询作为  更新内容
- dual 表查询作为匹配条件在 where 中
|  
|
||DELETE STATEMENT|DELETE计划|delete + select,- dual 表查询作为匹配条件在 where 中
|  
|
||MERGE STATEMENT|MERGE计划|merge + select,- dual 表查询作为匹配条件在 where 中
|  
|
||UNION ALL,UNION,INTERSECT ,INTERSECT ALL,MINUS,MINUS ALL|UNION ALL计划,UNION,INTERSECT ,INTERSECT ALL,MINUS,MINUS ALL|- dual 表位于 union all 左侧
- dual 表位于 union all 右侧
- 多层 union all 查询
|- 在 join 算子中混合使用
- 索引扫描算子
|
||AGGREGATE|聚集函数计划|- dual 表位于目标列，聚集函数位于目标列
,explain select (select 1 from dual), count(*) from t1;|- 索引扫描算子
- hash join 算子
- merge join 算子
- nest loop 算子
- DQL查询算子 全量
- 分组/排序算子 全量
|
||FOR UPDATE|SELECT for update 计划|- dual 表位于目标列
|  
|
||RESULT|谓词重组后，计划树上需要承载FILTER和投影的独立计划节点|- dual 表位于 where 部分
|- 索引扫描算子
|
||WINDOW|limit数据筛选|- 子查询位于 limit
    - dual 表作为子查询
    - 列表作为子查询
,explain select * from t1 limit (select 1 from dual);    
  explain select 1 from dual limit (select id from t1 limit 1);|- 索引扫描算子
- hash join 算子
- merge join 算子
- nest loop 算子
- DQL查询算子 全量
- 分组/排序算子 全量
|
||WINDOW SORT|窗口函数|DENSE_RANK    
  FIRST_VALUE    
  LAG    
  LAST_VALUE    
  LEAD    
  RANK    
  ROW_NUMBER|  
|
||WINDOW NOSORT|窗口函数|AVG    
  COUNT    
  LISTAGG    
  MAX    
  MEDIAN    
  MIN    
  SUM|  
|
||FIRST ROW|返回第一行|  
|- 与 where 组合，dual 表放在 where 中作为子查询
- where + 索引扫描算子
|
||COUNT|ROWNUM对应算子|- dual 表位于目标列，ROWNUM位于目标列
,explain select (select 1 from dual), rownum from t1;|- 索引扫描算子
|
||COUNT STOPKEY|ROWNUM对于算子，并且作为数据筛选|- dual 表位于目标列，ROWNUM位于目标列
- dual 表作为子查询位于 where 部分
|- 索引扫描算子
|
|辅助打印    
    
    
|LOAD TABLE CONVENTIONAL|在刚才插入数据的时候,数据库执行了实时统计值收集的动作|insert 可覆盖|  
|
||Optimizer: ADOPT_C|优化器类型为CBO|所有场景均可覆盖|  
|
|辅助功能算子|MERGE|数据合并，将多路有序的数据源进行归并成一路数据的算子|merge 可覆盖|  
|
||COL TO ROW|列计算转为行计算|所有场景均可覆盖|  
|
|分组/排序算子    
    
    
    
    
    
    
    
    
    
    
    
|SORT|优化器根据实际情况生成的排序计划|子查询位于 order by,- dual 表作为子查询
- 列表作为子查询
|  
|
||TOP SORT|根据实际情况生成前TOP个数据的排序计划|子查询位于 limit,- dual 表作为子查询
- 列表作为子查询
,子查询位于 order by,- dual 表作为子查询
- 列表作为子查询
|  
|
||SORT ORDER BY|order by语句产生的排序计划|子查询位于 order by,- dual 表作为子查询
- 列表作为子查询
|  
|
||HASH DISTINCT|hash除重|子查询位于目标列,- dual 表在子查询
- 列表在子查询
|  
|
||SORT DISTINCT|排序除重|子查询位于 order by,- dual 表作为子查询
- 列表作为子查询
|  
|
||SORTED DISTINCT|使用排序算法对已排序的数据进行除重|子查询位于 order by,- dual 表作为子查询
- 列表作为子查询
|  
|
||TOP SORT DISTINCT|使用排序算法对已排序的数据进行除重，并返回前TOP个|子查询位于 limit,- dual 表作为子查询
- 列表作为子查询
,子查询位于 order by,- dual 表作为子查询
- 列表作为子查询
|  
|
||HASH GROUP|hash分组|子查询位于 group by,- dual 表作为子查询
- 列表作为子查询
|  
|
||GROUP|已排好序的分组|子查询位于 group by,- dual 表作为子查询
- 列表作为子查询
,子查询位于 order by,- dual 表作为子查询
- 列表作为子查询
|  
|
||SORT GROUPING SETS|按照多个列进行分组，并对结果进行Union操作|子查询位于 group by,- dual 表作为子查询
- 列表作为子查询
,子查询位于 limit,- dual 表作为子查询
- 列表作为子查询
,子查询位于 order by,- dual 表作为子查询
- 列表作为子查询
|  
|
|并行数据交换算子（PX）,  
,  
|PX COORDINATOR|并行数据交换算子协调节点，用于并行资源的准备|打开 DEGREE_OF_PARALLEL 参数后执行用例，预期访问计划执行算子不变|  
|
||PX  I2I LOCAL,PX I2N LOCAL,PX N2I LOCAL,PX N2N LOCAL|并行数据交换算子，I代表1个节点，N代表多节点，例如PX N2I  LOCAL，代表并行多节点向一个节点发送数据，在下方Operation Information中可以找到对相应的发送方式和接收方式，发送有 RANDOM， HASH，BROADCAST的方式，接收有SORT，RANDOM的方式，同时会有发送节点到接收节点的信息如：3→1 [3][4][5]->[2]|  
|  
|


2、多个算子组合测试

|多算子组合测试|组合算子|  
|
|---|---|---|
|  
|merge join + 索引扫描算子 +   分组/排序算子|  
|
|  
|nest loop + 索引扫描算子 +   分组/排序算子|  
|
|  
|多个 join 嵌套混合|  
|


3、与 view 和 create table 功能交互

|交互功能|测试点|备注|
|---|---|---|
|create table|create table t1 as select (dual 表 + 列表)|  
|
|view|create view v1 as select (dual 表 + 列表)|  
|
|  
|dual 表和 view 混合查询,- view 中包含列表
- view 中同时包含列表和 dual 表
|  
|
|  
|列表和 view 混合查询,- view 中包含 dual 表
- view 中同时包含列表和 dual 表
|  
|


4、  与 heap 表和系统表混合查询（heap 表/系统表 和列表混合查询优先级放低，上车看库上用例覆盖情况）

|交互功能|测试点|预期|
|---|---|---|
|heap 表|heap 表和列表混合查询,- hash join 算子
- merge join 算子
- nest loop 算子
- heap 表/列表作为子查询
|执行失败|
|  
|heap 表、列表、dual 表混合查询,- hash join 算子
- merge join 算子
- nest loop 算子
- heap 表/列表/dual 表作为子查询
|执行失败|
|系统表混合查询|系统表和列表混合查询,- hash join 算子
- merge join 算子
- nest loop 算子
- 系统表/列表作为子查询
|执行失败|
|  
|系统表、dual表、列表混合查询,- hash join 算子
- merge join 算子
- nest loop 算子
- 系统表/列表/dual表作为子查询
|执行失败|
|系统视图混合查询|系统视图和列表混合查询,- hash join 算子
- merge join 算子
- nest loop 算子
- 系统视图/列表作为子查询
|执行失败|
|tac 表和 lsc 表|混合查询同时包含 tac 表、lsc 表、dual 表,- hash join 算子
- merge join 算子
- nest loop 算子
- 系统视图/列表作为子查询
|执行成功|


5、算子与 CTE、  投影列   组合测试

|交互功能|测试点|预期|
|---|---|---|
|CTE|语句中包含 CTE，同时包含 dual 表和列表,- hash join 算子
- merge join 算子
- nest loop 算子
- 索引扫描算子
|执行成功|
|投影列|语句中包含   投影列  ，同时包含 dual 表和列表,- hash join 算子
- merge join 算子
- nest loop 算子
- 索引扫描算子
|执行成功|


6、支持 UTF8 和 GB18030 字符集

|交互功能|测试点|预期|
|---|---|---|
|字符集|- 列表包含 GB18030 字符集字符，和 dual 表混合查询
- GB18030 工程复用用例
|执行成功|


7、与 dblink 交互

|交互功能|测试点|预期|
|---|---|---|
|dblink|远端表为列表和 dual 表混合查询,- hash join 算子
- merge join 算子
- nest loop 算子
- 远端表/dual 表为子查询
- 执行 union all 操作
|执行成功|


|系统级DFX分类|是否涉及|
|---|---|
|CT|Y|
|KT|Y|
|长稳|Y|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|N|
|压力|N|
|性能|N|
|可维护性|N|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[YDBRD-30817 支持dual和列表混合查询测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTY4OTcwYzJhZjRmNTIxNWI2IiwicmVmX2lkIjoiNjczOTZkZTU1OTNmOTljOWZmMjM4MGUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTc5LCJleHAiOjE3ODIzOTkzNzl9.RZj0b9S9bHvpz_1BnYWOTIRn-mBoXvlLymcwJ3qF994)

# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


## Attachments:

[image2023-12-20_16-36-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZWFhMWFkOWEzMzExZGM5NDNmIiwicmVmX2lkIjoiNjczOTZkZTU1OTNmOTljOWZmMjM4MGUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTc5LCJleHAiOjE3ODIzOTkzNzl9.pqql42JLMDsbH_mouUPS29o-eYdVBx5bICz-dYBA6ws)

 (image/png)    


[image2023-12-20_16-38-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZWE4OTcwYzJhZjRmNTIxNWNlIiwicmVmX2lkIjoiNjczOTZkZTU1OTNmOTljOWZmMjM4MGUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTc5LCJleHAiOjE3ODIzOTkzNzl9.ZANtXf0CNm6ALeuZsCLdMPiNyYibHFFgq7fmt0wBIUc)

 (image/png)    


[image2023-12-20_11-25-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZWFhMWFkOWEzMzExZGM5NDQzIiwicmVmX2lkIjoiNjczOTZkZTU1OTNmOTljOWZmMjM4MGUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTc5LCJleHAiOjE3ODIzOTkzNzl9.IqYfHQsRCh3XlSD9KJ8i5nhghQH1f7UGytgMpiqGbz0)

 (image/png)    


[image2023-12-20_15-44-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZWE4OTcwYzJhZjRmNTIxNWQ1IiwicmVmX2lkIjoiNjczOTZkZTU1OTNmOTljOWZmMjM4MGUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTc5LCJleHAiOjE3ODIzOTkzNzl9.rj8Zn_i7DffCKX-JhPPqgz9sinxKGkQyz-uqhvCh-jE)

 (image/png)    


[image2023-12-20_9-59-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZWJhMWFkOWEzMzExZGM5NDRiIiwicmVmX2lkIjoiNjczOTZkZTU1OTNmOTljOWZmMjM4MGUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTc5LCJleHAiOjE3ODIzOTkzNzl9.omwYeV_fPk4ucDkj0C4pNGz_pZdB5svYS1Ei7-RN6fc)

 (image/png)    


[YDBRD-30817 支持dual和列表混合查询测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTY4OTcwYzJhZjRmNTIxNWI2IiwicmVmX2lkIjoiNjczOTZkZTU1OTNmOTljOWZmMjM4MGUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTc5LCJleHAiOjE3ODIzOTkzNzl9.RZj0b9S9bHvpz_1BnYWOTIRn-mBoXvlLymcwJ3qF994)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,【会议纪要】,与会人：胡威振、孟麟、刘立、何阳、黄靖东    
  会议时间：2024-09-13 14：30 ~ 15：30    
  会议地点：线上    
  腾讯会议：281-251-022    
  纪要信息：,1、insert/update/delete/merge + select，在 insert + select 中覆盖全量场景，其他的不重复覆盖    
  2、数据类型明确不相关的场景，确认 lob 类型的影响范围是否相关    
  3、和 heap 混合优先级放低，库上已有用例，可以放到上车之后    
  4、开发加强自测，明确如何分配用例执行方案，持续沟通推进,评审通过与否：通过,Posted by liuli at 九月 13, 2024 15:30|
|---|
