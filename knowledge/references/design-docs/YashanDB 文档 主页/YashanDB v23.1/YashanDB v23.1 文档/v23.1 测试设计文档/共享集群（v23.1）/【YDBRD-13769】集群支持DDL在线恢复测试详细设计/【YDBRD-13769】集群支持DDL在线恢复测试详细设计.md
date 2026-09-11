Created by 吕雷奇, last modified on 十二月 28, 2023

sr连接：    [YDBRD-13769](https://jira.yasdb.com/browse/YDBRD-13769?src=confmacro)    -  【共享集群】DB支持DDL在线恢复  完成

开发设计文档：    [集群DB支持DDL在线恢复 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119557942)  

# 1. 概述

*集群部署下多实例（当前限定为两实例），执行DDL时后需要广播其他实例做元数据同步。元数据在处于DDL事务提交后，但是由于实例本身故障或者实例和实例之间通讯故障，导致部分实例没有同步到数据，会导致集群元数据不一致。本sr的范围是 db的master 实例（做在线恢复实例）将存活元数据修正。*

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


1.逻辑日志和事务结束日志一起记录，随后其他实例同步元数据的修改。记录逻辑日志时需要暂停ckpt推点，防止元数据未全部同步，但是日志回放起始点已经推至逻辑日志之后。记录逻辑日志的地方主要集中在ddl第二阶段，还有部分场景分散在其他地方。前者可以统一处理暂停推点，后者需要在各业务场景自己暂停。

2.因为存在上述规则约束，所以，记录从逻辑日志到同步元数据的整个阶段变为不可并发的状态。实例故障时，最多只会存在一条逻辑日志需要处理。

3.逻辑日志回放的处理过程中，可能涉及读取系统表页面，因此需要在物理日志回放结束后进行。

4.   在线恢复是通过故障实例日志使得全局数据和元数据达到一致性状态。现存的逻辑日志场景部分需要重新设计，以适应集群的回放逻辑。

5. 逻辑日志存在依赖性，回放的顺序是靠日志的lsn的大小关系。为了保证多实例下存在依赖的逻辑日志的lsn保序，需要在相应的同步逻辑里lamport lsn。

6. 逻辑日志过滤，除了interval分区扩展之外，其他的逻辑日志都是持有相应对象的全局X锁进行，GRC资源恢复后，故障实例的owner信息已经清除，如果是需要回放的逻辑日志的场景，对应的锁资源一定没有持有X的owner，否则，就跳过此逻辑日志。

## 2.2 应用场景

- *需求本身的主要应用场景*
- *需求与其他特性的关联场景*


*当前场景的触发类型*

|触发类型|场景|执行sql|修改|回放逻辑|
|---|:---|:---|:---|:---|
|ddl触发|创建、修改、删除profile|1、create profile,![](https://conf.yasdb.com/download/attachments/100075419/image2022-6-8_17-42-35.png?version=1&modificationDate=1671760118000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg3MTQsImV4cCI6MTc4MjIxOTUxNH0.gaN11k6c90zVVYgrEmeVJzybZWwqwHB_jtikhb-c0iQ),2、alter profile,![](https://conf.yasdb.com/download/attachments/100075419/image2022-12-13_11-19-23.png?version=1&modificationDate=1671760118000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg3MTQsImV4cCI6MTc4MjIxOTUxNH0.gaN11k6c90zVVYgrEmeVJzybZWwqwHB_jtikhb-c0iQ),3、 drop profile,![](https://conf.yasdb.com/download/attachments/100075419/image2022-12-13_11-20-25.png?version=1&modificationDate=1671760118000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg3MTQsImV4cCI6MTc4MjIxOTUxNH0.gaN11k6c90zVVYgrEmeVJzybZWwqwHB_jtikhb-c0iQ)|1.LOGT_CREATE_PROFILE、  LOGT_DROP_PROFILE需要记录profile的ctime,2.profile系统表增加ctime列|1. create profile，如果对应的slot已经存在，结束处理，否则，查找系统表是否存在相同ctime，相同id的记录，如果存在，加载至内存，否则，结束处理。
1. alter profile，load系统表
1. drop profile，如果对应的slot没有被使用，直接返回，否则，检查ctime是否一致，如果一致，删除，否则，结束处理。
|
||创建、删除ROLE|1、create  role,![](https://conf.yasdb.com/download/attachments/68301585/CREATE_ROLE.GIF?version=1&modificationDate=1636943127000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg3MTQsImV4cCI6MTc4MjIxOTUxNH0.gaN11k6c90zVVYgrEmeVJzybZWwqwHB_jtikhb-c0iQ),2、drop role,![](https://conf.yasdb.com/download/thumbnails/68301585/DROP_ROLE.GIF?version=1&modificationDate=1636943143000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg3MTQsImV4cCI6MTc4MjIxOTUxNH0.gaN11k6c90zVVYgrEmeVJzybZWwqwHB_jtikhb-c0iQ)|1.LOGT_CREATE_ROLE、LOGT_DROP_ROLE需要记录role的ctime|1.create role，如果对应的slot已经存在，结束处理，否则，查找系统表是否存在相应记录，如果存在，加载至内存，否则，结束处理。,2. drop role，如果对应的slot没有被使用，结束处理，否则，检查ctime是否一致，如果一致，删除，否则，结束处理。|
||授权、撤权|1、给user或者role受对象级权限,![](https://conf.yasdb.com/download/attachments/68301585/grant%20object%20privilege.GIF?version=2&modificationDate=1638513460000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg3MTQsImV4cCI6MTc4MjIxOTUxNH0.gaN11k6c90zVVYgrEmeVJzybZWwqwHB_jtikhb-c0iQ),2、给user或者role授予系统级别权限,![](https://conf.yasdb.com/download/attachments/68301585/grant%20syspriv%20and%20role%20to%20grantee.GIF?version=1&modificationDate=1638513210000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg3MTQsImV4cCI6MTc4MjIxOTUxNH0.gaN11k6c90zVVYgrEmeVJzybZWwqwHB_jtikhb-c0iQ),3、撤销权限,![](https://conf.yasdb.com/download/attachments/68301585/REVOKE%20PRIV.GIF?version=1&modificationDate=1636943103000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg3MTQsImV4cCI6MTc4MjIxOTUxNH0.gaN11k6c90zVVYgrEmeVJzybZWwqwHB_jtikhb-c0iQ)|1.相关逻辑日志需要记录user或者role的ctime|以grant_sys_priv为例作说明，其他类似,1.grant_sys_priv，判断对应ctime的role或者user是否存在，通过系统表确认权限记录是否存在，如果都通过校验，才能回放处理,  
,  
|
||创建、删除、修改SO|LOGT_CREATE_SO、LOGT_DROP_SO、LOGT_ALTER_SO|  
|1.创建对象，检查entry是否存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
||创建、删除、修改表、视图、同义词|表|  
|1.创建对象，检查entry是否已经存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
||创建、删除、修改trigger|LOGT_CREATE_TRIGGER、LOGT_DROP_TRIGGER、LOGT_ALTER_TRIGGER|  
|1.创建对象，检查entry是否已经存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
||创建、删除、修改TYPE|LOGT_CREATE_TYPE、LOGT_ALTER_TYPE、LOGT_DROP_TYPE|  
|1.创建对象，检查entry是否已经存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
||审计策略生效，失效、修改|LOGT_AUDIT_POLICY、LOGT_NOAUDIT_POLICY、LOGT_ALTER_AUDIT_POLICY、LOGT_ALTER_AUDIT_INVALID_TABLE、LOGT_AUDIT_USER、LOGT_NOAUDIT_USER、LOGT_NOAUDIT_FINAL、LOGT_AUDIT_CHANGE_ROLE_PRIV、LOGT_AUDIT_DROP_ROLE|  
|  
|
||创建、删除、修改用户|LOGT_CREATE_USER、LOGT_DROP_USER、LOGT_ALTER_USER|1.LOGT_CREATE_USER、LOGT_DROP_USER需要记录用户的创建时间|1.create user，如果对应的slot已经存在，结束处理，否则，查找系统表是否存在相应记录，如果存在，加载至内存，否则，结束处理。,2. drop user，如果对应的slot没有被使用，结束处理，否则，检查ctime是否一致，如果一致，删除，否则，结束处理。,3. alter user，reload系统表|
||创建、删除、修改sequence|LOGT_CREATE_SEQ、LOGT_DROP_SEQ|1.alter sequence需要补充日志LOGT_ALTER_SEQ|1.创建对象，检查entry是否已经存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
|dml触发的元数据变更场景|interval分区扩展|LOGT_ALTER_TABLE|增加LOGT_INTERVAL_EXTEND|1.查找表是否存在,2.检查分区是否已经扩展,3.符合条件执行扩展逻辑|
||统计信息|LOGT_ALTER_TABLE|增加LOGT_STATS_CHANGE,  
|统计信息逻辑日志忽略处理|
||创建segment|  
|增加LOGT_CREATE_SEGMENT|  
|


## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

*使用场景法来梳理现有的不同的故障场景，组合测试不同对象在不同故障下的表现。*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|  
|  
|  
|
|---|---|---|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：



  
