Created by 张欣, last modified on 十月 25, 2024



# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/670d02e3e489dd0868f7591f](https://pingcode.yasdb.com/pjm/items/670d02e3e489dd0868f7591f)    ?    
  #YDBRD-34132 package支持procedure和function重载功能

同个自定义package下，存在同名，不同参数列表（形参名称、数据类型、个数）或返回值类型的子过程/函数。创建时需要放开子过程同名约束并校验，调用时要判断选择哪个版本。

# 2. 需求分析

## 2.1 功能点分析

需求来源： 华润POC 1、package支持procedure和function重载功能 场 景： 

1. 同名不同参数个数    
  FUNCTION convert(dataType VARCHAR2,num NUMBER) RETURN NUMBER;     FUNCTION convert(dataType VARCHAR2,date DATE, num NUMBER ) RETURN VARCHAR2;
1. 同名同参数个数，不同参数类型 FUNCTION convert(dataType VARCHAR2,num NUMBER) RETURN NUMBER; FUNCTION convert(dataType INTEGER, num NUMBER ) RETURN VARCHAR2;
1. 同名同参数个数、类型，不同返回值类型（需调研ORACLE是否支持）  FUNCTION convert(dataType VARCHAR2, num NUMBER) RETURN NUMBER; FUNCTION convert(dataType VARCHAR2, num NUMBER ) RETURN VARCHAR2;


 需求描述： package支持procedure和function重载功能 

需求范围： 1、单机和集群

## 2.2 应用场景

- *需求本身的主要应用场景*


#### 2.2.1 西部石油重载用法分析：

1.一个pkg下有多组重载的子过程，每组重载过程个数在2-4个；

2.重载过程形参数据类型多是varchar，number；参数个数有差异 部分重合，在重合的基础上 有新增的，不同的；参数个数有为0的，较多的。

3.重载过程内容基本相近，使用的入参不同。

4.有72个pkg有用到重载，占比较高。

```
PROCEDURE enableTrigger  ;
  PROCEDURE enableTrigger  ( tableName IN VARCHAR );
----------------------  
  PROCEDURE addDict      (tableName      IN VARCHAR2, columnName   IN VARCHAR2, columnCode IN NUMBER,
                          rangeValueType IN VARCHAR2, unitTypeName IN VARCHAR2, unitTypeId IN NUMBER);

  PROCEDURE addDict      (tableName      IN VARCHAR2, columnName   IN VARCHAR2, columnCode IN NUMBER,
                          rangeValueType IN VARCHAR2, unitTypeName IN VARCHAR2  );

  PROCEDURE addDict      (tableName      IN VARCHAR2, columnName   IN VARCHAR2, ouomName   IN VARCHAR2, columnCode IN NUMBER,
                          rangeValueType IN VARCHAR2, unitTypeName IN VARCHAR2, unitTypeId IN NUMBER);

--------
  PROCEDURE addDictRange (tableName      IN VARCHAR2, columnName   IN VARCHAR2, columnCode IN NUMBER,
                          rangeValueType IN VARCHAR2, minValue     IN NUMBER,   maxValue   IN NUMBER,
                          unitTypeName   IN VARCHAR2, unitTypeId   IN NUMBER);

  PROCEDURE addDictRange (tableName      IN VARCHAR2, columnName   IN VARCHAR2, ouomName   IN VARCHAR2, columnCode IN NUMBER,
                          rangeValueType IN VARCHAR2, minValue     IN NUMBER,   maxValue   IN NUMBER,
                          unitTypeName   IN VARCHAR2, unitTypeId   IN NUMBER);
--------------
  PROCEDURE addDictValue (tableName  IN VARCHAR2, columnName  IN VARCHAR2, valueNew  IN VARCHAR2);

  PROCEDURE addDictValue (tableName  IN VARCHAR2, columnName  IN VARCHAR2, valueNew  IN VARCHAR2, descNew  IN VARCHAR2);

  PROCEDURE addDictValue (tableName  IN VARCHAR2, columnName  IN VARCHAR2, valueNew  IN VARCHAR2, descNew  IN VARCHAR2, remarkNew  IN VARCHAR2);

  PROCEDURE addDictValue (tableName  IN VARCHAR2, columnName  IN VARCHAR2, valueNew  IN VARCHAR2, lockInd  IN VARCHAR2, descNew  IN VARCHAR2, remarkNew  IN VARCHAR2);
--------------
  PROCEDURE chngDictName (tableNameOld IN VARCHAR2, tableNameNew IN VARCHAR2);

  PROCEDURE chngDictName (tableName    IN VARCHAR2, columnNameOld IN VARCHAR2, columnNameNew IN VARCHAR2);

  PROCEDURE chngDictName (tableNameOld IN VARCHAR2, columnNameOld IN VARCHAR2,
                          tableNameNew IN VARCHAR2, columnNameNew IN VARCHAR2);
---------------
  PROCEDURE chngVCRef    ( tableName    IN VARCHAR2, columnName IN VARCHAR2,
                           columnFormat IN VARCHAR2, columnNull IN VARCHAR2,
                           vcTable      IN VARCHAR2, vcColumnID IN VARCHAR2, vcColumn IN VARCHAR2 );

  PROCEDURE chngVCRef    ( tableName    IN VARCHAR2, columnID   IN VARCHAR2, columnName IN VARCHAR2,
                           columnFormat IN VARCHAR2, columnNull IN VARCHAR2,
                           vcTable      IN VARCHAR2, vcColumnID IN VARCHAR2, vcColumn   IN VARCHAR2 );

  PROCEDURE delDict      (tableName  IN VARCHAR2);

  PROCEDURE delDict      (tableName  IN VARCHAR2, columnName IN VARCHAR2);

  PROCEDURE delDictValue (tableName  IN VARCHAR2, columnName IN VARCHAR2);

  PROCEDURE delDictValue (tableName  IN VARCHAR2, columnName IN VARCHAR2, valueOld IN VARCHAR2);
------------
```

#### 2.2.2 影响子过程/函数 重载的因素

|  
|  
|是否可以区分|
|---|---|---|
|形参  

|个数|可以区分；,注意有default值的情况|
||名称|如果只是形参名称不同，必须按名传参；|
||顺序|传参方式：,1. 按位置
1. 按名 
1. 混合传参，注意有default值的情况 可能会导致按名和按位置传参混淆，导致无法判断（参见异常示例2）
|
||数据类型|**可以区分 ，至少有一个参数不是同个数据类型大类**,特殊：数值大类中各个具体的数据类型 按优先级排序,详细规则见约束。|
||方向：in，out, in out|仅方向，不能区分|
|udf返回值|数据类型|仅返回值类型不能区分|
|过程/函数类型|过程|按调用方式或使用位置区分,  
|
||函数||




- *需求与其他特性的关联场景*


#### 2.2.3 pkg子过程类型（公有，私有）

|||
|---|---|
|1|**procedure1-public,procedure1-public**  ,……  pkg外调用（实际应用主要是这种）；其他子过程调用|
|2|procedure1-public,procedure1-private  pkg内 初始化单元调用；其他子过程调用|
|3|procedure1-private，procedure1-private pkg内 初始化单元调用；其他子过程调用|
|4|~~procedure1-public, procedure2-public procedure2的子过程procedure1   pkg内-procedure2内调用procedure1(预期局部优先？) ~~|


#### 2.2.4 USE_NATIVE_TYPE 

默认TRUE表示使用原生数据类型，FALSE表示使用Oracle兼容类型。当参数值为FALSE时，数据库存在以下表现：

- 在建表DDL语句中，TINYINT、SMALLINT、INTEGER、BIGINT类型会被解析成NUMBER(38,0)，FLOAT类型会被解析成NUMERIC_FLOAT类型并支持设置精度，原生FLOAT类型改为BINARY_FLOAT。
- 在SELECT语句中，如果最外层投影列的类型是TINYINT、SMALLINT、INTEGER、BIGINT，则会隐式的包裹一层TO_NUMBER函数，将最终结果转换为NUMBER(38,0)。


USE_NATIVE_TYPE为FALSE 会影响数值类型的优先级判断。TINYINT、SMALLINT、INTEGER、BIGINT 同时出现会匹配到多个。

测试策略是默认TRUE，数值子类优先级测完后，USE_NATIVE_TYPE为FALSE再测一遍。



#### 2.2.5 升级

当前特性会更新 PACKAGE$(OBJ#, SUBPROGRAM_NAME) 的唯一约束为普通约束。需要考虑升级前后的兼容性。





## 2.3 规格约束

**匹配规则**

1.重载的两个过程形参，至少有一个不是同个数据类型大类(数值大类除外)，否则无法区分。（int，number，float等都是数值大类；char,varchar 等都属于文本大类；clob？）

2.如果同属于数值大类，遵循优先级



#### 2.3.1 整体匹配规则

1. **能直接匹配类型的**
    1. **只有一个匹配的子过程，则直接选择该子过程**
    1. **有超过一个的子过程被匹配上，报错存在歧义**
1. **能匹配到类型组的（需要类型组转换）**
    1. **只有一个匹配的子过程，则直接选择该子过程**
    1. **有超过一个的子过程被匹配上，按类型匹配顺序进行匹配（参考数字类型匹配逻辑）**
1. **不存在可以直接匹配类型的子过程，但有通过隐式转换规则能匹配的子过程**
    1. **只有一个转换后可匹配的子过程，则直接选择该子过程**
    1. **有超过一个的子过程，则报错存在歧义**
1. **隐式转换也无法匹配到子过程，则报错参数个数或类型错误**




#### 2.3.2 数值类型匹配规则

1.单个形参

（USE_NATIVE_TYPE默认TRUE）对齐yashan类型推导规则:

DOUBLE>FLOAT>NUMBER>BIGINT>INTEGER>SMALLINT>TINYINT

USE_NATIVE_TYPE为FALSE 对齐Oracle实际调研规则：

**oracle**  :   NUMBER(yashan   TINYINT、SMALLINT、INTEGER、BIGINT  )   >   BINARY_FLOAT   >   BINARY_DOUBLE   >   PLS_INTEGER

**yashan**  :   DOUBLE > NUMBER_FLOAT>   NUMBER(yashan   TINYINT、SMALLINT、INTEGER、BIGINT  ) 

oracle BINARY_FLOAT-BINARY_DOUBLE优先互转是否保留？

2.多个形参

按精度优先、类型接近的原则，依次匹配，其匹配契合度由低到高，如果出现匹配多个子过程（契合度相同）则报错处理。

####   
2.3.3 过程形参个数和pkg支持重载的个数规格：

1.procedure/function 最多可以指定4095个参数。单个形参名称最长64。形参类型如果是自定义类型 类型名称最长64。 最大4095*（64+64）

2.UDP的成员声明，包括变量声明和子过程体对象声明，一个UDP（HEAD或BODY）里可声明的成员数量最多为1024个。

如果只有一组子过程重载，最多1024个重载版本；多组子过程重载 声明个数不超过1024个。  


# 3. 详细测试设计

## 3.1 测试设计方法

1.判断重载的标识，涉及到形参名称，个数，数据类型 等，单个元素使用等价类方法测试，分别覆盖可区分和不可区分的情况；

多个元素的组合，如名称+数据类型、个数+顺序等 采用条件组合的方法判断。

2.对于重载可能触发的异常情况，采用场景分析法。

## 3.2 详细测试设计

#### 3.2.1 形参名称、个数、顺序等判断

|  
|  
|有效等价类|无效等价类|
|---|---|---|---|
|1|形参  名称|只是名称不同（数据类型，顺序个数相同），按名传参,部分名称不同，混合传参，按名的部分可以区分|只是名称不同，按位置传参,部分名称不同，混合传参，按名的部分不能区分|
|2|个数|个数不同（无default值），按位置传参/按名传参,个数不同（部分有default值），混合传参 可区分|  
,个数不同（部分有default值），省略default值传参 不能区分|
|3|顺序|顺序不同，按位置传参 可区分|只是顺序不同，按名传参|
|4|数据类型（后续详细展开）|至少有一个参数不是同个数据类型大类,全部参数或部分参数是  数值大类中各个具体的数据类型 按优先级排序,入参是  **不同名**  的自定义类型（local：record，varray/nstb; global: obj,varray/nstb）,传参方式：绑定变量传参|所有参数都属同个数据类型大类，且不是数值型,数值大类中各个具体的数据类型 但单个或组合类型相同 无法区分,入参是同个自定义类型|
|5|方向  ：in，out, in out|/|仅参数方向不同，不能区分|
|6|udf返回值的数据类型|/|仅返回值类型不同不能区分|
|7|过程/函数类型|按调用方式、位置区分|  
|


#### 3.2.2 形参数据类型大类的覆盖

|大类|具体的数据类型|形参|||实参|||||备注  
|
|---|---|---|---|---|---|---|---|---|---|---|
|||包含一个当前子类|包含2个以上当前子类-子类不能互转|包含2个以上当前子类-子类支持互转|当前子类,(常量，函数表达式，确定类型的变量)|当前大类的其他子类-支持互转|当前大类的其他子类-不支持互转|非当前大类-其他大类-可以隐式转换到当前大类|非当前大类-其他大类-不支持隐式转换到当前大类||
|数值型|TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE|||||||||  
|
|字符型|CHAR、VARCHAR、NCHAR和NVARCHAR|遍历|/|||,常量字符串|/|,常量数值|/|非数值同个大类下的子类-  
隐式转换-|
|日期时间|date、timestamp,time,interval ys、interval ym|||date、timestamp||||字符型||date和time，interval类型之间不能互转,date、timestamp可以,time、dsinterval可以？|
|布尔|boolean||/|/||/|/|字符型,数值型||隐式转换-数值  
|
|BIT|BIT||/|/||/|/|数值型||隐式转换-数值|
|大对象|CLOB和NCLOB||/|||||字符型||  
|
||BLOB||||||||||
|  
|ROWID，UROWID|||||||||  
|
|  
|RAW|||||||||  
|
|  
|JSON|||||||||  
|
|  
|XMLTYPE|||||||||  
|
|GIS相关的空间数据类型|GEOMETRY,BOX2D,|||||||||  
|
|自定义类型|local/pkg：record，varray/nstb 关联数组;, global: obj,varray/nstb|||||||||不同名的，成员类型相同也都不能互转,record:声明的；%rowtype继承的；,%type,高级包等内置的UDT类型|


形参类型，实参（常量1，’1‘，变量-带类型，  null  ）  脚本遍历

补充：object类型的父子类型继承，匹配

父类型a, 1)子类型ab,ac; 2)子类型ab,abc  这几种类型做形参，分别用各类型的子类型去匹配

  


#### 3.2.3 重载的过程/函数参数同属数值大类的转换规则

oracle优先级：

yashan数值型具体包含TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE

yashan详细规则:

USE_NATIVE_TYPE默认TRUE:

DOUBLE>FLOAT>NUMBER>BIGINT>INTEGER>SMALLINT>TINYINT

USE_NATIVE_TYPE为FALSE 对齐Oracle实际调研规则：

NUMBER(yashan   TINYINT、SMALLINT、INTEGER、BIGINT  )   >   BINARY_FLOAT   >   BINARY_DOUBLE   >   PLS_INTEGER

**单个数值类型参数匹配**

|  
|各过程形参类型|实参传入类型|预期匹配类型|19c|21c|
|---|---|---|---|---|---|
|1|全整数类型：  TINYINT、SMALLINT、INT/INTEGER、BIGINT|待完善|  
|||
|2|NUMBER、FLOAT、DOUBLE|INT|NUMBER|||
|3|INT、  binary_float|NUMBER|INT（Oracle）|INT|INT|
|4|INT、DOUBLE|FLOAT|DOUBLE|||
|5|INT、  binary_double|NUMBER|INT|INT|INT|
|6|FLOAT、DOUBLE|NUMBER/INT|FLOAT|||
|7|NUMBER、FLOAT|DOUBLE|FLOAT|||
|8|NUMBER、DOUBLE|FLOAT|NUMBER？|||
|9|INT、NUMBER、FLOAT、DOUBLE、  BIT|待完善|  
|||


- 入参是  **显式转换**  函数表达式：bin,to_number,to_char等。
- 入参为这种数字后带d/D，解析为double的常量，如11d，11.11D


测试方法：

脚本遍历：

形参类型：  TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE； 支持转成数值的类型：CHAR、VARCHAR、NCHAR和NVARCHAR；Boolean；BIT

实参类型：遍历；数值常量（1-number）  11d，11.11D   ，字符串常量’1‘，函数表达式,null等

**两个及多个以上组合参数匹配**

测试方法：

脚本遍历：

形参类型：两两组合；

-- NUMBER NUMBER

-- NUMBER BINARY_FLOAT

-- NUMBER BINARY_DOUBLE

-- NUMBER PLS_INTEGER

-- BINARY_FLOAT NUMBER

-- BINARY_FLOAT BINARY_FLOAT

-- BINARY_FLOAT BINARY_DOUBLE

-- BINARY_FLOAT PLS_INTEGER

-- BINARY_DOUBLE NUMBER

-- BINARY_DOUBLE BINARY_FLOAT

-- BINARY_DOUBLE BINARY_DOUBLE

-- BINARY_DOUBLE PLS_INTEGER

-- PLS_INTEGER NUMBER

-- PLS_INTEGER BINARY_FLOAT

-- PLS_INTEGER BINARY_DOUBLE

-- PLS_INTEGER PLS_INTEGER

  


#### 3.2.4 隐式转换对重载入口的影响



对重载过程的入口来说，存在隐式转换，并且都能转，就会触发异常。场景？

1.数值和字符串之间的隐式转换

  `  `      `PROCEDURE proc1 (a NUMBER, b VARCHAR2);`      
    `  `      `PROCEDURE proc1 (a NUMBER, b NUMBER);`  

  `  pack1.proc1(`      `'1'`      `,`      `'2'`      `);  -- Causes compile-`      `time`         `error PLS-00307`      
    `  `      `pack1.proc1(`      `'1'`      `,2);    -- Causes compile-`      `time`         `error PLS-00307`  

Oracle规则：  第一个参数a执行了隐式转换，第2个实参b【常量or变量】 可能匹配到varchar，也可能匹配到number。执行会触发异常。

第一个转了，第2个两个都能转就会报错。第一个不转，第2个直接能匹配上就会选对应的版本。

|第一个过程形参类型|第二个过程形参类型|实参传入|预期|  
|
|---|---|---|---|---|
|**第2个隐式转换 两个都能转**|||||
|(a NUMBER, b VARCHAR2)|(a NUMBER, b NUMBER)|(1,'2')|first version|  
|
|  
|  
|(1,2);      |second version|  
|
|  
|  
|('1','2'),('1',2)|报错     PLS-00307|  
|
|(a NUMBER, b VARCHAR2)|(a NUMBER, b clob)|(1,'2'),('1',2)|first version|clob,varchar  varchar优先|
|(a NUMBER, b VARCHAR2)| (a NUMBER, b number)|a boolean := true;    
    
    pack1.proc1(a,a);|  
|boolean -> number,varchar 都能转，无法区分|
|**一个能转，一个不能转**|||||
|(a VARCHAR2)|(a date)|(2)|first version|  
|
|(a NUMBER, b VARCHAR2)|(a NUMBER, b date)|('1',2)|first version|  
|
|**两个都不能转**|  
|  
|  
|  
|
|(a int)|(a boolean)|a date := '2022-02-02';    
    pack1.proc1(a);|报错   PLS-00306 |  
|
|(a NUMBER, b int)|(a NUMBER, b boolean)|a date := '2022-02-02';    
    pack1.proc1('1',a);|报错   PLS-00306 |  
|


策略：隐式转换规则本身太多，不用全覆盖。

数值，字符串类型的转换要重点关注下  


#### 3.3.5 场景补充测试

- 1个package中存在多组重载过程；子过程总数上限1024个；  单组最多1024个重载版本； 每组重载过程个数2-10个、100+
- 单个子过程最多可以指定4095个参数。重载过程参数个数 3-10个、100+、1024、4096
-  单个形参名称最长64。形参类型如果是自定义类型 类型名称最长64。 最大4095*（64+64）
- 重载过程/函数 还  **嵌套**  调用了其他存在重载的过程/函数；多层嵌套
- **本身递归**  的子函数，重载版本1，调用重载版本2 
- 存在  **递归调用**  的子过程，存在重载；递归中调的是同个、不同的版本；
- 实参通过绑定变量传入  ；
- 可串行化的包；
- SQL找那个调用重载的子过程，实参可以是表列。
- 内置pkg的重载：C实现、plsql实现。
- replace 前后可能改变定义，首次调用；形参改变；SQL内容失效。


异常分类：

|||
|---|---|
|创建head失败|子过程头部无法区分；,形参都属同个大类（非数值）|
|调用失败-多个可选版本|见隐式转换；单个，多个匹配|
|调用失败-没有匹配的版本||


pkg子过程类型覆盖：

|1|**procedure1-public,procedure1-public**  ,……  pkg外调用（实际应用主要是这种）；其他子过程调用|
|---|---|
|2|procedure1-public,procedure1-private  pkg内 初始化单元调用；其他子过程调用|
|3|procedure1-private，procedure1-private pkg内 初始化单元调用；其他子过程调用|
|~~4~~|~~procedure1-public, procedure2-public procedure2的子过程procedure1   pkg内-procedure2内调用procedure1(预期局部优先？) ~~|


策略：匹配规则重点在第一种覆盖。后面2种做场景覆盖，可改写。



#### 3.3.6 升级

|升级前|升级后|
|---|---|
|创建存在重载的pkg-创建成功，状态invaild;,|可以调用，状态更新为vaild|
||新建存在重载的pkg，符合规则可创建，可调用|
||历史的非重载的pkg,功能不受影响|


#### 3.3.7 并发

pkg 子过程/函数存在多个重载版本，并发不同实参入参调用，走不同的重载版本。

覆盖数据类型大类，数值子类；

形参列表较长；多个重载版本；

调用同时有pkg ddl触发重编译（replace,drop create,alter complie）。

可串行化的pkg;

子过程递归+重载的并发。

#### 3.3.8 性能

对比存在重载和不存在重载，多次调用pkg过程/函数 重载选择是否存在性能开销， 性能是否下降。

重载过程参数列表较长时，是否存在较大性能开销；

旧版本  转测版本  Oracle

非重载的

             重载的



1.重载的,基线master 固定创建和调用一个版本,转测版本非重载,重载 调用相同次数

基线版本：YashanDB Server Enterprise Edition Release 23.4.0.24 x86_64 6a4219bd0f

测试版本：YashanDB Server Enterprise Edition Release 23.4.0.24 x86_64 40b170db28

|编号|场景|调用次数|基线master|转测版本非重载|转测版本重载|Oracle 重载|
|---|---|---|---|---|---|---|
|1|形参个数不同|1000000|00:00:06.191|00:00:06.825|00:00:06.663||
|2|形参个数不同,有default值,--个数再多一些|按位置|00:00:04.210|00:00:04.677|00:00:04.632||
|||按名称|00:00:04.367|00:00:04.701|/||
|3|个数和类型不同,混合传参调用||00:00:04.366|00:00:04.626|00:00:04.650||
|4|过程/函数按调用方式区分||00:00:04.557|00:00:05.213|00:00:05.256||
|5|形参个数很多-|8个|00:00:02.698|00:00:02.956|00:00:03.016||
|||128个|00:00:14.129|00:00:14.233|00:00:14.209||
|6|形参名和形参类型名称长|500000,WORK_AREA_POOL_SIZE = 4G|00:00:03.936|00:00:04.183|00:00:03.170||
|7|数据类型-同个大类-数值-单个形参-直接命中||00:00:01.487|00:00:01.743|00:00:01.843||
|8|数据类型-同个大类-数值-单个形参-隐式转换||00:00:01.467|00:00:01.732|00:00:01.800||
|9|数据类型-同个大类-数值-多个形参||00:00:06.434|00:00:07.168|00:00:06.979||
|10|多个重载版本,形参数量一样|1024个|00:00:02.370|00:00:02.308|00:00:03.012||
||||||||






###  梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|
|---|---|
|CT|是，测试场景见3.3.7|
|KT|是，和CT场景差异不大，会做部分覆盖|
|长稳|是，增加重载功能用例在长稳|
|一致性|不涉及，不涉及业务一致性|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，该特性是plsql中UDP的入口选择  
|
|安全|不涉及，该特性不涉及用户密码，权限等安全性因素|
|DFR|不涉及故障  
|
|HA|不涉及，HA备机不支持ddl或过程体调用  
|
|压力|不涉及  
|
|性能|是，测试场景见3.3.8|
|可维护性|是，用例自动化维护  
|


5.1 CT 



5.2 性能



# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWM3NDZhMWFkOWEzMzExZGUwMTJhIiwicmVmX2lkIjoiNjczOWM3NDY3MjgyMDZlZmI5MzEzOGQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NDYyLCJleHAiOjE3ODI1NDM4NjJ9.u5Lay5kh-_R6WzEoBYki2K1KtVTO4HTBJTIFPbLWpVI)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWM3NDZhMWFkOWEzMzExZGUwMTJhIiwicmVmX2lkIjoiNjczOWM3NDY3MjgyMDZlZmI5MzEzOGQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NDYyLCJleHAiOjE3ODI1NDM4NjJ9.u5Lay5kh-_R6WzEoBYki2K1KtVTO4HTBJTIFPbLWpVI)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWM3NDY4OTcwYzJhZjRmNTM4MmRlIiwicmVmX2lkIjoiNjczOWM3NDY3MjgyMDZlZmI5MzEzOGQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NDYyLCJleHAiOjE3ODI1NDM4NjJ9.P5dJIvpKlMTcexXXPT2O0dIS-e-cEfjIMJNTtTfpueY)

 (application/msword)    
