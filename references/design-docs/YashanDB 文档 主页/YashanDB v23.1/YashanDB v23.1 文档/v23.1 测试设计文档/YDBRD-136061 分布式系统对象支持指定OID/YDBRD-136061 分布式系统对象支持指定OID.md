Created by 施新华, last modified on 十一月 14, 2023

# **1. 概述**

参考：    [分布式系统对象支持指定OID](119548765.html)  

SR：    [YDBRD-13061](https://jira.yasdb.com/browse/YDBRD-13061?src=confmacro)    -  分布式系统对象支持指定OID  完成

# **2. 需求分析**

## 2.1 功能介绍

对于新建库，再建库时之前未指定object Id的系统表在创建时指定系统表，id从65开始。对于更新上来的库，如未指定object Id的系统表已经存在，则将其object Id在起库时存入内存。

## 2.2 规格约束

对于更新上来的数据库，若未指定objectId的系统表已存在则无法修改改系统表的oid，只能沿用其生成的oid

# **3 详细测试设计**

测试点：通过对象查询相关视图的分布式系统表的Object id是否更正为指定值。

相关视图：

- USER_OBJECTS：  视图显示  当前用户对象信息。
- DBA_OBJECTS：  视图显示数据库中的所有对象信息。
- ALL_OBJECTS：  视图显示  当前用户可访问的所有对象信息。


涉及的分布式系统表：

- SYS_DSTB_GTS_INFO = 65
- SYS_DSTB_DATASPACE = 66
- SYS_DSTB_TABLESPACE_SET = 67
- SYS_DSTB_ROUTE = 68
- SYS_DSTB_CLUSTER_INFO = 69
- SYS_DSTB_GROUP_INFO = 70
- SYS_DSTB_NODE_INFO = 71
- SYS_DSTB_DDL_QUEUE = 72
- SYS_DSTB_DDL_LOG = 73
- SYS_DSTB_TASK = 74


备注：分布式系统表部署用户对象所创建，故当前用户对象信息不包含分布式系统表。

专项测试设计情况：

|专项|是否涉及|
|:---|:---|
|并发|否|
|可靠性|否|


# **5 测试用例**

1.查询用户对象表  USER_OBJECTS     中的分布式系统表名称和ID，查询为空。

2.查询系统对象表  DBA_OBJECTS     中的分布式系统表名称和ID  ，  确认是否为指定值

3.查询所有对象表  ALL_OBJECTS     中的分布式系统表名称和ID，确认是否为指定值

--test USER_OBJECTS specifying property OID  select     OBJECT_NAME  ,     OBJECT_ID     from     USER_OBJECTS     where     OBJECT_NAME     in     (  'GTS_INFO$'  ,     'DATASPACE$'  ,  'TABLESPACE_SET$'  ,  'ROUTE$'  ,  'CLUSTER_INFO$'  ,  'GROUP_INFO$'  ,  'NODE_INFO$'  ,  'DDL_QUEUE$'  ,  'DDL_LOG$'  ,  'TASK$'  );  --test DBA_OBJECTS specifying property OID  select     OBJECT_NAME  ,     OBJECT_ID     from     DBA_OBJECTS     where     OBJECT_NAME     in     (  'GTS_INFO$'  ,     'DATASPACE$'  ,  'TABLESPACE_SET$'  ,  'ROUTE$'  ,  'CLUSTER_INFO$'  ,  'GROUP_INFO$'  ,  'NODE_INFO$'  ,  'DDL_QUEUE$'  ,  'DDL_LOG$'  ,  'TASK$'  );  --test ALL_OBJECTS specifying property OID  select     OBJECT_NAME  ,     OBJECT_ID     from     ALL_OBJECTS     where     OBJECT_NAME     in     (  'GTS_INFO$'  ,     'DATASPACE$'  ,  'TABLESPACE_SET$'  ,  'ROUTE$'  ,  'CLUSTER_INFO$'  ,  'GROUP_INFO$'  ,  'NODE_INFO$'  ,  'DDL_QUEUE$'  ,  'DDL_LOG$'  ,  'TASK$'  );

# **5 测试框架设计**

yasft测试框架