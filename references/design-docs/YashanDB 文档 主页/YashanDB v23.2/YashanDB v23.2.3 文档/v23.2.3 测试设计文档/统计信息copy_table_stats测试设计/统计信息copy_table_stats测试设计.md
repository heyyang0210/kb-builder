Created by 李攀, last modified on 五月 28, 2024

#   [1. 概述](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  

本文描述统计信息  *新增DBMS_STATS系统包子函数*

SR链接：    [https://pingcode.yasdb.com/pjm/items/66263f0bfd997db58adf0b58](https://pingcode.yasdb.com/pjm/items/66263f0bfd997db58adf0b58)    *?*

开发设计文档：    [新增copy_table_stats等函数 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153006746)  

  


#   [2. 需求分析](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#2%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

2.1 功能点概述：

新增3个函数，

copy_table_stats：拷贝表分区的统计信息至表内另一个分区，包括列统计信息，local index统计信息，不会拷贝二级分区的统计信息

convert_raw_value：  将表中存储的统计信息项min，max，endpoint_value_raw（RAW类型）转换为特定类型的值

reset_global_pref_defaults：  重新设置global prefs为默认值，包括est，granularity，method_opt等全局prefs

  


##   [2. 2 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

### 2.1 copy_table_stats：拷贝表分区的统计信息至表内另一个分区，可以通过dba_tab_statistics，dba_part_col_statistics，dba_ind_statistics，dba_part_histograms视图查看目标分区统计信息的更新

|  
|  
|  
|
|:---|:---|:---|
|owner|用户名|可省略，默认为当前用户|
|tabname|表名|不可省略|
|srcpartname|源分区名|不可省略|
|dstpartname|目标分区名|不可省略|
|scale factor|该参数可以放缩统计信息，如分区统计信息项blocknum，num_rows，索引统计信息项num_rows，leafblocks,类型为float，,scale_factor = 2，目标分区num_rows*2,sclae_factor = 0.5，目标分区num_rows*0.5（取整）|可省略，默认为1|
|force|force = true，即使目标分区统计信息被锁定，也会强制复制|可省略，默认为false|


权限：统计信息权限

|  `exec dbms_stats.copy_table_stats(`      `'sys'`      `, `      `'PT1'`      `, `      `'P1'`      `, `      `'P2'`      `, 2, TRUE);`  |
|:---|


### 2.2 convert_raw_value：在视图中查看统计信息lowVal，highVal字段为RAW类型，想获取真实值可以通过该函数转换并输出

|  
|  
|
|:---|:---|
|rawval|raw类型值|
|resval|目标类型值，支持的类型有  float，double，date，number，varchar|


权限：无权限要求

|  `set serveroutput on`      
    `declare a varchar(50);`      
    `begin`      
    `dbms_stats.convert_raw_value(`      `'65'`      `, a);`      
    `dbms_output.put_line(a);`      
    `end;`      
    `/`  |
|:---|


### 2.3 reset_global_pref_defaults：  重新设置global prefs为默认值，不会设置表的统计信息prefs，可以通过stats_prefs$查看global_prefs修改

exec dbms_stats.reset_global_pref_defaults;

  


**2.4 规格约束 **

1. copy table stats

根据分区类型不同，会对  **分区列**  统计信息的lowVal，highVal，直方图做额外处理，

对于非分区列，所有列统计信息都会直接copy（  **非分区列是否为二级分区键，不会影响分区的统计信息copy**  ）

1.hash分区：直接拷贝src分区列的lowVal，highVal和直方图，不做额外处理

2.list分区（单个分区列）

- no default分区：lowVal和highVal会根据目标分区list列表的最小最大值设置，如partition p2(1,2,3,4)，copy(p1, p2)，设置的lowval = 1，highVal = 4，不会根据p1设置，直方图设置为NONE
- default分区：lowVal和highVal根据源分区设置，直方图同理


3.range分区（多个分区列）

对于首个分区列，列lowVal和highVal的值遵循以下规则

- 目标分区为首个分区，lowVal = 目标分区range
- 目标分区不为首个分区，lowVal = 目标分区前一个分区range
- 目标分区range为MAXVALUE，highVal = 目标分区前一个分区range
- 目标分区range不为MAXVALUE，highVal = 目标分区range


对于第二个及后续分区列，列lowVal和highVal的值遵循以下规则

- 要设置的列为Cn，目标分区为D，则设置Cn.highVal = MAX(D.range, 源分区列最大值)
- 特殊情况，若Cn-1列在分区D和前一个分区D-1的range相同，则设置Cn.highVal = D.range（无视源分区列的最大值）


对于所有分区列都需要遵循的规则

- 如果源分区列的min = max = 源分区的下界，且distinct = 1，则目标分区列min = max = 目标分区的下界
- 如果设置后的列统计信息min != max，且distinct = 0，重设distinct = 2
- 


|  `// 首个分区列用例`      
    `create table pt2(a `      `int`      `,b `      `int`      `, c `      `int`      `)`      
    `partition by range(a)`      
    `(`      
    `    `      `partition p1 values less than(10),`      
    `    `      `partition p2 values less than(20),`      
    `    `      `partition p3 values less than (MAXVALUE)`      
    `);`  |
|:---|


|copy(src, dst)|min|max|首个分区列a|  
|
|:---|:---|:---|:---|:---|
|copy(P1, P2)|10|20|P2上界为20，设置max = 20,P2前一个分区的上界为10，设置min = 10|分区列直方图均设置为NONE,重设density = 1/distinct,如果设置后的min != max，且distinct = 0，重设distinct = 2|
|copy(P2, P1)|10|10|P1上界为10，max = 10,P1是首个分区，无法准确获取min，设置min = 10||
|copy(P1, P3)|20|20|P3无上界，max = 前一个分区上界 = 20,P3前一个分区的上界为20，设置min = 20||
|copy(P3, P2)|10|20|  
||
|copy(P3, P1)|10|10|  
||
|copy(P2, P3),P2.min = P2.max = P1.range = 10|20|20|如果源分区的min = max = 源分区下界，distinct = 1,则设置目标分区min = max = 目标分区下界,源分区的数据分布很明显，因此目标分区的min和max也需要遵循源分区的分布来处理||


|  `// 第二及后续分区列用例`      
    `create table pt4(a `      `int`      `,b `      `int`      `, c `      `int`      `, d `      `int`      `)`      
    `partition by range(a, b, c)`      
    `(`      
    `    `      `partition p1 values less than(10, 10, 10),`      
    `    `      `partition p2 values less than(20, 30, 40),`      
    `    `      `partition p3 values less than(30, 30, 50)`      
    `);`      
    `insert into pt4 values(5,5,5,0);`      
    `insert into pt4 values(5,100,200,0);`      
    `exec dbms_stats.copy_table_stats(null, `      `'PT4'`      `, `      `'P1'`      `, `      `'P3'`      `, 1, TRUE);`  |
|:---|


|column|min|max|  
|
|:---|:---|:---|:---|
|a|20|20|源分区min = max = 5，distinct = 1，则设置目标分区min = max = 目标前一个分区range = 20|
|b|30|100|max = MAX(分区列b.range， 源分区列数据最大值),插入（25，100，5，0）时，该条数据会被插入p3分区，p3分区列max有可能大于b.range，所以max需要根据源分区列数据最大值去设置|
|c|40|50|前一个分区列b在分区p2和分区p3的range相同，直接设置max = c.range，忽略源分区列数据最大值,插入数据时，只要10 < b < 30，那么该条数据一定会被插入p2分区，不论c的值多大，所以c在分区p3的最大值一定是range，不需要考虑源分区列数据的最大值|


# **3. 测试**  **设计**

# 3.1 测试设计方法

在接口和基本功能点验证时使用生存暂存表的方式模拟导入工具导入暂存表，但是需要有流程覆盖整个完整过程，这部分进行导入导出专项测试

1.针对函数接口主要采样等价类，边界值，进行测测试设计

2.场景法和流程图法对  copy_table_stats进行测试用例设计

 流程图：

![](https://pingcode.yasdb.com/atlas/files/public/67396d288970c2af4f5210b5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUNBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUlBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYyOTQsImV4cCI6MTc4MjMxNzA5NH0.0hieE-w6Rud4-MDbFtiZSP8WBYDV4HPdytjd4ogJrBo)

  


## **3.2详细测试设计**

**3.2.1 函数接口入参测试**

|存储过程|参数|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|:---|
|  
    
    
    
    
    
    
    
    
    
    
    
    
    
,### copy_table_stat,  
,  
,  
|ownname（用户名）|类型|字符串常量：‘regress’|  
|其他类型变量：int，tinyint，smallint，bigint，number，float，double，time，date，timestamp，interval，blob|  
|
||||字符串变量：varchar，char，varchar2|  
|  
|  
|
|||取值|存在的对象用户名|  
|不存在的ownname|  
|
||||长度：[1,64]|  
|0,65位|  
|
||||null|默认当前用户|特殊值：sysdate，空值报错|  
|
||tab name（表名）|类型|字符串常量：|  
|其他类型变量：int，tinyint，smallint，bigint，number，float，double，time，date，timestamp，interval，blob，clob|  
|
||||字符串变量：varchar，char，varchar2|  
|  
|  
|
|||取值|存在的ownname下的表名,使用 stattab 关键字|  
|ownname下不存在的表,null,空值|  
|
||||长度：[1,64],  
|  
|0,>64（  65位）|  
|
||srcpartname(源分区名)|类型|字符串常量：,字符串变量：varchar，char，varchar2|  
|其他类型变量：int，tinyint，smallint，bigint，number，float，double，time，date，timestamp，interval，blob，clob|  
|
|||取值|  
,长度：[1,64],存在的分区名字,  
|  
|null,空，,65位,不是字符串,不存在的分区名字|  
|
||dstpartname(目标分区名)|类型|字符串常量：,字符串变量：varchar，char，varchar2|  
|n  其他类型变量：int，tinyint，smallint，bigint，number，float，double，time，date，timestamp，interval，blob，clob|  
|
|||取值|长度：[1,64],存在的分区名字,  
|  
|null,空，,65位,不是字符串,不存在的分区名字|  
|
||scale factor    
    
|类型|number类型|  
|0，,负数,不是numer类型,  
|-|
||  
|取值|【0，numer类型的上限值】,null,空（默认值1）|  
|  
|  
|
||force|同上|false,true常量|  
|其他可以隐士转换未布尔类型的常量值,  
|-只允许输入false，true|
|  
|入参个数|取值|【4，6】|  
|小于4，0-3,大于6|报错|
|convert_raw_value|rawval（raw类型值）|类型|  
|  
|不符合raw类型的值（含有非十六进制的字符）,null,空|报错|
|  
|  
|取值|raw类型值|  
|  
|  
|
|  
|resval（目标类型值）|  
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
|### reset_global_pref_defaults|  
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


#### 3.2.2 场景验证

|测试项|测试流程|预期|备注|  
|
|:---|:---|:---|:---|:---|
|非分区列复制|  
|所有列统计信息都会直接copy（  **非分区列是否为二级分区键，不会影响分区的统计信息copy**  ）|  
|  
|
|hash表分区复制|单个分区列：,  
|直接拷贝src分区列的lowVal，highVal和直方图，不做额外处理|  
|  
|
|  
|多个分区列：,  
|  
|  
|  
|
|list分区|单个分区列|lowVal和highVal会根据目标分区list列表的最小最大值设置，如partition p2(1,2,3,4)，copy(p1, p2)，设置的lowval = 1，highVal = 4，不会根据p1设置，直方图设置为NONE|  
|  
|
|  
|目标分区为分区为非list分区键|lowVal和highVal根据源分区设置，直方图同理|其他值与源分区一致|  
|
|range分区|源分区列的min = max = 源分区的下界，且distinct = 1|目标分区列min = max = 目标分区的下界|  
|  
|
|  
|设置后的列统计信息min != max，且distinct = 0|重设distinct = 2|  
|  
|
|  
|目标分区为首个分区|lowVal = 目标分区range|  
|  
|
|  
|目标分区不为首个分区|lowVal = 目标分区前一个分区range|  
|  
|
|  
|目标分区range为MAXVALUE|highVal = 目标分区前一个分区range|  
|  
|
|  
|目标分区range不为MAXVALUE|highVal = 目标分区range|  
|  
|
|  
|对于第二个及后续分区列，要设置的列为Cn，目标分区为D|则设置Cn.highVal = MAX(D.range, 源分区列最大值)|  
|  
|
|  
|特殊情况，若Cn-1列在分区D和前一个分区D-1的range相同|则设置Cn.highVal = D.range（无视源分区列的最大值）|  
|  
|
|local索引统计信息验证|覆盖每一种分区类型对应的local索引|不做处理直接copy|  
|  
|
|分区表没有统计信息的时候copy|  
|不报错，不处理|  
|  
|
|视图|  
|### 通过dba_tab_statistics，dba_part_col_statistics，dba_ind_statistics，dba_part_histograms视图查看目标分区统计信息的更新|  
|  
|
|copy统计信息后执行DDL  DML语句,copy统计信息后执行SQL语句，指定分区查询min,max值等,查看执行计划|  
|  
|  
|  
|
|set p1分区的统计信息，然后copy到P2分区|  
|  
|成功，查看相关统计信息视图，P2分区统计信息更新|  
|
|copy统计信息后再次收集统计信息，收集所有分区|  
|  
|成功|  
|
|权限审计|统计信息权限：,copy_table_stats,reset_global_pref_defaults,无权限要求：,convert_raw_value|  
|  
|  
|
|###  reset_global_pref_defaults|1.先查看global prefs的默认值，可以通过get_prefs和查看,stats_prefs$系统表,2.没有set global prefs 的时候重设|  
|  
|  
|
|  
|1.设置global的值,2.设置table的prefs,3. reset  global frefs|  
|恢复初始的reset,表的prefs不受影响|  
|
|### convert_raw_value验证|在plsql中调用，配合  dbms_output.put_line（）查看结果|  
|  
|  
|
|  
|直接EXEC 方式调用|  
|  
  成功，但是不会输出结果|  
|
|  
|数据类型|  
|  
|  
|


### 3.2.3 dfx功能涉及情况说明

|测试项|是否涉及|测试点|
|:---|:---|:---|
|CT/KT|是|1.同时往某个分区copy统计信息,2.copy过程中有set，gather,deletet统计信息的操作,  
|
|长稳|-|  
|
|一致性|-|  
|
|安全|是|  
|
|HA|是|  
|
|压力|-|  
|
|性能|是|  
|
|资料|是|  
|


# 4. 测试用例

  


  


# 5. 测试框架设计

- 采用guider测试框架进行用例自动化
- 采样导入导出框架进行stattable导入导出测试


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机，集群|


# 7. 工作量评估

工作量：2.  *人/周*

计划测试完成时间：2024/6.12

  


  


会议纪要：

1.考虑列的数据类型

2.分区本身的统计信息

3.convert_raw_value不走集群，集群下不用额外验证

convert_raw_value通过视图查出来的RAW值入参

与会人员：  李攀，马文英，李燕琼，曾昭翰，郑翌凯，陈伟旭

会议时间 ：2024.5.27

## Attachments:

[image2024-5-10_21-35-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjg4OTcwYzJhZjRmNTIxMGI0IiwicmVmX2lkIjoiNjczOTZkMjg3MjgyMDZlZmI5MmYxYmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2Mjk0LCJleHAiOjE3ODIzOTI2OTR9.HQimszXDkP2XziESpwGpmIoHkKoXPCU7AXDF42c3ppg)

 (image/png)    
