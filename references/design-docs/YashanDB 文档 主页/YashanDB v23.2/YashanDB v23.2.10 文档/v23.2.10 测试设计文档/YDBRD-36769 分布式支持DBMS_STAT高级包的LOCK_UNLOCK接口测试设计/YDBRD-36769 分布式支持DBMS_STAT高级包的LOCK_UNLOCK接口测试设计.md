# 1.概述

SR链接：  [https://pingcode.yasdb.com/pjm/items/67652e0a622069d46dfa8c16?](https://pingcode.yasdb.com/pjm/items/67652e0a622069d46dfa8c16?)  #YDBRD-36769 分布式支持DBMS_STAT高级包的LOCK/UNLOCK接口

本次需求涉及到子过程为：

LOCK_PARTITION_STATS

LOCK_TABLE_STATS

LOCK_SCHEMA_STATS

UNLOCK_PARTITION_STATS

UNLOCK_TABLE_STATS

UNLOCK_SCHEMA_STATS

# 2.需求分析

## 2.1功能点分析

1）DBMS_STAT.LOCK_PARTITION_STATS：用于锁定表中某个表分区的统计信息，锁定后该分区的统计信息不再被修改，不适用于组合分区表。

语法结构如下：

DBMS_STATS.LOCK_PARTITION_STATS (

    ownname             VARCHAR,

    tabname             VARCHAR,

    partname            VARCHAR

);

参数说明如下：

|参数|描述|
|:---|:---|
|ownname|用户名|
|tabname|表名|
|partname|分区名|


示例：exec DBMS_STATS.LOCK_PARTITION_STATS('SALES', 'SALES_INFO_RANGE', 'P_SALES_INFO_RANGE_1');

2）DBMS_STAT.LOCK_TABLE_STATS：用于锁定某张表的统计信息，锁定后该表的统计信息不再被修改。

语法结构如下：

DBMS_STATS.LOCK_TABLE_STATS (

    ownname             VARCHAR,

    tabname             VARCHAR

);

参数说明如下：

|参数|描述|
|:---|:---|
|ownname|用户名|
|tabname|表名|


示例：exec DBMS_STATS.LOCK_TABLE_STATS('SALES', 'SALES_INFO');

3）DBMS_STATS.LOCK_SCHEMA_STATS：用于锁定某个schema下所有表的统计信息，锁定后该schema下所有表的统计信息不再被修改，但该schema下在此之后新建的表并不锁定。

语法结构如下：

DBMS_STATS.LOCK_SCHEMA_STATS (

    ownname             VARCHAR

);

参数说明如下：

|参数|描述|
|:---|:---|
|ownname|用户名|


示例：exec DBMS_STATS.LOCK_SCHEMA_STATS('SALES');

4）DBMS_STATS.UNLOCK_PARTITION_STATS：用于解锁表中某个表分区的统计信息。

语法结构如下：

DBMS_STATS.UNLOCK_PARTITION_STATS (

    ownname             VARCHAR,

    tabname             VARCHAR,

    partname            VARCHAR

);

参数说明如下：

|参数|描述|
|:---|:---|
|ownname|用户名|
|tabname|表名|
|partname|分区名|


示例：exec DBMS_STATS.UNLOCK_PARTITION_STATS('SALES', 'SALES_INFO', 'P_SALES_INFO_1');

5）DBMS_STATS.UNLOCK_TABLE_STATS：用于解锁某张表的统计信息。

语法结构如下：

DBMS_STATS.UNLOCK_TABLE_STATS (

    ownname             VARCHAR,

    tabname             VARCHAR

);

参数说明如下：

|参数|描述|
|:---|:---|
|ownname|用户名|
|tabname|表名|


示例：exec DBMS_STATS.UNLOCK_TABLE_STATS('SALES', 'SALES_INFO');

6）DBMS_STATS.UNLOCK_SCHEMA_STATS：用于解锁某个schema下所有表的统计信息。

语法结构如下：

DBMS_STATS.UNLOCK_SCHEMA_STATS (

    ownname             VARCHAR

);

参数说明如下：

|参数|描述|
|:---|:---|
|ownname|用户名|


示例：exec DBMS_STATS.UNLOCK_SCHEMA_STATS('SALES');

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持分布式，单机和集群已支持

分布式只允许从CN节点调用，DN、MN节点拦截

# 3.详细测试设计

## 3.1测试设计方法

测试设计主要采用等价类和场景法进行设计，等价类设计主要对DBMS_STATS包本身的通用基础功能点进行验证。

## 3.2详细测试设计

### 3.2.1等价类设计

|测试场景分类|测试点梳理|测试执行|检查点|
|---|---|---|---|
|DBMS_STATS高级包LOCK/UNLOCK子过程通用基础功能点验证|包含参数校验、关键字校验、高级包调用方式和基本的场景测试,测试点可参考内置高级包功能checklist：  [https://pingcode.yasdb.com/wiki/spaces/ZHANGJIANG/pages/6739bd88593f99c9ff2508b](https://pingcode.yasdb.com/wiki/spaces/ZHANGJIANG/pages/6739bd88593f99c9ff2508bb)  |自动化测试工具：,内置高级包自动生成语句和执行脚本：  [https://pingcode.yasdb.com/wiki/spaces/ZHANGJIANG/pages/6739bd88593f99c9ff2508ae](https://pingcode.yasdb.com/wiki/spaces/ZHANGJIANG/pages/6739bd88593f99c9ff2508ae)  |- 检查数据库状态是否正常，有无core产生；
- 检查数据库是否有异常错误产生
|
||复用单机等价类测试点，执行单机测试用例||同单机预期对比，是否存在差异|


### 3.2.2功能测试设计

|子过程名|覆盖点|场景描述|预期|
|---|---|---|---|
|,,,,,,,,,DBMS_STAT.LOCK_TABLE_STATS|- 表类型覆盖tac、lsc
- 覆盖普通表和分区表
- 索引覆盖普通索引和分区索引
|锁定表统计信息后，收集该表的统计信息(DBMS_STATS.GATHER_TABLE_STATS)-不指定分区名|执行失败|
|||锁定表统计信息后，收集该表的统计信息(DBMS_STATS.GATHER_TABLE_STATS)-指定分区名|执行失败|
|||锁定表统计信息后，收集该表对应索引或者分区索引的统计信息(DBMS_STATS.GATHER_INDEX_STATS)|执行失败|
|||锁定表统计信息后，收集该表所属用户下所有对象的统计信息(DBMS_STATS.GATHER_SCHEMA_STATS)|执行成功|
|||锁定表统计信息后，收集数据库的统计信息(DBMS_STATS.GATHER_DATABASE_STATS)|执行成功|
|||锁定表统计信息后，设置该表的统计信息(DBMS_STATS.SET_TABLE_STATS)-不指定分区名|执行失败|
|||锁定表统计信息后，设置该表的统计信息(DBMS_STATS.SET_TABLE_STATS)-指定分区名|执行失败|
|||锁定表统计信息后，设置该表对应索引或者分区索引的统计信息(DBMS_STATS.SET_INDEX_STATS)|执行失败|
|||锁定表统计信息后，设置该表对应列的统计信息(DBMS_STATS.SET_COLUMN_STATS)|执行失败|
|||锁定表统计信息后，删除该表的统计信息(DBMS_STATS.DELETE_TABLE_STATS)-不指定分区名|执行失败|
|||锁定表统计信息后，删除该表的统计信息(DBMS_STATS.DELETE_TABLE_STATS)-指定分区名|执行失败|
|||锁定表统计信息后，删除该表对应列的统计信息(DBMS_STATS.DELETE_COLUMN_STATS)-不指定分区名|执行失败|
|||锁定表统计信息后，删除该表对应列的统计信息(DBMS_STATS.DELETE_COLUMN_STATS)-指定分区名|执行失败|
|||锁定表统计信息后，删除该表对应索引的统计信息(DBMS_STATS.DELETE_INDEX_STATS)|执行失败|
|||锁定表统计信息后，删除该表所属用户下的所有对象的统计信息(DBMS_STATS.DELETE_SCHEMA_STATS)|执行成功|
|||对于其他未被锁定的表，执行收集表/列/索引对应统计信息操作|执行成功|
|DBMS_STATS.UNLOCK_TABLE_STATS||解锁表的统计信息后，重新执行上述失败的操作|执行成功|
|||对于二级组合分区表，解锁后，执行如下操作时应报错拦截,- 收集(GATHER_TABLE_STATS/GATHER_INDEX_STATS)
- 设置(SET_TABLE_STATS/SET_INDEX_STATS/SET_COLUMN_STATS)
- 删除(DELETE_TABLE_STATS/DELETE_INDEX_STATS/DELETE_COLUMN_STATS)
||
|,,,,,,,DBMS_STATS.LOCK_PARTITION_STATS|分区表未创建local分区索引|锁定指定分区的统计信息，对锁定分区执行如下操作：,- 收集表(GATHER_TABLE_STATS)统计信息
- 设置表、表列(SET_TABLE_STATS、SET_COLUMN_STATS)统计信息
- 删除表、表列(DELETE_TABLE_STATS、DELETE_COLUMN_STATS)统计信息
|执行失败|
|||锁定指定分区的统计信息，对未锁定分区执行如下操作：,- 收集表(GATHER_TABLE_STATS)统计信息
- 设置表、表列(SET_TABLE_STATS、SET_COLUMN_STATS)统计信息
- 删除表、表列(DELETE_TABLE_STATS、DELETE_COLUMN_STATS)统计信息
|执行成功|
||分区表创建local分区索引(索引分区指定为表分区)|对锁定分区执行如下操作：,- ~~收集索引(GATHER_INDEX_STATS)统计信息(不涉及)~~
- 设置索引(SET_INDEX_STATS)统计信息
- 删除索引(DELETE_INDEX_STATS)统计信息
|执行失败|
|||对未锁定分区执行如下操作：,- ~~收集索引(GATHER_INDEX_STATS)统计信息(不涉及)~~
- 设置索引(SET_INDEX_STATS)统计信息
- 删除索引(DELETE_INDEX_STATS)统计信息
|执行成功|
||对于二级组合分区表，执行锁定分区操作应报错拦截，检查报错信息|||
|DBMS_STATS.UNLOCK_PARTITION_STATS|分区表未创建local分区索引|解锁表的分区统计信息后，重新执行上述失败的操作|执行成功|
||分区表创建local分区索引|解锁表的分区统计信息后，重新执行上述失败的操作|执行成功|
|,,,,,DBMS_STATS.LOCK_SCHEMA_STATS|- 表类型覆盖tac、lsc
- 覆盖普通表和分区表
- 索引覆盖普通索引和分区索引
|前提：已创建用户user1和user2，并分别创建对应的普通表、分区表、普通索引、分区索引,锁定用户user1的统计信息后，分别执行GATHER  /SET/DELETE   user1的表、列和  索引  的统计信息，具体如下：,- GATHER_TABLE_STATS
- GATHER_INDEX_STATS
- SET_TABLE_STATS
- SET_INDEX_STATS
- SET_COLUMN_STATS
- DELETE_TABLE_STATS
- DELETE_INDEX_STATS
- DELETE_COLUMN_STATS
|执行失败|
|||锁定用户user1的统计信息后，分别执行GATHER  /SET/DELETE   user2的表、列和  索引的  统计信息|执行成功|
|DBMS_STATS.UNLOCK_SCHEMA_STATS||解锁用户user1的统计信息后，重新执行GATHER  /SET/DELETE   user1的表、列和索引的统计信息|执行成功|


其他场景测试：

|测试场景|场景描述||预期|
|---|---|---|---|
|,,,锁定与解锁层级范围测试|,,,同时锁定分区，分区表，分区表所属schema的统计信息|解锁分区所在表的统计信息，执行GATHER  /SET/DELETE  分区及其索引统计信息|执行失败|
|||解锁分区所属schema的统计信息，执行GATHER  /SET/DELETE  分区及其索引统计信息|执行失败|
|||解锁分区所属schema的统计信息，执行GATHER  /SET/DELETE  分区表统计信息|执行成功|
|||解锁分区所属schema的统计信息，执行GATHER/SET/DELETE分区所属列和分区索引统计信息|执行失败|
||锁定普通表的统计信息|解锁普通表所属schema统计信息，执行GATHER  /SET/DELETE  普通表统计信息|执行成功|
|多次执行锁定与解锁操作|对分区、表、schema多次执行锁定与解锁操作||执行成功|
|,,,,,,,,高级包LOCK/UNLOCK子过程权限测试|- 用户user1(create session)
- 用户user2(create session+create any table+select any table)
- 用户user3(analyze any)
- dba用户regress
- sys用户
|非sys或者非dba用户锁定/解锁sys的统计信息-调用UNLOCK/LOCK_SCHEMA_STATS接口|执行失败|
|||sys或者dba用户调用LOCK/UNLOCK_SCHEMA_STATS接口|执行成功|
|||sys或者dba用户调用LOCK/UNLOCK_TABLE_STATS|执行成功|
|||sys或者dba用户调用LOCK/UNLOCK_PARTITION_STATS|执行成功|
|||user3用户锁定/解锁除sys用户之外的其他用户下的表、分区表、schema的统计信息|执行成功|
|||user3用户锁定/解锁sys用户下的表、分区表、schema的统计信息|执行失败|
|||user2用户锁定/解锁自己名下的表、分区表、schema的统计信息|执行成功|
|||user2用户锁定/解锁其他用户下的表、分区表、schema的统计信息|执行失败|
|||user1用户锁定/解锁user1的统计信息|执行成功|
|||user1用户锁定/解锁由其他用户创建在user1名下的表、分区表的统计信息|执行失败|
|统计信息相关系统视图测试，主要包含如下：,USER/ALL/DBA_TAB_STATISTICS,USER/ALL/DBA_IND_STATISTICS|锁定分区统计信息后，查看视图数据，校验分区统计信息是否被锁定,解锁分区统计信息后，查看视图数据，校验分区统计信息是否被锁定|||
||锁定表统计信息后，查看视图数据，校验表统计信息是否被锁定,解锁表统计信息后，查看视图数据，校验表统计信息是否被锁定|||
||锁定用户统计信息后，查看视图数据，校验用户下表对象统计信息是否被锁定,解锁用户统计信息后，查看视图数据，校验用户下表对象统计信息是否被锁定|||
|,,,异常测试|手动停掉mn节点，执行锁定和解锁操作(MN节点恢复后，再次执行锁定和解锁操作，收集统计信息后校验)||执行失败(收集待讨论)|
||手动停掉cn1，cn2执行锁定和解锁操作||执行失败(报部分错误，等恢复后，后台同步信息保持一致)|
||session1正常连接cn，手动停掉该cn，session1执行锁定和解锁操作||执行失败|
||分布式部署1个主备DN组时，手动停掉DN主节点，cn执行锁定和解锁操作||执行失败|
||分布式部署1个主备DN组时，手动停掉DN备节点，cn执行锁定和解锁操作||执行成功|
||分布式部署多个主备DN组时，手动停掉其中某个组中的主节点，cn执行锁定和解锁操作||(执行收集统计信息成功合理，锁定和解锁操作失败)|
||分布式部署多个主备DN组时，手动停掉全部主节点，cn执行锁定和解锁操作||执行失败|
||执行过程中，构造节点异常|||
|扩容操作|执行锁定和解锁操作后，扩容节点，校验表统计信息|||
||执行过程中扩容，操作失败(优先级低),扩容过程中，执行锁定和解锁操作失败|||


### 3.2.3特性是否涉及DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是，测试点列举如下：,- 会话1并发锁定表，会话2并发解锁表，会话3并发收集锁定的表、索引统计信息
- 会话1并发锁定表，会话2并发解锁表，会话3并发收集其他未锁定的表、索引统计信息
- 会话1并发锁定表分区，会话2并发解锁表分区，会话3并发收集锁定表的分区、分区索引统计信息
- 会话1并发锁定表分区，会话2并发解锁表分区，会话3并发收集未锁定的表分区、分区索引统计信息
- 会话1并发锁定schema，会话2并发解锁schema，会话3并发收集锁定schema下的表、分区、索引统计信息
- 会话1并发锁定schema，会话2并发解锁schema，会话3并发收集未锁定schema下的表、分区、索引统计信息
- 会话1并发锁定表、分区、schema统计信息，会话2基于锁定的表并发执行增删改查操作，会话3并发解锁表、分区、schema统计信息，会话4收集锁定的表、分区、schema的统计信息
- 添加analyze并发操作业务
|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具  
(sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


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