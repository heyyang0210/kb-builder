Created by 高亚宁, last modified on 十月 21, 2024

# 1.   **概述**

本文描述DBMS_LOGSTDBY功能完善的测试设计

# 2.   **需求分析**

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b74c7009f91eb87f2cfcc](https://pingcode.yasdb.com/ship/ideas/660b74c7009f91eb87f2cfcc)    ?    
  #YASHAN-2503 逻辑备机增强

SR链接：  [https://pingcode.yasdb.com/pjm/items/67062d87e489dd0868f2c37b?](https://pingcode.yasdb.com/pjm/items/67062d87e489dd0868f2c37b?)  

#YDBRD-33579 DBMS_LOGSTDBY功能完善

开发文档：  [(3068) DBMS_LOGSTDBY功能完善 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67b458e2700aa2801263b39b)  

需求来源：

产品化需求

场 景：

高级包功能完善：易用性增强

支持故障场景下的回放暂停和恢复

需求描述：

逻辑备机提供配置配置参数的能力（event的上限，回放的并行度）

提供暂停逻辑回放的能力

需求范围：

1、单机

|属性|场景名称|方案设计|接口表现|是否需要测试|测试方案|
|:---|:---|:---|---|:---|:---|
|功能|暂停逻辑回放|提供sql可以暂停逻辑回放，调整资源配置后再启动逻辑回放。|ALTER DATABASE STOP LOGICAL STANDBY APPLY;——新增，停止逻辑回放,alter database start logical standby apply immediate;|是|1. sql语法测试
1. 正常和异常场景下启停逻辑回放的功能是否生效
1. 逻辑备机的stream pool size不足时，回放卡住——暂停逻辑回放，扩容share_pool_size，启动逻辑回放
|
|功能|提供高级包函数控制参数配置。|1. 新增一个高级包函数apply_set
1. 新增两个参数配置：MAX_EVENTS_RECORDED、APPLY_SERVERS
|DBMS_LOGSTDBY.APPLY_SET设置逻辑回放的参数,APPLY_SERVERS：控制用于回放的线程数量，默认16，最小1，最大1024,MAX_EVENTS_RECORDED：通过视图  `DBA_LOGSTDBY_EVENTS`  可见的最近事件数。记录 SQL 回放遇到的所有事件，默认值为 10,000。最小值为1，最大值为1000000。|是|高级包语法和功能生效测试|
|可用性|提供在线设置MAX_EVENTS_RECORDED|逻辑备机回放过程中调整MAX_EVENTS_RECORDED的值，避免需要暂停回放||是|参数边界值、范围测试，功能是否生效测试|
|周边配合|权限|高级包的函数权限同alter database保持一致。||是|高级包的权限测试|
||视图|V$LOGSTDBY_PROGRESS 显示当前逻辑回放的进度,DBA_LOGSTDBY_EVENTS 显示Sql回放时上报的事件,dba_logstdby_parameters 显示LOGIC_STANDBY服务的参数信息|新增dba_logstdby_parameters |dba_logstdby_parameters 需要测试|配合功能测试使用|


###   [规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- APPLY_SERVERS参数配置时，要求逻辑回放未开启。
- 停止逻辑回放操作需要在open下执行。


# 3.   **测试设计方法**

1. 新增ALTER DATABASE STOP LOGICAL STANDBY APPLY;语法采用等价类划分法设计
1. 新增高级包DBMS_LOGSTDBY.APPLY_SET参数设置和功能采用边界值法、场景法设计
1. 暂停逻辑回放功能、异常场景等使用场景法和错误推测法设计
1. DFX覆盖


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳||
|一致性||
|三方测试工具    
  (sqltest，sqlancer)||
|安全||
|DFR||
|HA|涉及，并行回放用例里并行度配置参数要取消，代码中未加该参数,~~LOGIC_REP_PARALLELISM 逻辑并行回放线程数~~,~~LOGIC_REP_BATCH_SIZE log日志值batch xact list count达到设置的值的话可以调这个参数~~,逻辑备机用例中的DBA_YSTREAM_PARAMETERS要替换成dba_logstdby_parameters|
|压力||
|性能|需要修改并行回放性能脚本里并行度的配置，可不配置，默认16|
|可维护性|涉及|
|资料|涉及|


# 4.   **详细测试设计**

### 4.1 新增语法测试

|编号|输入条件|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|
|1|ALTER DATABASE STOP LOGICAL STANDBY APPLY;|正确语法：ALTER DATABASE STOP LOGICAL STANDBY APPLY;|关键字缺失或者写错,ALTER DATABASE STOP  APPLY;,ALTER DATABASE STOP LOGICAL APPLY;,ALTER DATABASE STOP STANDBY APPLY;,ALTER DATABASE STOP LOGICAL STANDBY;,ALTER DATABASE STOP LOGICAL STANDBY APPLY immediate;,ALTER DATABASE STOPPED LOGICAL STANDBY APPLY;||
|2|exec DBMS_LOGSTDBY.APPLY_SET配置参数：APPLY_SERVERS|查看dba_logstdby_parameters中2个参数的默认值,查询APPLY_SERVERS的PARAM_VALUE值为16，PARAM_DEFAULT为16,查询MAX_EVENTS_RECORDED的PARAM_VALUE值为10000，PARAM_DEFAULT为10000,DBA_YSTREAM_PARAMETERS中不显示LOGIC_STANDBY相关的参数信息|配置为0，1.5，1025，查询dba_logstdby_parameters|控制用于回放的线程数量，默认16，最小1，最大1024。|
|3||exec DBMS_LOGSTDBY.APPLY_SET('APPLY_SERVERS','8');，查询dba_logstdby_parameters中APPLY_SERVERS的PARAM_VALUE值为8，PARAM_DEFAULT为16|参数名称错误：,APPLY_SERVER,CHECKPOINT_INTERVAL，PARALLELISM，TXN_AGE_SPILL_THRESHOLD，TXN_LCR_SPILL_THRESHOLD,为空，null，空串||
|4||配置为1，1024，查询dba_logstdby_parameters|参数值错误：,为空，null，空串||
|5|||格式错误：,参数名称或者参数值不带单引号，使用双引号，查看错误码中是否体现参数名称||
|6|exec DBMS_LOGSTDBY.APPLY_SET配置参数：MAX_EVENTS_RECORDED|exec DBMS_LOGSTDBY.APPLY_SET('MAX_EVENTS_RECORDED','1000');，查询dba_logstdby_parameters中MAX_EVENTS_RECORDED的PARAM_VALUE值为1000，PARAM_DEFAULT为10000|配置为0，1024.5，1000001，查询dba_logstdby_parameters|通过视图  `DBA_LOGSTDBY_EVENTS`  可见的最近事件数。记录 SQL 回放遇到的所有事件，默认值为 10,000。最小值为1，最大值为1000000。|
|7||配置为1，1000000，查询dba_logstdby_parameters|参数名称错误：,MAX_EVENT_RECORDED,MAX_EVENTS_RECORD,为空，null，空串||
|8|||参数值错误：,为空，null，空串||
|9|||格式错误：,参数名称或者参数值不带单引号，使用双引号||
|10|||DBMS_LOGSTDBY.APPLY_SET写错或者缺失：,DBMS_LOGSTDBYS.APPLY_SET,DBMS_LOGSTDBY.APPLY||


### 4.2 功能测试

测试观测点：

- 暂停逻辑回放后，查询V$LOGSTDBY_PROGRESS，看回放是否暂停——回放需要保证这批解析的日志回放完（capture point之前的日志），可能会比较慢，暂停后校验事务一致性
- DBMS_LOGSTDBY.APPLY_SET配置的参数值，在dba_logstdby_parameters中是否显示正确，校验参数功能是否生效
- 异常场景报错合理，错误提示明确


|序号  
|测试场景|用例详细描述|预期|备注|
|---|---|---|---|---|
|1|暂停逻辑回放|主机执行业务，逻辑备机回放过程中，执行ALTER DATABASE STOP LOGICAL STANDBY APPLY;暂停回放，查看V$LOGSTDBY_PROGRESS中回放是否暂停，查询主机的业务，执行alter database start logical standby apply immediate;开启回放，查询主机的业务|暂停回放成功，主机的业务同步不到逻辑备机，查询  `v$logstdby_progress`  显示0 rows，v$process中没有LGS_APPLIER线程,启动回放成功后，逻辑备机能查询到主机的业务，查询  `v$logstdby_progress`  显示1 row，v$process中有16个LGS_APPLIER线程|  
|
|2||主机和物理备机也可以执行停止逻辑回放的sql|不会报错，没有实际意义||
|3||主机执行业务，逻辑备机上反复启停逻辑回放，校验事务一致性|逻辑备机正常回放，事务一致||
|4||主机执行大量业务，构造逻辑备机的stream pool size不足，回放卡住的场景（数据库abnormal，v$diag_incident视图显示share_pool_size不足），暂停逻辑回放，扩容share_pool_size，启动逻辑回放|卡住后，暂停逻辑回放成功，扩容后，启动逻辑回放成功，逻辑备机能继续回放||
|5||启停逻辑回放和kill并发|逻辑备机kill重启正常||
|||switchover和停止逻辑回放并发|后执行的报错||
|6||在逻辑备机上重复执行ALTER DATABASE STOP LOGICAL STANDBY APPLY;|成功||
|7||逻辑备机nomount/mount状态执行ALTER DATABASE STOP LOGICAL STANDBY APPLY;|报错|加到现有用例|
|8||在集群和分布式环境的主机和物理备机上执行|不会报错，无实际意义||
|9|DBMS_LOGSTDBY.APPLY_SET配置2个参数|逻辑备机暂停逻辑回放，执行exec DBMS_LOGSTDBY.APPLY_SET('APPLY_SERVERS','32');配置APPLY_SERVERS为32，在逻辑备机上查询v$process中LGS_APPLIER线程数，主机做业务，逻辑备机启动逻辑回放，在逻辑备机上查询v$process中LGS_APPLIER线程数|逻辑备机上LGS_APPLIER线程数从16变成32，逻辑备机能正常回放主机的业务|  
|
|10||逻辑备机执行exec DBMS_LOGSTDBY.APPLY_SET('MAX_EVENTS_RECORDED','10');，主机做业务，超过10条，在逻辑备机上查询DBA_LOGSTDBY_EVENTS|逻辑备机正常回放，DBA_LOGSTDBY_EVENTS中只显示最近的10条事件|对于不记录附加日志的ddl/数据类型（udt，  XML，JSON  ），DBA_LOGSTDBY_EVENTS中能查询解析报错的日志|
|11||在主机上配置APPLY_SERVERS为8，MAX_EVENTS_RECORDED为10，查询dba_logstdby_parameters视图中是否生效，逻辑备机做switchover，在旧主机上查询dba_logstdby_parameters中的参数值是否与配置的一致，校验LGS_APPLIER和EVENTS数量|主机配置2个参数成功，逻辑备机switchover成功，旧主机上LGS_APPLIER和EVENTS数量与配置的一致||
|12||配置APPLY_SERVERS为1024，MAX_EVENTS_RECORDED为1000000，主机执行大量业务，逻辑备机停启逻辑回放，shutdown重启数据库等，查询DBA_LOGSTDBY_EVENTS和  `v$logstdby_progress`  |DBA_LOGSTDBY_EVENTS查询正常，逻辑备机回放正常|可改小操作系统句柄数和max_workers|
|13||在物理备机上执行exec DBMS_LOGSTDBY.APPLY_SET('MAX_EVENTS_RECORDED','1000');|报错YAS-06010 the database is not in readwrite mode||
|14||逻辑回放未关闭时，执行exec DBMS_LOGSTDBY.APPLY_SET('APPLY_SERVERS','32')|报错||
|15||数据库nomount/mount执行exec DBMS_LOGSTDBY.APPLY_SET配置2个参数|报错||
|16||集群和分布式下，调用高级包配置2个参数|成功||
|17|权限|权限：sys/dba用户/  sysdba/sysbackup/普通用户 分别启停逻辑回放|sys/dba用户执行成功,sysdba/sysbackup/普通用户执行报错||
|18||权限：sys/dba用户/  sysdba/sysbackup/普通用户 分别调用高级包配置2个参数|sys/dba用户执行成功,sysdba/sysbackup/普通用户执行报错||
|19||权限：sys/dba用户/  sysdba/sysbackup/普通用户 分别查询  dba_logstdby_parameters视图|sys/dba用户执行成功,sysdba/sysbackup/普通用户执行报错||
|20|dba_logstdby_parameters视图|desc dba_logstdby_parameters查看字段名称和类型是否与设计一致|与设计一致||
|21||主机执行大量业务，在逻辑备机上配置2个参数，1000个并发查询dba_logstdby_parameters、DBA_LOGSTDBY_EVENTS视图|逻辑备机正常运行，不会core|可加到前面的并发用例中|
|22|性能|测试逻辑备机回放延迟和速率|参数功能生效，性能不下降||


# 5.  ** **  **测试用例设计**

文本用例

# 6.   **测试框架设计**

使用regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机部署一主一物理备一逻辑备  
|


8.   **测试工作量评估**    
共计8人天：

1. 研发串讲，测试调研，测试设计+评审——1天
1. 测试执行+用例自动化+用例调试连跑——5天
1. 问题单回归，上车CI分析，资料测试——2天


暂定2025/3/3上车

