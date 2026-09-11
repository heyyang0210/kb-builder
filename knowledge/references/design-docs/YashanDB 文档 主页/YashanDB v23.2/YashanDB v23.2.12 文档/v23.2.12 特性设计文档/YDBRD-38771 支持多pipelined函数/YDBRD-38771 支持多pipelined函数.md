SR：

  [https://pingcode.yasdb.com/pjm/items/67c918a97ce85d5a075753e6?](https://pingcode.yasdb.com/pjm/items/67c918a97ce85d5a075753e6?)  

#YDBRD-38771 支持多PIPELINE执行

  [https://pingcode.yasdb.com/pjm/items/67c917d27ce85d5a075752b2?](https://pingcode.yasdb.com/pjm/items/67c917d27ce85d5a075752b2?)  

#YDBRD-38767 PIPELINE函数支持record类型



历史版本支持方案与规格：

  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6739705d728206efb92f3bda](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6739705d728206efb92f3bda)  



## ﻿  [ 1. 总述 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-%E6%80%BB%E8%BF%B0)  ﻿

管道表函数，简称管道函数，是用户自定义的PL/SQL函数，返回一组行数据。用户可以使用SELECT语句直接查询管道函数获取结果集。

现有版本中不支持一条SQL语句中使用多个管道函数，不支持返回record类型元素。

现有约束：

1）一条查询只支持使用一个管道函数，不支持多个管道函数join等场景；oracle支持；

2）管道函数返回的集合元素类型不支持record类型，yashan udt类型序列化不支持record类型(支持udt object类型)；oracle支持表行类型，例如返回类型为：TABLE OF tb_001%rowtype

本设计文档提出支持方案，支持多管道函数场景，支持返回record元素类型。



### ﻿  [ 1.1 需求来源 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  ﻿

POC需求。

支持单机、集群部署，暂不支持分布式。

### ﻿  [ 1.2 调研文档 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  ﻿

﻿  [ https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-optimization-and-tuning.html#GUID-ED557894-EC08-47E0-A629-0E4AEDDBB77B ](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-optimization-and-tuning.html#GUID-ED557894-EC08-47E0-A629-0E4AEDDBB77B)  ﻿

### ﻿  [ 1.3 需求分析 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  ﻿

CHECKLIST

|||||||
|---|---|---|---|---|---|
|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|支持多管道函数||过程体执行信息中记录多个管道信息；,function表达式下VarFunc中记录管道id；,执行时通过管道id索引管道执行结果；||||
|管道函数返回的集合元素类型支持record类型||record类型/udt object类型逐个展开元素写入管道，查询线程中逐个取出元素；,TableFuncDecl中列元素信息直接记录元素个数与元素类型信息；||||
|可维可测||﻿|﻿|﻿|﻿|
|周边配合||﻿|﻿|﻿|----|
|周边配合||﻿|﻿|﻿|----|
|周边配合||﻿|﻿|﻿|----|


### ﻿  [ 1.4 数据字典 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  ﻿

描述本篇文档中特性的术语集

|||||
|---|---|---|---|
|术语|描述|借鉴业界|参考|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


### ﻿  [ 1.5 开源依赖 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  ﻿

不涉及。

## ﻿  [ 2. 接口 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-%E6%8E%A5%E5%8F%A3)  ﻿



## ﻿  [ 3. 规格与约束 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  ﻿

说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。 规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

|约束|说明|友商参考|
|---|---|---|
|record类型中的元素类型须为标量类型或全局UDT类型|||
|||﻿|


## ﻿  [ 4. 特性 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-%E7%89%B9%E6%80%A7)  ﻿

### ﻿  [ 4.1 多管道函数实现 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  ﻿

原实现方案管道信息放在过程体信息中，需要解决多pipe信息记录问题。

```
typedef struct StSoExecInfo {
  CodPointer        executor;
  ...
  CodPointer    pipeFuncCtx;  //这里只有一个pipe信息，无法支持多pipe信息区分
}
```



Function Node表达式记录的是SoDecl或PackDecl信息，需要增加pipe id信息，要能够索引pipe信息。

```
typedef struct StVarFunction
{
    ...
    union {
      VarUdf     udf;    // for standalone function
      VarUdpFunc udpf;   // for package child function
    };
}

// 独立function下需要增加pipe id信息以支持执行时对应管道函数的启动、释放与结果获取
typedef struct StVarUdf
{
    CodPointer decl; // SoDecl
    CodUint32  id;
} VarUdf;

// package function下需要增加pipe id信息以支持执行时对应管道函数的启动、释放与结果获取
typedef struct StVarUdpFunc {
    CodPointer decl; // PackDecl
    CodUint16  headId;
    CodUint16  bodyId;
} VarUdpFunc;
```



#### 4.1.1 结构调整

多pipe信息记录。

```
typedef struct StSoExecInfo {
  CodPointer        executor;
  ...
  // 对于主线程stmt，这里的pipeFuncCtx 是一个指针数组，对应多个pipe信息
  // 对于并行的pipe线程下stmt，这里的currPipe是正在运行处理的pipe信息
  union {
        CodPointer    pipeFuncCtx; // main thread pipelined functions array
        CodPointer    currPipe;    // pipe thread self
    };
}
```



Function Node表达式索引pipe信息。

方案1：

```
typedef struct StVarUdf
{
    CodPointer decl; // SoDecl
    CodUint32  id;
    CodUint16  pipeId;  //增加pipe id以支持执行时对应管道函数的启动、释放与结果获取
    CodUint16  unused;
} VarUdf;

// package function下需要增加pipe id信息以支持执行时对应管道函数的启动、释放与结果获取
typedef struct StVarUdpFunc {
    CodPointer decl; // PackDecl
    CodUint16  headId;
    CodUint16  bodyId;
    CodUint16  pipeId;  //增加pipe id以支持执行时对应管道函数的启动、释放与结果获取
    CodUint16  unused;
} VarUdpFunc;
```

该实现方案会撑大Variant，变量大小从24变为28，影响PlanCache、SoCache等缓存使用。



方案2：

保证Function Node大小不变，重新定义结构体，其内部包含SoDecl或PackDecl、pipeId等信息。

```
typedef struct StSoExprInfo {
    SoDecl* soDecl;
    CodUint16 pipeId;
    CodUint8  reserved[6];
} SoExprInfo;

// function node 大小不变，SoDecl放置到内层
typedef struct StVarUdpFunc {
    CodPointer packExprInfo; // PackExprIno
    CodUint16  headId;
    CodUint16  bodyId;
} VarUdpFunc;

typedef struct StPackExprIno {
    PackDecl* packDecl;
    CodUint16 pipeId;
    CodUint8  reserved[6];
} PackExprIno;

// package function node 大小不变，PackDecl放置到内层
typedef struct StVarUdpFunc {
    CodPointer packExprInfo; // PackExprIno
    CodUint16  headId;
    CodUint16  bodyId;
} VarUdpFunc;
```



###   [ 4.2 管道函数返回集合元素类型支持Record类型](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

现有实现因yashan udt类型序列化不支持record类型，管道函数对record元素类型做了拦截。

对UDT Object类型进行完整序列化并写入管道，查询线程读取管道并反序列之后，展开其内部元素并将行数据交给协议栈。

udt object 现有方案：



record，udt object 读写pipe方案调整：



相关结构：

```
typedef struct StTableFuncDecl {
    CodText          owner;
    CodText          name;
    CodUint32        maxRowSize;
    CodUint16        columnCount;   // 对于object或record，这里是元素个数；其他为固定1
    CodUint16        minArgCount;
    CodUint16        maxArgCount;
    CodUint16        unused[3];
    TableFuncColumn* columns; // 投影列元数据信息，对于object或record这里可能有多个；其他固定1个
    TableFuncVerify  verify;
    TableFuncExec    exec;
    TableFuncFetch   fetch;
    TableFuncClose   close;
} TableFuncDecl;
```



## ﻿  [ 5.Testcases ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  ﻿

（1） 

## ﻿  [ 6.未来规划 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  ﻿



