Created by 刘大境, last modified on 十一月 06, 2024

# 1.   **概述**

本文描述  DBMS_STATS高级包gather_schema_stats函数增加一个options参数

# 2.   **需求分析**

SR链接：

  [https://pingcode.yasdb.com/pjm/items/6704adf1e489dd0868f19fee](https://pingcode.yasdb.com/pjm/items/6704adf1e489dd0868f19fee)    ?    
  #YDBRD-33465 DBMS_STATS高级包gather_schema_stats函数增加options参数

测试设计调研文档链接：

  [YDBRD-33465 DBMS_STATS高级包gather_schema_stats函数增加options参数 测试调研 - 刘大境 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=171079104)  

开发设计文档链接：

  


需求来源：/

需求描述： 

支持options参数控制统计信息收集选项：    
  GATHER：收集所有表的统计信息    
  GATHER AUTO：默认选项，由数据库决定收集的表    
  GATHER STALE：只收集无效的统计信息    
  GATHER EMPTY：只收集空的统计信息

需求范围：单机、集群、分布式

需  求规格：/

应用场景：OPTIONS 的主要目的是通过灵活的统计信息收集策略，提高数据库性能和管理效率，使 DBA 能够更好地控制数据库的优化过程。

# **3. 测试设计方法**

**(1). 表类型：**

**单机：HEAP、LSC、TAC、 普通表、分区表、**

**分布式： 复制表LSC、TAC， 分布表LSC、TAC**

**集群： 普通表、分区表**

**(2). 函数入参 大小写、相对位置变动、可选参数/无效参数(字段值缺失、为空)**

**(3). 长稳场景：DBMS_SCHEMA_STATS函数统计信息收集 ，带options=GATHER AUTO默认选项**

**(4). 并发场景：统计信息收集 设置不同OPTIONS入参选项**

**(5). HA场景： 主机切换 带业务统计信息收集+设置不同OPTIONS入参选项**

**(6). 升级场景：升级后选择默认 OPTIONS选项.**

**(7). 空表、非空表、统计信息已经失效的表、统计信息收集过的表是否更新、表上有无索引对象**

**(8).  可参考现有库上用例 DBMS_STATS.GATHER_DATABASE_STATS   OPTIONS功能一致**

**(9). 视图观测手段:  DBA_TAB_STATISTICS (表统计信息)、 DBA_TAB_COL_STATISTICS(列统计信息)、DBA_IND_STATISTICS(索引统计信息)**

### 3.1 DFX覆盖：

|系统级DFX分类|是否涉及|备注|
|---|---|---|
|CT|Y|  
|
|KT|Y|  
|
|长稳|N|  
|
|一致性|N|  
|
|三方测试工具    
  (sqltest，sqlancer)|N|  
|
|安全|N|  
|
|DFR|N|  
|
|HA|Y|  
|
|压力|N|  
|
|性能|N|  
|
|可维护性|N|  
|
|升级|Y|  
|
|资料|Y|  
|


  


# **4. 详细测试设计**

**功能测试：**

|验证点|验证场景|预期|备注说明|
|---|---|---|---|
|OPTIONS参数选项|OPTIONS有效选项：  GATHER、GATHER AUTO、GATHER STALE、GATHER EMPTY、  指定参数形式大小写，Options大小写，指定参数形式options相对位置错误、  ,指定和不指定参数形式为空例如： options => ''     options => NULL  ,  
,OPTIONS无效选项： 错别字、指定参数形式选项为空、不指定参数形式为空、选项值错别字、缺失、匿名块数据类型变量传参 、不指定参数形式options相对位置错误,declare    
  options varchar(200) := 'GATHER';    
  begin    
  DBMS_STATS.GATHER_SCHEMA_STATS('SYS', options=>GATHER);    
  end;    
  /|收集成功,  
,  
,收集失败报错|收集成功后，根据不同场景做视图查询,**DBA_TAB_STATISTICS (表统计信息) DBA_TAB_COL_STATISTICS(列统计信息)、DBA_INDE_STATISTICS(索引统计信息)**|
|指定参数得形式 和非指定参数|指定参数形式 (GATHER、GATHER AUTO、GATHER STALE、GATHER EMPTY)：,BEGIN    
  DBMS_STATS.GATHER_SCHEMA_STATS(    
  ownname => 'SYS',    
  options => 'GATHER'    
  );    
  END;    
  /,  
,不指定参数形式(GATHER、GATHER AUTO、GATHER STALE、GATHER EMPTY)：,exec DBMS_STATS.GATHER_SCHEMA_STATS('SYS','GATHER');|收集成功|  
|
|边界条件|空表上OPTIONS：  GATHER、GATHER AUTO、GATHER STALE、GATHER EMPTY,  
,失效的表OPTIONS：   GATHER、GATHER AUTO、GATHER STALE、GATHER EMPTY,  
,非空表OPTIONS：   GATHER、GATHER AUTO、GATHER STALE、GATHER EMPTY|GATHER EMPTY  空表收集成功，其它选项不报错,  
,GATHER STALE失效  表收集成功，其它选项不报错,  
,GATHER、GATHER AUTO 普通表收集成功，其它选项不报错|  
|
|性能场景|百万数据量选择默认OPTIONS  GATHER AUTO收集|收集成功、无Core|可对比不同收OPTIONS收集方式，执行时间|
|对象类场景|空表、非空表、无索引、有索引、分区表、分区索引、AC、|收集正常，无core|  
|
|统计信息收集过的表 二次收集|未删除统计信息收集、  做二次OPTIONS不同选项收集,表被清空、 轮换OPTIONS不同选项收集|报错？,删除成功，收集成功|( 不同OPTIONS选项，可能存在耗时不同）|
|表类型|分区表、 普通表(heap/lsc)  带不同OPTIONS选项收集|收集成功|TAC表类型 可忽略|
|表UPDATE/DELETE/truncate后收集|部分数据更新，全表更新、跨分区更新 覆盖不同OPTIONS选项收集 |收集成功    (update、DELETE不超过阈值,统计信息不会失效)   ,truncate后等于收集空表  |  
|
|分布式 分布表/复制表     复用单机场景|  
|  
|  
|
|集群 复用单机场景|  
|  
|  
|


# **5. DFX测试设计**

|专项|场景说明|备注说明|
|---|---|---|
|并发|前置：创建自建DBA用户下，创建普通表、分区表、5W数据量,过程：,(1) .  insert补充,(2).  统计信息收集GATHER AUTO,(3).  dba_tab_statistics视图查询,(4).  统计信息删除 ,后置：删除表|统计信息删除方式有3种，选其一即可,EXEC DBMS_STATS.DELETE_TABLE_STATS('schema_name', 'table_name'); ——指定表  统计信息删除    
  EXEC DBMS_STATS.DELETE_SCHEMA_STATS('schema_name');——指定  某个模式下所有表的统计信息删除    
  EXEC DBMS_STATS.DELETE_COLUMN_STATS('schema_name', 'table_name', 'column_name');——  删除某个表中特定列的统计信息|
|升级|自建用户普通表带唯一索引，10W数据量，   升级后  切换自建用户做统计信息收集带默认  GATHER AUTO选项|  
|
|HA|主机DML/DDL 统计信息GATHER AUTO收集，主备切换 ，新主追加数据量后 再一次  GATHER  收集，查询dba_tab_statistics视图|  
|


# **6.测试用例**

  


  


  


# **7.测试框架设计**

**功能用例添加到YTP平台上**

**DFX用例分别添加到yasft_dfx以及yasft仓上**

# **8.测试环境说明**

|服务器|  
|
|---|---|
|操作系统|LIUNX|
|部署|单机、分布式、集群|


# **9.测试工作量评估**

1人/7天

  
