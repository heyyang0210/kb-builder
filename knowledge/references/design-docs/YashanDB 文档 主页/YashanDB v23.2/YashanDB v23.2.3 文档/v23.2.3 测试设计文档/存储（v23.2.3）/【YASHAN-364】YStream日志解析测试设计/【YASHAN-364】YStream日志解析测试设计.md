Created by 高亚宁, last modified by  刘丹 on 六月 26, 2024

# 1. 概述

-   [1. 概述](#id-【YASHAN364】YStream日志解析测试设计-1.概述)  
-   [2. 需求分析](#id-【YASHAN364】YStream日志解析测试设计-2.需求分析)  
    -   [2.1 功能点分析](#id-【YASHAN364】YStream日志解析测试设计-2.1功能点分析)  
    -   [2.2 应用场景](#id-【YASHAN364】YStream日志解析测试设计-2.2应用场景)  
    -   [2.3 规格约束](#id-【YASHAN364】YStream日志解析测试设计-2.3规格约束)  
-   [3. 详细测试设计](#id-【YASHAN364】YStream日志解析测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#id-【YASHAN364】YStream日志解析测试设计-3.1测试设计方法)  
    -   [3.2 系统级DFX分类](#id-【YASHAN364】YStream日志解析测试设计-3.2系统级DFX分类)  
    -   [3.3 详细测试设计](#id-【YASHAN364】YStream日志解析测试设计-3.3详细测试设计)  
        -   [3.3.1  基本功能](#id-【YASHAN364】YStream日志解析测试设计-3.3.1基本功能)  
        -   [3.3.2 高级包，视图，权限测试](#id-【YASHAN364】YStream日志解析测试设计-3.3.2高级包，视图，权限测试)  
            -   [高级包：测试高级包调用，输入有效参数，功能要生效，可用过动态视图校验；输入无效参数，报错合理、简单明确](#id-【YASHAN364】YStream日志解析测试设计-高级包：测试高级包调用，输入有效参数，功能要生效，可用过动态视图校验；输入无效参数，报错合理、简单明确)  
            -   [视图](#id-【YASHAN364】YStream日志解析测试设计-视图)  
            -   [权限](#id-【YASHAN364】YStream日志解析测试设计-权限)  
            -   [配置参数](#id-【YASHAN364】YStream日志解析测试设计-配置参数)  
        -   [3.3.3 异常场景](#id-【YASHAN364】YStream日志解析测试设计-3.3.3异常场景)  
        -   [3.3.4 并发场景（包括并发和kill两种场景）](#id-【YASHAN364】YStream日志解析测试设计-3.3.4并发场景（包括并发和kill两种场景）)  
        -   [3.3.5 导入场景](#id-【YASHAN364】YStream日志解析测试设计-3.3.5导入场景)  
        -   [3.3.5 从接口的角度出发，针对每个接口的测试——责任人：梁嘉成](#id-【YASHAN364】YStream日志解析测试设计-3.3.5从接口的角度出发，针对每个接口的测试——责任人：梁嘉成)  
-   [4. 测试用例](#id-【YASHAN364】YStream日志解析测试设计-4.测试用例)  
-   [5. 测试框架设计](#id-【YASHAN364】YStream日志解析测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#id-【YASHAN364】YStream日志解析测试设计-6.测试环境说明)  
-   [7. 工作量评估](#id-【YASHAN364】YStream日志解析测试设计-7.工作量评估)  


本文描述YStream服务端日志解析测试设计

需求现状：

1. YashanDB缺少一个通用的CDC API接口，供第三方抓取YashanDB的逻辑日志。
1. 崖山目前异构数据库同步工具YDS有如下缺点：    

1.     - 现有C接口仅支持原始日志解析为二进制数据，  **没有事务组装，类型转换的能力**  ，第三方适配难度大，  **易用性差**
    - YDS通过  **JNA调用C接口**  ，性能损耗大
    - 基于Flink开源架构，bug定位难度大，修复不及时

1. **滚动升级**  需要逻辑复制作为基础特性


实现后：  YashanDB提供java形式的API，可直接解析出按事务顺序组装好的SQL

# 2. 需求分析

## 2.1 功能点分析

  [https://pingcode.yasdb.com/pjm/items/6614eb1cfd997db58ad62d14](https://pingcode.yasdb.com/pjm/items/6614eb1cfd997db58ad62d14)    ?    
  #YDBRD-26611 YStream服务端日志解析（单机）

概要设计方案：    [CDC日志解析API概要设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147766120)  

开发设计方案：    [YStream服务端日志解析 特性设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150604742)  

测试调研文档：    [CDC日志解析API特性 测试调研 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147781391)  

测试概要设计：    [【YASHAN-364】Ystream日志解析 概要测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150633242)  

需求来源：    
  深燃NEWCIS系统

场 景：    
  1、YashanDB服务端解析Redo为逻辑日志，发送给客户端

需求描述：    
  1、主备都支持启动日志解析服务    
  2、日志解析服务将离散的逻辑日志进行事务分组和排序，按事务提交顺序发送给客户端API    
  3、日志解析服务对元数据维护，并将元数据发送给客户端    
  4、支持断点续传    
  5、支持大事务持久化

需求范围：    
  1、单机

需求规格：    
  1、tpcc业务下，解析速度 > 80M/s的DML数据量    
  2、tpcc业务，延迟1s内    
  3、以上是在高性能环境的指标

![](https://conf.yasdb.com/download/attachments/144143577/image2024-3-5_9-33-35.png?version=1&modificationDate=1709602416000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUVBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4OTMsImV4cCI6MTc4MjMxNjY5M30.1Sp5SAwjAItga4f3MgoxOULKnaCd8iYZ8iLiRUJa8S8)

![](https://conf.yasdb.com/download/attachments/144143577/image2024-3-4_22-20-7.png?version=1&modificationDate=1709562008000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUVBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4OTMsImV4cCI6MTc4MjMxNjY5M30.1Sp5SAwjAItga4f3MgoxOULKnaCd8iYZ8iLiRUJa8S8)

## 2.2 应用场景

1. 异构数据库复制：将源数据库中的数据变更实时同步到异构目标数据库中。
1. 数据集成：  将不同数据库之间的数据变更进行集成和同步。


## 2.3 规格约束

**规格：**

1. 最多可以启动32个YStream server
1. YStream server名字最大长度32
1. 最大支持配置10000张表，100个schema，也可以配置为所有表
1. 仅支持单机主备


**约束：**

1. where条件列不包含LOB列或者LOB格式存储的类型（如8K以上的varchar）
1. DBMS_LOGIC_STREAM的函数（除START，STOP）只能在主库上执行
1. 一个LogMiner只能同时和一个客户端连接
1. 一个主备组里，不能在多个实例上启动同一个Logminer
1. 不支持UDT类型的表
1. 不支持XML，JSON等复杂类型的列
1. 只支持部分DLL（资料中体现白名单）
1. 所有事务要在提交后发送，不支持大事务提前发送
1. YStream Server需要的归档不会自动清理，可以用Force手动清理


# 3. 详细测试设计

## 3.1 测试设计方法

|sc属性|场景名称|方案设计|测试点识别|测试方法|
|:---|:---|:---|:---|---|
|功能（重点和难点）|日志挖掘|多线程并行解析Redo，输出原始LCR|DDL/DML语句是否能正确解析，考虑lob类型,并发执行时，事务顺序正确，考虑事务的各种操作|场景法|
|  
|元数据管理|解析过程中维护表的元数据：,- 初始化：  **闪回查询系统表**  ，得到起始scn对应的表的元数据。
- 增量更新
- 元数据缓存
- 持久化
,  
|各种DDL操作,并发|场景法|
|  
|数据持久化|溢出事务，checkpoint和元数据的持久化|事务操作相关,大数据量事务,长时间未提交事务|场景法|
|  
|断点续传|重启，主备切换后从断点恢复续传|重启恢复、主备切换|场景法|
|  
|客户端API|接收服务端发送的LCR，提供类型转换接口|接口测试：接口传参的有效性、无效值要报错|等价类划分法|
|可维可测|动态视图|V$LOGMINER_SERVER：显示所有Logminer Server的状态，包括运行状态，启动时间，当前进度，checkpoint|视图正确性|场景法|
|  
|  
|V$LOGMINER_STAT：显示所有Logminer Sever的统计信息，包括send大小，解析大小，溢出事务大小等|  
|  
|
|  
|系统视图|ALL_LOGMINER_EVENTS：显示Logminer Server的事件，包括启动，关闭，修改过滤条件等|视图正确性,访问权限|场景法|
|  
|  
|ALL_LOGMINER_PARAMETERS：逻辑日志接卸相关参数|  
|  
|
|  
|  
|ALL_LOGMINER_TABLES：显示所有需要解析的表名，由用户设置|  
|  
|
|  
|配置参数|内存管理：,STREAM_POOL_SIZE,事务的溢出条件：,txn_age_spill_threshold,txn_lcr_spill_threshold|参数的有效值、无效值、边界规格等|等价类划分法|
|安全|网络连接认证|利用JDBC的能力做连接认证|jdbc已覆盖，无需测试|场景法|
|  
|加密传输|利用JDBC的能力做SSL加密|jdbc已覆盖，无需测试|  
|
|  
|权限|增加一个逻辑日志解析的权限YSTREAM_CAPTURE，只有赋予该权限的用户，才可以通过API连接和执行高级包|角色权限测试|  
|
|  
|加密表空间的溢出事务|加密表空间的事务溢出时，需要加密后再插入系统表|加密表空间，加密备份集|  
|
|兼容性|协议兼容|系统表兼容性：增加了若干系统表，需要加升级脚本|升级测试|场景法|
|  
|协议兼容性|高版本YashanDB兼容低版本API，在连接时确认两者版本号，后续  **消息协议以低版本为主**|第一个版本，不需要测试|  
|
|  
|大小端|YashanDB和API客户端支持在大小端不同的机器上|在大小端不同的机器上测试|  
|
|性能|解析速度|tpcc业务下，解析速度 > 80M/s的DML数据量|性能测试|场景法|
|  
|同步延迟|tpcc业务，延迟1s内|  
|  
|


## 3.2 系统级DFX分类

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|是|
|一致性|是|
|三方测试工具    
  (sqltest，sqlancer)|否，YDS设计中，暂不涉及|
|安全|是|
|DFR（故障）|是|
|HA|是|
|压力|否，  转测功能不涉及该模块修改|
|性能|是|
|可维护性|否，  转测功能不涉及该模块修改|
|兼容性|是，需要考虑升级场景|
|资料|是|


## 3.3 详细测试设计

### 3.3.1  基本功能

该java API是用来连接yashanDB数据库，从服务端解析redo日志，得到按事务顺序组装好的SQL语句。所以要从解析流程出发，覆盖需要解析的各种类型的操作。主要采用的是错误推测法和场景法（  **测试过程中要注意事务顺序**  ）

|  
|测试场景|用例详细描述|预期|备注|
|:---|:---|:---|:---|:---|
|1|日志解析基本功能|~~开启min模式的库级附加日志，设置对三种表类型生效，执行DDL和DML~~|~~java api能正常解析所有对象的日志~~,~~对于UPDATE和DELETE，只记录rowid（LSC表记录的rowid可能会变）~~,~~DDL全记录~~,ystream不带rowid，可不测|DDL：create、alter（不涉及dc变更的操作不记录）、truncate、drop、回收站,DML：行链接，行迁移，  merge into操作，多表dml，shrink table，分区表/二级分区表，闪回,表类型：heap，tac，lsc，普通表，分区表（一级/二级）,数据类型：lob类型,数据库对象：,![](https://pingcode.yasdb.com/atlas/files/public/67396d1da1ad9a3311dc8ec8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUVBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4OTMsImV4cCI6MTc4MjMxNjY5M30.1Sp5SAwjAItga4f3MgoxOULKnaCd8iYZ8iLiRUJa8S8)|
|2|  
|开启  PRIMARY模式  的库级附加日志，设置对三种表类型生效（带/不带约束、索引），执行DDL和DML|java api能正常解析所有对象的日志,对于UPDATE和DELETE，当表有主键时，记录主键，否则如果有非空唯一索引，记录唯一索引，否则记录整行,DDL全记录|- 约束类型：    
  * P 主键约束    
  * U 唯一约束    
  * C check约束——记录    
  * R 外键约束——记录    
  * not null——记录
- 索引：普通索引、唯一索引（记录）
|
|3|  
|开启  all模式  的库级附加日志，设置对三种表类型生效（带/不带约束、索引），执行DDL和DML|java api能正常解析所有对象的日志,记录整行|  
|
|4|  
|对某个表开启表级附加日志，设置对该表进行解析，对表做DDL/DML操作|java api能正常解析该表的日志,不会解析其他表的日志|  
|
|5|  
|对某个用户下的所有表开启表级附加日志，设置对某个用户下的所有表进行解析，对该用户下的表做DDL/DML操作|java api能正常解析该用户下的表日志,不会解析其他用户下的表日志|  
|
|6|  
|已启动  32个YStream server，再启动时会报错；删除一个YStream server，再启动成功|  
|  
|
|7|  
|创建udt类型的表|会解析，  udt类型的列数据可能出错|  
|
|8|  
|表中包含XML，JSON等复杂类型的列|会解析，  列数据可能出错|  
|
|9|  
|清理  YStream Server需要的归档文件，带/不带Force|不带Force，清理会报错；  带Force，清理成功|  
|
|10|  
|建表，表名和列名带双引号等特殊字符，解析成功|能正常解析|  
|
|11|  
|建表，default值为null，空串，empty_blob()等，解析成功|能正常解析，和col$中的一致|  
|
|12|溢出事务|设置txn_age_spill_threshold参数，构造超出txn_age_spill_threshold范围不提交的事务，提交后查看java api能否正常解析|正常解析|  
|
|13|  
|设置txn_lcr_spill_threshold参数，构造大数据量事务（大于STREAM_POOL_SIZE值的事务），提交后查看java api能否正常解析|正常解析|YStream溢出事务系统表中可查看|
|14|  
|全部回滚/回滚部分  大数据量事务，  查看java api能否正常解析|正常解析|  
|
|15|  
|回滚长时间不提交事务，  查看java api能否正常解析|正常解析|  
|
|16|  
|考虑DDL/DML：create table as select|  
|  
|
|17|  
|~~溢出事务超过sysaux表空间时，解析会报错停止~~|  
|~~insert数据会报错~~,~~这个场景不存在，system和sysaux不能关闭自动扩展，也不能offline和drop~~|
|18|断点续传|日志解析过程中，kill重启yasdb进程，传入position，position之后的日志能正常解析|  
|recover为true，传入正确的position|
|19|  
|日志解析过程中，备机做failover，切换到新主做业务，传入position，position之后的日志能正常解析新主机的日志|  
|  
|
|20|  
|构造服务端和客户端网络超时，恢复后传入position，position之后的日志能正常解析|  
|  
|
|21|  
|日志解析过程中，kill   YStream server进程，重新创建YStream server后，能正常解析|  
|  
|
|22|  
|设置txn_age_spill_threshold参数，构造溢出事务归档被清理场景|归档清理成功，能正常解析|applay point|
|23|主备|主机开启附加日志，连接备机的ip和端口，解析备机的日志|能正常解析|  
|
|24|  
|主备正常连接时，在备机上调用  DBMS_YSTREAM_ADM的高级包|只有  DBMS_YSTREAM_ADM.  START，DBMS_YSTREAM_ADM.STOP执行成功，其他会报错|  
|
|25|+|主备断连时，在备机上调用  DBMS_YSTREAM_ADM的高级包|执行报错|  
|
|26|  
|在主备上启动同一个  YStream server，后执行的会报错|  
|一个主备组里，不能在多个实例上启动同一个Logminer|
|27|+|主备之间日志有gap，在备机解析，传入gap之前的position，解析会等待？|  
|主备Ystream系统表有差异,最大性能模式下，备机failover后，日志丢失，传入分歧点之前的point，正常解析？——只能通过最大保护模式保证|
|28|升级|从22.2，23.2归档包升级到最新版本，升级前后查询系统视图，调用  DBMS_YSTREAM_ADM高级包|升级前查询视图、调用高级包报错,升级后查询视图、调用高级包成功|  
|
|29|性能|tpcc业务下，测试解析速度和延迟时间|解析速度 > 80M/s的DML数据量,延迟1s内|建表，插入数据，update数据|
|30|长稳|开启日志解析，做业务,7*24解析|  
|  
|
|31|压力|业务量较大时，解析速度远小于日志生成速度，一段时间后会客户端会报错|  
|  
|
|32|23.2.3.100 SIT补测|并行insert into select场景的解析|正常解析|  
|
|33|  
|开启ha ssl，启动解析|正常解析|  
|
|34|  
|yaml中的ip使用ipv6地址|正常解析|  
|
|35|  
|yaml中的port使用非int类型|正常解析|  
|
|36|  
|YSTREAM_CAPTURE权限适配审计策略场景看护|  
|  
|
|37|  
|集群分布式高级包创建报错|  
|  
|
|38|  
|长varchar,大于varchar(8000)|正常解析|  
|


### 3.3.2 高级包，视图，权限测试

- #### 高级包  ：测试高级包调用，输入有效参数，功能要生效，可用过动态视图校验；输入无效参数，报错合理、简单明确
- #### 视图
- #### 权限
- #### 配置参数
- STREAM_POOL_SIZE，最小 64M，最大 64T，立即生效    
  参考    [配置参数测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76929337)  


|**高级包名称**|**简介**|参数的有效输入值|参数的无效输入值|备注|
|:---:|:---:|:---|---|---|
|DBMS_YSTREAM_ADM.  CREATE(server_name, connect_user, start_scn  )|创建一个YStream server，设置起始点，仅写入系统表，不启动YStream server线程。,server_name：  指定server名字,connect_user：允许连接的user名字，为NULL则不限，但必须有YSTREAM权限才能连接,start_scn：开始解析点，  如果为NULL，则从当前scn开始（start scn之前启动的事务都不会被解析）|1. server_name合法，长度64位
1. server_name中包含特殊字符
1. connect_user为null
1. connect_user为有权限的user名称，connect_user这里不做权限校验
1. connect_user加引号
1. start_scn为null
1. server_name为中文
1. connect_user为空串
|1. server_name长度超出64位
1. connect_user无YSTREAM权限
1. connect_user不存在
1. start_scn大于当前scn
1. start_scn为负数或者小数
1. start_scn为超过bigint边界
1. start_scn为0，小于最小的scn
1. server_name名称重复++
1. connect_user只可以有1个或者为空
|  
|
|DBMS_YSTREAM_ADM.ADD_TABLES(  server_name,   table_names, schemas)|添加要解析的表名，也可指定要解析的schema，只有被指定的表才会被解析。可在YStream server运行时执行，如果不指定，则解析所有表。,server_name：  指定server名字,table_names：指定一组表名。格式为scheme1.table_name1, scheme2.table_name2,scheme3.table_name3,schemas：指定一组scheme。格式为scheme1,scheme2|1. server_name、table_names、schemas等都合法
1. 配置  10000张表，100个schema，配置的表的ddl/dml操作会被解析
1. 配置为所有用户下的所有表——  不指定表名和shema
1. 配置为某个用户下的所有表——只指定schema
1. table_names  配置为视图名称或者不存在的表名
1. server_name中包含特殊字符
1. table_names重复，会过滤
1. 多次add相同的表，不会报错
1. schemas不存在
1. 表和schemas不匹配
1. 运行中add表
1. 表名为中文和特殊字符
1. 配置为其他对象，比如说seq，物化视图等
|1. server_name长度超出64位
1. server_name不存在
1. 总共配置  10001张表（多次配置，一次配置）
1. 总共配置101个schema
1. 配置的表为空、空串
1. 配置的schema为空、空串
1. tablename格式不对，不带schema
|  
|
|DBMS_YSTREAM_ADM.DROP_TABLES(  server_name,   table_names, schemas)|删除要解析的表名，也可指定要解析的schema，只有被指定的表才会被解析。,server_name：  指定server名字,table_names：指定一组表名。格式为scheme1.table_name1, scheme2.table_name2,scheme3.table_name3,schemas：指定一组scheme。格式为scheme1,scheme2|1. server_name合法
1. 删除一个表，做ddl/dml业务，该表的ddl/dml操作不会被解析
1. 删除所有表，做ddl/dml业务，ddl/dml操作不会被解析
1. drop的表不存在，不会报错
|1. server_name中包含特殊字符
1. server_name长度超出64位
1. server_name不存在
1. 删除的表不存在
1. 删除的schema不存在
1. 删除的表为空、空串
1. 删除的schema为空、空串
1. 运行中删除表
|中途drop tables是没有用，在启动前去drop    
  如果一旦开始解析，这些表的元数据都会被记录下来，后面就会解析|
|DBMS_YSTREAM_ADM.  SET_PARAMETER(server_name, parameter, value)|设置Logminer相关的参数：,server_name：  指定server名字,parameter：参数名字符串——  参数都有哪些？并行度，大事务溢出时间，大事务溢出大小，Checkpoint间隔4个参数，4个参数的规格待确认,value：参数值字符串|1. server_name，参数名和值都合法
1. 参数值设置为边界值，字符，生效方式
|1. server_name中包含特殊字符
1. server_name长度超出64位
1. server_name不存在
1. 参数名错误或者不存在
1. 参数值不合法：长度越界或者字符错误
1. 运行过程中改配置参数，报错（start后）
1. 参数名正确，参数值为空
|参数名：,- PARALLELISM: 并发度，[1, 128  ]， 默认 1
- TXN_AGE_SPILL_THRESHOLD ：事务溢出时间,[1, 100000], 单位 s， 默认 600
- TXN_LCR_SPILL_THRESHOLD：事务溢出大小 [1K, 1T], 默认 1G
- CHECKPOINT_INTERVAL：checkpoint 周期， [1, 3600]，单位 s， 默认 3
|
|DBMS_YSTREAM_ADM.START(  server_name  )|启动日志解析，如果是第一次启动，则从start scn开始；否则是从checkpoint点开始,server_name：  指定server名字|1. server_name合法
|1. server_name中包含特殊字符
1. server_name长度超出64位
1. server_name不存在
1. add_tables，table_names的schema和table_name均不存在
|  
|
|DBMS_YSTREAM_ADM.STOP(  server_name, force  )|停止日志解析,server_name：  指定server名字,force: 备库上STOP，如果备库和主库断连，无法通知主库修改系统表，则可以用force标志强制停止（系统表中状态不会变）|1. server_name合法
1. 主备断连时，在备库上使用  force，检查主库的系统表状态
1. ystream正在连接时，stop成功，ystream报断连错误
|1. server_name中包含特殊字符
1. server_name长度超出64位
1. server_name不存在
1. 主备断连时，不使用force，调用会报错
1. 没有start，stop报错
|  
|
|DBMS_YSTREAM_ADM.DROP(  server_name)|删除YStream server，释放对应的内存，持久化数据,server_name：  指定server名字|1. server_name合法
|1. server_name中包含特殊字符
1. server_name长度超出64位
1. server_name不存在
1. 已start的server，直接drop报错
|  
|


|**视图名称**|**简介**|测试场景（每个视图都需要覆盖）|
|:---:|:---:|---|
|all_YSTREAM  _PARAMETERS|YStream相关参数,SERVER_ID              INTEGER    
  PARAM_NAME        VARCHAR(64)    
  PARAM_VALUE       VARCHAR(64)   参数当前值    
  PARAM_DEFAULT   VARCHAR(64)    参数默认值|1. 使用不同方法查询视图：desc，select *，-c +sql语句，查询成功，字段定义正确，字段不缺失，无错别字
1. 数据库在不同状态下查询视图，  仅open可查，其他状态查询报错
1. 在不同场景下视图字段值变化是否符合预期（重点）
1. 在备机上查询视图，能正常查询，与主机一致
1. 执行并发业务，35个并发解析日志时，并发查询该视图，  数据库正常运行
|
|all_  YSTREAM  _TABLES|显示所有需要解析的表名，scheme, SERVER_ID INTEGER    
  SCHEMA VARCHAR(64)    
  TABLE_NAME VARCHAR(64)||
|V$YSTREAM_SERVER|显示所有YStream server的状态，包括运行状态，启动时间，当前进度，checkpoint,SERVER_ID INTEGER,STATUS VARCHAR(16),CREATE_TIME TIMESTAMP,START_SCN BIGINT    
  START_POINT VARCHAR(32)    
  RESTART_POINT VARCHAR(32),RESTART_POSITION VARCHAR(64)    
  CAPTURE_POINT VARCHAR(32),CAPTURE_POSITION VARCHAR(64),APPLIED_POSITION VARCHAR(64)    
  ERROR VARCHAR(1024)||
|V$YSTREAM_STAT|显示所有Logminer Sever的统计信息，包括send大小，解析大小，溢出事务大小等  SERVER_ID INTEGER,SEND_SIZE BIGINT,SEND_SPEED BIGINT,CAPTURE_SIZE BIGINT,CAPTURE_SPEED BIGINT,SPILL_SIZE BIGINT,SPILL_COUNT BIGINT,MEMORY_USED BIGINT||
|V$YSTREAM_EVENTS（暂不支持）|显示YStream server的事件，包括启动，关闭，重连，修改过滤条件等||


|  
|场景|备注|
|:---:|---|---|
|1|具有YSTREAM_CAPTURE权限的普通用户，通过API连接和执行高级包成功|  
|
|2|没有  YSTREAM_CAPTURE权限的普通用户，通过API连接和执行高级包报错|报权限不足|
|3|不开启三权分立，sys/  dba  用户，  通过API连接和执行高级包成功,开启三权分立，sys/  dba  用户，权限受限，需要测试|  
|
|4|sysdba、sysbackup用户，没有YSTREAM_CAPTURE权限，通过API连接和执行高级包报错|  
|
|5|删除、创建YSTREAM_CAPTURE  角色报错|  
|
|6|dba_roles新增  YSTREAM_CAPTURE角色，升级后，视图要适配|  
|


### 3.3.3 异常场景

在使用API进行日志解析的过程中可能会有一些异常情况，采用错误推测法并结合实际使用过程中可能遇到的一些错误场景做测试。验证的主要场景如下：

|覆盖各种错误类型：|
|:---|
|errorCode|说明|
|MINER_ERROR_BUF_SIZE|解析时内存不足，可能是大并发事务或者遇到批量insert，数据量较大，服务端线程退出报错，客户端会报错|
|MINER_ERROR_INVALID_FILE|redo或归档文件的checksum不正确，可能是文件已损坏|
|MINER_ERROR_NO_MORE_LOG|redo日志已经解析到最后，没有更多的日志了，可能数据库此时没有业务，不会报错，只发心跳|
|解析过程中重启数据库，事务中断，扫归档|  
|
|备机switchover|旧主机上的ystream连接会断连|
|api内存不足|会报oom|
|profile,a. IDLE_TIME 允许空闲会话的时间，单位是分钟，默认无限制    
  b. SESSIONS_PER_USER 每个用户名所允许的并行会话数，默认无限制|找志鹏确认,idle_time配置时间不应小于ckpt间隔时间，否则在数据库空闲时，Ystream连接会失败|
|网络断连或者超时|  
|
|大数据量事务，磁盘空间不足|  
|
|applay position改小，客户端会报错|  
|
|连接中途，（服务端/客户端）网络断连|  
|
|yml中的ip，端口，用户名密码等配置错误，连接失败|  
|
|服务端网络时延，超出jdbc socketTimeout参数，客户端会报错|jdbc连接有一个配置参数，ystream也对外暴露叫clientResponseTimeout，对应jdbc的socketTimeout，这个参数配置也不应小于ckpt间隔时间，默认60s|
|服务端网络丢包，客户端不会报错|tcp会保证数据完整性|
|服务端网络闪断，服务端会报错，客户端会抛异常|  
|
|未开启库级和表级附加日志，执行sql文件，做日志解析|  
|
|YStream server中指定的connect_user和yaml文件中的username不一致|连接报错|
|yaml文件中password不对|连接报错|
|host或者port不对|连接报错|
|recover为true，传入错误的position|解析报错|
|host使用ipv6地址|解析成功|
|connect_user没有ystream权限时，客户端连接|连接报错|
|STREAM_POOL_SIZE配置为0，解析报错|解析报错|


|errorCode|说明|
|:---|:---|
|MINER_ERROR_BUF_SIZE|解析时内存不足，可能是大并发事务或者遇到批量insert，数据量较大，服务端线程退出报错，客户端会报错|
|MINER_ERROR_INVALID_FILE|redo或归档文件的checksum不正确，可能是文件已损坏|
|MINER_ERROR_NO_MORE_LOG|redo日志已经解析到最后，没有更多的日志了，可能数据库此时没有业务，不会报错，只发心跳|
|解析过程中重启数据库，事务中断，扫归档|  
|
|备机switchover|旧主机上的ystream连接会断连|
|api内存不足|会报oom|
|profile,a. IDLE_TIME 允许空闲会话的时间，单位是分钟，默认无限制    
  b. SESSIONS_PER_USER 每个用户名所允许的并行会话数，默认无限制|找志鹏确认,idle_time配置时间不应小于ckpt间隔时间，否则在数据库空闲时，Ystream连接会失败|
|网络断连或者超时|  
|
|大数据量事务，磁盘空间不足|  
|
|applay position改小，客户端会报错|  
|
|连接中途，（服务端/客户端）网络断连|  
|
|yml中的ip，端口，用户名密码等配置错误，连接失败|  
|
|服务端网络时延，超出jdbc socketTimeout参数，客户端会报错|jdbc连接有一个配置参数，ystream也对外暴露叫clientResponseTimeout，对应jdbc的socketTimeout，这个参数配置也不应小于ckpt间隔时间，默认60s|
|服务端网络丢包，客户端不会报错|tcp会保证数据完整性|
|服务端网络闪断，服务端会报错，客户端会抛异常|  
|
|未开启库级和表级附加日志，执行sql文件，做日志解析|  
|
|YStream server中指定的connect_user和yaml文件中的username不一致|连接报错|
|yaml文件中password不对|连接报错|
|host或者port不对|连接报错|
|recover为true，传入错误的position|解析报错|
|host使用ipv6地址|解析成功|
|connect_user没有ystream权限时，客户端连接|连接报错|
|STREAM_POOL_SIZE配置为0，解析报错|解析报错|


### 3.3.4   并发场景（包括并发和kill两种场景）

在实际的业务使用场景中并发是必然的，所以在日志解析时同样需要处理并发场景。具体场景如下：

考虑不同的附加日志模式

|编号|场景|预期|备注|
|:---|:---|:---|:---|
|1|多线程并发执行ddl操作，然后进行解析|日志解析成功|在这些操作中都需要考虑到lob类型|
|2|多线程并发执行dml操作，然后进行解析|日志解析成功|  
|
|3|多线程并发执行ddl和dml操作，然后进行解析|日志解析成功|  
|
|4|dml操作和事务相关操作并发的时候进行日志解析|日志解析成功|  
|
|5|并发解析多张表的ddl操作|解析成功|  
|
|6|并发解析多张表的dml操作|解析成功|  
|
|7|并发解析多张表的ddl操作和dml操作|解析成功|  
|
|8|大数据量下多表并发（构造溢出事务）|+|  
|
|9|32个并发同时去解析|客户端正常解析|连同一个库的，不同库的ystream|
|10|并发调用高级包create，add_table，start，stop，drop:,1. ddl/dml解析和启停server并发+2个stream视图查询
1. 1个server配置32个并发解析ddl/dml+2个stream视图查询
1. 32个server各自配置8个并发解析ddl/dml+2个stream视图查询
1. ddl/dml并发+解析过程中kill 重启java+2个stream视图查询
1. ddl/dml并发+解析过程中kill 重启yasdb，启动java+2个stream视图查询
|不会core|  
|


### 3.3.5 导入场景

开启all 模式库级附加日志，执行以下导入场景

|序号|场景|备注|
|---|---|---|
|1|使用imp工具导入元数据，导入成功后，查看解析的sql语句是否正确|可以被imp工具进行元数据导入的对象有：,- 用户——不记录附加日志
- SEQUENCE
- AC——不记录附加日志
- 同义词
- 视图/物化视图
- 表
- 索引/分区索引
- 主键
- 外键
- 审计策略/使能——不  记录附加日志
- 权限——不  记录附加日志
- PROFILE——不记录附加日志
- OUTLINE——不  记录附加日志
- PACKAGE(BODY)/PROCEDURE/FUNCTION/TRIGGER/JOB/LIBRARY/TYPE(BODY)
- DATABASE LINK——不记录附加日志
,同时，对象的约束、依赖关系（例如VIEW依赖的TABLE）、列属性等信息也将被导入|
|2|使用yasldr工具导入heap表数据（普通表，覆盖各种数据类型，带约束、索引），查看解析的sql语句是否正确|覆盖lob类型|
|3|使用yasldr工具导入tac表数据（覆盖各种数据类型，带约束、带索引），查看解析的sql语句是否正确|  
|
|4|使用yasldr工具导入lsc表数据（分区表，覆盖各种数据类型，带约束、带索引），查看解析的sql语句是否正确|  
|


### 3.3.5 从接口的角度出发，针对每个接口的测试——责任人：梁嘉成

因为3.3.1中已经基本覆盖测试了大部分接口的正常使用场景，但未对接口返回值做精细化校验（例如objectID，transactionID，position等），也未覆盖到异常场景，所以需要单独对接口进行测试

![](https://pingcode.yasdb.com/atlas/files/public/67396d1da1ad9a3311dc8ecb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUVBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4OTMsImV4cCI6MTc4MjMxNjY5M30.1Sp5SAwjAItga4f3MgoxOULKnaCd8iYZ8iLiRUJa8S8)

需要关注：持续长时间做日志解析，解析是否正常运行；解析完成并释放资源后，继续下发大数据占用内存的业务，检查有无内存泄漏的情况，提供一个jar包

|**接口**|**内容**|**简介**|**详细**|
|:---:|:---:|:---:|:---|
|客户端API    
  **jar名字：yas_stream.jar**    
    
,  
,  
,  
|getClient(): YasCdcClientBoot|获取CDC客户端实例|  
|
||open(YasCdcConfig): void|打开CDC客户端|  
|
||next(): AbstractLogMinerResult|读取一条CDC解析后结果|超出pollTimeout，next()接口返回空行|
||close():     void|关闭CDC客户端|  
|
|YasCdcConfig|builder(): Builder<T>|获取YasCdcConfig的Builder<T>，用于构造YasCdcConfig|  
|
|  
|setCheckpointManager(CheckpointManager): Builder<T>|设置检查点序列化/反序列化方法。调用者实现该接口，客户端即会定期序列化检查点，并在恢复时将检查点反序列化|  
|
|  
|setDeserializer(Deserializer<T>): Builder<T>|设置反序列化方法。调用者实现该接口，客户端即会将AbstractLogMinerResult转换为调用者需要的结构|  
|
|AbstractLogMinerResult|LogMinerDdl|DDL实体类|  
|
||LogMinerDml|DML实体类|  
|
||LogMinerChunk|大对象实体类|  
|
||LogMinerXact|事务标识实体类|  
|
||LogMinerCkpt|检查点实体类（不会在next的返回值获取，用作断点续传）|  
|
|LogMinerDdl|getDdlType():DdlType|获取DDL类型|  
|
||getObjectId():long|获取对象id|  
|
||getObjectType():ObjectType|获取受影响的对象|  
|
||getTableName():String|获取所属的表名|  
|
||getDdlText():String|获取DDL的SQL文本|  
|
||getSchemaName():String|获取所属的模式名|  
|
||getMetadata(): Metadata（可不对外暴露）|获取元数据修改信息（作为SQL的补充）|  
|
|LogMinerDml|getObjectId():long|获取表对象id|  
|
||getTableName():String|获取表名|  
|
||getSchemaName():String|获取模式名|  
|
||getDmlType():DmlType|获取DML类型|  
|
||getNewValues():Object[]|获取更新后的值，delete类型将返回null，  包含所有列信息、是否为行外、列id、列字节信息、列数据信息，  **该部分是最重要的内容**|  
|
||getOldValues():Object[]|获取更新前的值，insert类型将返回null|  
|
||hasChunkData():boolean|该条dml是否包含大对象|  
|
||getScn():LogMinerScn|获取该条dml的唯一标识信息|  
|
|LogMinerChunk|getObjectId():long|获取表对象id|  
|
||getTableName():String|获取表名|  
|
||getSchemaName():String|获取模式名|  
|
||getColId():int|获取列id（非数据库的colId，是对应前述DML中的一个自增id）|  
|
||getOffset():long|获取该片chunk起始位置相对整个值的偏移量|  
|
||getSize():long|获取该片chunk的大小|  
|
||isEmpytChunk();boolean|判断该chunk是否是EMPTY，注意并非是null|  
|
||isEndOfRow():boolean|判断是否是上述DML中的最后一个Chunk|  
|
||isLastChunk():boolean|判断该片chunk是否是是整个chunk的最后一个片|  
|
||getScn():LogMinerScn|获取该条dml的唯一标识信息|  
|
|LogMinerXact|getXactType():XactType |获取该事务标识的类型|  
|
|LogMinerCkpt|defaultSerialize(LOG_MINER_CKPT):byte[]|默认的序列化方式|  
|
||defaultDeserialize(byte[] ckpt):LOG_MINER_CKPT|默认的反序列化方式|  
|
|Metadata|getTable(long objectId):Table|获取表信息|  
|
||……|  
|  
|
|Table|getColTypes():List<ColType  >|获取列类型|  
|
||getColNames():List<String>|获取列名,getNewValues  ()|  
|
||getTableName():String|获取表名|  
|
||getTableSchema():String|获取模式名|  
|
||getColSize():int|获取列数大小|  
|
||……|  
|  
|
|ColType|int、char、blob ……|枚举|  
|
|DdlType|alterTable、createTable ……|枚举|  
|
|ObjectType|table、package、index ……|枚举|  
|
|LogMinerScn|compareTo(LogMinerScn o):int|比较唯一标识打大小信息，大于则返回正，否则返回负|  
|
||getScn():byte[]|获取其Scn的二进制表示形式|  
|
|DmlType|insert、update、delete|枚举|  
|
|XactType|start、commit、savePoint、rollback|枚举|


# 4. 测试用例

[Ystream测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWNhMWFkOWEzMzExZGM4ZWMzIiwicmVmX2lkIjoiNjczOTZkMWM1OTNmOTljOWZmMjM3N2Q1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODkzLCJleHAiOjE3ODIzOTIyOTN9.S9rwuPWrKFcwU9m1896KcveS3kIpJQSFB_iATRIM3xs)

# 5. 测试框架设计

使用ha_regress框架自动化

并发和testkill场景使用testkill框架

长稳使用长稳框架

升级场景使用升级测试框架

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|部署|  
|
|操作系统|Linux|


# 7. 工作量评估

总计25人天：

测试调研+测试设计+评审：4人天

测试流程拉通（现有用例适配新的java api）：2人天

测试执行：13人天

接口测试执行：4人天（开发投入）

上车+问题单回归+CI分析+资料测试：2人天

  


测试计划（2个人投入测试）：

5.11 测试设计评审

5.20~5.22 完成测试流程拉通（使用联调包），使用新的接口能够执行存量用例，完成部分新增场景的自动化用例

5.22 转测

5.22~5.31 测试执行、接口测试

6/7 上车

计划测试完成时间：6.7

## Attachments:

[数据库级附加日志用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWQ4OTcwYzJhZjRmNTIxMDU2IiwicmVmX2lkIjoiNjczOTZkMWM1OTNmOTljOWZmMjM3N2Q1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODkzLCJleHAiOjE3ODIzOTIyOTN9.Wsh72CkEx4lq1_Chnineo5ZEfpMMOnhqXUUs4FgPG5Q)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[Ystream测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWNhMWFkOWEzMzExZGM4ZWMzIiwicmVmX2lkIjoiNjczOTZkMWM1OTNmOTljOWZmMjM3N2Q1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODkzLCJleHAiOjE3ODIzOTIyOTN9.S9rwuPWrKFcwU9m1896KcveS3kIpJQSFB_iATRIM3xs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,YStream日志解析测试设计评审会议纪要    
  与会人：马志宏，马勇，梁嘉成，毛华杰，刘丹，高亚宁    
  会议时间：2024/5/11    
  会议地点：腾讯会议    
  会议纪要：    
  1. 表中包含XML，JSON，udt等复杂类型的列，会解析，但解析的列数据可能错误    
  2. 溢出事务测试补充：create table as select产生的大数据量事务场景；补充溢出事务超出sysaux表空间时，解析停止，执行业务会报错的场景    
  3. 断点续传测试补充：设置txn_age_spill_threshold参数，构造溢出事务归档被清理场景，期望是归档清理成功，能正常解析    
  4. 主备场景：补充主备之间日志有gap，在备机解析，传入gap之前的position，解析会等待；考虑最大性能模式下，备机failover后，日志丢失，传入分歧点之前的point，正常解析    
  5. 增加长稳和压力测试场景    
  6. 高级包测试时，要考虑各种高级包的使用顺序，例如，要先start再stop，最后才能drop；已start的server，直接drop报错    
  7. DBMS_YSTREAM_ADM.SET_PARAMETER(server_name, parameter, value)，需要补充4个参数的规格@马志宏    
  8. 视图：all_YSTREAM_PARAMETERS，all_YSTREAM_TABLES需要确定是否同步新增对应的dba和user视图@马志宏    
  9. 权限场景：dba用户具有YSTREAM_CAPTURE权限    
  10.异常场景补充：,- 考虑profile    
  a. IDLE_TIME 允许空闲会话的时间，单位是分钟，默认无限制，需要找志鹏确认客户端是否是长连接，受不受该参数控制@梁嘉成    
  b. SESSIONS_PER_USER 每个用户名所允许的并行会话数，默认无限制
- 网络断连或者超时
- 大数据量事务，磁盘空间不足
- applay position改小，客户端会报错
- 连接中途，（服务端/客户端）网络断连
- yml中的ip，端口，用户名密码等配置错误，连接失败
- 服务端网络时延，超出jdbc socketTimeout参数，客户端会报错
- 服务端网络丢包，客户端不会报错 tcp会保证数据完整性
- 服务端网络闪断，服务端会报错，客户端会抛异常
,11. 并发场景：,- 大数据量下多表并发
- 32个并发同时去解析 客户端正常解析 连同一个库的，不同库的ystream
,12. 接口测试：next()接口测试时，考虑超出pollTimeout，返回空行的场景,Posted by gaoyaning at 五月 11, 2024 18:30|
|---|
|  [](null)  ,以下场景为设计如此：,1. 开启/关闭库级附加日志不会记录redo，不解析
1. function解析出来没有schema
1. DBMS_YSTREAM_ADM.create中不校验connect_user是否有Ystream权限，连接的时候会校验
1. DBMS_YSTREAM_ADM.add_tables不会校验表是否存在
,  
,Posted by gaoyaning at 五月 24, 2024 14:20|
|  [](null)  ,v$ystream_server参数：,START_POINT：0-65-100-2889，point就是redo point，和v$database里的point一样，rstid-asn-blockid-lfn,RESTART_POSITION：569433204359233536-0-5538-0-0，scn-instanceId-lsn-offset-rowNum,Posted by gaoyaning at 五月 28, 2024 11:39|
|  [](null)  ,长时间未提交事务溢出解析测试场景构造：,1. 启动事务，插入一点数据    
  2. 等待超过溢出时间    
  3. 切换redo几次    
  4. 再启动一个短事务，这个是为了让API收到一个已提交的LCR，以便推进Applied Position    
  5. 然后查询视图里的restart point是不是更新了    
  6. 然后删除restart point之前归档（在启动长事务的时候，看一下current redo asn，确认是这个事务再这个asn里）    
  7. kill API    
  8. 提交长事务    
  9. kill yasdb    
  10. 重启    
  11. API重连    
  12. 期望解析出长事务,Posted by gaoyaning at 五月 29, 2024 18:04|
