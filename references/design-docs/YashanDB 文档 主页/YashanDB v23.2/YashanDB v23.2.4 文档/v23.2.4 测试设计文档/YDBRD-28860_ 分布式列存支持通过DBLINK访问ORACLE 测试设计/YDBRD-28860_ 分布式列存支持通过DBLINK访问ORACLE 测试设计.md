Created by 黄家华, last modified on 七月 24, 2024



-   [1. 概述](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-1.概述)  
-   [2. 需求分析](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-2.需求分析)  
    -   [2.1 描述](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-2.1描述)  
        -   [需求场景：](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-需求场景：)  
        -   [需求描述：](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-需求描述：)  
        -   [需求范围：](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-需求范围：)  
        -   [需求规格：](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-需求规格：)  
    -   [2.2 功能描述](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-2.2功能描述)  
        -   [开发设计方案](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-开发设计方案)  
        -   [开发设计方案评审会议纪要](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-开发设计方案评审会议纪要)  
        -   [前置操作：](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-前置操作：)  
    -   [2.3 规格限制](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-2.3规格限制)  
-   [3. 测试设计方法 ](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-3.测试设计方法)  
    -   [3.1 测试内容：（摘自YDBRD-28860: 分布式列存支持通过DBLINK访问ORACLE概要设计 - YashanDB - SICS-CoD Confluence (yasdb.com)）](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-3.1测试内容：（摘自YDBRD-28860:分布式列存支持通过DBLINK访问ORACLE概要设计-YashanDB-SICS-CoDConfluence(yasdb.com)）)  
    -   [3.2 测试场景：](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-3.2测试场景：)  
-   [4. 详细设计](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-4.详细设计)  
    -   [4.1 基本功能测试](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-4.1基本功能测试)  
    -   [4.2 交叉功能测试（手动验证）](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-4.2交叉功能测试（手动验证）)  
    -   [4.3 可靠性测试](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-4.3可靠性测试)  
-   [5. 文本用例](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-5.文本用例)  
-   [6. 测试框架设计](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-7.测试环境说明)  
-   [8. 评审意见：](#YDBRD28860:分布式列存支持通过DBLINK访问ORACLE测试设计-8.评审意见：)  




# **1. 概述**

本文描述分布式列存支持通过DBLINK访问Oracle的测试设计;

前置开发设计：

当前YashanDB已经通过DBLINK实现了database粒度的外部数据访问，当前YashanDB的DBLINK支持范围为单机行存，外部数据源支持YashanDB以及ORACLE。具体设计可参考以下文档：

  [Yashan Database Link概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135618805)  

  [Yashan Database Link实现](https://conf.yasdb.com/pages/viewpage.action?pageId=150626779)  

本SR: 

开发文档：    [YDBRD-28860: 分布式列存支持通过DBLINK访问ORACLE - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156115618)  

# **2. 需求分析**

## 2.1 描述

### 需求场景：

嘉实基金需求，需要支持分布式下多源异构数据库的联邦查询，当前需求的主要目标是分布式YashanDB访问ORACLE。

### 需求描述：

当前YashanDB已经实现通过Database Link形式对ORACLE的访问，但支持范围为单机行存，当前分布式AP场景主要使用列式计算，需要扩展当前Database Link的使用范围。

1. 适配分布式下的DBLINK元数据对象管理能力。
1. ~~确认通过DBLINK的表扫描的分布属性（一阶段实现是先当作CN本地表，工作量小），insert/update/delete带子查询包含dblink table时的处理。~~    设计评审时决定目前分布式下不支持DML
1. DBLINK数据源为oracle时数据当前是转换成行表达式，需要增加对列存的支持。
1. DBLINK能力增强，当前投影列没有下推到对端数据库，需要将投影列下推。


### 需求范围：

单机、集群和  **分布式**

**鉴于嘉实基金主要应用为分布式，**  **本需求主要测试分布式，单机和集群仅依赖现有用例，保证现有用例正常运行及修改预期。**

### 需求规格：

所属迭代    
  YashanDB-23.2.4.100

## 2.2 功能描述

### 开发设计方案

  [ ](https://conf.yasdb.com/pages/viewpage.action?pageId=153002705)      [YDBRD-28860: 分布式列存支持通过DBLINK访问ORACLE - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156115618)  

### 开发设计方案评审会议纪要

  [YDBRD-28860: 分布式列存支持通过DBLINK访问ORACLE 会议纪要 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156125979)  

### 前置操作：

下载Oracle OCI、部署Oracle数据库

## 2.3 规格限制

1. 当前仅支持基础数据类型，不支持lob。
1. 当前不支持一个查询内多个节点同时使用DBLINK访问ORACLE。
1. ~~DBLINK框架不支持多个线程共享一个连接，分布式下当前会话有未提交的DBLINK事务，则再进行包含DBLINK表的查询（包括dml子查询中包含DBLINK表），当前报错不支持，需要提交或回滚当前会话无DBLINK事务后可执行。~~
1. 沿用单机和集群版约束：
    1. 该版本支持yashan->oracle和yashan->yashan两种形式
    1. 数据类型的支持情况参照：    [数据类型支持情况](https://conf.yasdb.com/pages/viewpage.action?pageId=109593206)  
    1. ~~该SR只支持行存表，得先打通行列混合功能后才能支持列存表~~
    1. 注意，投影列不支持select dblink_remote_t3@dblink_y2y.* from dblink_remote_t3@dblink_y2y;    [这种又含有@和.的情况，报错invalid](null)       symbol @，oracle也报错。如果想执行类似效果，给表起别名。
    1. oracle->yashan不在此SR交付范围
    1. 注意，不支持truncate/drop/alter/create table t1@link4，报错invalid symbol @
    1. 不支持table.column@dblink形式的查询，报错invalid symbol @
1. 来自文档上的约束：单次查询支持的远端表数量最大是32个 (    [dblink | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/dblink.html)    )
1. 来自测试用例里的约束：同时打开的dblink的数量最大是1024个（  参数EXS_DBLINK_MAX_ITEMS        参数含义：同一时间处于使用状态的dblink数量上限，值为1024，不可修改)


# **3. 测试设计方法 **

主要采用的等价类划分，边界值，场景法组合进行设计；

## 3.1 测试内容：（摘自    [YDBRD-28860: 分布式列存支持通过DBLINK访问ORACLE概要设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156129570)    ）

|测试对象|测试项|详细描述|备注|测试用例|
|:---|:---|:---|:---|---|
|DDL    
    
    
    
|语法覆盖|CREATE /ALTER/DROP DATABASE LINK|  
|  [改造自单机用例 dblink/meta目录](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dblink/meta)  |
||节点异常覆盖    
    
|执行过程CN故障，包括执行CN和其它CN故障场景|观察DDL各个节点是否最终一致|新增用例4.3.1|
|||MN故障倒换|观察DDL各个节点是否最终一致|新增用例4.3.2、4.3.4|
|||DN故障倒换|观察DDL各个节点是否最终一致|新增用例4.3.3、4.3.4|
||导入导出|exp/imp 元数据导入导出|  
|新增用例4.2.4|
||权限管理|grant   CREATE /ALTER/DROP DATABASE LINK to 用户以及角色|  
|  [迁移自单机用例dblink/auth_audit](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dblink/auth_audit)  |
|||只有CN可以操作DDL，MN，DN拦截|  
|新增用例4.1.2.a.i|
||审计|审计对象包含DATABASE LINK|  
|  [迁移自单机用例 dblink/auth_audit](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dblink/auth_audit)  |
||扩容|CN扩容|扩容后查询对象|新增用例4.2.3.a|
|||DN组扩容|扩容后查询对象|新增用例4.2.3.b|
||升级|升级后  CREATE /ALTER/DROP DATABASE LINK|功能正常|新增用例4.2.2|
||~~元数据同步~~|~~与ORACLE之间迁移元数据~~|  
|  
|
|DML|插入更新删除|INSERT/UPDATE/DELETE/INSERT INTO SELECT|只支持单表？是否支持多表？|分布式不支持，期待报错 测试用例 4.1 1 b c|
||TRUNCATE|TRUNCATE TABLE|  
|分布式不支持，期待报错 测试用例 4.1 1 b|
||DML带子查询|DML操作带子查询，本地表和远程oracle表混合|  
|分布式不支持，期待报错 测试用例 4.1 1 b c|
|DQL|全表查询|  
|  
|迁移单机用例（    [dblink/select/test_sr13328_dblink_select_002.sql](https://git.yasdb.com/cod-test/yasft/-/blob/master/standalone/testcase/dblink/select/test_sr13328_dblink_select_002.sql)    ）|
||带投影列查询|  
|  
|迁移单机用例(    [dblink/select/test_sr13328_dblink_select_004.sql)](https://git.yasdb.com/cod-test/yasft/-/blob/master/standalone/testcase/dblink/select/test_sr13328_dblink_select_004.sql)     + 新增用例4.1.2.c|
||带谓词列查询|  
|  
|迁移单机用例(    [dblink/select](https://git.yasdb.com/cod-test/yasft/-/blob/master/standalone/testcase/dblink/select)    ) + 新增用例4.1.2.c|
||join|  
|  
|迁移单机用例(dblink/select/test_sr13328_dblink_select_006.sql) + 新增用例4.1.2.b + 4.1.2.d|
||子查询|  
|  
|迁移单机用例(dblink/select/test_sr13328_dblink_select_005.sql) + 新增用例4.1.2.b + 4.1.2.d|
||集合查询|  
|  
|迁移单机用例(dblink/select)|
||函数|  
|  
|迁移单机用例(dblink/select/test_sr13328_dblink_select_004.sql)|
||数据类型覆盖|  
|  
|迁移单机用例(dblink/select/test_sr13328_dblink_select_003.sql)|
|事务|事务一致性|通过DBLINK连接oracle操作保证数据一致性|  
|不支持，期待报错 测试用例 4.1 1 b c|
|不同节点连接|分布式不同节点|CN，MN，DN查询|  
|支持，用例4.1.2.a.i|
|其它|LOB|DBLINK连接ORACLE支持查看LOB数据|分布式已经添加约束|不支持，期待报错，测试用例 4.1.2.c.i|
|  
|同义词|是否  支持创建为dblink同义词|  
|分布式不支持同义词。添加一个负面用例，报错。无需迁移用例     [yasft\standalone\testcase\dblink\test_sdv_ydbrd25316_dblink_synonym](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dblink/test_sdv_ydbrd25316_dblink_synonym)     - 分布式不支持创建同义词|
|  
|存储过程|远程调用Oracle的存储过程|  
|新需求已经支持，需要考虑用例：     [DBLINK连接ORACLE支持远程调用Oracle的存储过程-特性设计](150624845.html)    。需要在分布式下运行单机用例看下是否支持    [yasft\standalone\testcase\dblink\procedure](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dblink/procedure)     - 确认不支持，目前没报错|
|  
|SEQUENCE|是否  支持SEQUENCE|  
|迁移单机用例    [dblink/sequence](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dblink/sequence)      - 确认不支持，目前报错不合理|
|视图|动态视图|v$DBLINK_OBJ_STAT,v$DBLINK_MEM_STAT,DBA视图|  
|1. 迁移单机用例：    [dblink/system_view](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dblink/system_view)  
1. 新增分布式相关用例，在DN、MN节点查询视图
|


## 3.2 测试场景：

1. 通过DB link 进行联邦查询
    1. Oracle
    1. Yashan & Oracle
    1. Oracle & Oracle
1. 通过DB link进行导数到Yashan DB，目前分布式下会报错
    1. Create table as select from dblink table
    1. create table; insert into xxx select * from dblink table


# 4. 详细设计

## 4.1 基本功能测试

1. 改造原有单机的dblink测试用例在分布式上运行 (standalone/testcase/dblink/)
    1. auth_audit - 迁移，审计相关
    1. dml - 分布式下不支持，大部分dml无需迁移过来，
        1. 仅添加2个insert\update\delete作为异常用例(1. dblink中的表在查询中，2. dblink中的表作为更新的对象)
    1. insert_select - 同DML，分布式不支持，仅在dml中保留异常用例，保证正常拦截
    1. lock - 迁移 - 反面用例，拦截
    1. meta - 迁移 - 创建dblink用例，元数据相关
    1. params - 1024个同时使用的dblink上限，无法迁移，单机用例是使用dml验证的，需要看下能不能用查询验证 (参数EXS_DBLINK_MAX_ITEMS        参数含义：同一时间处于使用状态的dblink数量上限，值为1024，不可修改)
    1. plsql - 没必要迁移，匿名块只是该目录下很小的一个用例，而且还包含了dml。分布式只支持匿名块，不支持dml，匿名块用例在下边select有覆盖到。
    1. select - 全部迁移到分布式 
        1. yashan → Oracle
            1. 单表
            1. 数据类型及规格
            1. 函数
            1. 子查询
            1. 多表连接 (inner, left, right, full, cross, 自连接, using, 复杂，远程+远程，本地+远程，远程不同link)
            1. 多表集合 (intersect, union, minus)
            1. where (复合条件、isnull、is not null、between and、like、匿名块、存储过程等)
            1. 规格（test_sr13328_dblink_select_010.sql这里考虑将列数量规格加大到Oracle的上限1000）
        1. yashan → yashan
            1. 同上
    1. sequence - 大部分用例是DML，DDL，不迁移，查询相关的迁移：dblink\sequence\test_sdv_seq_ydbrd_26126_10.sql，dblink\sequence\test_sdv_seq_ydbrd_26126_13.sql
    1. procedure - 存储过程，在分布式下试下是否支持，支持的迁移过来
    1. test_sdv_ydbrd25316_dblink_synonym - 同义词，部分查询相关的迁移，DML和DDL相关的不迁移。test_sdv_ydbrd25316_dblink_synonym_001,002,003,006,007,022,023,024,025,026,027,028,029,031,032,039,040.sql
    1. sit - 在分布式下跑一遍，支持的迁移到分布式（包括函数、窗口函数、视图、物化视图、sequence）
    1. systemview - dblink系统表相关、迁移到分布式
1. 新增分布式相关用例
    1. 分布式节点相关
        1. SYS用户和普通用户分别在CN、DN、MN节点上创建、删除、修改、使用public和private dblink
        1. SYS用户和普通用户分别在CN、DN、MN节点上查询以下视图:   DBA_LINKS视图、ALL_DB_LINKS视图、USER_DB_LINKS视图、v$DBLINK_OBJ_STAT、V$DBLINK_MEM_STAT
        1. 分布式节点主备倒换后依然能使用已经创建的dblink
        1. 不同节点创建同名dblink，预期：报错
        1. CN、DN、MN节点使用dblink查询过程中，其他CN节点下发删除、修改dblink，预期：报错 （手动测试，FT框架没有并行）
    1. 分布式并行计算相关（lsc表和tac表）
        1. alter session set degree_of_parallel = N; alter session set _COST_PX_QUEUE=0;
            1. 参考DML5/px_parallel，将其中非分区表在Oracle上创建
                1. 子分区为非分区表、list分区表、range分区表、join后group
                1. union all、union
                1. 关联子查询(exist、not exist) + 非关联子查询(all, any, in, not in)
                1. 改造test_reinforce_px_parallel_ref_subquery_01.sql 和test_px_reinforce_stage_mix_shard_and_dup.sql，将复制表创建到Oracle上，
            1. 覆盖所有算子(HASH JOIN/NEST LOOP/MERGE JOIN/ORDER BY/GROUP BY/DISTINCT/ORDER BY + LIMIT/DISTINCT + ORDER BY + LIMIT/ROWNUM/窗口函数/聚合/CASE WHEN/CTE/)
                1. 输入参数需要覆盖常量、变量、表达式、高级包的输出
    1. 投影列相关（聚合函数/常量/函数表达式/窗口函数/高级包/系统变量/伪列/子查询/索引列/分布键/非分布键/分区键）(参考：test_ydbrd21532_lsc_dupl_03.sql)
        1. 覆盖表上所有Oracle有的数据类型(    [概要设计文档-Database link - YashanDB SQL - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135618805#dblink%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E6%98%A0%E5%B0%84)    ),LOB(预期失败)
        1. 查询或者条件过滤的列是常量(字符、数字、null)
        1. 查询或者条件过滤的列含有表达式或者是虚拟列
        1. 查询或者条件过滤的列含有rowid等伪列(预期：失败)
        1. 查询或者条件过滤的列含有用户自定义类型(预期：失败)
        1. 查询或者条件过滤的列是在高级包中、函数中调用
        1. 查询或者条件过滤的列在Oracle中部分存在，部分不存在(预期失败)
    1. 多种类型的表混合查询 (分布式tac|lsc + 单机tac|lsc|heap + Oracle) (手动验证)
        1. 分布式tac表|lsc表 + Yashan dblink单机heap表 + Oracle dblink = 列存查询
        1. 分布式tac表|lsc表 + Yashan dblink 单机tac表|lsc表 + Oracle dblink = 列存查询
        1. 单机heap表 + Yashan 分布式dblink tac表|lsc表 + Oracle dblink = 行存查询
        1. 分布式tac表|lsc表 + Oracle dblink（外部表、IOT、分区表、视图、物化视图、临时表、系统表、系统视图)
    1. 其他
        1. 索引和hint
            1. 对tac/lsc表创建索引，和Oracle表做表连接或者子查询，查询结果不变
            1. 在查询时使用hint改变执行计划，查询结果不变
        1. 视图：
            1. 对含有dblink的查询创建视图，通过视图去查询。
            1. 对含有dblink的join查询和子查询创建视图，通过视图去查询
            1. 创建上一个视图的视图，通过视图去查询
            1. 对dblink表和视图进行join和子查询去查询
        1. 在含有dblink的sql中做DDL操作 (预期报错)


## 4.2 交叉功能测试（手动验证）

1. 运行原有单机和集群的dblink测试用例、验证并修改预期
1. 升降级，验证升级后dblink功能在分布式是否可以使用，系统表，动态视图是否正常。
1. 扩缩容，验证dblink元数据在新扩容节点是否可以查看以及dblink在扩容节点是否可以使用。（等开发提供新包，目前受DDL操作分发未执行影响，新添加节点dblink元数据缺失）
    1. CN扩容
    1. DN组扩容
1. 导入导出，验证dblink元数据在导出、导入后是否可用。
1. 手动测试：TPCH - 改写TPCH的22条SQL，将region、nation、supplier和customer放在yashanDB，其余表放在Oracle


## 4.3 可靠性测试

1. 执行创建、删除、修改DBLink过程中CN异常 
    1. 执行节点CN异常
    1. 其他节点CN异常
1. 执行创建、删除、修改DB Link过程中MN异常
1. 执行创建、删除、修改DB Link过程中DN异常
1. 执行创建、删除、修改DB Link后MN、DN倒换
1. 需要确认下：是否在KT、主备倒换、升降级工程用例里添加dblink就可以还是框架需要增加Oracle数据库的支持。


# 5. 文本用例

新增功能用例：39个

交叉功能用例：5个

可靠性用例：4个

# 6.   **测试框架设计**

本次测试采用Guider测试框架实现功能用例，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群、分布式|


# 8. 评审意见：

1) rownum、limit是否会下发到Oracle，需要测试用例覆盖

2) Oracle不支持的函数，下发，需要报错

3) 同义词分布式不支持，存储过程和sequence 待定。

4) 转测时间：未定, 测试先写用例。