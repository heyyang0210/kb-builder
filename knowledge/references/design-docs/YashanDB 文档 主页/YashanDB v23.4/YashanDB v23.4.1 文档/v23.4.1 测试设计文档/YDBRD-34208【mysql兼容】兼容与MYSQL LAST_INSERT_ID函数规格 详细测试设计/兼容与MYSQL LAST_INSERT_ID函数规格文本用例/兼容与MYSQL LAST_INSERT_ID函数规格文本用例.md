Created by 陈钦卿, last modified on 十月 31, 2024

|序号|用例编号|测试点|级别|预置条件|测试步骤|预期结果|备注|进度（已测完/已自动化）|版本|交付形态|
|---|---|---|---|---|---|---|---|---|---|---|
|1|test_mysql_last_insert_id_01|参数校验|**L0**|打开mysql兼容模式,alter session set compat_vector=mysql;|1. 参数个数：0、1、2
1. 参数为数值常量：  整数，小数，科学计数法，0，1，null，空，b'11'，-1，超过上限
1. 参数为字符常量：字符、特殊字符、表情
1. 参数覆盖所有数据类型：  tinyint、smallint、mediumint、int、bigint、float、double、decimal、char、varchar、  TINYTEXT/TINYBLOB、TEXT/BLOB、MEDIUMTEXT/MEDIUMBLOB  、  LONGTEXT/LONGBLOB、  date、time、timestamp、bit、  BINARY、VARBINARY
|1. 参数个数为2报错
1. 预期成功
1. 预期报错
1. 预期成功
|  
|  
|23.4（master）|单机|
|2|  
|参数校验|L1|打开mysql兼容模式|1. 参数为表达式：  布尔表达式、运算表达式、null表达式、连接符运算
1. 参数为内置函数：数值函数、字符函数、日期函数、转换函数、其他函数、窗口函数、聚集函数、  单独为MySQL模式提供的内置函数
1. 参数为子查询
|1.2.3预期成功|  
|  
|  
|  
|
|3|  
|函数校验|**L0**|打开mysql兼容模式|1. 函数名覆盖：大小写、拼写错误、名称缺失、带单双引号
1. 函数名与与表/视图同名
1. v$function新增函数名
1. 函数返回值
1. 函数子嵌套127、128层
|1.部分报错,2.3.4.5预期成功|  
|  
|  
|  
|
|4|  
|auto_increment自增列类型|**L0**|打开mysql兼容模式|1. 类型覆盖：tinyint,smallint, mediumint, int, bigint
1. 指定自增字段初始值，AUTO_INCREMENT = n
1. AUTO_INCREMENT   达到上限
1. 表中无自增列
|  
|  
|  
|  
|  
|
|5|  
|select from|**L0**|打开mysql兼容模式|1. from dual
1. from 空表
1. from 插入表
1. from 其他表
|1.2.3.4预期成功|  
|  
|  
|  
|
|6|  
|插入成功/失败|**L0**|打开mysql兼容模式|1. 无插入
1. 自增列插入失败
1. 非自增列插入失败
1. 事务表回滚
|1.2.3.4预期成功|  
|  
|  
|  
|
|7|  
|insert行数|**L0**|打开mysql兼容模式|1. insert单行
1. insert多行（返回第一行的AUTO_INCREMENT）
1. insert多行中部分行失败（首行/中间行/末行）
|  
|  
|  
|  
|  
|
|8|  
|insert方式|L1|打开mysql兼容模式|1. insert
1. insert into select
1. INSERT ... ON DUPLICATE KEY UPDATE 
|  
|  
|  
|  
|  
|
|9|  
|显式赋值|**L0**|打开mysql兼容模式|显式赋值,1. 连续
1. 不连续
1. 小于当前  last_insert_id
|  
|  
|  
|  
|  
|
|10|  
|功能校验|**L0**|打开mysql兼容模式|1. 修改表主键、唯一索引后插入
1. truncate/delete表后插入
1. 重建同名表并插入
|  
|  
|  
|  
|  
|
|11|  
|功能校验|L1|打开mysql兼容模式|1. 切换用户插入
|  
|  
|  
|  
|  
|
|12|  
|表类型|L1|打开mysql兼容模式|- 分区表简单覆盖
- 临时表
- dblink远端表
|  
|  
|  
|  
|  
|
|13|  
|结合DQL|L1|打开mysql兼容模式|1. group by/having /order by/connect by/join on 
1. 子查询
1. 操作符：in/not in、exists/not exists 、between and、like/not like
1. filter 比较运算
1. CTE
|  
|  
|  
|  
|  
|
|14|  
|结合DDL|L1|打开mysql兼容模式|1. create table as select
1. create view/materialized view as select
|  
|  
|  
|  
|  
|
|15|  
|结合DML|L1|打开mysql兼容模式|1. insert into values/insert into select
1. update
1. delete
|  
|  
|  
|  
|  
|
|16|  
|绑定参数|L1|打开mysql兼容模式|1. PLSQL
1. JDBC
|  
|  
|  
|  
|  
|
|17|  
|并发|L2|打开mysql兼容模式|1. 多session同时插入
|  
|  
|  
|  
|  
|
