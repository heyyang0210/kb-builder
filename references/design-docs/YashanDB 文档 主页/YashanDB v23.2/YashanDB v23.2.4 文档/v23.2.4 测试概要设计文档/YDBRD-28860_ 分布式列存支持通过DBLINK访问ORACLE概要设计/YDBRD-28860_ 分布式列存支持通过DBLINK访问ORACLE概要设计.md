Created by 施新华, last modified on 六月 25, 2024

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

单机、集群已经支持dblink，由于嘉实基金需求，分布式也需要支持通过dblink访问远程数据库。

IR：    [https://pingcode.yasdb.com/ship/ideas/66600eef5d57e18ea9d1d1f5](https://pingcode.yasdb.com/ship/ideas/66600eef5d57e18ea9d1d1f5)    ?    
  #YASHAN-2904 多源异构数据库的联邦查询

  [https://pingcode.yasdb.com/pjm/items/66610fe7288e1978209d18fb](https://pingcode.yasdb.com/pjm/items/66610fe7288e1978209d18fb)    ?    
  #YDBRD-28860 分布式列存支持通过DBLINK访问ORACLE

分布式支持通过DBLINK访问ORACLE需要实现内容: 

1、支持单机列存通过DBLINK访问ORACLE 

2、支持分布式列存通过DBLINK访问ORACLE

 3、支持通过投影列下推到ORACLE

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

### 2.1  分布式适配DBLINK的DDL

适配在分布式下创建、删除、修改DBLINK的能力，同分布式下其他DDL，所有节点都会保存DBLINK的元数据。参考    [分布式DDL](https://conf.yasdb.com/pages/viewpage.action?pageId=141564288)    ，适配CREATE DBLINK、DROP DBLINK、ALTER DBLINK。

适配扩缩容场景下的元数据迁移，保证扩缩容后DBLINK对象元数据的一致性。参考    [元数据迁移](https://conf.yasdb.com/pages/viewpage.action?pageId=109603333)    ，增加DBLINK元数据导出命令TRANSPORT DBLINK。

语法参考：

CREATE DATABASE LINK语句用于创建一个数据库链接对象。本地当前用户通过数据库链接可以访问远程数据库中某用户的物理表数据。

  [CREATE DATABASE LINK | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20DATABASE%20LINK.html)  

ALTER DATABASE LINK语句用于修改一个数据库链接对象的信息。当前登录的本地用户可以修改数据库链接的远程用户名和用户密码。

  [ALTER DATABASE LINK | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20DATABASE%20LINK.html)  

DROP DATABASE LINK语句用于删除一个数据库链接对象。

  [DROP DATABASE LINK | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/DROP%20DATABASE%20LINK.html)  

### 2.2 分布式下通过DBLINK查询的计划生成

当前DBLINK连接ORACLE如果多个节点并发，无法保证在一个事务内，所以当前选择只在一个节点使用DBLINK访问ORACLE。当前选择CN和选择DN区别不大，故当前先实现分布式下DBLINK连接作为CN本地表，增加DBLINK TABLE的判断。

当前DBLINK TABLE增加了ROW_TABLE标记，当作ROW_TABLE。由于当前版本不支持行列混合，将DBLINK TABLE在包含列表时当作列表，走列执行；否则则走行执行。

对于分布式下DML带子查询包含DBLINK TABLE，insert/delete/update算子使用行执行器（同当前分布式下delete/update带子查询），子查询使用列执行器，添加col2row算子。

### 2.3 DBLINK对接列存，实现dblink_table_scan算子

DBLINK的表当前没有独立dc，协议实现在执行层单独实现，不走存储层。当前crab的ColScan对接存储的AnkCursor，无法直接对接DBLINK框架。

设计新增    `dblink scan operator`    和    `dblink scan cursor`    ，用于对接DBLINK框架，承载DBLINK SCAN。    `  
`  

当前DBLINK框架从远端数据库读取的数据是以DBLINK协议定义的格式保存，需要转换成dataset格式才能被crab使用。以下函数用于DBLINK拉取数据转换成dataset格式。    `  
`  

### 2.4 DBLINK投影表达式下推

1. 当前DBLINK沙箱进程拼接发给oracle的sql投影列为*，需要在协议中增加投影列列名，拼接到sql上。
1. DBLINK TABLE verify时没有生成需要扫描的列（当前用    `colBitmap`    字段记录），需要在verify补上生成，在执行时可以根据此字段获取需要扫描的列。（由于优化后可能调整需要扫描的列，当前此字段可能并不准确，可以考虑优化后再生成，本需求优先实现在verify时生成    `colBitmap`    ）


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1. 当前仅支持基础数据类型，不支持lob。
1. 当前不支持一个查询内多个节点同时使用DBLINK访问ORACLE。
1. DBLINK框架不支持多个线程共享一个连接，分布式下当前会话有未提交的DBLINK事务，则再进行包含DBLINK表的查询（包括dml子查询中包含DBLINK表），当前报错不支持，需要提交或回滚当前会话无DBLINK事务后可执行。
1. 根据数据库系统的结构，支持两种数据库链接：


- 同构数据库链接：YashanDB与YashanDB的数据库链接
- 异构数据库链接：YashanDB与Oracle的数据库链接，需要进行    [异构数据库链接配置](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E6%95%B0%E6%8D%AE%E5%BA%93%E7%AE%A1%E7%90%86/%E5%9F%BA%E6%9C%AC%E6%95%B0%E6%8D%AE%E5%BA%93%E7%AE%A1%E7%90%86/%E5%BC%82%E6%9E%84%E6%95%B0%E6%8D%AE%E5%BA%93%E9%93%BE%E6%8E%A5%E9%85%8D%E7%BD%AE)  


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

- 数据的统一管理和分析
- 数据库备份和数据迁移
- 多租户下的数据隔离和共享


##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

|测试对象|测试项|详细描述|备注|
|---|---|---|---|
|DDL    
    
    
    
|语法覆盖|CREATE /ALTER/DROP DATABASE LINK|  
|
||节点异常覆盖    
    
|执行过程CN故障，包括执行CN和其它CN故障场景|观察DDL各个节点是否最终一致|
|||MN故障倒换|观察DDL各个节点是否最终一致|
|||DN故障倒换|观察DDL各个节点是否最终一致|
||导入导出|exp/imp 元数据导入导出|  
|
||权限管理|grant   CREATE /ALTER/DROP DATABASE LINK to 用户以及角色|  
|
|||只有CN可以操作DDL，MN，DN拦截|  
|
||审计|审计对象包含DATABASE LINK|  
|
||扩容|CN扩容|扩容后查询对象|
|||DN组扩容|扩容后查询对象|
||升级|升级后  CREATE /ALTER/DROP DATABASE LINK|功能正常|
||元数据同步|与ORACLE之间迁移元数据|  
|
|DML|插入更新删除|INSERT/UPDATE/DELETE/INSERT INTO SELECT|目前分布式拦截|
||TRUNCATE|TRUNCATE TABLE|目前分布式拦截|
||DML带子查询|DML操作带子查询，本地表和远程oracle表混合|目前分布式拦截|
|DQL|全表查询|  
|  
|
||带投影列查询|  
|  
|
||带谓词列查询|  
|  
|
||join|  
|  
|
||子查询|  
|  
|
||集合查询|  
|  
|
||函数|  
|  
|
||数据类型覆盖|  
|  
|
|事务|事务一致性|通过DBLINK连接oracle操作保证数据一致性|  
|
|不同节点连接|分布式不同节点|CN，MN，DN查询|  
|
|其它|LOB|DBLINK连接ORACLE支持查看LOB数据|分布式已经添加约束|
|  
|同义词|是否  支持创建为dblink同义词|  
|
|  
|存储过程|远程调用Oracle的存储过程|  
|
|  
|SEQUENCE|是否  支持SEQUENCE|  
|
|视图|动态视图|v$DBLINK_OBJ_STAT,v$DBLINK_MEM_STAT,DBA视图|  
|


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

测试需要考虑：性能、CT、KT、一致性(事务一致性和元数据一致性)、长稳、安全性、升级

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

1. 复用现有单机用例
1. 新增用例


##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*