# 1. 概述

本文描述 PLSQL新增MOD取模用法 测试设计。

SR:   [YDBRD-34644 - PLSQL新增MOD取模用法](https://pingcode.yasdb.com/pjm/items/67189d54e489dd0868fd0f8b)  

# 2. 需求分析

## 2.1 功能点分析

在PLSQL中支持MOD语法，  实现的是取模操作，同操作符“%”的作用一致。

部署形式：单机、集群、分布式。

语法：变量A MOD 变量B  

## 2.2 应用场景

在PLSQL中支持MOD语法。

## 2.3 规格约束

|sql语法支持MOD用法|plsql语法支持MOD用法|plsql语法中，MOD关键字可作为变量名|
|---|---|---|
|不支持|支持|可以声明，定义；但是过程体中无法作为变量使用|


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

主要采用等价类划分、场景法组合进行设计。

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


### 3.2.1 等价类划分

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|部署形态|- 单机
- 集群
- 分布式
||||
|mod运算出现的位置|常量/变量赋值|b constant number :=a mod 0;,c1 number:=11 mod 2;,c1 :=c1 mod 2;|普通SQL/PLSQL语法中:,- select 投影列
- filter
- dml
- ddl default值
|select col1 mod col2 ...,..where col1 mod col2 =...,insert into ...values (12 mod 2)...,update ... set c1 = 12 mod 2...,insert into ... return c1 mod c2  into n1...|
||record成员赋值|TYPE name IS RECORD (first number,last number:= 11 mod 2);,a.first:=11 mod 2;|||
||集合变量赋值|,```
--数组
TYPE char_array IS ARRAY(5) OF number;
v_char char_array := char_array(12 mod 0,12 mod 0);
--嵌套表
TYPE type1 IS table OF number;
v_1 type1 := type1 (12 mod 0,12 mod 0);
--关联数组
declare
    TYPE type_001 IS TABLE OF number INDEX BY PLS_INTEGER;
    TYPE type_002 IS TABLE OF type_001 INDEX BY PLS_INTEGER;
    collect1 type_002;
begin
    collect1(1)(1) := 12 mod 7;
end;
/


```|key值是mod运算表达式||
||存储过程、UDF实参|begin,c1:=fun1(10 mod 2);,pro1(10 mod 3);,end;,/|||
||UDF返回值|return i mod 3;|||
||UDT构造方法、静态方法、成员方法|self.area_no := a mod 3;,--静态方法,STATIC FUNCTION showAreaStatic(a number) RETURN number IS  
    BEGIN
    RETURN 12 mod a;
    END;|||
||触发器new赋值|:new.c1:=:old.c2 mod :old.c1;|||
||嵌套子过程中变量赋值|DECLARE  
    VAR1 int;
    PROCEDURE YA_NT_PROC(A1 int, A2 INT) IS
    BEGIN
         VAR1 := A1 mod A2;
    END;
BEGIN
   YA_NT_PROC(300,101);
   DBMS_OUTPUT.PUT_LINE(VAR1);
END;
/|||
||动态执行绑定参数|DECLARE,a1 number:=300;  
a2 number:=99;
str1 VARCHAR(200) := 'insert into t1 values(2,:x1)';
BEGIN
EXECUTE IMMEDIATE str1 USING a1 mod a2;
end;
/|||
||动态匿名块||||
||控制语句|if a mod b= 0 then..,case  a mod b= 0 when,for i in a mod b ..100 then,forall in  then,CONTINUE loop1 WHEN i mod 3= 2;,WHILE i mod 3 <2 LOOP|||
|mod自嵌套|- 1次
- 2次
- 多次
|A mod B mod C|||
|mod和其他运算符结合使用|- 与 + -  * /  % 结合
- mod与括号结合
|重点|||
|mod关键字校验|- 名称大小写
- 创建同名对象名(udf，表名，列名等)
- mod作为变量名声明定义使用
- mod作为形参、实参名
- mod作为标签名使用
- mod作为游标变量名使用
- mod作为into变量名使用
- mod作为type名，成员名，
|可以声明，定义；但是过程体中无法作为变量使用,into变量名使用|名称拼写错误||




### 3.2.2 DFX

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
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



