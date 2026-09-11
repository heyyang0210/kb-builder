Created by 易文亮, last modified on 十一月 09, 2023

# 1.概述

YashanDB分布式支持alter constraint的测试设计

# 2.需求分析

SR：    [YDBRD-16150](https://jira.yasdb.com/browse/YDBRD-16150?src=confmacro)    -   分布式支持alter modify constraint、enable/disable constraint  完成

需求文档：    [支持constraint的enable和disable - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=98503022)  

开发设计：    [分布式支持alter modify constraint、enable/disable constraint - 周宇航 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119556222)  

可以通过对disable或者enable启用或者停用对应约束。对于停用的约束在插入时不在检测是否满足该约束，对于主键约束或者unique约束，在停用该约束时会删除对应的索引。 若在停用期间对于约束列添加了新的索引在重新启动约束时会复用对应索引，若索引不是unique的则会升级索引。 对于再启用或者停用约束时是否检测之前插入的数据是否符合约束的情况，enable默认为validate而disable默认为novalidate，同时也可以通过validate或者novalidate手动设置。

理解：

  2.1 支持定义约束时指定enable，disable

  2.2 支持alter table enable/disable validate/novalidate 约束名语法

  2.3 支持ALTER TABLE modify 约束 状态

  2.2 测试重点

语法功能、约束限制、使用场景    
  2）约束限制

即使disable了对应的约束也不可以创建同名约束、创建多个primary和对同列创建多个unique约束。 对于关联外键的主键或者唯一约束，当外键不是disable时，不能将主键或者唯一约束disable。只能先将关联的外键disable后再disable主键或者unique。 对于关联的主键和外键，要从主键或者unique开始enable，否者会报错。 supplemental约束不允许disable，supplement征用的约束也不允许征用。

![](https://pingcode.yasdb.com/atlas/files/public/673969f48970c2af4f51fb51/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQXdBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBaEFFQUFDQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAzMzAsImV4cCI6MTc4MjIyMTEzMH0.erGclM-BTuZLo1ZPIFZUxReStbvJtNAdBpOU1mtzqYc)

![](https://pingcode.yasdb.com/atlas/files/public/673969f4a1ad9a3311dc79c7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQXdBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBaEFFQUFDQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAzMzAsImV4cCI6MTc4MjIyMTEzMH0.erGclM-BTuZLo1ZPIFZUxReStbvJtNAdBpOU1mtzqYc)

# 3.   **测试设计方法**

1）语法覆盖：主要使用等价类测试方法，覆盖所有有效等价类语法执行成功，无效等价类语法执行失败

2）核心功能逻辑：disable/enable约束后，对数据的操作限制，主要使用场景法进行设计，所有场景符合预期

# 4.详细测试设计

1）语法覆盖

|序号|测试对象|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|1|表组织类型|TAC,LSC|  
|  
|  
|
|2|表分区类型|普通表,HASH分区,LIST分区,RANGE分区,INTERVAL分区|  
|分布式LSC的interval分区|  
|
|3|数据分布|复制表,分布表|  
|  
|  
|
|4|约束类型|primary key,not null,unique,check|  
|foriegn key,LSC的check约束|  
|


|序号|语句段1|语句段2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|1|create table|inline constraint,outline constraint|enable(缺省默认),disable|  
|重复的关键字,错误的关键字|  
|
|2|alter table add column|inline constraint,outline constraint|enable(缺省默认),disable|  
|重复的关键字,错误的关键字|  
|
|3|alter table add constraint|inline constraint,outline constraint|enable(缺省默认),disable|  
|重复的关键字,错误的关键字|  
|
|4|alter table table_name|ENABLE [VALIDATE|NOVALIDATE] [using index [index_name]]|constraint constraint_name,unique (column_name),primary key|  
|primary key带列,同时带约束名和约束列,unique不带约束列|  
|
|||DISABLE [VALIDATE|NOVALIDATE] [{keep | drop} index] [cascade]||||  
|
|5|ALTER TABLE table_name MODIFY|[NOT DEFERRABLE] [INITIALLY IMMEDIATE] | [RELY|NORELY] [using_index_clause] [ENABLE|DISABLE] [VALIDATE|NOVALIDATE]|constraint constraint_name,unique (column_name),primary key,根据可选项缺省,是否带rely|norely,是否带using index,enable/disable后是否带validate/novalidate|  
|带validate/novalidate不带enable/disable,rely/norely顺序在enable/disable之后|  
|


确认点：正确的有效的语法执行成功，无效的语法执行失败

2）功能验证

  


|序号|测试内容|预期|备注|
|---|---|---|---|
|1|往unique插入多个null|写入成功|  
|
|2|往unique插入多个唯一数据|写入成功|  
|
|3|往unique插入重复数据|写入报错|  
|
|4|往primary key插入null|写入报错|  
|
|5|往primary key插入多个唯一数据|写入成功|  
|
|6|往primary key插入重复数据|写入报错|  
|
|7|构造数据不满足 check约束|写入报错|  
|
|8|构造数据满足check约束|写入成功|  
|
|9|pk/uk disable约束keep index|约束失效，不会删除index|  
|
|10|pk/uk disable 约束 drop index|约束失效，会删除index|  
|
|11|创建约束时未征用其他index，pk/uk disable 约束不带 keep INDEX、drop index|删除index|  
|
|12|创建约束时征用了已存在的index，pk/uk disable 约束不带 keep INDEX、drop index|不会删除index|  
|
|13|pk/uk enable不带using index，唯一键列带普通索引|关联上索引|  
|
|14|pk/uk enable不带using index，唯一键列带唯一索引|关联上索引|  
|
|15|pk/uk enable不带using index，唯一键列带local索引|关联上索引|  
|
|16|pk/uk enable带using index，唯一键列带普通索引|关联上索引|  
|
|17|pk/uk enable带using index，唯一键列带唯一索引|关联上索引|  
|
|18|pk/uk enable带using index，唯一键列带local索引|关联上索引|  
|
|19|pk/uk enable带using index，唯一键列不带索引|创建一个唯一键约束同名的索引|  
|
|20|pk/uk enable带using index index_name，且索引列与唯一键列相同|执行成功|  
|
|21|pk/uk enable带using index index_name，且索引列与唯一键列不相同|执行失败|  
|
|22|分区表pk/uk enable带using index local，分区键是唯一键交集的子集|执行成功|  
|
|23|分区表pk/uk enable带using index local，分区键不是唯一键交集的子集|执行失败|  
|
|24|pk/uk enable不指定validate属性，确认默认值|enable默认validate|  
|
|25|pk/uk disable不指定validate属性，确认默认值|disable默认novalidate|  
|
|26|pk/uk带enable/disable确认约束新增/修改记录逻辑|逻辑正确|  
|
|27|pk/uk带enable/disable validate/novalidate约束已有历史记录逻辑|逻辑正确|  
|
|28|pk/uk带enable [validate]检查已有记录和新增/修改记录都符合约束|逻辑正确|  
|
|29|pk/uk带enable novalidate已有记录可以不满足约束，新增和修改记录需满足约束|逻辑正确|  
|
|30|pk/uk带disable validate禁用约束，删除约束上的索引，不允许修改任何被约束的记录|逻辑正确|  
|
|31|pk/uk带disable [novalidate]禁用约束，删除约束上的索引，允许修改任何被约束的记录|逻辑正确|  
|
|32|约束为disable状态插入约束内的值|成功|  
|
|33|约束为enable状态插入约束内的值|成功|  
|
|34|约束为disable状态插入约束外的值|成功|  
|
|35|约束为enable状态插入约束外的值|失败|  
|


确认各种组合场景符合预期，检查系统视图属性正确。

[分布式支持constraint的enable和diable.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjRhMWFkOWEzMzExZGM3OWM0IiwicmVmX2lkIjoiNjczOTY5ZjQ3MjgyMDZlZmI5MmVmOTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzMwLCJleHAiOjE3ODIyOTY3MzB9.c2-zMY838lO41Xbnr-aZSpNnHgA5ORutOLAEA3uy_ts)

## **5.测试用例**

  


## **6.**  ** **  **测试框架**

  


## **7.测试环境**

**分布式**

  


## Attachments:

[支持constraint的enable和diable.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjRhMWFkOWEzMzExZGM3OWM1IiwicmVmX2lkIjoiNjczOTY5ZjQ3MjgyMDZlZmI5MmVmOTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzMwLCJleHAiOjE3ODIyOTY3MzB9.2lu9GRM049QWYhL-CwkTydHZ9lNLLs14fd8R0RGv71A)

 (application/x-xmind)    


[外键级联变更.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjRhMWFkOWEzMzExZGM3OWM2IiwicmVmX2lkIjoiNjczOTY5ZjQ3MjgyMDZlZmI5MmVmOTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzMwLCJleHAiOjE3ODIyOTY3MzB9.lCKKm1xGGChc3iSLlSURlgkmTXWFSOwkmsOvGV7x5aA)

 (image/png)    


[外键支持级联变更.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjQ4OTcwYzJhZjRmNTFmYjUwIiwicmVmX2lkIjoiNjczOTY5ZjQ3MjgyMDZlZmI5MmVmOTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzMwLCJleHAiOjE3ODIyOTY3MzB9.ubFyMoEwKRPK_vwBKWSrHBODymxSZcgzr1VR216wRcQ)

 (application/x-xmind)    


[分布式支持constraint的enable和diable.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjRhMWFkOWEzMzExZGM3OWM0IiwicmVmX2lkIjoiNjczOTY5ZjQ3MjgyMDZlZmI5MmVmOTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzMwLCJleHAiOjE3ODIyOTY3MzB9.c2-zMY838lO41Xbnr-aZSpNnHgA5ORutOLAEA3uy_ts)

 (application/x-xmind)    
