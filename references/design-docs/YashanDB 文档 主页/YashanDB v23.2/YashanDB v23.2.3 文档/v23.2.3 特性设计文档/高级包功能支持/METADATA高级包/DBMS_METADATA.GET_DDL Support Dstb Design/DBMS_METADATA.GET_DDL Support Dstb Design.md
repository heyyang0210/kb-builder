Created by 唐嘉欣, last modified on 十二月 05, 2023

*详细设计-YDBRD-21730: DBMS_METADATA.GET_DDL Support Dstb Design（分布式dbms_metadata.get_ddl支持获取LSC列存DDL方案设计）*

* IR链接：*    [YDBRD-18546](https://jira.yasdb.com/browse/YDBRD-18546?src=confmacro)    *-*  *分布式dbms_metadata.get_ddl支持获取列存DDL*  *完成*

*SR链接：*    [YDBRD-21730](https://jira.yasdb.com/browse/YDBRD-21730?src=confmacro)    *-*  *分布式dbms_metadata.get_ddl支持获取列存DDL*  *完成*

##   [1. 总述](#1-总述)  

本需求是市场需求，来源于深智城-大数据中枢。本需求的主要功能是获取分布式列存LSC表的建表DDL语句，方便进行数据迁移。

获取的建表DDL语句要求能够适配分布式的建表语法，能够完整还原原始的LSC表。

###   [1.1 需求来源](#11-需求来源)  

产品化需求，深智城-大数据中枢。

场景：分布式dbms_metadata.get_ddl支持获取列存DDL

范围：分布式、LSC表

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=135619655](https://conf.yasdb.com/pages/viewpage.action?pageId=135619655)  

###   [1.3 需求分析](#13-需求分析)  

本需求主要需要在原有dbms_metadata.get_ddl的基础上，适配分布式的建表语句，而分布式表又分为sharded表（分布表）和duplicated表（复制表）。

分布式建表语句和单机的主要区别在于create sharded/duplicated table、表分区partition和表空间tablespace

本需求只支持LSC表，不支持HEAP表和TAC表

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|分布式部署下获取LSC表的建表DDL语句|在原有get_ddl的基础上，适配分布式的sharded表和duplicated表|否|是|
|性能|----|----|否|否|
|可用性|----|----|否|否|
|可靠性|----|----|否|否|
|可维可测|----|----|否|否|
|安全|不同权限的用户使用get_ddl|用户应该有权限对自己能够访问的表获取DDL，所以应该使用all视图|否|是|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


**sharded表与单机建表语法区别**

|语句|具体用法|sharded情况|单机情况|是否需要适配|
|---|---|---|---|---|
|建表头|create sharded table|支持|不支持|需要|
|table表空间集|tablespace set users|支持|不支持|需要|
|table表空间|tablespace users|不支持|支持|需要|
|partition表空间|partition ... tablespace users|不支持|支持|需要|
|subpartition表空间|subpartition ... tablespace users|不支持|支持|需要|
|index表空间|using index ... tablespace users|不支持|支持|需要|
|lob表空间集|lob ... store as ... tablespace users|不支持|支持|需要|
|range分区|partition by range|不支持|支持|不需要|
|list分区|partition by list|不支持|支持|不需要|


注：sharded表中，hash分区只能设置固定数量的分区个数，跟数据节点的chunk数有关；子分区除了不能设置表空间外，跟单机一样，可以range, list, hash

**duplicated表与单机的区别**

|语句|具体用法|duplicated情况|单机情况|是否需要适配|
|---|---|---|---|---|
|建表头|create duplicated table|支持|不支持|需要|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|无|----|----|----|


###   [1.5 开源依赖](#15-开源依赖)  

没有依赖的开源组件

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|----|----|否|
|SQL语法|----|----|否|
|函数|----|----|否|
|高级包|dbms_metadata.get_ddl('TABLE', '<name>', '<schema>')|支持获取分布式表的DDL语句|是|
|系统视图|----|----|否|
|动态视图|----|----|否|
|配置参数|----|----|否|
|驱动接口|----|----|否|
|错误码|----|----|否|
|告警|----|----|否|
|日志|----|----|否|


##   [3. 规格与约束](#3-规格与约束)  

- 不支持获取分布式TAC表的DDL语句
- 不输出兼容的语法，例如：basicfile|securefile，parallel_clause，cache_clause等
- 分布式并发进行DDL操作和GET_DDL时，可能会导致获取到中间状态的DDL语句
- 建议使用mn节点进行GET_DDL操作，结果更加准确，cn可能存在元数据信息同步不及时的问题


##   [4. 特性](#4-特性)  

分布式get_ddl与单机的区别主要有以下几点：

1. create table时，分布式需要加上sharded或duplicated
1. sharded表只有表空间集tablespace set，没有表空间tablespace，需要专门适配
1. sharded表不支持设置其他表空间，例如分区、索引、lob等


###   [4.1 特性设计](#41-特性设计)  

**分布式get_ddl流程图**

![](https://pingcode.yasdb.com/atlas/files/public/67396d90a1ad9a3311dc922b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzNjgsImV4cCI6MTc4MjMyMDE2OH0.wVpAb_Ezk3J3NAgHvmMSLtUwfs7JVjIhvi_Cf8CiZ4Q)

###   [4.2 特性功能点1——适配分布式建表语句](#42-特性功能点1适配分布式建表语句)  

1. 通过查询all_tables视图，获取sharded和duplicated字段，根据该字段判断table的类型
1. sharded表输出sharded，duplicated表输出duplicated
1. sharded表输出tablespace set
1. sharded表中，分区、索引、lob均不输出表空间


###   [4.3 特性功能点2——适配分布式场景](#43-特性功能点2适配分布式场景)  

1. 分布式场景下，直连DN、MN执行
1. 多CN环境下，并发应对，负载均衡


###   [4.4 特性安全设计——权限安全](#44-特性安全设计权限安全)  

用户要能够对其可访问的表进行get_ddl操作，不能对其不可访问的表进行get_ddl操作

通过查询all视图可以实现

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 测试返回的DDL语句能否成功创建分布式表，且对比系统视图，各属性是否相同
1. 使用不用权限的用户查询get_ddl，观察是否有权限问题
1. 不同节点（mn，cn，dn）使用get_ddl，是否有问题


##   [6.资料设计章节](#6资料设计章节)  

目录：开发手册/PLSQL参考手册/内置高级包/DBMS_METADATA

需要新增对分布式表的说明

##   [7.未来规划](#7未来规划)  

适配TAC表，适配新语法、新支持的表（比如临时表）

  


  


## Attachments:

[image2023-11-28_16-4-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTBhMWFkOWEzMzExZGM5MjI1IiwicmVmX2lkIjoiNjczOTZkOTA1OTNmOTljOWZmMjM3Y2Q5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzY4LCJleHAiOjE3ODIzOTU3Njh9.VqFTWDjItoUW1uUCbb07X-CeVui08kqPiP3r04LyK1g)

 (image/png)    


[image2023-11-29_10-48-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTBhMWFkOWEzMzExZGM5MjI3IiwicmVmX2lkIjoiNjczOTZkOTA1OTNmOTljOWZmMjM3Y2Q5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzY4LCJleHAiOjE3ODIzOTU3Njh9.nR-_fvf0-IiUMwxCZCMHB_EzTP1Y9CUy1vvoKHY1QzM)

 (image/png)    


[image2023-11-29_10-50-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTBhMWFkOWEzMzExZGM5MjI4IiwicmVmX2lkIjoiNjczOTZkOTA1OTNmOTljOWZmMjM3Y2Q5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzY4LCJleHAiOjE3ODIzOTU3Njh9.Xa0BBMCMx5_c4rU3uS9v1ZtS9EqLkU-Dr-RFHoDrw6s)

 (image/png)    


[image2023-11-29_10-51-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTBhMWFkOWEzMzExZGM5MjI5IiwicmVmX2lkIjoiNjczOTZkOTA1OTNmOTljOWZmMjM3Y2Q5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzY4LCJleHAiOjE3ODIzOTU3Njh9.mHogC1WG4GGFuxbi9zINz671TDVcK2ia38ygqwKKrC4)

 (image/png)    


## Comments:

|  [](null)  ,评审意见：,1. 需要考虑并发执行DDL语句和GET_DDL获取的情况
1. 分区名可能会很长，需要考虑输出长度
1. 对比单机和分布式建表语句
,Posted by tangjiaxin at 十一月 29, 2023 11:05|
|---|
|  [](null)  ,并发执行DDL语句和GET_DDL获取的情况不在本需求中考虑,clob应该能装下很长的分区名，暂不需要处理,Posted by tangjiaxin at 十二月 05, 2023 11:03|
