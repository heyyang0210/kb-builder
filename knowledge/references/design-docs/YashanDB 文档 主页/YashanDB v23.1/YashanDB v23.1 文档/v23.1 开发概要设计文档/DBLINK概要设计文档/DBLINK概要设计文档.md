Created by 王海峰, last modified on 八月 24, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-overview%E6%A6%82%E8%BF%B0)  

说明本设计方案的需求来源，需求分析，功能概要描述。参照已有商业数据库开发的特性，原则上必须有特性调研文档。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

#### (1) EBNF

CREATE   [   SHARED   ] [   PUBLIC   ]   DATABASE LINK   dblink[   CONNECT TO  {   CURRENT_USER  | user   IDENTIFIED BY   password [ dblink_authentication ]}| dblink_authentication]...[   USING   connect_string ] ;    
    
  SHARED: 共享模式；    
  PUBLIC: 公共的；    
  不指定SHARED/PUBLIC时，为私有的；    
  dblink_authentication：  AUTHENTICATED BY   user   IDENTIFIED BY   password。    
  connect_string: 网络链接属性，不考虑支持。

#### （2）  数据库链接的用户

创建链接时，您确定哪个用户应连接到远程数据库以访问数据。下表解释了数据库链接涉及的用户类别的区别：

|用户类型|描述|示例链接创建语法|
|:---|:---|:---|
|连接用户（  Connected user link  ）|该link type下用户在远端和本地数据库都有相同的用户名和密码|  `CREATE PUBLIC DATABASE LINK hq USING 'hq';`  |
|当前用户（  Current user link  ）|常用于存储过程中，B用户在存储过程执行语境中以存储过程创建者用户B的权限去访问远端数据库,暂不考虑，等和存储过程联动。|  `CREATE PUBLIC DATABASE LINK hq CONNECT TO CURRENT_USER using 'hq';`  |
|固定用户（  Fixed user link  ）|固定使用link创建时指定的用户名和密码 这样要确保在远端数据库上已经对link中的用户授权,用户名/密码是链接定义的一部分的用户。如果链接包含固定用户，则固定用户的用户名和密码用于连接到远程数据库。,**优先完成这个。**|  `CREATE PUBLIC DATABASE LINK hq CONNECT TO jane IDENTIFIED BY`         `password`         `USING 'hq';`  |


  


#### (3) 数据库链接的类型

Oracle 数据库允许您创建  私有  、  公共  和  全局  数据库链接。这些基本链接类型根据允许访问远程数据库的用户而有所不同：

|类型|所有者|描述|
|:---|:---|:---|
|PRIVATE|创建链接的用户。通过以下方式查看所有权数据：,-   `DBA_DB_LINKS`  
-   `ALL_DB_LINKS`  
-   `USER_DB_LINKS`  
|在本地数据库的特定模式中创建链接。只有私有数据库链接或模式中的 PL/SQL 子程序的所有者才能使用此链接访问相应远程数据库中的数据库对象。|
|PUBLIC|名为 PUBLIC 的用户。通过为私有数据库链接显示的视图查看所有权数据。|创建数据库范围的链接。数据库中的所有用户和PL/SQL子程序都可以使用该链接访问相应远程数据库中的数据库对象。|
|GLOBAL|暂时不做|  
|


  


#### （4）SHARED 共享模式的LINK

本地服务器进程和远程数据库之间的链接是可以多个会话共享的，暂不考虑。

  


#### (5) 数据库名称怎么链接

要了解数据库链接的工作原理，您必须首先了解什么是全局数据库名称。分布式数据库中的每个数据库都由其全局数据库名称唯一标识。数据库通过    `DB_DOMAIN`    在数据库创建时由初始化参数指定的数据库网络域加上由初始化参数指定的单个数据库名称作为    `DB_NAME`    前缀来形成全局数据库名称。

##### 模式对象和数据库链接

创建数据库链接后，您可以执行访问远程数据库上的对象的 SQL 语句。例如，要    `emp`    使用数据库链接访问远程对象    `foo`    ，您可以发出：select * from emp@foo

您还必须在远程数据库中获得授权才能访问特定的远程对象。使用数据库链接构造正确格式的对象名称是分布式系统中数据操作的一个重要方面。

##### 使用数据库链接命名模式对象

使用全局数据库名称通过以下方案全局命名模式对象：

  `schema.schema_object`    @    `global_database_name`  

-   `schema`    是数据或模式对象的逻辑结构的集合。模式由数据库用户所有，并与该用户同名。每个用户都拥有一个模式。
-   `schema_object`    是一种逻辑数据结构，如表、索引、视图、同义词、过程、包或数据库链接。
-   `global_database_name`    是唯一标识远程数据库的名称。    `DB_NAME`    此名称必须与远程数据库初始化参数和的串联相同    `DB_DOMAIN`    ，除非参数    `GLOBAL_NAMES`    设置为    `FALSE`    ，在这种情况下任何名称都可以接受。
- 查询、删除和插入数据和操作本地的数据库是一样的，只不过表名需要写成“表名@dblink服务器”而已。    select   xxx FROM 表名@数据库链接名;  


##### 访问远程模式对象的授权

要访问远程模式对象，您必须被授予访问远程数据库中远程对象的权限。

此外，要对远程对象执行任何更新、插入或删除操作，您必须被授予    `SELECT`    对该对象的特权，以及    `UPDATE`    、    `INSERT`    或    `DELETE`    特权。与访问本地对象不同，    `SELECT`    访问远程对象需要特权，因为数据库没有远程描述能力。数据库必须    `SELECT *`    对远程对象执行操作以确定其结构。

##### 模式对象的同义词

允许创建同义词，以便您可以对用户隐藏数据库链接名称。同义词允许使用与访问本地数据库中的表相同的语法来访问远程数据库中的表。

##### 先决条件

要创建私有数据库链接，您必须具有    `CREATE`         `DATABASE`         `LINK`    系统权限。

要创建公共数据库链接，您必须具有    `CREATE`         `PUBLIC`         `DATABASE`         `LINK`    系统权限。

此外，您必须    `CREATE`         `SESSION`    对远程 Oracle 数据库具有系统权限。

通过OCI  实现对oracle的远程访问。

#### （5）dblink查询调研

通过系统视图可以查询建立的dblink(  DBA_DB_LINKS/  ALL_DB_LINKS/  USER_DB_LINKS  )

select owner,object_name from dba_objects where object_type='DATABASE LINK';#查询出dba用户下的dblink

select * from user_objects t where t.object_type='DATABASE LINK'   #查询当前用户下的dblink

  


查询资料时，看到可能会产生的坑：

创建 DBLink 很简单，但是在使用中后台却出现锁，查看这个锁的方法可以去 console 中看到或者查询数据库。每次使用dblink查询的时候，均会与远程数据库创建一个连接，dblink 应该不会自动释放这个连接，如果是大量使用 dblink 查询，会造成 web 项目的连接数不够,导致系统无法正常运行，导致系统无正常运行。

  


dblink的下推到远端执行，默认均为: 构造出远端数据库可执行的SQL语句，建议用游标承载，使用oci或者jdbc的接口去prepare oracle的游标，获取结果集时利用游标的fetch。

（1）对远端数据库的表进行单表查询时，表的查询和谓词第一阶段先下推，第二阶段再考虑完整的Select Projection GroupBy Filter OrderBy等属性都可以直接下推到远端执行，这里需要注意的是表达式在远端是否具备可执行性；（作为一个异构连接，需要限定表达式的执行是满足yashandb和远端数据库都可以执行的）

（2）对远端数据库的表和本地表进行JOIN时，要拆分出远端表可执行的查询子句，已经查询子句拆分后，和本地表join的等价改写；

（3）对远端数据库1的表和远端数据库1的表进行JOIN时，需要等价改写到远端数据库的join语句，此时可以考虑通过一个游标，不需要分成2个游标；

（4）对远端数据库1的表和远端数据库2的表进行JOIN时，按远端表查询分别拆出子句。

  


统计信息如何对接？

不对接，按缺省生成计划，但dblink相关的子句改写成一个dblink表。

![](https://pingcode.yasdb.com/atlas/files/public/673969388970c2af4f51f691/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwMzAsImV4cCI6MTc4MjEzNjgzMH0.zTfXMc-NHH7aI-sjZ_o3yqwxHt5QgFh6vY8y01XR93o)

  


数据类型映射

数据类型在不同数据库之间要做一个map，大对象类型、JSON类型等无法直接考虑。

  


FILTER/表达式映射

谓词和函数表达式，判定远端数据库支持可以考虑下推；否则需要在收集结果后再本地运算。

  


**（6）dblink的事务**

对远端表产生的增、删、改操作，需要限定范围，第一阶段不适合产生复杂的，例如insert on duplicate、insert into select、insert all、update多表等语句功能；所以远端表的事务操作要求必须单库单表，否则报错。

对远端表的DML操作可以跳过校验阶段，远端表的DC没有必要拿来校验，因为校验后到下发对端的时间，DC可能发生了变更。

在yashanDB自身需要启动一个两阶段事务管理，预分配一个xid，当事务语句通过链接下发到远端数据库执行后，同步事务在远端执行情况。

|DML类型|DBLINK规划支持情况|备注|
|---|---|---|
|INSERT单表单记录|支持|  
|
|INSERT单表多记录|暂不支持|调研情况|
|INSERT ... SELECT|支持,insert 远端表 select 本地表：转成 insert远端表 values,  
,从远端表取数据过来，再走本地或远端,insert 远端表 select 远端表,insert 本地表 select 远端表|调研情况|
|INSERT ALL|暂不支持|  
|
|UPDATE单表单列|支持|不带where条件和where中带静态子查询可支持；带关联子查询不支持|
|UPDATE单表多列|支持|  
|
|UPDATE SET带子查询|暂不支持|调研情况，update dblink_a set (col1,col2) = select col1,col2 from b|
|UPDATE多表|暂不支持|调研情况|
|DELETE单表|支持|不带where条件和where中带静态子查询可支持；带关联子查询不支持|
|MERGE INTO|暂不支持|调研情况|
|DML绑定参数|支持|使用绑定参数，除了SQL语句下推，还需要绑定参数推送|
|DML绑定批插|支持|  
|


  [  
3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

create/drop dblink初步开发

alter dblink尚未开发。

  


~~dblink的远端表不能drop、alter、truncate；~~

drop dblink了才可以操作。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

从IR层级架构方案设计的说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：IR的概要设计最重要的是拆解出来SR列表。**

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#51-architecture%E6%9E%B6%E6%9E%84)  

说明方案的总体架构，IR拆解SR的阶段，需要优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

通过架构图的划分，可以较为清晰的展现SR拆解的逻辑和完全性。

###   [5.2 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#52-dfx%E8%AE%BE%E8%AE%A1)  

1. 与远端数据库连接链路的安全原则；
1. DBA_DB_LINKS视图。
1. YEX(DB)与EXT_SERVER、EXT_SERVER与远端数据库，这个链路上发生异常，如DB coredump、EXT_SERVER coredump、远端数据库断链等异常情况下的考虑；事务提交超时的异常。


###   [5.3 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#53-%E5%85%B6%E4%BB%96)  

涉及权限、审计、导入导出、主备支持。

##   [6. ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)    工作量

|任务|主要工作|输出成果|工作量(人/周)|
|:---|:---|:---|:---|
|整体调研|1. DBLINK的整体概念、功能、应用场景等；,2. DBLINK的功能细化，例如LINK类型、USER映射、DFX视图、DBLINK查询改写、DBLINK事务支持等；,3. 友商(ORACLE) DBLINK的调研，例如关键技术点、系统表设计等|调研文档|2|
|方案设计|1. 系统表、DC结构设计；2. DDL/DML能力设计，包括创建、修改、删除；3.查询重写设计|设计文档|4|
|功能开发|LINK在系统表落盘|功能完成|2|
|  
|LINK创建/LINK删除|  
|2|
|  
|DC结构定义（OpenDc到远端获取DC构建，需要有一个基于不同数据库的元数据解析）|  
|2|
|  
|DQL提取远端表查询子句，改写为QueryTable（谓词下推等单表查询功能，需要从PLAN转成SQL语句）|  
|第一阶段6|
|  
|DQL JOIN下推|不做|?|
|  
|DML事务管理|  
|第一阶段先限定单库单表，不考虑两阶段事务 4（如何考虑网络抖动，带来的超时？异常如何考虑）,是否需要直接考虑两阶段事务，需要重点讨论|
|  
|DML支持绑定参数|  
|2|
|  
|driver层OCI对接、数据类型map|  
|3|
|  
|安全相关，链路通讯、用户/密码管理（加密）和类型属性|  
|3|
|  
|用户映射、权限校验|  
|2|
|  
|DBA_DB_LINKS视图|  
|1|
|  
|链路异常处理|  
|2|
|  
|审计支持|  
|1|
|  
|导入导出元数据支持|  
|1|
|自测验证|开发自测与问题修复|特性上车|2|
|合计|  
|  
|39|


## Attachments:

[image2023-3-18_19-0-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5MzhhMWFkOWEzMzExZGM3NTA2IiwicmVmX2lkIjoiNjczOTY5Mzg3MjgyMDZlZmI5MmVmMGQxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MDI5LCJleHAiOjE3ODIyMTI0Mjl9.DZcPgMpnqyZ7yuUN1kXNPjdKGrl-XZkUndcBjL8yo3s)

 (image/png)    
