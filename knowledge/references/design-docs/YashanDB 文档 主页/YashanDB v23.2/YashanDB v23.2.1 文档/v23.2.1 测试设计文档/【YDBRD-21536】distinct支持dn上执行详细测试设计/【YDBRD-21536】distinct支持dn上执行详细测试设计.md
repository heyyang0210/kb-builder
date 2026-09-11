Created by 孔珂煜, last modified on 十二月 15, 2023

# **distinct支持dn上执行功能测试设计**

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR：    [YDBRD-21536](https://jira.yasdb.com/browse/YDBRD-21536?src=confmacro)    -  Distinct支持DN上执行  完成

在优化器中补全两阶段distinct与单dn hash路径

# 2. 需求分析

## 2.1 功能点分析

distinct三个路径：

![](https://conf.yasdb.com/download/attachments/133585309/image2023-11-2_19-9-58.png?version=1&modificationDate=1698923135000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY4MzgsImV4cCI6MTc4MjMwNzYzOH0.AFBanhIRVOfnRGMtNbdlldFlI5E6x-SCNBY4I-Gb33Y)

## 2.2 应用场景

- 不包含分布键，数据量大，distinct值少，选择第三种路径
- 包含分布键，选第二种路径
- distinct都会走到这三种路径，选择一种最简单的出来


## 2.3 规格约束

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用场景法、等价类进行测试

- 对distinct处理的列类型，表类型采用等价类法
- 对数据来源，数据分布，使用的DML操作等采用场景法


## 3.2 详细测试设计

|系统级DFX分类|是否涉及|测试点|
|:---|:---|---|
|CT|是|- distinct下推至dn并发执行
|
|KT|是|- distinct下推至dn并发执行
|
|长稳|/|  
|
|一致性|/|  
|
|三方测试工具    
  (sqltest，sqlancer)|/|  
|
|安全|/|  
|
|DFR|/|  
|
|HA|/|  
|
|压力|/|  
|
|性能|Y|选出第二种第三种的情况和master测性能有提升|
|可维护性|/|  
|


|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|分布键列    
    
    
    
|分区键,- 一级分区键
- 二级分区键
- 一级二级分区键组合(list,range,hash)
- 二级分区个数(10个，20个）对比分区个数不同的性能
|  
|  
|  
|
||分布键|  
|  
|  
|
||分布键子集|  
|  
|  
|
||包含分布键|  
|  
|  
|
||非分布键|  
|  
|  
|
|列类型    
    
|普通列|  
|  
|  
|
||索引列,- 索引类型：主键，唯一键
|  
|  
|  
|
||表达式列,- 函数列
- 聚合函数列（distinct count(*), count(distinct *)
- 窗口函数列
|  
|  
|  
|
||常量|  
|  
|  
|
||sysdate，systimestamp|  
|  
|  
|
||伪列：rownum，level|  
|  
|  
|
||重复投影列：c1,c1|  
|  
|  
|
||自定义函数|  
|  
|  
|
||高级包：dbms_random，,dbms_metadata.get_ddl等|  
|  
|  
|
||特殊值：null|  
|  
|  
|
||外部引用列|  
|  
|  
|
||子查询,- 关联子查询
- 非关联子查询
|  
|  
|  
|
||case...when...|  
|  
|  
|
|表类型    
    
|分布表|  
|  
|  
|
||复制表|  
|  
|  
|
||系统表|  
|  
|  
|
|数据分布|distinct值数量,- distinct值数量少
- distinct值数量多
|  
|  
|  
|
|数据来源    
    
|单表|  
|  
|  
|
||join,- inner join
- left join
- right join
- full join
|  
|  
|  
|
||子查询,- in 子查询
- exists子查询
- any，all，some子查询
- > , < 子查询
|  
|  
|  
|
|DML    
    
    
    
    
|insert...select,update,delete|  
|  
|  
|
||create table as select|  
|  
|  
|
||case when|  
|  
|  
|
||group by|  
|  
|  
|
||limit offset|  
|  
|  
|
||cte|  
|  
|  
|
||order by|  
|  
|  
|
||union,union all, intersect, intersect all, minus, minus all|  
|  
|  
|
|并行|- 分布式并行
- 单机并行
|  
|  
|  
|
|distinct算子|hash distinct,sorted distinct,sort distinct|  
|  
|  
|
|统计信息|收集统计信息,- 数据倾斜性能有提升
|  
|  
|  
|
|绑定参数|  
|  
|  
|  
|
|DFX|性能：大数据量性能对比,100w数据量，distinct值数量少，执行性能对比|  
|  
|  
|
|  
|CT/KT:,- distinct下推至dn并发执行
|  
|  
|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 使用Guider


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

  


# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：2023-11-24

*会议纪要*

*时间：2023-11-10 10:30 ~ 2023-11-10 11:30*

*地点：26座 1012*

*与会人：吴煜，谭思宇，孔珂煜，李攀，许秋莹，陈伟旭*

*补充：性能和master对比*

  


## Attachments:

[distinct下推到dn.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzJhMWFkOWEzMzExZGM4NTNmIiwicmVmX2lkIjoiNjczOTZiYzI1OTNmOTljOWZmMjM2NmJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODM4LCJleHAiOjE3ODIzODMyMzh9.NULo0GMjWzNlCOigp6xr_UAvSEZp4rb5UjPCfI3YvIM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[distinct下推到dn.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzI4OTcwYzJhZjRmNTIwNmM5IiwicmVmX2lkIjoiNjczOTZiYzI1OTNmOTljOWZmMjM2NmJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODM4LCJleHAiOjE3ODIzODMyMzh9.eAWvI5zsuqriYLgqlwCDIA8yvYLvYomYZcTW7_B9vXo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[distinct下推到dn.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzI4OTcwYzJhZjRmNTIwNmNhIiwicmVmX2lkIjoiNjczOTZiYzI1OTNmOTljOWZmMjM2NmJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODM4LCJleHAiOjE3ODIzODMyMzh9.Hnk7TVvIQ96Y6_mEc5iybjcJDScjmrZ7Pc72cTbYrm0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[distinct下推到dn.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzJhMWFkOWEzMzExZGM4NTQwIiwicmVmX2lkIjoiNjczOTZiYzI1OTNmOTljOWZmMjM2NmJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODM4LCJleHAiOjE3ODIzODMyMzh9.suC9Uv8aaNWOh3XeWBlZFwX39dZVdWmwr1aI4eooW5I)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
