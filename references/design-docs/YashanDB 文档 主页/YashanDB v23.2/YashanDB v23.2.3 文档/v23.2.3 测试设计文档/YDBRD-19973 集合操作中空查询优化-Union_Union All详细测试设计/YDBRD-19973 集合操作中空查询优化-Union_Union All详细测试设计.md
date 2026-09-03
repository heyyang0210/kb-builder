Created by 刘美秀, last modified on 六月 04, 2024

# 1. 概述

集合操作，部分子语句的filter恒为false，按照最优计划来说，当前子语句可以优化掉，不需要执行。可以在计划层面上将这个语句优化掉，从而可以节省执行时间。

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/6611601b579a3edb84d6c329](https://pingcode.yasdb.com/pjm/items/6611601b579a3edb84d6c329)    ?    
  #YDBRD-19973 集合操作中空查询优化-Union/Union All

  


开发设计：    [集合操作中空查询优化](https://conf.yasdb.com/pages/viewpage.action?pageId=138543395)  

测试调研：    [YDBRD-23178、YDBRD-23618 集合操作中空查询优化-Union/Union All、Minus/Intersect 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150608487)  

概要设计：    [YDBRD-23178 集合操作中空查询优化-Union/Union All概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=150608485)  

## 2.1 功能点分析

- 集合操作，优化空查询，在计划层不会生成对应的执行计划


**开发设计的主要原理**

1. 执行流程图:

![](https://pingcode.yasdb.com/atlas/files/public/67396cf18970c2af4f520f4b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUNBQUFBQUJBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ4MzgsImV4cCI6MTc4MjMxNTYzOH0.kBijzD5g0p-8rCNK8lcu1oo2FJtQnHr8UEcVc7UnDWw)

2. （1）filter阶段optmzFilter函数通过递归方式，从下往上一层层判断谓词二叉树是否为恒false，输出恒false结果，

preOptmzNullCmpFilters 函数添加判断const表达式是否恒false处理

isEmptyDSGExpr函数判断经过filter后的表达式是否恒false

（2）transform阶段对恒flase路径删减：

LOGIUNIONSIMPLIFY 逻辑转逻辑处理函数删减逻辑路径，在 gXformLogiUnionAll 逻辑转物理前添加 LOGIUNIONSIMPLIFY 转换处理.

  


如 select * from dual where 1> 0 union select * from dual where 1> 2 ; 仅保留select * from dual where 1> 0

## 2.2 应用场景

- 子句的filter恒为false，则执行计划上优化掉该子句


## 2.3 规格约束

|  
|约束|备注|
|---|---|---|
|1|update，insert，delete，merge先不支持，所有优化针对 select|  
|
|2|not exists (全量数据) 和 not in (全量数据)的anti jion恒false暂时不支持，后续优化支持|  
|
|3|单机limit 0暂时不支持绑定参数，绑定参数动态值不会判断为恒false|  
|
|4|单机场景rownum表达式恒flase不支持，后续优化支持|  
|


# 3. 详细测试设计

## 3.1 测试设计方法



字段类型：UDT

|验证项|设计方法|
|---|---|
|谓词覆盖|等价类划分法|
|算子覆盖|等价类划分法|
|子查询覆盖|等价类划分法|
|综合|场景法|


## 3.2 详细测试设计

表存储类型：tac、lsc、heap---无关，在优化阶段生成执行计划，不涉及行/列 执行/存储

表用户类型：用户表、系统表

表测试数据：null值，特殊值，中文，表情符号，重复值、边界值

谓词输入列：常量、表列–不涉及、表达式，函数

filter列所在位置–首列、非首列、分区键、二级分区键---无关，恒false 仅针对常量

  


**观测点**  ：

（1）数据的查询结果正确

（2）查看执行计划，恒faslse 子句的执行计划未打印

（3）执行计划和starrocks做对比

  


**谓词覆盖**

|  
|测试点 恒false谓词类型|测试点|备注|
|:---|:---|:---|:---|
|1|比较|>  (1 > 2),>=,<,<=,!=/<>|  
|
|2|and|a > 1 and a < 1,2 < 1 and 2 >=1,2 < 1 and 2 <=1,2 > 1 and 2 <=1,not 2 < 1 and 2 < 1,2 < 1 and not 2 < 1,2 < 1 and not 2 > 1|  
|
|3|or|2 < 1 or 2 <= 1,2 < 1 or not 2 < 1,not ( 2 < 1 or 2 > 1)|  
|
|4|exists|exists (恒false子查询)|  
|
|5|~~not exists~~|~~not exists (全量数据)~~|  
|
|6|in|in (恒false子查询)|  
|
|7|not in|~~not in (全量数据)~~,not in and 2 < 1|  
|
|8|between|between 3 and 1|  
|
|9|having|having 3 <= 2|  
|
|10|null|(null) in (null),(null) in xxx,(null) not in (null),(null) not in xxx,1 is null,null is not null|  
|
|11|boolean|where false,where false and xxx,where not(true)|  
|
|12|join|join xxx on false,join  xxx on not(true),join  xxx on 1 > 2,join xxx on 1=0|  
|
|13|like|null like null,'1' like null,null like '2'|前导like    
  非前导like|
|14|not|not 2 > 1|  
|


与union/union all组合需要删减算子:

**算子覆盖**  ： 

|  
|恒false需要删减算子名称|算子恒false场景|限制条件|备注|
|:---|:---|:---|:---|---|
|1|group by (sort算子)|  
|  
|  
|
|2|join(包含hash join,merge join, nestloops)|  
|  
|inner join, left join, right join, full join|
|3|limit|limit 0 为空场景|  
|  
|
|4|rownum|rownum小于0, 1场景|分布式不支持rownum|  
|
|4|aggregate(聚合函数)|  
|  
|AVG,COUNT,MAX,MIN,STDDEV,STDDEV_POP,STDDEV_SAMP,SUM,VAR_POP,VAR_SAMP,VARIANCE|
|5|窗口函数|  
|  
|FIRST_VALUE,LAG,LAST_VALUE,LEAD,RANK,ROW_NUMBER|
|6|order by(sort 算子)|  
|  
|  
|
|7|distinct|  
|  
|  
|
|8|topn|  
|  
|  
|
|9|with cte|  
|  
|  
|
|10|~~索引~~|  
|  
|不涉及|


  


**子查询类型覆盖**

|分类|测试点|示例|备注|
|---|---|---|---|
|查询返回的结果|标量子查询|SELECT product_name     
  FROM products     
  WHERE price > (SELECT AVG(price)+10 FROM products);|返回单个值的子查询，通常用在条件表达式|
|  
|列子查询|SELECT product_name     
  FROM products     
  WHERE category_id IN (SELECT category_id FROM categories WHERE category_name = 'Electronics');|返回一列值的子查询|
|  
|行子查询|SELECT *     
  FROM products     
  WHERE (category_id, price) IN (SELECT category_id, MAX(price) FROM products GROUP BY category_id);|返回一行值的子查询|
|  
|表子查询|SELECT *     
  FROM (SELECT product_name, price FROM products WHERE category_id = 1) AS subquery;|返回一个结果集的子查询|
|关联性|关联|select * from test1 t1 where exists(select * from test2 t2 where     [t2.id](http://t2.id)     =     [t1.id](http://t1.id)    );|  
|
|  
|非关联|select * from test1 t1 where     [t1.id](http://t1.id)     = (select max(    [t2.id](http://t2.id)    ) from test2 t2);|  
|


**综合**

|测试点|预期|备注|
|---|---|---|
|CTE和主查询关联|  
|  
|
|CTE不和主查询关联|  
|  
|
|CASE ... WHEN|  
|  
|
|128层子查询嵌套|  
|变更为多个union字句|
|无union/union all 恒false|~~不会被优化~~|  
|
|union/union all 子句都为恒false|  
|  
|
|create table as select|  
|  
|
|并行查询--分布式|  
|  
|
|绑定参数|  
|  
|
|limit 4294967296|  
|  
|
|next 4294967296|  
|  
|
|无集合-单个字句为false|  
|  
|
|不同类型投影|  
|int/tinyint,date/time|


**性能**

|测试点|预期|
|---|---|
|TPCDS Q71查询|master和SR 版本做对比，SR 版本的查询耗时更短、执行计划对比|


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|是|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

冒烟：

文本：

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：2024.5.13

## Attachments:

[YDBRD-25923去除三方依赖库文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjE4OTcwYzJhZjRmNTIwZjQ2IiwicmVmX2lkIjoiNjczOTZjZjE3MjgyMDZlZmI5MmYxOGUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODM4LCJleHAiOjE3ODIzOTEyMzh9.bqLZ59-m43qhma_RdnRBEbGRhvQ9kiSeOGvUth8Aozs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjFhMWFkOWEzMzExZGM4ZGI0IiwicmVmX2lkIjoiNjczOTZjZjE3MjgyMDZlZmI5MmYxOGUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODM4LCJleHAiOjE3ODIzOTEyMzh9.Y9rCK2EB1tZP0jSooy6pMyBHH8s4QAXeacMKYtYSMK8)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjE4OTcwYzJhZjRmNTIwZjQ4IiwicmVmX2lkIjoiNjczOTZjZjE3MjgyMDZlZmI5MmYxOGUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODM4LCJleHAiOjE3ODIzOTEyMzh9.AKQ2qXTDEKtwJiN1qHekXSuPcS3aGB6dMsxFfBJLvMo)

 (application/msword)    


[集合操作中空查询优化-UnionUnion All文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjFhMWFkOWEzMzExZGM4ZGI4IiwicmVmX2lkIjoiNjczOTZjZjE3MjgyMDZlZmI5MmYxOGUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODM4LCJleHAiOjE3ODIzOTEyMzh9.-eNahzgZQvaVgFZr1GseQBaq9IQRq3FfAO7N4JGhA_c)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[sr19973_smoke.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjFhMWFkOWEzMzExZGM4ZGI5IiwicmVmX2lkIjoiNjczOTZjZjE3MjgyMDZlZmI5MmYxOGUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODM4LCJleHAiOjE3ODIzOTEyMzh9.s-RCn7rU6UP8lzo598KF-ue9oEjYCA80cK3vRz5QoZI)

 (application/octet-stream)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：廖增康，施新华，刘美秀    
  会议时间：2024/5/7 15:00-16:00    
  会议地点：1002    
  纪要信息：    
  1.部署形态：看护单机、分布式-CN生成执行计划    
  2.增加测试点：union/union all 子句都为恒false    
  3.信息同步：表存储类型tac、lsc、heap---无关，在优化阶段生成执行计划，不涉及行/列 执行/存储    
  4.信息同步：filter列所在位置–首列、非首列、分区键、二级分区键---无关，恒false 仅针对常量,Posted by liumeixiu at 五月 07, 2024 16:00|
|---|
