Created by 易文亮, last modified on 五月 05, 2023

# **1. 概述**

本文  描述tac表支持nologging优化的测试设计

# **2. 需求分析**

SR:    [YDBRD-8342](https://jira.yasdb.com/browse/YDBRD-8342?src=confmacro)    -  TAC支持nologging load  完成

开发设计：    [TAC支持nologging load](https://conf.yasdb.com/pages/viewpage.action?pageId=100095793)  

1.支持建nologging表、索引

2.支持alter table为nologging

3.支持插入、批量插入、查询

nologging模式下，批插能提升效率，降低IO负载，但宕机后无法从redo恢复数据，存在数据丢失的分析，主备无法同步，主要用于数据迁移，迁移完成后，alter table logging会添加checkpoint，以满足logging的需要。如果alter table logging前宕机，表会被标记corrupted, 需要进行truncate。

# **3. 测试**  **设计方法**   

测试设计主要采用场景法、等价类和错误推测法来进行测试设计

测试分析：

1)、表的nologging属性，系统表可查；index的nologging属性暂时只是语法支持，优化跟着表走

2)、nologging的表不能进行update/delete操作，alter table为logging成功后恢复

3)、nologging的index不能进行涉及index的更新操作，alter index为logging成功后恢复

4)、nologging属性下，节点异常表会被标记为corrupted，被标记后只能进行truncate来解除标记

节点不异常的情况下，哪些场景能使nologging表进入corrupted状态？  insert失败

起事务后，insert报错会触发表corrupt。比如insert/update/delete成功后不提交，再insert失败，会导致事务内所有的nologging表corrupt

功能关注点：

1)、nologging表或index进行业务操作，不支持update/delete，支持其他alter/select等业务

2)、nologging表或index触发corrupted验证，corrupted后各种非truncate的业务操作报错验证

3)、使用truncate解除corrupted后业务验证

4)、nologging的表alter为logging后进行各种业务操作

  


# 4.   **详细测试设计**

  


4.1 语法覆盖

|**输入条件**|语句|**有效等价类**|**编号**|**备注**|**无效等价类**|**编号**|**备注**|
|:---|---|:---|:---|:---|:---|:---|:---|
|表类型tac,普通表,分区表,tac字典编码表|create table|表后带nologging,表后不带/带logging——原逻辑,  
|1,2、3,4|  
|1、同时带logingg/nologing,2.关键字重复,3.关键字拼写错误,4.关键字在分区表子分区后,5、关键字在row movement后|11|  
|
||alter table|nologging改成logging,logging改成nologging,子分区,  
|5,6,7|  
|1、同时带logingg/nologing,2.关键字重复,3.关键字拼写错误,4.关键字在分区表子分区后,5、关键字在row movement后|12|  
|
|普通索引,分区索引,唯一索引|create index|带nologging——表逻辑,不带/带logging——表逻辑,  
|8,9、10,  
|  
|1、同时带logingg/nologing,2.关键字重复,3.关键字拼写错误,4.关键字在分区索引子分区后|13|  
|
|heap表的列式索引|1. create/rebuild columnar index
|带nologging——表逻辑,不带/带logging——表逻辑,子分区带？|  
|  
|1、同时带logingg/nologing,2.关键字重复,3.关键字缺失,4.关键字拼写错误|  
|  
|


logging属性在系统表：

select table_name,logging from dba_tables where table_name like '%xx%';

select index_name,logging from dba_indexes where index_name like '%xx%';

4.2 主要场景

触发corrupted标记，记录视图v$corrupted_table

|**编号**|**内容**|
|:---|:---|
|0|nologging的空表不进行任何操作停库，表被标记corrupted|
|1|nologging的表单插不提交后停库，表被标记corrupted|
|2|nologging的表单插提交后停库，表被标记corrupted|
|3|nologging的表批插不提交后停库，表被标记corrupted|
|4|nologging的表批插提交后停库，表被标记corrupted|
|5|nologging的表导入过程中停库，表被标记corrupted|
|6|nologging的表导入过程成功后停库，表被标记corrupted|
|7|表被标记corrupted进行单插/批插/导数报错|
|8|表被标记corrupted进行select查询|
|9|表被标记corrupted进行alter增删列、modify datatype、加约束|
|10|表被标记corrupted对表创建index/唯一索引|
|11|表未被标记corrupted多次进行单插/批插/导数|
|12|表未被标记corrupted进行select查询|
|13|表未被标记corrupted进行alter增删列、modify datatype、加约束|
|14|表未被标记corrupted对表创建index/唯一索引|
|15|表被标记corrupted进行update/delete报错|
|16|表被标记corrupted进行truncate/drop正常|
|17|表未被标记corrupted进行update/delete报错|
|18|表未被标记corrupted进行truncate/drop正常|
|  
|nologging的空表alter为logging后能正常执行增删查改/alter表列、约束等/create index|
|  
|nologging的表单插/批插/导入后再alter为logging后能正常执行增删查改/alter表列、约束等/create index|
|  
|logging的表改为nologging后能适用功能优化|
|  
|  
|


并发

|编号|场景|
|---|---|
|1|insert+insert|
|2|insert+select|
|3|insert+select+update+delete|
|4|insert+select+alter|
|5|insert+select+update+delete+alter+truncate|
|6|index+3|
|7|index+5|


  


4.3 性能测试

|编号|场景|
|:---|:---|
|1|普通表logging与nologging下单插性能对比|
|2|普通表logging与nologging下批插性能对比|
|3|普通表logging与nologging下导入性能对比|
|4|分区表logging与nologging下单插性能对比|
|5|分区表logging与nologging下批插性能对比|
|6|分区表logging与nologging下导入性能对比|
|7|带index的普通表logging与nologging下单插性能对比|
|8|带index的普通表logging与nologging下批插性能对比|
|9|带index的普通表logging与nologging下导入性能对比|
|10|带index的分区表logging与nologging下单插性能对比|
|11|带index的分区表logging与nologging下批插性能对比|
|12|带index的分区表logging与nologging下导入性能对比|


并对比确认redo的大小

SELECT a.VALUE    
      FROM v$mystat a,v$statname b    
  WHERE a.STATISTIC#=b.STATISTIC#    
        AND b.NAME='REDO SIZE';

select total_write_size from V$REDOSTAT;

# 4.3 HA

HA主备环境建表nologging报错

ha_regress启单节点验证corrupt

|编号|场景|
|---|---|
|1|启HA主备环境创建表带nologging报错|
|2|启HA主备环境创建logging表，尝试修改为nologging报错|
|3|启单机nologging空表shutdown/kill等节点异常，表corrupt|
|4|启单机nologging非空表shutdown/kill等节点异常，表corrupt|
|5|启单机能正常insert/导入并发|
|6|启单机有事务insert报错，表corrupt|
|7|启单机导入报错，开启了事务，，表corrupt|
|8|启单机导入报错，未开启了事务，表不会corrupt|
|9|logging表设置nologging模式能正常导入|


# 5.   **测试用例**

[tac表支持nologging优化测试设计(ydbrd8342).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTJhMWFkOWEzMzExZGM3OThiIiwicmVmX2lkIjoiNjczOTY5ZTI1OTNmOTljOWZmMjM1M2NlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjgzLCJleHAiOjE3ODIyOTYwODN9.5OJdvyAtw2hBOYQSD9g-4DmevdIlEKqgnz98z99qupc)

[YDBRD8342tac表支持nologging测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTJhMWFkOWEzMzExZGM3OThjIiwicmVmX2lkIjoiNjczOTY5ZTI1OTNmOTljOWZmMjM1M2NlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjgzLCJleHAiOjE3ODIyOTYwODN9.kUaDaWz4GHQcllVePtC5IE3UiqoFOC393ZMgj3X_kiU)

# 6.   **测试框架设计**

语法添加到yasft，场景主要通过HA

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[tac表支持nologging优化测试设计(ydbrd8342).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTJhMWFkOWEzMzExZGM3OThiIiwicmVmX2lkIjoiNjczOTY5ZTI1OTNmOTljOWZmMjM1M2NlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjgzLCJleHAiOjE3ODIyOTYwODN9.5OJdvyAtw2hBOYQSD9g-4DmevdIlEKqgnz98z99qupc)

 (application/x-xmind)    


[YDBRD8342tac表支持nologging测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTJhMWFkOWEzMzExZGM3OThjIiwicmVmX2lkIjoiNjczOTY5ZTI1OTNmOTljOWZmMjM1M2NlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjgzLCJleHAiOjE3ODIyOTYwODN9.kUaDaWz4GHQcllVePtC5IE3UiqoFOC393ZMgj3X_kiU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
