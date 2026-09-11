Created by 林永豪, last modified on 八月 17, 2023

  


#   [YDBRD-13333 : DB LINK PRIV/IMP/EXP/AUDIT Design（DBLINK 导入导出元数据、权限和审计能力 方案设计）](#ydbrd-13333--db-link-privimpexpaudit-designdblink-导入导出元数据权限和审计能力-方案设计)  

SR链接：    [YDBRD-13333](https://jira.yasdb.com/browse/YDBRD-13333)  

##   [1. Overview（概述）](#1-overview概述)  

本SR实现DBLINK的导入导出元数据、权限和审计能力。

参考文档：

  [权限开发指导](https://conf.yasdb.com/pages/viewpage.action?pageId=68306777)  

  [导入导出开发指导](https://conf.yasdb.com/pages/viewpage.action?pageId=100093918)  

  [审计开发指导](https://conf.yasdb.com/pages/viewpage.action?pageId=95104492)  

##   [2. Features（功能特性）](#2-features功能特性)  

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

（1）权限支持 CREATE DATABASE LINK / CREATE PUBLIC DATABASE LINK / ALTER DATABASE LINK / ALTER PUBLIC DATABASE LINK / DROP PUBLIC DATABASE LINK五种权限，权限间相互独立

（2）元数据导出支持 全库模式 和 用户模式（包括 登录用户和导出用户 相同 以及 登录用户和导出用户 不同）

（3）元数据导入，是元数据导出的逆过程，将导出文件按流形式解析得到DBLINK信息后进行元数据导入

（4）审计，对 SQL_CREATE_DBLINK / SQL_ALTER_DBLINK / SQL_DROP_DBLINK 三种SQL类型进行审计,目前只支持对操作行为的审计。注意，逻辑上分析审计public对象无意义，对比oracle表现也印证了这点，所以对于带有public语法的要做拦截。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

（1）权限

[1] 在数组gPrivilegeInfo[]中规定该系统权限的各项属性

[2] 在枚举EnPrivAuthAction中增加该新增权限对应的操作类型

[3] 在数组gPrivsDependency[]中绑定该操作对应的权限

（2）元数据导入导出

exp：增加dblink的tag，从dba_db_links/user_db_links获取信息，然后本地拼凑create语句写入到导出文件中

[1]导出增加密文形式，values关键字后面加上密文串： create xxx identified by values xxxxxxxxx(十六进制串，该密文串会转成RAW类型，转换后的RAW长度不超过264)

[2] DBA_DB_LINKS 增加密文字段

imp：将导出文件的create语句，按照tag提取，通过C驱动执行create语句

（3）审计

[1] 新增操作类型进行审计, 类型添加到审计项类型数组， 对应 CmdTypeSlotNode gSqlCmdTypeSlot[COD_AUDIT_ACTS_SIZE]

[2] 审计项语法支持, parseAudActUntil

###   [5.1 Architecture（架构）](#51-architecture架构)  

本SR是在已有功能上添加功能，见开发指导及对应架构设计。知识总结可见yashan doc。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

[1]权限grant和revoke

[2]全库/用户两种模式导出，导出后删除dblink，再导入成功

[3]创建审计后进行create/alter/drop database link，观察审计记录

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

1.对dblink的dml操作是否进行审计