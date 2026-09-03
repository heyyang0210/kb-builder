IR：  [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2b5](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2b5)  ?  
#YASHAN-869 package支持procedure和function重载功能



# 1 简介



## 1.1 目的

本设计要实现package内支持过程和函数的重载功能，用户可以创建多个同名但参数数量、类型或次序不同的过程或函数，调用时根据实际传入的参数调用到特定过程或函数。



## 1.2 范围

PLSQL模块中，package的procedure和function的参数校验、持久化和查找能力都已经具备，只是约束了过程或函数名必须唯一。本设计从功能上需要增加重载的能力，同时要考虑实现的效率。

本设计有以下要点：

1. 放开了package中子过程（过程或函数）的名字唯一约束，改成通过名字+函数签名作为子过程唯一标识。
1. 根据参数匹配规则，通过实参对多个重名子过程进匹配，得到最匹配的子过程。




# 2 需求概述

PLSQL模块中已经具备package的过程和函数基础能力，并不增加新的功能模块，这里只需要在原有基础上增加子过程的重载能力。

|功能模块|修改方案|备注|
|---|---|---|
|PLSQL存储|放开子过程的名字唯一约束，修改PACKAGE$的索引类型|涉及版本升级|
|PLSQL缓存|增加同名子过程对象的存放及查找过滤能力||
|PLSQL校验|1. 创建子过程时，按名字+函数签名的校验匹配逻辑
1. 调用子过程时，根据实参列表进行查找并匹配到具体的子过程，得到相应的函数签名
||
|PLSQL执行|通过子过程名+函数签名，找到子过程实体，完成调用||




# 3 需求场景分析



## 3.1 需求来源

市场上不同的项目，例如华润数科、国信证券、西部石油等，都对package的procedure和function重载功能有诉求。



## 3.2 价值概述

YashanDB的PLSQL目前不支持package的过程和函数重载，外部客户业务进行迁移遇到重载的用法，一般都要通过改写SQL的方式进行规避。这样的话，增加业务迁移工作量是一方面，也会对客户带来一些不好的体验。



## 3.3 需求场景分析

|场景|子场景|触发条件|关键操作|备注|
|---|---|---|---|---|
|子程序创建|创建package head|用户执行SQL创建package head|1. package声明中，校验同名子过程是否重复
1. 在head缓存中生成各同名子过程对象
|参数个数、各参数名及类型都相同，则判定为重复|
||创建package body|用户执行SQL创建package body|1. body中，校验各同名子过程是否重复
1. 确认同名子过程是否public类型
1. 在body缓存中生成各同名子过程对象
||
|子过程调用||用户执行SQL以具体参数调用子过程|1. 根据子过程类型、名字、参数数量或参数名，过滤满足条件的子过程
1. 按用户传入的实参和各子过程的形参进行对比匹配，确定最终被调用的子过程
1. 执行对应子过程
||
|升级||YashanDB版本升级|删除PACKAGE$旧的唯一索引，新建普通索引||
|缓存加载||启动后子过程首次被调用|从存储中将子过程加载进缓存，并为各子过程生成函数签名||




## 3.4 需求影响分析

需求主要是功能实现，而且是原有功能上的调整，不涉及性能、可用性、安全性等质量属性。

- 兼容性 涉及元数据变更，需要进行升级适配处理




## 3.5 外部依赖分析

不涉及



## 3.6 业内方案分析

|对比项|Oracle|SQL Server|MySQL|PostgreSQL|YashanDB|
|---|---|---|---|---|---|
|全局函数、过程的重载|不支持||不支持|支持|不支持|
|函数与过程重名，参数列表一致|支持||不支持||支持|
|参数数量不同的重载|支持|支持|不支持|支持|支持|
|参数类型不同的重载|支持|支持|不支持|支持|支持|
|实参到形参数据类型的隐式转换|支持|支持|不涉及|支持|支持|
|其他|||用户通过参数+IF/ELSE逻辑可以实现类似重载能力|||


注：除了Oracle特性外，其他数据库的信息基本是从AI、网页上摘录而来，可能存在不全面或不精准的问题。

相关调研见  [package支持procedure和function重载功能调研](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6739c252593f99c9ff255652)  



# 4 方案设计



## 4.1 方案概述

该章节主要描述如何将需求转换为具体的特性，架构如何布局，方案的架构图等。根据当前需求的具体诉求选择一种或若干种设计方法进行概要设计。

|设计方法 |具体措施|
|---|---|
|结构化设计方法|数据流图 + 状态转换图 +  ER图|
|4+1架构视图设计方法|- 用例视图：用例图（通过 场景描述，以及对应场景下的设计方案，也可以直接用例描述）
- 逻辑视图：类图/对象图/构件图/包图（特性下各模块的分工配合）
- 实现视图/进程视图：顺序图/活动图/状态图/定时图（详细设计文档更为关注、概要设计多为特性框架视角）
- 部署视角：部署图 （子特性不涉及，总体设计文档涉及）
|




## 4.2 设计原则

不涉及，只是原有功能调整

## 4.3 子程序创建

只有package内的函数或过程支持重载，全局的函数或过程不支持。

### 4.3.1 放开package内同名函数或过程的约束

#### 4.3.1.1 放开名字校验约束

原规则：所有UDT名（自定义类型）、参数名、UDE名（自定义异常）、子过程名（包括函数和过程）都不能重名

新规则：所有UDT名（自定义类型）、参数名、UDE名（自定义异常）之间及与子过程名不能重名，子过程间可以重名

#### 4.3.1.2 放开PACKAGE$系统表中子过程名唯一约束

原索引：CREATE   **UNIQUE**   INDEX I_PACKAGE4 ON PACKAGE$(OBJ#, SUBPROGRAM_NAME)

新索引：CREATE INDEX I_PACKAGE4 ON PACKAGE$(OBJ#, SUBPROGRAM_NAME)

因为涉及到版本兼容，需要在upgrage.sql上drop原来的unique index，再创建新的普通index

### 4.3.2 同名子过程的函数签名

原来的逻辑，package内不支持同名子过程，把name作为子过程在package内的唯一标识。新的逻辑需要支持同名子过程，则需要另外增加新的标识进行唯一标识。

按照一般高级语言及其他数据库的做法，都将函数名+参数列表作为唯一标识，一般也称作“函数签名”。

函数签名格式：  **{参数名1}_{类型名1},{参数名2}_{类型名2},...**

例如：PLSQL片段function test_func(val1 number, val2 integer, val3 varchar) return number;

对应函数的签名为：VAL1_NUMBER,VAL2_INTEGER,VAL3_VARCHAR。

【注】根据对Oracle的调研，子过程创建时会校验参数名+参数类型，但形参类型（IN、OUT等）、返回值及参数默认值等不影响结果。同时对于相同类型不同命名的参数类型也是支持重载的，例如T1，T2都是int的子类型，只有这个差异的两个函数可以创建成功。



函数签名不进行持久化，解析create语句或加载子过程对象时，通过参数列表生成。主要使用场景是：

1. 创建package声明时，检查各子过程定义是否重复。
1. 创建package body时，根据body中子过程形参，查找该子过程是否public定义。
1. 调用子过程时，verify阶段完成子过程匹配后，记录下函数签名，到execute阶段再根据子过程名+函数签名找到具体子函数


### 4.3.3 建立同名子过程的访问cache

子过程的cache信息挂在PackObjHashCtx下的hash桶上，原来同名的对象只会有一个。支持重载后，将存在多个同名的对象，可以通过函数签名进行区分。

![图片.png](https://pingcode.yasdb.com/atlas/files/public/6757960aa1ad9a3311de4577/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUNBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBRUFBQUFBQUFBQUFBQUFBQ0FBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFGQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQ1FBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY5NDUsImV4cCI6MTc4MjQ2Nzc0NX0.Cr1HDR2NvKF3FFZ4uOcVx5Et2qPkL0IKyF1mjG8KgNM)

流程上只需要进行简单的调整适配就可以完成。

![图片.png](https://pingcode.yasdb.com/atlas/files/public/67579b9ea1ad9a3311de4587/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUNBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBRUFBQUFBQUFBQUFBQUFBQ0FBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFGQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQ1FBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY5NDUsImV4cCI6MTc4MjQ2Nzc0NX0.Cr1HDR2NvKF3FFZ4uOcVx5Et2qPkL0IKyF1mjG8KgNM)

## 4.4 子过程调用

子过程调用的调整主要涉及两个环节，

一个是verify阶段匹配到确定的一个函数实体（package head中）并记录函数签名，

二是execute阶段通过函数名+函数签名找到对应的子过程（package body中）然后按原流程执行。

### 4.4.1 根据实参匹配具体子过程

名字唯一时，只需要找到特定子过程，再进行匹配或经过隐式转换匹配，是否合适只要一路校验过去就确定了。

支持重载后，可能存在多个重名的子过程，整体的流程是  **先根据条件进行过滤，再按照实参类型进行匹配**  。

匹配到具体子过程后，将记下子过程的名字及函数符号，为execute阶段的执行做准备。

![图片.png](https://pingcode.yasdb.com/atlas/files/public/67594186a1ad9a3311de471b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUNBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBRUFBQUFBQUFBQUFBQUFBQ0FBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFGQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQ1FBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY5NDUsImV4cCI6MTc4MjQ2Nzc0NX0.Cr1HDR2NvKF3FFZ4uOcVx5Et2qPkL0IKyF1mjG8KgNM)

#### 4.4.1.1 重名子过程过滤

根据过滤条件，先在所有重名的子过程中，快速过滤出符合条件的子过程。

过滤条件：

1. **子过程名**
1. **子过程类型（函数或过程）**
1. **参数个数是否满足（不通过名字指定实参列表）**
1. **参数名是否满足（通过名字指定实参）**


过滤完后，没有合适的子过程，则报错，否则进入下一个参数匹配的流程。

#### 4.4.1.2 匹配规则

总体匹配规则：

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


YashanDB类型组见  [集合类类型推导](https://pingcode.yasdb.com/wiki/pages/67397078593f99c9ff239a41)  

我们尽量去兼容Oracle的匹配规则，不过这块细节比较多，两个数据库数据类型上就有差异，无法做到百分百兼容。这块的目标有两点：

1. **输出一个大家认同的，尽量能够兼容Oracle的匹配规则；**
1. **用户手册上简单介绍一下我们的匹配规则，建议用户通过明确的类型去调用重载子过程。**


#### 4.4.1.3 数字类型匹配规则

按NUMBER类型组中的推导顺序进行匹配，DOUBLE类型优先级最高，TINYINT类型优先级最低

DOUBLE>FLOAT>NUMBER>BIGINT>INTEGER>SMALLINT>TINYINT

另外，STRING类型组也可以转成NUMBER类型进行匹配。

匹配规则：

1. **两个子过程按顺序逐个参数类型进行比较**
    1. **类型完全相同或属于同一个类型组，则该参数比对结果标记为0**
    1. **类型都属于NUMBER类型组的，顺序优先的参数比对标记为+，落后的标记为-**
    1. **类型一个属于数组类型，一个属于STRING类型，数组类型标记为++，字符类型标记为--**
1. **比对结果中有++/--的，只看这类型差异。只有++的子过程被匹配上，如果子过程有++也有--，则报错存在歧义**
1. **比对结果中没有++/--，但有+/-的，只看+/-。只有+的子过程被匹配上，如果子过程有+也有-，则报错存在歧义**
1. **比对结果中只有0的，报错存在歧义**




与Oracle匹配规则对比

|对比项|Oracle|YashanDB|备注|
|---|---|---|---|
|NUMBER类型组范围|- NUMBER(int/smallint/float/real/number等)
- BINARY_INTEGER(NATURAL/POSITIVE/PLS_INTEGER等)
- BINARY_FLOAT
- BINARY_DOUBLE
|- DOUBLE
- FLOAT
- NUMBER
- BIGINT
- INTEGER
- SMALLINT
- TINYINT
|Oracle NUMBER类型组文档中，BINARY_FLOAT/BINARY_DOUBLE是类型，BINARY_INTEGER是子类型|
|NUMBER类型间匹配顺序|文档上：PLS_INTEGER>NUMBER>BINARY_FLOAT>BINARY_DOUBLE,实际测试：NUMBER>BINARY_FLOAT>BINARY_DOUBLE>PLS_INTEGER|DOUBLE>FLOAT>NUMBER>BIGINT>INTEGER>SMALLINT>TINYINT||


### 4.4.2 执行子过程

执行过程时，需要拿verify阶段的唯一标识，取到具体的子过程进行执行。这个过程，修改前后变化不大，唯一差异是这个唯一标识从子过程名变成了子过程名+函数签名。

## 4.5 安全性设计

不涉及



## 4.6 其他DFX相关设计

### 4.6.1 兼容性

修改涉及PACKAGE$上索引的重建，见“4.3.1.2 放开PACKAGE$系统表中子过程名唯一约束”章节



# 5 需求分解列表

|分解特性SR|特性说明|工作量|
|---|---|---|
|package支持procedure和function重载功能|||
||||


# 6 未来规划

## 6.1 全局函数和过程的重载

由于机制上不同，package的函数和过程的重载无法适用于全局的函数和过程，如果要支持还需重新设计。目前Oracle也不支持全局的函数和过程重载，外场也没有这块的需求，暂时不考虑。



# 7 参考资料清单

Oracle子过程重载：  [9.9 Overloaded Subprograms](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnpls/plsql-subprograms.html#GUID-47D5A50E-7AAF-4C80-A06A-37593EA2526A)  

YashanDB类型组：  [集合类类型推导](https://pingcode.yasdb.com/wiki/pages/67397078593f99c9ff239a41)  

Oracle类型组：  [E PL/SQL Predefined Data Types](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnpls/plsql-predefined-data-types.html#GUID-1D28B7B6-15AE-454A-8134-F8724551AE8B)  



