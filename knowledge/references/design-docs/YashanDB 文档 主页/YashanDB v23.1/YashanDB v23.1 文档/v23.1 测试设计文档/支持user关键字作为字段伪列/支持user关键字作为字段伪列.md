Created by 胡晓畔, last modified on 十二月 11, 2023

# **1.**  ** **  **概述**

  


  


SR：

br22.2     [[YDBRD-14163] 支持user关键字作为字段伪列 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-14163)  

  [YDBRD-14163](https://jira.yasdb.com/browse/YDBRD-14163?src=confmacro)    -  支持user关键字作为字段伪列  完成

master     [[YDBRD-14179] 支持user关键字作为字段伪列 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-14179)  

  [YDBRD-14179](https://jira.yasdb.com/browse/YDBRD-14179?src=confmacro)    -  支持user关键字作为字段伪列  完成

返回当前登录的用户名，返回类型为varchar，长度为64

  


# **2.**  ** **  **需求分析**

  


开发文档：

  [YDBRD-14163 : USER Design（USER函数方案设计） - 陈芊宇 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109583526)  

  


需求页面见以下文档中内容：

  [【4/28~5/10】【5月10 ready】华润22.2.2.4版本交付 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109580970)  

  


  


  


# **3**  **.**  ** **  **详细测试设计**

1.作为sysvar，不作为函数

2.作为sysvar后，列存支持

3.分布式当前与userenv(client_info)使用位置一致，不支持在DN上使用或涉及分发数据到DN的场景：

  不支持USER返回值插入表

  不支持USER返回值update，delect

  不支持USER做default列，不支持where条件运算...

  不支持的场景报错feature "user on distributed" is not implemented yet

4.USER应用 覆盖字符函数，聚合函数，类型转换，其他函数和运算

5.user应用位置覆盖where条件，orderby groupby 子查询，集合，join 等

6.USER场景覆盖JDBC ODBC PLSQL 同名语法：创建用户 删除用户 alter USER

7.作为关键字和函数同时使用：USER关键字覆盖所有对象名 ，USER关键字作为别名等

8.覆盖sql语法

9.结合视图

  


[支持USER关键字作为字段伪列 - 细分任务.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDRhMWFkOWEzMzExZGM3YTBmIiwicmVmX2lkIjoiNjczOTZhMDM3MjgyMDZlZmI5MmVmOWE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzAxLCJleHAiOjE3ODIyOTcxMDF9.NyfzVl_R6iGkkKBtF8aL5637uToH1sGOFUKhRY1hEhE)

  


|专项|是否涉及|
|:---|:---|
|并发|√|
|长稳|√|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|√|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# **4.**  ** **  **测试用例**

单机：

  [standalone/testcase/dml1/user · br22.2 · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/br22.2/standalone/testcase/dml1/user)  

  


分布式：

  [src/test/tac/dml/test_sdv_ydbrd14163_user_tac_testcase.py · br22.2 · test / Codbase Test · GitLab (yasdb.com)](https://git.yasdb.com/test1/codbase_test/-/blob/br22.2/src/test/tac/dml/test_sdv_ydbrd14163_user_tac_testcase.py)  

  [src/test/lsc/dml/test_sdv_ydbrd14163_user_lsc_testcase.py · br22.2 · test / Codbase Test · GitLab (yasdb.com)](https://git.yasdb.com/test1/codbase_test/-/blob/br22.2/src/test/lsc/dml/test_sdv_ydbrd14163_user_lsc_testcase.py)  

  


# **5.**  ** **  **测试框架设计**

单机：Guider+ yasft框架

分布式：Codbase_test

# **6.**  ** **  **测试环境说明**

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

单机normal

  


  


  


  


## Attachments:

[支持USER关键字作为字段伪列 - 细分任务.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDRhMWFkOWEzMzExZGM3YTBmIiwicmVmX2lkIjoiNjczOTZhMDM3MjgyMDZlZmI5MmVmOWE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzAxLCJleHAiOjE3ODIyOTcxMDF9.NyfzVl_R6iGkkKBtF8aL5637uToH1sGOFUKhRY1hEhE)

 (application/x-xmind)    
