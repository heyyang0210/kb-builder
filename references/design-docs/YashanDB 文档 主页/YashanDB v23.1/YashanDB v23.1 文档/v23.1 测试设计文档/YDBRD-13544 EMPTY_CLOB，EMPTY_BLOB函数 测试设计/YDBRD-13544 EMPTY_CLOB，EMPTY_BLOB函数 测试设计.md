Created by 钟溱, last modified on 十月 17, 2024

# **1. 概述**

本文描述EMPTY_CLOB，EMPTY_BLOB函数的测试设计 

# **2. 需求分析**

**SR:**    [YDBRD-13544](https://jira.yasdb.com/browse/YDBRD-13544?src=confmacro)    **-**  **实现EMPTY_CLOB，EMPTY_BLOB函数**  **完成**

## 2.1语法

定义：

EMPTY_CLOB（）

EMPTY_BLOB（）

## 2.2 功能描述

- 可用于在INSERT 语句或UPDATE 语句中将 LOB 列初始化为 EMPTY ，或者它可用于初始化 LOB 变量；
- 没有参数或自变量；
- 返回一个空lob


# **3. 测试设计方法**

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

  


**3.1、基本功能**

|输入条件1|输入条件3|有效等价类|备注1|无效等价类|备注2|
|:---|---|:---|:---|:---|:---|
|函数关键字|  
|大小写,不带括号|  
|  
,括号内入参|  
|
|create|  
|- 建表时作为lob列默认值
- alter lob列，将EMPTY_LOB为默认值
|  
|  
|  
|
|insert场景    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
,  
,  
,  
,  
|空表|- 单列lob
- 多列lob
- 与其他数据类型混合列
- 反复多次往单列/多列插入EMPTY_LOB
|  
|/|/|
||带数据表|- 单列lob
- 多列lob
- 与其他数据类型混合列
- 部分lob列插入EMPTY_LOB
- 全部lob列插入EMPTY_LOB
- 反复插入
|  
|其他数据类型列insert EMPTY_LOB函数,（字符型、日期型、数值型、json、bit、raw各自挑1个）|报错|
||查询|- 在查询中使用空的 CLOB 值
|SELECT * FROM your_table WHERE clob_column = EMPTY_CLOB();|  
|  
|
|update场景|空表|- 单列lob为null、为非null
- 多列lob部分为null、部分为非null
- 与其他数据类型混合列
- 反复多次往单列/多列更新EMPTY_LOB
|  
|其他数据类型，update set empty_lob函数|  
|
|  
|带数据表|- 单列lob为null、为非null，update lob列
- 多列lob部分为null、部分为非null，update lob列
- 其他数据类型列update为EMPTY_LOB函数
- 部分lob列更新为EMPTY_LOB
- 全部lob列更新为EMPTY_LOB
- 反复更新
- 插入32k字符串，并更新为EMPTY_LOB
|  
|  
|  
|
|plsql|  
|创建一个 LOB 变量并将其初始化为空|DECLARE    
  l_clob CLOB;    
  BEGIN    
  l_clob := EMPTY_CLOB();    
  DBMS_OUTPUT.PUT_LINE('CLOB is empty.');    
  END;|/|/|
|  
|  
|将空的 LOB 值赋给其他 LOB 变量|DECLARE    
  l_clob1 CLOB;    
  l_clob2 CLOB;    
  BEGIN    
  l_clob1 := EMPTY_CLOB();    
  l_clob2 := l_clob1;    
  DBMS_OUTPUT.PUT_LINE('l_clob2 contains an empty CLOB value.');    
  END;|/|/|
|  
|  
|自定义函数，return数据类型为clob/blob；在代码块返回empty_lob函数|  
|  
|  
|
|函数|lob_empty函数与支持lob数据的函数嵌套|CLOB： length/lengthb、CAST、CONCAT、COALESCE、GROUP_CONCAT、STRING_AGG、DBMS_LOB_COMPARE、GET_LENGTH、SUB_STR、SUBSTRING、IFNULL、WM_CONCAT、SUBSTR,BLOB： length/lengthb、DBMS_LOB、IFNULL、CAST|  
|/|/|


  


**3.2、场景测试**

|输入条件|等价类|  
|
|:---|:---|:---|
|DDL,  
|create时作为列的默认值|  
|
||alter时作为列的default默认值|  
|
|DML,  
|update|set值|
||delete|  
|
||insert|作为insert的值|
|DQL|作为select投影列返回|Json_serialize()配合|
||作为where条件|1. where func(col1) = xx
1. where col1 = func(xx)
|
||结合join|1. 作为join投影列
1. 作为join条件（on,where）
|
||结合in/not in/exists/not exist/between and/like/not like/,any/all/some/is null/is not null等子查询|  
|
||结合group by分组(聚合函数和窗口函数)|  
|
||结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|
||结合distinct|  
|
||参与运算|+ - * /  > < >= <=  and or|
||connect by|  
|
||plsql|自定义函数、匿名块、type、package中调用|


  


# **4. 详细设计**

使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

#   
  5.   **测试用例**

  


#   
  6.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|
