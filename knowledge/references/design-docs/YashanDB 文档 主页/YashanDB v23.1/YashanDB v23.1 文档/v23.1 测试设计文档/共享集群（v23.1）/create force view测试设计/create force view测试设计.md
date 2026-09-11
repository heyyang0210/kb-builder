Created by 卢凯舜, last modified on 二月 24, 2023

# 1. 概述

本文描述create view支持force 和支持read only的语法的测试设计

# 2. 需求分析

- 可以通过create force table强制创建视图，不管基表是否存在都会自动创建改视图
- with read only在该视图上不能进行任何DML操作


# 3. 测试设计方法

对本测试设计使用的工程方法做说明，主要使用等价类相关的策略

语法图

![](https://pingcode.yasdb.com/atlas/files/public/673969ad8970c2af4f51f9d7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBUUFBQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgzMDEsImV4cCI6MTc4MjIxOTEwMX0.yT9t6bkW7OxwR9RkwV3y5WRFB3Vt8dQu8gqcaHn9Lwo)

3.1整体等价类划分

create force view 设计

|输入条件|有效等价类|编号|  
,无效等价类|编号|
|---|---|---|---|---|
|权限|对象有权限|  
|  
|  
|
|  
|视图owner对依赖对象无权限|  
|  
|  
|
|别名|不使用别名|  
|别名重复|  
|
|  
|正常使用别名|  
|使用关键字、已有对象名称、以数字或特殊字符开头|  
|
|视图嵌套|嵌套视图|  
|  
|  
|
|  
|嵌套子查询|  
|  
|  
|
|  
|混合嵌套|  
|  
|  
|
|关键字|大小写组合|  
|关键字缺失、关键字拼写错误|  
|
|  
|小写|  
|表名 【使用关键字、已有对象名称、以数字或特殊字符开头】|  
|
|  
|大写|  
|  
|  
|
|表空间|默认表空间|  
|  
|  
|
|  
|自定义表空间|  
|  
|  
|
|表数据量|0行|  
|  
|  
|
|  
|结果集 10行|  
|  
|  
|
|  
|结果集 100w行|  
|  
|  
|
|表列个数|10列|  
|  
|  
|
|  
|100列|  
|  
|  
|
|as select|原表存在|  
|缺省|  
|
|  
|原表不存在|  
|  
|  
|
|<from>|普通表|  
|  
|  
|
|  
|派生表|  
|  
|  
|
|  
|分区表|  
|  
|  
|
|  
|临时表|  
|  
|  
|
|  
|视图|  
|  
|  
|
|<where>|简单条件（>, <, =, !=, >=, <=,in,between and,exists,like）|  
|  
|  
|
|  
|复合条件（and, or）|  
|  
|  
|
|  
|不带 where|  
|  
|  
|
|指定列名|各列均存在|  
|指定列：【列名重复】【列名的数量与投影数不一致】【指定列名并指定类型】,表 列名为伪列：【rownum】【rowid】【rowscn】|  
|
|  
|各列均不存在|  
|不指定列：【select聚合函数/其他函数未使用别名】【select 表达式未使用别名】【select 常量未使用别名】【select 伪列未使用别名】|  
|
|  
|部分列存在部分列不存在|  
|  
|  
|
|结合union/union all|union|  
|  
|  
|
|  
|union all|  
|  
|  
|
|  
|不带union all|  
|  
|  
|
|结合group by，having|group by|  
|  
|  
|
|  
|group by having|  
|  
|  
|
|  
|不带 group by|  
|  
|  
|
|结合order by|order by desc |  
|  
|  
|
|  
|order by asc|  
|  
|  
|
|  
|不带 order by|  
|  
|  
|
|结合join|inner join|  
|  
|  
|
|  
|outer join|  
|  
|  
|
|  
|cross join|  
|  
|  
|
|  
|不带 join|  
|  
|  
|
|with read only|查询操作|  
|增删改操作|  
|
|权限|本用户|  
|  
|  
|
|  
|其他用户|  
|  
|  
|


**3.2场景设计**

**多列先建视图再建表，**

**建表后ddl，改表名，改列属性，增删表列，列数据类型，串行执行**

**1.建视图，dc的列count 为0**

**2.建表，加载表的dc**

**3.对表列操作，插入数据，不加载dc**

**4.对视图查询，reload视图dc**

**5.对表修改操作（**  **改表名，改列属性，增删表列，列数据类型**  **）**

**6.对视图查询，reload视图dc，**  **重编译**

**并行场景：56并行**

**列数超过32，最好36**

  


# 4. 详细测试设计

# 5. 测试用例设计

# 6. 测试框架设计

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[create force view.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWRhMWFkOWEzMzExZGM3ODRiIiwicmVmX2lkIjoiNjczOTY5YWM1OTNmOTljOWZmMjM1MTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzAxLCJleHAiOjE3ODIyOTQ3MDF9.igUvfp0WQWrqerVFK_xfl0NJctJjBddoniXvBPDAdrg)

 (application/x-xmind)    


[image2022-8-25_20-13-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWQ4OTcwYzJhZjRmNTFmOWQ1IiwicmVmX2lkIjoiNjczOTY5YWM1OTNmOTljOWZmMjM1MTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzAxLCJleHAiOjE3ODIyOTQ3MDF9.Wok_4FF2Zl5TCGYrV22mKnAOFmgYIxxnBdCTDy9PiO0)

 (image/png)    


[image2022-8-26_10-4-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWRhMWFkOWEzMzExZGM3ODRjIiwicmVmX2lkIjoiNjczOTY5YWM1OTNmOTljOWZmMjM1MTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzAxLCJleHAiOjE3ODIyOTQ3MDF9.V1KaOXCVpHrpPOz8Ih561ld9p49gmFLitmer50c38WI)

 (image/png)    


[create force view.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWRhMWFkOWEzMzExZGM3ODRkIiwicmVmX2lkIjoiNjczOTY5YWM1OTNmOTljOWZmMjM1MTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzAxLCJleHAiOjE3ODIyOTQ3MDF9.B3i57QBUyTZm6W4A3RPlFqrqgGBjpvnD4bIcYnAHv9A)

 (application/x-xmind)    
