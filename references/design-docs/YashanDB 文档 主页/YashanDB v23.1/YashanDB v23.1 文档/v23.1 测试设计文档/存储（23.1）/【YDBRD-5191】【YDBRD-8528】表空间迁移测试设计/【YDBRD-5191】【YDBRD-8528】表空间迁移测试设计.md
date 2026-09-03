Created by 郑荃, last modified on 十一月 21, 2023

# **1. 概述**

​ 分布式的扩缩容需要单机提供表空间的迁移能力

# **2. 需求分析**

SR:     [YDBRD-8528](https://jira.yasdb.com/browse/YDBRD-8528?src=confmacro)    -  LSC表支持表空间迁移  完成    [YDBRD-5191](https://jira.yasdb.com/browse/YDBRD-5191?src=confmacro)    -  支持表空间级迁移  完成

开发设计：    [【Spearfish】表空间迁移](109594015.html)  

表空间迁移语法：

![](https://conf.yasdb.com/download/attachments/109594015/image2023-5-29_9-27-7.png?version=1&modificationDate=1685323627025&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2ODAsImV4cCI6MTc4MjIyMDQ4MH0.Xgb9KQN7lLPrqfflWEjR-3B3YGoWFV6YboW5SAsNiLs)

使用场景约束：

- 发送端必须开归档
- 接收端所有的备机必须在线，迁移过程中有掉线的备机，迁移失败
- 表空间迁移之后，原表空间会变成read only
- 在新库上导入元数据的过程中失败了，如导入10个表，只导入成功5个，第6个表名跟新库上原有的表名冲突，导致导入失败，会自动清理
- 不支持built-in tablespace， MMS, TEMP表空间的迁移
- 若目标结点是主备环境，迁移地址  **需要在convert_path下**


LSC约束：

- 为了避免生成新的slice，迁移期间不允许bulk_load模式导入lsc表
- 迁移表空间内不允许存在ac


黑名单

- 二级分区、二级分区索引、AC、物化视图、rtree、嵌套表、 nologging表、带主键约束的LSC表、列式索引
- 不迁移对象：triger pkg,view，外键约束、sequence default需要目标端提前创建


百名单：

- 表空间迁移支持的对象：
- 普通表： 行表，列表
- 分区表： 行表， 列表
- 索引：普通索引， 唯一索引，reverse索引，列为desc的索引， 分区索引，函数索引
- 约束： 主键约束， 唯一约束， not null约束，check约束
- Lob：需要确认varchar(32K)是否已经合入主干， 如果合入，本次也要支持


# **3. 测试**  **设计方法**   

语法验证：主要采用的等价类划分，边界值，把有效等价类做组合覆盖，无效等价类单独覆盖

功能验证：场景法组合及错误推测法进行设计。

**测试观测点：**

1、迁移成功场景下目的端进行校验迁移的表空间的各种属性是否跟源端一致

- v$tablespace 各项参数是否跟源端一致
- v$datafile\DBA_DATA_FILES 各项参数是否跟源端一致
- v$database 迁移后数据库状态正常
- dba_data_buckets


2、其他的各个测试对象到对应的系统表、视图下校验 各种属性是否跟源端一致

- 表：dba_tables、dba_segment、check_dba_part_tables、dba_tab_partitions
- 索引：DBA_INDEXES、DBA_IND_PARTITIONS
- 物化视图：MATERIALIZED_VIEW$、MV_REFOP$、MV_REFTIME$、SUM_DETAIL$
- 列信息：dba_tab_columns
- 约束：dba_constraints


3、迁移失败场景，报错符合预期， 迁移失败的残留文件要清理

4、get_ddl

- 跟数据强相关的属性必须迁移，不一致的跟get_ddl对比


**测试对象：**

- 表：不同存储属性表（heap、tac、lsc）、分区表（一级分区、二级分区）、分布表和复制表拦截、嵌套表报错、空表（空表下覆盖segement立刻场景和延迟创建）、大表、小表、带不同的存储属性
- 表空间覆盖：加密表空间、压缩表空间、自定表空间、bucket表空间（支持加密、压缩）、临时表空间报错、系统表空间报错、mms表空间报错会报错
- 索引：索引和表在同一表空间、索引和表在不同的表空间、global\local、一级分区、二级分区索引、unique、普通索引、反向索引、函数索引、列式索引、唯一索引、desc索引、带不同属性
- 普通视图、物化视图
- AC
- 跟表空间无关的对象：函数、高级包、触发器、存储过程、DBMS_JOB、DBMS_SCHEDULER、sequence、SYNONYM、comment
- 数据类型：整数、浮点、字符、raw、lob（clob、blob，行内行外存储、 varchar(32k)）、rowid、时间、枚举
- 约束：primary、unique、not null 、check ，foreign key、 default 值


**专项覆盖：**

|专项|是否涉及|说明|
|:---|:---|:---|
|并发|涉及|  
|
|长稳|/|  
|
|一致性|涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|/|  
|
|安全|/|  
|
|DFR/testkill|涉及|  
|
|HA|涉及|  
|
|压力|/|  
|
|性能|/|  
|
|可维护性|/|  
|
|兼容性|/|  
|


# 4.   **详细测试设计**   

[表空间迁移测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTFhMWFkOWEzMzExZGM3OThhIiwicmVmX2lkIjoiNjczOTY5ZTE1OTNmOTljOWZmMjM1M2NhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc5LCJleHAiOjE3ODIyOTYwNzl9.g2ToWlhnW1G9s3HQXpvOVStvhNU54MR01JT6mCrA9aQ)

# 5.   **测试用例**

[支持表空间迁移测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTE4OTcwYzJhZjRmNTFmYjE0IiwicmVmX2lkIjoiNjczOTY5ZTE1OTNmOTljOWZmMjM1M2NhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc5LCJleHAiOjE3ODIyOTYwNzl9.QcZU8dLikrzFWwTjf1NSXaxtZ8j-_B_4E4eUY2Lu3yI)

# 6.   **测试框架设计**

自动化用例添加到regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTE4OTcwYzJhZjRmNTFmYjE1IiwicmVmX2lkIjoiNjczOTY5ZTE1OTNmOTljOWZmMjM1M2NhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc5LCJleHAiOjE3ODIyOTYwNzl9.UtCgM6f9Smx5NpSlQkciGzfuJgdlqdvOi1i6ECXcSSI)

 (application/vnd.xmind.workbook)    


[表空间迁移测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTFhMWFkOWEzMzExZGM3OThhIiwicmVmX2lkIjoiNjczOTY5ZTE1OTNmOTljOWZmMjM1M2NhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc5LCJleHAiOjE3ODIyOTYwNzl9.g2ToWlhnW1G9s3HQXpvOVStvhNU54MR01JT6mCrA9aQ)

 (application/vnd.xmind.workbook)    


[支持表空间迁移测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTE4OTcwYzJhZjRmNTFmYjE0IiwicmVmX2lkIjoiNjczOTY5ZTE1OTNmOTljOWZmMjM1M2NhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc5LCJleHAiOjE3ODIyOTYwNzl9.QcZU8dLikrzFWwTjf1NSXaxtZ8j-_B_4E4eUY2Lu3yI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
