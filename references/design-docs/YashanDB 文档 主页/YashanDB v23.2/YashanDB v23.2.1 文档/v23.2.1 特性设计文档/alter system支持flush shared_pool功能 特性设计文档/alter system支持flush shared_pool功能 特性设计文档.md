Created by 陈秋富, last modified on 一月 19, 2024

*归档链接：*    [alter system支持flush shared_pool功能 特性设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141589940)  

*详细设计-YDBRD-21636 : alter system支持flush share_pool功能 Design（alter system支持flush share_pool功能 方案设计）*

*IR链接：YDBRD-XXXX*

*SR链接：*    [YDBRD-21636](https://jira.yasdb.com/browse/YDBRD-21636?src=confmacro)    *-*  *alter system支持flush shared_pool功能*  *完成*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

提供清空SHARE_POOL内存空间中的资源内存功能。当前清空的SHARE_POOL空间包括 SQL/PLSQL里头定义的sql缓存的上下文、匿名块、用户定义的函数、包、触发器。

不过该操作会造成原本缓存的sql语句需要重新编译解析。造成热点数据的缓存丢失。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

目前需求来源于外场使用。需要提供个手段，在内存不断增长的情况下，将share pool内存的空间释放出来。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**概述**     友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

|友商|实现方案概要|链接|
|---|---|---|
|oracle|执行命令后清空 data dictionary、SQL/PLSQL里头定义的sql缓存的上下文、用户定义的函数、过程体、包等。,（正在执行的资源不能清空。）|  [ALTER SYSTEM (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/ALTER-SYSTEM.html#GUID-2C638517-D73A-41CA-9D8E-A62D1A0B7ADB)  |


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|sql语法|ALTER SYSTEM FLUSH SHARED_POOL;,![](https://pingcode.yasdb.com/atlas/files/public/67396bff8970c2af4f52088f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBRUFBQVFBQUFDQUFBQ0FBSUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFJQUFRQUFBQUFBZ0FBQVFBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NDYsImV4cCI6MTc4MjMwOTI0Nn0.nkiNGv0Nr20PjrCXUoWZz95XfOJzW6Rn_9yZekBjoJE),上层结构可参考：    [Alter system - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Alter+system)  |是|是|
|  
|flush功能|当前清空的SHARE_POOL空间包括 SQL/PLSQL里头定义的sql缓存的上下文、匿名块、用户定义的函数、包、触发器。|  
|  
|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|并发场景保证|通过AnlContext上的refCount字段来并发控制，保证不清空当前正在执行的sql资源。|是|是|
|可维可测|内存空间使用清空|可通过系统视图查看相应字段变化情况。,包括 v$plancache、v$global_mpool、v$dict_cache和v$table_dictionary|否|是|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|data dictionary|数据词典，表、列等对象的定义。|是|  [The Data Dictionary (oracle.com)](https://docs.oracle.com/cd/B10500_01/server.920/a96524/c05dicti.htm)  |


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|ALTER SYSTEM FLUSH SHARED_POOL;,![](https://pingcode.yasdb.com/atlas/files/public/67396bff8970c2af4f52088f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBRUFBQVFBQUFDQUFBQ0FBSUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFJQUFRQUFBQUFBZ0FBQVFBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NDYsImV4cCI6MTc4MjMwOTI0Nn0.nkiNGv0Nr20PjrCXUoWZz95XfOJzW6Rn_9yZekBjoJE),上层结构可参考：    [Alter system - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Alter+system)  |----|是|
|函数|CodResult anlPoolFlush(AnlStmt* stmt)|执行清空 sql main pool和pl pool的内存空间，通过当前的stmt去找到系统里头的handle里头挂载的sql pool资源|是|
|高级包|高级包子对象描述|----|否|
|系统视图|v$placache,v$global_mpool,v$dict_cache,v$table_dictionary|（1）从v$placache和v$global_mpool两个视图中可以监控sql main pool和pl pool资源的使用情况。,（2）从v$dict_cache和v$table_dictionary两个视图可以看到dc pool的使用情况。|是|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

oracle支持 data dictionary、sql、plsql内存资源的释放。

而我们目前只针对 sql、plsql、dc table的资源释放。（目前dc pool部分只触发了dc table的回收）

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 flush share pool功能](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

![](https://pingcode.yasdb.com/atlas/files/public/67396bff8970c2af4f520890/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBRUFBQVFBQUFDQUFBQ0FBSUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFJQUFRQUFBQUFBZ0FBQVFBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NDYsImV4cCI6MTc4MjMwOTI0Nn0.nkiNGv0Nr20PjrCXUoWZz95XfOJzW6Rn_9yZekBjoJE)

上图为flush shared pool功能的主要流程图。

（1）在释放的过程中会判断缓存的AnlContext是否还有人正在使用，主要是通过refCount字段去判断。当没有人使用的情况下，会从缓存区中将该AnlContext内存移除，顺带将其资源销毁，使其内存返还给相应的pool结构中。

（2）其中得遵循先释放pl pool后释放sql main pool的资源顺序。（因为匿名块挂载sql的时候，会将对应的AnlContext的refCount计数增加，使其不能释放）。

（3）只有当前没人使用的资源能被释放掉。

###   [4.2 flush过程中并发保护](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

![](https://pingcode.yasdb.com/atlas/files/public/67396bffa1ad9a3311dc8702/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBRUFBQVFBQUFDQUFBQ0FBSUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFJQUFRQUFBQUFBZ0FBQVFBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NDYsImV4cCI6MTc4MjMwOTI0Nn0.nkiNGv0Nr20PjrCXUoWZz95XfOJzW6Rn_9yZekBjoJE)

如上图所示，主要是沿用了sql并发控制的方式，在refCount存在的时候，该sql资源不能被释放掉。

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

（1）关注flush本身的功能，执行alter语句后，从系统视图v$plancache以及v$global_mpool中是否看到了资源释放。

（2）关注并发操作。执行sql的同时，执行flush操作，是否有异常情况。如当前正在执行的sql不能被清空。

（3）关注plsql和普通sql的配合关系。 由于plsql可能挂载多个普通sql。

（4）并发测试用例参考附件 parallel_test.sh 和 test.sql 。其余参考ut用例。

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

（1）当前仍然存在的问题。 plsql创建的sql内存资源未进入到缓存中，所以导致执行flush的时候，plsql的部分没有完全清理掉。

（2）dc pool部分的内存未完全回收完成。目前主要是dc table的资源回收，其他还有包括 DstbTableDict、RouteDict、UdtDict、SeqCachePool等未回收。

  


  


## Attachments:

[alter flush.ebnf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmY4OTcwYzJhZjRmNTIwODhjIiwicmVmX2lkIjoiNjczOTZiZmY1OTNmOTljOWZmMjM2OTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDQ2LCJleHAiOjE3ODIzODQ4NDZ9.bDVoUUeM3iyRP2SenK5F0peaRTGOJ9gfWTN3Xp5lY-0)

 (application/octet-stream)    


[image2024-1-2_11-0-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmZhMWFkOWEzMzExZGM4NmZlIiwicmVmX2lkIjoiNjczOTZiZmY1OTNmOTljOWZmMjM2OTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDQ2LCJleHAiOjE3ODIzODQ4NDZ9.7GmML2bcxACzrbJMGfQLo864C2RvYTnTo_4rxBaO7Co)

 (image/png)    


[image2024-1-2_11-10-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmZhMWFkOWEzMzExZGM4NmZmIiwicmVmX2lkIjoiNjczOTZiZmY1OTNmOTljOWZmMjM2OTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDQ2LCJleHAiOjE3ODIzODQ4NDZ9.c0KjGKAHrAEDBsoVs_KEwnPmdnIrcOstF06m0i4X3Iw)

 (image/png)    


[parallel_test.sh](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmZhMWFkOWEzMzExZGM4NzAxIiwicmVmX2lkIjoiNjczOTZiZmY1OTNmOTljOWZmMjM2OTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDQ2LCJleHAiOjE3ODIzODQ4NDZ9.bAbaz2syx23wqSxAVV8rFBiieB7GgdtYB26-tJ41tKI)

 (application/x-sh)    


[test.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmY4OTcwYzJhZjRmNTIwODhlIiwicmVmX2lkIjoiNjczOTZiZmY1OTNmOTljOWZmMjM2OTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDQ2LCJleHAiOjE3ODIzODQ4NDZ9.pSqPM8EDlP9eQO_7B6cgT-MHkHaSVZ7cP-sYWlpB4ds)

 (application/octet-stream)    


## Comments:

|  [](null)  ,开发设计评审,主持人 ：陈秋富,时间    ：2024-01-03,与会人：罗继鸿、郑荃、刘丹,会议结论：,（1）dc资源回收部分。和存储的同事讨论下。与oracle对齐。,（2）属于开发自测需求，测试辅助上车。,（3）plsql的问题暂时先遗留。,Posted by chenqiufu at 一月 03, 2024 17:51|
|---|
