Created by 赖美全, last modified on 七月 26, 2023

  [YDBRD-13061](https://jira.yasdb.com/browse/YDBRD-13061?src=confmacro)    -  分布式系统对象支持指定OID  完成

IR链接：    [YDBRD-12629](https://jira.yasdb.com/browse/YDBRD-12629)  

SR链接：    [YDBRD-13061](https://jira.yasdb.com/browse/YDBRD-13061)  

##   [1. Overview（概述）](#1-overview概述)  

分布式系统表在此前版本未在创建时指定对应的object Id，此次修改将会将所有的分布式系统表在创建时指定object Id。

##   [2. Features（功能特性）](#2-features功能特性)  

对于新建库，再建库时之前未指定object Id的系统表在创建时指定系统表，id从65开始。对于更新上来的库，如未指定object Id的系统表已经存在，则将其object Id在起库时存入内存。

##   [3. Interfaces（接口）](#3-interfaces接口)  

分布式系统表在dstb_system_tables.sql文件中进行创建，相应的使用接口定义在ank_dict_api.h文件中:

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


后续新建的分布式系统表将从75开始递增下去，并使用前缀SYS_DSTB_进行定义。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

对于更新上来的数据库，若未指定objectId的系统表已存在则无法修改改系统表的oid，只能沿用其生成的oid

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

测试将对指定的分布式系统表查验其object Id。

使用sys用户连接数据库后，通过sql语句

```
select OBJECT_NAME, OBJECT_ID from DBA_OBJECTS where OBJECT_NAME = 'tabName';

```

的形式校验系统表的object Id是否正确，如查看分布式系统表GTS_INFO$可以使用如下测试语句查看其object Id是否为63:

```
select OBJECT_NAME, OBJECT_ID from DBA_OBJECTS where OBJECT_NAME = 'GTS_INFO$';

```

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  