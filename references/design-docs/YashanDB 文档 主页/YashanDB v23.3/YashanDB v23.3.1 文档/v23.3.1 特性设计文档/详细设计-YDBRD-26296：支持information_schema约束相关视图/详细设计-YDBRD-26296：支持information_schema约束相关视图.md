Created by 郑翌恺 on 八月 23, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66192bcffd997db58ad8a622](https://pingcode.yasdb.com/pjm/items/66192bcffd997db58ad8a622)    *?*    
  *#YDBRD-26296 支持information_schema约束相关视图*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

支持约束相关视图，包括  REFERENTIAL_CONSTRAINTS、TABLE_CONSTRAINTS、KEY_COLUMN_USAGE(参考mysql 5.7)、CHECK_CONSTRAINTS(参考mysql 8.0)

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

#### 2.1 TABLE_CONSTRAINTS：约束信息

|字段名|含义|type|备注|
|---|---|---|---|
|CONSTRAINT_CATALOG|约束所属目录名称，始终为def|CHAR(3)|def含义？,原文：,The name of the catalog to which the constraint belongs. This value is always     .       `def`  |
|CONSTRAINT_SCHEMA|约束所属用户（数据库）|VARCHAR(64)|  
|
|CONSTRAINT_NAME|约束名称|VARCHAR(64)|  
|
|TABLE_SCHEMA|表所属用户（数据库）|VARCHAR(64)|  
|
|TABLE_NAME|表名|VARCHAR(64)|  
|
|CONSTRAINT_TYPE|约束类型，  UNIQUE，PRIMARY KEY，FOREIGN KEY或CHECK|VARCHAR(6)|yashan用U/P/R/C来标识4种约束，此外还有,视图的with read only约束（不显示）,视图的with check option约束（不显示）,UNKNOW（不显示）|


#### 2.2 REFERENTIAL_CONSTRAINTS：外键信息

|字段名|含义|type|备注|
|---|---|---|---|
|CONSTRAINT_CATALOG|约束所属目录名称，始终为def|CHAR(3)|  
|
|CONSTRAINT_SCHEMA|约束所属用户（数据库）|VARCHAR(64)|  
|
|CONSTRAINT_NAME|约束名称|VARCHAR(64)|  
|
|UNIQUE_CONSTRAINT_CATALOG|外键约束引用的唯一/主键约束的目录的名称，始终为def|CHAR(3)|  
|
|UNIQUE_CONSTRAINT_SCHEMA|外键约束引用的唯一/主键约束的用户（数据库）的名称|VARCHAR(64)|  
|
|UNIQUE_CONSTRAINT_NAME|外键约束引用的唯一/主键约束的名称|VARCHAR(64)|  
|
|MATCH_OPTION|约束MATCH属性的值，唯一有效值为NONE|CHAR(4)|唯一有效值为NONE含义？,原文：,The value of the constraint     attribute. The only valid value at this time is     .    `NONE`  |
|UPDATE_RULE|级联更新规则，  CASCADE，SET NULL，SET DEFAULT，RESTRICT，NO ACTION|VARCHAR(9)|yashan实现的级联更新/删除规则只有,NO ACTION/CASCADE/SET NULL，默认  no action转成restrict,  
,mysql默认规则  RESTRICT,建restrict约束会解析成no action|
|DELETE_RULE|级联删除规则，  CASCADE，SET NULL，SET DEFAULT，RESTRICT，NO ACTION|VARCHAR(9)|  
|
|TABLE_NAME|约束表名|VARCHAR(64)|  
|
|REFERENCED_TABLE_NAME|约束引用的表的名称|VARCHAR(64)|  
|


#### 2.3 KEY_COLUMN_USAGE：描述哪些键有约束，dba_con_columns

|字段名|含义|type|
|---|---|---|
|CONSTRAINT_CATALOG|约束所属目录名称，始终为def|CHAR(3)|
|CONSTRAINT_SCHEMA|约束所属用户（数据库）|VARCHAR(64)|
|CONSTRAINT_NAME|约束名称|VARCHAR(64)|
|TABLE_CATALOG|表所属目录名称，始终为def|CHAR(3)|
|TABLE_SCHEMA|表所属用户（数据库）|VARCHAR(64)|
|TABLE_NAME|表名|VARCHAR(64)|
|COLUMN_NAME|具有约束的列名，如果约束是外键，则该项为外键的列，不是外键引用的列|VARCHAR(64)|
|ORDINAL_POSITION|列在约束内的位置，从1开始编号|INTEGER|
|POSITION_IN_UNIQUE_CONSTRAINT|对于唯一和主键约束，该项为NULL，,对于外键约束，该项为外键约束引用的唯一/主键约束的键中序号位置,无check约束|INTEGER|
|REFERENCED_TABLE_SCHEMA|约束引用的用户（数据库）|VARCHAR(64)|
|REFERENCED_TABLE_NAME|约束引用的表名|VARCHAR(64)|
|REFERENCED_COLUMN_NAME|约束引用的列名|VARCHAR(64)|


#### 2.4 CHECK_CONSTRAINTS：检查约束

|字段名|含义|type|
|---|---|---|
|CONSTRAINT_CATALOG|约束所属目录名称，始终为def|CHAR(3)|
|CONSTRAINT_SCHEMA|约束所属用户（数据库）|VARCHAR(64)|
|CONSTRAINT_NAME|约束名称|VARCHAR(64)|
|CHECK_CLAUSE|check约束表达式|VARCHAR(4000)|


  [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

#### REFERENTIAL_CONSTRAINTS的  CONSTRAINT_CATALOG，MATCH_OPTION，固定值

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

#### 注意权限问题，查all视图

#### TABLE_CONSTRAINT

|字段名|ALL_CONSTRAINTS|
|---|---|
|CONSTRAINT_CATALOG|def|
|CONSTRAINT_SCHEMA|owner（跟table_schema一样都是表owner）|
|CONSTRAINT_NAME|constraint_name|
|TABLE_SCHEMA|  
|
|TABLE_NAME|table_name|
|CONSTRAINT_TYPE|constraint_type|


#### REFERENTIAL_CONSTRAINTS

|字段名|ALL_CONSTRAINTS|
|---|---|
|CONSTRAINT_CATALOG|def|
|CONSTRAINT_SCHEMA|owner|
|CONSTRAINT_NAME|constraint_name|
|UNIQUE_CONSTRAINT_CATALOG|def|
|UNIQUE_CONSTRAINT_SCHEMA|R_OWNER|
|UNIQUE_CONSTRAINT_NAME|R_CONSTRAINT_NAME|
|MATCH_OPTION|NONE|
|UPDATE_RULE|UPDATE_RULE|
|DELETE_RULE|DELETE_RULE|
|TABLE_NAME|TABLE_NAME|
|REFERENCED_TABLE_NAME|通过R_CONSTRAINT_NAME查DBA_CONSTRAINT，得到外键引用的主键的表名|


#### KEY_COLUMN_USAGE

|字段名|ALL_CONSTRAINTS|ALL_CONS_COLUMNS|
|---|---|---|
|CONSTRAINT_CATALOG|def|  
|
|CONSTRAINT_SCHEMA|owner|  
|
|CONSTRAINT_NAME|constraint_name|  
|
|TABLE_CATALOG|def|  
|
|TABLE_SCHEMA|  
|  
|
|TABLE_NAME|table_name|  
|
|COLUMN_NAME|  
|column_name|
|ORDINAL_POSITION|  
|position|
|POSITION_IN_UNIQUE_CONSTRAINT|  
|通过R_CONSTRAINT_NAME查DBA_CONS_COLUMNS，获取position|
|REFERENCED_TABLE_SCHEMA|通过DBA_TABLES查owner|  
|
|REFERENCED_TABLE_NAME|通过R_CONSTRAINT_NAME查DBA_CONSTRAINT，得到外键引用的主键的表名|  
|
|REFERENCED_COLUMN_NAME|  
|通过R_CONSTRAINT_NAME查DBA_CONS_COLUMNS，获取colum_name|


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

INFORMATION_SCHEMA视图下新增4个视图资料

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。