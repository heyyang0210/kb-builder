Created by 易文亮, last modified on 二月 20, 2024

# **1. 概述**

本文描述LSC表支持唯一性约束的测试设计

# **2. 需求分析**

SR：       [YDBRD-12905](https://jira.yasdb.com/browse/YDBRD-12905?src=confmacro)    -  LSC表支持唯一性约束  完成

开发设计：    [【Spearfish】LSC支持唯一性约束方案设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107384763)  

覆盖场景：

- create table
- alter table 添加表级约束
- alter table add col 
- alter table drop
- inline_constraint
- outline_constraint


涉及约束：

- primary key
- unique


涉及语法

inline_constraint

![](https://conf.yasdb.com/download/attachments/89084036/WXWorkLocal_16636572613812.png?version=1&modificationDate=1663657275000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk4NTgsImV4cCI6MTc4MjIyMDY1OH0.4L4iBSy6nvkpBwvpmVFKgnGFumRzk-zTaFiWqV01bBo)

outline_constraint

![](https://conf.yasdb.com/download/attachments/89084036/WXWorkLocal_16636575277674.png?version=1&modificationDate=1663657556000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk4NTgsImV4cCI6MTc4MjIyMDY1OH0.4L4iBSy6nvkpBwvpmVFKgnGFumRzk-zTaFiWqV01bBo)

  


  


drop 约束

![](https://conf.yasdb.com/download/attachments/89084036/WXWorkLocal_16636571518704.png?version=4&modificationDate=1663657341000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk4NTgsImV4cCI6MTc4MjIyMDY1OH0.4L4iBSy6nvkpBwvpmVFKgnGFumRzk-zTaFiWqV01bBo)

  


**约束：**

- 唯一性约束仅用于去重，不能用于索引查询，执行计划通过特殊接口感知（YDBRD-14145中提供）
- 不支持索引语法（create/alter/drop index）
- 不支持add constraint using index语法
- 分布式分布表新增唯一约束（或主键约束）时，必须包括分布键，否则报错并提示相关错误
- 分布式指定分布键时，必须是唯一约束键（包括主键，unique,unique index）的子集，  默认的分布键取唯一约束键的公共子集中的第一个恰当的数据类型的字段


其他：

创建index不带local默认是global索引，单机唯一键的索引默认是global，除非使用using index local，而分布式分布表默认的唯一键索引是local。

# **3. 测试**  **设计方法**   

测试设计主要采用等价类和场景测试法进行设计

# 4.   **详细测试设计**

- create table


|输入条件|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|
|LSC表类型|复制表/分布表,指定分布键是  唯一约束键的子集,不指定分布键|指定分布键不是  唯一约束键的子集|  
|
|分区|hash,range,list,interval，无分区|  
|  
|
|数据类型|字符型（char、varchar）|raw|覆盖所有index支持的数据类型|
|  
|整数类型(tinyint、smallint、int、bigint)|  
||
|  
|浮点型（float、double、number）|  
||
|  
|文本类型（clob、  ~~blob~~  ）|blob||
|  
|日期类型  （time、、timestamp、date、interval ）|  
||
|  
|枚举（  bool、  ~~bit~~  ）|bit||
|inline_constraint|部分列|不存在的列|  
|
|  
|所有列|  
|  
|
|  
|单个unique|  
|  
|
|  
|单个primary key|多个primary key|  
|
|  
|多个unique|一列多个相同约束|  
|
|  
|含1个primary key和多个unique|一列多个不同约束：约束之间是否冲突|  
|
|约束与分区表的关系|分区键为约束交集的子集|分区键不为约束交集的子集|  
|
|  
|分区键为约束交集|  
|  
|
|约束与分布表的关系|分布键为约束交集的子集|分布键不为约束交集的子集|  
|
|  
|分布键为约束交集|  
|  
|
|约束名|有约束名,合法字符：字母、数字、符号、中文|非合法字符：,空格|  
|
|  
|无约束名|  
|  
|
|  
|约束名长度1-64|超过64|64字节|
|  
|VALIDATE|  
|**VALIDATE/NOVALIDATE**  ：,指定在定义某个约束项时，是否对  表中现有的数据  进行该项约束检查，VALIDATE表示检查，NOVALIDATE表示不检查。可省略，则默认为VALIDATE。,UNIQUE/PRIMARY KEY约束项，系统将始终默认为VALIDATE，执行约束检查，即使指定了NOVALIDATE|
|  
|NOVALIDATE|  
||
|  
|~~using index~~|  
|自创建的index是  invisible|
|outline_constraint|部分列|  
|  
|
|  
|组合约束多列（最大32）|超过32列|  
|
|  
|组合约束单列|  
|  
|
|  
|单个unique|  
|  
|
|  
|单个primary key|  
|  
|
|  
|多个unique|重复约束|  
|
|  
|含1个primary key和多个unique|冲突约束|  
|
|  
|一个约束建在多列上|  
|  
|
|  
|多个约束建在多列上|  
|  
|
|约束与分区表的关系|分区键为约束交集的子集|分区键不为约束交集的子集|  
|
|  
|分区键为约束交集|  
|  
|
|约束与分布表的关系|分布键为约束交集的子集|分布键不为约束交集的子集|  
|
|  
|分布键为约束交集|  
|  
|
|  
|~~using index~~|  
|  
|
|  
|VALIDATE/NOVALIDATE|  
|  
|
|主键|1个主键|多个主键|  
|
|  
|建在一列上|  
|  
|
|  
|建在全部列上（最大32）|  
|  
|
|  
|验证唯一性与非空性成立|不成立|  
|
|  
|视图验证|  
|  
|
|  
|inline_constraint/outline_constraint|  
|  
|
|  
|分布键为主键|分布键不是主键|  
|
|  
|  
|  
|  
|
|unique/  ~~unique index~~|1个唯一列|  
|  
|
|  
|多个唯一列|  
|  
|
|  
|建在一列上|  
|  
|
|  
|建在全部列上（4096）|  
|  
|
|  
|验证唯一性成立|不成立|  
|
|  
|inline_constraint/outline_constraint|  
|  
|
|  
|视图验证|  
|  
|
|  
|分布键为唯一索引键子集|分布键不是唯一索引键子集|  
|


- alter table   add     constraint   添加表级约束


ALTER     TABLE     table_name     ADD     out_of_line_constraint

|输入条件|  
|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|
|表类型|  
|tac/lsc/heap|  
|  
|
|  
|  
|复制表/分布表,指定分布键是  唯一约束键的子集,不指定分布键|指定分布键不是  唯一约束键的子集|  
|
|数据类型|  
|字符型（char、varchar）|  
|  
  覆盖所有支持的数据类型    
    
    
    
    
|
|  
|  
|整数类型(tinyint、smallint、int、bigint)|  
||
|  
|  
|浮点型（float、double、number）|  
||
|  
|  
|文本类型（clob、blob）|  
||
|  
|  
|日期类型  （time、、timestamp、date、interval ）|  
||
|  
|  
|枚举（  bool、bit  ）|  
||
|outline_constraint|  
|空表|  
|  
|
|  
|  
|非空表|违背约束|  
|
|  
|  
|非空表+validate|违背约束|  
|
|  
|  
|非空表+novalidate|  
|1、违背约束不报错,2、再插入违背约束的数据报错|
|  
|已有列增加约束|不同约束|相同约束|不同约束之间相互违背|
|  
|没有约束列增加约束|1|  
|  
|
|  
||多个|  
|  
|
|  
||新增列增加约束，删除列之后先增加列再加约束，同时增加列和约束|  
|  
|
|  
|约束名|有|  
|  
|
|  
||没有|  
|  
|
|不同约束（同create table）|主键|包含分布键|不包含分布键|  
|
||unique/unique index|包含分布键|包含分布键|  
|
||not null|  
|  
|  
|
||check|  
|  
|  
|


- alter table add col


ALTER     TABLE     table_name     Add     COLUMN     column_name column_type     CONSTRAINT     inline_constraint

|输入条件|  
|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|
|inline_constraint|已有列加约束|列没有约束|  
|  
|
|  
|  
|增加相同的约束|  
|  
|
|  
|  
|增加不同的约束|  
|  
|
|  
|增加新的列+约束|单个约束|  
|  
|
|  
|  
|多个约束|  
|  
|
|  
|  
|  
|  
|  
|
|不同约束（同create table）|  
|  
|  
|  
|


- alter table drop


|输入条件|有效等价类|无效等价类|
|:---|:---|:---|
|主键|存在的主键|不存在的主键|
|unique|一列，多列，全部列（4096）|  
|
|约束名|存在的约束名|不存在的约束名|
|索引|保留索引|  
|
|  
|删除索引|  
|


  


3.2 专项测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|是|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|是|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


3.3 其他

新增系统表  TABSIM$

# 5.   **测试用例**

[LSC表支持唯一约束测试设计(ydbrd12905).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTY4OTcwYzJhZjRmNTFmYjFmIiwicmVmX2lkIjoiNjczOTY5ZTY1OTNmOTljOWZmMjM1M2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODU4LCJleHAiOjE3ODIyOTYyNTh9.Bq-vGhyK_kG6SDpNGPx8MaAPhP1dlSEX7hNfLApgvts)

[YDBRD12905 lsc支持唯一键测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTZhMWFkOWEzMzExZGM3OTk1IiwicmVmX2lkIjoiNjczOTY5ZTY1OTNmOTljOWZmMjM1M2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODU4LCJleHAiOjE3ODIyOTYyNTh9.F6JLYdHjT4NRPwINlP3114wTM-STnTbwADK_IgC5Q5s)

# 6.   **测试框架设计**

自动化用例添加到yasft/HA框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[LSC表支持唯一约束测试设计(ydbrd12905).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTY4OTcwYzJhZjRmNTFmYjFmIiwicmVmX2lkIjoiNjczOTY5ZTY1OTNmOTljOWZmMjM1M2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODU4LCJleHAiOjE3ODIyOTYyNTh9.Bq-vGhyK_kG6SDpNGPx8MaAPhP1dlSEX7hNfLApgvts)

 (application/x-xmind)    


[YDBRD12905 lsc支持唯一键测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTZhMWFkOWEzMzExZGM3OTk1IiwicmVmX2lkIjoiNjczOTY5ZTY1OTNmOTljOWZmMjM1M2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODU4LCJleHAiOjE3ODIyOTYyNTh9.F6JLYdHjT4NRPwINlP3114wTM-STnTbwADK_IgC5Q5s)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
