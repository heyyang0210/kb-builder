Created by 刘晓旋, last modified on 十二月 14, 2023

IR链接：    [YDBRD-23848](https://jira.yasdb.com/browse/YDBRD-23848?src=confmacro)    -  分布式支持优化器TopN计划和选择  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

本需求实现分布式支持提取前面排序的N条有序结果。  Top N 表示取前 N 条有序的结果集，使每次排序只在 N 个大小的集合进行排序，提高执行效率； 主要用于order by + limit (offset) 场景。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

分布式支持 TopN 计划

```
-- 示例：支持topN的计划
SQL> explain select * from t1 order by b limit 5 ;

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 2243065276                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
|  2 |   COL TO ROW                   |                      |            |         5|      301( 0)|                                |
|  3 |    WINDOW                      |                      |            |         5|      301( 0)|                                |
|  4 |     PX N2I REMOTE              | QUEUE_0              |            |         5|      301( 0)|                                |
|  5 |      WINDOW                    |                      |            |         5|      299( 0)|                                |
|  6 |       TOP SORT                 |                      |            |    100000|      299( 0)|                                |
|  7 |        PART SCAN ALL           |                      |            |    100000|      270( 0)| [0,20]                         |
|  8 |         TABLE ACCESS FULL      | T1                   | REGRESS    |    100000|      270( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   2 - Projection: RemoteTable[1][INTEGER], RemoteTable[1][CHAR, 20]
   3 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
       Limit Expression: (LIMIT: 5)                             
   4 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
       PX RemoteInfo: (RANDOM SENDER -> SORT RECEIVER : 3->1 [3][4][5]->[2])
   5 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
       Limit Expression: (LIMIT: 5)                             
   6 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
   7 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
   8 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  

30 rows fetched.
```

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

与单机一致：

1、N 由 limit 跟 offset 的和决定，目前没有限制，大于 uint32 的最大值才不会选上该计划。

2、插入 key 的每行大小不超过 19K，否则报错

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

排序后只取 N 条数据的场景

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

1. 测试数据具有随机性无序性、包含 null、空串、中英文字符、特殊字符等
1. DB_BLOCK_SIZE 覆盖：默认8K、32K
1. 排序的数据量覆盖：1个页、多个页
1. 表类型覆盖：分布表无分区、既有分布又有分区。分区表覆盖：hash/range/list
1. 排序字段数量：单个、多个
1. 排序顺序：正序、逆序
1. 排序字段类型：所有数据类型、udt 类型、伪列
1. 排序字段覆盖：列、常量数值、表达式、NULL、NULL表达式
1. 排序字段的字符集编码：utf8、gbk、ASCII
1. LIMIT 语法覆盖：offset M rows fetch next N rows only
1. 排序语法 order by key null first/last limit N
1. LIMIT N，N 覆盖：N < 结果集数量、N = 结果集数量、N > 结果集数量、N > uint32
1. OFFSET M，M 覆盖：M < 结果集数量、M = 结果集数量、M > 结果集数量、M > uint32
1. LIMIT N OFFSET M，N + M< 结果集数量、N + M= 结果集数量、N + M> 结果集数量、N + M> uint32
1. 排序字段覆盖：分布键的子集、非分布键的子集、分区键的子集、非分区键的子集
1. 对视图系统表进行 TopN 排序，结果集和计划是否正确
1. 排序字段是索引约束字段，覆盖正向索引（order by index_key asc）、反向索引（order by index_key desc）
1. TopN + distinct，distinct key = sort key、distinct key != sort key
1. TopN + group by(grouping sets/cube/rollup)，groupby key = sort key，sort key 是 groupby key 的子集
1. TopN + where
1. TopN + 子查询（关联子查询（侧重）、非关联子查询）
1. TopN + join
1. TopN + 集合操作
1. TopN + 子查询 + join + 集合（复杂查询）
1. 嵌套多层 order by limit N offset M （如：128层）
1. 排序字段大小 > 19K （拦截报错）
1. LSC： 查询的排序字段 = 建表的 orderby 字段、查询的排序字段 != 建表的 orderby 字段
1. 排序方式：内排（内存资源足够，完全在内存中排序）、外排（内存资源不足，生成临时排序文件进行排序）
1. 分布式覆盖：分布表、复制表
1. 并行+分布表、并行+复制表
1. 访问计划的正确性
1. 资源严重不足的场景，TopN 的功能是否正常


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

ct/kt：并发 TopN 查询

长稳：数据量较大的场景

性能：自建测试模型，与老版本作性能对比

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

自动化看护

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

无

  


## Attachments:

[image2023-10-25_18-57-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiN2FhMWFkOWEzMzExZGM4MzNjIiwicmVmX2lkIjoiNjczOTZiN2E1OTNmOTljOWZmMjM2MzJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0ODUyLCJleHAiOjE3ODIzODEyNTJ9.JCVXiPedXQjXzfSrfAVvPEeymZdiWCi85pTFB2oSm5Y)

 (image/png)    


[image2023-10-25_18-57-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiN2E4OTcwYzJhZjRmNTIwNGM4IiwicmVmX2lkIjoiNjczOTZiN2E1OTNmOTljOWZmMjM2MzJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0ODUyLCJleHAiOjE3ODIzODEyNTJ9.wkBBQyEVu-7HnZ6nb8Xefg2XZDGbERCmyxFyWKYdwkE)

 (image/png)    


[image2023-10-25_18-56-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiN2E4OTcwYzJhZjRmNTIwNGM5IiwicmVmX2lkIjoiNjczOTZiN2E1OTNmOTljOWZmMjM2MzJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0ODUyLCJleHAiOjE3ODIzODEyNTJ9.Afi4GV4NTw3wqku2tDBXd_dsdupJVeSMu8zWIEhx3fA)

 (image/png)    


[image2023-10-25_18-56-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiN2FhMWFkOWEzMzExZGM4MzNmIiwicmVmX2lkIjoiNjczOTZiN2E1OTNmOTljOWZmMjM2MzJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0ODUyLCJleHAiOjE3ODIzODEyNTJ9.ZecFuch9opz1WX6SCALmOwpKI5FkgNb8ARJ_DsH6L2I)

 (image/png)    
