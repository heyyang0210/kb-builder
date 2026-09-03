Created by 廖增康, last modified on 十一月 04, 2024

SR链接:     [https://pingcode.yasdb.com/pjm/items/6618e085fd997db58ad81eb3](https://pingcode.yasdb.com/pjm/items/6618e085fd997db58ad81eb3)    ?    
  #YDBRD-26159 分布式支持insert into select from外部表

##   [1. 总述](#1-总述)  

分布式数仓需求需要支持insert into select from 外部表能力.

###   [1.1 需求来源](#11-需求来源)  

分布式数据仓需求。

###   [1.2 调研文档](#12-调研文档)  

无

###   [1.3 需求分析](#13-需求分析)  

分布式数据库系统需要支持insert into select from 外部表功能。

- 单机已经支持 insert into select from 外部表功能。
- 外部表select查询只在CN节点执行，读取外部文件扫描数据，不去DN节点执行。
- DN节点需要添加禁止外部DML执行。


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

```
   1. insert 本地表select 外部表:  insert into tb1 select * from 外部表.

```

##   [3. 规格与约束](#3-规格与约束)  

|约束||
|---|---|
|外部表只支持读取外部文件数据，分布式insert into select只支持select外部表，不支持insert 外部表||
|分布式insert into select from 外部表只支持行执行，不执行列执行|insert into select from 外部表，insert只支持行表|
|分布式insert into select from 外部表支持select，insert并行||
|分布式insert into select from 外部表，insert只支持行表的复制表，不支持分布表|分布表暂时支持hash方式分区，行执行hash分区方式还没完全支持，暂时屏蔽状态|


##   [4. 特性](#4-特性)  

###   [4.1 外部DML执行只在CN节点执行](#41-外部dml执行只在cn节点执行)  

```
1. `cboGetDstbStatusByDc` 函数中，新增表类型为`TABLE_EXTERNAL`返回nodeType为 `COD_NODE_TYPE_CN`, status为 `DSTB_SINGLETON` 只在CN单节点执行.
2. 修改`makeCoordDstbDesc`函数，增加判断表类型为`TABLE_EXTERNAL`调用函数 `makeCnSingleDstbDesc` 设置为CN单节点执行。
3. `anlGetNodeGroupListByTable` 函数中新增表类型为 `TABLE_EXTERNAL`调用函数 `anlGetLocalNodeGroup` 创建本地执行路由信息。

```

###   [4.2 insert into select from 外部表子查询支持范围](#42-insert-into-select-from-外部表子查询支持范围)  

```
1. insert into select from 外部表子查询支持 group by, order by, having，jion on子语句。
2. insert into select from 外部表子查询支持外部表 jion 数据库本地表。

```

###   [4.3 外部表限制直连DN节点执行DML](#43-外部表限制直连dn节点执行dml)  

```
1. 分布式当前未限制直连DN节点执行DML,外部表只能在CN节点执行，需要限制直连DN节点执行DML。

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|测试项目|测试步骤|用例|预期结果|备注|
|---|---|---|---|---|
|insert into select from 外部表|外部表支持子查询参考外部表测试用例||执行成功||
|insert into select from 外部表子查询与本地表jion|子查询jion参考外部表jion 复制表，一级分区表，二级分区表测试用例||执行成功||
|insert into select from 外部表子查询与系统视图jion|子查询jion参考外部表jion 系统视图测试用例||执行成功||
|insert into select from 外部表子查询与外部表jion|子查询jion参考外部表jion外部表测试用例||执行成功||
|insert into select from 外部表与外部表集合操作|子查询jion参考外部表与外部表集合操作测试用例||执行成功||
|insert into select from 外部表与本地表集合操作|子查询jion参考外部表与复制表，一级分区表，二级分区表集合操作测试用例||执行成功||
|insert into select from 外部表select并行执行|select查询设置并行执行||执行成功||
|insert into select from 外部表insert并行执行|insert设置并行执行||执行成功||
|insert into select from 外部表insert外部表|外部表只支持查询||执行失败||


测试方案设计:      [https://conf.yasdb.com/pages/viewpage.action?pageId=162989915](https://conf.yasdb.com/pages/viewpage.action?pageId=162989915)  

##   [7. 工作量评估](#7-工作量评估)  

|序号|工作项|时间(单位: 人/天)|日期|
|---|---|---|---|
|1|分布式支持Directory开发|2||
|2|分布式支持外部表开发|1||
|3|分布式支持insert into select from 外部表开发|1||
|4|分布式支持Directory功能自测|1||
|5|分布式支持外部表功能自测|2||
|6|分布式支持insert into select from 自测|2||


##   [8.资料设计章节](#8资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [9.未来规划](#9未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,1. 直连dn dml禁止. 
1. insert并行支持确认。
1. 子查询范围是: 只支持外部select 和 外部表与其他表交集。
,Posted by liaozengkang at 七月 23, 2024 11:35|
|---|
|  [](null)  ,会议辑要:    
  会议时间: 2024-07-23    
  参会人员: 罗继鸿，张锐，何金阳，何阳，廖增康    
  1. 调研业界Directory实现方式，目录不存在如何处理.    
  2. 多cn同一设备部署，创建Directory为公共目录，所有cn节点都能同时访问.    
  3. 创建外部表，sys用户直连dn节点逃生处理逻辑和现有分布式逻辑保持一致.    
  4. 直连dn节点需要禁止外部表dml执行.    
  5. 分布式当前是否支持insert into select from xxx, insert并行执行.    
  6. insert into select from 外部表子查询范围确认，需求是只支持查询外部表还是需要支持外部表与本地表各种操作(jion,集合操作等)?,Posted by liaozengkang at 七月 23, 2024 15:09|
|  [](null)  ,1. insert并行执行是否支持分布式。
,Posted by liaozengkang at 八月 08, 2024 11:43|
|  [](null)  ,会议纪要：    
  与会人：廖增康，何金阳，何阳，赵锐，赵育，罗爽，刘美秀    
  会议时间：2024/8/8 11:00-12:00    
  会议地点：1002,分布式支持外部表需求纪要信息：    
  1. insert并行执行是否支持分布式。    
  2. 行列混合执行报错。    
  3. 分布式行表限制功能，外部表也是限制。    
  4. 先添加用例，先拦截，后续放开执行。-- 不支持需要用例对应。    
  5. 分布式外部表建表与sharded和 duplicated关键词组合报错。    
  6. 分布式外部表收集统计信息报错。-- 收集外部表会报错，收集database/schema的统计信息，遇到外部表跳过。    
  7. 建普通视图查询外部表支持，行列混合--报错（创建不报错，使用报错），物化视图分布式不支持。-- 添加视图用例，查视图报错。,Posted by liaozengkang at 八月 09, 2024 09:07|
