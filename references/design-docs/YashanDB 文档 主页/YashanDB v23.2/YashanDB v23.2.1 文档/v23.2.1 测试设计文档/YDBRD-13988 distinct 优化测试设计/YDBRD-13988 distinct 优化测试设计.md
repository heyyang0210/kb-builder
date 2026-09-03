Created by 李攀, last modified on 十一月 09, 2023

  


# **1. 概述**

本文描述distinct优化功能的测试设计。

SR：    [YDBRD-13988](https://jira.yasdb.com/browse/YDBRD-13988?src=confmacro)    -  Distinct的优化  完成

开发设计文档：    [详细设计 - 吴昊旻 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133574933)  

测试文档：     [distinct优化测试概要设计 - 孔珂煜 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133576903)  

  [                   distinct优化测试调研文档 - 孔珂煜 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133575859)  

  


# **2. 需求分析**

distinct及group by需要键值序列做去重，键值数量可缩减来加快执行效率；

缩减规则：

1. 当键值序列出现在谓词中，且键值符合等价类规则时，键值数量可缩减；
1. 当键值序列出现常量，但不全是常量时，常量可消除；
1. 当键值序列全部为常量时，保留一个常量；
1. 重复列去重  保留一个
1. 当去重列包含主键列和唯一键索引时，主键列已要求插入的数据非重复，返回的结果不会有重复值，可进行优化。


**支持的部署形态**  ：单机（行列），分布式，集群  

  


# **3. 测试**  **设计方法**   

1.主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

2.对比结果和oracle执行结果是否一致

3. 和oracle执行计划对比，查看优化能力差异

4. 行列执行结果对比是否一致，行列执行计划对比

  


|专项|是否涉及|
|:---|:---|
|CT|是|
|长稳|  
|
|一致性|  
|
|安全|  
|
|HA|  
|
|压力|  
|
|性能|是|
|资料|是|


# 4.   **详细测试设计**

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|常量优化|键值序列出现常量，但不全是常量时|常量消除|没有出现常量，列不是主键列和唯一键列|不优化distinct，按实际投影的列生成distinct表达式|
|  
|键值序列全是常量时候|保留一个常量,常量起别名|  
|  
|
|  
|去重列包含主键列|已要求插入的数据非重复，返回的结果不会有重复值，可进行优化，消除distinct|  
|  
|
|  
|唯一键索引列|已要求插入的数据非重复，返回的结果不会有重复值，可进行优化(只做无效列的消除，没有distinct算子消除),多表优化支持消除等价类|  
|  
|
|  
|消除顺序|等价类--》常量---》主键（唯一键）|计划用例上二层？没有cost和rows的,  
|  
|
|等价类优化|列的等价类 ,select distict c1 ,c2 from t where c1=c2|预期distict 表达式,c1,  
,别名优化？打印别名还是实际的列|  
|  
|
|  
|当返回结果只有一条时（聚合函数，limit 1 ，where条件返回值只有1条）,如 select distinct c1 from t where id=1(id 列为主键列),select sum(c1) from t;,select c1 from t order by 1 limit 1;（转测时未实现）|预期结果为：消除distinct|结果可能行数不固定 select disctinct c1 from t where c1>1|不会消除distinct|
|  
|列等于常量,select distinct  1，c1 from t where c1=1,select distinct  c1 from t where c1=1;|预期没有distinct 算子|  
|  
|
|汇聚函数|仅有distinct没有group by的时候|仅有distinct没有group by的时候，去重列包含汇聚函数消除distinct，直接走aggr,在聚合函数里和外的 情况sum(distinct(c1)),c1是主键|有distinct有group by的时候未做|  
|
|规格验证|等价类优化之后，要进行替换，即a,b from t1 where a=2 and b=2的时候，distinct expression会打印成 distinct expression（2）|  
|  
|  
|
|  
|等价类和常量同时需要优化情况|等价类优化之后，要进行替换，即a,b from t1 where a=2 and b=2的时候，distinct expression会打印成 distinct expression（2）|  
|  
|
|投影列类型|BOOLEAN     
  TINYINT     
  SMALLINT     
  INTEGER     
  BIGINT     
  FLOAT     
  DOUBLE     
  NUMBER     
  DATE     
  TIME     
  TIMESTAMP     
  INTERVAL YEAR TO MONTH     
  INTERVAL DAY TO SECOND     
  CHAR     
  NCHAR     
  VARCHAR     
  NVARCHAR     
  RAW     
  CLOB     
  BLOB     
  BIT     
  ROWID     
  NCLOB     
  CURSOR     
  JSON     
  UDT_OBJECT     
  UDT_ARRAY     
  UDT_TABLE     
  XMLTYPE    
    
|创建表覆盖所有数据类型|  
|  
|
|  
|常量|number,字符串,布尔值,  
|  
|  
|
|  
|sysdate，systimstamp|  
|  
|  
|
|  
|伪列：rownum，level，rowid|  
|  
|  
|
|  
|列重复投影：select c1,c1 ...|  
|  
|  
|
|  
|自定义函数|  
|  
|  
|
|  
|内置函数（没做优化，拦截？）,random函数|覆盖所有内置函数    [YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html)  |  
|  
|
|  
|表达式列|1.常量表达式,2.运算表达式（全是常量）,3.运算表达式（含有列）,4.布尔表达式|  
|  
|
|  
|高级包：dbms_random，,dbms_metadata.get_ddl等|  
|  
|  
|
|  
|特殊值 : null|预期是计划中消除distinct|  
|  
|
|数据来源|单表|  
|  
|  
|
|  
|子查询：,投影列子查询,from 子查询,where 子查询,子查询外部引用 *|  
|  
|  
|
|场景覆盖|dml:,insert...select,update,delete的where条件有select|  
|  
|  
|
|  
|create as select|  
|  
|  
|
|  
|case when|  
|  
|  
|
|  
|和group by组合场景,  
|同时存在distinct和group by时，当分组列时去重列的子集时，消除distinct，保留group by|  
|  
|
|  
|order by |  
|  
|  
|
|  
|limit offset|  
|  
|  
|
|  
|cte里面|  
|  
|  
|
|explain |关注cost变化，多常量选择cost小的常量|  
|  
|  
|
|统计信息|收集统计信息后执行distinct 语句,覆盖一下直方图类型|收集统计信息后查看执行计划,关注rows  ,cost是否有变化|  
|  
|
|表类型|普通表|  
|  
|  
|
|  
|分区表|  
|  
|  
|
|  
|列表|  
|  
|  
|
|部署形态|单机|  
|  
|  
|
|  
|分布式|  
|  
|  
|
|规格拦截|只支持主键|  
|唯一索引不支持|  
|
|  
|  
|  
|- 当前版本不支持多表场景下的distinct消除，对于多表的情况，统计信息会记录是否为唯一行，即主键特征，来确定是否需要消除distinct
|  
|
|数据类型转换|  
|  
|  
|  
|
|绑定参数|  
|  
|  
|  
|
|多表join|  
|  
|- 当前版本不支持对唯一键索引的distinct消除
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|大数据量数据性能对比|100W数据量单表性能对比|通过set timing on查看执行时间|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|并发场景|testkill框架CT并发|  
|  
|  
|


  


结果和oracle ,mysql对比参考

  


# 5.   **测试用例**

[distinct优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTVhMWFkOWEzMzExZGM4NDA3IiwicmVmX2lkIjoiNjczOTZiOTU1OTNmOTljOWZmMjM2NDgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NjIzLCJleHAiOjE3ODIzODIwMjN9.36NkxzALQf-Uf8SXvvb__tJfWCMzT6jot_u5a9tPtfc)

# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-5-12_14-45-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTZhMWFkOWEzMzExZGM4NDA5IiwicmVmX2lkIjoiNjczOTZiOTU1OTNmOTljOWZmMjM2NDgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NjIzLCJleHAiOjE3ODIzODIwMjN9.3jagHWXuR71hcrEyFaP5YcUXhc741TfKOLXiO0AJzVY)

 (image/png)    


[distinct优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTVhMWFkOWEzMzExZGM4NDA3IiwicmVmX2lkIjoiNjczOTZiOTU1OTNmOTljOWZmMjM2NDgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NjIzLCJleHAiOjE3ODIzODIwMjN9.36NkxzALQf-Uf8SXvvb__tJfWCMzT6jot_u5a9tPtfc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,补充绑定参数,Posted by kongkeyu at 十一月 02, 2023 16:10|
|---|
