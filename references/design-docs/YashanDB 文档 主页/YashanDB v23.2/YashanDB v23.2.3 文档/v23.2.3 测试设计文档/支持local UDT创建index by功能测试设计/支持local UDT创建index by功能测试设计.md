Created by 李浩勇, last modified on 五月 10, 2024

# 1. 概述

本文描述支持local UDT创建index by功能的测试设计

IR：    [YDBRD-8401](https://jira.yasdb.com/browse/YDBRD-8401?src=confmacro)    -  支持local UDT创建index by功能  设计中

SR：    [YDBRD-22234](https://jira.yasdb.com/browse/YDBRD-22234?src=confmacro)    -  支持local UDT创建index by integer  设计中

  [YDBRD-22235](https://jira.yasdb.com/browse/YDBRD-22235?src=confmacro)    -  支持local UDT创建index by varchar  设计中

  


  


支持范围：单机，集群，分布式 

# 2. 需求分析

## 2.1 功能点分析

1、index by关联数组为稀疏数组，元素无序无边界，支持索引不连续，索引类型支持数字和字符串类型（指定类型），并支持类型引用；

2、支持在匿名块和包中使用；

3、支持四种赋值方式，初始化赋值=>，元素赋值，聚合赋值，表数据行赋值bulk collect into；

4、关联数组支持部分集合方法；

5、关联数组支持嵌套，被嵌套或者嵌套其他UDT，包括自身；

6、声明类型时自动完成数组初始化，除去部分约束，使用与嵌套表类似。

关联数组定义-赋值测试点枚举

|功能点|测试点|
|---|---|
|**数组类型**|**package.type  local type，一维数组，多维数组**|
|**是否初始化**|**未初始化，初始化均支持赋值**|
|**index by 类型**|**支持：int、char、varchar、table.column%TYPE、package.variable%TYPE**|
||**不支持：CLOB（代表）、UDT、常量、类型引用底层不支持的类型**|
|数组元素类型|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|
||OBJECT、RECORD、VARRAY 有toid、VARRAY 无toid、TABLE 有toid、TABLE 无toid、package.type、包含构造方法的type、关联数组|
|数组赋值方式|初始化赋值=>，元素赋值、聚合赋值、into 赋值（  select into、   **fetch into**  **）**  、表行数据bulk collect into、fetch collect into|
|**索引、元素传入方式**|**直接作为index或者赋值、函数返回值、存储过程入参、动态执行绑定参数，**  **变量传入**|
|索引值|普通常量(1/'a')/特殊字符、varray(i)/table(i)/record.c1/object.c1、package.关联数组(I)、关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)、object.self、package.values/package.UDT.c1/(1)、包含构造方法type.c1、varray/tablex/record/record、tablex/record/record/varray、tablex/record/varray/record、record/record/tablex/table、record/table/tablex/record、record/varray/record/tablex、tablex/record/record/tablex,tablex/record/tablex/record、record/tablex/record/tablex,tablex/object|
|元素值|普通标量(1/'a')/特殊字符、package.varray(i)/table(i)/record.c1/object.c1、关联数组(I)、package.关联数组(I)、object.self、record、object 、varray/table有toid、关联数组、包含构造方法的type|
|集合方法|支持：count、delete、exists、first、last、prior、next|
||不支持：limit、extend、trim|
|集合使用|作为常量被等值赋值，存储过程、函数入参，作为函数返回值，作为动态执行绑定参数，bulk collect into 集合，fetch bulk collect into 集合，作为存储过程入参默认值，进行条件判断，作为函数返回值使用   return type_001(30=>'C', 40=>'D')，复合多重嵌套，FORALL i in 连续关联数组,引用集合类型,**集合使用与集合元素使用**|


  


语法结构

```
TYPE table_type_name IS TABLE OF datatype [ NOT NULL ] INDEX BY index_type;
```

index_type类型

```
INDEX BY int
INDEX BY char
INDEX BY varchar
INDEX BY table.column%TYPE
INDEX BY package.variable%TYPE
```

  


语法使用

```
--数组索引为常量
CREATE TABLE tb1(c1 varchar(10));
INSERT INTO tb1 VALUES(10);
INSERT INTO tb1 VALUES(20);
COMMIT;

DECLARE
	TYPE type_001 is table of varchar(10) index by int;
	collect1 type_001 := type_001(30=>'C'); /*=>赋值*/
	collect2 type_001;
	collect3 type_001;
BEGIN
	collect1(10) := 'A';  /*元素赋值*/
	collect1(20) := 'B';
	collect2 := collect1; /*聚合赋值*/
	SELECT * BULK COLLECT INTO collect3 FROM tb1; /*表数据行赋值*/
END;
/
```

## 2.2 应用场景

应用与稀疏数组场景，如FORALL VALUES OF 及 FORALL INDICES OF 场景，以及其他需要用到稀疏数组的场景，如员工 工号 - 职位场景。

## 2.3 规格约束

2.3.1 支持及使用范围

支持在匿名块和包中使用

2.3.2 集合性质

|属性|约束|
|---|---|
|是否可用作SQL|否|
|是否可作为表中的数据列类型|否|
|未初始化时的状态|空白，非NULL|
|初始化|声明时完成|
|是否稀疏|是|
|是否有边界|无界|
|是否可对任意一个元素赋值|可|
|扩展方法|新下标直接赋值|
|可否做等值比较|不可|
|可否使用数组函数符进行操作|不可（  补充拦截用例  ）|
|%rowtype拦截|  
|


2.3.3 INDEX 类型及边界值

|index by 子句|最小值|最大值|
|---|---|---|
|INDEX BY int|-2^31|2^31-1|
|INDEX BY char(N) N<=32000|执行长度内任意字符串|执行长度内任意字符串|
|INDEX BY varchar(N)   N<=32000|执行长度内任意字符串|执行长度内任意字符串|


2.3.4 内置集合方法

|方法名|是否支持|
|---|---|
|COUNT|支持|
|DELETE|支持|
|EXISTS|支持|
|FIRST/LAST|支持|
|PRIOR/NEXT|支持|
|LIMIT|不支持|
|EXTEND|不支持|
|TRIM|不支持|


  


2.3.5 支持嵌套

支持嵌套关联数组及其他UDT类型

嵌套最大层数 250 层

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用场景法、正交组合法、等价类进行测试

## 3.2 详细测试设计

### 3.2.1 测试设计

3.2.1.1 语法及不支持索引类型测试

|测试点|测试项|
|---|---|
|正常语法|type type_001 is table of int not null index by int;|
||type type_001 is table of int index by int;|
|关键字缺失    
    
|type  is table of null index by;|
||type  is table of index by;|
||type type_001 is table of int null index by int;|
||type type_001 is table of int not index by int;|
||type type_001 is table of int index int;|
||type type_001 is table of int by int;|
||type type_001 is table of int index by ;|
||type type_001 is table of int indexby int;|
||type type_001 is table of int ind by int;|
||type type_001 is table of int index y int;|
||type type_001 is table of int indexby int;|
|null|type type_001 is table of int index by null;|
||type type_001 is table of null index by int;|
||type  is table of null index by null;|
|index by 不支持类型|clob，varray，table，object，常量1，'a',type type_001 is varray(10) of int index by int;|
|不支持语法|create type type_001 is table of int  index by int;|


  


3.2.1.2 关联数组索引边界值测试

|索引类型|合法等价类|非法等价类|
|---|---|---|
|INT|(-2^31)，-2^31 + 1 最大值(2^31-1)，2^31-2，0，-1，1，1.1，‘1’ |-2^31 - 1，2^31， ‘a’，‘@@’，空，null，''|
|CHAR(32000)|‘a’，lpad('a', 32000, 'a')，lpad('a', 31999, 'a')，特殊字符，0，-1，中文，其他符号|lpad('a', 32001, 'a')，空，null|
|VARCHAR(32000)|‘a’，lpad('a', 32000, 'a')，lpad('a', 31999, 'a')，特殊字符，0，-1，中文，其他符号|lpad('a', 32001, 'a')，空，null|
|table.column%TYPE,package.variable%TYPE|  
  底层类型合法时同上||


  


3.2.1.3 关联数组定义赋值测试

索引值完全覆盖，元素值交叉覆盖 测试设计

|索引类型|索引传入方式|索引值|元素类型|元素值|元素传入方式|赋值方式|是否初始化|
|---|---|---|---|---|---|---|---|
|index by int|直接作为index|普通常量(1)|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|普通标量|常量赋值|=>、元素赋值、聚合赋值|初始化|
|||varray(i)/table(i)/record.c1/object.c1|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|varray(i)/table(i)/record.c1/object.c1|函数返回值|=>、元素赋值、聚合赋值|初始化|
|||package.varray(i)/table(i)/record.c1/object.c1|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|package.varray(i)/table(i)/record.c1/object.c1|存储过程入参|=>、元素赋值、聚合赋值|初始化|
|||关联数组(I),关联数组(I)/关联数组(I)/关联数组(I)|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|关联数组(I)|动态执行绑定参数|=>、元素赋值、聚合赋值|初始化|
|||package.关联数组/关联数组(I)|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|包含构造方法type.c1、object.self|动态执行绑定参数|=>、元素赋值、聚合赋值|初始化|
|||varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|关联数组(I)|动态执行绑定参数|=>、元素赋值、聚合赋值|初始化|
||函数返回值|普通常量(1)|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid、VARRAY 无toid、TABLE 无toid|常量赋值|=>、元素赋值、聚合赋值|初始化|
|||function.c1/(1) --varray(i)/table(i)/record.c1/object.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid、VARRAY 无toid、TABLE 无toid|函数返回值|=>、元素赋值、聚合赋值|初始化|
|||function.c1/(1) --package.varray(i)/table(i)/record.c1/object.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid、VARRAY 无toid、TABLE 无toid|存储过程入参|=>、元素赋值、聚合赋值|初始化|
|||function(1) --关联数组(I),关联数组(I)/关联数组(I)/关联数组(I)|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|动态执行绑定参数|=>、元素赋值、聚合赋值|初始化|
|||function.c1 --包含构造方法type.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|常量赋值|=>、元素赋值、聚合赋值|初始化|
|||varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|常量赋值|=>、元素赋值、聚合赋值|初始化|
||存储过程入参|普通常量(1)|package.RECORD、VARRAY TABLE|package.RECORD、VARRAY TABLE、OBJECT、VARRAY 有toid、TABLE 有toid|函数返回值常量赋值|元素赋值、聚合赋值|未初始化|
|||varray(i)/table(i)/record.c1/object.c1|package.RECORD、VARRAY TABLE|package.RECORD、VARRAY TABLE|存储过程入参常量赋值|元素赋值、聚合赋值|未初始化|
|||package.varray(i)/table(i)/record.c1/object.c1|package.RECORD、VARRAY TABLE|package.RECORD、VARRAY TABLE|常量赋值|元素赋值、聚合赋值|未初始化|
|||关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|package.RECORD、VARRAY TABLE|package.RECORD、VARRAY TABLE|存储过程入参常量赋值|元素赋值、聚合赋值|未初始化|
|||object.self、包含构造方法type.c1|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|动态执行绑定参数常量赋值|元素赋值、聚合赋值|未初始化|
|||varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|常量赋值|元素赋值、聚合赋值|未初始化|
||动态执行绑定参数|普通常量(1)|关联数组/关联数组(I)|关联数组(I)、关联数组|常量赋值|元素赋值、聚合赋值|未初始化|
|||varray(i)/table(i)/record.c1/object.c1|关联数组/关联数组(I)|关联数组(I)、关联数组|函数返回值|元素赋值、聚合赋值|未初始化|
|||package.varray(i)/table(i)/record.c1/object.c1|关联数组/关联数组(I)|package.关联数组(I)、关联数组|存储过程入参，默认值|元素赋值、聚合赋值|未初始化|
|||关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|package.关联数组/关联数组(I)|package.关联数组(I)、关联数组|动态执行绑定参数|元素赋值、聚合赋值|未初始化|
|||object.self、包含构造方法type.c1|package.关联数组/关联数组(I)|package.关联数组(I)、关联数组|函数返回值|元素赋值、聚合赋值|未初始化|
|||varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|package.关联数组/关联数组(I)|package.关联数组(I)、关联数组|动态执行绑定参数|元素赋值、聚合赋值|未初始化|
|not null index by int|直接作为index|普通常量(1)|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|普通标量|常量赋值|=>、into 赋值、聚合赋值|初始化|
|||varray(i)/table(i)/record.c1/object.c1|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|varray(i)/table(i)/record.c1/object.c1|函数返回值|=>、into 赋值、聚合赋值|初始化|
|||package.varray(i)/table(i)/record.c1/object.c1|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|package.varray(i)/table(i)/record.c1/object.c1|存储过程入参|=>、into 赋值、聚合赋值|初始化|
|||关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|关联数组(I)|动态执行绑定参数|=>、into 赋值、聚合赋值|初始化|
|||object.self、包含构造方法type.c1|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|包含构造方法type.c1、object.self|动态执行绑定参数|=>、into 赋值、聚合赋值|初始化|
|||varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|关联数组(I)|动态执行绑定参数|=>、into 赋值、聚合赋值|初始化|
||函数返回值|普通常量(1)|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid、VARRAY 无toid、TABLE 无toid|常量赋值|=>、into 赋值、聚合赋值|初始化|
|||function.c1/(1) --varray(i)/table(i)/record.c1/object.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid、VARRAY 无toid、TABLE 无toid|函数返回值常量赋值|=>、into 赋值、聚合赋值|初始化|
|||function.c1/(1) --package.varray(i)/table(i)/record.c1/object.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid、VARRAY 无toid、TABLE 无toid|存储过程入参常量赋值|=>、into 赋值、聚合赋值|初始化|
|||function(1) --关联数组(I),关联数组(I)/关联数组(I)/关联数组(I)|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|动态执行绑定参数常量赋值|=>、into 赋值、聚合赋值|初始化|
|||function.c1 --包含构造方法type.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|常量赋值|=>、into 赋值、聚合赋值|初始化|
|||varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|常量赋值|=>、into 赋值、聚合赋值|初始化|
||存储过程入参|关联数组(I)、package.关联数组(I)|package.RECORD、VARRAY TABLE|package.RECORD、VARRAY TABLE、OBJECT、VARRAY 有toid、TABLE 有toid|函数返回值常量赋值|into 赋值、聚合赋值|未初始化|
|||varray(i)/table(i)/record.c1/object.c1|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|存储过程入参常量赋值|into 赋值、聚合赋值|未初始化|
|||package.varray(i)/table(i)/record.c1/object.c1|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|package.RECORD、VARRAY TABLE|into 赋值、聚合赋值|未初始化|
|||关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|package.RECORD、VARRAY TABLE|into 赋值、聚合赋值|未初始化|
|||object.self、包含构造方法type.c1|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|package.RECORD、VARRAY TABLE|into 赋值、聚合赋值|未初始化|
|||varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|动态执行绑定参数|into 赋值、聚合赋值|未初始化|
||动态执行绑定参数|普通常量(1)|package.关联数组/关联数组(I)|package.关联数组/关联数组(I)|常量赋值|into 赋值、聚合赋值|未初始化|
|||varray(i)/table(i)/record.c1/object.c1|package.关联数组/关联数组(I)|package.关联数组/关联数组(I)|函数返回值|into 赋值、聚合赋值|未初始化|
|||package.varray(i)/table(i)/record.c1/object.c1|package.关联数组/关联数组(I)|package.关联数组/关联数组(I)|存储过程入参|into 赋值、聚合赋值|未初始化|
|||关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|关联数组/关联数组(I)|关联数组(I)、关联数组|函数返回值|into 赋值、聚合赋值|未初始化|
|||object.self、包含构造方法type.c1|关联数组/关联数组(I)|关联数组(I)、关联数组|动态执行绑定参数|into 赋值、聚合赋值|未初始化|
|||varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|动态执行绑定参数|into 赋值、聚合赋值|未初始化|
||直接作为index/动态执行，运算表达式|关联数组(I)、package.关联数组(I)|int|普通标量|常量赋值|=>、元素赋值，into 赋值|初始化|
||直接作为index/动态执行，内置函数|关联数组(I)、package.关联数组(I)|int|普通标量|常量赋值|=>、元素赋值，into 赋值|初始化|
|index by char，package|直接作为index|普通常量('a') 特殊字符|INT|普通标量|常量赋值|=>、元素赋值、聚合赋值|初始化|
||直接作为index|package.varray(i)/table(i)/record.c1/object.c1|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|varray(i)/table(i)/record.c1/object.c1|存储过程入参|=>、元素赋值、聚合赋值|初始化|
|index by varchar，package|直接作为index|关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|package.varray(i)/table(i)/record.c1/object.c1|动态执行绑定参数|=>、元素赋值、聚合赋值|初始化|
||直接作为index|object.self、包含构造方法type.c1|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|关联数组(I)|动态执行绑定参数|=>、元素赋值、聚合赋值|初始化|
||直接作为index|varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|包含构造方法type.c1、object.self|动态执行绑定参数|=>、元素赋值、聚合赋值|初始化|
|index by char，package|函数返回值|普通常量('a') 特殊字符|OBJECT、VARRAY 有toid、TABLE 有toid|关联数组(I)|常量赋值|=>、元素赋值、聚合赋值|初始化|
||函数返回值|function.c1/(1) --package.varray(i)/table(i)/record.c1/object.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid、VARRAY 无toid、TABLE 无toid|存储过程入参常量赋值|=>、元素赋值、聚合赋值|初始化|
|index by varchar，package|函数返回值|function(1) --关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid、VARRAY 无toid、TABLE 无toid|动态执行绑定参数常量赋值|=>、元素赋值、聚合赋值|初始化|
||函数返回值|function.c1 --包含构造方法type.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid、VARRAY 无toid、TABLE 无toid|常量赋值|=>、元素赋值、聚合赋值|初始化|
|index by char，package|存储过程入参|普通常量('a') 特殊字符|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|函数返回值常量赋值|元素赋值、聚合赋值|未初始化|
||存储过程入参|package.varray(i)/table(i)/record.c1/object.c1|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|动态执行绑定参数常量赋值|元素赋值、聚合赋值|未初始化|
|index by varchar，package|存储过程入参|关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|存储过程入参常量赋值|元素赋值、聚合赋值|未初始化|
||存储过程入参|object.self、包含构造方法type.c1|package.RECORD、VARRAY  TABLE|package.RECORD、VARRAY TABLE|动态执行绑定参数常量赋值|元素赋值、聚合赋值|未初始化|
|index by char，package|动态执行绑定参数|普通常量('a') 特殊字符|关联数组/关联数组(I)|关联数组(I)、关联数组|常量赋值|元素赋值、聚合赋值|未初始化|
||动态执行绑定参数|package.varray(i)/table(i)/record.c1/object.c1|关联数组/关联数组(I)|关联数组(I)、关联数组|存储过程入参|元素赋值、聚合赋值|未初始化|
|index by varchar，package|动态执行绑定参数|关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|关联数组/关联数组(I)|关联数组(I)、关联数组|函数返回值|元素赋值、聚合赋值|未初始化|
||动态执行绑定参数|object.self、包含构造方法type.c1|关联数组/关联数组(I)|关联数组(I)、关联数组|动态执行绑定参数|元素赋值、聚合赋值|未初始化|
|not null index by char，package|直接作为index|普通常量(1/'a')/特殊字符|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|普通标量|常量赋值|=>、into 赋值、聚合赋值|初始化|
||直接作为index|package.varray(i)/table(i)/record.c1/object.c1|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|package.varray(i)/table(i)/record.c1/object.c1|存储过程入参|=>、into 赋值、聚合赋值|初始化|
|not null index by varchar，package|直接作为index|关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|关联数组(I)|动态执行绑定参数|=>、into 赋值、聚合赋值|初始化|
||直接作为index|object.self、包含构造方法type.c1|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|包含构造方法type.c1、object.self|动态执行绑定参数|=>、into 赋值、聚合赋值|初始化|
||直接作为index|varray/tablex/record/record、tablex/record/record/varray    
  tablex/record/varray/record、record/record/tablex/table    
  record/table/tablex/record、record/varray/record/tablex    
  tablex/record/record/tablex,tablex/record/tablex/record    
  record/tablex/record/tablex,tablex/object|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|包含构造方法type.c1、object.self|动态执行绑定参数|=>、into 赋值、聚合赋值|初始化|
|not null index by char，package|函数返回值|普通常量('a') 特殊字符|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|常量赋值|=>、into 赋值、聚合赋值|初始化|
||函数返回值|function.c1/(1) --package.varray(i)/table(i)/record.c1/object.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|存储过程入参常量赋值|=>、into 赋值、聚合赋值|初始化|
|not null index by varchar，package|函数返回值|function(1)、关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|动态执行绑定参数常量赋值|=>、into 赋值、聚合赋值|初始化|
||函数返回值|function.c1 --包含构造方法type.c1|OBJECT、VARRAY 有toid、TABLE 有toid|OBJECT、VARRAY 有toid、TABLE 有toid|常量赋值|=>、into 赋值、聚合赋值|初始化|
|not null index by char，package|存储过程入参|普通常量('a') 特殊字符|int|普通标量|函数返回值常量赋值|into 赋值、聚合赋值|未初始化|
||存储过程入参|package.varray(i)/table(i)/record.c1/object.c1|CLOB|普通标量|动态执行绑定参数常量赋值|into 赋值、聚合赋值|未初始化|
|not null index by varchar，package|存储过程入参|关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|XMLTYPE|普通标量|存储过程入参常量赋值|into 赋值、聚合赋值|未初始化|
||存储过程入参|object.self、包含构造方法type.c1|JSON|普通标量|动态执行绑定参数常量赋值|into 赋值、聚合赋值|未初始化|
|not null index by char，package|动态执行绑定参数|普通常量('a') 特殊字符|关联数组/关联数组(I)|关联数组(I)、关联数组|常量赋值|into 赋值、聚合赋值|未初始化|
||动态执行绑定参数|package.varray(i)/table(i)/record.c1/object.c1|关联数组/关联数组(I)|关联数组(I)、关联数组|存储过程入参|into 赋值、聚合赋值|未初始化|
|not null index by varchar，package|动态执行绑定参数|关联数组(I)、package.关联数组(I)、关联数组(I)/关联数组(I)/关联数组(I)|关联数组/关联数组(I)|关联数组(I)、关联数组|函数返回值|into 赋值、聚合赋值|未初始化|
||动态执行绑定参数|object.self、包含构造方法type.c1|关联数组/关联数组(I)|关联数组(I)、关联数组|动态执行绑定参数|into 赋值、聚合赋值|未初始化|
|not null index by varchar，package|直接作为index/动态执行，拼接符|关联数组/关联数组(I)|关联数组(I)、关联数组|动态执行绑定参数|动态执行绑定参数|=>、元素赋值、into赋值|初始化|
||直接作为index/动态执行，内置函数|关联数组/关联数组(I)|关联数组(I)、关联数组|动态执行绑定参数|动态执行绑定参数|=>、元素赋值、into赋值|初始化|
|index by table.column%TYPE|直接作为index int|普通常量(1)|VARCHAR|普通标量|常量赋值|=>、元素赋值、into赋值|初始化|
||函数返回值binary_integer|package.varray(i)/table(i)/record.c1/object.c1|CLOB|普通标量|常量赋值|=>、元素赋值、into赋值|初始化|
||存储过程入参varchar|关联数组(I)、package.关联数组(I)|BLOB|普通标量|动态执行绑定参数|=>、元素赋值、into赋值|初始化|
||动态执行绑定参数varchar|关联数组(I)、package.关联数组(I)|NCLOB|普通标量|动态执行绑定参数|=>、元素赋值、into赋值|初始化|
|package.variable%TYPE|直接作为index int|普通常量(1)|INT|普通标量|常量赋值|=>、元素赋值、into赋值|初始化|
||函数返回值binary_integer|package.varray(i)/table(i)/record.c1/object.c1|CLOB|普通标量|常量赋值|=>、元素赋值、into赋值|初始化|
||存储过程入参varchar|关联数组(I)、package.关联数组(I)|BLOB|普通标量|动态执行绑定参数|=>、元素赋值、into赋值|初始化|
||动态执行绑定参数varchar|关联数组(I)、package.关联数组(I)|NCLOB|普通标量|动态执行绑定参数|=>、元素赋值、into赋值|初始化|
|bulk collect into    
  fetch bulk collect into 关联数组|index by package.vari%type int|-|常量|-|-|-|初始化|
||index by binary_interger|-|OBJECT、VARRAY 有toid、TABLE 有toid|-|-|-|初始化|
||index by table.column%TYPE|-|嵌套|-|-|-|初始化|
||index by varchar|异常测试|-|-|-|-|初始化|
|关联数组类型继承package.type%type-int|直接作为index|INT|OBJECT、VARRAY 有toid、TABLE 有toid|-|-|=>、元素赋值、into赋值|初始化|
|关联数组类型继承type%type-char|直接作为index|INT|NCLOB，XMLTYPE，JSON|-|-|=>、元素赋值、into赋值|初始化|
|关联数组类型继承package.type%type-index by varchar|动态执行绑定参数|INT|INT|-|-|=>、元素赋值、into赋值|初始化|
|关联数组类型多层继承|动态执行绑定参数|package.table(i)|OBJECT|OBJECT|-|=>、元素赋值、into赋值|初始化|


  


  


3.2.1.4 集合方法测试

|方法名|测试点|  
|
|---|---|---|
|limit|空集合，非空集合|返回null|
|count|元素/聚合赋值集合|进行元素赋值，聚合赋值后，直接count，多次赋值后count，重复赋值(索引值重复)后count，delete后count，先元素赋值，后聚合赋值后count，先聚合赋值，后元素赋值后count|
|  
|bulk赋值集合|bulk赋值集合，直接count，多从bulk后count，赋值后进行元素赋值（索引值重复/不重复）-聚合赋值后count，delete后count|
|delete|  
|1、delete全部元素，覆盖nested table,2、delete单个元素，多次delete相同或者不同元素，count，覆盖nested table,3、delete多个元素，多次delete相同或者不同元素，count，覆盖nested table,作为内置函数测试（入参）|
|exists|  
|判断不同类型索引是否存在（数字，字母，特殊字符，中文，其他字符等），delete后再次进行判断|
|first、last|index by int|delete前后进行取值，包含大量数据元素时的性能|
|  
|index by char/varchar|覆盖大小写字母，特殊字符，delete前后进行取值，  *包含大量数据元素时的性能  *  （修改数据库字符集，观察排序结果）（n类型隐式转化是否与非N类型结果相同）|
|prior、next|index by int|delete前后进行取值|
|  
|index by char/varchar|覆盖大小写字母，特殊字符，delete前后进行取值，  *包含大量数据元素时的性能*|


  


3.2.1.5 关联数组的使用测试设计

|场景|
|---|
|作为常量被等值赋值（3.2.1.3已覆盖 ）|
|存储过程、函数入参（3.2.1.3已覆盖 ）|
|作为函数返回值（3.2.1.3已覆盖 ）|
|作为动态执行绑定参数（3.2.1.3已覆盖 ）|
|bulk collect into 集合（3.2.1.3已覆盖 ）|
|fetch bulk collect into 集合（3.2.1.3已覆盖 ）|
|作为存储过程入参默认值（3.2.1.3已覆盖 ）|
|进行条件判断|
|作为函数返回值使用   return type_001(30=>'C', 40=>'D')|
|复合多重嵌套（3.2.1.3已覆盖 ）,varray/tablex/record/tablex，tablex/record/tablex/varray，tablex/record/varray/tablex，    
  record/record/varray/tablex，record/varray/tablex/tablex，record/tablex/tablex/varray|
|FORALL i in 连续关联数组|
|*FORALL（values of / indices of 特性中测试）*|


3.2.1.6 部分约束的拦截测试

|属性|约束|
|---|---|
|是否可用作SQL|否|
|是否可作为表中的数据列类型|否|
|未初始化时的状态|空白，非NULL|
|可否做等值比较|不可|
|可否使用集合操作符进行操作|不可|
|数组函数|无友商参考，参考崖山table类型，理论不支持|


  


### 3.2.2 涉及的测试DFX

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|/|
|DFR|/|
|HA|/|
|KT kill测试|/|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|/|
|长稳|/|


# 4.   **测试用例**

  


# 5.   **测试框架设计**

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现

# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# **7. 工作量评估**

工作量：12  *人天*

计划测试完成时间：-

## Attachments:

[FORALL文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjZhMWFkOWEzMzExZGM4ZjE4IiwicmVmX2lkIjoiNjczOTZkMjY3MjgyMDZlZmI5MmYxYmFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MjM5LCJleHAiOjE3ODIzOTI2Mzl9.FE-43i8_FKZ2ezlOp2IK55IeoVahby7CK4nvBtqhtUs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,文琪：,测试设计可以再看看以下几个点：    
  1、语法测试，不支持的用法，部分位置传null，在过程体外使用等场景的拦截    
  2、测试等价类的划分，数组定义，边界值及赋值场景，是否全都走不同的流程需要遍历，再看下如何划分等价类交叉覆盖    
  3、关于无边界和稀疏特性，与集合内置方法的交互测试设计点需要再详细一点，比如exists方法，要测稀疏数组的哪些东西。（delete方法目前不支持有入参，需要跟开发确认下转测时是否会支持到与oracle对齐）    
  4、数组的使用场景，调用变量时看下变量作为入参默认值（数组，数组元素都覆盖下），变量用于条件判断。其他的还有使用数组类型，用于定义，继承等的场景,Posted by lihaoyong at 四月 02, 2024 10:45|
|---|
|  [](null)  ,已补充更新,Posted by lihaoyong at 四月 02, 2024 17:30|
|  [](null)  ,文琪：,1、index by varchar not null：not null 类型展开分析测试点,2、确认索引值传入不同方式是否有不同,Posted by lihaoyong at 四月 09, 2024 15:50|
