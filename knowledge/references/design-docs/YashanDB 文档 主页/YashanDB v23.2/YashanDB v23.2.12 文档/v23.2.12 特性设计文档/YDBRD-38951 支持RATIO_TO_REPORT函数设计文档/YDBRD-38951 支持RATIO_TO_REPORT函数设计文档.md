

  [https://pingcode.yasdb.com/pjm/items/67d148046dccc3daa31662e4?](https://pingcode.yasdb.com/pjm/items/67d148046dccc3daa31662e4?)  

#YDBRD-38951 支持RATIO_TO_REPORT函数



# 1 设计简介

华润元大基金项目要求兼容oracle RATIO_TO_REPORT窗口函数，实现崖山DB RATIO_TO_REPORT窗口函数，用于分析函数，主要用于计算某个值相对于分组内所有值总和的比率。



# 2 特性概述

 支持RATIO_TO_REPORT函数，用于分析函数，主要用于计算某个值相对于分组内所有值总和的比率。

支持单机，分布式，集群部署方式。

## 

```
RATIO_TO_REPORT (expr) OVER ([PARTITION BY partition_by_clause])

参数：
expr：需要计算比例的表达式，通常是某个列或者计算得出的值。
PARTITION BY partition_by_clause：可选的部分，用来对数据进行分区计算。如果没有指定，RATIO_TO_REPORT 会对整个结果集进行计算。
```



# 3 方案分析（可选）

*概要设计中已经系统性阐述的，本章节可以省略，或根据特性设计中对场景的扩展进行补充。没有概要设计的，本章节需要做分析。*



## 3.1 业内方案分析（可选）

*该特性在业内的实现机制，对比分析，优劣性对比。*

*旧版本中需求调研独立文档承载，新版本中在概要设计中阐述。*



## 3.2 外部依赖分析（可选）

*开源及第三方软件使用选型影响分析，重点描述本特性需要引入的开源及第三方软件的选型影响分析。*

*需要附加软件管理委员会评审结论。*

# 4 特性设计

|约束||
|---|---|
|RATIO_TO_REPORT 窗口函数只支持行执行|当前不支持列执行。|
|参数expr支持NUMBER，SMALLINT, INT, BIGINT, TINYINT数值类型，浮点类型(FLOAT,DOUBLE)。|参数expr不支持BIT类型|
|参数expr支持字符类型(CHAR, VARCHAR, NCHAR, NVARCHAR)值能转换成数值类型|如果字符类型的值不能转换成数值类型，报无效number.|
|参数expr不支持日期类型(DATE, TIME, TIMESTAMP, INTERVAL YEAR TO MONTH, INTERVAL DAY TO SECOND)，RAW类型, 布尔类型(BOOLEAN), 大对象类型(CLOB, BLOB, NCLOB)，(ROWID, UROWID)类型， JSON类型，XMLTYPE类型，以及不能转换成数值类型的字符类型。||
|参数expr支持内置函数类型|不支持窗口函数等分析类型函数|


### 4.1 新增窗口函数定义:

   1.  gBuiltinWinFuncs 串口函数定位里面新增 RATIO_TO_REPORT窗口函数定位:

```
 {WIN_FUNC_DECL(RATIO_TO_REPORT, RatioToReport, 1, 1), .aggrId = COD_INVALID_UINT8, .sortSensitive = COD_TRUE, .ofsFetchNeeded = COD_TRUE}
```



### 4.2 窗口函数Total中间值变量:

1.   `AnlWindow`  中添加 Variant* 指针变量  `ratioTotalVars`  ，用于保存当前窗口RATIO_TO_REPORT函数计算total中间值。
1. 在prepareWindows函数调用  `anlAllocWindowRatioTotalVars`  接口分配ratioTotalVars内存： 


       1. 当前窗口不包含 RATIO_TO_REPORT 函数，设置  `ratioTotalVars `  指针变量为空。

       2. 如果当前窗口包含 RATIO_TO_REPORT 函数，分配当前窗口函数总数 (funcCount) 内存空间。

### 4.3 窗口函数功能接口实现:

   1. 新增RATIO_TO_REPORT窗口函数 verify, conclude, begin, add, remove, finalize 功能函数接口.

   2.   `verify`  ,   `conclude`   对应实现函数  ` biwVerifyRatioToReport`  ,   `biwConcludeRatioToReport`   函数功能添加, 判断输入参数是否是支持参数类型，并且设置输出数据类型为:   `DTYPE_DOUBLE`  . 

    3.   `begin `  初始化当前函数  `total`  中间值  ` ratioTotalVars[decl->func->aggrValueNo]`  , 设置变量类型为   `DTYPE_DOUBLE`  ，   `isNull = COD_TRUE`  .

    4.   `add `  窗口函数接口实现   `biwFrameAddRatioToReport`  , 函数把当前窗口expr值累加, 并把计算结果保存到total中间值.

    5.   `remove `  窗口函数接口实现   `biwFrameRemoveRatioToReport `  函数不做处理.      

    6.   `finalize `  窗口函数接口实现    `biwFrameFinalizeRatioToReport`  ，函数功能实现:

       1. 执行 execExpr 算子，获取当前输入参数.

       2. 判断total中间值是否为 0， 如果是  `windowGetValue`  获取执行中间结果设置   `isNull = COD_TRUE`  , 输出   `NULL`   结果.

       3. total中间值非0，计算输入参数 / total中间值，得到当前行的比例 (RATIO),  赋值给  `windowGetValue`  函数获取执行当前窗口函数执行中间结果。



### 4.4 安全性设计

*不涉及安全相关的，可以不用详细展开。对于涉及安全威胁分析及设计的，根据安全设计方法，数据流图、业务场景以及信任边界进行分析说明。具体方法有：*

|*分析手段*|*安全分析点*|
|---|---|
|*外部交互分析*|*需要关注仿冒、抵赖相关威胁分析。*|
|*数据流分析*|*需要关注篡改、信息泄露、拒绝服务分析。*|
|*处理过程分析*|*需要关注仿冒、篡改、抵赖、拒绝服务、权限提升分析。*|
|*数据存储分析*|*需要关注篡改、抵赖、信息泄露、决绝服务分析。*|




# 5 资料设计



# 6 自测用例设计

测试方案设计: 

|测试项目|预期||
|---|---|---|
|expr支持整型数值类型验证|支持||
|expr支持double,float数值类型验证|支持||
|expr支持number数值类型验证|支持||
|expr支持字符能转换成数值类型验证|支持||
|expr支持字符不能转换成数值类型验证|不支持，报错||
|expr不支持raw,blob,clob,nclob类型验证|不支持，报错||
|ratio_to_report和where, order by,group by组合验证|查询成功||
|expr支持内置函数验证|查询成功||
|expr不支持窗口函数验证|报错||
|null值类型验证|输出0||
|计算总和为0验证|输出null||




# 7 参考资料（非必选）

