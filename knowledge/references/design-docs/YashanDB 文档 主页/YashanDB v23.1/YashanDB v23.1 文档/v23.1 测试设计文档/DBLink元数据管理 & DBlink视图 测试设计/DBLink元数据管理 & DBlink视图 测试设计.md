Created by 董灵林 on 十月 31, 2023

# **1. 概述**

可以通过dblink连接远端表（当前只支持Oracle、YashanDB）

实现dblink相关的dba、all、user视图

# **2. 需求分析**

### **2.1  SR：**    [YDBRD-13327](https://jira.yasdb.com/browse/YDBRD-13327?src=confmacro)    **-**  **支持DBLINK的元数据管理**  **完成**

开发设计文档：    [YDBRD-13327: DBLINK元数据管理Design](109600331.html)  

支持创建database link连接远端表（当前只支持Oracle、YashanDB）

### 2.2 SR：    [YDBRD-13332](https://jira.yasdb.com/browse/YDBRD-13332?src=confmacro)    -  实现DBA_DB_LINKS视图  完成

开发设计文档：    [YDBRD-13332: DBA_DB_LINKS视图Design](109600357.html)  

创建dblink后，可以通过以下视图查到dblink信息：

dba_objects/all_objects/user_objects

dba_db_links/all_db_links/user_db_links

  


# **3. 测试**  **设计方法**

**dblink元数据管理**

|大类|测试场景|备注|
|:---|:---|:---|
|语法测试点,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,功能测试点|  
,1、create dblink,        1）shared：目前不支持,        2）public：有/无,        3）dblink_name：是否符合标识符规范,        3）connect_clause：,             current_user：目前不支持,             username/password是否正确：语法上不校验,        3）dblink_authentication：目前不支持,        3）connect_string：语法上不校验,2、alter dblink,         1）shared：目前不支持,         2）public：有/无,         3）dblink_name：是否符合标识符规范、是否存在,3、drop dblink,         1）public：有/无,         2）dblink_name：是否符合标识符规范、是否存在,  
,  
,1.alter、drop尚未创建的dblink,2.重复create dblink,3.重复drop dblink,4.public和private管理空间不同,    创建有public，alter、drop带public,    创建无public，alter、drop不带public,    public dblink和private dblink名字一样,    创建有public，alter、drop不带public,    创建无public，alter、drop带public,5.dblink session上限,    同时打开的dblink session数量不超过1024个,6.权限,    没有public权限的用户创建public dblink,    有public权限的用户创建public dblink,    有public权限的用户创建private dblink,    创建dblink用户与alter、drop dblink用户不一致,    创建修改、删除dblink需要授权,    dba用户创建，普通用户alter、drop,    普通用户创建、dba用户alter、drop,    public dblink所有有drop dblink权限的用户都可以drop ,    只有owner、dba或者单独授权该dblink删除权限的用户可以删除private dblink,7.private dblink与public dblink同名时，优先使用哪个dblink？,8.集群和分布式要拦截|  
,  
,  
,  
,  
,  
,  
,  
|
|dfx,  
|1、性能,    参考Oracle连Oracle、Oracle连MySQL,2、可靠性,    执行过程中kill yasdb进程,    执行过程中kill dblink进程（yex_sever),    执行过程中kill 对方数据库进程,3、CT/KT,    并发create/alter/drop,    并发查询视图,    并发连接dblink,    执行任务过程中alter、drop dblink,    并发+主备，备机下线、拉起等|  
|


# dblink视图

|大类|测试场景|备注|
|:---|:---|:---|
|dblink相关视图和系统表|  
,1、系统表,        1）sys.obj$,        2）sys.link$,2、系统视图,         1）USER_DB_LINKS,         2）DBA_DB_LINKS,         3）ALL_DB_LINKS,         4）USER_OBJECTS,         5）DBA_OBJECTS,         6）ALL_OBJECTS,  
|  
,  
,  
,  
,  
,  
,用不同用户（dba用户和普通用户）分别创建public dblink和private dblink，然后查看哪些视图可以查到数据,  
|
|并发|并发查询视图|  
|


# 4.   **详细测试设计**

  


  


  


# 5.   **测试用例**

5.1 dblink元数据

|序号|文件|测试点|
|---|---|---|
|1|test_YDBRD13327_dblink_meta_01|create dblink语法、drop dblink语法|
|2|test_YDBRD13327_dblink_meta_02|alter dblink语法、drop dblink语法|
|3|test_YDBRD13327_dblink_meta_03|dblink名称为关键字的场景一：可用关键字|
|4|test_YDBRD13327_dblink_meta_04|dblink名称为关键字的场景二：不可用关键字|
|5|test_YDBRD13327_dblink_meta_05|dblink名称为特殊字符的场景|
|6|test_YDBRD13327_dblink_meta_06|dblink名称为数字或者数字开头|
|7|test_YDBRD13327_dblink_meta_07|dblink名称大小写|
|8|test_YDBRD13327_dblink_meta_08|dblink名称长度限制|
|9|test_YDBRD13327_dblink_meta_09|alter、drop尚未创建的dblink    
  重复create dblink    
  重复drop dblink|
|10|test_YDBRD13327_dblink_meta_10|dblink权限 - dba用户权限|
|11|test_YDBRD13327_dblink_meta_11|dblink权限 - 普通用户操作dblink的五项授权|
|12|test_YDBRD13327_dblink_meta_12|同一用户创建的public dblink与private dblink的owner不一样|
|13|test_YDBRD13327_dblink_meta_13|不同用户创建的public dblink不能同名，不同用户创建的private dblink可以同名    
  用户可以修改、删除其他用户创建的public dblink，但不能修改、删除其他用户创建的private dblink|
|14|test_YDBRD13327_dblink_meta_14|用户无需授权即可使用public dblink|
|15|test_YDBRD13327_dblink_meta_15|private dblink和public dblink同名时，优先使用public dblink|
|16|test_YDBRD13327_dblink_meta_16|使用dblink连接另一个YashanDB|
|17|test_YDBRD13327_dblink_meta_17|使用dblink连接Oracle|
|18|test_YDBRD13327_dblink_meta_18|不同用户创建同名private dblink + 同名public dblink，使用dblink，然后删除dblink|
|19|test_YDBRD13327_dblink_meta_19|创建错误的dblink连接，使用该dblink 100次；修改dblink为正确连接信息，使用该dblink 100次（主要验证连接错误会不会导致link池泄漏）|
|20|test_YDBRD13327_dblink_meta_20|创建正确的dblink连接，使用该dblink 100次；修改dblink为错误连接信息，使用该dblink 100次（主要验证连接错误会不会导致link池泄漏）|


# dblink视图

|序号|文件|测试点|
|---|---|---|
|1|test_YDBRD13332_dblink_system_view_01|创建、修改、删除dblink后系统表、视图信息变化|
|2|test_YDBRD13332_dblink_system_view_02|创建、修改、删除dblink后系统表、视图信息变化|
|3|test_YDBRD13332_dblink_system_view_03|dba用户和普通用户能够查到的dblink信息差别|
|4|test_YDBRD13332_dblink_system_view_04|dba_db_links、user_db_links、all_db_links与系统表或者系统视图join    
  dba_db_links、user_db_links、all_db_links与普通表或者普通视图join|


# **6 测试框架设计**

## Attachments:

[YDBRD-13327 DBLink元数据管理.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDY4OTcwYzJhZjRmNTFmNmZkIiwicmVmX2lkIjoiNjczOTY5NDY1OTNmOTljOWZmMjM0Y2FmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NDU2LCJleHAiOjE3ODIyMTI4NTZ9.91BxUZPhTMCOWE-WI9Qe826BBLuds0X5xUzKGa-cNh0)

 (application/x-xmind)    


[YDBRD-13332 DBLink视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDY4OTcwYzJhZjRmNTFmNmZlIiwicmVmX2lkIjoiNjczOTY5NDY1OTNmOTljOWZmMjM0Y2FmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NDU2LCJleHAiOjE3ODIyMTI4NTZ9.eNCqJ77H9lLJOKlZ8b04d_QlzRehdV48QA1veJkPUa0)

 (application/x-xmind)    
