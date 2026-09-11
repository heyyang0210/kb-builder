Created by 郑荃, last modified by  刘丹 on 二月 01, 2024

# **1. 概述**

本文主要描述alter index nologging测试设计

# **2. 需求分析**

SR:     [YDBRD-16491](https://jira.yasdb.com/browse/YDBRD-16491?src=confmacro)    -  支持create/alter index nologging语法  完成

开发设计：

# **3. 测试**  **设计方法**   

**测试范围：**

- 表结构：heap、tac、lsc
- 表类型：普通表、分区表、临时表（报错）
- 表的属性：nologging、logging
- 部署形态：单机、HA、集群、分布式
- 索引分类：普通索引、唯一索引、一级分区索引（本地索引、全局索引）、二级分区索引（本地索引、全局索引）、通过创建主键\unique约束自建的索引


**观测点：**

- DBA_INDEXES、USER_INDEXES、ALL_INDEXES可以查询到logging属性（当时只是做语法兼容，属性在dba表中不变）
- alter index nologging\logging 正常场景下可以成功修改
- 错误场景下报错信息正确，清晰。


主要用来测试基本语法，根据语法规则，列出所有可能的输入，划分有效等价类和无效等价类，将有效等价类组合测试，无效等价类单独测试，该方法中会穿插使用边界值法，正交实验法

1、表和索引组合

|表+索引类型|表属性|alter index|
|---|---|---|
|普通表+普通索引|nologging|logging|
|普通表+普通索引|logging|nologging|
|普通表+唯一索引|nologging|nologging|
|普通表+唯一索引|logging|logging|
|分区表+一级分区索引本地索引|nologging|logging|
|分区表+一级分区索引本地索引|logging|nologging|
|分区表+二级分区索引本地索引|nologging|nologging|
|分区表+二级分区索引本地索引|logging|logging|
|分区表+一级分区索引全局索引|nologging|logging|
|分区表+一级分区索引全局索引|logging|nologging|
|分区表+二级分区索引全局索引|nologging|nologging|
|分区表+二级分区索引全局索引|logging|logging|
|反向索引|nologging|logging|
|反向索引|logging|nologging|
|函数索引|nologging|nologging|
|函数索引|logging|logging|
|列式索引|nologging|logging|
|列式索引|logging|nologging|
|通过创建主键、unique约束，自建的索引|nologging|nologging|
|通过创建主键、unique约束，自建的索引|logging|logging|


2、nologging和其他参数组合

例如： alter index index_name visable nologging

|组合项|
|---|
|INITRANS、VISIBLE、INVISIBLE、UNUSABLE、COALESCE、NOPARALLEL、PARALLEL|
|和modify_partition组合|
|和modify_subpartition组合|
|和rebuild_clause组合|


  


3、语法异常

|场景|
|---|
|nologging和logging 同时存在|
|nologging、logging关键字拼写错误|
|nologging、logging关键字拼写重复|


从用户的角度出发，考虑用户视图的实际使用场景，我们列出可能出错的场景，对这些场景进行单独测试

|分类|场景|  
|
|---|---|---|
|修改成nolongging后|做dml，查询，走索引扫描，执行计划正确|  
|
|  
|做rebuild index 操作|  
|
|  
|modify partition|  
|
|  
|modify subpartition|  
|
|  
|drop index|  
|
|  
|truncate表|  
|
|  
|drop表|  
|
|导入导出|修改索引属性为nolongging以后做导出导入|  
|
|HA环境|主机修改成nolongging成功后做switchover，再到新主机上修改为loging|  
|
|  
|主机修改成longging成功后做switchover，再到新主机上修改为loging|  
|
|  
|单机下修改索引属性为nologging，后加备机会重启数据库，对数据进行变更和索引扫描查询|  
|
|并发|并发修改索引 logging/nologging|  
|
|  
|并发创建索引和修改索引logging/nologging|  
|


# 4.   **详细测试设计**   

[alter index nologging测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjU4OTcwYzJhZjRmNTFmYjU2IiwicmVmX2lkIjoiNjczOTY5ZjU1OTNmOTljOWZmMjM1NDc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzU0LCJleHAiOjE3ODIyOTY3NTR9.WlK9g_EfE_aBaG0aMRpwSN8ncFZRa7_Z7gc_uoso3sA)

5.   **测试用例**

# 6.   **测试框架设计**

自动化用例添加到yasft框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjY4OTcwYzJhZjRmNTFmYjU3IiwicmVmX2lkIjoiNjczOTY5ZjU1OTNmOTljOWZmMjM1NDc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzU0LCJleHAiOjE3ODIyOTY3NTR9.vdnLGfrI4FCPdkW3XOn16ANl4swL2B4dGCSJMiYxSH4)

 (application/vnd.xmind.workbook)    


[alter index nologging测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjU4OTcwYzJhZjRmNTFmYjU2IiwicmVmX2lkIjoiNjczOTY5ZjU1OTNmOTljOWZmMjM1NDc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzU0LCJleHAiOjE3ODIyOTY3NTR9.WlK9g_EfE_aBaG0aMRpwSN8ncFZRa7_Z7gc_uoso3sA)

 (application/vnd.xmind.workbook)    


[alter index nologging文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjZhMWFkOWEzMzExZGM3OWNkIiwicmVmX2lkIjoiNjczOTY5ZjU1OTNmOTljOWZmMjM1NDc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzU0LCJleHAiOjE3ODIyOTY3NTR9.1MAdWEtqtzHlsVkxtn3Ve2XfwYplbogTxL8X5JOTEs4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
