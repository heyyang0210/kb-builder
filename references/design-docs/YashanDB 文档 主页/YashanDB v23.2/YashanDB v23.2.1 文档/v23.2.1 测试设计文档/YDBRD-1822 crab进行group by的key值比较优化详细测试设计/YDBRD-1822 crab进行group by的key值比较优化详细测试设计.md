Created by 施新华, last modified on 一月 23, 2024

# **1. 概述**

    该特性对  列存hash group by、sort group by、distinct根据优化器给出的已去重键值做优化，通过去重的键值不做hash和比较加快执行效率。

    SR：    [YDBRD-1822](https://jira.yasdb.com/browse/YDBRD-1822?src=confmacro)    -  CRAB进行group by的key值比较优化  完成

   参考：    [YDBRD-1822 CRAB进行group by的key值比较优化设计文档](135619582.html)  

                 [YDBRD-11535 优化多字段的Hash Group调研](https://conf.yasdb.com/pages/viewpage.action?pageId=135596175)  

# **2. 需求分析**

distinct及group by需要键值序列做去重，键值数量可缩减来加快执行效率；

缩减规则：

- 当键值序列出现在谓词中，且键值符合等价类规则时，键值数量可缩减；
- 当键值序列出现常量，但不全是常量时，常量可消除；
- 当键值序列全部为常量时，保留一个常量；
- 当去重列包含主键列和唯一键索引时，主键列已要求插入的数据非重复，返回的结果不会有重复值，可进行优化。


**支持的部署形态**  ：单机列存、分布式列存

# **3. 详细测试设计**

## 3.1 测试设计方法

1.主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计；

2.对比结和oracle执行结果是否一致；

3. 和oracle执行计划对比，查看优化能力差异。

  


|专项|是否涉及|场景|
|:---|:---|---|
|CT|是|增加查询并发：包含统计信息收集、autotrace以及查询|
|长稳|  
|  
|
|一致性|  
|  
|
|安全|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|是|性能对比优化前有提升|
|资料|  
|  
|


## 3.2 详细测试设计

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|常量优化|键值序列出现常量，但不全是常量时|常量消除|没有出现常量，列不是主键列和唯一键列|  
|
|  
|键值序列全是常量时候|保留一个常量|  
|  
|
|  
|去重列包含主键列|已要求插入的数据非重复，返回的结果不会有重复值|  
|  
|
|  
|唯一键索引列|已要求插入的数据非重复，返回的结果不会有重复值，可进行优化，多表优化支持消除等价类|  
|  
|
|  
|消除顺序|等价类--》常量---》主键（唯一键）|  
,  
|  
|
|distinct|列的等价类 ,select distict c1 ,c2 from t where c1=c2|  
|  
|  
|
|  
|当返回结果只有一条时（聚合函数，limit 1 ，where条件返回值只有1条）,如 select distinct c1 from t where id=1(id 列为主键列),select sum(c1) from t;,select c1 from t order by 1 limit 1;（转测时未实现）|除了主键列和唯一键索引列+not null约束会消除distinct，其它不会|  
|  
|
|  
|列等于常量,select distinct  1，c1 from t where c1=1,select distinct  c1 from t where c1=1;|预期没有distinct 算子|  
|  
|
|group by|group by 单列|覆盖不同数据类型|  
|  
|
||group by 单列，常量|采用等价类，选取3种类型，常量：数字，时间|  
|  
|
||group by 多列|2列数据类型，3列数据类型，2列字符类型，3列字符类型， 数据和字符类型|  
|  
|
||group by 多列，常量|  
|  
|  
|
||group by 常量|  
|  
|  
|
||group by having |  
|  
|  
|
||group by  limit |  
|  
|  
|
||group by having limit |  
|  
|  
|
||where group by|谓词列与键值不重复；,谓词列与键值部分重复；,谓词列与键值全部重复|  
|  
|
||索引|键值列与主键列重复；,键值列与唯一键列重复；,键值列与索引列重复。,键值列与索引不重复。|  
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
  VARCHAR    
  RAW    
  CLOB    
  BLOB    
  JSON    
    
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
|列重复投影：select c1,c1 ...|  
|  
|  
|
|  
|内置函数（没做优化，拦截？）|覆盖所有内置函数    [YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html)  |  
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
|表类型|单机：普通列存表，分区列存表|  
|  
|  
|
|  
|分布式：分布表，复制表，普通表，分区表|  
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
|索引|主键，唯一键|  
|  
|  
|
|  
|创建索引|  
|  
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
|  
|  
|
|大数据量数据性能对比|100W数据量单表性能对比|通过set timing on查看执行时间|  
|  
|


  


结果和oracle 对比参考

  


# 4.   **测试用例**

# 5.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 6.   **测试环境说明**

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|机器|内存|版本|数据库|
|:---|:---|:---|:---|
|192.168.6.170/171|20G|CentOS Linux release 7.9.2009 (Core)|开发提供安装包|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：

  


## Attachments:

[crab进行group by的key值比较优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTQ4OTcwYzJhZjRmNTIwNTg4IiwicmVmX2lkIjoiNjczOTZiOTQ1OTNmOTljOWZmMjM2NDZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTg4LCJleHAiOjE3ODIzODE5ODh9.rY_7GfPK6du6pjcZ5-BLmIEe3877uvNyTXFKGqGjGM4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
