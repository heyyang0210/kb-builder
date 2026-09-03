Created by 刘清萍, last modified on 十月 15, 2024

# 1. 概述

开发文档：  [  支持集合操作的关联子查询解关联改join - 李坤宇 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=167159960)  

sr链接：  [  https://pingcode.yasdb.com/pjm/items/66d961608f5ee191735645ed](https://pingcode.yasdb.com/pjm/items/66d961608f5ee191735645ed)  ?#YDBRD-32507 支持集合操作的关联子查询解关联改join

测试点参考：  [  博时紧急需求测试分析 - 马文英 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=167151691)  

具体场景：

![image.png](https://pingcode.yasdb.com/atlas/files/public/677267aca1ad9a3311de5be2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTczOTcsImV4cCI6MTc4MjQ2ODE5N30._6Mby0yVWXCLh7fZDS6uk7vHFRGZBrkvavJshxwodN4)

# 2. 需求分析

## 2.1 功能点分析

#### 2.1.1 集合操作解关联改写join的两种场景

- 1.  viewscan：  **select * from t1 where exists(select**  ** 1 from(select 1 from dual));**
- 2.  集合操作：  **select * from t1 where exists(select 1 from t1 union all select 1 from t1);**


#### 2.1.2 要实现用户语句的加速执行，分为两个方面：

- 1.  支持集合操作解关联，将view中的带外部引用的filter拉出view，变为semijoin的join条件
- 2.  将semijoin转为innerjoin，并走indexed nl join（这部分原有能力已实现）


## 2.2 规格约束

- 1，filter or改union all的限制条件：  
A，filter改union的filter只能在表扫描上可以改，CTE，视图，from子查询等暂时不支持。join或者having filter上出现or，也不能更改。
B，filter中只能有一个or，or的一边是exists或者in子查询。另外一边是and或者in列表（not in暂时不支持，in列表可能有个数上限）或者比较操作符，其他的filter都暂时不支持。
- 2，集合操作解关联改join的限制条件：  
只支持一层集合操作解关联（多个union all算一层，任何其他的多个集合操作算子或者不同集合操作算子的组合，都不算一层）。
- 当前只有  in、not in、exists、not exists  四种filter支持此种改写。any all等不支持。
- view解关联时只支持当前view所以在select是  单表查询  时。


# 3. 详细测试设计

## 3.1 测试设计方法

*本测试设计主要采用等价类划分法，其中的第七部分，采用场景法进行测试。*

## 3.2 详细测试设计

#### 3.2.0 DFX测试

|系统级DFX分类|是否涉及|备注|
|:---|:---|---|
|CT|Y|1.针对下面3.2.1.1，3.2.1.2，3.2.1.4 的部分基础功能用例进行并发测试|
|KT|Y|1.针对下面3.2.1.1，3.2.1.2的部分基础功能用例进行并发测试|
|长稳|Y  
|1.针对下面3.2.1.1，3.2.1.2的部分基础功能用例补充长稳用例|
|一致性|  
N|该需求只需验证是否正常集合操作解关联改写join|
|三方测试工具    
  (sqltest，sqlancer)|N|该需求不涉及sql语法变更|
|安全|N|该需求不涉及密码和权限等安全性相关因素|
|DFR|N|该需求不涉及故障类测试|
|HA|N|该需求只需验证主节点下支持改写情况|
|压力|N|该需求不考虑压力专项|
|性能|Y|性能主要对比外场问题单语句，其余场景挑选部分覆盖|
|可维护性|N  
|不涉及易分析性/易测试性/配置管理/文档等测试|
|explain|Y|针对下面3.2.1.1，3.2.1.2，3.2.1.4 的部分基础功能用例 计划有变更 需要看护explain用例|


  


#### 3.2.1.1 解关联改写join

|运算符|个数|备注|
|---|---|---|
|只有 unionall 或者 union|1|  
|
|  
|3|  
|
|  
|5|  
|
|包含其他集合操作运算符（算两级及以上）|2|  
|
|  
|5|  
|
|  
|8  
|  
|
|单表包含view scan|**select * from t1 where exists(select**  ** 1 from(select 1 from dual));**|多表无效|
||嵌套多层||
||||
||||


#### 3.2.1.2 关联列和关联列形式

|个数|有效|无效|备注|
|---|---|---|---|
|关联列   (t1.c1 = t2.c1 |t1.c1 = t2.c1|(< <= > >= !=)|﻿  
﻿|
|﻿  
﻿|col+const = col|col = sin(col)|﻿  
﻿|
|﻿  
﻿|﻿  
﻿|﻿  
﻿|﻿  
﻿|
|关联列组合形式    (t1.c1 = t2.c1 and t1.c2 = t2.c1)---A and B|A and B|﻿  
﻿|﻿  
﻿|
|﻿  
﻿|A and (B1 and B2)|﻿  
﻿|﻿  
﻿|
|﻿  
﻿|﻿  
﻿|A and (B1 or B2)|﻿  
﻿|
|﻿  
﻿|(A1 or A2) and B|﻿  
﻿|﻿  
﻿|
|关联列个数|1|﻿  
﻿|﻿|
|﻿|2|﻿  
﻿|﻿|
|﻿|5|﻿  
﻿|﻿|
|﻿|10|﻿  
﻿|是否有限制值|
|集合操作两边关联列个数不匹配|1：2|﻿  
﻿|﻿|
|﻿|2：1|﻿  
﻿|﻿|
|﻿  
﻿|前后互为子集关系|﻿  
﻿|﻿  
﻿|
|﻿  
﻿|﻿|关联列不是一列|﻿|
|投影列个数|1、5、10|﻿  
﻿|﻿|
|﻿关联父查询的对象|﻿单表|||
||多表join|||
||view|||
||子查询|||
||cte|||
|||||


#### 3.2.1.3  filter类型覆盖（与 exist 子查询同级）

|filter|备注|
|---|---|
|比较谓词：,=、<、>、<=、 >= 、<>|  
|
|逻辑谓词：,and 、or、 not|  
|
|范围谓词：,between ...and|  
|
|空值谓词：,is null, is not null|  
|
|模式匹配谓词：,like |  
|
|in / exists subquery|多列in    
|
|any / all / some subquery|  
|
|case when|  
|




#### 3.2.1.4  exists后子查询作为整体出现位置

|位置|备注|
|---|---|
|where|  
|
|select后子查询|  
|
|create view|  
|
|create table|  
|
|having|     
|
|join on,- inner join
- full join
- left join
- right join
- t1,t2 where
|  
|
|insert、delete、update|  
|
|in|  
|
|any all some|  
|
|  
|  
|


#### 3.2.1.4  union all 连接的子查询

|子查询|有效|无效|备注|
|---|---|---|---|
|子查询构成|in|any all some||
||not in|||
||exists|||
||not exists|||
|连接子查询的个数|1||﻿  
﻿|
||2||﻿  
﻿|
|﻿  
﻿|﻿  
﻿5---  没有限制|﻿  
﻿|﻿  
﻿|
|投影列|类型转换|无法转换报错||
|连接的子查询返回的数据|子查询都返回数据|||
||子查询部分返回数据|||
||子查询都不返回数据|||
||子查询返回的数据是否存在重复------去重|||


#### 3.2.1.5  算子组合

|算子类型||
|---|---|
|distinct||
|aggr||
|group by---having||
|order by||
|窗口函数||
|回表算子-----------------回表判断条件： 投影是不是索引列 ，filter是不是索引列||
|bitmap or||








### 3.2.1.6 查询计划的正确性（*）



# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 本次测试采用yasft测试框架实现，执行sql文件，对比期望结果和实际输出结果，输出测试结果


# 6. 测试环境说明

|机器|内存|版本|数据库|
|:---|:---|:---|:---|
|192.168.18.85|31G|CentOS Linux release 7.9.2009 (Core)|开发提供安装包|


# 7. 工作量评估

工作量：5  *人天*

工作量：1人周

计划测试完成时间：2025.1.10

测试设计评审纪要

与会人：刘清萍、李坤宇、马文英、刘晓芳

评审时间：1.03 17：00-18：00

评审地点：线上腾讯会议

会议主题：支持集合操作的关联子查询解关联改join 测试设计评审



评审纪要信息：

1.关注关联列和投影列重复信息

1. 关注单表view scan 放开场景


     

评审通过与否：通过

## Attachments:

