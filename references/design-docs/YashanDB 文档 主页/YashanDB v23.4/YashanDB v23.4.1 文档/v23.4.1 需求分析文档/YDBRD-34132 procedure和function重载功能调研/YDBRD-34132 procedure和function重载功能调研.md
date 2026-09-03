Created by 张欣, last modified on 十月 11, 2024

**目的：**    
  1.牵引TSE理解特性，熟悉特性的主要能力、规格、约束、应用场景等    
  2.牵引TSE在研发设计评审中能给出有效意见(如识别特性行为、规格、约束与友商的重大差异，关联能力缺漏)    
  3.给测试概要设计和测试详细设计做输入

# 1. 需求概述

  [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2b5](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2b5)    ?    
  #YASHAN-869 package支持procedure和function重载功能

场 景： 1、FUNCTION convert(dataType VARCHAR2,num NUMBER) RETURN NUMBER; 

FUNCTION convert(dataType VARCHAR2,date DATE, num NUMBER ) RETURN VARCHAR

2; 需求描述： package支持procedure和function重载功能 

需求范围： 单机和集群

  


# 2. 友商的实现情况

2.1   *Oracle*  支持以下范围的过程或函数重载（也叫静态多态）：  


|1|嵌套子过程，在同一个块的声明部分（匿名块或过程、函数）|yashan本次不支持|
|---|---|---|
|2|pkg的head和body部分声明定义的过程|本次需求支持的范围|
|3|object type的head和body部分声明定义的过程（仅member方法）  重写 |yashan已经支持，校验等部分功能还未做全|


同名的普通过程或函数  不支持。



2.2重载功能的前提：  **同名**  的过程或函数，  **同属一个作用范围**  。

2.3判断重载的标识

|  
|  
|是否可以区分|
|---|---|---|
|形参    
    
|名称，个数，顺序|如果只是形参名称不同，必须按名传参|
||  
|按名、按位置、混合传参，注意有default值的情况 可能会导致按名和按位置传参混淆，导致无法判断（参见异常示例2）|
||数据类型|**可以区分 ，至少有一个参数不是同个数据类型大类**,特殊：,数值大类中各个具体的数据类型 按优先级排序,绑定变量传参,自定义类型|
||方向：in，out, in out|仅方向，不能区分|
|udf返回值|数据类型|仅返回值类型不能区分|
|过程/函数类型|过程|按调用方式或使用位置区分|
||函数|  
|


重载的重要步骤之一是判断选择哪一个版本的定义去执行。测试的一部分重点在入口选择。

  


2.4 转换规则

1.重载的两个过程形参，至少有一个不是同个数据类型大类，否则无法区分。（int，number，float等都是数值大类；char,varchar 等都属于文本大类；clob？）

2.如果同属于数值大类，遵循优先级：int-number-float-double 

实参传参会匹配最接近的一个，如形参number、float、double，实参传int，则匹配number；

如形参int、binary_float，实参传number，  则匹配int还是binary_float？--匹配int

传参时：1).使用标识符，如    `5.0f`       (for       `BINARY_FLOAT`    ),       `5.0d`       (for       `BINARY_DOUBLE`    )

        2).使用转换函数，如    `TO_BINARY_FLOAT`    ,       `TO_BINARY_DOUBLE`    , and       `TO_NUMBER`  

  
（Oracle规则不太清晰）

一个函数接受两个不同类型的形参。一个重载版本接受PLS_INTEGER和BINARY_FLOAT形参。另一个重载版本接受NUMBER和BINARY_DOUBLE形参。如果调用这个函数并传递两个NUMBER参数，PL/SQL首先找到第二个参数为BINARY_FLOAT的重载版本。因为这个参数比另一个重载中的BINARY_DOUBLE参数更接近匹配，PL/SQL然后向下查找并将第一个NUMBER参数转换为PLS_INTEGER。

--  按最后一个参数先匹配，还是按更接近number的匹配,向上还是向下？规律不固定？

  


**注**  ：yashan的数值类型细分没有Oracle多。float（别名real,binary_float）等价Oracle的  binary_float；double（别名binary_double）等价Oracle的binary_double；number ; 另外还有个bit类型。要考虑排序顺序。

**Oracle转换规则调研：**

**数值类型转换规则：**

**单个形参：**

![image.png](https://pingcode.yasdb.com/atlas/files/public/675a4e70a1ad9a3311de47d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFFQUFBZ0FBQUFDQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUVBQUFBQUFBQUFBQUFDQUFBQUJBQUFBQUVBQUFBQUFBQUFBQUFBQUJBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUzOTIsImV4cCI6MTc4MjQ2NjE5Mn0.lL5AU_vsSrZW-j3HLnD00bjauEYxnEXiat7pcSqAiZw)

**单个数值类型参数匹配**

|  
|各过程形参类型|实参传入类型|oracle规则预期匹配类型|19c|21c|
|---|---|---|---|---|---|
|2|NUMBER、BINARY_FLOAT、BINARY_DOUBLE|PLS_INTEGER|NUMBER|NUMBER|NUMBER|
|3|PLS_INTEGER、  binary_float|NUMBER|PLS_INTEGER|BINARY_FLOAT|BINARY_FLOAT|
|||BINARY_DOUBLE|BINARY_FLOAT|BINARY_FLOAT|BINARY_FLOAT|
|4|PLS_INTEGER、BINARY_DOUBLE|BINARY_FLOAT|PLS_INTEGER|BINARY_DOUBLE|BINARY_DOUBLE|
|||NUMBER|PLS_INTEGER|BINARY_DOUBLE|BINARY_DOUBLE|
|5|BINARY_FLOAT、BINARY_DOUBLE|NUMBER|BINARY_FLOAT|BINARY_FLOAT|BINARY_FLOAT|
||BINARY_FLOAT、BINARY_DOUBLE|PLS_INTEGER|BINARY_FLOAT|BINARY_FLOAT|BINARY_FLOAT|
|6|NUMBER、BINARY_FLOAT|BINARY_DOUBLE|BINARY_FLOAT|BINARY_FLOAT|BINARY_FLOAT|
|||PLS_INTEGER|NUMBER|NUMBER|NUMBER|
|7|NUMBER、BINARY_DOUBLE|BINARY_FLOAT|NUMBER？|BINARY_DOUBLE|BINARY_DOUBLE|
|8|PLS_INTEGER、NUMBER|BINARY_DOUBLE||NUMBER|NUMBER|
|||BINARY_FLOAT||NUMBER|NUMBER|
|||varchar||NUMBER|NUMBER|


规则：1.  **形参是**  **BINARY_FLOAT、BINARY_DOUBLE，实参有这两种类型 会优先互相转换**  ；实参NUMBER、PLS_INTEGER 会优先选BINARY_FLOAT；

2.形参是NUMBER、PLS_INTEGER，实参其他两种类型会优先选NUMBER；

3.实参是PLS_INTEGER，会优先选NUMBER。

4.PLS_INTEGER优先级最低。

**1.NUMBER-2.BINARY_FLOAT-3.BINARY_DOUBLE-4.PLS_INTEGER  **

**bit?  **

**boolean (单独大类)**



**两个数值类型参数匹配**

|  
|第一个过程形参类型|第二个过程形参类型|实参传入类型|预期匹配类型过程|21c|19c||
|---|---|---|---|---|---|---|---|
|1|PLS_INTEGER、  BINARY_FLOAT|NUMBER、  BINARY_DOUBLE|NUMBER  、NUMBER|第2个|第2个|第2个|第一个形参成功匹配|
||||NUMBER  、PLS_INTEGER|第2个|第2个|第2个|第一个形参成功匹配|
||||BINARY_FLOAT   PLS_INTEGER|匹配失败|匹配失败|匹配失败|第一个形参隐式转换，第二个(两个都能转) 失败,-+/+-|
||||PLS_INTEGER   NUMBER|第1个|第1个|第1个|第一个形参成功匹配|
||||BINARY_FLOAT   NUMBER|匹配失败|匹配失败|匹配失败|第一个形参隐式转换，第二个(两个都能转) 失败,-+/+-|
||||BINARY_FLOAT   BINARY_FLOAT   |第1个？|匹配失败|匹配失败|第一个形参隐式转换，第二个匹配？,-+/+-|
||||BINARY_DOUBLE   NUMBER|匹配失败|匹配失败|匹配失败|第一个形参隐式转换，第二个(两个都能转) 失败|
||||BINARY_DOUBLE   BINARY_FLOAT   |第1个？|匹配失败|匹配失败|第一个形参隐式转换，第二个匹配？,-+/+-|
|2|PLS_INTEGER和PLS_INTEGER|NUMBER和BINARY_DOUBLE|NUMBER  、NUMBER|第2个|第2个|第2个|第一个形参成功匹配|
||||BINARY_DOUBLE   NUMBER|匹配失败？|第2个|第2个|第一个按优先级选的NUMBER?,--/++|
||||BINARY_FLOAT   NUMBER|第2个|第2个|第2个||
||||BINARY_FLOAT   PLS_INTEGER|第2个?|匹配失败|匹配失败|?,-+/+-|
||||BINARY_DOUBLE   PLS_INTEGER|第2个?|匹配失败|匹配失败|-+/+-|
|3|BINARY_FLOAT、PLS_INTEGER|BINARY_DOUBLE、NUMBER|NUMBER   NUMBER||第2个|第2个|第一个隐式转换，第2个匹配成功,+-/-+|
||||NUMBER   PLS_INTEGER||第1个|第1个|第一个隐式转换，第2个匹配成功|
||||PLS_INTEGER   NUMBER ||第2个|第2个|第一个隐式转换，第2个匹配成功|
||||BINARY_FLOAT   NUMBER|第1个？|第2个|第2个|第一个形参成功匹配？,+-/-+ ?|
||||BINARY_DOUBLE   NUMBER|第2个|第2个|第2个|第一个形参成功匹配|
||||NUMBER   BINARY_DOUBLE||匹配失败|匹配失败|第一个形参隐式转换，第二个(两个都能转) 失败|
||||NUMBER    BINARY_FLOAT ||匹配失败|匹配失败|第一个形参隐式转换，第二个(两个都能转) 失败|
||||PLS_INTEGER   BINARY_FLOAT ||匹配失败|匹配失败|第一个形参隐式转换，第二个(两个都能转) 失败|
|4|PLS_INTEGER BINARY_FLOAT|NUMBER BINARY_DOUBLE|NUMBER   BINARY_FLOAT|第2个||||
|||||||||
|||||||||
||PLS_INTEGER和PLS_INTEGER|NUMBER和BINARY_FLOAT|NUMBER、NUMBER|||||
||PLS_INTEGER和BINARY_FLOAT|NUMBER和PLS_INTEGER|NUMBER、NUMBER|||||


规则：1.第一个形参成功完全匹配，选对应版本；   BINARY_FLOAT 例外？

2.第一个形参隐式转换，第二个(两个都能转) 匹配失败

3.第一个形参隐式转换，第二个完全匹配，选完全匹配对应版本；第二个形参是  BINARY_FLOAT 例外？

4.按单个参数优先级，第一个形参匹配成功记为+，失败记为- ， -+/+- 匹配失败





3.关注特殊场景：

- 不同大类之间，但是可以隐式转换。如number-文本类型；数值-boolean
- 不同大类之间，不能隐式转换。如date-bool
- ~~同个大类，精度或长度限制不同。如 procedure1(c1 varchar(200))  procedure1(c1 char(20000)), number(2) - number(20,8) 等~~


2.5 数据类型大类

- subtype-yashan不支持
- 自定义类型


pkg中的自定义类型名称和全局类型名称重名-不支持

公有和私有自定义类型名称重名-不支持

- 标量类型：


|  
|大类|  
|
|---|---|---|
|1|常量constant|不涉及|
|2|bfile|  
|
|3|blob|  
|
|4|boolean|  
|
|5|文本|char,varchar,raw,rowid,nchar,nvarchar|
|6|clob|clob,nclob|
|7|date|date,timestamp (with time zone ……),ym interval,ds interval,time|
|8|number数值|  
|


yashan的数据类型以具体的为准。

user_native_type



2.6 异常

当无法判断要选择哪一个重载的子程序时，编译器会捕获到重载异常。

当子过程名称参数相同 嵌套调用时，编译子过程或者pkg head时会触发异常。

Oracle对于创建和调用阶段的重载异常有对应的错误码。

示例1：创建成功，执行异常

![](https://pingcode.yasdb.com/atlas/files/public/6739c7458970c2af4f5382dd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFFQUFBZ0FBQUFDQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUVBQUFBQUFBQUFBQUFDQUFBQUJBQUFBQUVBQUFBQUFBQUFBQUFBQUJBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUzOTIsImV4cCI6MTc4MjQ2NjE5Mn0.lL5AU_vsSrZW-j3HLnD00bjauEYxnEXiat7pcSqAiZw)

示例2：有default值，按名和按位置无法区分导致异常

![](https://pingcode.yasdb.com/atlas/files/public/6739c745a1ad9a3311de0129/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFFQUFBZ0FBQUFDQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUVBQUFBQUFBQUFBQUFDQUFBQUJBQUFBQUVBQUFBQUFBQUFBQUFBQUJBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUzOTIsImV4cCI6MTc4MjQ2NjE5Mn0.lL5AU_vsSrZW-j3HLnD00bjauEYxnEXiat7pcSqAiZw)

示例3：隐式转换导致的无法选择，重载异常

```
CREATE OR REPLACE PACKAGE pack1 AUTHID DEFINER AS
  PROCEDURE proc1 (a NUMBER, b VARCHAR2);
  PROCEDURE proc1 (a NUMBER, b NUMBER);
END;
/
CREATE OR REPLACE PACKAGE BODY pack1 AS
  PROCEDURE proc1 (a NUMBER, b VARCHAR2) IS BEGIN NULL; END;
  PROCEDURE proc1 (a NUMBER, b NUMBER) IS BEGIN NULL; END;
END;
/
BEGIN
  pack1.proc1(1,'2');    -- Compiles without error
  pack1.proc1(1,2);      -- Compiles without error
  pack1.proc1('1','2');  -- Causes compile-time error PLS-00307
  pack1.proc1('1',2);    -- Causes compile-time error PLS-00307
END;
/
```

  


                                                                                                                                                                                                                                                                   

# 3. 示例

*友商的用法示例*

  


# 4. 参考文档

  [PL/SQL Subprograms (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-subprograms.html#GUID-47D5A50E-7AAF-4C80-A06A-37593EA2526A)  

  [PL/SQL Predefined Data Types (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-predefined-data-types.html#GUID-1D28B7B6-15AE-454A-8134-F8724551AE8B)  

# 5. 后续关注(可选)

*后续测试设计与执行过程中需跟友商做细化对比的内容*

嵌套子过程的重载；

数据类型支持subtype以后要考虑重载。

  


## Attachments:

