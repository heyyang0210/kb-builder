Created by 范瑜, last modified on 十月 15, 2024

# **1. 概述**

本文为udt元数据导入导出测试设计

# **2. 需求分析**

## 2.1需求

SR:         [YDBRD-13261](https://jira.yasdb.com/browse/YDBRD-13261?src=confmacro)    -  【imp/exp】支持TYPE/TYPE BODY导入导出  完成

开发设计：    [type - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~shixin/type)  

## 2.2 功能描述

（1） 该需求支持创建的TYPE的元数据导入导出功能EXP/IMP。不包含–CSV模式。

 本次支持TYPE类型FULL模式、用户模式、表模式的导入导出。

支持使用UDT类型的表导入导出。

支持嵌套表的导入导出。

（2） CREATE (OR REPLACE) PROCEDURE/FUNCTION 时，当参数中有错误时也会创建对象（也会replace已存在的对象）。

（3）增加INT$DBA_SOURCE视图，用于内容对齐ORACLE的DBA_SOURCE视图，text字段没有CRAETE OR REPLACE。

    对于过程体（PROCEDURE、FUNCTION、PACKAGE、PACKAGE BODY、LIBRARY、TYPE 、TYPE BODY）的导出会导出为CREATE语句，所以对象已存在时会报错。

## 2.3 功能限制

1. **表使用TYPE的同义词做列时，会导出为具体类型**  ，没有还原为同义词。(ORACLE的DATA_TYPE记录的就是同义词，服务端改好了，EXP表定义会自动支持)。
1. 由于目前不支持select查询UDT列，所以使用UDT的表在导出时会有  **警告且不会导出数据**  。
1. 由于绑定参数支持UDT类型，所以  **在导入含有UDT列的表时会有一个警告**  。
1. 行对象表不导出，无警告（对外没有承诺行对象表功能）。


## 2.4 规格说明

TYPE导入导出在全量模式、用户模式、表模式下都有感知。

（1）如果TYPE中使用了公共同义词，在用户模式导入时也会导入相关公共同义词。

（2）表模式导出任意模式导入或全量、用户模式导出且非表模式导入时，会同时导入表  **直接使用**  的同用户的TYPE。（不会导出不同user的。只会导出直接使用的(表依赖的TYPE所依赖的TYPE不会导出)）

（3）导入时，TYPE已存在会报错。

（4）用户模式或表模式导入时，表使用的不同用户的类型不存在时报错。

（5）ALTER TYPE目前只支持EDITIONABLE，无实际功能，不导出。

  


ORACLE对表依赖对象的导出调研：

TABLE->TYPE->TYPE：导出TYPE、TYPE （表会直接依赖第二层的TYPE。yasdb只依赖第一层）

TABLE->TYPE->SYNONYM：导出TYPE

TABLE->SYNONYM->TYPE：导出SYNONYM和TYPE 

TABLE->SYNONYM->SYNONYM->TYPE： 导出TYPE（表对3个对象都有依赖，但是只导出了TYPE）

#   
  **3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

主要使用场景：

|UDT使用场景|导入导出策略|
|---|---|
|过程体（包）|全量模式、用户模式下先导出全部的TYPE。|
|表|全量模式、用户模式下先导出全部的TYPE。,表模式下，同时导出表依赖的同用户下的TYPE。|
|同义词|同义词的顺序在TYPE前。|


**eg，表模式下的导出顺序**

表空间->序列->同义词->  **类型**  ->表->索引->约束->主键→外键→其它对象（视图、触发器、包、函数、JOB、LIBRARY）

基本功能测试：

|测试项|测试子项|备注|
|---|---|---|
|udt功能语法覆盖|1.创建方式：create 或者replace,2.形式:, （1）只有type, 没有body, （2）只有body，没有type,  （3）type和body都有,3.成员变量:,  （1）类型：标量类型、object、varray、nested table,  （2）个数：最多1024,4. 构造方法：默认、自定义构造方法,5.成员方法：存储过程、自定义函数、map函数、order函数、无,6.静态方法,7.EDITIONABLE | NONEDITIONABLE（不导出）,8.schema/type_name/成员方法/成员变量名称：,（1）用户类型：当前用户/非当前用户,（2）内容：英文大小写、中文、特殊字符等,（3）长度：小于等于64,9.force:,（1）有被表/继承依赖,（2）被其它对象依赖,（3）无依赖,10.[not] final,11.继承类型：标量类型、object、varray、nested table、同义词|覆盖基本语法，主要基于用户使用场景考虑， udt的语法对于导入导出只是相当一个字段内容,观察手段：    
  （1）观察视图：*_OBJECTS、*_TYPES、*_SOURCE、*_TABLES,（2）导入后使用udt或者依赖udt的对象，验证导入对象是否可用|
|对象|udt、表、同义词、过程体、自定义函数、包、用户视图、触发器、审计策略|  
|
|对象依赖关系验证|1.udt自身依赖：,（1）继承性依赖：标量类型、object、varray、nested table、（公有/私有）同义词,（2）依赖层次：1、3、多层,2.udt与其它对象相互依赖：,（1）表：表列类型、表列值、展开列数、覆盖嵌套表语法,（2）同义词：公有、私有,（3）过程体,（4）自定义函数,（5）包,（6）用户视图,（7）触发器,（8）审计策略,3.依赖层次,（1）1,（2）3,（3）多层,4.对象是否存在：,（1）导入对象是否存在,（2）导入前被依赖对象是否存在,（3）导出前对对象进行ddl操作,  
|  
|
|结合导入导出语法验证|1.导入导出方式组合：    
  （1）full模式导出，full/user/table模式导入,（2）user模式导出，full/user/table模式导入,（3）table模式导出，full/user/table模式导入,2.ignore=y/n, 需结合依赖对象是否存在进行测试,3.导入是否存在：,（1）用户：存在（单个、多个、规格）、不存在,（2）表：存在（单个、多个、规格）、不存在|  
|
|导入用户权限验证|1.有dba权限,2.用户模式下多用户导出导入|  
|


  


并发测试：

基于用户场景考虑， 主要有以下验证场景：

（1）用户模式下多用户导出导入

（2）表模式下多表导出导入

  


性能测试：

（1）创建3万多UDT，与oracle进行对比

  


# **4. 详细设计**

[UDT导入导出测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ODhhMWFkOWEzMzExZGM3NzY0IiwicmVmX2lkIjoiNjczOTY5ODg3MjgyMDZlZmI5MmVmNDIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2OTYwLCJleHAiOjE3ODIyOTMzNjB9.6TiH681bHYn7CXVEYZjkbhz4mlC8smZp43WefydT8bo)

# 5.   **测试用例**

#   
  6.   **测试框架设计**

本次测试采用导入导出测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[UDT导入导出测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ODhhMWFkOWEzMzExZGM3NzY0IiwicmVmX2lkIjoiNjczOTY5ODg3MjgyMDZlZmI5MmVmNDIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2OTYwLCJleHAiOjE3ODIyOTMzNjB9.6TiH681bHYn7CXVEYZjkbhz4mlC8smZp43WefydT8bo)

 (application/x-xmind)    
