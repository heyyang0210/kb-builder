Created by 郑荃, last modified by  刘大境 on 五月 23, 2024

# **1. 概述**

本文描述  DBMS_METADATA.GET_DDL(index)  的测试设计 

SR:    [https://pingcode.yasdb.com/ship/ideas/660b7484009f91eb87f2c13d](https://pingcode.yasdb.com/ship/ideas/660b7484009f91eb87f2c13d)    ?    
  #YASHAN-1585 支持DBMS_METADATA.GET_DDL获取索引

开发文档：

# **2. 需求分析**

## 2.1语法

oracle语法：

  `DBMS_METADATA.GET_DDL (`      
    `object_type     IN VARCHAR2,`      
    `name            IN VARCHAR2,`      
    `schema          IN VARCHAR2 DEFAULT NULL,`      
    `version         IN VARCHAR2 DEFAULT `      `'COMPATIBLE'`      `,`      
    `model           IN VARCHAR2 DEFAULT `      `'ORACLE'`      `,`      
    `transform       IN VARCHAR2 DEFAULT `      `'DDL'`      `)`      
    `RETURN CLOB;`  

yashan语法：

```
DBMS_METADATA<span class="token punctuation" style="color: rgb(204,204,204);">.</span>GET_DDL <span class="token punctuation" style="color: rgb(204,204,204);">(</span>
object_type     <span class="token keyword" style="color: rgb(204,153,205);">IN</span> VARCHAR<span class="token punctuation" style="color: rgb(204,204,204);">,</span>
<span class="token keyword" style="color: rgb(204,153,205);">name</span>            <span class="token keyword" style="color: rgb(204,153,205);">IN</span> VARCHAR<span class="token punctuation" style="color: rgb(204,204,204);">,</span>
schema          <span class="token keyword" style="color: rgb(204,153,205);">IN</span> VARCHAR <span class="token keyword" style="color: rgb(204,153,205);">DEFAULT</span> <span class="token keyword" style="color: rgb(204,153,205);">NULL</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
version         <span class="token keyword" style="color: rgb(204,153,205);">IN</span> VARCHAR<span class="token punctuation" style="color: rgb(204,204,204);">,</span>
model           <span class="token keyword" style="color: rgb(204,153,205);">IN</span> VARCHAR<span class="token punctuation" style="color: rgb(204,204,204);">,</span>
transform       <span class="token keyword" style="color: rgb(204,153,205);">IN</span> VARCHAR<span class="token punctuation" style="color: rgb(204,204,204);">)</span>
<span class="token keyword" style="color: rgb(204,153,205);">RETURN</span> CLOB<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```

## 2.2 功能描述

本次SR只实现了    `object_type为index的创建ddl语句，只有前三个参数有效，后三个参数无效；`  

  `有效参数：`  

-   `object_type：VARCHAR2类型，不能为空；指定对象的类型，本次SR只涉及index；`  
-   `name：对象的名称；VARCHAR2类型，不能为空；`  
-   `schema：对象所在的schema；可以不指定，默认为空：表示当前用户所在的schema；`  


无效参数：

-   `version、model 、transform `  
-   `覆盖上述三个参数有效值，无效值，不会产生系统异常和功能异常；`  
-   `不能为null`  


## 2.3 功能限制

- 当前未做权限校验，Oracle针对Metadata包有专门的权限 select_catalog_role


# **3. **  详细测试设计

## 3.1 测试设计方法

对于入参的测试主要采用的等价类划分，边界值，

对于索引的功能覆盖场景法组合及错误推测法进行设计

对于get_ddl，需要覆盖所有的语法路径，采用路径覆盖的方式

测试覆盖：

- 用户主动创建索引：普通索引、唯一索引、分区索引、desc索引、函数索引、反向索引、rtree索引
- 非用户主动创建索引：创建主键，唯一约束，LOB，嵌套表（如：WRH$_CLUSTER_INFO_PK、SYS_IL2510C00003$$、SPATIAL_REF_SYS_PKEY）
- 表类型：heap、tac、lsc
- 模式：单机、集群、分布式


测试关注点：

- 参数符合要求，对象存在，有查看对象权限时，导出的元数据信息正确，
- 使用导出的元数据信息可以创建成功，创建成功后，可以正常走索引扫描，索引相关的视图信息正确
- 错误场景报错信息正确


## 3.2 详细测试设计

（1）入参功能测试，支持index，此处接口对于index并不单独适配修改，公共的场景无需在本次覆盖，只需覆盖索引本身的功能

|入参|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|  `object_typ`  |**VARCHAR:**,大小写，大小写混合,/DFX/resource_manager/test_rm_01_syntax_consumer_group.sql|  
|  
|  
|
|  `name`      
    
    
    
    
    
    
    
    
    
    
|**VARCHAR:**,覆盖：特殊字符、中文、英文、转义字符、大小写，大小写混合、表情包|使用双引号命名的对象按实际大小写，否则需使用全大写名称|null,无该索引，报错不存在,name为其他对象，不会导出其他对应，是报错不存在,  
|  
|
|schema|不指定为默认为当前的schema,1、当前schema下有该索引|生成的创建index语句能正常执行不报错|不指定为默认为当前的schema,1、当前schme下无此索引，其他shema有此索引,  
|不会导出|
|  
|大小写，大小写混合|  
|长度超过64|  
|
|  
|  
|  
|  
|  
|
|参数个数|2、3、4、5、6|  
|0、1、7|  
|
|高级包返回值类型/返回值大小|typeof,返回的索引信息能达到8000字符、32000字符|上限是多少？|  
|*|
|创建同名的pkg，且pkg里面含函数get_ddl|  
|  
|差异点  ：数据库创建的另外一个用户登陆，非sys用户,yashan允许创建，但是使用的时候会报错，内置的优先级高，不可直接使用，需要带上模式。select regress.DBMS_METADATA.GET_DDL(null) from dual;,oracle是自己创建的优先级高，可以使用，导致高级包无法直接使用，报错参数个数不对，需要带上模式。,select sys.DBMS_METADATA.GET_DDL('TABLE','TEST')from dual;,  
,  
|  
|


（2）场景测试

|场景|详细场景说明|预期|备注|
|---|:---|:---|:---|
|语法覆盖|覆盖索引的所有语法路径,（1）只含必选项,（2）所有可选项目|  
|  
|
|get_ddl使用场景|作为其他函数的入参/使用在where等处/返回值用于修改某表的clob列|  
|  
|
|权限|用户A执行get_ddl， shema为A|  
|  
|
|  
|1、用户A执行get_ddl，shema 为B，用户A无用户B的上该表的查询权限,2、给用户A赋权用户B下该表的查询权限|  
|  
|
|同义词|为索引创建同义词，导出时使用同义词|  
|  
|
|跟plsql、pkg结合|1、匿名块/存储过程/自定义函数里面调高级包，将高级包的结果输出/传给变量（  系统表里面获取索引名，逐条传入高级包，并打印出来）,2、plsql异常处理单元，是否正常捕获高级包抛出的异常,3、plsql中调用传参数时，补充覆盖传入参数为拼接类型（变量+常量拼接）；,4、动态执行：,4.1、动态执行去调高级包；,4.2、高级包的返回结果，使用动态执行去执行；,5、pkg的plsql里面使用,6、动态执行语句拼接传参创建的索引，获取其元数据|  
|  
|
|索引类型|非用户主动创建索引：创建主键，唯一索引，LOB、嵌套表（如：WRH$_CLUSTER_INFO_PK、SYS_IL2510C00003$$、SPATIAL_REF_SYS_PKEY）  系统表索引，以及自建表生成的索引|  
|  
|
|  
|用户创建的索引：,  
,唯一索引,（1）表上含primary key、unique（2）create unique ,（3）alter 添加unique,列    [式索引（仅单机heap表）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20INDEX.html#COLUMNAR)  ,函数索引,反向索引,分区索引,desc 索引,rtree索引（仅单机heap表）|  
|索引可以做组合覆盖：,比如：,唯一+函数、唯一+反向、唯一+分区,列    [式索引](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20INDEX.html#COLUMNAR)    +分区索引,rtree索引+分区索引|
|索引属性覆盖|分区索引覆盖：不指定索引表空间，默认跟随表，指定分区表空间跟表不在同一个表空间，指定分区存储属性，覆盖到一、二级分区|  
|  
|
|  
|创建执行索引属性,INITRANS、VISIBLE、INVISIBLE、USABLE、UNUSABLE、NOLOGGING、LOGGING|  
|(语法场景已覆盖)|
|  
|兼容性的参数：,#### nocompress、compress,#### logging、nologging|导出来来不带|兼容参数做get_ddl不展示,(语法场景已覆盖)|
|alter index,  
|index1 rename to  index2 ,get_ddl 覆盖index1 和index2|可以导出index2,index1报错|可以和创建一些覆盖,1、先创建 再做get_ddl,2、再修改属性，再过get_ddl|
|  
|rebuild 新的表空间，普通索引，分区索引|导出的元数据为新的表空间||
|  
|修改存储属性：,INITRANS、VISIBLE、INVISIBLE、UNUSABLE、NOLOGGING、LOGGING|导出的元数据为修改后的属性||
|  
|分区索引的属性：INITRANS、  UNUSABLE|导出的元数据为修改后的属性||
|  
|REVERSE→NOREVERSE,NOREVERSE→REVERSE|导出的元数据为修改后的类型||
|  
|普通索引升级主键后做get_ddl|  
||
|分表表的结构变更导致本地索引的结构也发生变更|一级分区alter table add，二级分区alter table add partition(subpartition xxx,...)    
  二级分区alter table modify partition xxx ADD add_subpartition     
  一二级分区alter table drop,interval分区自动扩展,split分区分裂|创建分区索引，执行分区索引的名称|  
|
|临时表|会话级临时表+唯一函数索引+结合alter index，get_ddl穿插,事务级临时表+唯一反向索引+结合alter index,   get_ddl穿插|导出的元数据为修改后的类型|  
|
|  
|建表，建索引，get_ddl使用导出的元数据信息,drop index 后，再根据元数据信息可以创建成功，创建成功后，可以正常走索引扫描|  
|  
|
|  
|  
|  
|  
|


  


  


|专项|场景说明|预期|
|---|---|---|
|HA|备机上执行get_ddl|查询结果和主机一致|
|  
|主机删除、修改索引对象，备机上进行查询|  
|
|并发|并发查询同一个索引的元数据，并发查询不同的索引的元数据|查询应改变加锁，可以并发查询|
|  
|创建、修改、删除索引的过程中查询|ddl会加排他锁，查询不加锁，ddl的过程中可以get_ddl查询，查询的过程中对象变更，查询访问的是旧的DC，直到查询结束，旧的DC可以淘汰。|


  


专项覆盖说明

|系统级DFX分类|是否涉及|说明|
|:---|:---|---|
|CT|涉及|在get_ddl的过程中，修改元数据信息，查看get_ddl是否会有异常|
|KT|不涉及|只要元数据没有问题，KT拉起后，不会影响get_ddl|
|长稳|不涉及|  
|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR|不涉及|  
|
|HA|涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|


# 4. 文本用例

#   
  5. 测试框架设计

本次测试采用yasft测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 6. 测试环境说明

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机/分布式/集群|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[image2024-4-25_17-20-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjQ4OTcwYzJhZjRmNTIxMDlhIiwicmVmX2lkIjoiNjczOTZkMjQ3MjgyMDZlZmI5MmYxYmEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTczLCJleHAiOjE3ODIzOTI1NzN9.RVXL2ZubU0ycmTEroEdsSSFKRtjhGQnCM6VYC3fslLg)

 (image/png)    


[YASHAN-1585支持DBMS_METADATA.GET_DDL获取索引.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjQ4OTcwYzJhZjRmNTIxMDljIiwicmVmX2lkIjoiNjczOTZkMjQ3MjgyMDZlZmI5MmYxYmEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTczLCJleHAiOjE3ODIzOTI1NzN9.KQtHUgzIbQKhELTOBQFOFsa5YwjD-N4kJx9AkhhwjZ4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
