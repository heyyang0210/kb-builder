Created by 周彬鑫, last modified on 八月 13, 2024

# 1. 概述

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66192bcffd997db58ad8a622](https://pingcode.yasdb.com/pjm/items/66192bcffd997db58ad8a622)    *?*    
  *#YDBRD-26296 支持information_schema约束相关视图*

*支持INFORMATION_SCHEMA下特定的视图&系统表 CHECK_CONSTRAINTS REFERENTIAL_CONSTRAINTS TABLE_CONSTRAINTS KEY_COLUMN_USAGE*

# 2. 需求分析

## 2.1 功能点分析

- ####  TABLE_CONSTRAINTS：约束信息
- #### REFERENTIAL_CONSTRAINTS：外键信息
- ####  KEY_COLUMN_USAGE：描述哪些键有约束
- #### CHECK_CONSTRAINTS：检查约束


|字段名|含义|type|备注|
|:---|:---|:---|:---|
|CONSTRAINT_CATALOG|约束所属目录名称，始终为def|CHAR(3)|原文：,The name of the catalog to which the constraint belongs. This value is always     .       `def`  |
|CONSTRAINT_SCHEMA|约束所属用户（数据库）|VARCHAR(64)|ALL_CONSTRAINTS中owner|
|CONSTRAINT_NAME|约束名称|VARCHAR(64)|ALL_CONSTRAINTS中constraint_name|
|TABLE_SCHEMA|表所属用户（数据库）|VARCHAR(64)|ALL_CONSTRAINTS中owner|
|TABLE_NAME|表名|VARCHAR(64)|ALL_CONSTRAINTS中TABLE_NAME|
|CONSTRAINT_TYPE|约束类型，  UNIQUE，PRIMARY KEY，FOREIGN KEY或CHECK|VARCHAR(6)|yashan用U/P/R/C来标识4种约束，此外还有,视图的with read only约束（不显示）,视图的with check option约束（不显示）,UNKNOW（不显示）,ALL_CONSTRAINTS中constraint_type|


|字段名|含义|type|备注|
|:---|:---|:---|:---|
|CONSTRAINT_CATALOG|约束所属目录名称，始终为def|CHAR(3)|固定值def|
|CONSTRAINT_SCHEMA|约束所属用户（数据库）|VARCHAR(64)|ALL_CONSTRAINTS中owner|
|CONSTRAINT_NAME|约束名称|VARCHAR(64)|ALL_CONSTRAINTS中constraint_name|
|UNIQUE_CONSTRAINT_CATALOG|外键约束引用的唯一/主键约束的目录的名称，始终为def|CHAR(3)|固定值def|
|UNIQUE_CONSTRAINT_SCHEMA|外键约束引用的唯一/主键约束的用户（数据库）的名称|VARCHAR(64)|ALL_CONSTRAINTS中R_OWNER|
|UNIQUE_CONSTRAINT_NAME|外键约束引用的唯一/主键约束的名称|VARCHAR(64)|ALL_CONSTRAINTS中R_CONSTRAINT_NAME|
|MATCH_OPTION|约束MATCH属性的值，唯一有效值为NONE|CHAR(4)|原文：,The value of the constraint     attribute. The only valid value at this time is     .    `NONE`  |
|UPDATE_RULE|级联更新规则，  CASCADE，SET NULL，SET DEFAULT，RESTRICT，NO ACTION|VARCHAR(9)|yashan实现的级联更新/删除规则只有,restrict/CASCADE/SET NULL，默认no action转成restrict,  
,mysql默认规则  RESTRICT,建restrict约束会解析成no action,ALL_CONSTRAINTS中UPDATE_RULE|
|DELETE_RULE|级联删除规则，  CASCADE，SET NULL，SET DEFAULT，RESTRICT，NO ACTION|VARCHAR(9)|ALL_CONSTRAINTS中DELETE_RULE|
|TABLE_NAME|约束表名|VARCHAR(64)|ALL_CONSTRAINTS中TABLE_NAME|
|REFERENCED_TABLE_NAME|约束引用的表的名称|VARCHAR(64)|通过R_CONSTRAINT_NAME查DBA_CONSTRAINT，得到外键引用的主键的表名|


|字段名|含义|type|备注|
|:---|:---|:---|---|
|CONSTRAINT_CATALOG|约束所属目录名称，始终为def|CHAR(3)|def|
|CONSTRAINT_SCHEMA|约束所属用户（数据库）|VARCHAR(64)|ALL_CONSTRAINTS中owner|
|CONSTRAINT_NAME|约束名称|VARCHAR(64)|ALL_CONSTRAINTS中constraint_name|
|TABLE_CATALOG|表所属目录名称，始终为def|CHAR(3)|def|
|TABLE_SCHEMA|表所属用户（数据库）|VARCHAR(64)|ALL_CONSTRAINTS中owner|
|TABLE_NAME|表名|VARCHAR(64)|ALL_CONSTRAINTS中table_name|
|COLUMN_NAME|具有约束的列名，如果约束是外键，则该项为外键的列，不是外键引用的列|VARCHAR(64)|column_name|
|ORDINAL_POSITION|列在约束内的位置，从1开始编号|INTEGER|position|
|POSITION_IN_UNIQUE_CONSTRAINT|对于唯一和主键约束，该项为NULL，,对于外键约束，该项为外键约束引用的唯一/主键约束的键中序号位置,  
,  
,check约束行为？|INTEGER|通过R_CONSTRAINT_NAME查DBA_CONS_COLUMNS，获取position|
|REFERENCED_TABLE_SCHEMA|约束引用的用户（数据库）|VARCHAR(64)|通过DBA_TABLES查owner|
|REFERENCED_TABLE_NAME|约束引用的表名|VARCHAR(64)|通过R_CONSTRAINT_NAME查DBA_CONSTRAINT，得到外键引用的主键的表名|
|REFERENCED_COLUMN_NAME|约束引用的列名|VARCHAR(64)|通过R_CONSTRAINT_NAME查DBA_CONS_COLUMNS，获取colum_name|


|字段名|含义|type|备注|
|:---|:---|:---|---|
|CONSTRAINT_CATALOG|约束所属目录名称，始终为def|CHAR(3)|def|
|CONSTRAINT_SCHEMA|约束所属用户（数据库）|VARCHAR(64)|ALL_CONSTRAINTS中owner|
|CONSTRAINT_NAME|约束名称|VARCHAR(64)|ALL_CONSTRAINTS中constraint_name|
|CHECK_CLAUSE|check约束表达式|VARCHAR(4000)|ALL_CONSTRAINTS中SEARCH_CONDITION|


## 2.2 应用场景

- *支持INFORMATION_SCHEMA下特定的视图&系统表 CHECK_CONSTRAINTS REFERENTIAL_CONSTRAINTS TABLE_CONSTRAINTS KEY_COLUMN_USAGE*


## 2.3 规格约束

- TABLE_CONSTRAINT：  CONSTRAINT_CATALOG为def、CONSTRAINT_SCHEMA与  TABLE_SCHEMA 一致，都为owner
- REFERENTIAL_CONSTRAINTS：CONSTRAINT_CATALOG、MATCH_OPTION、  UNIQUE_CONSTRAINT_CATALOG  为固定值。  CONSTRAINT_SCHEMA与  TABLE_SCHEMA 一致，都为owner
- KEY_COLUMN_USAGE：CONSTRAINT_CATALOG、TABLE_CATALOG为固定值，CONSTRAINT_SCHEMA与TABLE_SCHEMA 一致，都为owner
- yashan的约束类型：  with read only、with check option在  TABLE_CONSTRAINTS中不显示
- yashan的级联更新/删除规则no action转成restrict 


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


**视图功能**

|测试点|等价类|备注|
|---|---|---|
|CHECK_CONSTRAINTS|创建check，查询CHECK_CONSTRAINTS|  
|
|  
|删除check 对应的记录删除|  
|
|  
|删表后对应的记录删除|  
|
|  
|userA下创建check，userA查询，userB查询，DBA用户查询|  
|
|  
|DBA删除userA的check，userA查询，userB查询，DBA用户查询|  
|
|  
|userA下创建check，创建并授权userB，userB查询（userB有select权限后即可查询到对应数据）,check删除后userA userB 查询均为空|  
|
|  
|userA下创建check，创建userB、userC，userA授权userB，userB授权userC、userB与userC查询视图 ,check删除后userA userB userC 查询均为空|  
|
|  
|修改check，记录更新|  
|
|REFERENTIAL_CONSTRAINTS|创建外键，查询REFERENTIAL_CONSTRAINTS|  
|
|  
|删除外键对应的记录删除|  
|
|  
|userA下创建外键，userA查询，userB查询，DBA用户查询|  
|
|  
|DBA删除userA的外键，userA查询，userB查询，DBA用户查询|  
|
|  
|userA下创建外键，创建userB，授权前userB查询不到，授权后userB能够查询到，revoke 后查询不到,  
|  
|
|  
|覆盖  UPDATE_RULE、DELETE_RULE 类型：restrict/CASCADE/SET NULL|建restrict约束会解析成no action|
|  
|约束为建表时指定|  
|
|  
|约束为建表后修改|  
|
|KEY_COLUMN_USAGE|覆盖KEY的类型：primary key、unique、foreign key|  
|
|  
|ORDINAL_POSITION字段验证，字段在key中的位置|  
|
|  
|不同user场景，在上述CHECK_CONSTRAINTS、REFERENTIAL_CONSTRAINTS覆盖时验证|  
|
|TABLE_CONSTRAINTS|覆盖约束类型：not null、unique、primary key、check、foreign key|差异：yashan not null在ALL_CONSTRAINTS中记录为check， mysql中不记录，保持与mysql一致，过滤掉not null,create table t2(id int not null,name varchar(20) unique);,![](https://pingcode.yasdb.com/atlas/files/public/67396e688970c2af4f52189c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUlFQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUlBQUFBQUFBQUFBSUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4NTksImV4cCI6MTc4MjM4MjY1OX0.MUEg6jgnP0vZJ53OAU3pDyQcELq2yI5thyyS3M2MvuI),![](https://pingcode.yasdb.com/atlas/files/public/67396e68a1ad9a3311dc970f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUlFQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUlBQUFBQUFBQUFBSUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4NTksImV4cCI6MTc4MjM4MjY1OX0.MUEg6jgnP0vZJ53OAU3pDyQcELq2yI5thyyS3M2MvuI)|
|  
|覆盖check类型：  UNIQUE，PRIMARY KEY，FOREIGN KEY或CHECK、   with read only约束（不显示）、with check option约束（不显示）|with read only约束（不显示）、with check option约束（不显示）的记录在CHECK_CONSTRAINTS中不显示|
|  
|不同user场景，在上述CHECK_CONSTRAINTS、REFERENTIAL_CONSTRAINTS覆盖时验证|  
|


**其他场景**

|测试点|等价类|备注|
|---|---|---|
|对视图进行DML操作|CHECK_CONSTRAINTS、REFERENTIAL_CONSTRAINTS、KEY_COLUMN_USAGE、TABLE_CONSTRAINTS|不允许进行DML操作,insert/delete/update|
|视图字段|desc |与mysql一致|
|查视图时带information_schema|information_schema下/非information_schema下|  
|
|查视图时不带information_schema|information_schema下/非information_schema下|非information_schema下 不带information_schema查询报错|
|视图之间联合查询|join、集合操作、filter结合|  
|
|视图名与其他对象同名|  
|  
|


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[image2024-8-10_16-49-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjg4OTcwYzJhZjRmNTIxODliIiwicmVmX2lkIjoiNjczOTZlNjg1OTNmOTljOWZmMjM4NDRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODU5LCJleHAiOjE3ODI0NTgyNTl9.czKcz0KI27A_Gkv8mDugZZTeM9Oblpjm1KzTvk7biQ4)

 (image/png)    
