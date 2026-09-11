Created by 陈钦卿, last modified on 十一月 15, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/670e12b7e489dd0868f7b1bb](https://pingcode.yasdb.com/pjm/items/670e12b7e489dd0868f7b1bb)    ?#YDBRD-34208 【mysql兼容】兼容与MYSQL LAST_INSERT_ID函数规格

开发设计：    [MYSQL支持LAST_INSERT_ID函数设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=177841402)  

交付形态：单机

# 2. 需求分析

## 2.1 功能点分析

兼容mysql last_insert_id函数

## 2.2 应用场景

1、mysql模式：alter session set compat_vector=mysql;

创建含自增属性的表：create table test （c1 int primary key   **auto_increment**  ，c2 int）；

insert插入改变自增列的值，last_insert_id返回值相应改变。

2、mysql模式下，创建序列是否同样会改变last_insert_id返回值

alter session set compat_vector=mysql;

create sequence test_seq_29534_01 start with 1 increment by 1 NOMAXVALUE;

create table test_tb_29534_01 (id bigint PRIMARY KEY   **default test_seq_29534_01.nextval**   ,name varchar(20));

insert into test_tb_29534_01(name) values('test');

select last_insert_id() from dual;

## 2.3 规格约束

mysql返回warning，yashan报错

1、当插入失败时（譬如主键冲突），插入失败时last_insert_id不更新

2、支持insert into select

3、当前last_insert_id函数返回值为bigint，不做复杂类型推导

4、支持绑定参数批量插入：

for jdbc：jdbc有两种插入方式，一种是拼SQL：

- insert into xxx values (),(),(),(),()，参数：  useServerPrepStmts=false，此种方式返回批次第一行结果
- COM_PREPARE+COM_EXECUTE，参数：useServerPrepStmts=true，此种方式返回批次最后一行结果（本质不是批量，其实是一行一个数据包，对应一次插入）


5、rollback不会影响last_insert_id返回的值

6、如果当前执行的stmt中引用了last_insert_id()，那么last_insert_id()不受当前stmt内更新的值影响：

|  `insert into t_last (col2) values (last_insert_id()),(last_insert_id()),(last_insert_id());`  |
|:---|


7、  列创建后被修改为auto_increment，last_insert_id()不会立即更新，只会在下一次插入后更新

8、  显式赋值不会使last_insert_id返回值得到更新，当显式赋值后第一次隐式更新auto_increment，last_insert_id返回值将变成其原有最大值+1

9、如果存储过程中有insert修改了last_insert_id，那么同一存储过程中，此insert结束后，last_insert_id变更

10、触发器内部的insert不会更新last_insert_id();的值：  先不对齐，做成规格体现在文档里

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


  


|测试场景|测试项一|测试项二|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|参数校验|参数|个数|0个、1个|2个|  
|
|  
|  
|类型|- 常量：整数，小数，科学计数法，0，1，null，空，b'11'
- 变量：字段
- 覆盖所有数据类型：  tinyint、smallint、mediumint、int、bigint、float、double、decimal、char、varchar、  TINYTEXT/TINYBLOB、TEXT/BLOB、MEDIUMTEXT/MEDIUMBLOB  、  LONGTEXT/LONGBLOB、  date、time、timestamp、bit、  BINARY、VARBINARY
- 表达式：布尔表达式、运算表达式、null表达式、连接符运算
- 内置函数：数值函数、字符函数、日期函数、转换函数、其他函数、窗口函数、聚集函数、  单独为MySQL模式提供的内置函数
- 子查询
|- 字符，表情；
-1——  yashan返回9 223 372 036 854 775 807- 超过int64最大值，报错——mysql超过uint64返回warning
|浮点数四舍五入|
|函数校验|返回值类型|bigint(20)（yashan）|  
|  
|显示宽度（zerofill属性-yashan不支持）|
|  
|函数名|- 大小写、拼写错误、名称缺失、带单双引号
- 与表/视图同名
- v$function新增函数名
|  
|  
|  
|
|  
|自嵌套|127层、128层|  
|  
|  
|
|功能校验|AUTO_INCREMENT|自增列类型（只能为整数）：tinyint,smallint, mediumint, int, bigint（mysql）|  
|  
|  
|
|  
|  
|指定自增字段初始值，AUTO_INCREMENT = n|建表时指定/  alter table … auto_increment=n|  
|  
|
|  
|  
|达到上限，AUTO_INCREMENT 会失效，last_insert_id不变|  
|  
|  
|
|  
|  
|表中无自增列，  last_insert_id无效|  
|  
|  
|
|  
|  
|创建表后，修改列为auto_increment|last_insert_id()不会立即更新|  
|  
|
|  
|  
|只要有索引就可以|  
|  
|  
|
|  
|无插入|  
|返回0|  
|  
|
|  
|插入失败|- 事务表回滚/rollback，  last_insert_id()不会回滚
- 非空
- 违反唯一约束
- 违反表中其他唯一键时，自增值不连续
|  
|  
|  
|
|  
|插入成功（  插入不同表？--last_insert_id跟随最近更新的表  ）|- insert单行
- insert多行（返回第一行的AUTO_INCREMENT）
|  
|  
|  
|
|  
|  
|insert方式,- insert
- insert into select
- INSERT ... ON DUPLICATE KEY UPDATE – 不影响
- replace into – yashan不支持
|  
|  
|insert ignore？|
|  
|  
|显式赋值,- 连续
- 不连续
- 小于当前  last_insert_id
|  
|  
|  
|
|  
|修改表自增列后插入|  
|  
|  
|  
|
|  
|truncate/delete表改变自增初始值|再次insert后，  last_insert_id()相应改变|  
|  
|  
|
|  
|sql_mode=NO_AUTO_VALUE_ON_ZERO   – yashan不支持|插入0后自增列不自增，仍为0|  
|  
|  
|
|  
|drop表|不改变  last_insert_id()|  
|  
|  
|
|  
|  
|重建同名表并插入   – 不影响|  
|  
|  
|
|  
|from|dual|  
|  
|  
|
|  
|  
|空表|  
|  
|  
|
|  
|  
|插入表|  
|  
|  
|
|  
|  
|其他表|  
|  
|  
|
|  
|  
|view|  
|  
|  
|
|  
|表类型|仅heap|  
|  
|  
|
|  
|  
|非分区表、分区表（hash、list、range、interval）|  
|  
|  
|
|  
|  
|分布表、复制表（不支持分布式）|  
|  
|  
|
|  
|  
|临时表|  
|  
|  
|
|  
|  
|dblink远端表|  
|  
|  
|
|  
|调整自增偏移量|**auto_increment_offset**  和（调整初始值）  **auto_increment_increment**  （调整步长）|yashan不生效|  
|不支持指定步长|
|  
|切换用户插入|last_insert_id相应改变？  -- 不影响|  
|  
|  
|
|函数语法位置|DQL|group by/having /order by/connect by/join on |  
|  
|  
|
|  
|  
|子查询|  
|  
|  
|
|  
|  
|操作符：in/not in、exists/not exists 、between and、like/not like|  
|  
|  
|
|  
|  
|filter 比较运算|  
|  
|  
|
|  
|  
|CTE|  
|  
|  
|
|  
|  
|列别名|  
|  
|  
|
|  
|DDL|create table as select|  
|  
|  
|
|  
|  
|create view/materialized view as select|  
|  
|  
|
|  
|DML|insert into values/insert into select|  
|  
|  
|
|  
|  
|update|  
|  
|  
|
|  
|  
|delete|  
|  
|  
|
|  
|绑定参数执行|plsql|过程，函数，触发器|  
|- 如果存储过程执行了更改  LAST_INSERT_ID()  值的语句，则过程调用之后的语句就会看到修改后的值。
- 对于更改值的存储函数和触发器，当函数或触发器结束时，将恢复该值，因此后续语句将不会看到更改的值。  —— 会改变
|
|  
|  
|jdbc|  
|  
|  
|
|并发|生成的id各客户端独立，不受其他客户端的影响，也无需锁定或事务|开启多个会话|session1插入，session2查询——session2不变,多session同时插入——各session相应改变|  
|  
|
|mysql导入|mysql模式下能否使用load data？影响last_insert_id？  —— 需要测试|  
|  
|  
|  [MySQL 导入数据 | 菜鸟教程 (runoob.com)](https://www.runoob.com/mysql/mysql-database-import.html)  ,yashan表现,create table tt (a int primary key auto_increment,b int) auto_increment=2;,![](https://pingcode.yasdb.com/atlas/files/public/67396ef7a1ad9a3311dc9b33/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0VBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc5MzYsImV4cCI6MTc4MjQ2ODczNn0.1aCqPV-XaUCAj-MGRey400oO_WSMQ5pjGhoS9CI9K_k),mysql表现,![](https://pingcode.yasdb.com/atlas/files/public/67396ef78970c2af4f521cc2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0VBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc5MzYsImV4cCI6MTc4MjQ2ODczNn0.1aCqPV-XaUCAj-MGRey400oO_WSMQ5pjGhoS9CI9K_k)|


|系统级DFX分类|是否涉及|测试点|
|:---|:---|:---|
|CT|  
|是|
|KT|  
|是|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|  
|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


  


- yasft


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

