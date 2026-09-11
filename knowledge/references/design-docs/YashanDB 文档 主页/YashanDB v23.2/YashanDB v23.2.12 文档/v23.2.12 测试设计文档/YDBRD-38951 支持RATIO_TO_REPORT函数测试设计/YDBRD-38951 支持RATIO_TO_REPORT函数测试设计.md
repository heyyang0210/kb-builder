#   [1. 概述](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  

本文描述RATIO_TO_REPORT函数测试设计文档

SR链接:  [ ](https://pingcode.yasdb.com/pjm/items/6766340e64bf51159818a90b?)  

  [https://pingcode.yasdb.com/pjm/items/67d148046dccc3daa31662e4?](https://pingcode.yasdb.com/pjm/items/67d148046dccc3daa31662e4?)  

#YDBRD-38951 支持RATIO_TO_REPORT函数

开发设计文档：  [https://pingcode.yasdb.com/wiki/pages/67d7e9c7529b5c0231ce73f0](https://pingcode.yasdb.com/wiki/pages/67d7e9c7529b5c0231ce73f0)  

  


#   [2. 需求分析](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#2%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**2.1 功能点概述**

华润元大基金项目要求兼容oracle RATIO_TO_REPORT窗口函数，实现崖山DB RATIO_TO_REPORT窗口函数，用于分析函数，主要用于计算某个值相对于分组内所有值总和的比率。  


需求范围：  
支持单机，分布式，集群部署方式。

只支持行执行，不支持列执行。  



**2.2 需求分析**

分析函数：

分析函数根据一组行计算聚合值。它们与聚合函数的不同之处在于它们为每个组返回多行。行组称为窗口，由 定义  `analytic_clause`  。对于每一行，都会定义一个行的滑动窗口。窗口确定用于执行当前行计算的行范围。窗口大小可以基于物理行数或逻辑间隔（例如时间）。

分析函数是查询中除最后一个  `ORDER`     `BY`  子句之外执行的最后一组操作。所有连接和所有  `WHERE`  、  `GROUP`     `BY`  和  `HAVING`  子句都在处理分析函数之前完成。因此，分析函数只能出现在选择列表或  `ORDER`     `BY`  子句中。

分析函数通常用于计算累积、移动、中心和报告聚合。

语法：

RATIO_TO_REPORT (expr) OVER ([PARTITION BY partition_by_clause] 

![image.png](https://pingcode.yasdb.com/atlas/files/public/67d9308039823f2ac1f26c11/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjMzNTEsImV4cCI6MTc4MjM3NDE1MX0.Te9n-jvZg-Ju7peR3djknSo6qqGk_6T74kNIbNFp6sI)

# **3.测试设计**

## 3.1 测试设计方法

 使用等价类划分法和场景法进行测试用例设计  


## 3.2 详细测试设计

 3.2.1 详细功能用例测试点

函数功能上只支持 partition by 语法，不支持 order by 和 window 的语法，因此只考虑 partition by 功能测试，其他不考虑；

|测试项|测试场景|
|:---|:---|
|函数功能|计算一行占所有行之和的比例，语法：,SELECT salesperson,region,sales_amount,RATIO_TO_REPORT(sales_amount) OVER () AS sales_ratio FROM test_zy;|
||计算一行在其分区内占总和的比例，语法：,SELECT salesperson,region,sales_amount,RATIO_TO_REPORT(sales_amount) OVER (PARTITION BY region) AS sales_ratio FROM test_zy;|
|参数校验|expr 的入参校验：,1、所有的数值类型--合法值,2、所有的字符串类型--非法值,3、其他类型--非法值,4、内置函数--合法值，按照常用的语法挑选几个来覆盖，聚集函数、数值处理函数,5、其他特殊值：,null--合法值，返回 null,字段之和为0,返回 null,字段之和超出字段类型范围，可以正常运算|
|与其他 sql 关键字的组合|1、排序子句---在分析函数执行之后执行，排序正确,2、其他子句，比如：join、where、group by、having 等，在分析函数之前执行，理论上不影响该函数功能，只做简单覆盖|
|部署模式|单机、分布式、集群,分布式上考虑分区键，带 px 分发的场景--计算在 join 之后，理论上应该也没啥问题|
|执行|1、行执行,2、列执行 ---报错|
|性能|1000w 或者 100w 的数据量按照函数功能，跟 oracle 进行性能比对|
|客户场景测试||
|窗口函数的 2 个算子测试|1、window sort,2、window nosort|


  


3.2.2 dfx功能涉及情况说明

|测试项|是否涉及|测试点|
|:---|:---|:---|
|CT/KT|否|  
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
|性能|是|1000w 或者 100w 的数据量按照函数功能，跟 oracle 进行性能比对|
|资料|是||


  


  


# 4. 测试用例

  


# 5. 测试框架设计

- 采用guider测试框架进行用例自动化


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群、分布式|


# 7. 工作量评估

工作量：0.5  *人/周*

计划测试完成时间：2025/3/20

会议纪要：

会议纪要： 

参会人员: 罗继鸿，冯皓博，钟金健，赵育

补充如下2个测试场景：

1、客户场景补充测试

2、覆盖2个窗口函数算子：window sort & window nosort