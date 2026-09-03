Created by 卢凯舜 on 十一月 03, 2023

# **1. 概述**

本文描述  insert on duplicate key测试设计

用户在某些场景下，比如向班级表每个学生插入数据时，可能该学生数据已经存在于班级表中，这时由于每个学生都有唯一ID，因此会报错，导致用户需要再去做一次update，显得多余。在这种场景下，该特性支持用户在插入时，如果发现表中已有对应数据，则更新原始数据；如果表中没有对应数据，则插入该数据。

开发设计：    [LSC支持 Insert On Duplicate Update - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119550559)      
  sr：    [YDBRD-14029](https://jira.yasdb.com/browse/YDBRD-14029?src=confmacro)    -  【2023.1】LSC支持insert into... on duplicate key update功能  完成

# **2. 需求分析**

#### 2.1语法

![](https://pingcode.yasdb.com/atlas/files/public/673969f18970c2af4f51fb45/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQUFBQUFBQUlBQUFDQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUJBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQWhBQUFBZ0FBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAyMTEsImV4cCI6MTc4MjIyMTAxMX0.A7vDPXfdbc0rzEVXocAO5jWcS26W76TXN3Rz1NHuf1M)

![](https://pingcode.yasdb.com/atlas/files/public/673969f1a1ad9a3311dc79bb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQUFBQUFBQUlBQUFDQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUJBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQWhBQUFBZ0FBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAyMTEsImV4cCI6MTc4MjIyMTAxMX0.A7vDPXfdbc0rzEVXocAO5jWcS26W76TXN3Rz1NHuf1M)

![](https://pingcode.yasdb.com/atlas/files/public/673969f1a1ad9a3311dc79bc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQUFBQUFBQUlBQUFDQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUJBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQWhBQUFBZ0FBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAyMTEsImV4cCI6MTc4MjIyMTAxMX0.A7vDPXfdbc0rzEVXocAO5jWcS26W76TXN3Rz1NHuf1M)

|  `insert_on_duplicate_key = `      `INSERT`         `[hint]  `      `INTO`         `table_reference[t_alias]  [`      `'('`      `column`      `{`      `','`      `column`      `}`      `')'`         `](subquery|values_clause) `      `ON`         `DUPLICATE `      `KEY`         `UPDATE`         `(update_set_clause{`      `','`      `update_set_clause})`      `';'`      `.`  |
|:---|


|  `update_set_clause = [t_alias`      `'.'`      `]`      `column`      `'='`      `(`      `DEFAULT`      `|expr).`  |
|:---|


#### 2.2功能

- 当插入数据没有约束冲突或表上没有约束限制时，插入这些数据
- 当插入数据有约束冲突时，用set_clause的内容更新原表的冲突数据


#### 2.3功能限制

- 不允许修改分区键（与行表一致）
- 仅支持单张表的insert（与行表一致）
- 不支持对视图操作（与行表一致）
- set_clause之后不可以出现where filter（与行表一致）
- 当表上有多个独立的唯一约束时，仅更新与原表唯一冲突的第一条记录（与行表一致）
- 唯一约束的声明顺序不同，会导致结果不稳定（与行表一致）
- 分布式set 语句中不允许出现复杂子查询


  


# **3. 测试**  **设计方法**   

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

1. 基本语法验证，使用等价类划分法测试语法格式正确性
1. 遍历基本数据类型，并结合正交法，场景法，错误推测法覆盖大部分场景
1. 重点关注表上有（无）唯一约束时，发生冲突或未发生冲突时，行为是否正常--覆盖（普通表、分区表、临时表）
1. 考虑并发场景，进行可靠性测试


#### 3.1 语法&关键字

|输入条件|  
|有效等价类|编号|无效等价类|编号|
|:---|:---|:---|:---|:---|:---|
|语法格式|insert into table_reference [t_alias]|insert into [schema .] table [t_alias]|  
|  
|  
|
|  
|  
|insert into [schema .] table PARTITION (partition) [t_alias]|  
|  
|  
|
|  
|  
|insert into [schema .] table for(partition_key_value) [t_alias]|  
|  
|  
|
|  
|values_clause|subquery|values (expr|default,...,expr|default)|  
|values (subquery,...,subquery)|  
|
|  
|  
|(column,...,column) values (expr|default,...,expr|default)|  
|values (expr,...,subquery)|  
|
|  
|  
|subquery|  
|(column,...,column) values (expr,..,subquery)|  
|
|  
|on duplicate key update update_set_clause|[t_alias.] column = (expr|default|subquery)|  
|后面+where filter|  
|
|  
|  
|[t_alias.] column = (expr|default|subquery),...,[t_alias.] column = expr|default|(subquery)|  
|set   [t_alias.] column = expr|default|(subquery)|  
|
|关键字|  
|合法关键字|  
|非法关键字|  
|
|  
|  
|大小写|  
|关键字缺失|  
|
|  
|  
|大写|  
|关键字重复|  
|
|  
|  
|小写|  
|关键字拼写错误|  
|


#### 3.2 应用场景

|输入条件|场景|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|
|是否指定schema|指定|schema存在|schema不存在|  
|
|  
|不指定|  
|  
|  
|
|目标表类型|普通表|表名存在|视图|  
|
|  
|分区表|  
|表名不存在|  
|
|  
|临时表|  
|  
|  
|
|目标表为分区表|分区类型|range分区-interval分区|  
|  
|
|  
|  
|list分区|  
|  
|
|  
|  
|hash分区|  
|  
|
|  
|分区键列数|单列|  
|  
|
|  
|  
|多列|  
|  
|
|  
|是否指定分区|指定分区|分区名不存在|  
|
|  
|  
|不指定分区|values(...) 值不在指定分区中|  
|
|  
|  
|  
|subquery值不在指定分区中|  
|
|  
|是否指定分区键值|指定|分区键值不正确|  
|
|  
|  
|不指定|values(...) 值与分区键值不在同一分区|  
|
|  
|  
|  
|subquery值与分区键值不在同一分区|  
|
|目标表数量|  
|1个|多个|  
|
|目标表约束|有|普通索引|  
|  
|
|  
|  
|主键|  
|  
|
|  
|  
|唯一键|  
|  
|
|  
|  
|外键|  
|tac不支持|
|  
|  
|not null|  
|  
|
|  
|  
|default值|  
|  
|
|  
|无|  
|  
|  
|
|  
|建表时无约束，alter table add column添加列同时添加列级约束|  
|  
|  
|
|约束是否inline|是|  
|  
|  
|
|  
|否|  
|  
|  
|
|约束个数|0个|  
|  
|  
|
|  
|1个|  
|  
|  
|
|  
|多个|主键+唯一键+其他|主键+主键+其他|唯一约束声明顺序不同，会导致结果不稳定|
|  
|  
|唯一键+唯一键+其他|  
|  
|
|insert into|插入列数|不指定列|指定列名不存在|  
|
|  
|  
|指定1个列|指定列名重复|  
|
|  
|  
|指定多个列|指定列与值数量不匹配（值数量>列数量）|  
|
|  
|  
|  
|指定列与值类型不匹配|  
|
|  
|插入行数|单行|  
|  
|
|  
|  
|多行（包含冲突或不冲突数据）|  
|  
|
|  
|插入值expr|有主键或唯一约束，expr与表中已有数据冲突|  
|  
|
|  
|  
|有主键或唯一约束，expr与表中已有数据不冲突|  
|  
|
|  
|插入值default|创建表有默认值，则插入默认值，否则插入null|  
|  
|
|  
|插入值expr与 default 组合|  
|  
|  
|
|  
|插入subquery|有主键或唯一约束，subquery返回值与表中已有数据冲突|多个subquery|tac不支持insert into select|
|  
|  
|有主键或唯一约束，subquery返回值与表中已有数据不冲突|subquery 查询表不存在|  
|
|  
|  
|subquery数据量大|subquery 查询结果错误|  
|
|  
|  
|  
|查询列与目标表列数量不匹配|  
|
|  
|  
|  
|查询列与目标表列类型不匹配|  
|
|update_set_clause|更新列数|1列|更新列名不存在|  
|
|  
|  
|多列|更新列名重复|  
|
|  
|  
|  
|[t_alias.] column中t_alias不存在|  
|
|  
|更新值expr|有主键或唯一约束，expr与表中已有数据不冲突|有主键或唯一约束，expr与表中已有数据冲突|  
|
|  
|  
|  
|  
|  
|
|  
|更新值default|创建表有默认值，则插入默认值，否则插入null|  
|  
|
|  
|更新值expr与 default 组合|  
|  
|  
|
|  
|更新为subquery|有主键或唯一约束，subquery返回值与表中已有数据不冲突|有主键或唯一约束，subquery返回值与表中已有数据冲突|  
|
|  
|  
|  
|subquery结果含多条|  
|
|  
|  
|  
|subquery结果含多列|  
|
|  
|  
|  
|subquery 查询表不存在|  
|
|  
|  
|  
|subquery 查询结果错误|  
|
|  
|分区场景|产生跨分区更新|  
|tac目前不支持跨分区更新|
|expr|数字，英文|  
|有主键约束，插入null或者空串|  
|
|  
|中文，日文，韩文，特殊符号等|  
|有主键约束，更新为null或者空串|  
|
|  
|算术表达式|  
|  
|  
|
|  
|函数表达式|  
|  
|  
|
|  
|null，空串，空格串|  
|  
|  
|
|subquery|投影列|1个，多个，*|  
|  
|
|  
|  
|算术表达式|  
|  
|
|  
|  
|函数表达式（聚合函数）|  
|  
|
|  
|  
|函数表达式（其他函数）|  
|  
|
|  
|  
|distinct column|  
|  
|
|  
|  
|使用列别名|  
|  
|
|  
|from|单个表，多张表|  
|  
|
|  
|  
|表，视图|  
|  
|
|  
|  
|为目标表，不为目标表|  
|  
|
|  
|where|>, <, =, !=, >=, <=,in,between and,exists,like|  
|  
|
|  
|  
|and，or，not|  
|  
|
|  
|结合group by|group by(+having)|  
|  
|
|  
|结合order by|order by desc/asc|  
|  
|
|  
|结合join|inner join/outer join/cross join|  
|  
|
|  
|结合union|union/union all|  
|  
|
|  
|limit|limit|  
|  
|
|  
|查询结果集|0/1/多条|  
|  
|
|数据类型|覆盖yasdb支持的所有数据类型|  
|  
|  
|
|并发场景|冲突后，在更新前这行数据被修改（update，delete）|  
|  
|  
|
|  
|与dml，ddl并发|  
|  
|  
|


#### 3.3 新增测试场景

|输入条件|场景|
|:---|:---|
|DDL|alter index|
|  
|Create Index online/unusable|
|  
|add check constraint|
|  
|分区转换后执行|
|  
|给表/视图建同义词，执行业务|


# 4.   **详细测试设计**

# 5.   **测试用例**

  


# 6.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[LSC支持insert into... on duplicate key update功能.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjE4OTcwYzJhZjRmNTFmYjQyIiwicmVmX2lkIjoiNjczOTY5ZjA1OTNmOTljOWZmMjM1NDUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjExLCJleHAiOjE3ODIyOTY2MTF9.RGpu8KgN1bm86ms7C2_7D1fbPJpOAUyAoQ6-Fa5ZuTM)

 (application/x-xmind)    
