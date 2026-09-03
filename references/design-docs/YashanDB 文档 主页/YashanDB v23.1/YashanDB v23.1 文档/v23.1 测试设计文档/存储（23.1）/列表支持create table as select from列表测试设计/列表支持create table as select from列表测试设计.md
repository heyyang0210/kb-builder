Created by 梁绮菁, last modified on 四月 09, 2024

# **1. 概述**

本文为 create table as select 测试设计

sr：    [YDBRD-5251](https://jira.yasdb.com/browse/YDBRD-5251?src=confmacro)    -  create table as支持通过列表创建列表  完成

设计文档：    [【SpearFish】create as select 列表到列表方案设计](122077112.html)  

# **2. 需求分析**

## **2.1 语法**

**create_table_as**



  


## **2.2 功能描述**

- 实现lsc表create table as from lsc表/tac表的功能
- 实现tac表create table as from lsc表/tac表的功能
- 采用列表insert into select from列表的方式，实现列表create table as select from列表的功能


# **3. 测试**  **设计方法**   

主要采用等价类划分，边界值，场景组合法  及错误推测法进行设计

## 场景划分：

## 1、lsc表到lsc表

- 父表全部热数据
- 父表部分热数据、部分冷数据
- 父表数据量10
- 父表数据量100w


## 2、tac表到tac表

- 父表数据量10
- 父表数据量100w


## 3、行列混合

- 子表是lsc表，父表是heap表
- 子表是lsc表，父表是heap、tac表
- 子表是lsc表，父表是heap、lsc表
- 子表是lsc表，父表是lsc、tac表
- 子表是tac表，父表是heap表
- 子表是tac表，父表是heap、tac表
- 子表是tac表，父表是heap、lsc表
- 子表是tac表，父表是lsc、tac表


## 等价类：

## 1、整体等价类划分

|输入条件|有效等价类|编号|无效等价类|编号|
|---|---|---|---|---|
|表类型|普通表|  
|  
|  
|
|  
|分区表（一级分区表、二级分区表）|  
|  
|  
|
|  
|临时表|  
|  
|  
|
|是否带约束|是|  
|违反约束：【表列为主键/unique,select 结果集中有重复值】【表列为not null,select 结果集中有null值】|  
|
|  
|否|  
|  
|  
|
|是否指定列名|是|  
|指定列：【列名重复】【列名的数量与投影数不一致】【指定列名并指定类型】,表 列名为伪列：【rownum】【rowid】【rowscn】|  
|
|  
|否|  
|不指定列：【select聚合函数/其他函数未使用别名】【select 表达式未使用别名】【select 常量未使用别名】【select 伪列未使用别名】|  
|
|是否指定存储参数|是|  
|  
|  
|
|  
|否|  
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
|表列个数|60列|  
|  
|  
|
|  
|10列|  
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
|投影列|1个|  
|0个投影|  
|
|  
|多个|  
|列名不存在|  
|
|  
|*，所有列|  
|  
|  
|
|  
|投影列为算数表达式（+, -, *, /,%）|  
|  
|  
|
|  
|投影列为函数表达式（聚合函数）|  
|  
|  
|
|  
|投影列为函数表达式（其他函数）|  
|  
|  
|
|  
|DISTINCT column|  
|  
|  
|
|  
|使用列别名|  
|  
|  
|
|<from>|普通表|  
|表名不存在|  
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
|  
|二级分区表|  
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
|结合grop by，having|grop by|  
|  
|  
|
|  
|grop by having|  
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
|不带 union|  
|  
|  
|
|limit|limit|  
|  
|  
|
|  
|limit..offset|  
|  
|  
|
|  
|不带 limit|  
|  
|  
|
|DML|匿名块中使用|  
|  
|  
|
|  
|select 查询表数据|  
|  
|  
|
|  
|建表后执行insert，验证表是否可用|  
|  
|  
|


## 2、分区表等价类划分

|输入条件|有效等价类|编号|无效等价类|编号|
|---|---|---|---|---|
|分区类型|range分区|  
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
|分区名称|不指定分区名称|  
|  
|  
|
|  
|指定分区名称|  
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


## 3、临时表等价类划分

|输入条件|有效等价类|编号|无效等价类|编号|
|---|---|---|---|---|
|临时表类型|全局临时表|  
|  
|  
|
|  
|私有临时表|  
|  
|  
|
|类别|事务级|  
|  
|  
|
|  
|会话级|  
|  
|  
|


## 4、约束等价类划分

|输入条件|有效等价类|编号|无效等价类|编号|
|---|---|---|---|---|
|是否inline|inline|  
|  
|  
|
|  
|out_of_line|  
|  
|  
|
|约束分类|primary key|  
|  
|  
|
|  
|unique|  
|  
|  
|
|  
|外键foreign key|  
|  
|  
|
|  
|非空 not null|  
|  
|  
|
|  
|默认值default|  
|  
|  
|
|是否带约束名|带|  
|  
|  
|
|  
|不带|  
|  
|  
|
|列个数|单列|  
|  
|  
|
|  
|多列|  
|  
|  
|


# 4.   **详细测试设计**

## 4.1 整体正交表(门槛)：

|编号|表类型|是否带约束|是否指定列名|是否指定存储参数|表空间|表数据量|表列个数|关键字|投影列|<from>|<where>|结合grop by|结合order by|结合join|结合union/union all|结合limit|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|1|临时表|带约束|yes|yes|自定义表空间|0行|60列|大小写组合|使用列别名|视图|简单条件|grop by having|不带 order by|inner join|union|limit...offset|
|2|临时表|不带约束|no|no|默认表空间|10行|10列|大写|多个|分区表|复合条件|grop by|order by asc|cross join|不带 union|limit|
|3|分区表|不带约束|yes|yes|默认表空间|100w行|10列|小写|使用列别名|普通表|不带 where|不带 group by|order by desc|不带 join|union all|不带 limit|
|4|普通表|带约束|no|no|自定义表空间|100w行|60列|大写|多个|视图|简单条件|不带 group by|不带 order by|outer join|不带 union|不带 limit|
|5|分区表|带约束|no|no|自定义表空间|10行|10列|大小写组合|算数表达式|分区表|不带 where|grop by having|order by asc|outer join|union all|limit...offset|
|6|普通表|带约束|yes|no|自定义表空间|10行|60列|小写|加distinct|派生表|简单条件|grop by|order by desc|不带 join|union|limit|
|7|普通表|不带约束|no|yes|默认表空间|0行|60列|大小写组合|1个|视图|不带 where|grop by|不带 order by|cross join|union all|limit|
|8|分区表|不带约束|no|no|默认表空间|0行|60列|大写|聚合函数表达式|普通表|复合条件|grop by having|order by desc|inner join|不带 union|limit...offset|
|9|临时表|带约束|yes|yes|默认表空间|100w行|10列|大小写组合|其他函数表达式|派生表|复合条件|不带 group by|order by asc|cross join|union|不带 limit|
|10|普通表|不带约束|no|yes|自定义表空间|0行|60列|小写|多个|临时表|不带 where|grop by having|order by asc|不带 join|union|limit...offset|
|11|分区表|不带约束|yes|yes|默认表空间|10行|10列|小写|其他函数表达式|普通表|简单条件|grop by|不带 order by|outer join|不带 union|limit|
|12|普通表|带约束|yes|yes|自定义表空间|10行|10列|大写|聚合函数表达式|临时表|简单条件|grop by|order by asc|inner join|union all|不带 limit|
|13|临时表|不带约束|no|yes|自定义表空间|0行|10列|小写|加distinct|视图|复合条件|不带 group by|order by desc|cross join|不带 union|limit...offset|
|14|临时表|不带约束|no|no|默认表空间|100w行|60列|大小写组合|*|临时表|复合条件|不带 group by|不带 order by|不带 join|不带 union|limit|
|15|分区表|带约束|yes|yes|自定义表空间|0行|10列|大写|*|分区表|不带 where|不带 group by|order by desc|inner join|union|不带 limit|
|16|临时表|带约束|no|no|默认表空间|10行|60列|大小写组合|聚合函数表达式|视图|复合条件|不带 group by|order by desc|outer join|union|limit|
|17|临时表|不带约束|yes|yes|默认表空间|100w行|60列|小写|算数表达式|视图|不带 where|grop by having|order by desc|inner join|不带 union|limit|
|18|分区表|带约束|no|yes|自定义表空间|100w行|10列|小写|*|视图|简单条件|grop by|order by asc|cross join|union all|limit...offset|
|19|普通表|不带约束|no|no|自定义表空间|0行|60列|大写|使用列别名|派生表|复合条件|grop by|order by asc|outer join|不带 union|limit|
|20|临时表|不带约束|no|yes|默认表空间|100w行|60列|大写|加distinct|分区表|简单条件|grop by having|不带 order by|不带 join|union all|不带 limit|
|21|普通表|不带约束|no|no|自定义表空间|10行|60列|大写|*|派生表|复合条件|grop by having|不带 order by|inner join|union all|limit...offset|
|22|普通表|带约束|yes|no|自定义表空间|0行|10列|大写|算数表达式|普通表|复合条件|不带 group by|order by asc|cross join|union|不带 limit|
|23|分区表|不带约束|no|yes|自定义表空间|10行|10列|大小写组合|加distinct|临时表|不带 where|grop by having|order by asc|outer join|union|limit|
|24|临时表|带约束|yes|no|自定义表空间|100w行|10列|小写|1个|普通表|复合条件|grop by having|order by asc|inner join|不带 union|limit...offset|
|25|分区表|不带约束|no|no|自定义表空间|0行|10列|大写|算数表达式|派生表|不带 where|grop by|不带 order by|不带 join|union all|limit|
|26|普通表|带约束|no|no|自定义表空间|0行|60列|大写|其他函数表达式|视图|不带 where|grop by having|order by desc|不带 join|union all|limit...offset|
|27|分区表|带约束|no|yes|自定义表空间|100w行|60列|小写|聚合函数表达式|派生表|不带 where|grop by having|不带 order by|cross join|不带 union|不带 limit|
|28|普通表|带约束|yes|yes|默认表空间|10行|60列|小写|使用列别名|分区表|简单条件|grop by having|order by desc|cross join|union all|limit...offset|
|29|分区表|不带约束|yes|no|自定义表空间|100w行|10列|大小写组合|聚合函数表达式|分区表|复合条件|不带 group by|不带 order by|不带 join|不带 union|不带 limit|
|30|分区表|不带约束|no|yes|默认表空间|10行|10列|大写|1个|临时表|简单条件|不带 group by|order by desc|cross join|union|不带 limit|
|31|分区表|不带约束|yes|yes|默认表空间|10行|10列|大小写组合|多个|普通表|简单条件|不带 group by|order by desc|inner join|union all|不带 limit|
|32|普通表|带约束|yes|no|默认表空间|100w行|60列|大写|1个|派生表|简单条件|grop by|order by asc|outer join|不带 union|limit|
|33|普通表|不带约束|no|no|自定义表空间|100w行|10列|小写|其他函数表达式|临时表|简单条件|grop by|order by desc|inner join|union|limit|
|34|临时表|不带约束|no|no|默认表空间|100w行|60列|大小写组合|算数表达式|临时表|简单条件|grop by|不带 order by|不带 join|union|limit|
|35|临时表|不带约束|yes|no|自定义表空间|100w行|60列|小写|加distinct|普通表|复合条件|不带 group by|不带 order by|inner join|union all|limit|
|36|临时表|不带约束|yes|yes|默认表空间|0行|60列|大写|1个|分区表|简单条件|grop by|order by desc|不带 join|不带 union|limit...offset|
|37|普通表|带约束|yes|yes|默认表空间|10行|60列|大小写组合|多个|派生表|复合条件|grop by having|不带 order by|cross join|union all|limit...offset|
|38|分区表|不带约束|yes|yes|自定义表空间|100w行|10列|大小写组合|其他函数表达式|分区表|不带 where|不带 group by|order by desc|cross join|不带 union|limit...offset|
|39|普通表|带约束|yes|no|默认表空间|10行|60列|小写|*|普通表|复合条件|grop by|不带 order by|outer join|不带 union|limit...offset|
|40|分区表|带约束|yes|yes|默认表空间|10行|10列|大写|使用列别名|临时表|简单条件|grop by having|order by asc|cross join|不带 union|limit...offset|


## 4.2 表维度细分正交

### 1.普通表

|编号|表类型|是否带约束|是否指定列名|是否指定存储参数|表空间|表数据量|表列个数|关键字|投影列|<from>|<where>|结合grop by|结合order by|结合join|结合union/union all|结合limit|约束分类|是否inline|是否带约束名|列个数|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|1|普通表|带约束|yes|yes|自定义表空间|0行|60列|大小写组合|使用列别名|视图|简单条件|grop by having|不带 order by|inner join|union|limit...offset|foreign key|inline|yes|多列|
|2|普通表|不带约束|no|no|默认表空间|10行|10列|大写|聚合函数表达式|视图|不带 where|不带 group by|order by asc|outer join|不带 union|limit|/|/|/|/|
|3|普通表|不带约束|no|yes|自定义表空间|100w行|10列|小写|其他函数表达式|派生表|复合条件|grop by|order by desc|cross join|union all|不带 limit|/|/|/|/|
|4|普通表|带约束|yes|no|默认表空间|100w行|60列|大小写组合|聚合函数表达式|派生表|不带 where|不带 group by|不带 order by|不带 join|union all|limit...offset|foreign key|out_of_line|no|单列|
|5|普通表|带约束|yes|no|自定义表空间|10行|60列|小写|使用列别名|分区表|复合条件|grop by having|order by asc|不带 join|union all|limit|default|inline|no|单列|
|6|普通表|带约束|no|no|默认表空间|0行|60列|大写|加distinct|派生表|简单条件|grop by|order by asc|cross join|union|limit|primary key|out_of_line|yes|多列|
|7|普通表|不带约束|yes|yes|默认表空间|0行|10列|大写|其他函数表达式|临时表|不带 where|grop by having|order by desc|inner join|不带 union|limit...offset|/|/|/|/|
|8|普通表|不带约束|no|yes|默认表空间|10行|10列|大小写组合|算数表达式|普通表|简单条件|grop by|不带 order by|不带 join|不带 union|不带 limit|/|/|/|/|
|9|普通表|带约束|yes|yes|自定义表空间|0行|60列|小写|1个|派生表|复合条件|不带 group by|order by desc|outer join|union|不带 limit|primary key|inline|no|单列|
|10|普通表|不带约束|no|no|自定义表空间|100w行|60列|大写|使用列别名|普通表|复合条件|不带 group by|order by desc|cross join|不带 union|limit...offset|/|/|/|/|
|11|普通表|不带约束|no|no|默认表空间|100w行|10列|小写|其他函数表达式|分区表|简单条件|不带 group by|不带 order by|inner join|union|limit|/|/|/|/|
|12|普通表|带约束|no|yes|自定义表空间|100w行|10列|大小写组合|加distinct|分区表|不带 where|grop by having|order by desc|outer join|不带 union|不带 limit|foreign key|inline|yes|多列|
|13|普通表|不带约束|yes|yes|默认表空间|10行|10列|大小写组合|1个|普通表|不带 where|grop by|order by asc|inner join|union all|limit|/|/|/|/|
|14|普通表|不带约束|yes|no|默认表空间|10行|60列|大写|*|视图|复合条件|grop by having|不带 order by|cross join|union all|不带 limit|/|/|/|/|
|15|普通表|带约束|no|yes|自定义表空间|10行|10列|小写|*|普通表|不带 where|grop by|order by asc|outer join|union|limit...offset|foreign key|out_of_line|no|单列|
|16|普通表|带约束|yes|no|自定义表空间|10行|60列|小写|算数表达式|派生表|简单条件|grop by having|order by desc|outer join|union all|limit|default|inline|no|单列|
|17|普通表|带约束|no|no|自定义表空间|100w行|60列|大小写组合|使用列别名|临时表|复合条件|grop by|order by asc|outer join|union all|不带 limit|primary key|out_of_line|yes|多列|
|18|普通表|不带约束|yes|yes|默认表空间|0行|10列|小写|多个|普通表|复合条件|grop by having|order by desc|inner join|不带 union|不带 limit|/|/|/|/|
|19|普通表|带约束|no|yes|自定义表空间|0行|10列|小写|聚合函数表达式|分区表|复合条件|grop by|order by desc|cross join|union|limit...offset|unique|inline|no|多列|
|20|普通表|带约束|no|no|自定义表空间|0行|60列|大写|多个|派生表|简单条件|grop by|order by desc|不带 join|union all|limit|primary key|inline|no|单列|
|21|普通表|不带约束|no|no|默认表空间|10行|10列|大小写组合|使用列别名|派生表|不带 where|grop by|order by desc|inner join|不带 union|不带 limit|/|/|/|/|
|22|普通表|不带约束|no|no|自定义表空间|10行|60列|小写|1个|临时表|简单条件|grop by having|不带 order by|不带 join|union|limit|/|/|/|/|
|23|普通表|带约束|no|no|默认表空间|10行|60列|大小写组合|聚合函数表达式|临时表|简单条件|grop by having|order by asc|cross join|union all|不带 limit|foreign key|inline|yes|多列|
|24|普通表|不带约束|yes|no|自定义表空间|100w行|60列|大小写组合|多个|视图|不带 where|grop by|order by asc|cross join|union|limit...offset|/|/|/|/|
|25|普通表|不带约束|yes|yes|自定义表空间|100w行|10列|大小写组合|*|临时表|简单条件|不带 group by|order by desc|inner join|不带 union|limit|/|/|/|/|
|26|普通表|不带约束|yes|no|自定义表空间|10行|60列|小写|加distinct|普通表|复合条件|不带 group by|不带 order by|不带 join|union all|limit...offset|/|/|/|/|
|27|普通表|带约束|yes|yes|默认表空间|100w行|10列|小写|加distinct|视图|复合条件|不带 group by|order by desc|inner join|不带 union|limit...offset|default|inline|no|单列|
|28|普通表|带约束|yes|no|默认表空间|10行|60列|大小写组合|其他函数表达式|视图|简单条件|不带 group by|order by asc|不带 join|union all|不带 limit|primary key|out_of_line|yes|多列|
|29|普通表|不带约束|no|yes|默认表空间|0行|10列|大写|*|分区表|简单条件|grop by|不带 order by|不带 join|不带 union|不带 limit|/|/|/|/|
|30|普通表|带约束|no|yes|自定义表空间|100w行|60列|大写|1个|视图|简单条件|grop by|不带 order by|cross join|不带 union|limit...offset|unique|inline|no|多列|
|31|普通表|带约束|no|yes|自定义表空间|0行|60列|大写|*|派生表|不带 where|grop by having|不带 order by|outer join|不带 union|limit...offset|primary key|inline|no|单列|
|32|普通表|不带约束|no|no|默认表空间|0行|10列|小写|聚合函数表达式|普通表|复合条件|grop by|order by desc|inner join|union|limit...offset|/|/|/|/|
|33|普通表|带约束|yes|no|默认表空间|0行|60列|大写|算数表达式|临时表|复合条件|不带 group by|order by asc|inner join|union|limit...offset|foreign key|inline|yes|多列|
|34|普通表|带约束|yes|yes|自定义表空间|100w行|60列|小写|算数表达式|视图|不带 where|grop by|不带 order by|cross join|union all|limit...offset|not null|inline|no|单列|
|35|普通表|带约束|no|no|自定义表空间|10行|10列|大小写组合|多个|分区表|不带 where|不带 group by|不带 order by|outer join|union all|不带 limit|unique|out_of_line|yes|单列|
|36|普通表|带约束|yes|yes|默认表空间|100w行|10列|大写|加distinct|临时表|复合条件|grop by having|不带 order by|outer join|union|limit...offset|foreign key|out_of_line|no|单列|
|37|普通表|不带约束|no|yes|默认表空间|10行|60列|大小写组合|其他函数表达式|普通表|不带 where|grop by having|order by desc|outer join|union all|limit|/|/|/|/|
|38|普通表|不带约束|yes|yes|默认表空间|0行|10列|大写|算数表达式|分区表|复合条件|不带 group by|order by desc|inner join|union all|limit...offset|/|/|/|/|
|39|普通表|带约束|yes|yes|自定义表空间|100w行|10列|小写|1个|分区表|简单条件|grop by having|order by desc|不带 join|union|limit...offset|default|inline|no|多列|
|40|普通表|不带约束|no|no|自定义表空间|10行|60列|大小写组合|多个|临时表|不带 where|不带 group by|order by asc|不带 join|不带 union|limit...offset|/|/|/|/|


### 2.临时表

|编号|表类型|临时表类型|类别|是否带约束|是否指定列名|是否指定存储参数|表空间|表数据量|表列个数|关键字|投影列|<from>|<where>|结合grop by|结合order by|结合join|结合union/union all|结合limit|约束分类|是否inline|是否带约束名|列个数|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|1|临时表|全局临时表|事务级|带约束|yes|yes|自定义表空间|0行|60列|大小写组合|使用列别名|视图|简单条件|grop by having|不带 order by|inner join|union|limit...offset|foreign key|inline|yes|多列|
|2|临时表|私有临时表|会话级|不带约束|no|no|默认表空间|10行|10列|大写|多个|分区表|复合条件|grop by|order by asc|cross join|不带 union|limit|/|/|/|/|
|3|临时表|私有临时表|事务级|不带约束|yes|no|自定义表空间|100w行|10列|小写|使用列别名|临时表|不带 where|不带 group by|order by desc|outer join|union all|不带 limit|/|/|/|/|
|4|临时表|全局临时表|会话级|带约束|no|yes|默认表空间|10行|60列|大小写组合|聚合函数表达式|派生表|复合条件|不带 group by|order by desc|不带 join|不带 union|limit...offset|foreign key|out_of_line|no|单列|
|5|临时表|私有临时表|事务级|带约束|no|yes|默认表空间|100w行|60列|大写|*|分区表|不带 where|grop by|不带 order by|不带 join|union|不带 limit|default|inline|no|单列|
|6|临时表|全局临时表|会话级|不带约束|no|no|默认表空间|0行|60列|小写|加distinct|派生表|不带 where|grop by having|order by asc|inner join|union all|limit|/|/|/|/|
|7|临时表|全局临时表|会话级|带约束|no|yes|自定义表空间|100w行|10列|大小写组合|多个|视图|简单条件|grop by having|order by asc|outer join|不带 union|不带 limit|default|inline|no|多列|
|8|临时表|私有临时表|会话级|不带约束|yes|no|自定义表空间|0行|10列|大写|聚合函数表达式|普通表|简单条件|不带 group by|不带 order by|outer join|union|limit|/|/|/|/|
|9|临时表|全局临时表|事务级|带约束|yes|yes|自定义表空间|10行|10列|小写|其他函数表达式|视图|简单条件|grop by|order by desc|不带 join|union all|limit|primary key|inline|no|单列|
|10|临时表|私有临时表|事务级|带约束|yes|yes|自定义表空间|0行|60列|大写|1个|派生表|复合条件|grop by having|order by desc|cross join|union|不带 limit|not null|inline|no|多列|
|11|临时表|全局临时表|事务级|带约束|yes|no|默认表空间|100w行|10列|小写|使用列别名|分区表|复合条件|不带 group by|order by asc|cross join|union all|limit...offset|foreign key|inline|yes|多列|
|12|临时表|私有临时表|事务级|不带约束|yes|no|默认表空间|10行|60列|大小写组合|多个|派生表|不带 where|grop by|不带 order by|outer join|union all|limit...offset|/|/|/|/|
|13|临时表|私有临时表|事务级|不带约束|yes|yes|默认表空间|10行|10列|大写|加distinct|视图|复合条件|不带 group by|不带 order by|inner join|不带 union|不带 limit|/|/|/|/|
|14|临时表|全局临时表|会话级|不带约束|no|no|默认表空间|100w行|60列|大写|其他函数表达式|派生表|不带 where|grop by having|不带 order by|cross join|不带 union|limit...offset|/|/|/|/|
|15|临时表|全局临时表|会话级|不带约束|yes|no|自定义表空间|0行|10列|大小写组合|*|视图|简单条件|grop by having|order by asc|cross join|不带 union|limit|/|/|/|/|
|16|临时表|私有临时表|会话级|带约束|no|no|默认表空间|10行|60列|大小写组合|算数表达式|分区表|简单条件|grop by having|order by desc|inner join|union|limit|primary key|out_of_line|yes|多列|
|17|临时表|全局临时表|事务级|带约束|no|no|默认表空间|0行|60列|小写|多个|普通表|不带 where|grop by having|order by asc|不带 join|union|不带 limit|default|inline|no|多列|
|18|临时表|私有临时表|会话级|不带约束|no|yes|自定义表空间|0行|10列|小写|*|派生表|复合条件|grop by|order by desc|inner join|union all|limit...offset|/|/|/|/|
|19|临时表|全局临时表|事务级|不带约束|no|yes|默认表空间|0行|60列|小写|算数表达式|临时表|复合条件|grop by|不带 order by|不带 join|不带 union|limit...offset|/|/|/|/|
|20|临时表|全局临时表|会话级|不带约束|no|yes|默认表空间|100w行|10列|大写|使用列别名|派生表|简单条件|grop by|order by asc|不带 join|不带 union|limit|/|/|/|/|
|21|临时表|全局临时表|会话级|带约束|yes|yes|自定义表空间|100w行|60列|大小写组合|加distinct|普通表|复合条件|grop by|order by desc|cross join|union all|limit...offset|foreign key|inline|yes|多列|
|22|临时表|私有临时表|会话级|带约束|yes|yes|默认表空间|0行|60列|大小写组合|其他函数表达式|临时表|复合条件|不带 group by|order by asc|inner join|union|不带 limit|not null|inline|no|单列|
|23|临时表|全局临时表|会话级|不带约束|no|no|默认表空间|100w行|10列|小写|1个|视图|不带 where|grop by|order by asc|inner join|union all|limit...offset|/|/|/|/|
|24|临时表|私有临时表|事务级|带约束|no|no|自定义表空间|100w行|60列|小写|聚合函数表达式|分区表|不带 where|grop by|order by asc|outer join|union all|不带 limit|foreign key|out_of_line|no|单列|
|25|临时表|私有临时表|会话级|不带约束|yes|no|默认表空间|0行|60列|大写|加distinct|分区表|复合条件|grop by|order by asc|outer join|union|limit...offset|/|/|/|/|
|26|临时表|全局临时表|事务级|带约束|yes|no|自定义表空间|100w行|10列|大写|算数表达式|视图|不带 where|不带 group by|order by asc|cross join|union all|不带 limit|primary key|out_of_line|yes|多列|
|27|临时表|私有临时表|事务级|带约束|yes|yes|默认表空间|10行|60列|大小写组合|算数表达式|普通表|简单条件|grop by having|order by desc|outer join|不带 union|不带 limit|default|inline|no|多列|
|28|临时表|全局临时表|事务级|不带约束|yes|no|自定义表空间|10行|60列|小写|*|普通表|复合条件|不带 group by|order by asc|inner join|不带 union|limit|/|/|/|/|
|29|临时表|全局临时表|会话级|不带约束|yes|yes|默认表空间|10行|10列|大写|1个|临时表|简单条件|grop by having|不带 order by|outer join|不带 union|limit|/|/|/|/|
|30|临时表|私有临时表|事务级|带约束|no|no|自定义表空间|10行|60列|小写|使用列别名|普通表|简单条件|grop by having|不带 order by|outer join|union all|不带 limit|not null|inline|no|多列|
|31|临时表|全局临时表|会话级|不带约束|no|yes|默认表空间|100w行|60列|大小写组合|聚合函数表达式|视图|简单条件|grop by having|order by asc|inner join|不带 union|limit|/|/|/|/|
|32|临时表|私有临时表|会话级|不带约束|no|no|默认表空间|0行|60列|大小写组合|多个|临时表|简单条件|不带 group by|order by desc|inner join|union|limit|/|/|/|/|
|33|临时表|私有临时表|事务级|不带约束|no|yes|自定义表空间|10行|60列|小写|其他函数表达式|分区表|不带 where|grop by having|不带 order by|outer join|union|不带 limit|/|/|/|/|
|34|临时表|私有临时表|事务级|带约束|yes|yes|默认表空间|10行|60列|大小写组合|*|临时表|不带 where|grop by having|不带 order by|cross join|不带 union|limit|foreign key|inline|yes|多列|
|35|临时表|私有临时表|事务级|不带约束|no|yes|默认表空间|0行|60列|大写|算数表达式|派生表|简单条件|grop by having|order by desc|inner join|union|不带 limit|/|/|/|/|
|36|临时表|私有临时表|事务级|带约束|yes|no|默认表空间|0行|60列|大小写组合|1个|普通表|不带 where|不带 group by|order by asc|不带 join|union|不带 limit|unique|out_of_line|yes|单列|
|37|临时表|私有临时表|会话级|带约束|yes|yes|自定义表空间|0行|10列|小写|其他函数表达式|普通表|复合条件|grop by|order by asc|不带 join|union|不带 limit|foreign key|out_of_line|no|单列|
|38|临时表|私有临时表|事务级|带约束|no|yes|默认表空间|10行|60列|大写|聚合函数表达式|临时表|不带 where|grop by|不带 order by|cross join|不带 union|不带 limit|default|inline|no|单列|
|39|临时表|全局临时表|会话级|不带约束|no|yes|自定义表空间|100w行|10列|大写|*|分区表|复合条件|grop by|不带 order by|outer join|union all|不带 limit|/|/|/|/|
|40|临时表|私有临时表|会话级|不带约束|yes|yes|默认表空间|0行|60列|大写|加distinct|临时表|简单条件|grop by having|order by desc|不带 join|union all|limit...offset|/|/|/|/|
|41|临时表|私有临时表|会话级|带约束|yes|no|默认表空间|100w行|60列|大小写组合|1个|分区表|不带 where|不带 group by|order by asc|inner join|union all|limit|unique|inline|no|多列|


### 3.分区表

|编号|表类型|分区类型|分区名称|分区键列数|是否带约束|是否指定列名|是否指定存储参数|表空间|表数据量|表列个数|关键字|投影列|<from>|<where>|结合grop by|结合order by|结合join|结合union/union all|结合limit|约束分类|是否inline|是否带约束名|列个数|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|1|分区表|rang分区|不指定|单列|带约束|yes|yes|自定义表空间|0行|60列|大小写组合|使用列别名|视图|简单条件|grop by having|不带 order by|inner join|union|limit...offset|foreign key|inline|yes|多列|
|2|分区表|list分区|指定|多列|不带约束|no|no|默认表空间|100w行|10列|大写|多个|临时表|复合条件|grop by|order by desc|cross join|不带 union|不带 limit|/|/|/|/|
|3|分区表|hash分区|指定|多列|带约束|no|yes|自定义表空间|10行|10列|小写|1个|普通表|不带 where|不带 group by|order by asc|outer join|union all|limit|unique|out_of_line|yes|单列|
|4|分区表|hash分区|不指定|单列|不带约束|yes|no|默认表空间|100w行|60列|大小写组合|聚合函数表达式|临时表|简单条件|不带 group by|order by desc|不带 join|union|limit|/|/|/|/|
|5|分区表|list分区|不指定|单列|带约束|yes|no|默认表空间|10行|60列|小写|多个|普通表|不带 where|grop by|不带 order by|不带 join|不带 union|limit...offset|default|inline|no|单列|
|6|分区表|rang分区|不指定|多列|不带约束|no|no|默认表空间|0行|60列|小写|使用列别名|临时表|复合条件|grop by having|order by asc|inner join|union all|不带 limit|/|/|/|/|
|7|分区表|rang分区|指定|单列|不带约束|yes|yes|自定义表空间|10行|10列|大小写组合|算数表达式|派生表|复合条件|grop by|不带 order by|outer join|union|不带 limit|/|/|/|/|
|8|分区表|hash分区|不指定|单列|带约束|yes|yes|自定义表空间|0行|10列|大写|其他函数表达式|分区表|不带 where|grop by having|order by desc|cross join|union all|limit...offset|unique|inline|no|多列|
|9|分区表|list分区|指定|多列|带约束|no|no|自定义表空间|0行|60列|大写|加distinct|派生表|简单条件|不带 group by|order by asc|inner join|不带 union|limit|primary key|inline|no|单列|
|10|分区表|rang分区|不指定|多列|不带约束|no|yes|默认表空间|100w行|60列|小写|算数表达式|普通表|简单条件|不带 group by|order by asc|cross join|union|limit...offset|/|/|/|/|
|11|分区表|list分区|指定|多列|带约束|no|yes|自定义表空间|100w行|10列|大小写组合|加distinct|普通表|复合条件|grop by having|不带 order by|不带 join|union all|不带 limit|foreign key|inline|yes|多列|
|12|分区表|rang分区|不指定|单列|不带约束|no|no|默认表空间|10行|60列|小写|加distinct|分区表|简单条件|grop by|order by desc|outer join|union|limit|/|/|/|/|
|13|分区表|rang分区|指定|多列|不带约束|no|yes|自定义表空间|0行|10列|大写|聚合函数表达式|普通表|不带 where|grop by|order by desc|inner join|不带 union|不带 limit|/|/|/|/|
|14|分区表|hash分区|指定|多列|带约束|yes|no|默认表空间|10行|60列|大写|*|普通表|复合条件|grop by having|不带 order by|outer join|不带 union|limit|foreign key|out_of_line|no|单列|
|15|分区表|hash分区|指定|单列|不带约束|yes|no|默认表空间|10行|10列|大写|其他函数表达式|普通表|简单条件|grop by|order by asc|不带 join|union|不带 limit|/|/|/|/|
|16|分区表|hash分区|指定|单列|带约束|yes|yes|自定义表空间|100w行|10列|大小写组合|多个|派生表|简单条件|grop by having|order by asc|outer join|union all|limit...offset|primary key|out_of_line|yes|多列|
|17|分区表|hash分区|指定|多列|带约束|yes|no|默认表空间|100w行|60列|大小写组合|算数表达式|分区表|复合条件|不带 group by|不带 order by|inner join|不带 union|limit|default|inline|no|多列|
|18|分区表|list分区|指定|多列|不带约束|no|no|默认表空间|100w行|10列|大小写组合|算数表达式|视图|不带 where|grop by|order by desc|cross join|union all|limit|/|/|/|/|
|19|分区表|list分区|不指定|单列|不带约束|no|yes|自定义表空间|0行|10列|小写|*|派生表|不带 where|grop by|order by desc|不带 join|union|limit...offset|/|/|/|/|
|20|分区表|list分区|不指定|多列|带约束|yes|yes|默认表空间|10行|60列|小写|聚合函数表达式|视图|复合条件|不带 group by|order by asc|outer join|不带 union|不带 limit|not null|inline|no|多列|
|21|分区表|rang分区|指定|多列|不带约束|no|yes|默认表空间|100w行|60列|大小写组合|其他函数表达式|派生表|复合条件|不带 group by|不带 order by|cross join|不带 union|limit|/|/|/|/|
|22|分区表|hash分区|不指定|单列|带约束|yes|yes|自定义表空间|10行|10列|小写|加distinct|临时表|不带 where|grop by having|不带 order by|cross join|union|limit...offset|foreign key|inline|yes|多列|
|23|分区表|rang分区|指定|多列|带约束|yes|yes|默认表空间|0行|10列|大写|算数表达式|临时表|复合条件|grop by having|不带 order by|不带 join|union|limit...offset|not null|inline|no|单列|
|24|分区表|hash分区|指定|多列|不带约束|no|yes|默认表空间|100w行|10列|大写|加distinct|视图|不带 where|不带 group by|order by desc|不带 join|union all|不带 limit|/|/|/|/|
|25|分区表|rang分区|不指定|多列|不带约束|no|no|默认表空间|10行|60列|大写|多个|视图|复合条件|不带 group by|不带 order by|inner join|union|limit|/|/|/|/|
|26|分区表|list分区|指定|多列|不带约束|yes|no|默认表空间|100w行|60列|小写|聚合函数表达式|分区表|不带 where|grop by having|不带 order by|cross join|union all|limit...offset|/|/|/|/|
|27|分区表|rang分区|不指定|单列|不带约束|yes|no|默认表空间|0行|60列|大小写组合|1个|临时表|简单条件|grop by|order by desc|outer join|union|不带 limit|/|/|/|/|
|28|分区表|rang分区|不指定|多列|带约束|yes|no|默认表空间|100w行|10列|大小写组合|*|临时表|简单条件|不带 group by|order by asc|inner join|union all|不带 limit|default|inline|no|多列|
|29|分区表|list分区|指定|单列|不带约束|yes|no|默认表空间|10行|10列|大写|使用列别名|派生表|不带 where|grop by|order by desc|outer join|不带 union|limit|/|/|/|/|
|30|分区表|rang分区|不指定|单列|带约束|yes|no|默认表空间|0行|10列|小写|多个|分区表|不带 where|不带 group by|order by asc|不带 join|union|不带 limit|primary key|inline|no|单列|
|31|分区表|list分区|指定|单列|带约束|yes|yes|自定义表空间|100w行|10列|大写|1个|派生表|复合条件|grop by having|不带 order by|不带 join|不带 union|limit...offset|not null|inline|no|多列|
|32|分区表|hash分区|指定|多列|不带约束|no|no|默认表空间|100w行|10列|小写|*|视图|不带 where|grop by|不带 order by|cross join|不带 union|不带 limit|/|/|/|/|
|33|分区表|hash分区|不指定|单列|不带约束|no|no|默认表空间|100w行|60列|小写|使用列别名|普通表|不带 where|不带 group by|order by desc|不带 join|union|limit|/|/|/|/|
|34|分区表|rang分区|指定|单列|不带约束|yes|no|自定义表空间|10行|60列|小写|1个|视图|复合条件|grop by|不带 order by|inner join|union|limit...offset|/|/|/|/|
|35|分区表|list分区|不指定|单列|不带约束|yes|yes|默认表空间|0行|10列|小写|其他函数表达式|视图|简单条件|grop by|order by asc|outer join|union all|limit...offset|/|/|/|/|
|36|分区表|rang分区|不指定|多列|带约束|no|yes|自定义表空间|100w行|10列|小写|1个|分区表|不带 where|grop by|order by asc|cross join|union all|limit...offset|foreign key|inline|yes|多列|
|37|分区表|list分区|不指定|单列|带约束|no|no|自定义表空间|10行|10列|大写|聚合函数表达式|派生表|不带 where|grop by having|不带 order by|不带 join|不带 union|limit...offset|not null|inline|no|单列|
|38|分区表|list分区|指定|多列|带约束|yes|yes|自定义表空间|0行|60列|大写|使用列别名|分区表|不带 where|不带 group by|order by asc|cross join|不带 union|limit|unique|out_of_line|yes|单列|
|39|分区表|rang分区|指定|多列|带约束|no|no|默认表空间|10行|60列|大写|*|分区表|复合条件|不带 group by|不带 order by|outer join|union all|limit|foreign key|out_of_line|no|单列|
|40|分区表|list分区|指定|单列|不带约束|yes|yes|自定义表空间|0行|60列|大小写组合|其他函数表达式|临时表|简单条件|不带 group by|order by asc|inner join|union all|limit|/|/|/|/|


### 4.约束正交表

|约束分类|是否inline|是否带约束名|列个数|
|---|---|---|---|
|foreign key|inline|yes|多列|
|not null|inline|no|单列|
|unique|out_of_line|yes|单列|
|foreign key|out_of_line|no|单列|
|default|inline|yes|单列|
|primary key|out_of_line|no|多列|
|default|out_of_line|no|多列|
|unique|inline|no|多列|
|primary key|inline|yes|单列|
|not null|out_of_line|yes|多列|


# 5.   **测试用例**

|用例编号|用例测试点|用例步骤|预期结果|实际结果|是否自动化|备注|
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|01-145复用heap表用例|  
|  
|  
|  
|  
|  
|
|test_sdv_lsc_create_table_as_select_147|父表有不同的slice数+普通表|1. 父表0行，子表插入一条----0个slice
1. 父表1行----1个slice
1. 父表2w，子表1个slice，2w行，插入一行后2个
1. 父表2w+1，子表1个slice，插入一行后2个
1. 父表1行，子表插入2w条
1. 父表1行，子表插入10条，alter slice
|  
|pass|是|  
|
|test_sdv_lsc_create_table_as_select_148|父表有不同的slice数+range分区表|和普通表一样|  
|pass|是|  
|
|test_sdv_lsc_create_table_as_select_149|父表有不同的slice数+list分区表|和普通表一样|  
|pass|是|  
|
|test_sdv_lsc_create_table_as_select_150|父表有不同的slice数+hash分区表|和普通表一样|  
|pass|是|  
|
|test_sdv_lsc_create_table_as_select_151|转换时create table as+主键约束|1. 普通表-》普通表，父表4032*4+1行，子表插入4032*4行，约束校验
1. 普通表-》range分区表，子表p2满，p3满，p3插数转换，约束校验
1. 普通表-》interval，子表p2满，扩展p3满，p3插数转换，p4不转，扩展p5，约束校验
1. 普通表-》hash，子表都不满，其中一个分区插数转换，约束校验
|  
|pass|是|  
|
|test_sdv_lsc_create_table_as_select_152|转换时create table as+主键约束|1. range-》普通表，父表p2、p3满，子表插入4032*4+1条，约束校验
1. range-》interval，父表p2、p3满，子表p2满，扩展p3满，约束校验
1. interval-》普通表，父表p2、扩展p3满，子表插数转换，约束校验
1. interval-》list，父表p2、扩展p3满，子表插数转换，约束校验
1. interval-》interval，父表p2、扩展p3满，子表插数转换，约束校验
|  
|pass|是|  
|
|test_sdv_lsc_create_table_as_select_153|二级分区+主键约束+lob|1. 普通表-》rang-hash，父表有动态、静态数据，父表映射到子表各个子分区，子表跨分区更新，约束校验
1. 普通表-》list-list，，父表映射到子表各个子分区，子表sp1-1插数转换，约束校验
1. range-range-》普通表，子表只带父表某几列、某个子分区、lob带union、lob带cast
1. range-range-》range-list，父表映射到子表各个子分区，约束校验，lob、raw跨一级和二级分区更新、回滚
1. range-range-》hash-list，父表映射到子表各个子分区，约束校验，lob、raw跨一级和二级分区更新
1. range-range-》range，子表跨分区更新
1. list-hash-》hash-list，子表插数转换
1. list-hash-》hash-range，子表插数转换
1. list-hash-》range，子表跨分区更新、回滚
1. range-list-》list-range，父表映射到子表各个子分区，子表延迟创建分区和使用分区模板
1. hash-hash-》hash-hash，父表某些子分区=0，子表插数转换
|  
|pass|是|  
|
|test_sdv_lsc_create_table_as_select_154|多表交叉，heap-》lsc+各种约束|1. 建heap表的普通表、一级分区表、二级分区表
1. 子表是普通表 
    1. 子表带cast，更新
    1. 子表带union子分区和一级分区
    1. 子表带join
    1. 子表带join子分区和一级分区
    1. 子表指定约束，带join普通表和分区表
1. 子表是一级分区表
    1. 子表p2、扩展p3满，带join、union子分区和一级分区和普通表
1. 子表是二级分区表
    1. 子表带join、union子分区和一级分区和普通表
1. 行列混合
    1. 父表是heap和lsc
    1. 父表是heap和tac
    1. 父表是lsc和tac
1. 临时表
    1. 父表是heap表的普通表、分区表、二级分区表
|  
|pass|是|  
|
|test_sdv_lsc_create_table_as_select_155|多表交叉，tac-》lsc+各种约束|父表类型是tac|  
|pass|是|  
|
|test_sdv_lsc_create_table_as_select_156|tac临时表-》lsc|1. 建tac表的普通表、全局事务表、全局会话表、私有事务表、私有会话表
1. 建heap表的普通表、全局事务表、全局会话表、私有事务表、私有会话表
1. 子表是普通表
    1. 子表带约束，约束校验
1. 子表是一级分区表
    1. 子表带union、join普通表和一级分区和二级分区，tac表和heap表
1. 子表是二级分区表
    1. 子表带union、join普通表和一级分区和二级分区，tac表和heap表
|  
|pass|是|  
|


#   
  6.   **测试框架设计**

本次测试采用yasft测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2021-10-9_12-13-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Zjg4OTcwYzJhZjRmNTFmYjVkIiwicmVmX2lkIjoiNjczOTY5Zjg3MjgyMDZlZmI5MmVmOTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNDc5LCJleHAiOjE3ODIyOTY4Nzl9.hIa1aHR-0O1g9dkAtufLYzBj2GDewRPmhdbnsbG5hew)

 (image/png)    
