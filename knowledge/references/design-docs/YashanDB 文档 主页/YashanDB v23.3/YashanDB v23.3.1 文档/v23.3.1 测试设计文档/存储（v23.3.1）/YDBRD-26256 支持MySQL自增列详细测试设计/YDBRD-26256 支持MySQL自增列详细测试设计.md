Created by 马爽, last modified on 八月 01, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f6](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f6)    ?    
  #YASHAN-934 【mysql兼容】（功能&语法）支持表的特定特性

SR链接：    [https://pingcode.yasdb.com/pjm/items/66190a50fd997db58ad88503](https://pingcode.yasdb.com/pjm/items/66190a50fd997db58ad88503)    ?    
  #YDBRD-26256 支持MySQL自增列

开发设计文档：    [支持MySQL自增列设计文档 - 李子怡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150612371)  

# 1. 概述

本需求在原有MySql框架基础上支持自增列，包含以下两种方式创建自增列：

1）serial类型  （等价于   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE  ）【暂不支持UNSIGNED】  ；

2）auto_increment属性。

# 2. 需求分析

## 2.1 功能点分析

### 2.1.1 功能语法

**（1）创建自增列（auto_increment属性）**

将table中一列设置为auto_increment属性，需要同时满足以下几个条件：

a.必须是数值类型列（目前支持  TINYINT、SMALLINT、INT、MEDIUMINT、BIGINT、  FLOAT、  DOUBLE  )

b.必须定义了索引，且是索引中的第一列（普通索引、唯一索引、主键索引、外键（约束，必须在mysql模式下创建）、组合索引（普通索引多列））

c.一个表格中有且仅有一个自增列

d.  auto_increment和default不能共同设置

方法一 ——create table时创建自增列：

```
--create tables时指定主键/候选键/外键
create table example (
    id int auto_increment primary key,
    name varchar(50)
) auto_increment = 100;

--create table时创建索引
create table example (
    id int auto_increment,
    name varchar(50),
    index idx_incre(id,name)
) auto_increment = 100;
```

方法二——alter table创建自增列

```
--alter table add column
create table example (
    name varchar(50)
);
alter table example add column id int primary key auto_increment;

--alter table modify/change column
create table example (
    id int,
    name varchar(50)
);
create index idx_incre on example(id,name);
alter table example modify column id int auto_increment;
--存在约束条件：不支持把非自增列改成自增列
```

**（2）insert自增列**

- insert 没有指定，取自增值
- insert 指定为null，取自增值
- insert 指定为0，取自增值(mysql: sql_mode参数NO_AUTO_VALUE_ON_ZERO对主键ID为0的记录有影响。NO_AUTO_VALUE_ON_ZERO 禁用0，只有NULL可以生成下一个序列号)
- insert 指定有效值，取有效值，并回填sequence的值（有效值包含范围内正负数值,，primary key/unique下不能取重复值，下一次自增值将取sequence最大值的下一位）
- insert 指定无效值，报错（非数值类型值、超出范围的数值、primary key/unique下重复值）


**（3）update自增列**

同insert场景一样，个别场景存在差异：

- update 指定为null，报错，自增列不能为null
- update 指定为0，成功后为0
- update 指定为有效值，成功后为有效值（有效值包含范围内正负数值,，primary key/unique下不能取重复值，下一次自增值将取sequence最大值的下一位）
- update 指定无效值，报错（非数值类型、超出范围的数值、primary key/unique下重复值）


**（4）delete自增列**

delete自增列不影响sequence最大值

**（5）truncate自增列**

truncate含有自增列的table不会影响sequence最大值（写入磁盘，重启也不影响），继续insert自增列自增值将取sequence最大值的下一位

**（6）alter table table_name auto_increment=n**

该语句可以修改 auto_increment的值，改变下一次自增值的大小；如果修改 auto_increment的值小于sequence的最大值，sql语句执行成功，但是不生效。

**  (7) 删除自增列**

任意破坏一种或者几种以下条件：

a.alter table modify/drop column使该列不再是数值类型列

b.alter table drop index/key或者直接drop index on table使该列上不再定义了任何索引(会拦截报错），或者不再是任何索引中的第一列（普通索引、唯一索引、主键索引、外键、组合索引）（drop column)

c.在已有自增列的情况下，新增其他自增列拦截报错

d.alter table modify/change column default使该列失去auto_increment属性

### 2.1.2 系统表

新增系统表：  IDNSEQ$——记录identity列与sequence的对应关系

|字段|说明|
|---|---|
|OBJ# |为表的OBJ#|
|COL#|为列ID|
|SEQOBJ#|为sequence OBJ#|
|STARTWITH|初始值，默认为1|


### 2.1.3 观测视图

information_schema.tables 中的auto_increment 字段；

information_schema.columns 中的extra字段是否有auto_increment。

## 2.2 应用场景

### 2.2.1 需求本身的主要应用场景

1. 自动编号：每当向数据库表中添加一条新记录时，auto_increment属性会自动为这个新记录生成一个唯一的编号。这样就不需要手动为每条记录指定一个编号了，既省时又省力。
1. 唯一性保证：由于auto_increment生成的编号是唯一的，所以可以确保数据库表中的每一条记录都有一个独一无二的标识。这对于管理和查询数据非常重要。
1. 方便查询：有了这个唯一的编号（通常称为主键），就可以很容易地找到并访问数据库表中的任何一条记录。


### 2.2.2 需求与其他特性的关联场景

1. auto_increment属性与索引、column属性交互
1. 事务并发场景下auto_increment属性处理自增值（默认与mysql 5.7版本保持一致，  innodb_autoinc_lock_mode=1表现）


## 2.3 规格约束

### 2.3.1 需求定义的规格、约束，系统/模块上下文等

- 交付形态：单机以及单机ha
- 支持对象：普通表（heap），分区表和临时表暂不支持


### 2.3.2 内部机制涉及的规格约束

- 自增列只允许定义在数据类型列（yashandb目前支持  TINYINT、SMALLINT、INT、MEDIUMINT、BIGINT、  FLOAT、  DOUBLE  )
- 自增列上必须定义索引，且是索引的第一列  （普通索引、唯一索引、主键索引、外键、组合索引）
- 一个表格中只能有一个自增列
- 自增列属性不允许设置成default
- 不支持通过alter table change/modify column把非自增列改成自增列(放开后需要补测）


# 3. 详细测试设计

## 3.1 测试设计方法

1.针对创建自增列需要的条件约束，可以分为有效等价类和无效等价类，并结合正交法进行测试

2.对自增列做dml和ddl操作，针对不同的取值自增列有不同的表现，因此采用场景法，还需要考虑到自增列取值范围，采用边界值法

3.除次之外，还需要考虑到事务并发场景下自增列的处理，采用场景法（采用mysql的连续模式innodb_autoinc_lock_mode=1）

4.针对系统表和观测视图的测试，可以采用公共项测试

## 3.2 详细测试设计

### 3.2.1 专项覆盖

|系统级DFX分类|是否涉及|备注|
|:---|:---|---|
|CT|涉及|考虑事务并发场景下自增列的处理|
|KT|不涉及|  
|
|长稳|不涉及|  
|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR|不涉及|  
|
|HA|不涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|


### 3.2.2 基础测试场景

|  
|测试项|输入项|有效等价类|无效等价类|备注|
|---|---|---|---|---|---|
|1|创建自增列|sql语法|1、create table,2、alter table add column,3、alter table modify column,4、alter table change column|  
|  
|
|2|  
|数据类型|数值类型,1、TINYINT,2、SMALLINT,3、INT,4、BIGINT,5、  FLOAT（存在精度损失和自增值不连续或者不准确的情况）,6、  DOUBLE（存在精度损失和自增值不连续或者不准确的情况）,7、mediumint,8、boolean等价于tinyint(1)|非数值类型,1、字符型（  CHAR、VARCHAR、NCHAR和NVARCHAR）,2、日期时间型（  （DATE、TIME、IMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND）,3、大对象型（BLOB、CLOB和NCLOB）,4、raw类型,5、JSON类型,6、XMLTYPE类型,7、ROWID类型,8、UDT类型,9、ST_GEOMETRY类型,10、BOX2D类型,11、BIT类型,12、DECIMAL（兼容NUMBER）|  
|
|3|  
|定义索引且是索引的第一列|1、普通索引,2、唯一索引,3、主键索引,4、组合索引,5、外键|非索引第一列|  
|
|4|  
|自增列数量|一列|多列|  
|
|5|  
|column属性|auto_increment|1、default,2、check|  
|
|6|insert自增列|insert方式|1、简单插入（可以预先确定需要取多少自增值）,2、批量插入（使用表级锁直至inser语句执行完成）,3、混合插入（预先分配自增值，多余丢弃）|  
|  
|
|7|  
|自增列插入值|1、不指定,2、null,3、0(mysql: sql_mode参数NO_AUTO_VALUE_ON_ZERO对主键ID为0的记录有影响。NO_AUTO_VALUE_ON_ZERO 禁用0，只有NULL可以生成下一个序列号，ha场景下当实例生效),4、有效值,（有效值包含范围内正负数值,，primary key/unique下不能取重复值，下一次自增值将取sequence最大值的下一位）|无效值,（非数值类型给、超出范围的数值、primary key/unique下重复值）|  
|
|8|  
|session|1、单session insert commit,2、单session insert rollback,3、多session insert commit（主要检验混合插入）,4、多session insert rollback（主要检验混合插入）,5、多session insert commit+rollback（主要检验混合插入）|  
|  
|
|9|update自增列|自增列更新值|1、0,2、有效值,（有效值包含范围内正负数值,，primary key/unique下不能取重复值，下一次自增值将取sequence最大值的下一位）|1、null,2、无效值,（非数值类型、超出范围的数值、primary key/unique下重复值）|  
|
|10|  
|session|1、单session update+insert commit,2、单session update+insert rollback,3、 多session update+insert commit（主要检验混合插入）,4、多session update+insert rollback（主要检验混合插入）,5、多session update+insert commit+rollback（主要检验混合插入）|  
|  
|
|11|delete自增列|自增列删除值|表内的数据|非表内的数据|  
|
|12|truncate含有自增列的表格|truncate table|1、重要需要测试truncate table之后再次insert自增列取值,2、发散测试，db重启之后再次inser自增列取值（故障）|  
|内嵌sequence最大取值落盘，重启无影响|
|13|alter table table_name auto_increment=n|n的取值|1、n大于sequence的最大值,2、在number类型下需要考虑取范围内小数,3、在float类型下需要考虑取范围内小数,4、在double类型下需要考虑取范围内小数|1、n小于sequence的最大值（成功，不生效）,2、n等于sequence的最大值（成功，不生效）,3、n取值超出数值范围,4、n取值非数值类型|  
|
|14|删除自增列|sql语法|1、drop index/alter table drop index,2、alter table modify/change column,3、drop column|  
|  
|
|15|  
|数据类型|1、修改自增列非数值类型列|  
|  
|
|16|  
|定义索引且是索引的第一列|1、修改自增列上没有定义索引,2、修改自增列非索引第一列|  
|  
|
|17|  
|自增列数量|定义多个自增列|  
|  
|
|18|  
|column属性|1、修改column属性不带auto_increment,2、修改column属性为default|  
|  
|


### 3.2.3 其他测试场景

|  
|测试项|测试场景|预期|备注|
|---|---|---|---|---|
|1|事务并发（CT)|简单插入+简单插入|业务下发正常，不卡不core|  
    
    
,连续模式（innodb_autoinc_lock_mode=1）是对传统模式的优化，对于批量插入这种不确定需要需要多少自增值的insert，会和传统模式一样，使用表级锁直至insert语句执行完成。,而对于可以事先确定插入记录数的简单插入，MySQL会用mutex（闩，更轻量级的锁）仅在预先分配自增值时锁定，在insert语句执行完成前就已经释放了。连续模式也可以保证基于语句的复制主从可以生成相同的自增值，但性能比传统模式更好。,对于混合插入类型（多行简单插入中，部分行显式指定自增值，部分行未指定），连续模式下会预先生成比要插入行更多的自增值，然后以连续方式分配给需要自增的行，多余的值就丢弃了。,  
    
    
    
|
|2|  
|简单插入+批量插入|业务下发正常，不卡不core||
|3|  
|简单插入+混合插入|业务下发正常，不卡不core||
|4|  
|批量插入+批量插入|业务下发正常，不卡不core||
|5|  
|批量插入+混合插入|业务下发正常，不卡不core||
|6|  
|混合插入+混合插入|业务下发正常，不卡不core||
|7|  
|简单插入+批量插入+混合插入|业务下发正常，不卡不core||
|~~8~~|~~导入导出~~|~~普通导入+自增列为null，导入后导出~~|~~导入导出成功~~|~~开发未适配，不支持~~    
    
    
    
|
|~~9~~|  
|~~普通导入+自增列为null和有效值混合，导入后导出~~|~~导入导出成功~~||
|~~10~~|  
|~~并行导入+自增列为null，导入后导出~~|~~导入导出成功~~||
|~~11~~|  
|~~并行导入+自增列为null和有效值混合，导入后导出~~|~~导入导出成功~~||
|12|故障场景|创建自增列insert数据后kill db，故障后重启，继续insert+update+delete数据  （没提交新主会取到重复值）|故障后继续下发业务正常|  
|
|13|  
|创建自增列insert数据后shutdown immedaite，重启db，继续insert+update+delete数据  （没提交新主会取到重复值）|故障后继续下发业务正常|  
|
|14|  
|创建自增列insert数据后shutdown abort，重启db，继续insert+update+delete数据  （没提交新主会取到重复值）|故障后继续下发业务正常|  
|
|15|  
|创建自增列insert数据后提交备升主，新主继续insert+update+delete数据（没提交新主会取到重复值）|备升主之后自增值连续|  
|
|16|系统表、视图公共项|系统表字段值、视图字段值可正常插入、显示正确、无乱码|操作正常|  
|
|17|  
|系统表字段值、视图字段值在资料文档中显示正确|操作正常|  
|
|18|  
|系统表字段值、视图字段值在业务过程中可正常查询|操作正常|  
|
|19|  
|系统表字段值、视图字段值无法更新|操作拦截|  
|
|20|  
|用户对于内嵌sequence可以查到sequence，但是无法使用操作sequence|操作拦截|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

### 4.1冒烟用例

### 4.2测试用例

# 5. 测试框架设计

|用例框架|用例路径|备注|
|---|---|---|
|yasft|standalone/expect/ddl_01/My_SQL/information_schema|30|
|ha|ha/ha_heap/testcase/ha_schedule_common/DDL/My_SQL|3|
|CT|待补充上库|  
|


# 6. 测试环境说明

*linux arm环境*

# 7. 工作量评估

工作量：14  *人天*

计划测试完成时间：2024/7/26

实际测试完成时间：2024/7/30

# 8. 相关知识说明

### 8.1 数值类型取值范围

|类型|字节长度|值域|可保证准确的十进制精度|
|---|---|---|---|
|TINYINT|1|[-2  7     , 2  7     - 1]|  
|
|SMALLINT|2|[-2  15  , 2  15     - 1]|  
|
|INT|4|[-2  31  , 2  31     - 1]|  
|
|BIGINT|8|[-2  63  , 2  63     - 1]|  
|
|NUMBER|1~22|0    
  绝对值[1E-130，1E126)|通过十进制精度（Decimal Precision，数字0~9）存储，在值域和精度范围以内的十进制数字都可以被准确的存储。|
|FLOAT|4|[-3.402823E38, -1.401298E-45]    
  0    
  [1.401298E-45, 3.402823E38]    
  数字3.402823和1.401298为四舍五入的值，非最精确值|6位|
|DOUBLE|8|[-1.79769313486232E308, -4.94065645841247E-324]    
  0    
  [4.94065645841247E-324, 1.79769313486232E308]    
  数字1.797693134862315807和4.94065645841247为四舍五入的值，非最精确值|15位|


# 9. 上车工程分析

上车工程链接：    [Agile_dev_L2_Build #235 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_dev_L2_Build/235/)  

|序号|工程链接|失败用例|解决措施|备注|
|---|---|---|---|---|
|  
|单机|  
|  
|  
|
|1|  [Agile_L2_sa_upgrade_FT_1_docker #4101 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4101/)  |  
|共性问题，忽略|  
|
|2|  [Agile_L2_sa_heap_yasft_arm #3828 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/3828/)  |/datatype/mysql_variables/sqlmode_ansi_quotes—刷新预期（3）,/ddl_01/My_SQL/information_schema—刷新预期（3）,/ddl_03/mysql/view—未分析出原因，跑lastfail,/dml2/ppd/lj_rj/heap/test_sdv_ppd_rj_01—未分析出原因，跑lastfail,![](https://pingcode.yasdb.com/atlas/files/public/67396e858970c2af4f521926/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUNBQ0FBQUFBQUFBQUFBQUFBQkFBU0FBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFRSUFBQUFBQUFBQUFBQXdBQUFBQUFRQUFBQUFBQUFFQUFBUUFBQUFBQUFBQUFDQUFBQUlBQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBUUFBQUFnQUlBQUFFQUFBQkFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc2NzcsImV4cCI6MTc4MjQ0ODQ3N30.7D_S6YsjN_DS1WN9yLsf2bjeWL3jN1cWTVVjPA1Zjaw),/function5/test_sdv_setOp/heap—未分析出原因，跑lastfail,![](https://pingcode.yasdb.com/atlas/files/public/67396e858970c2af4f521927/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUNBQ0FBQUFBQUFBQUFBQUFBQkFBU0FBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFRSUFBQUFBQUFBQUFBQXdBQUFBQUFRQUFBQUFBQUFFQUFBUUFBQUFBQUFBQUFDQUFBQUlBQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBUUFBQUFnQUlBQUFFQUFBQkFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc2NzcsImV4cCI6MTc4MjQ0ODQ3N30.7D_S6YsjN_DS1WN9yLsf2bjeWL3jN1cWTVVjPA1Zjaw),/plsql/bind_variable_peeking/heap/Anonymous--排查用例，关闭mysql兼容,/storage/system_oid/test_sdv_single_oid_01--刷新预期（1）|跑lastfail,  [Agile_L2_sa_heap_yasft_arm #3844 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/3844/)  ,剩余失败用例跟代码无关，忽略|  
|
|3|  [Agile_L2_sa_HA_heap_driver_c_arm #2260 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_HA_heap_driver_c_arm/2260/)  |- yacDirectExecute(stmt1, "select 1 from dual", sqlLength) == YAC_ERROR|跑lastfail，已绿,  [Agile_L2_sa_HA_heap_driver_c_arm #2266 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_HA_heap_driver_c_arm/2266/)  |  
|
|4|  [Agile_L2_sa_FT_sqlloader_2_docker #3784 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_2_docker/3784/)  |./testcase/sa/sqlloader2/subpartition_table/lsc/test_sqlloader_lsc_19.py|跑lastfail，已绿,  [Agile_L2_sa_FT_sqlloader_2_docker #3790 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_2_docker/3790/)  |  
|
|5|  [Agile_L2_sa_tac_yasft_arm #3262 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3262/)  |/function2/dbms_stats/for_all_indexed_columns/tac/test_sdv_YDBRD_21459_022_tac---报错,YAS-02702 failed to gather statistics, reason: failed to allocate 32256016 bytes, ColumnarVmBuffer is not enough|跑lastfail，已绿,  [Agile_L2_sa_tac_yasft_arm #3272 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3272/)  |  
|
|  
|集群|  
|  
|  
|
|1|  [Agile_L2_cluster_heap_TX_3_debug_arm #2560 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_TX_3_debug_arm/2560/)  |集群环境搭建失败,  
|重跑，已绿,  [Agile_L2_cluster_heap_TX_3_debug_arm #2570 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_TX_3_debug_arm/2570/)  |  
|
|2|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3141 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3141/)  |/dml2/ppd/lj_rj/heap/test_sdv_ppd_rj_01–未分析出原因，跑lastfail,/function5/test_sdv_setOp/heap--未分析出原因，跑lastfail|跑lastfail,  [Agile_L2_cluster_heap_yasft_sa_case_arm [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/)  ,剩余失败用例跟代码无关，忽略|  
|
|3|  [Agile_L2_cluster_yasft_cluster_case_arm #3328 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3328/)  |/system_view/share_pool/test_YDBRD-28580_CLUSTER_pool_02--报错YAS-04253 PL/SQL compiling errors:    
  [4:16] YAS-00103 no free block in sql main pool part 0,/system_view/test_sdv_ydbrd_15210/Cluster_dynamic_view–未分析出原因,![](https://pingcode.yasdb.com/atlas/files/public/67396e85a1ad9a3311dc979a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUNBQ0FBQUFBQUFBQUFBQUFBQkFBU0FBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFRSUFBQUFBQUFBQUFBQXdBQUFBQUFRQUFBQUFBQUFFQUFBUUFBQUFBQUFBQUFDQUFBQUlBQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBUUFBQUFnQUlBQUFFQUFBQkFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc2NzcsImV4cCI6MTc4MjQ0ODQ3N30.7D_S6YsjN_DS1WN9yLsf2bjeWL3jN1cWTVVjPA1Zjaw),/ycr/common/test_sdv_cluster_ycr_show_config_002--报错YAS-05555 YFS is not initialized by current instance.|跑lastfail,  [Agile_L2_cluster_yasft_cluster_case_arm #3343 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3343/)  ,剩余失败用例跟代码无关，忽略|  
|
|4|  [Agile_L2_cluster_yasft_ycs_arm #2917 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/2917/)  |/yasboot/yasboot_yascsm--Connection to node2 refused. Check that the hostname and port are correct|跟代码无关，忽略|  
|
|5|  [Agile_L2_cluster_driver_c_arm #2243 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_c_arm/2243/)  |搭建集群失败|重跑，已绿,  [Agile_L2_cluster_driver_c_arm #2251 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_c_arm/2251/)  |  
|
|6|  [Agile_L2_cluster_FT_ha_arm #495 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/495/)  |YAS-05532 YFS file block is corrupted, diskgroup: SYSTEM, fd: 257, block type: 0, block id: 0.搭建集群失败|重跑,已绿,  [Agile_L2_cluster_FT_ha_arm #506 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/506/)  |  
|
|7|  [Agile_L2_cluster_backup_arm_3 #1318 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/1318/)  | backup/backup_yasrman/test_cluster_yasrman_13.py--dev分支core问题    
    [https://pingcode.yasdb.com/pjm/items/66a46ce08f5ee1917346b1af](https://pingcode.yasdb.com/pjm/items/66a46ce08f5ee1917346b1af)    ?    
  #YDBRD-30853 【YCS支持多盘】【YFS】上车工程Agile_L2_cluster_backup_arm_3执行到test_cluster_yasrman_13.py用例时出现 core在”appDirAdd“路径上引发YFS fatal error    
|忽略|  
|
|8|  [Agile_L2_cluster_driver_odbc_arm #2180 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_odbc_arm/2180/)  |搭建集群失败|重跑，已绿,  [Agile_L2_cluster_driver_c_arm #2251 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_c_arm/2251/)  |  
|
|9|  [Agile_L2_cluster_jdbc_arm #974 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/974/)  |搭建集群失败|重跑，已绿,  [Agile_L2_cluster_jdbc_arm #983 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/983/)  |  
|
|10|  [Agile_L2_cluster_driver_python_arm #2189 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_python_arm/2189/)  |搭建集群失败|重跑，已绿,  [Agile_L2_cluster_driver_python_arm #2197 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_python_arm/2197/)  |  
|
|  
|分布式|  
|  
|  
|
|1|  [Agile_L2_dst_lsc_yasft_arm #2709 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/2709/)  |比对失败，被abort重跑|重跑，已绿,  [Agile_L2_dst_lsc_yasft_arm #2724 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/Agile_L2_dst_lsc_yasft_arm/2724/)  |  
|
|2|  [Agile_L2_dst_HA_yasft_arm #2045 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/2045/)  |/tac/multicn/privilege/test_role_privilege/tac--刷新预期（2）|  
|  
|
|3|  [Agile_L2_dst_tac_yasft_arm #2527 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2527/)  |/function1/json_query/tac,/function1/merge_into/merge_full_join_result/tac,![](https://pingcode.yasdb.com/atlas/files/public/67396e858970c2af4f521928/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUNBQ0FBQUFBQUFBQUFBQUFBQkFBU0FBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFRSUFBQUFBQUFBQUFBQXdBQUFBQUFRQUFBQUFBQUFFQUFBUUFBQUFBQUFBQUFDQUFBQUlBQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBUUFBQUFnQUlBQUFFQUFBQkFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc2NzcsImV4cCI6MTc4MjQ0ODQ3N30.7D_S6YsjN_DS1WN9yLsf2bjeWL3jN1cWTVVjPA1Zjaw),/function1/merge_into/merge_anti_join_in_result/tac,/function1/merge_into/merge_left_join_result/tac/test_sdv_merge_left_join_combination_explain,/function1/merge_into/merge_right_join_result/tac/test_sdv_merge_right_join_combination_result,–节点重启,/function1/merge_into/merge_inner_join_result/tac/test_sdv_merge_inner_join_combination_result,![](https://pingcode.yasdb.com/atlas/files/public/67396e85a1ad9a3311dc979b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUNBQ0FBQUFBQUFBQUFBQUFBQkFBU0FBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFRSUFBQUFBQUFBQUFBQXdBQUFBQUFRQUFBQUFBQUFFQUFBUUFBQUFBQUFBQUFDQUFBQUlBQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBUUFBQUFnQUlBQUFFQUFBQkFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc2NzcsImV4cCI6MTc4MjQ0ODQ3N30.7D_S6YsjN_DS1WN9yLsf2bjeWL3jN1cWTVVjPA1Zjaw),  
|跑lastfail，已绿,  [Agile_L2_dst_tac_yasft_arm #2540 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2540/)  |  
|
|4|  [Agile_L2_dst_lsc_KT_docker #3673 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_KT_docker/3673/)  |执行结束，清理docker失败|忽略|  
|


## Attachments:

[YDBRD-26256 支持MySQL自增列文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODRhMWFkOWEzMzExZGM5NzkyIiwicmVmX2lkIjoiNjczOTZlODQ3MjgyMDZlZmI5MmYyOGNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3Njc3LCJleHAiOjE3ODI1MjQwNzd9.twAZ2hjZeoZiqgIjwkQrOtWMUAWfMUwUo2tYXBp9GZc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26256 支持MySQL自增列文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODRhMWFkOWEzMzExZGM5NzkzIiwicmVmX2lkIjoiNjczOTZlODQ3MjgyMDZlZmI5MmYyOGNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3Njc3LCJleHAiOjE3ODI1MjQwNzd9.daofvvfT3s1Go8F2np3hxlmgmrWWiqWZdfTvU-swZIs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26256 支持MySQL自增列文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODQ4OTcwYzJhZjRmNTIxOTIwIiwicmVmX2lkIjoiNjczOTZlODQ3MjgyMDZlZmI5MmYyOGNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3Njc3LCJleHAiOjE3ODI1MjQwNzd9.CO6TbwcHYvBKiedH2Mnf02DZl9nRsAq8mALFN6Qlr_c)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-7-8_16-14-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODRhMWFkOWEzMzExZGM5Nzk0IiwicmVmX2lkIjoiNjczOTZlODQ3MjgyMDZlZmI5MmYyOGNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3Njc3LCJleHAiOjE3ODI1MjQwNzd9.Z1vyBM_tGVaqX1whSp6BQKOZE2DMqY8bPpdsENVkgzw)

 (image/png)    


[YDBRD-26256 支持MySQL自增列冒烟用例 .xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODRhMWFkOWEzMzExZGM5Nzk1IiwicmVmX2lkIjoiNjczOTZlODQ3MjgyMDZlZmI5MmYyOGNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3Njc3LCJleHAiOjE3ODI1MjQwNzd9.If9kRmofxUS8YckTU663z8Q6DCdWfp0VwaRjoUwfDB4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26256 支持MySQL自增列冒烟用例 .xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODRhMWFkOWEzMzExZGM5Nzk2IiwicmVmX2lkIjoiNjczOTZlODQ3MjgyMDZlZmI5MmYyOGNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3Njc3LCJleHAiOjE3ODI1MjQwNzd9.tXBeV_QBglWah12hcxYYdT6lxntTFdiPdDWZz-1Nlao)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-7-31_15-31-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODQ4OTcwYzJhZjRmNTIxOTIxIiwicmVmX2lkIjoiNjczOTZlODQ3MjgyMDZlZmI5MmYyOGNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3Njc3LCJleHAiOjE3ODI1MjQwNzd9.zgUQJBmC6HSD7qiGDkQrjVCbXUHL_Eh8LnkOGRvw-pc)

 (image/png)    


[YDBRD-26256 支持MySQL自增列文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODVhMWFkOWEzMzExZGM5Nzk4IiwicmVmX2lkIjoiNjczOTZlODQ3MjgyMDZlZmI5MmYyOGNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3Njc3LCJleHAiOjE3ODI1MjQwNzd9.429JI6AQW0m55tLT8Xzqychh7bvS1vO4G45sBGXZViY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26256 支持MySQL自增列冒烟用例 .xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODVhMWFkOWEzMzExZGM5Nzk5IiwicmVmX2lkIjoiNjczOTZlODQ3MjgyMDZlZmI5MmYyOGNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3Njc3LCJleHAiOjE3ODI1MjQwNzd9.M3rYJ2J3AGfmLmB70A0MQTgbvywOIx8q01UQlwVTojo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
