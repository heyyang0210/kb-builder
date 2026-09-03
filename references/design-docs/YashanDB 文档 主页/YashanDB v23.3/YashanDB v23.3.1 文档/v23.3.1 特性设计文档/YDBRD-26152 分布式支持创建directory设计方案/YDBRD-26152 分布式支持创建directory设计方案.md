Created by 廖增康, last modified on 八月 08, 2024

  


SR链接:     [https://pingcode.yasdb.com/pjm/items/6618df38fd997db58ad81afe](https://pingcode.yasdb.com/pjm/items/6618df38fd997db58ad81afe)    ?    
  #YDBRD-26152 分布式支持创建directory

  


##   [1. 总述](#1-总述)  

分布式数仓需求需要支持insert into select from 外部表能力，分解需求，当前分布式需要支持创建directory和外部表功能作为前提。

###   [1.1 需求来源](#11-需求来源)  

分布式数据仓需求。

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=159440886](https://conf.yasdb.com/pages/viewpage.action?pageId=159440886)  

###   [1.3 需求分析](#13-需求分析)  

分布式数据库系统需要支持创建Directory对象和删除Directory对象功能.

- 单机已经支持Directory对象创建和删除功能.
- 分布式DDL二阶段提交流程调用单机存储接口实现Directory对象管理。
- 复用单机新增    `create any directory`    和    `drop any directory`    权限。
- 在线扩容元数据迁移任务需要支持Directory对象元数据迁移。
- 单机Directory对象管理方案设计文档:     [https://conf.yasdb.com/display/YAS/DIRECTORY](https://conf.yasdb.com/display/YAS/DIRECTORY)  


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

```
syntax::= CREATE [OR REPLACE] DIRECTORY directory_name AS "path_name"

syntax::= DROP DIRECTORY directory_name

```

##   [3. 规格与约束](#3-规格与约束)  

|约束||
|---|---|
|分布式与单机实现一致，创建目录时不对路径是否存在做判断，需要在使用该目录时再做判断||
|创建Directory当前只支持绝对路径，不支持相对路径，远程路径||
|不允许使用父目录||
|默认用户为sys且不能修改||
|路径最大长度为4000||
|在线扩容只迁移Directory元数据信息，如果扩容CN/DN节点不存在系统路径，使用Directory会报错||


##   [4. 特性](#4-特性)  

###   [4.1 创建Directory](#41-创建directory)  

1. MN节点添加DDL执行函数: execCreateDirectoryEntry()。
1. cn/dn节点添加DDL执行函数: execCreateDirectoryCtx()。
1. 添加并发控制分布式对象锁函数，使用对象oid作为唯一key.
1. dir$添加version字段，记录对象版本号。


###   [4.2 删除Directory.](#42-删除directory)  

1. MN节点添加DDL执行函数: execDropDirectoryEntry()。
1. cn/dn节点添加DDL执行函数: execDropDirectoryCtx()。
1. 添加并发控制分布式对象锁函数，使用对象oid作为唯一key.


###   [4.3 分布式DDL异常推送恢复](#43-分布式ddl异常推送恢复)  

1. dir$添加version字段，记录对象版本号。
1. 对象使用oid和version字段作为DDL可重入校验，version字段用来判断Replace是否已经执行过。
1. 添加推送兼容校验处理函数: verifyCreateDirectoryCtx();verifyDropDirectoryCtx();


###   [4.4 在线扩容元数据迁移任务](#44-在线扩容元数据迁移任务)  

1. Directory对象不依赖其他对象，外部表依赖Directory对象，所以迁移顺序是在table表前面迁移Directory对象.
1. 在anlGetTransportAllMeta函数添加 anlGetTransportDirectoryDDL元数据导出处理函数。
1. 新增Transport Directory 元数据导出命令。
1. 元数据迁移只迁移元数据信息，如果扩容CN/DN节点不存在系统路径，扩容节点访问Directory会报错。


###   [4.5 Directory系统表DIR$字段列新增:](#45-directory系统表dir字段列新增)  

|字段|类型|是否非空|说明|是否新增字段|
|---|---|---|---|---|
|OBJ#|BINARY_BIGINT|是|Directory对象oid|否|
|OS_PATH|VARCHAR(4000)|否|Directory地址|否|
|VERSION|BINARY_BIGINT|否|Directory对象版本号|是|


DIR$系统表新增字段，需要更新升级sql文件。

###   [4.6 分布式DDL权限](#46-分布式ddl权限)  

1. 复用单机新增    `create any directory`    和    `drop any directory`    权限功能。
1. 只有拥有    `create any directory`    权限的用户才能创建Directory。
1. 只有拥有    `drop any directory`    权限的用户才能删除Directory。


###   [4.7 特性周边配合](#47-特性周边配合)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 创建Directory成功成功.
1. 已经存在Directory再次创建,报失败,
1. 已经存在Directory使用or replace修改路径创建成功.
1. 创建Directory使用当前系统不存在绝对路径，创建成功，使用时报错。
1. 创建Directory使用当前数据库没有权限访问目录，创建成功，使用时报错。
1. 创建Directory使用相对路径，创建失败报错。
1. 删除Directory对象成功, 系统路径不删除。
1. 异常情况下create Directory/create or replace Directory 和 drop Directory 异步推送成功，保证元数据一致性。
1. create Directory对象，执行cn扩容，新扩容cn节点有创建的Directory对象，并且元数据数据一致。
1. 执行cn扩容, 新扩容cn节点和旧cn节点不在同一台机器，并且不存在系统路径，扩容节点元数据和旧节点一致，访问Directory报错。
1. 给用户grant     `create any directory`     权限，用户能执行create directory, 给用户revoke     `create any directory`    权限，执行create directory报没有权限执行。
1. 给用户grant     `drop any directory`     权限，用户能执行drop directory, 给用户revoke     `drop any directory`    权限，执行drop directory报没有权限执行。
1.   `create any directory`    ,    `drop any directory`    权限级联测试。
1. directory审计测试。


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,1. 调研业界解决方式。 目标不存在，元数据创建使用方式。
1. 多cn 共目录部署，同时访问处理。–当前都能访问， 后续添加访问权限，先阶段创建权限有。
1. 外部表直连dn和分布式现有行为一致。
,Posted by liaozengkang at 七月 23, 2024 11:24|
|---|
|  [](null)  ,1. 新增权限自测用例，审计用例。
1.    oracle目录最大长度。
1.  是否只有sys用户才能创建还是dba用户都可以。 – 有权限都能执行
,Posted by liaozengkang at 八月 01, 2024 11:43|
