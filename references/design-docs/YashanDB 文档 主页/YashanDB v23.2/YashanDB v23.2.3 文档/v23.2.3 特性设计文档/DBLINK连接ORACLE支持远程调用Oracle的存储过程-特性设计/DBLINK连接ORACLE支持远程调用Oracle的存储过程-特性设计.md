Created by 彭灵继, last modified on 五月 07, 2024

  


##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

IR:     [YDBRD-27843：崖山DBLINK连接ORACLE支持远程调用Oracle的存储过程](https://jira.yasdb.com/browse/YDBRD-27843)  

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

通过dblink 调用存储过程，理想情况下，希望能如同调用本地存储过程一样方便。通过调研我们需要关注以下几个方面：

####   [1.3.1 调用的输入输出参数及返回值](#131-调用的输入输出参数及返回值)  

- 标量参数 可通过将Oracle 数据的基本类型映射（转换）成YASDB 的基本类型进行处理
- UDT类型、游标及嵌套表


1. 将Oracle的相应的UDT类型同步迁移至Yasdb当中，建立一对一映射关系。即认为Oracle的相应的类型亦同步建立Yasdb中的类型。
1. yasdb 与yex_server之间，可以将上述信息传输给内核，在内核中建立起对应关系。
1. oracle在本地存储过程调用时，如果实际传入的参数数据类型与声明的参数数据类型不一致时，会进行相应的隐式类型转换（Implicit Datatype Conversion），当前已测试相应的用例（关于隐式类型转换，建议翻看官方文档“Data Type Comparison Rules”）。


####   [1.3.2 事务性兼容性处理](#132-事务性兼容性处理)  

- 只读事务/自治事务 通过对友商测试发现，此种情况，获取的输出参数及返回值，只需调用存储过程，调用者无而关注存储过程中事务情况。
- 非自治事务 当前Oracle有insert/update/delete的存储过程，通过dblink 调用时，将认定为分布式事务，如果不通过XA 方式的话，会报 “ORA-02064: distributed operation not supported” 错误。基于此种情况，如果要和Oracle 保持一致的话，就需要对存量的存储过程进行改造。基于对已有需求的考量，在实现方式上，可以将  **此种情况转化为上述只读事务/自治事务情形，即将被调用的事务限于存储过程内部自治，对外部调用者不造成影响。**


####   [1.3.3 性能考虑](#133-性能考虑)  

当前性能需要考虑有以下两方面

- 网络方面，当前通过外部yex_server沙箱进程调用，需要从网络框架层面考虑，连接的复用，OCI的同异步调用及会话的管理等，当前框架初步功能已具备
- PL/SQL 执行方式，当前PL/SQL 的执行方式为解释执行，可进一步优化


基于当前的功能框架、已有瓶颈状态及现状，性能方面可暂时忽略。

**CHECKLIST**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|DBLink 调用function(函数)|yex server通过OCI接口调用Oracle的函数|是|是|
||DBLink 调用procedure(存储过程)|yex server通过OCI接口调用Oracle的存储过程|是|是|
|性能|大量调用|初版由yex server框架来实现，待框架优化。|是|否|
|可用性|恢复场景|-|是/否|是/否|
|可靠性|事务控制|是否为XA事务或自治事务|是|是|
|可维可测|存储层|当前将远程的函数或存储过程元数据保存在YasDB内存中，待确定是否需要通过内部视图或存储来展示|否|是|
|安全|安全场景1|-|否|否|
|易用性|dblink 调用Oracle函数/存储过程调用|当前仅支持含标量输入/输出参数的函数/存储过程调用|是|是|
|可修改性|----|-|否|否|
|兼容性|Oracle dblink调用存储过程兼容性|当前部分兼容Oracle dblink 函数及存储过程调用：涉及输入输出参数、事务管理方面|是|是|
|周边配合|权限|-|否|否|
|周边配合|同义词|通过创建函数或存储过程的同义词调用|否|是|
|周边配合|审计|同权限的审计，检查点实现待确定。|否|否|
|周边配合|导入导出工具|-|否|否|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

​ 当前需求是对Oracle存储过程的调用，因而外部依赖于Oracle数据库及OCI 相应的开发包。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|函数调用|func1(param1, param2...)    pkgname.func2(param1, param2...)|参见函数详细调用说明|是|
|存储过程调用|proc1(param1, param2...)  pkgname.proc2(param1, param2...)|参见存储过程详细调用说明|是|


函数调用约束

1. 函数可出现在select 列表、insert..values列表、update...set子句、where/having/connect by/groupby等filter出现的位置。
1. table function 可出现在select 列表的表名，from 子句中，而check 约束、列的默认值函数值要求不可变定义。


当前对函数调用仅为上述位置1的情况（即在位置1的地方识别dblink中的函数），对其他情况暂不处理。且函数的参数列表仅可为IN（输入）参数类型。

##   [3. 规格与约束](#3-规格与约束)  

当前基于dblink 远程调用Oracle函数及存储过程，约束包含以下方面：

- 输出、输入及返回参数 仅支持  **数据库基本类型**  对应的标量参数(即当前需求不支持游标，UDT等）
- 事务物属性：对Oracle函数及存储过程调用支持只读事务、自治事务及作为调用者的子事务，不支持XA 事务。
- 当前认为远端函数/存储过程的结果是不稳定Unstable的。
- 不支持报错场景：函数索引，check 约束，建表default值使用函数，func_xxx@dblink_name(p1,...)%type 的等场景


##   [4. 特性](#4-特性)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d30a1ad9a3311dc8f59/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NjksImV4cCI6MTc4MjMxNzI2OX0.RhTN4c4UrxomiFX82myDLcwJkO0LQqdu-d7r77V4F9U)

校验的函数/存储过程信息包括：

- 名称信息，以ora_user.pkg_name.proc_name(param1,param2...) ret 为全称逐层进行校验（即分别以ora_user, pkg_name等依次处理）。
- 参数信息，参数信息校验包括，参数数据类型，IN/OUT输入输出类型，数据类型一致或可转换，输入输出类型需一致。
- 返回值信息，返回值类型一致或可转换。


>   Oracle 获取元数据接口需要逐级获取信息，即先获取包元数据信息，再获取方法信息，依次参数等，无法通过. 层级定位一次获取。  

###   [4.1 特性设计](#41-特性设计)  

####   [4.1.1 参数校验](#411-参数校验)  

- 当前输入/输出参数、返回值只支持标量类型或可转化成标量类型的数据类型，其他数据类型检测，报错暂不支持。
- 通过Oracle 相关OCI接口OCIDescribeAny() 获取函数或存储过程的元数据信息。
- 函数或存储过程的全称格式为schema.pkg_name.prc_name(param1,param2...) 此种格式，其中因Oracle不支持超出2个层次的名称，因而需要以.切分传递过来的名称，依次测试是否为schema、pkg_name等从而确定对象的存在及有效性。
- 因存在元数据的变动（即一切以执行结果为准），编译期不报错。（考虑执行前获取元数据，然后据元数据进行绑定）。
- 在ParseTree中的storedObjects保存远端函数或存储过程的元数据信息（SoDecl成员增加YlnSoObj成员）（元数据信息不存在DC中是为了和YlnTable设计保持一致）


####   [4.1.2 事务支持](#412-事务支持)  

根据已有调研，事务支持可分为以下几种方案：

#####   [方案一 存储过程调用统一封状为自治事务](#方案一-存储过程调用统一封状为自治事务)  

- 对于函数/存储过程为声明为自治事务的，可以直接进行调用，无需关注事务的处理。
- 对于包括insert/update/delete语句且未场景为自治事务的存储过程，可以yex_server端进行封装处理：如果对存储过程的  **本地调用**  过程中发生事务性异常，则进行rollback处理，并将异常抛给调用端；如果未发生异常，则一概进行commit处理。


>   1. 当前对存储过程的调研发现，暂时无法通过元数据接口  **感知存储过程是否为自治事务，以及无法得知存储过程是否有事务更新操作或只读查询**
  1. Oracle对非自治的存储过程在使用dblink 调用时，统一认为是分布式操作
  

#####   [方案二 兼容Oracle数据库处理流程](#方案二-兼容oracle数据库处理流程)  

- 对存储过程的调用直接转化为  **相应的Oracle dblink调用存储过程**  ，直接使用交给用户的调用者处理：如果是自治事务，则调用正常；否则报分布操作错误。


>   此种方式，如果存量存储过程是自治事务，则调用流程较为方便；如果非自治事务，刚对存量存储过程有严重的侵入性改造，即存储过程需要改造为XA事务，同时YASDB 也需要在PLSQL端加入XA 事务的支持。  

#####   [方案三 保持事务特性交用户处理](#方案三-保持事务特性交用户处理)  

- 将对存储过程的调用视为  **对Oracle本地存储过程**  的调用，Oracle内部的事务控制交给调用者(YasDB)控制。用户在YasDB 中的事务操作(Commit/Rollback)，同步到Oracle中。


>   此种方式类似于当前dblink 查询表操作。  

####   [4.1.3 协议调整（内部）](#413-协议调整内部)  

通过上述的流程，需要对协议部分进行以下调整

DBLINK_CMD_DESCRIBE2：加入对函数、存储过程的请求响应的类型及对应元数据信息

DBLINK_CMD_EXECUTE_SQL：加入对输入输出参数类型的设置以及返回结果集的支持

####   [4.1.4 函数或存储过程的执行](#414-函数或存储过程的执行)  

在YASDB 构造以下语句，通过协议DBLINK_CMD_EXECUTE_SQL命令执行来绑定参数及获取结果。

```
// 函数调用
BEGIN 
	:v_out := func_call(:param1, :param2,...); 
END;

// 存储过程调用
BEGIN 
	proc_call(:param1, :param2,...); 
END;

```

###   [4.2 特性可维可测设计](#42-特性可维可测设计)  

###   [4.3 特性安全设计](#43-特性安全设计)  

###   [4.4 特性周边配合](#44-特性周边配合)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[proc-inves.md](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzA4OTcwYzJhZjRmNTIxMGU4IiwicmVmX2lkIjoiNjczOTZkMzA3MjgyMDZlZmI5MmYxYzIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NDY5LCJleHAiOjE3ODIzOTI4Njl9.POdCEcFdm1W_0-aZtB8XsA22vGphFf8xLofIhKFn4AQ)

 (application/octet-stream)    


[proc-dblink.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzA4OTcwYzJhZjRmNTIxMGU5IiwicmVmX2lkIjoiNjczOTZkMzA3MjgyMDZlZmI5MmYxYzIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NDY5LCJleHAiOjE3ODIzOTI4Njl9.k63Snl-S1_VGGjEbpQhdr9zPapLXbTNysg7Q13RkgE4)

 (image/png)    
