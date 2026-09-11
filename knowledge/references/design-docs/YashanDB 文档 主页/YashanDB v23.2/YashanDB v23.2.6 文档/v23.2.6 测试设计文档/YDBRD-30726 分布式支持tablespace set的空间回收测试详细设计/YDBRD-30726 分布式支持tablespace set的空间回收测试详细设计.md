Created by 刘美秀, last modified on 十月 15, 2024

# 1. 概述

分布式支持收缩表空间集，通过shrink tablespace set释放磁盘空间，keep 关键字指定了表空间收缩的空间大小，如果不指定keep关键字，表空间的大小将尽可能的缩小。

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/66a1bcc68f5ee1917345bcd1](https://pingcode.yasdb.com/pjm/items/66a1bcc68f5ee1917345bcd1)    ?    
  #YDBRD-30726 分布式支持tablespace set的空间回收功能

  


开发设计：    [分布式支持tablespace set的空间回收功能设计](https://conf.yasdb.com/pages/viewpage.action?pageId=163019054)  

## 2.1 功能点分析

- 收缩dbfile 的文件大小：alter tablespace set xxx shrink space [keep size]
- 收缩tablespace set的maxsize ：alter tablespace set xxx maxsize 3M;
- 新增系统视图   DBA_TSS_TABLESPACES
- 新增动态视图   v/gv$tablespace_set,dv不考虑
- 错误码--无新增
- 日志告警：收缩maxsize < 最小可收缩值
- 审计action- create/drop/  alter tablespace set  --低优先级
- root tablespace 缩小，代码中缩小 64M改为1M 
- bucket的空间回收？–在资料收缩示例中提供databucket 收缩指导--oracle调研


  


**新增语法**

alter tablespace set xxx shrink space [keep size]

~~alter tablespace set xxx maxsize 3M~~

**新增视图**

（1）DBA_TSS_TABLESPACES：展示tablespace set和tablespace的关系，  **只展示chunk表空间，**  本地视图，在单机/集群下为空

|字段|说明|
|:---|:---|
|TABLESPACE_NAME|表空间名称|
|TABLESPACE_ID|表空间id|
|TABLESPACE_SET_NAME|表空间集名称|
|CHUNK_ID|这个表空间对应哪一个chunk,如果是root表空间则该项为空|
|RESIDUAL|这个表空间是不是重分布残留的旧表空间，即当前表空间已经迁移到别的节点（yes/no）|


（2）  gv$tablespace_set databucket的size统计只统计本地，不包括s3 databucket

|字段|说明|
|:---|:---|
|OID|表空间集的oid|
|NAME|表空间集的名字|
|DS_ID|所属dataspace的id|
|NEXT_SIZE|这个表空间集中的数据文件每次扩张的大小|
|DATAFILE_COUNT|这个表空间集合下数据文件的总数|
|DATAFILE_MAX_SIZE|这个表空间集在当前节点的数据文件的总最大SIZE|
|DATAFILE_SIZE|这个表空间集下所有datafile的实际大小|
|DATAFILE_FREE_BLOCK|  
|
|DATABUCKET_COUNT|这个表空间集合下DATABUCKET文件的总数|
|DATABUCKET_MAX_SIZE|这个表空间集在当前节点的DATABUCKET文件的总最大SIZE|
|DATABUCKET_SIZE|这个表空间集下所有databucket的实际大小|


  


**开发设计的主要原理**

1.解析：是否存在语法错误、在parse阶段复用tablespace shrink的主要流程

2.校验：校验涉及的元数据对象是否存在，需要查询视图gv$tabelsapce_set, 确定shrink这里keep的size比当前size更小，否则报错

3.执行：

（1）遍历tablespace set下的每一个chunk tablespace，调用shrink space的接口（忽略root tablespace）

（2）若指定keep size:

- 在shrink开始时查gv视图检查keep的size是否比当前实际的size更大，如果更大则返回报错；
- 若 keep_size < sum(gv$tabelsapce_set.size)：若 当前chunk_act_size > avg(gv$tabelsapce_set.keep_size ) 则收缩该chunk，


（3）加锁：加上space→ddlLatch的排他锁控制不能有并发创建删除文件的行为，加上space→extLock控制不允许申请或释放该表空间下的文件的空间

（4）收缩chunk：从后往前遍历datafile，如有file0和file1，会先收缩file1，当已shrnik的blocks达到keep_blocks时结束shrink流程

4.失败回滚：走DDL一阶段流程 （表空间加锁失败、redo持久化失败）

  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396de5a1ad9a3311dc9427/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5NjgsImV4cCI6MTc4MjMyMzc2OH0.clbqNyh46bCPOT7hkqsnFgkGgkxxkkP9Z8wFDZCDkDA)

  


  


## 2.2 应用场景

- 根据用户需要指定表空间集


## 2.3 规格约束

1. alter tablespace set xxx shrink space keep size，如果指定的size大于当前实际size，则报错。如果没有报错，但最终缩不到预期size，会返回成功，得到的大小不会比size更小但可能更大。
1. 新增视图DBA_TSS_TABLESPACES，视图中不会展示root表空间,目前只支持查询本地关系，未来规划查全局信息。
1. shrink space、resize的时候都不涉及root表空间。
1. 改小maxsize会使得maxsize尽可能的改小到指定值，但是如果指定的maxsize小于实际的size，则不会再改小。因此修改maxsize后得到的结果可能大于指定的maxszie。
1. tablespace_set$中记录的maxsize可能不准。
1. mms tablespace set不支持收缩


## 3. 详细测试设计

## 3.1 测试设计方法

|验证项|设计方法|
|:---|:---|
|语法校验|等价类划、边界值|
|功能验证|等价类划、错误推测、边界值|
|特性交互|等价类划|
|专项验证|等价类划|


### 特性关联领域分析：

1. 功能：语法及功能是否生效
1. 视图：  DBA_TSS_TABLESPACES、gv$tablespace_set databucket 信息准确
1. 并发：alter tablespace set/DML/DQL并发、  DDL-alter tss resize/shrink-DDL_LOCK_TIMEOUT
1. 升级： 升级后查询视图、基础功能验证
1. 扩缩容：元数据变更后扩容成功，新扩容节点元数据和已有节点元数据一致；扩容备节点期间alter 成功
1. 审计：操作能被审计
1. 元数据一致性：执行DDL时注入故障，故障解除后元数据最终一致


  


## 3.2 详细测试设计

**语法验证**

|输入条件|有效等价类|无效等价类|
|:---|:---|:---|
|keep size   size_clause|int 不带单位/k/m/g/t/p/e/|其他数据类型，单位错误，为空，为负数|
|  
|size_clause <   sum(gv$tabelsapce_set.size)|size_clause   >= sum(gv$tabelsapce_set.size)|
|maxsize   size_clause|size_clause < maxsize|size_clause    > maxsize-扩大成功|


**功能验证**

|命令/验证类|验证项|验证点|预期|备注|
|---|---|---|---|---|
|  
|tablespace set类型覆盖|user|  
|  
|
|  
|  
|users_aim|不能shrink mms表空间集|  
|
|  
|  
|普通自定义表空间集|  
|  
|
|  
|  
|mms自定义表空间集|  
|  
|
|  
|表列|普通列/lob列|  
|  
|
|  
|表类型|lsc/tac|  
|  
|
|  
|数据|truncate 所有数据记录后收缩|  
|  
|
|  
|  
|truncate 部分数据记录后收缩|  
|  
|
|  
|  
|truncate 二级分区|  
|truncate 一级分区 不支持|
|  
|  
|drop表|  
|  
|
|  
|  
|drop 二级分区|  
|  
|
|  
|  
|delete 数据记录后收缩|  
|  
|
|  
|  
|create 立即创建segment|  
|  
|
|  
|执行用户|sys/dba|  
|  
|
|  
|chunk|规格：chunk=128 * 32 DN组|  
|  
|
|shrink space keep size |  
|收缩部分chunk: chunk_size >   size_clause/chunk数|日志告警|  
|
|shrink space keep size ,alter maxsize |文件|收缩所有文件|  
|  
|
|  
|  
|仅收缩部分文件|从后往前收缩–maxsize ,size-调研单机|  
|
|shrink space keep size |size_clause边界|size_clause = sum(gv$tabelsapce_set.size)|报错|  
|
|  
|  
|size_clause = sum(gv$tabelsapce_set.size) +1|报错|  
|
|  
|  
|size_clause = sum(gv$tabelsapce_set.size) -1|不报错，但实际不收缩|  
|
|  
|  
|size_clause = sum(gv$tabelsapce_set.size) - block*chunk数|  
|  
|
|alter maxsize |size_clause边界|size_clause = maxsize |  
|  
|
|  
|  
|size_clause = maxsize +1|  
|  
|
|  
|  
|size_clause = maxsize -1|  
|  
|
|  
|  
|size_clause = maxsize - block*chunk数|  
|  
|
|  
|收缩单位|block?|  
|  
|
|alter tablespace-dn执行|关联验证|shrink root ts|  
|  
|
|  
|  
|~~offline root ts~~|  
|  
|
|  
|  
|~~offline  chunk ts~~|  
|  
|
|  
|其他|扩大之后再缩小，反复操作多次|  
|  
|
|  
|  
|重分布之后验证收缩|  
|  
|
|  
|数据完整性验证|收缩后查询数据和收缩前一致，收缩后DML 成功|  
|  
|
|  
|查看root ts size为1M|users/users_aim,普通自定义表空间集/mms自定义表空间集|  
|  
|


  


**视图验证**

|视图, |  
|字段值正确|  
|  
|
|---|---|---|---|---|
|DBA_TSS_TABLESPACES,gv$tablespace_set|  
|字段值正确|  
|  
|
|  
|  
|单机集群查询为空|  
|  
|
|  
|  
|DBA_TSS_TABLESPACES   重分布且不删除残留后查询|能查到残留chunk，且  RESIDUAL=TRUE|  
|
|  
|  
|alter system clean residual tablespace清理残留后再次查询|无残留的chunk|  
|
|  
|  
|dv$tablespace_set ?---无|  
|  
|
|  
|filter     覆盖|in/not in、exists/not exists、between and、like/not like|  
|  
|
|  
|  
|distinct/order by/group by/group by...having/子查询/union/union all|  
|  
|
|  
|  
|join on   验证视图 join 内部表|  
|  
|
|  
|  
|join on   验证视图 join dba|  
|  
|
|  
|  
|join on   验证视图 join gv$|  
|  
|


  


**特性交互**

|测试项|描述|
|---|---|
|升级|升级后查看,- DBA_TSS_TABLESPACES、gv$tablespace_set databucket
|
|  
|升级后收缩|
|审计|create/alter/drop tablespace set能被审计|
|扩缩容|size/maxsize 收缩 后扩容DN组|
|  
|size/maxsize 收缩  后扩容CN|
|  
|扩容备节点期间size/maxsize 收缩 成功|
|  
|扩缩容期间作为业务背景|
|  
|  
|


  


**专项验证**

|测试项|描述|备注|
|---|---|---|
|HA|收缩后，备机也能同步到收缩后 的大小|  
|
|DDL一致性|alter tss shrink size/keep size/alter tss maxsize时执行CN故障|最终一致|
|  
|alter tss shrink size/keep size/alter tss maxsize时其他CN故障|  
|
|  
|alter tss shrink size/keep size/alter tss maxsize时MN主节点故障|  
|
|  
|alter tss shrink size/keep size/alter tss maxsize时MN switchover|  
|
|  
|alter tss shrink size/keep size/alter tss maxsize时DN主节点故障|  
|
|  
|alter tss shrink size/keep size/alter tss maxsize时DN switchover|  
|
|并发|alter tss shrink space + insert/update/DQL|  
|
|  
|alter tss maxsize + insert/update/DQL|  
|
|  
|resize+ shrink|  
|
|性能|3DN组，21个chunk，收缩500G用时|摸底|
|  
|收缩对性能的影响：tpch & tpch+表空间集收缩-10G-|摸底|


  


**资料：**

|验证项|验证点|
|---|---|
|视图 |DBA_TSS_TABLESPACES、gv$tablespace_set|
|alter tablespace set 语法更新|新增shrink |
|bucket的空间回收|在资料收缩示例中提供databucket 收缩指导|


  


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|测试点|
|:---|:---|---|
|并发|是|主要为ddl、dml并发，具体参考上文专项验证-HA|
|长稳|是，  涉及新增语法|alter tablespace set 自定义表空间集 shrink space [keep size]|
|一致性|是|节点故障时执行新增DDL，故障解除后元数据一致，具体参考上文专项验证- DDL一致性|
|三方测试工具    
  (sqltest，sqlancer)|sqlancer：看护select语法变更，不涉及,sqltest：覆盖DDL DML DQL DCL语法，涉及,|alter tablespace set 自定义表空间集 shrink space [keep size],|
|安全|否，不涉及用户密码/权限等安全相关改动||
|DFR/testkill|是|节点故障时执行新增DDL，已在DDL一致性中覆盖|
|HA|是|收缩后，备机也能同步到收缩后 的大小|
|压力|否，表空间集DDL已加排他锁，不涉及增大负载的负载/峰值/耐久性等测试||
|性能|是|具体参考上文专项验证-性能|
|可维护性|是|涉及文档测试-资料验证，具体参考上文资料部分,不涉及易分析性/易测试性/配置管理|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

冒烟：

  


  


文本：

上架文本用例：

特性功能：

特性交互+专项+手工

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *4人天*

计划测试执行时间：

## Attachments:

[分布式默认表空间集文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTQ4OTcwYzJhZjRmNTIxNWFjIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.-0N8vBAMwvyKhXuNGEXTGIfBdm638J6tM9wk0_GjiHs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-6-18_15-28-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTQ4OTcwYzJhZjRmNTIxNWFkIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.YZWFZsQU-7DET9jytd6ELDHR_68_-Ytwf_ifB9CHMn8)

 (image/png)    


[test_sr26618_smoke.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTQ4OTcwYzJhZjRmNTIxNWFlIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.EyQoZ8MgL3UhmFjyR1OOCjVya8feKTgxHrVUO2gZpxw)

 (application/octet-stream)    


[DBMS_APPLICATION_INFO文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTQ4OTcwYzJhZjRmNTIxNWFmIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.TKVd8KFolrI6s8RBpNDjamcUR0VIbOLzMhysWIfL4Ek)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-5-22_1-9-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTU4OTcwYzJhZjRmNTIxNWIwIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.51f0Wrbxa2bfQnPY1CCLdifWBvgB7_n4DeltFxjDY00)

 (image/png)    


[set_false.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTVhMWFkOWEzMzExZGM5NDIzIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.Inq7Z_gqyesIAdpbZPBJUpU4WiGfxdi_TLgaWyFo-Gg)

 (image/png)    


[分布式表空间集收缩文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTU4OTcwYzJhZjRmNTIxNWIxIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.nUWYTC3M_AkdAAt7LfvatWdnhpKEMwmb9U83Nct4UkM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式表空间集收缩文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTVhMWFkOWEzMzExZGM5NDI1IiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.51Ap3E5s3-cmMK1CEEftzwCWtA_Ep_7WwvwhnZv_EWY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式表空间集收缩文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTU4OTcwYzJhZjRmNTIxNWIyIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.9MfgpkwdAdQZvYx1GeQKwqKxTMNty9_fiE_N8r_tafY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式表空间集收缩文本用例_YTP_FT_自动化.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTU4OTcwYzJhZjRmNTIxNWIzIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.Y8gH6Cpu_2Y7xORnBqYm1CqZdnYM7UevOQLoUGeJUuE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式表空间集收缩文本用例_YTP_非功能+手工.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTVhMWFkOWEzMzExZGM5NDI2IiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTY4LCJleHAiOjE3ODIzOTkzNjh9.1s48t-8asPuWgpUOccM-GTwqncExb0KgM0YP8pROyCI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：何阳，冯浩楠，施新华，张璐恒，刘美秀    
  会议时间：10:00-12:00    
  会议地点：线上    
  纪要信息：     
  1.信息同步：create/drop/alter tablespace set 增加审计权限--低优先级    
  2.信息同步：仅增加v/gv$tablespace_set,不增加dv    
  3.新增验证场景：DDL并发-alter tss resize/shrink-(DDL_LOCK_TIMEOUT!=0)    
  gv$tablespace_set,dv不考虑,Posted by liumeixiu at 九月 13, 2024 14:24|
|---|


