Created by 李美娥, last modified on 六月 20, 2024

#    1. 概述

本文描述

  [https://pingcode.yasdb.com/pjm/items/66308cb1c36a3d30a860d4e8](https://pingcode.yasdb.com/pjm/items/66308cb1c36a3d30a860d4e8)    ?    
  #YDBRD-26807 package子过程支持递归

# 2. 需求分析

## 2.1 功能点分析

(1)package对象间的递归调度，主要是package间子过程的递归调度且子过程递归调度过程中，使用公有变量。若递归调度中，出现了死循环，报错（oracle是等待一定时间后，会杀死  中断正在执行的会话或杀死进程，报错not connected to ORACLE，yashan至少不应该死等特别长时间比如一天等，不应该core  ）

对齐扩充的场景是：(2)package私有子过程自己调自己的场景。

  点击此处展开...

drop PACKAGE my_package;    
  CREATE OR REPLACE PACKAGE my_package IS

-- 公共过程    
  PROCEDURE public_procedure;

END my_package;    
  /

CREATE OR REPLACE PACKAGE BODY my_package IS

-- 私有过程    
  PROCEDURE private_procedure(p_counter NUMBER) IS    
  BEGIN    
  IF p_counter > 0 THEN    
  DBMS_OUTPUT.put_line('Counter: ' || p_counter);    
  private_procedure(p_counter - 1); -- 在私有过程中调用自己    
  END IF;    
  END private_procedure;

-- 公共过程的实现    
  PROCEDURE public_procedure IS    
  BEGIN    
  private_procedure(5); -- 调用私有过程    
  END public_procedure;

END my_package;    
  /

exec my_package.public_procedure;

## 2.2 应用场景

主要场景：

(1)  package A有方法al()调用package B的方法b1()，  并且有package B的方法b2() 调用package A的方法a2()

(2)package A有方法a3()调用package B的属性b3，  并且有packageB的方法b3()调用package A的属性a3

## 2.3 规格约束

1  、数据库形态：单机，集群

2、package A中，可以允许package B调度的对象

     (1)子过程体：自定义函数、存储过程

     (2)全局变量：  全部标量类型定义的变量; 全局UDT;、当前package已经定义的record，udt等类型定义的变量、异常变量

     (3)全局类型：类型  record、local UDT（varray,nested table。支持类型的嵌套）、 游标类型；(如package B使用package A里面的类型定义变量）

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用等价类、错误推测法进行测试

## 3.2 详细测试设计

### 3.2.1

（1）head间的递归不支持，但是head可以使用其他pkg，然后跟body里面递归结合：

（2）body间的递归：

|一级分类|二级分类|三级分类|测试点|
|:---|:---|---|:---|
|相同模式下的递归调度    
    
    
    
    
    
|子过程体（公有调度公有）,  
,  
|直接递归调度,packageA      packageB    
  a1();       ->     b1();    
  a2();      <-     b2();|1、自定义函数的递归调度,2、存储过程的递归调度,3、自定义函数和存储过程的混合递归调度,  
|
|||被  调度的函数出现在调度函数的位置|b1是a1的入参默认值、b1是a1定义某个变量的值、b1在a1的块中使用、b1作为a1的返回值|
||  
|间接递归调度a1(a1作为a2的default值或者a2内部直接调度或者a2的返回值）,  
|(1)支持,packageA                packageB    
  a1();                  ->   b1();    
  a2( default a1); <-   b2();,(2)支持,packageA                packageB    
  a1();                 <-    b1();    
  a2( default a1); ->   b2();                             ,(3)支持,packageA                packageB    
  a1();                 ->    b1();    
  a2( default a1); <-   b1();    
                                  b2();,(4)  c1 c2是单独的函数或者procedure,里面分别调度了b1,a2,packageA                packageB    
  a1();  ->                c1->   b1();    
  a2( );             <-   C2<-    b2();|
||子过程体：私有->公有）|直接递归调度|（1）package均可创建成功，但无触发递归的调度入口  --可通过函数返回复制给全局变量，后面匿名块访问全局变量触发调度,packageA            packageB    
  a1()私有;     ->     b1();    
  a2();            <-     b2()私有;,（2）报错，死循环,packageA            packageB    
  a1()私有;     ->     b1(b2);    
  a2(a1);            <-     b2()私有;,调度b1 ，a2。,  
|
||  
|间接调度|(1)支持,packageA           packageB    
  a1()私有;   ->      b1();    
  a2(a1);      <-       b2();,调度a2，b2。,(2)报错,packageA           packageB    
  a1()私有;   ->      b1(b2);    
  a2(a1);      <-       b2();,(3)支持,packageA           packageB    
  a1()私有;   ->      b1();    
  a2(a1);      <-       b2(b1);|
||子过程体（公私有混合）|直接调度|(1)支持，只是b2对外无法使用，其递归调度的方法，无法触发到  --更改，可以有办法触发,packageA      packageB    
  a1();       ->     b1();    
  a2();      <-     b2()私有;|
||全局变量|(1)标量类型定义的变量,（数值、字符、布尔、时间、BLOB、CLOB、JSON、ROWID）,(2)全局UDT;,BOX2D、  ST_GEOMETRY、定义的UDT（区分嵌套和不嵌套）,(3)异常变量|全局变量的三个点，需要结合测，同时也可以跟pkg个数交互。,pkg内的子过程未使用：,(1)支持,packageA          packageB    
  属性a1;              属性b1;    
  a1();             ->   b1(属性a1);    
  a2(属性b1); <-    b2();,pkg内的子过程使用：,(1)支持,packageA            packageB    
  属性a1;               属性b1;    
  a1(属性a1);  ->    b1(属性b1+属性a1);    
  a2(属性a1+属性b1);  <-   b2(属性b1);,(2)支持,packageA           packageB    
  属性a1;               属性b1;    
  属性a2;               属性b2;     
  a1(属性a1);  ->   b1(属性b1);    
  a2(属性a2);  <-    b 2(属性b2);,  
|
||  
|全局变量，pkg内的子过程使用或未使用||
||  
|全局变量使用的位置：出入参、子过程体声明处作为变量类型使用、子过程体的内部使用（常规使用、值被其他函数的返回值修改）、子过程体的返回值||
||  
|游标变量||
||全局类型|类型  record、local UDT、游标类型（udt类型完全是pkg内定义，一部分的定义在pkg，一部分在pkg外）|packageA里面的这些类型，被packageB里面的子过程体作为类型定义变量使用。|
||子过程体个数|3个子过程体间的递归调度（上面的点，穿插在这里面测试）,超过3个覆盖（1）（2）：pkg1的f1->pkg2的f1->pkg3的f1...→pkg20的f1,f2调度->pkg1的f2|(1)支持,packageA               packageB          packageC     
  a1();           ->          b1();           ->   c1();    
  a2();          <-           b2();           <-   C2();,(2)支持,packageA               packageB          packageC     
  a1();           ->          b1();           ->   c1();    
  a2();                         <-                     C2();,packageA               packageB          packageC    
  a1();           ->          b1();           ->   c1();               →packageA的a2     ,(3)不支持,packageA               packageB          packageC     
  a1();           ->          b1();           ->   c1();               →packageA的a1    ,(4)支持，packageA的同一子过程与多个其他package支持递归调度,packageA      packageB    
  a1();       →     b1();    
  a2();      <-     b2();,packageA      packageC    
  a1();       →     c1();    
  a2();      <-     c2();,(5)支持，packageA的不同子过程与多个其他package支持递归调度,packageA      packageB,a1();       →     b1();    
  a2();      <-     b2();,packageA      packageC    
  a3();       →     c1();    
  a4();      <-     c2();,(6)含私有的plsql,packageA               packageB          packageC    
  a1(私有);           ->          b1();           ->   c1();    
  a2(a1);          <-           b2();           <-   C2();|
|不同模式下的递归调度|pkg间在不同模式下|  
|  
|
|  
    
  与历史特性结合,  
|执行顺序|  
|head先执行，body再执行,pkgA的head，body执行（有报错），pkgB的head，body执行（均成功）,body先执行，再执行head|
||修改重建,create or replace,  
|  
|（1）body变更：,packageB.b1函数实现功能body变更，调度packageA.a1，是最新的b1实现的功能;(  packageA      packageB    
  a1();       ->     b1();    
  a2();      <-     b2();,),packageN的n1函数实现功能body变更，调度packageA.a1;（a1->b1->c1->d1->...->n1,n2→a2),（2）  head+body都变更,head变更后，调度报错，body变更跟head一致，再次调度成功,（3）  head变更（如给里面添加定义一个全局变量的类型，head的变更不影响body）|
||重编译,alter|  
|（1）对body进行重编译,packageB失效，  调度packageA.a1报错，  对packageB进行alter   package   操作，调度packageA.a1成功;,packageN失效，调度packageA.a1报错，对packageN进行alter package 操作，调度packageA.a1成功；,（package失效的方式，重新定义package body依赖的对象）,（2）  对head进行重编译（区分A的head失效，依赖它的都会失效，A的head失效，不影响它依赖的对象）|
||与嵌套子过程|  
|  
|
||可串行化|  
|递归调度且其中一个package含串行化，调度报错（目前是保持差异）|
||自治事务|  
|递归调度的一个package里面的plsql对象使用了自治事务|
||触发器|packageA      packageB    
  a1();       →     b1();    
  a2();      <-     b2();|b2不是直接调度a2,b调度的是dml语句，但是dml语句会触发触发器，触发器里面调度了packageA.a2|
|pa  ckage私有plsql的递归调度|  
|plsql1是公有，plsql2是私有|1、plsql1和plsql2在pkg外均无定义，plsql2是递归调度自己，plsql1调度plsql2,2、plsql2在pkg外有定义，plsql2是递归调度自己，plsql1调度plsql2（优先级，是优先调度的pkg内的还是pkg外的）,3、plsql2死循环|
|  
||plsql1 plsql2都是私有,(YDBRD-28376扩充支持的场景，,对应用例编号45 、46）|body的主体里面调用私有函数赋值给全局变量，后续匿名块访问全局变量|
|  
|||packageA                                       package B,var_1,var_2,var_3,body里面：        ,var_2 :=plsq2 私有-》B的plsql2      ,var_3 :=plsql3 私有                   B里面的plsql3访问方式A的全局变量var_3（会调度A的plsq3）,匿名块访问var_2，调度B的plsq2。|
|  
|跟其他特性的结合|跟pkg间递归结合|packageA                         packageB    
  a1();递归，私有           b1();递归，私有    
  a2(a1);      <-     b2();,a3            →       b3（b1)|


（3）集群：不单独再设计测试点，上面的用例，挑选用例，同一用例，不同步骤，放置在不同的实例下执行

（4）并发+testkill设计

|  
|测试点|  
|
|---|:---|---|
|2个pkg间的调度|packageA      packageB    
  a1();       ->     b1();    
  a2();      <-     b2();,  
|packageA .a1与packageB .b2 + packageA.a2 + packageB.b1 并发|
|||packageA .a1与packageB .b2并发 + 修改重建packageB.b1 + 修改重建packageA.  a  2+重编译|
|||packageA .a1与packageB .b2并发 + 修改重建packageB.b1 + 修改重建packageA.a2 +   d  rop+重编译|
|3个pkg间的调度|packageA      packageB   packageC      
  a1();       ->     b1();   -> c1();    
  a2();      <-     b2();   <- c2();|packageA .a1与packageC .c2并发,packageA .a1与packageC .c2并发+修改重建 packageC.c1 + 修改重建 packageA.a2|


### 3.2.2 涉及的测试DFX

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是|
|DFR|/|
|HA|/|
|KT kill测试|是|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|/|
|长稳|/|


# 4.   **测试用例**   

# 电子表格

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

工作量：X  *人天*

计划测试完成时间：

## Attachments:

[image2024-4-23_11-38-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOWE4OTcwYzJhZjRmNTIxNDE1IiwicmVmX2lkIjoiNjczOTZkOWE1OTNmOTljOWZmMjM3ZDViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMTI0LCJleHAiOjE3ODIzOTY1MjR9.3HVGFXyX1uNKti0n2Cx_60xUeBp65KEdNiy18KnC1rQ)

 (image/png)    


## Comments:

|  [](null)  ,检视意见：,1、并发添加上重编译,2、变量加上游标变量,Posted by limeie at 五月 29, 2024 10:51|
|---|
