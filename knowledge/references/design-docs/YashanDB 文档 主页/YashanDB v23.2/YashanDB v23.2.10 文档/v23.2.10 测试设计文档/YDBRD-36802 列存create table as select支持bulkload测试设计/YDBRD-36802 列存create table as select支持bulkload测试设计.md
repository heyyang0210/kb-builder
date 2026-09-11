#   [1. 概述](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  

本文描述列存create table as select支持bulkload测试设计文档





SR链接:  [ ](https://pingcode.yasdb.com/pjm/items/6766340e64bf51159818a90b?)  

  [https://pingcode.yasdb.com/pjm/items/6766340e64bf51159818a90b?](https://pingcode.yasdb.com/pjm/items/6766340e64bf51159818a90b?)  

#YDBRD-36802 列存create table as select支持bulkload

开发设计文档：  [(2070) 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/677b91a3ea9f2a287093e9d1/edit)  

  


#   [2. 需求分析](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#2%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**2.1 功能点概述**

深圳卫健委电子处方功能需要支持create table as select 支持bulkload功能。  


需求范围：  
单机列存和分布式部署模式



**2.2 需求分析**

崖山数据库单机和分布式需要列存需要create table as select支持bulkload功能，  
初始方案施支持通过insert into 语句指定hint /  *+bulkload*  */方式支持bulkload功能。

当前的实现方式是通过create table as select 插入的数据默认就是冷数据。





# **3.测试设计**

## 3.1 测试设计方法

 使用等价类划分法和场景法进行测试用例设计  


## 3.2 详细测试设计

 3.2.1 详细功能用例测试点



|测试项|输入条件|有效等价类|无效等价类|备注|  
|
|:---|:---|:---|:---|:---|:---|
||单机部署|单机lsc|单机tac,单机heap|不支持插入冷数据，通过视图v$lsc_slice_stat查询，冷数据会统计行数|  
|
||select的表类型|select 是tac,create as是lsc|行列混合,select是heap表|不支持插入冷数据，通过视图v$lsc_slice_stat查询|  
|
||分布式部署|分布式lsc表-分布表,分布式lsc表-复制表|分布式tac表-分布表,分布式tac表-复制表||  
|
||单机默认lsc表插入冷数据|开启后，默认create table as select lsc表设置的就是冷数据||参数：lsc_mcol_enable 默认为false 插入的是冷数据|  
master|
|||select的表建表加上enable mcol，create as select |||  
|
||||||  
|
||故障测试|create as的过程中分布式节点故障,DN故障,CN故障||可以回滚，数据没有被insert，表被删掉|  
|
|||单机create　as select过程中中断命令||可以回滚，数据没有被insert|  
|
||select 部分|select 查询的是视图,select 查询的是系统表|||  
|
|||select　是多表关联查询|||  
|
|||||||
||分布式开启默认lsc表插入冷数据|开启后，默认create table as select lsc表设置的就是冷数据|将lsc_mcol_enable改为true，create as select 插入的不是冷数据|||
|||开启后 创建的表加enable mcol，create as select 这张表|将lsc_mcol_enable改为true，select的表数冷数据，create as select 插入的不是冷数据|预期插入的是冷数据，和select表的数据形态没关系|  
|
||select 会报错的场景|||||
||create table as select 重视||||  
|


  


3.2.2 dfx功能涉及情况说明

|测试项|是否涉及|测试点|
|:---|:---|:---|
|CT/KT|是|  
CT KT|
|长稳|-|  
|
|一致性|-|  
|
|安全|-|  
|
|HA|-|  
|
|压力|-|  
|
|性能|是|测试不同数据量的插入性能，开启默认冷数据和关闭默认冷数据对比性能差距，,100w,1000w,1亿数据量|
|资料|否||


  


  


# 4. 测试用例

  


# 5. 测试框架设计

- 采用guider测试框架进行用例自动化


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机 列存，分布式|


# 7. 工作量评估

工作量：0.5  *人/周*

计划测试完成时间：2025/2/13

  




会议纪要：

create as和分布式gv视图查sql相关语句一起并发，多加几组

select 报错场景  


与会人员：李攀，施新华，廖增康

会议时间 ：2025.2.11