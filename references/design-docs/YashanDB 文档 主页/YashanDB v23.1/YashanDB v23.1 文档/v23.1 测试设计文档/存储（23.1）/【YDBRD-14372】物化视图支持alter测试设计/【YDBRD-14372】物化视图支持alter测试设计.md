Created by 郑荃, last modified on 一月 25, 2024

# **1. 概述**

本文描述物化视图alter测试设计。

# **2. 需求分析**

SR:     [YDBRD-14372](https://jira.yasdb.com/browse/YDBRD-14372?src=confmacro)    -  物化视图支持alter  完成

开发设计：    [物化视图ALTER设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=117672833)  

![](https://pingcode.yasdb.com/atlas/files/public/673969f28970c2af4f51fb4a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAyNzIsImV4cCI6MTc4MjIyMTA3Mn0.NrOINF5yvOAD_Dfbcm4Q__lTJYyBFnFF-sQgUM3jCoc)

  


|功能|调研表现|
|:---|:---|
|alter_mv_refresh_properties|修改刷新功能的相关属性|
|alter_query_rewrite_clause|修改query rewrite 启用或禁用属性|


  


  


alter refresh属性：

会修改系统表MATERIALIZED_VIEW$ 中的  REFRESH_MODE， REFRESH_TYPE,  DDL_TIME字段

query rewrite的启用与禁用：

会修改系统表MATERIALIZED_VIEW$ 中的property对应的enableRewrite

增加DBA视图  DBA_MATERIALIZED_VIEWS，  对应属性可以查询DBA_MATERIALIZED_VIEWS视图

|字段|说明|
|:---|:---|
|OWNER|物化视图owner名字|
|MV_NAME|物化视图名字|
|REFRESH_MODE|物化视图刷新模式|
|REFRESH_TYPE|物化视图刷新类型|
|DDL_TIME|物化视图发生DDL的时间戳|
|QUERY_REWRITE|是否启用query rewrite|


  


  


# **3. 测试**  **设计方法**   

**测试范围：**

- **master table表结构：heap、tac、lsc**
- **master 表类型：分区表、普通表、临时表、派生表、普通视图、物化视图、dba视图、动态视图**
- **部署形态：单机、HA**


**测试关注点：**

- **语法错误能够正常报错，语法存在矛盾能正常报错，报错后查看系统表、DBA视图，未创建成功**
- **语法正确时，能够成功修改，且相关视图变更正确，物化视图可以正常查询**
- **物化视图修改成功后，观查系统表的各个字段正确，本次主要涉及MATERIALIZED_VIEW$和MV_REFOP$、DBA_MATERIALIZED_VIEWS**


  


**测试过程主要采用普通表和分区表来进行验证，其他表类型做单点覆盖即可**

①等价类划分法

主要用来测试基本语法，根据view的语法规则，列出所有可能的输入，划分有效等价类和无效等价类，将有效等价类组合测试，无效等价类单独测试，该方法中会穿插使用边界值法，正交实验法

1、修改参数的组合验证：

|view-name|REFRESH |ON |START WITH和NEXT|QUERY REWRIT|预期|备注|
|---|---|---|---|---|---|---|
|不带schema|COMPLETE|COMMIT |START WITH 和NEXT 均修改|ENABLE|报错|在过程中穿插关键字的大小写覆盖|
|不带schema|FORCE |DEMAND |START WITH 和NEXT 均修改|DISABLE|  
||
|不带schema|不修改REFRESH |不修改ON |START WITH 和NEXT 均修改|不修改QUERY REWRIT|  
||
|不带schema|FORCE |不修改ON |只修改START WITH|ENABLE|  
||
|不带schema|COMPLETE|COMMIT |只修改START WITH|不修改QUERY REWRIT|报错||
|不带schema|COMPLETE|DEMAND |只修改START WITH|DISABLE|  
||
|当前用户的schema|不修改REFRESH |DEMAND |只修改NEXT|不修改QUERY REWRIT|  
||
|当前用户的schema|FORCE |COMMIT |只修改NEXT|ENABLE|报错||
|当前用户的schema|COMPLETE|不修改ON |只修改NEXT|DISABLE|  
||
|当前用户的schema|FORCE |COMMIT |START WITH 和NEXT 均不修改|不修改QUERY REWRIT|  
||
|当前用户的schema|不修改REFRESH |DEMAND |START WITH 和NEXT 均不修改|ENABLE|  
||
|其他用户的schema|不修改REFRESH |COMMIT |START WITH 和NEXT 均不修改|DISABLE|  
||
|其他用户的schema|COMPLETE|不修改ON |START WITH 和NEXT 均不修改|~不修改QUERY REWRIT|  
||
|其他用户的schema|不修改REFRESH |~COMMIT |只修改START WITH|ENABLE|  
||
|不带schema|NEVER REFRESH|  
|  
|ENABLE|  
||
|当前用户的schema|NEVER REFRESH|  
|  
|DISABLE|  
||
|不带schema|NEVER REFRESH|  
|  
|不修改QUERY REWRIT|  
||
|当前用户的schema|NEVER REFRESH|COMMIT |START WITH 和NEXT 均修改|  
|报错||


2、START WITH 和NEXT的语法校验

|分类|校验项|备注|
|---|---|---|
|START WITH|数据类型校验：date,timestamp,time ;default值校验；时间日期格式校验（date_format）; 时间日期函数表达式：TRUNC、to_date、to_timestamp、 时间格式算数表达式计算， 非数值类型无效表达式|  
|
|  
|特殊值：sysdate,systimestamp,current_timestamp，current_date,NULL,'',空，null，特殊字符、负数|  
|
|  
|时间值校验：sysdate,sysdate之前，sysdate之后；|  
|
|  
|在start with时刻，数据库状态不可用，（read_only,mount,nomount,shutdown）,恢复到open状态后可以正常执行吗，是否会执行恢复之前的任务|  
|
|NEXT|  
|  
|
|  
|数据类型：date,timestamp,time，时间日期函数表达式：TRUNC、to_date、to_timestamp 时间格式算数表达式计算， 非数值类型无效表达式|  
|
|  
|特殊值：sysdate,systimestamp,current_timestamp，current_date,NULL,'',空，null，特殊字符、负数|  
|
|  
|时间值校验：sysdate,sysdate之前，sysdate之后|之前会报错，需要是未来的某个时间|
|  
|具体的某个时间（过去时间、当前时间、未来时间）、或者是时间间隔|之前会报错，需要是未来的某个时间|


3、START WITH 和NEXT的组合

|修改前|修改后|
|---|---|
|START WITH 和NEXT 均存在|只修改START WITH|
|START WITH 和NEXT 均存在|只修改NEXT|
|START WITH 和NEXT 均存在|START WITH和NEXT都修改|
|只有START WITH|只修改START WITH|
|只有START WITH|只修改NEXT|
|只有START WITH|START WITH和NEXT都修改|
|只有NEXT|只修改START WITH|
|只有NEXT|只修改NEXT|
|只有NEXT|START WITH和NEXT都修改|
|START WITH 和NEX均不存在|只修改START WITH|
|START WITH 和NEX均不存在|只修改NEXT|
|START WITH 和NEX均不存在|START WITH和NEXT都修改|


  
  4、异常的组合，  无效等价类验证

|分类|无效等价类|
|---|---|
|view-name|缺失视图名称|
|  
|不存在视图|
|  
|schema不存在|
|REFRESH|FAST|
|  
|其他方式|
|  
|缺少方式|
|ON|STATMENT|
|  
|其他方式|
|关键字|缺少关键字（materialized、view、REFRESH、ON、START WITH 、NEXT）|
|  
|缺少关键字后的值|
|  
|关键字重复|


5、各个参数的公共测试场景

|场景|备注|
|---|---|
|修改前和修改后的值一样|修改成功后，查询相关系统表和视图的值不变|
|修改前和修改后的值不一样|修改成功后，查询相关系统表和视图的值发生变更|
|一次只修改一种属性|  
|
|一次修改多种属性|已经在组合场景覆盖，不需要再单独覆盖|


②错误推测法

从用户的角度出发，考虑用户视图的实际使用场景，我们列出可能出错的场景，对这些场景进行单独测试

|分类|场景|预期结果|备注|
|:---|:---|:---|:---|
|修改后进行查询|select 物化视图|  
|  
|
|  
|视图和表，视图join查询|  
|  
|
|  
|查询时给视图起别名|  
|  
|
|  
|desc 查询物化视图的结构|  
|  
|
|  
|create table as select 物化视图|  
|  
|
|  
|insert into select 物化视图|  
|  
|
|异常场景|删除视图依赖的对象，修改物化视图|  
|  
|
|  
|删除依赖的对象后，创建同名对象后再进行alter|  
|1、包含全部投影列,2、不包含部分投影列|
|  
|修改物化视图后，重启yasdb，重启后物化视图功能正常，查看系统表为修改后的数据|  
|  
|
|  
|使用alter table修改物化视图|  
|  
|
|  
|集群、分布式环境，创建用户视图、表，使用 alter materialized vie修改|  
|  
|
|HA|主机修改物化视图，备机上查询视图，并查询相关系统表是否变更|  
|  
|
|  
|主机修改物化视图后做备份恢复，恢复后查询物化视图和相关系统表|  
|  
|
|  
|修改物化视图主备倒换后，在新主上查看物化视图和相关系统表|  
|  
|
|CT/KT|并发修改物化视图|  
|  
|
|  
|并发创建、修改物化视图|  
|  
|
|  
|并发创建、修改、删除物化视图|  
|  
|
|  
|并发创建、修改、删除物化视图和基表alter 、drop 、create 并发|  
|  
|
|升级|升级前创建master table ，升级后在master的基础上创建物化视图、修改、删除物化视图|  
|  
|


# 4.   **详细测试设计**   

[物化视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjJhMWFkOWEzMzExZGM3OWJlIiwicmVmX2lkIjoiNjczOTY5ZjI3MjgyMDZlZmI5MmVmOTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjcyLCJleHAiOjE3ODIyOTY2NzJ9.D7X6y1iRYnzn-3QQRNZ-wjtq46E3yhHegMjfAbRCMAI)

# 5.   **测试用例**

[物化视图修改测试用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjJhMWFkOWEzMzExZGM3OWJmIiwicmVmX2lkIjoiNjczOTY5ZjI3MjgyMDZlZmI5MmVmOTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjcyLCJleHAiOjE3ODIyOTY2NzJ9.BNY4d2fSKfzVy8ZO4lawTWGU1VdJP5_P_0AI-Iy8rGU)

# 6.   **测试框架设计**

自动化用例添加到regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjI4OTcwYzJhZjRmNTFmYjQ4IiwicmVmX2lkIjoiNjczOTY5ZjI3MjgyMDZlZmI5MmVmOTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjcyLCJleHAiOjE3ODIyOTY2NzJ9.8dvzjphGe3ltnQJXP54tuuLHtTwl7Q84N42v63-IKxs)

 (application/vnd.xmind.workbook)    


[image2023-7-7_10-41-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjI4OTcwYzJhZjRmNTFmYjQ5IiwicmVmX2lkIjoiNjczOTY5ZjI3MjgyMDZlZmI5MmVmOTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjcyLCJleHAiOjE3ODIyOTY2NzJ9.pcduhgx5H4i-l5BrR9MtQxbtSuE99vKomAtYmpj2bCY)

 (image/png)    


[物化视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjJhMWFkOWEzMzExZGM3OWJlIiwicmVmX2lkIjoiNjczOTY5ZjI3MjgyMDZlZmI5MmVmOTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjcyLCJleHAiOjE3ODIyOTY2NzJ9.D7X6y1iRYnzn-3QQRNZ-wjtq46E3yhHegMjfAbRCMAI)

 (application/vnd.xmind.workbook)    


[物化视图修改测试用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjJhMWFkOWEzMzExZGM3OWJmIiwicmVmX2lkIjoiNjczOTY5ZjI3MjgyMDZlZmI5MmVmOTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjcyLCJleHAiOjE3ODIyOTY2NzJ9.BNY4d2fSKfzVy8ZO4lawTWGU1VdJP5_P_0AI-Iy8rGU)

 (application/vnd.ms-excel)    
