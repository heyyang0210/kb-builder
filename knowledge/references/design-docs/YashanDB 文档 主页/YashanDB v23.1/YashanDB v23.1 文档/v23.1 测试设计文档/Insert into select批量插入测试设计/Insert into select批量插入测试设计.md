Created by 孔珂煜, last modified on 十一月 08, 2023

# 1.   **概述**

描述insert into select，Insert into多个value调整使用存储批量插入接口

sr：    [YDBRD-13633](https://jira.yasdb.com/browse/YDBRD-13633?src=confmacro)    -  insert into select，Insert into多个value调整使用存储批量插入接口  完成

开发文档：    [Insert into select批量插入优化方案设计 - 何阳 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112725612)  

# 2.   **需求分析**

带有子查询的插入语法，实现列表走批量插入接口

1.分布式下带有子查询的列表，直接走列批量插入接口  ---- 计划是列计划

2.单机部署下，对列存表执行INSERT操作可以使用子查询语法

  


功能限制：

分布式不支持insert all into多表插入

分布式不支持行列表混合的插入

行列表混合的情况下都走的是行执行引擎，不支持走列执行引擎 ---- 不支持，单机也不支持

不支持内置cast转换以外的数据插入

分布式不支持多表插入

# 3.   **测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

# 4.   **详细测试设计**

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|---|---|
|待插入表类型|分布表|  
|  
|  
|
|  
|复制表|  
|  
|  
|
|数据类型|char，varchar|各数据类型的边界值|  
|  
|
|  
|tinyint，smallint，int，bigint|  
|  
|  
|
|  
|number|  
|  
|  
|
|  
|float，double|  
|  
|  
|
|  
|time，timestamp，date|  
|  
|  
|
|  
|clob|32000大小限制  |blob|  
|
|  
|json|  
|udt|  
|
|  
|boolean|  
|bit|  
|
|数据类型转换|隐式类型转换|同种数据类型的精度不同：char(20)往char(1)插入,预期报错,行列报错信息会不一致，信息合理|  
|  
|
|  
|强制类型转换|select cast( c1 as date) |  
|  
|
|投影列数量|待插入的列等于投影列个数|  
|  
|  
|
|  
|待插入表的列大于投影列个数|投影列可以有null值，补null|  
|  
|
|  
|  
|投影列不能有null值|  
|  
|
|  
|待插入表的列小于投影列个数|报错|  
|  
|
|  
|4096列|  
|  
|  
|
|投影列类型|单列|  
|  
|  
|
|  
|表达式列，函数列|普通函数，聚集函数，窗口函数|  
|  
|
||伪列|rownum ， rowid ，rowscn|  
|  
|
|  
|标量子查询|  
|  
|  
|
|  
|常量|  
|  
|  
|
|  
|sysdate，systimestamp|select count(*) |  
|  
|
|待插入表约束|not null|单列约束，多列约束|  
|  
|
|  
|check|  
|  
|  
|
|  
|unique|  
|  
|  
|
|  
|主键|  
|  
|  
|
|  
|外键|  
|  
|  
|
|  
|default|  
|  
|  
|
|select语句|join|inner，left，right，full,128张表|connect by|  
|
|  
|集合操作|union，intersect，minus|  
|  
|
|  
|distinct|  
|  
|  
|
|  
|group by|  
|  
|  
|
|  
|order by|  
|  
|  
|
|  
|limit offset|  
|  
|  
|
|  
|in|多列，单列,in list,in subquery|  
|  
|
|  
|exists|  
|  
|  
|
|  
|关联子查询，非关联子查询|  
|  
|  
|
|  
|like，rlike，not like，not rlike|  
|  
|  
|
|  
|between and|  
|  
|  
|
|  
|is null， is not null|  
|  
|  
|
|  
|any，all，some|  
|  
|  
|
|插入表类型|table|insert into t1 select * from t1;|  
|  
|
|  
|view|create view v1 as select * from t1;  ---- 验证分布式支不支持,insert into t1 select * from v1;|  
|  
|
|  
|分区表|interval，hash，range，list,分区表往普通表里插入,普通表往分区表里插入|  
|  
|
|子查询返回值|多行多列|  
|  
|  
|
|  
|单行多列|  
|  
|  
|
|  
|多行单列|  
|  
|  
|
|  
|单行单列|  
|  
|  
|
|数据特征|insert表的数据和select表的数据分布是否一致|  
|  
|  
|
|  
|大量数据|大量插入时看一下行表和列表的性能,set timing on,两个表的分布键一样性能有提升 不是分布键性能没有提升|  
|  
|


单机列表

单机验证insert all into

insert on duplicate key

分布键必须插入 ，插入不带分布键

分布键插分布键 

# 5.  ** 测试用例设计**

# 6.   **测试框架设计**

  


# 7.   **测试环境说明**