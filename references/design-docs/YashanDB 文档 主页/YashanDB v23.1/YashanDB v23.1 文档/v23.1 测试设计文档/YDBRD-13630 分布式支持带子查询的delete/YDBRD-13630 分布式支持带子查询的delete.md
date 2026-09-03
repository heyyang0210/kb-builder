Created by 胡晓畔, last modified on 十二月 11, 2023

# **1.**  ** **  **概述**

SR：    [[YDBRD-13630] 分布式支持带子查询的delete - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13630)  

  [YDBRD-13630](https://jira.yasdb.com/browse/YDBRD-13630?src=confmacro)    -  分布式支持带子查询的delete  完成

# **2.**  ** **  **需求分析**

开发文档：    [分布式支持delete,update带子查询 - 林俊喆 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122070053)  

未变更delete语法      [DELETE | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/DELETE.html)  

  


# **3.**  ** **  **详细测试设计**

1.根据delete语法覆盖子查询所在位置

2.子查询覆盖filter条件，嵌套/非嵌套子查询

3.覆盖数据类型

4.覆盖表：复制表，分布表，分区表，tac，lsc ，混合表场景

5.结合其他特性：集合，函数，join等

6.plsql应用：绑定参数 匿名块等场景

7.不支持关联子查询，带关联子查询报错

不支持多表delete 

单机  in/exist/any/all会改写成join，提高执行效率，分布式不会 

 

[分布式支持带子查询的delete.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTA4OTcwYzJhZjRmNTFmOTFiIiwicmVmX2lkIjoiNjczOTY5OTA1OTNmOTljOWZmMjM0ZmY1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MjM0LCJleHAiOjE3ODIyOTM2MzR9.UKAxd-Tfu0ZnTHnlgs2Hw7-ndtn5i8xV7qJIc34gqwQ)

  


|专项|是否涉及|
|:---|:---|
|并发|√|
|长稳|√|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|√|
|安全|否|
|DFR/testkill|√|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# **4.**  ** **  **测试用例**

  


  [distribution/testcase/DML2/subquery_delete · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/DML2/subquery_delete)  

# **5.**  ** **  **测试框架**

单机：Guider+ yasft框架

分布式：Codbase_test

# **6.**  ** **  **测试环境说明**

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

单机normal

分布式1MN 1CN 3DN

  


## Attachments:

[分布式支持带子查询的delete.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTA4OTcwYzJhZjRmNTFmOTFiIiwicmVmX2lkIjoiNjczOTY5OTA1OTNmOTljOWZmMjM0ZmY1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MjM0LCJleHAiOjE3ODIyOTM2MzR9.UKAxd-Tfu0ZnTHnlgs2Hw7-ndtn5i8xV7qJIc34gqwQ)

 (application/x-xmind)    
