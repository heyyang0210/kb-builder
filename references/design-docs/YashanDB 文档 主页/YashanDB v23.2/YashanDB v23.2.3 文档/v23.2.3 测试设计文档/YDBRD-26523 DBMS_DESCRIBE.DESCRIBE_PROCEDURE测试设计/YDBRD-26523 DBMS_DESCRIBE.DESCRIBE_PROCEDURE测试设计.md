Created by 龚雯, last modified on 六月 11, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

*简要说明本功能/需求的背景，本文档的适用范围*

*支持DBMS_DESCRIBE.DESCRIBE_PROCEDURE检查存储过程的信息*

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


*DBMS_DESCRIBE.DESCRIBE_PROCEDURE(*    
  *object_name IN VARCHAR2,*    
  *reserved1 IN VARCHAR2,*    
  *reserved2 IN VARCHAR2,*    
  *overload OUT NUMBER_TABLE,*    
  *position OUT NUMBER_TABLE,*    
  *level OUT NUMBER_TABLE,*    
  *argument_name OUT VARCHAR2_TABLE,*    
  *datatype OUT NUMBER_TABLE,*    
  *default_value OUT NUMBER_TABLE,*    
  *in_out OUT NUMBER_TABLE,*    
  *length OUT NUMBER_TABLE,*    
  *precision OUT NUMBER_TABLE,*    
  *scale OUT NUMBER_TABLE,*    
  *radix OUT NUMBER_TABLE,*    
  *spare OUT NUMBER_TABLE*    
  *include_string_constraints OUT BOOLEAN DEFAULT FALSE);*

***参数功能***

object_name：描述的过程的名称，可以是同义词，该参数为必填项，不能为空。只能指定存储过程、存储函数、包过程、包函数，不能指定包

reserved1 reserved2  ：保留供将来使用——必须设置为    `NULL`    或空字符串

overload：  分配给过程签名的唯一编号，如果重载该字段为该过程的每个版本保留不同的值

position：参数在参数列表中的位置，位置0返回函数返回类型的值

level：如果参数是复合类型，例如记录，则此参数返回数据类型的级别

argument_name：与过程关联的参数名

datatype：  所描述参数的 Oracle 数据类型

```
PL/SQL BOOLEAN
<span style="color: rgb(26,24,22);">
default_value：如果所描述的参数有默认值为1；否则，值为 0
in_out：</span>
```

  


```
%rowtype
```

## 2.2 应用场景

- *需求本身的主要应用场景*
- *需求与其他特性的关联场景*


*查看存储过程、函数、包过程、包函数的相关信息*

## 2.3 规格约束

- *无*


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

*参数入参：边界值法*

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|参数一  object_name|内置包过程名|test_1|  
|null、空串|test_13|  
|
|  
|内置包函数名|test_2|  
|不存在的存储过程名|test_14|  
|
|  
|用户创建函数名|test_3|  
|包名|test_15|  
|
|  
|用户创建存储过程名|test_4|  
|表名|test_15|  
|
|  
|用户创建包函数名|test_5|  
|udt object方法|test_22|  
|
|  
|用户创建包存储过程名|test_5|  
|内置包名+存储过程名的同义词|test_8|  
|
|  
|存储过程名的同义词|test_9|  
|不设置|test_23|  
|
|  
|有特殊字符的存储过程名|test_11|  
|创建时有编译错误的plsql|test_18|  
|
|  
|内置包名的同义词+存储过程名|test_7|  
|创建时成功，调用时失效的plsql（例如依赖的表被drop）|test_20|  
|
|  
|内置包名+存储过程名整体的同义词|test_10|  
|创建时成功，调用时失效并重新生效的plsql（例如依赖的表被drop后又创建）|test_21|  
|
|  
|长度达到上限64*2+1|test_37|  
|包存储过程名，不带包|test_19|  
|
|  
|大小写混用|test_12|  
|内置函数名|test_24|  
|
|  
|只有声明没有body的plsql|test_17|  
|内置存储过程名（无）|（无）|  
|
|  
|  
|  
|  
|包存储过程名，错误的包|test_19|  
|
|  
|  
|  
|  
|内置包名的同义词+存储过程名同义词|test_6|  
|
|  
|  
|  
|  
|用户.存储过程名|test_38|可以jdbc运行|
|参数二三  reserved1 reserved2|null、空串|test_1|  
|不设置|test_25|  
|
|  
|1|test_26|  
|  
|  
|  
|
|其他out参数|符合预期的数据类型|test_1|  
|不符合预期的数据类型|test_41|  
|
|plsql包含的出入参类型|出参|test_27|  
|  
|  
|  
|
|  
|入参|test_27|  
|  
|  
|  
|
|  
|出入参|test_27|  
|  
|  
|  
|
|  
|自定义函数的返回类型-覆盖所有的数据类型|test_46-74|  
|  
|  
|  
|
|plsql的参数类型|普通sql类型|test_28|需要覆盖有p、s、length的类型，修改这几个参数|  
|  
|  
|
|  
|记录record|test_31|  
|  
|  
|  
|
|  
|object|test_29|  
|  
|  
|  
|
|  
|嵌套表|test_29|  
|  
|  
|  
|
|  
|boolean|test_28|  
|  
|  
|  
|
|  
|varray|test_29|  
|  
|  
|  
|
|  
|plsql表（index by）|test_30|  
|  
|  
|  
|
|  
|游标|test_32|  
|  
|  
|  
|
|  
|%  ROWTYPE|test_33|  
|  
|  
|  
|
|  
|%TYPE|test_34|  
|  
|  
|  
|
|plsql的参数个数|0|test_35|  
|  
|  
|  
|
|  
|1|test_4|  
|  
|  
|  
|
|  
|2|test_36|  
|  
|  
|  
|
|  
|4096（无上限）|test_42|  
|  
|  
|  
|
|参数是否有默认值|有|test_36|  
|  
|  
|  
|
|  
|无|test_36|  
|  
|  
|  
|
|权限|执行用户有plsql的执行权限|test_43|报错|执行用户没有plsql的执行权限|test_16|  
|
|参数是否赋值|赋值|test_2|  
|无default的参数不赋值|test_45|  
|
|  
|有default的参数不赋值|test_44|  
|  
|  
|  
|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *使用guider框架*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

