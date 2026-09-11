Created by 徐瑶, last modified on 十月 31, 2023

# 1. 概述 

    本文描述AC对象的导入导出。

# 2. 需求分析 

SR：    [YDBRD-15263](https://jira.yasdb.com/browse/YDBRD-15263?src=confmacro)    -  【imp/exp】支持AC导入导出  完成    [YDBRD-13263](https://jira.yasdb.com/browse/YDBRD-13263?src=confmacro)    -  【imp/exp】支持AC导入导出  完成

开发文档：    [YDBRD-13263:支持AC导入导出](113971870.html)  

  


## 2.1语法

create access constraint

![](https://pingcode.yasdb.com/atlas/files/public/6739699a8970c2af4f51f961/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUJBQUFBQUFBQWdBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFZSUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUlBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFEQUFJQkNFQUFBSUVBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc2ODYsImV4cCI6MTc4MjIxODQ4Nn0.MUQmTASp2ZyOBlzjaT3aXuzyGHw27oZZUAu2K4PZ2Xw)

建立AC数据模型的语句ac_model_clause

![](https://pingcode.yasdb.com/atlas/files/public/6739699aa1ad9a3311dc77d8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUJBQUFBQUFBQWdBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFZSUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUlBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFEQUFJQkNFQUFBSUVBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc2ODYsImV4cCI6MTc4MjIxODQ4Nn0.MUQmTASp2ZyOBlzjaT3aXuzyGHw27oZZUAu2K4PZ2Xw)

## 2.2 规格限制

（1）  仅针对lsc表

（2）视图查询：DBA_ACS，DBA_AC_COLUMNS

![](https://pingcode.yasdb.com/atlas/files/public/6739699aa1ad9a3311dc77d9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUJBQUFBQUFBQWdBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFZSUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUlBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFEQUFJQkNFQUFBSUVBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc2ODYsImV4cCI6MTc4MjIxODQ4Nn0.MUQmTASp2ZyOBlzjaT3aXuzyGHw27oZZUAu2K4PZ2Xw)

![](https://pingcode.yasdb.com/atlas/files/public/6739699a8970c2af4f51f963/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUJBQUFBQUFBQWdBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFZSUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUlBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFEQUFJQkNFQUFBSUVBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc2ODYsImV4cCI6MTc4MjIxODQ4Nn0.MUQmTASp2ZyOBlzjaT3aXuzyGHw27oZZUAu2K4PZ2Xw)

  


# 3. 测试设计方法 

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计 

# 4. 详细测试设计

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|表类型|lsc,- 非分区
- 分区表
,（1）hash、指定个数,（2）range、range interval、maxvalue,（3）list、default,heap,tac|修改配置可在heap和tac表上建ac,alter system set _ENABLE_CREATE_AC_BTREE=true scope = memory;|  
|  
|
|ac_name|1.ac name,（1）英文（大小写）,（2）中文,（3）特殊字符,（4）混合等,2.名称长度1-64,3.是否带有单双引号|  
|不符合命名规范|  
|
|table_name|1.table name,（1）英文（大小写）,（2）中文,（3）特殊字符,（4）混合等,2.名称长度1-64,3.是否带有单双引号|  
|不符合命名规范|  
|
|xy_clause|（1）x to y,- x列覆盖：
,单列/多列只包含列字段,单列/多列与常数运算,多列之间进行运算,（不）指定别名（别名覆盖命名规范）,- y列覆盖：
,单列/多列只有列字段,单列/多列与常数运算,多列之间进行运算,（不）指定别名（别名覆盖命名规范）,（2）x、y相同，顺序相反|该语句用于指定AC里的x值和y值|指定相同的别名,指定别名与默认别名重复,x、y列重复，部分重复,x、y列不存在|  
|
|  
|（3）only y,y覆盖：,单列/多列只有列字段，,单列/多列与常数运算，,多列之间进行运算,（不）指定别名（别名覆盖命名规范）|  
|  
|  
|
|  
|（4）运算覆盖+-*/%|  
|  
|  
|
|  
|（5）列字段类型覆盖,数值型,字符型,日期型,布尔型,raw|  
|lob大对象型,json|  
|
|n_clause|（1）省略bound,（2）指定bound：,- 任意正整数
- 边界值  9223372036854775807
|该语句用于指定AC的边界大小|负数,null,0,浮点数,大于9223372036854775807针对导入导出|  
|
|where_clause|（1）省略,（2）过滤条件覆盖,<,<=, >,>=,=,!=,is  (not) null,(not) in,(3)单个过滤条件,多个过滤条件and，or,（4）列与常数比较，列与列比较|该语句用于设置AC数据的过滤条件|不存在的列，重复的列|  
|
|aggr_clause|（1）省略,（2）聚集函数覆盖sum，max，min，count,（3）指定单列进行聚集,- 使用单个聚合函数
- 使用多个不同的聚合函数
,（4）指定多列进行聚集,- 不同列使用相同的函数，
- 使用不同的函数
,（5）指定别名|用于指定AC列的聚集信息|除sum，max，min，count外的其他聚集函数,函数进行嵌套,对相同的列重复聚合,聚合不存在的列|  
|
|order_clause|（1）省略（默认排序）,（2）no order|指定AC的数据是否排序|  
|  
|
|ac_attr_clause|（1）省略,（2）指定表空间,- default
- 自定义表空间
|指定AC的表空间|指定的自定义表空间未指定DATABUCKET|  
|
|AC个数|单表单ac,单表多ac(不超过255),多表多ac|  
|ac个数超过255,新建AC的XY列和已有AC的XY列重复|  
|
|导入导出模式|1.导入导出方式组合：    
  （1）full模式导出，full/user/table模式导入,（2）user模式导出，full、user、table模式导入,单用户，多用户,（3）table模式导出，full、user、table模式导入,单表，多表,（4）touser模式,2.ignore=y/n, 需结合依赖对象是否存在进行测试,3.导入导出是否存在对象：,（1）用户：存在（单个、多个、1024）、不存在,（2）表：存在（单个、多个、1024）、不存在|  
|  
|  
|
|导入导出用户|1.创建ac指定所有者，导入该用户/导入另一个用户,2.  导出后将ac所属用户删除后进行导入,3.多个用户多个ac进行导入导出,4.导入导出登录用户有dba权限,5.导入导出登录用户只有create session 的权限|  
|  
|  
|
|部署模式|单机|  
|  
|  
|


# 5. 测试用例 

# 6. 测试框架设计

本次测试采用导入导出测试框架实现。

# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-6-30_16-16-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTk4OTcwYzJhZjRmNTFmOTViIiwicmVmX2lkIjoiNjczOTY5OTk3MjgyMDZlZmI5MmVmNGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3Njg2LCJleHAiOjE3ODIyOTQwODZ9.VxctWkLEpDwTBmQYqIgFbjeFB3mZ6qHU66xgjX8W4Z4)

 (image/png)    


[image2023-6-30_17-53-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTk4OTcwYzJhZjRmNTFmOTVjIiwicmVmX2lkIjoiNjczOTY5OTk3MjgyMDZlZmI5MmVmNGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3Njg2LCJleHAiOjE3ODIyOTQwODZ9.W22McGYSH-dx20mqvDlOFDyt1xgjX6wz_cRMofV1P8w)

 (image/png)    
