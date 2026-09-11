Created by 贺天欢, last modified on 十二月 26, 2023

IR链接：    [YDBRD-18546](https://jira.yasdb.com/browse/YDBRD-18546?src=confmacro)    -  分布式dbms_metadata.get_ddl支持获取列存DDL  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

本需求是市场需求，来源于深智城-大数据中枢。本需求的主要功能是获取分布式列存LSC表的建表DDL语句，方便进行数据迁移。

获取的建表DDL语句要求能够适配分布式的建表语法，能够完整还原原始的LSC表。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

本需求主要需要在原有dbms_metadata.get_ddl的基础上，适配分布式的建表语句，而分布式表又分为sharded表（分布表）和duplicated表（复制表）。

分布式建表语句和单机的主要区别在于create sharded/duplicated table、表分区partition和表空间tablespace

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

本需求针对分布式只支持LSC表，不支持HEAP表和TAC表

分布式get_ddl与单机的区别主要有以下几点：

1. create table时，分布式需要加上sharded或duplicated，  不带sharded字段（默认创建sharded表）
1. sharded表只有表空间集tablespace set，没有表空间tablespace，需要专门适配
1. sharded表不支持设置其他表空间，例如分区、索引、lob等


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

本需求主要需要在原有dbms_metadata.get_ddl的基础上，适配分布式的建表语句，而分布式表又分为sharded表（分布表）和duplicated表（复制表）。

分布式建表语句和单机的主要区别在于create sharded/duplicated table、表分区partition和表空间tablespace

本需求只支持LSC表，不支持HEAP表和TAC表

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；  本SR高级包参数的校验在老功能中已全量覆盖，本次弱化这部分测试，且可复用单机列存支持DBMS_METADATA.GET_DDL的用例  **，重点验证分布式和单机差异处的建表语法；**

可参考原有的单机列存支持DDL的测试设计：    [YDBRD-17688dbms_metadata.get_ddl支持情况](/pages/createpage.action?spaceKey=~hetianhuan&title=YDBRD-17688dbms_metadata.get_ddl%E6%94%AF%E6%8C%81%E6%83%85%E5%86%B5)  

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

- 多CN环境下，并发应对
- 分布式环境  直连不同节点（mn，cn，dn）使用get_ddl
- 不同session、ddl、dml同时、查询视图同时并发getddl操作
- 可靠性测试：getddl操作过程中kill session、getddl操作过程中kill 进程


##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略：重点验证分布式和单机差异处的建表语法*

*测试框架：guider*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

1. 测试返回的DDL语句能否成功创建分布式表，且对比系统视图，各属性是否相同
1. 使用不用权限的用户查询get_ddl，观察是否有权限问题
1. 不同节点（mn，cn，dn）使用get_ddl，是否有问题
