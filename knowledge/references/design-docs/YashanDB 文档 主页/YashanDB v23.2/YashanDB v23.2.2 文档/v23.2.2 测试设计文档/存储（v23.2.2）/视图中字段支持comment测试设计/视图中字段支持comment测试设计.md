Created by 卢凯舜, last modified on 四月 19, 2024

# 1. 概述

该需求方案旨在支持 COMMENT ON COLUMN 语句操作 force view 中的列。支持对 force view 进行编译以及对系统表 col$ 刷新，满足支持 COMMENT ON COLUMN force view 的元数据条件。

# 2. 需求分析

sr链接：    [https://pingcode.yasdb.com/pjm/items/6613a8cefd997db58ad5abcd](https://pingcode.yasdb.com/pjm/items/6613a8cefd997db58ad5abcd)    ?#YDBRD-26010 视图中字段支持comment功能

开发文档：    [comment on column force view设计文档 - 王博文 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150606864)  

## 2.1 功能点分析

- 语法分析 对外提供语法，语法图来源于       [COMMENT](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/COMMENT.html)       语句，本次支持 view 可选为 force view，无语法变更。
- ![](https://pingcode.yasdb.com/atlas/files/public/67396cbea1ad9a3311dc8c97/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMxNTAsImV4cCI6MTc4MjMxMzk1MH0.ZCp0kR1u1ZjdUinRGLyE4_qEGWZBWd3rl9NQei_JbyM)
- 对使用       [CREATE FORCE VIEW](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20VIEW.html)       语句创建的 force view，使用语句 COMMENT ON COLUMN 语句操作后预期成功，记录可在系统表 COM$、系统视图 DBA_TAB_COMMENTS、DBA_COL_COMMENTS 中查询。
- 涉及视图


DBA_OBJECTS：查看对象的status，modify time

DBA_TAB_COLUMNS / DESC：查看视图的列信息

DBA_VIEWS： 查看视图的view text

DBA_DEPENDENCIES：查看视图依赖的基表信息

USER_TAB_COMMENTS/USER_COL_COMMENTS：查看注释信息

## 2.2 应用场景

- 基表未创建情况下，以基表所有列创建force视图，报错无效标识符；再创建基表，可对列名执行comment
- 基表未创建情况下，以基表指定列创建force视图，报错无效标识符（与Oracle区别）；再创建基表，可对对应指定列名执行
- 基表未创建情况下，以基表创建force视图时指定对应列，可对对应列名执行；再创建基表，也可对对应指定列名执行
- 基表已创建情况下，以基表创建force视图编译失败时，报错无效标识符；删除视图重新创建，编译成功时，可对对应指定列名执行


## 2.3 规格约束

- 执行 COMMENT ON COLUMN force view 需确保 force view 可编译成功或 col$ 存在操作的列的记录。
- *内部机制涉及的规格约束*


# 3. 测试设计方法 

## 3.1 测试设计方法

*语法：主要采用等价类划分的方式，划分有效等价类和无效等价类进行覆盖*

*功能：*  *采用场景法，验证带*

*测试范围*

- 部署模式：单机
- 表类型：heap、tac、lsc


## 3.2 详细测试设计

*1)使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*

*语法测试*

|输入条件||有效等价类|编号|无效等价类|编号|
|:---|---|:---|:---|:---|:---|
|  
|  
|  
|  
|  
|  
|


场景测试

|序号|测试场景||预期|备注|
|:---:|:---:|---|:---:|:---:|
|  
|基表未创建情况下，以基表所有列创建force视图|1.创建  force视图后，对force view视图执行comment；对对应列执行comment，查询comment视图信息,2.创建基表，对force view视图执行comment；对对应列执行comment，查询comment视图信息,3.select force view，编译后，查询comment视图信息|1.执行失败，  报错无效标识符,2.执行成功，可查询到对应视图信息,3.执行成功，可查询到对应视图信息|  
|
|  
|基表未创建情况下，以基表指定列创建force视图|1.创建  force视图后，对force view视图执行comment；对对应列执行comment，查询comment视图信息,2.创建基表，与指定列不对应，编译错误，对force view视图执行comment；对对应列执行comment；查询comment视图信息,3.删除基表后重新创建基表，与指定列对应，对force view视图执行comment；对对应列执行comment；查询comment视图信息,4.select force view，编译后，查询comment视图信息|1.执行失败，  报错无效标识符,2.执行失败，报错无效标识符,3.执行成功，可查询到对应视图信息,4.执行成功，可查询到对应视图信息|列不对应，列数量不匹配|
|  
|基表未创建情况下，以基表创建force视图时对force视图指定对应列|1.创建  force视图后，对force view视图执行comment；对对应列执行comment；查询comment视图信息,2.创建基表，不与指定列对应，编译失败，对force view视图执行comment；对对应列执行comment；查询comment视图信息,3.删除基表后重新创建基表，对force view视图执行comment；对对应列执行comment，查询comment视图信息,4.select force view，编译后，查询comment视图信息|1  .执行成功，可查询到对应视图信息,2.执行成功，可查询到对应视图信息？,3.执行成功，可查询到对应视图信息,4.执行成功，可查询到对应视图信息|on table 执行成功，on col执行失败|
|  
|基表已创建情况下，以基表创建force视图列不对应，编译失败时|1.创建  force视图后，对force view视图执行comment；对对应列执行comment，查询comment视图信息,2.删除基表后重新创建基表，对force view视图执行comment；对对应列执行comment，查询comment视图信息,3.select force view，编译后，查询comment视图信息|1.执行失败，  报错无效标识符,2.执行成功，可查询到对应视图信息,3.执行成功，可查询到对应视图信息|  
|
|  
|以多个表为基表的情况|1.正交覆盖上述场景,2.依赖多张表，其中一张表删除,3.多张表均删除|1.对每张表单独做上述操作，符合上述预期|view1依赖多张表， 部分表发生变化，覆盖场景如下:,1、view依赖的部分表不存在，创建对应的表（invalid → valid）,2、view状态valid， drop部分的表（valid→ invalid），dependency上只会删除掉部分的表,3、view状态valid，drop 掉部分依赖的列（valid→ invalid），  （去掉列信息不会去掉）,4、view依赖的部分表不存在，rename其他的表补齐依赖的基表（invalid → valid）,5、view状态valid， rename掉部分的表（valid→ invalid），dependency上只会删除掉部分的表|
|  
|select  *  覆盖|force view创建时 基表存在，删除基表的一列数据|刷新view的元数据信息，view状态无效|  
|
|  
|  
|force view创建时 基表存在，给基表增加一列数据|不刷新view的元数据信息|  
|
|  
|  
|force view创建时 基表存在，修改基表的数据类型|对应的数据类型会发生变化|  
|
|  
|  
|force view创建时基表不存在， force 创建后再创建基表，删除基表的一列数据|1、创建后dependency为空，column信息为空,2、刷新view的元数据信息，view状态无效|  
|
|  
|  
|force view创建时基表不存在， force 创建后再rename其他表为基表，给基表增加一列数据|不刷新view的元数据信息|  
|
|  
|  
|force view创建时基表不存在， force 创建后再创建基表，修改基表的数据类型|对应的数据类型会发生变化|  
|
|  
|  
|1、基表只有2列 tablea(f1,f2)，创建视图指定列超过2列,create  force view (f1,f2,f3) as select * from tablea;,2、然后给基表增加一列|依然是无效的？（跟oracle对比下）|  
|
|  
|多层依赖场景，对不同视图创建comment|view1依赖view2, view2依赖tablea ,tablea发生变更,1、tablea 删除列（依赖）,2、tablea 增加列,3、tablea  modify column（依赖）,4、drop tablea|  
|  
|
|  
|  
|view1依赖tablea，view2依赖tableb（通过以下3步把tablea和tableb交换一下）,rename tablea to tablec , rename tableb to tablea ,rename  tablec  to tablea ,覆盖rename 后列匹配，以及列不匹配|  
|  
|
|  
|rename基表后创建comment|1.构造基表和force view正常创建场景，对列和视图执行comment,1、rename基表到其他名称，再查询force view，并查看相关视图查看注释，并创建新的注释,2、再把其他表rename成基表回来，再查询force view，并查看相关视图|  
|元数据不变，comment成功|
|  
|权限发生变化|view所在的用户无基表的查询权限， 修改权限可以查询，查询force view，执行comment，并查看相关视图|  
|  
|
|  
|  
|view所在的用户有基表的查询权限， 修改权限不可以查询到基表，查询force view，执行comment，并查看相关视图，|  
|  
|
|  
|创建视图with not only|  
|  
|  
|
|  
|执行多次comment操作  覆盖上一次的注释信息，将COMMENT的内容指定为''删除注释信息|查看对应视图|  
|  
|
|  
|列变更 alter table drop基表，给drop掉的加comment|  
|  
|  
|


*涉及DFX测试*    


|序号|测试场景||预期|备注|
|:---:|:---:|---|:---:|:---:|
|  
|HA场景|主机上基表不存在，备机查询，然后再创建基表，再到备机上查询view和相关视图。备机执行comment，主机执行comment|备机执行失败，主机执行成功|  
|
|  
|  
|主机上将基表的一列删除，在备机上查询view和相关视图。备机执行comment，主机执行comment|主备均执行失败|  
|
|  
|CT/KT|对基表进行DDL(drop、create、  add\drop\modify column、 rename)的时候并发创建comment，并发查询view和相关视图|  
|  
|
|  
|  
|对基表进行DDL(drop、create、  add\drop\modify column、 rename)的时候并发创建comment，并发create or replace force view 、查询view和相关视图|  
|  
|
|  
|  
|对基表进行DDL(drop、create、  add\drop\modify column、 rename)的时候并发创建comment，并发create view、drop view和 查询view和相关视图|  
|  
|
|  
|升级|22.2,创建comment失败，升级后创建成功,升级前失效，升级后改基表，看是否创建成功|  
|  
|


*3)*  *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|原因|
|:---|:---|---|
|CT|涉及|  
|
|KT|涉及|  
|
|长稳|不  涉及|  
|
|一致性|不  涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不  涉及|  
|
|安全|不  涉及|  
|
|DFR|不  涉及|  
|
|HA|涉及|  
|
|压力|不  涉及|  
|
|性能|不  涉及|  
|
|可维护性|不  涉及|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *功能部分放yasft上看护*
- *HA、备份恢复、表空间迁移放ha_regress上看护*
- *CT/KT放testkill框架看护*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments: