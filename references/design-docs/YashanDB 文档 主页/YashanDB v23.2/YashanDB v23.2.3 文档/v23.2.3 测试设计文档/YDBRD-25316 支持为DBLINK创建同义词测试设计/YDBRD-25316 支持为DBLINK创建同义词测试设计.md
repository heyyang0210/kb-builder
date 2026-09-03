Created by 韩晓盼 on 四月 26, 2024

IR：    [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf11](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf11)    ?    
  #YASHAN-1029 崖山DBLINK连接ORACLE支持创建为dblink同义词

SR：    [https://pingcode.yasdb.com/pjm/items/6611a1ae579a3edb84d83819](https://pingcode.yasdb.com/pjm/items/6611a1ae579a3edb84d83819)    ?    
  #YDBRD-25316 支持为DBLINK创建同义词

# 1.   **概述**

本需求设计范围是支持为DBLINK创建同义词  。

# 2.   **需求分析**

**1、dblink介绍**

- **定义**


用于YashanDB对远端数据库的表操作，远端数据库包含同构数据库和异构数据库。

- **语法**


  `syntax::= "@" dblink_namedblink_name：指在CREATE DATABASE LINK时所创建的远端数据库名称。`  

  


- **规格与约束**


      1、  **对象表字段数据类型限制**  ：

```
1、通过dblink操作Oracle的表
#远端表字段的数据类型需在下表所列范围内
smallint
int/integer
float
binary_float
binary_double
number/decimal
date
timestamp
timestamp with time zone
timestamp with local time zone
interval year to month
interval day to second
char
varchar
nchar
nvarchar
raw
varchar2
nvarchar2


2、通过dblink操作YashanDB的表
#远端表字段的数据类型需在下表所列范围内
bool
tinyint
smallint
integer
bigint
float/binary_float
double/binary_double
number
date
time
timestamp
interval year to month
interval day to second
char
varchar
raw
bit
rowid
```

      2、  **dblink执行多表连接时，对象表限制**  ：

```
1、本地表和远端表连接

本地表 || 远端表 || 支持情况
行存      行存      支持
行存      列存      支持
列存      行存      不支持
列存      列存      不支持

2、远端表和远端表连接

本地表 || 远端表 || 支持情况
行存      行存      支持
行存      列存      支持
列存      列存      支持
```

      3、  **select远端表限制**  ：

- 单次查询支持的远端表数量最大是32个。


       4、  **insert远端表限制**  ：

```
1、不允许多表insert。
2、不允许指定分区insert。
3、不允许执行insert duplicate update语句。
4、不允许执行insert return语句。
```

       5、  **update远端表限制**

```
1、filter与更新本地数据库的对象的filter相比：
  不能使用聚集函数。
  不能使用窗口函数。
  不能使用子查询。
  不能使用序列。
  不能使用自定义函数（包括UPDATE SET语句）。
2、不允许多表update。
3、不允许指定分区update。
```

          6、  **delete远端表限制**

```
1、filter与删除本地数据库的对象的filter相比：
  不能使用聚集函数。
  不能使用窗口函数。
  不能使用子查询。
  不能使用序列。
  不能使用自定义函数。
2、不允许多表delete。
3、不允许指定分区delete。
```

不支持分布式，  **只支持单机，集群**  。

  


**2、同义词介绍**

- **定义**


同义词(Synonym) 是数据库对象的一个别名，Oracle 可以为  **表、视图、序列、过程、函数、程序包等**  指定一个别名。

- **语法**


```
--创建本用户对象的公共同义词
CREATE OR REPLACE PUBLIC SYNONYM sy_area1 FOR area;
 
--创建其他用户对象的私有同义词，即使area表不存在，也可以创建成功
CREATE OR REPLACE SYNONYM sy_area2 FOR sales.area;

--删除公共同义词
DROP PUBLIC SYNONYM sy_area1;
 
--删除本用户下的私有同义词
DROP SYNONYM sy_area2;
```

- **特性/限制**


      1  、支持为  **表**  、  **视图**  、  **sequence**  、以及  **其他同义词**  等对象创建同义词，（暂不支持物化视图）  **存储过程**  ，  **自定义函数**  已支持

      2、支持指定同义词所有者为public用户

      3、  创建同义词后可在如下系统表和视图中查到对应记录

           系统表：  **sys.syn$**

           系统视图：  **DBA_OBJECTS、DBA_SYNONYMS**

     4、  **创建同义词时不会检查对象的合法性，使用时才会检验对象的合法性**

     5、同义词之间可形成  **依赖链**  ，同义词的最终对象会根据同义词链指向得出，如果没有找到最终对象会报错

     6、系统会检验同义词  **依赖闭环**

     7、同义词支持  **最终对象的缓存**  ，并会在同义词依赖发生变更后做出对应更改，以加快寻路效率

具体查看：    [*synonym测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76929665)  

      

**3、***为dblink创建同义词介绍*****

- **功能**


      可以在YashanDB创建一个同义词，关联的对象为通过dblink连接的远端对象，远端对象所在的数据库可以是YashanDB，或Oracle数据库。对远端对象创建同义词后，可以通过同义词做一些YashanDB和dblink已支持的基础操作（部分内容受限，在规格约束中说明） 其执行效果与直接执行 【远端表@link名】相关sql语句效果相同。

- **规格、约束**


1. 本次需求仅支持  **表**  和  **视图**  两类远端对象
1. 创建好的同义词的  **DML能力**  取决于  **dblink功能本身和YashanDB本身支持的交集**  ，范围受限
1. **SYN$**  系统表内，  **新启用字段node**  ，代表dblink的名字。在创建同义词时写入此字段。


参考：    [YDBRD-25316 支持为DBLINK创建同义词设计 - 苏凡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150607733)  

  


**4、需求来源**

需求来源：    
  深燃二期    
    
  场 景：    
   1.工程移动系统与ERP强关联，大量dblink用法与Oracle进行交互    
    
  需求描述：    
  崖山DBLINK连接ORACLE支持创建为dblink同义词    
    
  需求范围：    
  1、单机    
  2、行表、列表

  
  需求规格： 

create [OR REPLACE] [public] synonym schema.synonym for schema.object@link_name;

 object包含表、视图、  [PKG.]存储过程/[PKG.]函数、包、SEQUENCE（暂不支持）

  


**3、功能分析**

崖山DBLINK连接ORACLE支持创建为dblink同义词  ；

1. 本次需求仅支持  **表**  和  **视图**  两类远端对象
1. 创建好的同义词的  **DML能力**  取决于  **dblink功能本身和YashanDB本身支持的交集**  ，范围受限
1. **SYN$**  系统表内，  **新启用字段node**  ，代表dblink的名字。在创建同义词时写入此字段。


与Oracle差异：见第二章dblink介绍中规格与约束    
    


参考：    [崖山DBLINK连接ORACLE支持SEQUENCE，同义词，查看LOB，procedure-测试概要设计 - 胡晓畔 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150619263)  

  [崖山DBLINK连接ORACLE支持SEQUENCE，同义词，查看LOB，procedure-测试调研 - 胡晓畔 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150605255)  

# 3.   **测试设计方法**

使用边界值，等价类，场景分析等测试方法。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点

参考YashanDB本身对   synonym 的支持范围（  **表**  、  **视图**  、  **sequence**  、  **存储过程**  ，  **自定义函数**  以及  **其他同义词**  ，暂不支持物化视图  ），通过DBLINK的场景也需支持（当前限制为  **表**  和  **视图**  ）；

着重关注 synonym 的功能，出现的位置，dml  ， ddl等

|  
|测试场景|测试点|预期|备注|
|---|---|---|---|---|
|synonym|synonym创建|远端表和远端视图,--yashan→oracle/yashan  为表和视图创建同义词,- LINK1的视图来自  **LINK1 的表**  ，为LINK1的视图创建同义词
- LINK1的视图来自  **LINK2 的表**  ，为LINK1的视图创建同义词
,  
|预期支持|  
|
|  
|同义词  创建  嵌套|给远端table/view 创建SYNONYM_01 ，再给SYNONYM_01 创建 SYNONYM_01_01 ..,  
|预期支持，但是否有最大层数限制？|  
|
|  
|  
|嵌套同义词的 应用,  
|预期使用正常|  
|
|  
|同义词合法性|远端表和远端视图不存在，创建   synonym_01,dml中使用上述创建的synonym_01,  
|预期创建成功,预期报错|  
|
|  
|同义词依赖性|给SYNONYM_01 创建 ，再给SYNONYM_01 创建 SYNONYM_01_01,删除上述创建任意一层的同义词,- 给同义词syn1创建同义词syn2，给sys2创建同义词syn3，给syn3创建同义词syn4，删除syn1，再给syn4创建同义词syn1
,  
|预期报错，同义词无效|  
|
|  
|synonym应用|select查询,子查询嵌套 查询|预期支持|  
|
|  
|  
|通过同义词对远端表insert ,考虑带子查询|预期支持|  
|
|  
|  
|update set ,where后使用,受限于崖山DB DBLINK能力，需要验证带子查询拦截|拦截信息内部是否应当一致或易懂|  
|
|  
|  
|delete,受限于崖山DB DBLINK能力，需要验证带子查询拦截|拦截信息内部是否应当一致或易懂|  
|
|  
|  
|跨LINK 应当支持|  
|  
|
|  
|  
|**远端表覆盖分区表**,**update，delete 指定分区表的DBLINK支持受限，确认同义词场景表现**|  
|  
|
|  
|  
|**远端视图考虑物化视图，force视图**|  
|  
|
|  
|同义词视图  syn$|视图功能正确性（校验  **新启用字段node**  ）,标记同义词对象是否是远端对象|  
|  
|
|  
|同义词系统表  DBA_OBJECTS、DBA_SYNONYMS|查看表内容是否正确|  
|  
|
|  
|特性交互|为远端sequence创建同义词,通过同义词操作远端sequence|依赖sequence实现|  
|
|  
|  
|通过同义词操作远端procedure ，udf，udp|依赖存储过程实现|  
|


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[image2024-4-16_17-37-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjVhMWFkOWEzMzExZGM4ZGUwIiwicmVmX2lkIjoiNjczOTZjZjU1OTNmOTljOWZmMjM3NWI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTQ3LCJleHAiOjE3ODIzOTEzNDd9.IRrhhUXjbPoHymnD3ERgFVHVxuidpDHwNJqptunu_Uk)

 (image/png)    


[image2024-4-16_17-43-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjU4OTcwYzJhZjRmNTIwZjcwIiwicmVmX2lkIjoiNjczOTZjZjU1OTNmOTljOWZmMjM3NWI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTQ3LCJleHAiOjE3ODIzOTEzNDd9.NSE9dEQ-51GNHEYmnZpOcg5-Ss5kesTvNYiLR9ryJkQ)

 (image/png)    


[image2024-4-16_17-44-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjVhMWFkOWEzMzExZGM4ZGUyIiwicmVmX2lkIjoiNjczOTZjZjU1OTNmOTljOWZmMjM3NWI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTQ3LCJleHAiOjE3ODIzOTEzNDd9.vUQscU0-w-PSFnUrXwVEU3Pfx8N69YS85J-5ktdWTbw)

 (image/png)    


[image2024-4-16_17-52-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjU4OTcwYzJhZjRmNTIwZjczIiwicmVmX2lkIjoiNjczOTZjZjU1OTNmOTljOWZmMjM3NWI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTQ3LCJleHAiOjE3ODIzOTEzNDd9.H1e-Nf_g4lDcUiV_LeNpW-A7rr4lztbPf_5p65fMD68)

 (image/png)    


[image2024-4-17_18-7-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjU4OTcwYzJhZjRmNTIwZjc0IiwicmVmX2lkIjoiNjczOTZjZjU1OTNmOTljOWZmMjM3NWI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTQ3LCJleHAiOjE3ODIzOTEzNDd9.D5-ktpitGSWO-GUp6os4lnS9Gd22KDD0YzKNb6Z8iz4)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要,参与人：胡晓畔、刘晓旋、苏凡、牛亚娜、韩晓盼,评审时间：2024年4月26日,评审地点：线上会议,评审内容：,建议补充测试点    
  1、给远端表创建，后删掉/修改，查看是否生效    
  2、给表创建同义词，基于表创建视图，在给视图创建同名同义词（create or replace），查询表/视图    
  3、创建同义词闭环（同义词依赖性）    
  4、CT/KT（并发+故障场景）,遗留问题：,无,评审结论：通过,Posted by hanxiaopan at 四月 26, 2024 10:47|
|---|
