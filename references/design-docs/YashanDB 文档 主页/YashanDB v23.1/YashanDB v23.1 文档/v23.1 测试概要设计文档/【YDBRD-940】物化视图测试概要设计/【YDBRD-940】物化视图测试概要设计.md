Created by 郑荃, last modified on 三月 07, 2024

IR链接：    [https://jira.yasdb.com/browse/YDBRD-940](https://jira.yasdb.com/browse/YDBRD-940)  

## 1. 需求概述

1、需求来源：

市场需求：深圳燃气  ,     华润数科  ,     华润银行

2、需求概述：

物化视图是一种特殊的物理表，“物化”(Materialized)视图是相对普通视图而言的。普通视图是虚拟表，应用的局限性大，任何对视图的查询，Oracle都实际上转换为视图SQL语句的查询。这样对整体查询性能的提高，并没有实质上的好处。和视图仅保存SQL定义不同，物化视图本身会存储数据，因此是物化了的视图。

物化视图是一种数据库内重要的关键特性，它与普通视图最大的区别是拥有一份自己的持久化数据，用以包装和保存一些复杂查询的结果集。 当后续有诉求对某种复杂查询进行分析、查询改写时，可以直接使用物化视图中的快照数据

物化视图是一个包含了查询结果集的数据库对象，主要用于：

1. 查询加速： 直接查询物化视图或通过视图进行query rewrite，通常要提供fast refresh on commit的能力
1. 一种数据复制的方式，可以提供本地访问的能力： 结合dblink，可以将远程master database的数据定期同步到本地materialized view databases，应用查询直接访问本地database，可以降低响应时间和网络负载、提升可用性
1. 提供细粒度的权限控制方式： 不直接开放master table的访问权限，通过物化视图访问特定数据集
1. 异构归档： 从交易数据异构归档为分析数据，一般是complete refresh on demand


3、部署形态：主备(单机)行表

## 2. 功能点

2.1 物化视图创建、修改、删除

**创建：**

![](https://conf.yasdb.com/download/attachments/113972889/create_materialiazed_view.GIF?version=1&modificationDate=1686553542000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQkFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBUUFBQUNBQUFFQUFBQWlBQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYzMjUsImV4cCI6MTc4MjEzNzEyNX0.4s9Hd0UpFgQaJ4iIh8v6ue6TcLXOsE-sHJNdr9vJPUU)

![](https://pingcode.yasdb.com/atlas/files/public/673969428970c2af4f51f6dd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQkFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBUUFBQUNBQUFFQUFBQWlBQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYzMjUsImV4cCI6MTc4MjEzNzEyNX0.4s9Hd0UpFgQaJ4iIh8v6ue6TcLXOsE-sHJNdr9vJPUU)

**修改：**

![](https://pingcode.yasdb.com/atlas/files/public/673969428970c2af4f51f6de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQkFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBUUFBQUNBQUFFQUFBQWlBQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYzMjUsImV4cCI6MTc4MjEzNzEyNX0.4s9Hd0UpFgQaJ4iIh8v6ue6TcLXOsE-sHJNdr9vJPUU)

**删除：**

![](https://pingcode.yasdb.com/atlas/files/public/67396942a1ad9a3311dc7552/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQkFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBUUFBQUNBQUFFQUFBQWlBQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYzMjUsImV4cCI6MTc4MjEzNzEyNX0.4s9Hd0UpFgQaJ4iIh8v6ue6TcLXOsE-sHJNdr9vJPUU)

  


2.2 物化视图全量刷新

- 创建时指定build immediate：创建完成后即刷新数据
- 创建时指定build deferred： 指创建时仅完成定义创建，不刷新数据
- 创建时指定on demand：将利用高级包功能进行手动刷新
- 创建时指定定时参数：物化视图将内置job功能定时刷新
- 创建时指定on commit：物化视图将在基表相关事务提交时刷新
- never refresh：指定后无法刷新


2.3 物化视图权限

增加四个系统权限

- CREATE MATERIALIZED VIEW
- CREATE ANY MATERIALIZED VIEW
- ALTER ANY MATERIALIZED VIEW
- DROP ANY MATERIALIZED VIEW


未支持

- on commit refresh
- enable query rewrite/GLOBAL QUERY REWRITE


2.4 物化视图导入导出

- exp命令的full=Y为全库导出，owner=xxx为指定用户导出，现在已支持物化视图在这两种模式下导出，在使用imp命令重新导入后物化视图数据保持不变
- DBMS_METADATA.GET_DDL可以获取指定object_type的DDL语句，包括  VIEW、  FUNCTION、  TRIGGER、  PROCEDURE、  PACKAGE、  TYPE、  TABLE，新增MATERIALIZED VIEW


2.5 新增视图

新增系统表

|系统表|内容说明|
|:---|:---|
|MATERIALIZED_VIEW$|物化视图基础系统表，记录物化视图相关的属性和信息|
|MV_REFOP$|根据物化视图属性而自动生成的物化视图刷新操作相关信息|
|MV_REFTIME$|记录物化视图刷新动作相关信息|
|SUM_DETAIL$|记录物化视图相关master table信息|


新增DBA视图

- DBA_MATERIALIZED_VIEWS，  对应属性可以查询DBA_MATERIALIZED_VIEWS视图


2.6 与Oracle的差异点：

- 已实现的功能应该跟oracle保持一致


## 3. 规格约束

- 分布式和集群不支持
- 基表为列存表不支持


## 4. 主要应用场景

1、应用场景：

- 查询加速： 直接查询物化视图或通过视图进行query rewrite
- 结合dblink，可以将远程master database的数据定期同步到本地materialized view databases，应用查询直接访问本地database，可以降低响应时间和网络负载、提升可用性
- 提供细粒度的权限控制方式： 不直接开放master table的访问权限，通过物化视图访问特定数据集
- 异构归档： 从交易数据异构归档为分析数据，一般是complete refresh on demand


2、关联场景：

- 各种表类型：物化视图的基表为各种表类型---  普通表、分区表、临时表、派生表、视图（普通视图、物化视图、dba视图、动态视图、force view）、cte
- 数据类型：物化视图的字段覆盖各种数据类型----整数、浮点、字符、raw、lob、rowid、时间、枚举、  自定义数据类型、ST_GEOMETRY、BOX2D
- 表空间：物化视图创建在不同类型的表空间：自定义表空间、mms、bucket、加密表空间、压缩表空间
- dblink：物化视图的基表在dblink远端
- 同义词：给物化视图创建同义词，或者给基表加同义词
- 注释：或者给物化视图创建注释，给基表加注释
- 子查询：物化视图的定义覆盖各种子查询的语法
- 统计信息：对物化视图进行统计信息收集(按列、全表)
- 并行扫描：查询物化视图的时候结合并行扫描
- 存储过程：  在存储过程中对物化视图进行select、dml操作
- 闪回：  对物化视图进行闪回dml、闪回查询、shrink table
- 回收站：  开启回收站，对物化视图truncate、drop 操作后再恢复
- HA：主机创建备机查询，以及主备倒换后的表现
- 升级：从不支持的版本升级到支持的版本
- 事务：不同隔离级别下物化视图刷新、可见性， 物化视图并发刷新数据的一致性
- 审计：对物化视图的操作是否会记录审计
- sequence：基表带sequence


## 5. 概要测试设计

### 5.1 功能测试设计

1.说明测试设计的整体思路，明确测试范围，规格限制。可以使用流程图、逻辑覆盖等方法体现测试思路。

- 对于物化视图的创建、修改和删除功能


             1、  根据view的语法规则，列出所有可能的输入，划分有效等价类和无效等价类，将有效等价类组合测试，无效等价类单独测试，该方法中会穿插使用边界值法，正交实验法

             2、子查询覆盖各种表类型、数据类型、子查询的各种语法、以及不同的扫描方式

             3、创建成功后，查询物化视图的各种视图是否正确

             4、对基表进行ddl和dml操作后查询物化视图

            5、对物化视图进行ddl和dml操作

            6、物化视图的各种约束限制是否符合预期

            7、和其他功能交互，见第四章

            8、规格：投影列、语句定义的长度、嵌套的上限

  


- *对于刷新功能*


*           1、*  针对高级包的各个参数，采用等价类划分的方式，对参数的有效等价类做组合覆盖，无效等价类单独覆盖

           2、  针对高级包刷新功能验证，主要采用场景法和错误分析法，从用户的角度出发，列出来可能存在的场景来进行覆盖

           3、  针对定时刷新，采用场景法和正交组合的方式，列出start和next所有存在的正常的时间值，并start和next的存在的正常的时间间隔做组合覆盖（异常场景在create、alter需求中覆盖）

           4、  针对on commit刷新，采用场景法，列出所有基表可能的dml和ddl场景，对基表进行修改，查看物化视图是否对应修改

           5、结合alter功能，修改刷新方式后，旧的刷新方式不生效，新的刷新方式生效

           6、基表结构或者数据发生变更后，验证各种生效方式

           7、不同的刷新方式进行组合覆盖

           8、新增的视图字段信息正确

  


- 物化视图权限


           1、  连接的用户和物化视图、基表的关系不同

                    1）连接用户、物化视图、基表都在用户A（所有操作在一个用户）

                    2）连接用户：A，物化视图A，基表C(连接用户和物化视图在一个schema)

                    3)  连接用户：A，物化视图B，基表C（所有操作都不在一个用户）

                    4)  连接用户：A，物化视图B，基表A(连接用户和基表在一个schema)

                    5)  连接用户：A，物化视图B，基表B（连接在一个用户，物化视图和基表在一个用户）

           2、直接赋权、角色赋权、public角色赋权、使用dba用户

           3、赋权和权限的回收

           4、结合alter session ，连接的session和alter session的用户权限不一

  


- 物化视图导入导出


           1、  对于  exp、imp的不同导入导出的模式进行组合覆盖

           2、对于物化视图的语法进行覆盖，覆盖不同语法路径下的导入导出

           3、DBA_MVIEWS新增字段QUERY，QUERY_LEN，REFRESH_START_DATE，REFRESH_NEXT_DATE，BUILD_MODE，JOB

           4、DBA_TAB_COLS 创建物化视图后，在DBA_TAB_COLS视图中查询不到相关的信息

           5、 get_ddl获取的语句语句跟创建的语句正确，获取的语句也可以创建成功

          

2.关键数据、测试场景的构造方法，用例自动化方法，可能涉及的测试框架说明。

- 自动化采用guider框架即可
- 对于定时刷新验证，时间可以通过 date命令修改到刷新前的时间


3.关联特性：见第四章节关联场景

4.分布式、集群、列表不支持的特性，需要考虑补充拦截用例

### 5.2 DFX测试设计

性能、高可用、CT、KT、可维护性、可测试性、一致性、长稳、安全性、升级、DFR、压力

1、高可用：  *测试点参考*    [https://conf.yasdb.com/pages/viewpage.action?pageId=85114825](https://conf.yasdb.com/pages/viewpage.action?pageId=85114825)  

2、升级：  *低版本升级上来，相关功能正常使用，新增系统表和视图显示正确*

3、一致性：  不同隔离级别下物化视图刷新、可见性， 物化视图并发刷新数据的一致性

4、长稳：长时间并发刷新和查询不会出现core

5、外部常用语法、基础功能要考虑增加稳定性用例；

6、可维可测：已满足

7、CT/KT：并发创建、修改、刷新、查询并发

## 6. 测试策略

测试覆盖策略、自动化看护策略

测试框架满足度，如果需要使用新的测试框架，或有新的测试框架需求需要提给测开组或对应TSE

|测试项|自动化|框架|详细|
|:---|:---|:---|:---|
|功能|是|yasft|  
|
|CT/KT|是|testkill|  
|
|一致性|是|consistency|  
|
|长稳|是|  
|  
|
|升级|是|  
|  
|
|HA|是|ha_regress|  
|


## 7. 后续关注(可选)

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

## Attachments:

[image2024-3-4_17-10-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDE4OTcwYzJhZjRmNTFmNmRiIiwicmVmX2lkIjoiNjczOTY5NDE3MjgyMDZlZmI5MmVmMTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MzI1LCJleHAiOjE3ODIyMTI3MjV9.Csxp5_zY20reSO1SOMZIeviq55BNSe5UxcHOFhu2_Ms)

 (image/png)    
